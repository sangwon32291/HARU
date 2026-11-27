/** 인증 서비스 — Supabase Auth 구현 (AUTH-01 ~ AUTH-05) */
import type { Profile, SignUpInput } from '@/types/database';
import { delay, fail, ok, type Result, type ServiceErrorCode } from '../types';
import { supabase, mapPgError } from './client';
import { toProfile } from './mappers';

/** 현재 세션의 프로필. 세션이 없으면 null. */
export async function getCurrentUser(): Promise<Profile | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return null;

  const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).single();
  if (error || !data) return null;
  return toProfile(data);
}

export async function signUp(input: SignUpInput): Promise<Result<Profile>> {
  const nickname = input.nickname.trim();
  if (nickname.length < 2 || nickname.length > 12) {
    return fail('VALIDATION_FAILED', '닉네임은 2~12자여야 합니다.');
  }
  if (input.password.length < 8) {
    return fail('VALIDATION_FAILED', '비밀번호는 8자 이상이어야 합니다.');
  }

  // 닉네임 중복을 미리 확인해, 계정만 만들어지고 프로필이 실패하는 상황을 줄인다.
  const { data: dup } = await supabase
    .from('profiles').select('id').eq('nickname', nickname).maybeSingle();
  if (dup) return fail('NICKNAME_TAKEN');

  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    // handle_new_user 트리거가 이 값을 읽어 profiles 행을 만든다.
    options: { data: { nickname, phone: input.phone?.trim() || null } },
  });

  if (error) {
    const m = error.message ?? '';
    if (m.toLowerCase().includes('already registered') || m.includes('already been registered')) {
      return fail('EMAIL_TAKEN');
    }
    return fail('VALIDATION_FAILED', m);
  }
  if (!data.session) {
    // Confirm email 이 켜져 있으면 세션 없이 끝난다.
    return fail(
      'VALIDATION_FAILED',
      '가입 확인 메일을 보냈습니다. 메일 인증 후 로그인해 주세요. ' +
        '(Supabase → Authentication → Email → Confirm email 을 끄면 바로 로그인됩니다)',
    );
  }

  const profile = await getCurrentUser();
  if (!profile) return fail('UNKNOWN', '프로필 생성에 실패했습니다.');
  return ok(profile);
}

export async function signIn(email: string, password: string): Promise<Result<Profile>> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) return fail('INVALID_CREDENTIALS');

  const profile = await getCurrentUser();
  if (!profile) return fail('NOT_FOUND', '프로필을 찾을 수 없습니다.');
  return ok(profile);
}

export async function signOut(): Promise<Result<void>> {
  await supabase.auth.signOut();
  return ok(undefined);
}

export async function updateProfile(
  input: Partial<Pick<Profile, 'nickname' | 'phone' | 'bio' | 'regionCode' | 'baseLat' | 'baseLng'>>,
): Promise<Result<Profile>> {
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return fail('UNAUTHENTICATED');

  if (input.nickname !== undefined) {
    const n = input.nickname.trim();
    if (n.length < 2 || n.length > 12) return fail('VALIDATION_FAILED', '닉네임은 2~12자여야 합니다.');
  }
  if (input.bio && input.bio.length > 200) {
    return fail('VALIDATION_FAILED', '소개는 200자 이내로 작성해 주세요.');
  }

  const patch: Record<string, unknown> = {};
  if (input.nickname !== undefined) patch.nickname = input.nickname.trim();
  if (input.phone !== undefined) patch.phone = input.phone || null;
  if (input.bio !== undefined) patch.bio = input.bio || null;
  if (input.regionCode !== undefined) patch.region_code = input.regionCode;
  if (input.baseLat !== undefined) patch.base_lat = input.baseLat;
  if (input.baseLng !== undefined) patch.base_lng = input.baseLng;

  const { data, error } = await supabase
    .from('profiles').update(patch).eq('id', uid).select('*').single();

  if (error) {
    const m = mapPgError(error);
    return fail(m.code as ServiceErrorCode, m.message);
  }
  return ok(toProfile(data));
}

/** Supabase 모드에서는 데모 계정 목록을 노출하지 않는다(실제 DB이므로). */
export function listDemoAccounts(): { email: string; nickname: string; role: string }[] {
  return [];
}

/** 세션 변화 구독 — 다른 탭에서 로그아웃하거나 토큰이 갱신될 때 화면을 맞춘다. */
export function onAuthChange(cb: () => void): () => void {
  const { data } = supabase.auth.onAuthStateChange(() => cb());
  return () => data.subscription.unsubscribe();
}

void delay;
