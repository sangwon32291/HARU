/**
 * 지원·채용 서비스 (APP-01 ~ APP-06)
 *
 * 중복 지원 차단은 mock에서도 "저장 직전 재확인"으로 처리한다.
 * Supabase 전환 시에는 UNIQUE(job_post_id, applicant_id) 제약이 최종 방어선이다.
 */
import type { ApplicationStatus } from '@/types/enums';
import { ALLOWED_TRANSITIONS } from '@/types/enums';
import type { JobApplication, JobApplicationWithRelations } from '@/types/database';
import { commit, currentUser, findProfile, getState, isAdmin, nextId, nowIso } from './db';
import { delay, fail, ok, type Result } from '../types';

function withRelations(app: JobApplication): JobApplicationWithRelations {
  const s = getState();
  const job = s.jobPosts.find((j) => j.id === app.jobPostId);
  const applicant = findProfile(app.applicantId);
  return {
    ...app,
    jobPost: {
      id: job?.id ?? app.jobPostId,
      title: job?.title ?? '삭제된 공고',
      companyName: job?.companyName ?? '-',
      category: job?.category ?? 'etc',
      workDate: job?.workDate ?? '',
      startTime: job?.startTime ?? '',
      endTime: job?.endTime ?? '',
      payType: job?.payType ?? 'hourly',
      payAmount: job?.payAmount ?? 0,
      placeName: job?.placeName ?? '-',
      employerId: job?.employerId ?? '',
      status: job?.status ?? 'closed',
    },
    applicant: {
      id: app.applicantId,
      nickname: applicant?.nickname ?? '알 수 없음',
      avatarUrl: applicant?.avatarUrl ?? null,
      ratingAvg: applicant?.ratingAvg ?? 0,
    },
    hasReview: s.reviews.some((r) => r.applicationId === app.id),
  };
}

export async function applyToJob(jobId: string, message?: string): Promise<Result<JobApplication>> {
  await delay();
  const me = currentUser();
  if (!me) return fail('UNAUTHENTICATED');

  const s = getState();
  const job = s.jobPosts.find((j) => j.id === jobId);
  if (!job) return fail('NOT_FOUND');
  if (job.employerId === me.id) return fail('SELF_APPLY');
  if (job.status !== 'open') return fail('JOB_CLOSED');

  const existing = s.applications.find((a) => a.jobPostId === jobId && a.applicantId === me.id);
  if (existing && existing.status !== 'cancelled') return fail('DUPLICATE_APPLICATION');

  if (existing) {
    // 취소했던 건은 재지원으로 되살린다
    existing.status = 'pending';
    existing.message = message?.trim() || null;
    existing.appliedAt = nowIso();
    commit();
    return ok({ ...existing });
  }

  const app: JobApplication = {
    id: nextId('a'),
    jobPostId: jobId,
    applicantId: me.id,
    message: message?.trim() || null,
    status: 'pending',
    appliedAt: nowIso(),
    completedAt: null,
  };
  s.applications.push(app);
  commit();
  return ok(app);
}

export async function cancelApplication(id: string): Promise<Result<JobApplication>> {
  await delay();
  const me = currentUser();
  if (!me) return fail('UNAUTHENTICATED');
  const app = getState().applications.find((a) => a.id === id);
  if (!app) return fail('NOT_FOUND');
  if (app.applicantId !== me.id) return fail('FORBIDDEN');
  if (app.status !== 'pending') {
    return fail('INVALID_STATE', '대기중인 지원만 취소할 수 있습니다.');
  }
  app.status = 'cancelled';
  commit();
  return ok({ ...app });
}

export async function getApplicants(jobId: string): Promise<Result<JobApplicationWithRelations[]>> {
  await delay(120);
  const me = currentUser();
  if (!me) return fail('UNAUTHENTICATED');
  const job = getState().jobPosts.find((j) => j.id === jobId);
  if (!job) return fail('NOT_FOUND');
  if (job.employerId !== me.id && !isAdmin()) return fail('FORBIDDEN');

  const rows = getState()
    .applications.filter((a) => a.jobPostId === jobId)
    .sort((a, b) => a.appliedAt.localeCompare(b.appliedAt))
    .map(withRelations);
  return ok(rows);
}

export async function getMyApplications(
  status?: ApplicationStatus,
): Promise<Result<JobApplicationWithRelations[]>> {
  await delay(120);
  const me = currentUser();
  if (!me) return fail('UNAUTHENTICATED');
  const rows = getState()
    .applications.filter((a) => a.applicantId === me.id)
    .filter((a) => (status ? a.status === status : true))
    .sort((a, b) => b.appliedAt.localeCompare(a.appliedAt))
    .map(withRelations);
  return ok(rows);
}

/**
 * 상태 변경.
 * - 구인자: accepted / rejected / completed
 * - 구직자: cancelled
 * 전이 규칙은 ALLOWED_TRANSITIONS 로 검증한다.
 */
export async function updateApplicationStatus(
  id: string,
  next: ApplicationStatus,
): Promise<Result<JobApplication>> {
  await delay();
  const me = currentUser();
  if (!me) return fail('UNAUTHENTICATED');

  const s = getState();
  const app = s.applications.find((a) => a.id === id);
  if (!app) return fail('NOT_FOUND');
  const job = s.jobPosts.find((j) => j.id === app.jobPostId);
  if (!job) return fail('NOT_FOUND');

  const isEmployer = job.employerId === me.id || isAdmin();
  const isApplicant = app.applicantId === me.id;

  if (next === 'cancelled' && !isApplicant) return fail('FORBIDDEN');
  if (next !== 'cancelled' && !isEmployer) return fail('FORBIDDEN');
  if (!ALLOWED_TRANSITIONS[app.status].includes(next)) return fail('INVALID_TRANSITION');

  app.status = next;
  app.completedAt = next === 'completed' ? nowIso() : app.completedAt;
  commit();
  return ok({ ...app });
}

/**
 * 개발용: 근무 완료 상태 강제 전환 (리뷰 작성 흐름 테스트).
 * VITE_ENABLE_DEV_TOOLS 가 true 일 때만 화면에 노출된다.
 * 운영 환경에서는 이 경로가 존재하지 않아야 한다 (문서 E3 참고).
 */
export async function devForceComplete(id: string): Promise<Result<JobApplication>> {
  if (import.meta.env.VITE_ENABLE_DEV_TOOLS !== 'true') {
    return fail('FORBIDDEN', '개발 도구가 비활성화되어 있습니다.');
  }
  await delay(80);
  const app = getState().applications.find((a) => a.id === id);
  if (!app) return fail('NOT_FOUND');
  app.status = 'completed';
  app.completedAt = nowIso();
  commit();
  return ok({ ...app });
}
