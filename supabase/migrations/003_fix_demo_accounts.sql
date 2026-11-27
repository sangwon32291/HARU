-- ============================================================================
-- HARU — 003. 데모 계정 로그인 오류 수정
--
-- 증상: seed.sql 로 만든 @haru.test 계정으로 로그인하면
--       {"code":500, "msg":"Database error querying schema"} 가 돌아온다.
--       (신규 회원가입은 정상 동작한다 — 이것이 원인을 가르는 단서다)
--
-- 원인: auth.users 에 직접 INSERT 하면 인증 서버(GoTrue)가 읽는 토큰 컬럼들이
--       NULL 로 남는다. GoTrue 는 이 컬럼들을 "빈 문자열"로 기대하므로,
--       NULL 을 만나면 조회 단계에서 실패한다.
--       회원가입 API 로 만든 계정은 GoTrue 가 직접 채우므로 문제가 없다.
--
-- 조치: 해당 컬럼들을 빈 문자열로 채운다. 이미 값이 있으면 그대로 둔다.
--
-- 실행: SQL Editor 에 붙여넣고 Run. 한 번만 하면 된다.
--       (GoTrue 버전마다 컬럼 구성이 달라서, 존재하는 컬럼만 골라 처리한다)
-- ============================================================================

do $$
declare
  col text;
  text_cols text[] := array[
    'confirmation_token',
    'recovery_token',
    'email_change',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change',
    'phone_change_token',
    'reauthentication_token'
  ];
  fixed int := 0;
begin
  foreach col in array text_cols loop
    if exists (
      select 1 from information_schema.columns
       where table_schema = 'auth' and table_name = 'users' and column_name = col
    ) then
      execute format(
        'update auth.users set %I = '''' where %I is null and email like ''%%@haru.test''',
        col, col
      );
      fixed := fixed + 1;
    end if;
  end loop;

  -- 숫자 컬럼: NULL 이면 0
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'auth' and table_name = 'users'
       and column_name = 'email_change_confirm_status'
  ) then
    update auth.users
       set email_change_confirm_status = 0
     where email_change_confirm_status is null and email like '%@haru.test';
  end if;

  -- 이메일 인증 완료 표시 (Confirm email 설정과 무관하게 로그인 가능하도록)
  update auth.users
     set email_confirmed_at = coalesce(email_confirmed_at, now())
   where email like '%@haru.test';

  raise notice '처리한 토큰 컬럼 수: %', fixed;
end $$;


-- ── 확인 ────────────────────────────────────────────────────────────────────
-- 아래 결과에서 null_남은_계정 이 0 이면 정상입니다.
select
  count(*) filter (where email like '%@haru.test')                         as 데모계정수,
  count(*) filter (where email like '%@haru.test'
                     and email_confirmed_at is not null)                   as 인증완료,
  count(*) filter (where email like '%@haru.test'
                     and (confirmation_token is null
                       or recovery_token is null
                       or email_change is null))                           as null_남은_계정
from auth.users;


-- ============================================================================
-- 참고: 연결 테스트 중 만들어진 계정 정리 (선택)
--   앱이 실제로 가입되는지 확인하려고 testcheck@haru.test 계정을 하나 만들었습니다.
--   위 조치로 이 계정도 @haru.test 라 함께 정상화되며, 필요 없으면 아래로 지웁니다.
-- ----------------------------------------------------------------------------
-- delete from auth.users where email = 'testcheck@haru.test';
-- ============================================================================
