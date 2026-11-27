/**
 * 인증 서비스 — 데이터 소스 분기.
 *
 * getCurrentUser 만 시그니처가 다릅니다.
 * mock 은 동기(브라우저 저장소), supabase 는 비동기(세션 조회)이므로
 * 양쪽을 Promise 로 통일해 화면 코드가 한 가지 방식만 쓰게 합니다.
 */
import type { Profile, SignUpInput } from '@/types/database';
import type { Result } from './types';
import { IS_SUPABASE } from './config';
import * as mock from './mock/auth';
import * as sb from './supabase/auth';

export async function getCurrentUser(): Promise<Profile | null> {
  return IS_SUPABASE ? sb.getCurrentUser() : mock.getCurrentUser();
}

export const signUp: (input: SignUpInput) => Promise<Result<Profile>> =
  IS_SUPABASE ? sb.signUp : mock.signUp;

export const signIn: (email: string, password: string) => Promise<Result<Profile>> =
  IS_SUPABASE ? sb.signIn : mock.signIn;

export const signOut: () => Promise<Result<void>> =
  IS_SUPABASE ? sb.signOut : mock.signOut;

export const updateProfile: typeof mock.updateProfile =
  IS_SUPABASE ? sb.updateProfile : mock.updateProfile;

export const listDemoAccounts: () => { email: string; nickname: string; role: string }[] =
  IS_SUPABASE ? sb.listDemoAccounts : mock.listDemoAccounts;

/** 세션 변화 구독. mock 모드에서는 변화가 없으므로 빈 해제 함수를 돌려줍니다. */
export function onAuthChange(cb: () => void): () => void {
  return IS_SUPABASE ? sb.onAuthChange(cb) : () => {};
}
