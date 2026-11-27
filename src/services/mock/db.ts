/**
 * mock 데이터 저장소.
 *
 * - 브라우저 localStorage에 영속화하므로 새로고침해도 작성한 공고/지원/후기가 남는다.
 * - Supabase로 전환할 때 이 파일만 교체되고, 서비스 함수의 시그니처는 바뀌지 않는다.
 * - 평균 평점 재계산은 DB 트리거(REV-04)의 역할을 그대로 흉내 낸다.
 */
import type {
  CommunityComment,
  CommunityPost,
  JobApplication,
  JobPost,
  Profile,
  Report,
  Review,
} from '@/types/database';
import { createSeedData, type MockAccount } from './seed';

const STORAGE_KEY = 'haru.mock.v2';

export interface MockState {
  accounts: MockAccount[];
  profiles: Profile[];
  jobPosts: JobPost[];
  applications: JobApplication[];
  reviews: Review[];
  posts: CommunityPost[];
  comments: CommunityComment[];
  likes: { id: string; postId: string; userId: string; createdAt: string }[];
  reports: Report[];
  sessionUserId: string | null;
}

let state: MockState | null = null;

function buildInitialState(): MockState {
  const seed = createSeedData();
  const next: MockState = { ...seed, reports: [], sessionUserId: null };
  recomputeAllRatings(next);
  return next;
}

function readStorage(): MockState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MockState;
    if (!parsed.profiles || !parsed.jobPosts) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getState(): MockState {
  if (state) return state;
  state = readStorage() ?? buildInitialState();
  if (!readStorage()) commit();
  return state;
}

export function commit(): void {
  if (typeof window === 'undefined' || !state) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 저장 실패는 치명적이지 않다 (용량 초과 등). 메모리 상태로 계속 동작한다.
  }
}

/** 샘플 데이터를 초기 상태로 되돌린다 (개발/시연용). */
export function resetState(): void {
  state = buildInitialState();
  commit();
}

export function nextId(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

/* ── 조회 헬퍼 ── */

export function findProfile(id: string | null | undefined): Profile | undefined {
  if (!id) return undefined;
  return getState().profiles.find((p) => p.id === id);
}

export function currentUser(): Profile | null {
  const s = getState();
  if (!s.sessionUserId) return null;
  return s.profiles.find((p) => p.id === s.sessionUserId) ?? null;
}

export function isAdmin(): boolean {
  return currentUser()?.role === 'admin';
}

export function publicProfile(id: string) {
  const p = findProfile(id);
  return {
    id,
    nickname: p?.nickname ?? '알 수 없음',
    avatarUrl: p?.avatarUrl ?? null,
    ratingAvg: p?.ratingAvg ?? 0,
    reviewCount: p?.reviewCount ?? 0,
  };
}

export function countApplicants(jobId: string, statuses?: JobApplication['status'][]): number {
  return getState().applications.filter(
    (a) => a.jobPostId === jobId && (!statuses || statuses.includes(a.status)),
  ).length;
}

/* ── 집계 (DB 트리거 대응) ── */

export function recomputeEmployerRating(target: MockState, employerId: string): void {
  const visible = target.reviews.filter((r) => r.employerId === employerId && !r.isHidden);
  const profile = target.profiles.find((p) => p.id === employerId);
  if (!profile) return;
  if (visible.length === 0) {
    profile.ratingAvg = 0;
    profile.reviewCount = 0;
    return;
  }
  const sum = visible.reduce((acc, r) => acc + r.ratingOverall, 0);
  profile.ratingAvg = Math.round((sum / visible.length) * 100) / 100;
  profile.reviewCount = visible.length;
}

export function recomputeAllRatings(target: MockState): void {
  for (const p of target.profiles) {
    recomputeEmployerRating(target, p.id);
  }
}

/** 게시글의 좋아요/댓글 수 재계산 (DB 트리거 대응) */
export function recomputePostCounters(target: MockState, postId: string): void {
  const post = target.posts.find((p) => p.id === postId);
  if (!post) return;
  post.likeCount = target.likes.filter((l) => l.postId === postId).length;
  post.commentCount = target.comments.filter((c) => c.postId === postId && !c.isHidden).length;
}
