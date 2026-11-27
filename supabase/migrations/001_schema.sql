-- ============================================================================
-- HARU — 001. 스키마 (테이블 · 인덱스 · 트리거 · 검색 함수)
--
-- 실행 방법: Supabase 대시보드 → SQL Editor → New query → 전체 붙여넣기 → Run
-- 실행 순서: 001_schema.sql → 002_policies.sql → seed.sql
--
-- 이 파일은 여러 번 실행해도 안전하도록 작성했습니다(IF NOT EXISTS / OR REPLACE).
-- ============================================================================

-- ── 확장 기능 ───────────────────────────────────────────────────────────────
-- PostGIS: 좌표 저장과 거리 계산. Supabase는 확장을 extensions 스키마에 둡니다.
create extension if not exists postgis with schema extensions;
-- pgcrypto: seed.sql 에서 데모 계정 비밀번호 해시 생성에 사용
create extension if not exists pgcrypto with schema extensions;

-- 함수 본문에서 PostGIS 함수를 스키마 없이 쓰기 위해 search_path 에 추가
set search_path = public, extensions;


-- ============================================================================
-- 1. profiles — 사용자 프로필
--    auth.users(인증 정보)와 1:1. 닉네임·활동지역·평점 집계를 보관합니다.
-- ============================================================================
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  nickname      text not null unique check (char_length(nickname) between 2 and 12),
  phone         text,
  bio           text check (bio is null or char_length(bio) <= 200),
  avatar_url    text,
  region_code   text,
  base_lat      double precision,
  base_lng      double precision,
  -- 구인자로서 받은 평균 평점. 리뷰 트리거가 갱신합니다(앱이 직접 쓰지 않습니다).
  rating_avg    numeric(3,2) not null default 0,
  review_count  integer      not null default 0,
  role          text not null default 'user' check (role in ('user','admin')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_profiles_role on public.profiles(role);


-- ============================================================================
-- 2. job_posts — 구인 공고
-- ============================================================================
create table if not exists public.job_posts (
  id            uuid primary key default gen_random_uuid(),
  employer_id   uuid not null references public.profiles(id) on delete cascade,
  title         text not null check (char_length(title) between 5 and 60),
  company_name  text not null,
  category      text not null check (category in (
                  'serving','kitchen','cafe','delivery','logistics',
                  'construction','event','mart','cleaning','office','etc')),
  description   text not null check (char_length(description) >= 10),
  work_date     date not null,
  start_time    time not null,
  end_time      time not null,
  pay_type      text not null default 'hourly' check (pay_type in ('hourly','daily')),
  pay_amount    integer not null check (pay_amount > 0),
  headcount     integer not null default 1 check (headcount >= 1),
  place_name    text not null,
  address       text,
  lat           double precision not null check (lat between -90 and 90),
  lng           double precision not null check (lng between -180 and 180),
  -- 거리 계산용 좌표. 아래 트리거가 lat/lng 로부터 자동 채웁니다.
  location      geography(Point, 4326),
  requirements  text,
  belongings    text,
  status        text not null default 'open' check (status in ('open','closed','hidden')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 근접 검색의 핵심. 공간 인덱스가 없으면 전체 스캔이 됩니다.
create index if not exists idx_job_posts_location    on public.job_posts using gist(location);
create index if not exists idx_job_posts_status_date on public.job_posts(status, work_date);
create index if not exists idx_job_posts_employer    on public.job_posts(employer_id);
create index if not exists idx_job_posts_category    on public.job_posts(category);

-- lat/lng → location 자동 변환
-- (생성 컬럼(GENERATED)으로도 가능하지만, PostGIS 캐스팅의 immutable 판정이
--  환경에 따라 달라 거부되는 경우가 있어 트리거 방식을 택했습니다.)
create or replace function public.sync_job_location()
returns trigger
language plpgsql
as $$
begin
  new.location := extensions.st_setsrid(
                    extensions.st_makepoint(new.lng, new.lat), 4326)::extensions.geography;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_sync_job_location on public.job_posts;
create trigger trg_sync_job_location
before insert or update of lat, lng on public.job_posts
for each row execute function public.sync_job_location();


-- ============================================================================
-- 3. job_applications — 지원 내역
--    UNIQUE 제약이 중복 지원을 막는 최종 방어선입니다.
-- ============================================================================
create table if not exists public.job_applications (
  id            uuid primary key default gen_random_uuid(),
  job_post_id   uuid not null references public.job_posts(id) on delete cascade,
  applicant_id  uuid not null references public.profiles(id) on delete cascade,
  message       text,
  status        text not null default 'pending'
                  check (status in ('pending','accepted','rejected','cancelled','completed')),
  applied_at    timestamptz not null default now(),
  completed_at  timestamptz,
  unique (job_post_id, applicant_id)          -- ← 중복 지원 차단
);

create index if not exists idx_applications_applicant on public.job_applications(applicant_id, status);
create index if not exists idx_applications_job       on public.job_applications(job_post_id, status);

-- 상태 전이 규칙을 DB에서도 강제합니다(프론트 검증과 이중화).
create or replace function public.check_application_transition()
returns trigger
language plpgsql
as $$
begin
  if old.status = new.status then
    return new;
  end if;

  if not (
       (old.status = 'pending'  and new.status in ('accepted','rejected','cancelled'))
    or (old.status = 'accepted' and new.status in ('completed','rejected'))
  ) then
    raise exception '허용되지 않는 상태 변경입니다: % → %', old.status, new.status;
  end if;

  if new.status = 'completed' and new.completed_at is null then
    new.completed_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_application_transition on public.job_applications;
create trigger trg_check_application_transition
before update of status on public.job_applications
for each row execute function public.check_application_transition();


-- ============================================================================
-- 4. reviews — 근무 후기 (HARU 핵심 차별화)
--    application_id UNIQUE → 한 번의 근무에 후기 1개.
--    "근무 완료자만 작성" 권한은 002_policies.sql 의 RLS 가 담당합니다.
-- ============================================================================
create table if not exists public.reviews (
  id                 uuid primary key default gen_random_uuid(),
  application_id     uuid not null unique references public.job_applications(id) on delete cascade,
  job_post_id        uuid not null references public.job_posts(id) on delete cascade,
  reviewer_id        uuid not null references public.profiles(id) on delete cascade,
  employer_id        uuid not null references public.profiles(id) on delete cascade,
  rating_pay         smallint not null check (rating_pay         between 1 and 5),
  rating_workload    smallint not null check (rating_workload    between 1 and 5),
  rating_environment smallint not null check (rating_environment between 1 and 5),
  rating_accuracy    smallint not null check (rating_accuracy    between 1 and 5),
  would_work_again   boolean  not null,
  rating_overall     numeric(3,2) generated always as (
                       (rating_pay + rating_workload + rating_environment + rating_accuracy)::numeric / 4
                     ) stored,
  content            text not null check (char_length(content) >= 10),
  is_hidden          boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_reviews_employer on public.reviews(employer_id) where is_hidden = false;
create index if not exists idx_reviews_job      on public.reviews(job_post_id);

-- 업체 평균 평점 자동 재계산 (숨김 처리된 후기는 제외)
create or replace function public.recalc_employer_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid := coalesce(new.employer_id, old.employer_id);
begin
  update public.profiles p
     set rating_avg = coalesce((
           select round(avg(r.rating_overall), 2)
             from public.reviews r
            where r.employer_id = target and r.is_hidden = false), 0),
         review_count = (
           select count(*)
             from public.reviews r
            where r.employer_id = target and r.is_hidden = false),
         updated_at = now()
   where p.id = target;
  return null;
end;
$$;

drop trigger if exists trg_recalc_employer_rating on public.reviews;
create trigger trg_recalc_employer_rating
after insert or update or delete on public.reviews
for each row execute function public.recalc_employer_rating();


-- ============================================================================
-- 5. 커뮤니티
-- ============================================================================
create table if not exists public.community_posts (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid not null references public.profiles(id) on delete cascade,
  category      text not null check (category in ('review','info','free','caution')),
  title         text not null check (char_length(title) between 2 and 60),
  content       text not null check (char_length(content) >= 5),
  view_count    integer not null default 0,
  like_count    integer not null default 0,
  comment_count integer not null default 0,
  is_hidden     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_posts_category on public.community_posts(category, created_at desc);
create index if not exists idx_posts_author   on public.community_posts(author_id);

create table if not exists public.community_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.community_posts(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  content    text not null check (char_length(content) >= 2),
  is_hidden  boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_comments_post on public.community_comments(post_id, created_at);

create table if not exists public.post_likes (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.community_posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)                   -- ← 중복 좋아요 차단
);

-- 좋아요·댓글 수 자동 갱신
create or replace function public.recalc_post_counters()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid := coalesce(new.post_id, old.post_id);
begin
  update public.community_posts p
     set like_count    = (select count(*) from public.post_likes        l where l.post_id = target),
         comment_count = (select count(*) from public.community_comments c
                           where c.post_id = target and c.is_hidden = false)
   where p.id = target;
  return null;
end;
$$;

drop trigger if exists trg_recalc_post_likes on public.post_likes;
create trigger trg_recalc_post_likes
after insert or delete on public.post_likes
for each row execute function public.recalc_post_counters();

drop trigger if exists trg_recalc_post_comments on public.community_comments;
create trigger trg_recalc_post_comments
after insert or update or delete on public.community_comments
for each row execute function public.recalc_post_counters();


-- ============================================================================
-- 6. reports — 신고
--    target_id 는 4종 테이블을 가리키는 다형 참조라 외래키를 걸 수 없습니다.
--    대신 (신고자, 대상종류, 대상ID) 조합을 UNIQUE 로 묶어 중복 신고를 막습니다.
-- ============================================================================
create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in
                ('job_post','review','community_post','community_comment')),
  target_id   uuid not null,
  reason      text not null,
  detail      text,
  status      text not null default 'pending' check (status in ('pending','resolved','rejected')),
  handled_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);

create index if not exists idx_reports_status on public.reports(status, created_at desc);


-- ============================================================================
-- 7. 회원가입 시 프로필 자동 생성
--    앱은 auth.signUp() 만 호출하고, 프로필 행은 이 트리거가 만듭니다.
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nickname, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nickname', '사용자' || substr(new.id::text, 1, 6)),
    new.raw_user_meta_data ->> 'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();


-- ============================================================================
-- 8. 관리자 권한 상승 차단
--    사용자는 자기 프로필을 수정할 수 있으므로, role 변경만 따로 막습니다.
--    RLS 만으로는 "어떤 컬럼이 바뀌었는지"를 판별할 수 없어 트리거가 필요합니다.
-- ============================================================================
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    if not exists (
      select 1 from public.profiles
       where id = auth.uid() and role = 'admin'
    ) then
      raise exception 'role 은 관리자만 변경할 수 있습니다.';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_prevent_role_escalation on public.profiles;
create trigger trg_prevent_role_escalation
before update on public.profiles
for each row execute function public.prevent_role_escalation();


-- ============================================================================
-- 9. search_jobs — 근접 검색 RPC
--    거리 계산을 DB 한 곳에 모아, 화면마다 다르게 구현되는 일을 막습니다.
--    security invoker 이므로 RLS 가 그대로 적용됩니다.
--    (security definer 로 만들면 RLS 를 우회해 버리므로 쓰지 않습니다.)
-- ============================================================================
create or replace function public.search_jobs(
  p_lat       double precision,
  p_lng       double precision,
  p_radius_m  integer default 5000,
  p_category  text    default null,
  p_date_from date    default null,
  p_date_to   date    default null,
  p_pay_type  text    default null,
  p_min_pay   integer default null,
  p_keyword   text    default null,
  p_sort      text    default 'distance',   -- distance | pay | recent
  p_limit     integer default 20,
  p_offset    integer default 0
)
returns table (
  id              uuid,
  title           text,
  company_name    text,
  category        text,
  work_date       date,
  start_time      time,
  end_time        time,
  pay_type        text,
  pay_amount      integer,
  headcount       integer,
  place_name      text,
  lat             double precision,
  lng             double precision,
  employer_id     uuid,
  status          text,
  rating_avg      numeric,
  review_count    integer,
  applicant_count bigint,
  distance_m      double precision,
  created_at      timestamptz
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with origin as (
    select st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography as g
  )
  select j.id, j.title, j.company_name, j.category,
         j.work_date, j.start_time, j.end_time,
         j.pay_type, j.pay_amount, j.headcount,
         j.place_name, j.lat, j.lng,
         j.employer_id, j.status,
         p.rating_avg, p.review_count,
         (select count(*) from public.job_applications a where a.job_post_id = j.id),
         st_distance(j.location, o.g),
         j.created_at
    from public.job_posts j
    join public.profiles p on p.id = j.employer_id
   cross join origin o
   where j.status = 'open'
     and st_dwithin(j.location, o.g, p_radius_m)
     and (p_category  is null or j.category   = p_category)
     and (p_date_from is null or j.work_date >= p_date_from)
     and (p_date_to   is null or j.work_date <= p_date_to)
     and (p_pay_type  is null or j.pay_type   = p_pay_type)
     and (p_min_pay   is null or j.pay_amount >= p_min_pay)
     and (p_keyword   is null
          or j.title        ilike '%' || p_keyword || '%'
          or j.description  ilike '%' || p_keyword || '%'
          or j.company_name ilike '%' || p_keyword || '%'
          or j.place_name   ilike '%' || p_keyword || '%')
   order by
     case when p_sort = 'distance' then st_distance(j.location, o.g) end asc,
     -- 급여순: 시급은 8시간 환산해 일급과 같은 기준으로 비교
     case when p_sort = 'pay'
          then (case when j.pay_type = 'daily' then j.pay_amount else j.pay_amount * 8 end)
     end desc,
     case when p_sort = 'recent' then extract(epoch from j.created_at) end desc
   limit p_limit offset p_offset;
$$;

-- 같은 조건의 전체 건수 (페이지네이션용)
create or replace function public.count_jobs(
  p_lat       double precision,
  p_lng       double precision,
  p_radius_m  integer default 5000,
  p_category  text    default null,
  p_date_from date    default null,
  p_date_to   date    default null,
  p_pay_type  text    default null,
  p_min_pay   integer default null,
  p_keyword   text    default null
)
returns bigint
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select count(*)
    from public.job_posts j
   where j.status = 'open'
     and st_dwithin(j.location,
                    st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
                    p_radius_m)
     and (p_category  is null or j.category   = p_category)
     and (p_date_from is null or j.work_date >= p_date_from)
     and (p_date_to   is null or j.work_date <= p_date_to)
     and (p_pay_type  is null or j.pay_type   = p_pay_type)
     and (p_min_pay   is null or j.pay_amount >= p_min_pay)
     and (p_keyword   is null
          or j.title        ilike '%' || p_keyword || '%'
          or j.description  ilike '%' || p_keyword || '%'
          or j.company_name ilike '%' || p_keyword || '%'
          or j.place_name   ilike '%' || p_keyword || '%');
$$;


-- ============================================================================
-- 완료. 다음: 002_policies.sql 을 실행하세요.
-- 이 시점에는 아직 RLS 가 꺼져 있어 데이터가 보호되지 않습니다.
-- ============================================================================
