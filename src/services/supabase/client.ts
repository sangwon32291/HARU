/**
 * Supabase 클라이언트.
 *
 * anon 키만 사용합니다. 이 키는 브라우저에 공개되는 것이 정상이며,
 * "누가 어떤 행을 다룰 수 있는가"는 전부 DB의 RLS 정책이 통제합니다.
 * service_role 키는 절대 프론트엔드에 넣지 않습니다.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config';

/**
 * 클라이언트는 **처음 쓸 때** 만든다.
 * mock 모드에서는 URL·키가 비어 있는데, 모듈을 읽는 시점에 createClient 를 호출하면
 * "supabaseUrl is required" 로 앱 전체가 죽는다. mock 모드에서는 아래 함수가
 * 한 번도 불리지 않으므로 안전하다.
 */
let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!client) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error(
        'Supabase 설정이 없습니다. .env 의 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 를 확인하세요.',
      );
    }
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,   // 새로고침 후에도 로그인 유지 (AUTH-02)
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}

/** 기존 코드가 supabase.from(...) 처럼 쓸 수 있도록 지연 생성을 감싼 대리 객체. */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const value = (getClient() as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === 'function' ? value.bind(getClient()) : value;
  },
});

/** PostgREST 오류를 서비스 계층 오류 코드로 옮긴다. */
export function mapPgError(err: unknown): { code: string; message: string } {
  const e = err as { code?: string; message?: string; details?: string } | null;
  const raw = e?.message ?? '';
  const pg = e?.code ?? '';

  // 23505: unique_violation — 중복 지원 / 중복 후기 / 중복 신고
  if (pg === '23505') {
    if (raw.includes('job_post_id') || raw.includes('applications')) {
      return { code: 'DUPLICATE_APPLICATION', message: '이미 지원한 공고입니다.' };
    }
    if (raw.includes('application_id') || raw.includes('reviews')) {
      return { code: 'DUPLICATE_REVIEW', message: '이미 후기를 작성했습니다.' };
    }
    if (raw.includes('reports')) {
      return { code: 'DUPLICATE_REPORT', message: '이미 신고한 대상입니다.' };
    }
    if (raw.includes('nickname')) {
      return { code: 'NICKNAME_TAKEN', message: '이미 사용 중인 닉네임입니다.' };
    }
    return { code: 'VALIDATION_FAILED', message: '이미 존재하는 값입니다.' };
  }

  // 42501 / RLS 위반 — 권한 없음
  if (pg === '42501' || raw.includes('row-level security')) {
    return { code: 'FORBIDDEN', message: '권한이 없습니다.' };
  }

  // 23514: check_violation — 입력값 제약 위반
  if (pg === '23514') {
    return { code: 'VALIDATION_FAILED', message: '입력값을 다시 확인해 주세요.' };
  }

  // 트리거가 raise exception 으로 던진 메시지는 그대로 보여준다.
  if (raw.includes('허용되지 않는 상태 변경')) {
    return { code: 'INVALID_TRANSITION', message: '허용되지 않는 상태 변경입니다.' };
  }
  if (raw.includes('role 은 관리자만')) {
    return { code: 'FORBIDDEN', message: '권한을 변경할 수 없습니다.' };
  }

  return { code: 'UNKNOWN', message: raw || '알 수 없는 오류가 발생했습니다.' };
}
