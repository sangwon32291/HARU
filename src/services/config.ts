/**
 * 데이터 소스 전환 스위치.
 *
 * .env 의 VITE_DATA_SOURCE 값으로 결정됩니다.
 *   mock     — 브라우저 저장소의 샘플 데이터 (외부 설정 불필요, 기본값)
 *   supabase — 실제 PostgreSQL + RLS
 *
 * 두 구현은 함수 시그니처가 같으므로, 화면 코드는 어느 쪽이든 수정 없이 동작합니다.
 */
const raw = (import.meta.env.VITE_DATA_SOURCE ?? 'mock').trim().toLowerCase();

export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
export const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

/** supabase 를 지정했는데 키가 비어 있으면 mock 으로 되돌립니다(빈 화면 방지). */
const wantsSupabase = raw === 'supabase';
const canUseSupabase = wantsSupabase && SUPABASE_URL !== '' && SUPABASE_ANON_KEY !== '';

export const DATA_SOURCE: 'mock' | 'supabase' = canUseSupabase ? 'supabase' : 'mock';
export const IS_SUPABASE = DATA_SOURCE === 'supabase';

if (wantsSupabase && !canUseSupabase) {
  // 설정 실수를 조용히 넘기지 않고 콘솔에 명확히 남깁니다.
  console.warn(
    '[HARU] VITE_DATA_SOURCE=supabase 이지만 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 가 비어 있습니다.\n' +
      '       .env 를 확인하세요. 지금은 mock(샘플 데이터) 모드로 동작합니다.',
  );
}

export const DEV_TOOLS_ENABLED = import.meta.env.VITE_ENABLE_DEV_TOOLS === 'true';
