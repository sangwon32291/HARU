/**
 * 리뷰 서비스 (REV-01 ~ REV-07) — HARU의 핵심 차별화 기능
 *
 * 작성 권한의 "진짜 검증"은 데이터 계층에서 한다.
 *  - mock  : createReview 내부에서 지원 건의 status === 'completed' 를 확인
 *  - supabase : RLS 정책 review_insert_completed_only 가 동일 조건을 강제
 * 화면에서 버튼을 숨기는 것은 편의일 뿐 권한 보호가 아니다.
 */
import type {
  CreateReviewInput,
  EmployerRatingSummary,
  JobApplicationWithRelations,
  Review,
  ReviewWithAuthor,
  UpdateReviewInput,
} from '@/types/database';
import {
  commit,
  currentUser,
  findProfile,
  getState,
  isAdmin,
  nextId,
  nowIso,
  recomputeEmployerRating,
} from './db';
import { delay, fail, ok, type Result } from '../types';

function withAuthor(review: Review): ReviewWithAuthor {
  const reviewer = findProfile(review.reviewerId);
  const job = getState().jobPosts.find((j) => j.id === review.jobPostId);
  return {
    ...review,
    reviewer: {
      id: review.reviewerId,
      nickname: reviewer?.nickname ?? '알 수 없음',
      avatarUrl: reviewer?.avatarUrl ?? null,
    },
    jobTitle: job?.title ?? '삭제된 공고',
    companyName: job?.companyName ?? '-',
  };
}

function visibleTo(review: Review): boolean {
  if (!review.isHidden) return true;
  const me = currentUser();
  return isAdmin() || me?.id === review.reviewerId;
}

export async function getJobReviews(jobId: string): Promise<Result<ReviewWithAuthor[]>> {
  await delay(120);
  const rows = getState()
    .reviews.filter((r) => r.jobPostId === jobId && visibleTo(r))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(withAuthor);
  return ok(rows);
}

export async function getEmployerReviews(employerId: string): Promise<Result<ReviewWithAuthor[]>> {
  await delay(120);
  const rows = getState()
    .reviews.filter((r) => r.employerId === employerId && visibleTo(r))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(withAuthor);
  return ok(rows);
}

export async function getEmployerRating(employerId: string): Promise<Result<EmployerRatingSummary>> {
  await delay(100);
  const employer = findProfile(employerId);
  if (!employer) return fail('NOT_FOUND');
  const rows = getState().reviews.filter((r) => r.employerId === employerId && !r.isHidden);
  const count = rows.length;
  const avgOf = (fn: (r: Review) => number) =>
    count === 0 ? 0 : Math.round((rows.reduce((a, r) => a + fn(r), 0) / count) * 100) / 100;

  const job = getState().jobPosts.find((j) => j.employerId === employerId);

  return ok({
    employerId,
    nickname: employer.nickname,
    companyName: job?.companyName ?? employer.nickname,
    ratingAvg: avgOf((r) => r.ratingOverall),
    reviewCount: count,
    breakdown: {
      pay: avgOf((r) => r.ratingPay),
      workload: avgOf((r) => r.ratingWorkload),
      environment: avgOf((r) => r.ratingEnvironment),
      accuracy: avgOf((r) => r.ratingAccuracy),
    },
    wouldWorkAgainRate: count === 0 ? 0 : rows.filter((r) => r.wouldWorkAgain).length / count,
  });
}

/** 내가 후기를 쓸 수 있는 지원 건 (근무 완료 + 미작성) */
export async function getReviewableApplications(): Promise<Result<JobApplicationWithRelations[]>> {
  await delay(120);
  const me = currentUser();
  if (!me) return fail('UNAUTHENTICATED');
  const s = getState();
  const rows = s.applications
    .filter((a) => a.applicantId === me.id && a.status === 'completed')
    .filter((a) => !s.reviews.some((r) => r.applicationId === a.id))
    .map((a) => {
      const job = s.jobPosts.find((j) => j.id === a.jobPostId);
      return {
        ...a,
        jobPost: {
          id: job?.id ?? a.jobPostId,
          title: job?.title ?? '삭제된 공고',
          companyName: job?.companyName ?? '-',
          category: job?.category ?? ('etc' as const),
          workDate: job?.workDate ?? '',
          startTime: job?.startTime ?? '',
          endTime: job?.endTime ?? '',
          payType: job?.payType ?? ('hourly' as const),
          payAmount: job?.payAmount ?? 0,
          placeName: job?.placeName ?? '-',
          employerId: job?.employerId ?? '',
          status: job?.status ?? ('closed' as const),
        },
        applicant: { id: me.id, nickname: me.nickname, avatarUrl: me.avatarUrl, ratingAvg: me.ratingAvg },
        hasReview: false,
      };
    });
  return ok(rows);
}

export async function getMyReviews(): Promise<Result<ReviewWithAuthor[]>> {
  await delay(120);
  const me = currentUser();
  if (!me) return fail('UNAUTHENTICATED');
  const rows = getState()
    .reviews.filter((r) => r.reviewerId === me.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(withAuthor);
  return ok(rows);
}

export async function getReviewByApplication(applicationId: string): Promise<Result<Review | null>> {
  await delay(80);
  const found = getState().reviews.find((r) => r.applicationId === applicationId) ?? null;
  return ok(found);
}

function validateRatings(input: Pick<CreateReviewInput, 'ratingPay' | 'ratingWorkload' | 'ratingEnvironment' | 'ratingAccuracy' | 'content'>): string | null {
  const values = [input.ratingPay, input.ratingWorkload, input.ratingEnvironment, input.ratingAccuracy];
  if (values.some((v) => !Number.isInteger(v) || v < 1 || v > 5)) {
    return '모든 평가 항목에 1~5점을 선택해 주세요.';
  }
  if (input.content.trim().length < 10) return '후기를 10자 이상 작성해 주세요.';
  return null;
}

export async function createReview(input: CreateReviewInput): Promise<Result<Review>> {
  await delay();
  const me = currentUser();
  if (!me) return fail('UNAUTHENTICATED');

  const s = getState();
  const app = s.applications.find((a) => a.id === input.applicationId);
  if (!app) return fail('NOT_FOUND');
  if (app.applicantId !== me.id) return fail('FORBIDDEN');
  // ↓ 핵심 권한 검증 (REV-01). RLS와 동일한 조건.
  if (app.status !== 'completed') return fail('NOT_COMPLETED');
  if (s.reviews.some((r) => r.applicationId === app.id)) return fail('DUPLICATE_REVIEW');

  const message = validateRatings(input);
  if (message) return fail('VALIDATION_FAILED', message);

  const job = s.jobPosts.find((j) => j.id === app.jobPostId);
  if (!job) return fail('NOT_FOUND');

  const overall =
    (input.ratingPay + input.ratingWorkload + input.ratingEnvironment + input.ratingAccuracy) / 4;
  const now = nowIso();
  const review: Review = {
    id: nextId('r'),
    applicationId: app.id,
    jobPostId: job.id,
    reviewerId: me.id,
    employerId: job.employerId,
    ratingPay: input.ratingPay,
    ratingWorkload: input.ratingWorkload,
    ratingEnvironment: input.ratingEnvironment,
    ratingAccuracy: input.ratingAccuracy,
    wouldWorkAgain: input.wouldWorkAgain,
    ratingOverall: Math.round(overall * 100) / 100,
    content: input.content.trim(),
    isHidden: false,
    createdAt: now,
    updatedAt: now,
  };
  s.reviews.unshift(review);
  recomputeEmployerRating(s, job.employerId);
  commit();
  return ok(review);
}

export async function updateReview(id: string, input: UpdateReviewInput): Promise<Result<Review>> {
  await delay();
  const me = currentUser();
  if (!me) return fail('UNAUTHENTICATED');
  const s = getState();
  const review = s.reviews.find((r) => r.id === id);
  if (!review) return fail('NOT_FOUND');
  if (review.reviewerId !== me.id) return fail('FORBIDDEN');

  const message = validateRatings(input);
  if (message) return fail('VALIDATION_FAILED', message);

  Object.assign(review, input, {
    content: input.content.trim(),
    ratingOverall:
      Math.round(
        ((input.ratingPay + input.ratingWorkload + input.ratingEnvironment + input.ratingAccuracy) / 4) *
          100,
      ) / 100,
    updatedAt: nowIso(),
  });
  recomputeEmployerRating(s, review.employerId);
  commit();
  return ok({ ...review });
}

export async function deleteReview(id: string): Promise<Result<void>> {
  await delay();
  const me = currentUser();
  if (!me) return fail('UNAUTHENTICATED');
  const s = getState();
  const review = s.reviews.find((r) => r.id === id);
  if (!review) return fail('NOT_FOUND');
  if (review.reviewerId !== me.id && !isAdmin()) return fail('FORBIDDEN');

  const employerId = review.employerId;
  s.reviews = s.reviews.filter((r) => r.id !== id);
  recomputeEmployerRating(s, employerId);
  commit();
  return ok(undefined);
}

/** 홈 화면용 최근 후기 */
export async function getRecentReviews(limit = 4): Promise<Result<ReviewWithAuthor[]>> {
  await delay(100);
  const rows = getState()
    .reviews.filter((r) => !r.isHidden)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
    .map(withAuthor);
  return ok(rows);
}
