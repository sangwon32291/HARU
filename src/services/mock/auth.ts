/**
 * 인증 서비스 (AUTH-01 ~ AUTH-05)
 *
 * ⚠ mock 모드의 비밀번호는 브라우저 localStorage에 평문으로 저장된다.
 *   이는 외부 설정 없이 로그인 흐름을 시연하기 위한 개발용 구현이며,
 *   실제 인증은 Supabase Auth(해시 + 세션 토큰)가 담당한다.
 *   따라서 mock 모드는 공개 배포용이 아니다.
 */
import type { Profile, SignUpInput } from '@/types/database';
import { commit, currentUser, getState, nextId, nowIso } from './db';
import { delay, fail, ok, type Result } from '../types';

export function getCurrentUser(): Profile | null {
  return currentUser();
}

export async function signUp(input: SignUpInput): Promise<Result<Profile>> {
  await delay();
  const s = getState();
  const email = input.email.trim().toLowerCase();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return fail('VALIDATION_FAILED', '이메일 형식이 올바르지 않습니다.');
  }
  if (input.password.length < 8) {
    return fail('VALIDATION_FAILED', '비밀번호는 8자 이상이어야 합니다.');
  }
  const nickname = input.nickname.trim();
  if (nickname.length < 2 || nickname.length > 12) {
    return fail('VALIDATION_FAILED', '닉네임은 2~12자여야 합니다.');
  }
  if (s.accounts.some((a) => a.email === email)) return fail('EMAIL_TAKEN');
  if (s.profiles.some((p) => p.nickname === nickname)) return fail('NICKNAME_TAKEN');

  const id = nextId('u');
  const profile: Profile = {
    id,
    nickname,
    phone: input.phone?.trim() || null,
    bio: null,
    avatarUrl: null,
    regionCode: '11500',
    baseLat: 37.5509,
    baseLng: 126.8495,
    ratingAvg: 0,
    reviewCount: 0,
    role: 'user',
    createdAt: nowIso(),
  };

  s.accounts.push({ id, email, password: input.password });
  s.profiles.push(profile);
  s.sessionUserId = id;
  commit();
  return ok(profile);
}

export async function signIn(email: string, password: string): Promise<Result<Profile>> {
  await delay();
  const s = getState();
  const account = s.accounts.find((a) => a.email === email.trim().toLowerCase());
  if (!account || account.password !== password) return fail('INVALID_CREDENTIALS');
  const profile = s.profiles.find((p) => p.id === account.id);
  if (!profile) return fail('NOT_FOUND');
  s.sessionUserId = profile.id;
  commit();
  return ok(profile);
}

export async function signOut(): Promise<Result<void>> {
  await delay(80);
  const s = getState();
  s.sessionUserId = null;
  commit();
  return ok(undefined);
}

export async function updateProfile(
  input: Partial<Pick<Profile, 'nickname' | 'phone' | 'bio' | 'regionCode' | 'baseLat' | 'baseLng'>>,
): Promise<Result<Profile>> {
  await delay();
  const s = getState();
  const me = currentUser();
  if (!me) return fail('UNAUTHENTICATED');

  if (input.nickname !== undefined) {
    const nickname = input.nickname.trim();
    if (nickname.length < 2 || nickname.length > 12) {
      return fail('VALIDATION_FAILED', '닉네임은 2~12자여야 합니다.');
    }
    if (s.profiles.some((p) => p.nickname === nickname && p.id !== me.id)) {
      return fail('NICKNAME_TAKEN');
    }
  }
  if (input.bio !== undefined && input.bio !== null && input.bio.length > 200) {
    return fail('VALIDATION_FAILED', '소개는 200자 이내로 작성해 주세요.');
  }

  const profile = s.profiles.find((p) => p.id === me.id)!;
  Object.assign(profile, {
    ...input,
    nickname: input.nickname?.trim() ?? profile.nickname,
    // role 은 사용자가 변경할 수 없다 (E2 — DB에서는 트리거로 차단)
    role: profile.role,
  });
  commit();
  return ok({ ...profile });
}

/** 데모 계정 목록 (로그인 화면에서 안내용으로만 사용) */
export function listDemoAccounts(): { email: string; nickname: string; role: string }[] {
  const s = getState();
  return s.accounts.slice(0, 20).map((a) => {
    const p = s.profiles.find((x) => x.id === a.id);
    return {
      email: a.email,
      nickname: p?.nickname ?? '',
      role: p?.role === 'admin' ? '관리자' : a.email.startsWith('employer') ? '구인자' : '구직자',
    };
  });
}
