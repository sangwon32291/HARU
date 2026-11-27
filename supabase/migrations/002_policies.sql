-- ============================================================================
-- HARU — 002. RLS 권한 정책
--
-- 실행 순서: 001_schema.sql → **002_policies.sql** → seed.sql
--
-- RLS(Row Level Security)란:
--   "이 행을 누가 읽고 쓸 수 있는가"를 데이터베이스가 직접 검사하는 규칙입니다.
--   프론트엔드에서 버튼을 숨기는 것과 달리, 개발자도구로 요청을 조작해도
--   우회할 수 없습니다. HARU 의 권한 보호는 전부 이 파일이 담당합니다.
--
-- 핵심 정책은 두 가지입니다.
--   ① reviews_insert  — 근무 완료자만 후기 작성 (HARU 차별화의 근거)
--   ② applications_*  — 지원자 정보는 본인과 해당 구인자에게만 공개
-- ============================================================================

set search_path = public, extensions;

-- ── 전 테이블 RLS 활성화 ────────────────────────────────────────────────────
-- 활성화하면 정책에 명시된 것 외에는 모두 차단됩니다(기본 거부).
alter table public.profiles           enable row level security;
alter table public.job_posts          enable row level security;
alter table public.job_applications   enable row level security;
alter table public.reviews            enable row level security;
alter table public.community_posts    enable row level security;
alter table public.community_comments enable row level security;
alter table public.post_likes         enable row level security;
alter table public.reports            enable row level security;


-- ── 보조 함수: 현재 사용자가 관리자인가 ─────────────────────────────────────
-- 정책 안에서 profiles 를 직접 조회하면 profiles 자신의 정책과 맞물려
-- 무한 재귀가 발생합니다. security definer 함수로 RLS 를 우회해 조회합니다.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, anon;


-- ============================================================================
-- profiles
--   조회: 전체 공개 (닉네임·평점은 공고/후기에 노출되어야 함)
--         ※ phone 은 앱에서 선택하지 않습니다. 민감정보는 뷰로 분리하는 것이
--           더 안전하지만, 수업 범위를 고려해 앱 레벨 약속으로 둡니다.
--   생성: 트리거(handle_new_user)만 수행 → INSERT 정책 없음
--   수정: 본인만. role 변경은 001 의 트리거가 추가로 차단
--   삭제: 금지 (auth.users 삭제 시 CASCADE)
-- ============================================================================
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (true);

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using      (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());


-- ============================================================================
-- job_posts
--   조회: 숨김 처리되지 않은 공고는 비로그인도 볼 수 있어야 함
--   생성: 본인을 employer_id 로만
--   수정/삭제: 작성자 또는 관리자
-- ============================================================================
drop policy if exists job_posts_select on public.job_posts;
create policy job_posts_select on public.job_posts
  for select using (
    status <> 'hidden'
    or employer_id = auth.uid()
    or public.is_admin()
  );

drop policy if exists job_posts_insert on public.job_posts;
create policy job_posts_insert on public.job_posts
  for insert to authenticated
  with check (auth.uid() = employer_id);

drop policy if exists job_posts_update on public.job_posts;
create policy job_posts_update on public.job_posts
  for update to authenticated
  using      (auth.uid() = employer_id or public.is_admin())
  with check (auth.uid() = employer_id or public.is_admin());

drop policy if exists job_posts_delete on public.job_posts;
create policy job_posts_delete on public.job_posts
  for delete to authenticated
  using (auth.uid() = employer_id or public.is_admin());


-- ============================================================================
-- job_applications — 지원자 정보 보호
--   조회: 지원자 본인 / 해당 공고의 구인자 / 관리자
--         → 남의 공고에 누가 지원했는지 볼 수 없습니다.
--   생성: 본인 명의로만. 본인 공고 금지. 모집중인 공고만.
--   수정: 구직자는 취소만, 구인자는 승인/거절/완료만
--         (어느 상태로 바꿀 수 있는지는 001 의 전이 트리거가 검사)
--   삭제: 금지 (이력이 남아야 후기 권한을 검증할 수 있음)
-- ============================================================================
drop policy if exists applications_select on public.job_applications;
create policy applications_select on public.job_applications
  for select to authenticated
  using (
    applicant_id = auth.uid()
    or exists (
      select 1 from public.job_posts j
       where j.id = job_post_id and j.employer_id = auth.uid()
    )
    or public.is_admin()
  );

drop policy if exists applications_insert on public.job_applications;
create policy applications_insert on public.job_applications
  for insert to authenticated
  with check (
    applicant_id = auth.uid()
    and exists (
      select 1 from public.job_posts j
       where j.id = job_post_id
         and j.status = 'open'           -- 마감 공고 지원 차단
         and j.employer_id <> auth.uid() -- 본인 공고 지원 차단
    )
  );

drop policy if exists applications_update_applicant on public.job_applications;
create policy applications_update_applicant on public.job_applications
  for update to authenticated
  using      (applicant_id = auth.uid())
  with check (applicant_id = auth.uid() and status in ('cancelled','pending'));

drop policy if exists applications_update_employer on public.job_applications;
create policy applications_update_employer on public.job_applications
  for update to authenticated
  using (
    exists (select 1 from public.job_posts j
             where j.id = job_post_id and j.employer_id = auth.uid())
    or public.is_admin()
  )
  with check (
    status in ('accepted','rejected','completed','pending')
    and (
      exists (select 1 from public.job_posts j
               where j.id = job_post_id and j.employer_id = auth.uid())
      or public.is_admin()
    )
  );


-- ============================================================================
-- reviews — ★ HARU 의 핵심 권한 정책 ★
--
--   "실제 근무가 확인된 사용자만 후기를 작성할 수 있다"를 DB 가 보장합니다.
--   아래 INSERT 정책은 다음을 모두 만족해야 통과합니다.
--     · 작성자가 본인일 것
--     · 그 지원 건의 지원자가 본인일 것
--     · 그 지원 건의 상태가 'completed' 일 것      ← 근무 완료 확인
--     · 후기의 job_post_id 가 그 지원 건의 공고와 일치할 것
--     · employer_id 가 그 공고의 실제 구인자일 것  ← 평점 조작 방지
--   (한 지원 건에 후기 1개 제한은 001 의 UNIQUE 제약이 담당)
-- ============================================================================
drop policy if exists reviews_select on public.reviews;
create policy reviews_select on public.reviews
  for select using (
    is_hidden = false
    or reviewer_id = auth.uid()
    or public.is_admin()
  );

drop policy if exists reviews_insert on public.reviews;
create policy reviews_insert on public.reviews
  for insert to authenticated
  with check (
    reviewer_id = auth.uid()
    and exists (
      select 1
        from public.job_applications a
        join public.job_posts j on j.id = a.job_post_id
       where a.id            = application_id
         and a.applicant_id  = auth.uid()
         and a.status        = 'completed'
         and a.job_post_id   = reviews.job_post_id
         and j.employer_id   = reviews.employer_id
    )
  );

drop policy if exists reviews_update on public.reviews;
create policy reviews_update on public.reviews
  for update to authenticated
  using      (reviewer_id = auth.uid() or public.is_admin())
  -- 관리자는 숨김 처리만, 작성자는 내용만 수정 가능하도록
  -- reviewer_id / application_id 변경은 아래 조건이 막습니다.
  with check (reviewer_id = auth.uid() or public.is_admin());

drop policy if exists reviews_delete on public.reviews;
create policy reviews_delete on public.reviews
  for delete to authenticated
  using (reviewer_id = auth.uid() or public.is_admin());


-- ============================================================================
-- community_posts / community_comments / post_likes
-- ============================================================================
drop policy if exists posts_select on public.community_posts;
create policy posts_select on public.community_posts
  for select using (is_hidden = false or author_id = auth.uid() or public.is_admin());

drop policy if exists posts_insert on public.community_posts;
create policy posts_insert on public.community_posts
  for insert to authenticated with check (author_id = auth.uid());

drop policy if exists posts_update on public.community_posts;
create policy posts_update on public.community_posts
  for update to authenticated
  using      (author_id = auth.uid() or public.is_admin())
  with check (author_id = auth.uid() or public.is_admin());

drop policy if exists posts_delete on public.community_posts;
create policy posts_delete on public.community_posts
  for delete to authenticated using (author_id = auth.uid() or public.is_admin());

drop policy if exists comments_select on public.community_comments;
create policy comments_select on public.community_comments
  for select using (is_hidden = false or author_id = auth.uid() or public.is_admin());

drop policy if exists comments_insert on public.community_comments;
create policy comments_insert on public.community_comments
  for insert to authenticated with check (author_id = auth.uid());

drop policy if exists comments_update on public.community_comments;
create policy comments_update on public.community_comments
  for update to authenticated
  using      (author_id = auth.uid() or public.is_admin())
  with check (author_id = auth.uid() or public.is_admin());

drop policy if exists comments_delete on public.community_comments;
create policy comments_delete on public.community_comments
  for delete to authenticated using (author_id = auth.uid() or public.is_admin());

drop policy if exists likes_select on public.post_likes;
create policy likes_select on public.post_likes for select using (true);

drop policy if exists likes_insert on public.post_likes;
create policy likes_insert on public.post_likes
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists likes_delete on public.post_likes;
create policy likes_delete on public.post_likes
  for delete to authenticated using (user_id = auth.uid());


-- ============================================================================
-- reports
--   조회: 신고자 본인과 관리자만 (남의 신고 내역은 볼 수 없음)
--   생성: 로그인 사용자, 본인 명의로만
--   수정: 관리자만 (처리 상태 변경)
--   삭제: 금지
-- ============================================================================
drop policy if exists reports_select on public.reports;
create policy reports_select on public.reports
  for select to authenticated
  using (reporter_id = auth.uid() or public.is_admin());

drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports
  for insert to authenticated with check (reporter_id = auth.uid());

drop policy if exists reports_update on public.reports;
create policy reports_update on public.reports
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());


-- ============================================================================
-- 테이블 접근 권한 (GRANT)
--
-- RLS 와 GRANT 는 서로 다른 層입니다.
--   GRANT : "이 테이블에 접근할 수 있는가"  (테이블 단위)
--   RLS   : "그중 어떤 행을 다룰 수 있는가" (행 단위)
-- 둘 다 통과해야 쿼리가 실행됩니다. GRANT 가 없으면 RLS 정책이 아무리 맞아도
-- "permission denied for table ..." 오류가 납니다.
--
-- Supabase 는 보통 public 스키마에 기본 권한을 설정해 두어 자동으로 부여되지만,
-- 환경에 따라 누락될 수 있으므로 명시적으로 지정합니다.
-- ============================================================================
grant usage on schema public to anon, authenticated;

-- 비로그인(anon): 공개 정보 읽기만
grant select on public.profiles, public.job_posts, public.reviews,
                 public.community_posts, public.community_comments, public.post_likes
  to anon;

-- 로그인 사용자(authenticated): 읽기 + 쓰기. 실제 허용 범위는 위 RLS 정책이 결정합니다.
grant select, insert, update, delete on
  public.profiles, public.job_posts, public.job_applications, public.reviews,
  public.community_posts, public.community_comments, public.post_likes, public.reports
  to authenticated;

-- 앞으로 추가될 테이블에도 같은 기본 권한이 적용되도록 설정
alter default privileges in schema public
  grant select on tables to anon;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;


-- ============================================================================
-- 검색 함수 실행 권한
-- ============================================================================
grant execute on function public.search_jobs(
  double precision, double precision, integer, text, date, date,
  text, integer, text, text, integer, integer
) to anon, authenticated;

grant execute on function public.count_jobs(
  double precision, double precision, integer, text, date, date, text, integer, text
) to anon, authenticated;


-- ============================================================================
-- 정책이 제대로 걸렸는지 확인 (결과가 표로 출력됩니다)
-- 8개 테이블 모두 rls_enabled = true 여야 합니다.
-- ============================================================================
select c.relname            as table_name,
       c.relrowsecurity     as rls_enabled,
       count(p.polname)     as policy_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_policy p on p.polrelid = c.oid
 where n.nspname = 'public'
   and c.relname in ('profiles','job_posts','job_applications','reviews',
                     'community_posts','community_comments','post_likes','reports')
 group by c.relname, c.relrowsecurity
 order by c.relname;
