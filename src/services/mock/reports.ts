/** 신고·관리자 서비스 (REV-06, COM-06, ADM-01 ~ ADM-03) */
import type { CreateReportInput, Report, ReportWithContext } from '@/types/database';
import type { ReportTarget } from '@/types/enums';
import { commit, currentUser, findProfile, getState, isAdmin, nextId, nowIso, recomputeEmployerRating } from './db';
import { delay, fail, ok, type Result } from '../types';

export const REPORT_REASONS = [
  '허위 사실 또는 과장된 정보',
  '개인정보 노출',
  '욕설·비방·혐오 표현',
  '광고·스팸',
  '부적절한 근로 조건 요구',
  '기타',
];

function targetSummary(targetType: ReportTarget, targetId: string) {
  const s = getState();
  if (targetType === 'job_post') {
    const j = s.jobPosts.find((x) => x.id === targetId);
    return j ? { title: j.title, body: j.description, isHidden: j.status === 'hidden' } : null;
  }
  if (targetType === 'review') {
    const r = s.reviews.find((x) => x.id === targetId);
    return r ? { title: `후기 (${r.ratingOverall.toFixed(1)}점)`, body: r.content, isHidden: r.isHidden } : null;
  }
  if (targetType === 'community_post') {
    const p = s.posts.find((x) => x.id === targetId);
    return p ? { title: p.title, body: p.content, isHidden: p.isHidden } : null;
  }
  const c = s.comments.find((x) => x.id === targetId);
  return c ? { title: '댓글', body: c.content, isHidden: c.isHidden } : null;
}

export async function createReport(input: CreateReportInput): Promise<Result<Report>> {
  await delay();
  const me = currentUser();
  if (!me) return fail('UNAUTHENTICATED');
  if (!input.reason.trim()) return fail('VALIDATION_FAILED', '신고 사유를 선택해 주세요.');

  const s = getState();
  const duplicated = s.reports.some(
    (r) => r.reporterId === me.id && r.targetType === input.targetType && r.targetId === input.targetId,
  );
  if (duplicated) return fail('DUPLICATE_REPORT');

  const report: Report = {
    id: nextId('rep'),
    reporterId: me.id,
    targetType: input.targetType,
    targetId: input.targetId,
    reason: input.reason,
    detail: input.detail?.trim() || null,
    status: 'pending',
    handledBy: null,
    createdAt: nowIso(),
  };
  s.reports.unshift(report);
  commit();
  return ok(report);
}

export async function getReports(): Promise<Result<ReportWithContext[]>> {
  await delay(120);
  if (!currentUser()) return fail('UNAUTHENTICATED');
  if (!isAdmin()) return fail('FORBIDDEN');

  const rows = getState()
    .reports.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((r) => ({
      ...r,
      reporter: {
        id: r.reporterId,
        nickname: findProfile(r.reporterId)?.nickname ?? '알 수 없음',
      },
      targetSummary: targetSummary(r.targetType, r.targetId),
    }));
  return ok(rows);
}

/** 신고 대상 숨김/해제 (ADM-02, ADM-03) */
export async function setTargetHidden(
  targetType: ReportTarget,
  targetId: string,
  hidden: boolean,
): Promise<Result<void>> {
  await delay();
  if (!currentUser()) return fail('UNAUTHENTICATED');
  if (!isAdmin()) return fail('FORBIDDEN');

  const s = getState();
  if (targetType === 'job_post') {
    const j = s.jobPosts.find((x) => x.id === targetId);
    if (!j) return fail('NOT_FOUND');
    j.status = hidden ? 'hidden' : 'open';
  } else if (targetType === 'review') {
    const r = s.reviews.find((x) => x.id === targetId);
    if (!r) return fail('NOT_FOUND');
    r.isHidden = hidden;
    recomputeEmployerRating(s, r.employerId);
  } else if (targetType === 'community_post') {
    const p = s.posts.find((x) => x.id === targetId);
    if (!p) return fail('NOT_FOUND');
    p.isHidden = hidden;
  } else {
    const c = s.comments.find((x) => x.id === targetId);
    if (!c) return fail('NOT_FOUND');
    c.isHidden = hidden;
  }
  commit();
  return ok(undefined);
}

export async function resolveReport(id: string, status: 'resolved' | 'rejected'): Promise<Result<Report>> {
  await delay();
  const me = currentUser();
  if (!me) return fail('UNAUTHENTICATED');
  if (!isAdmin()) return fail('FORBIDDEN');

  const report = getState().reports.find((r) => r.id === id);
  if (!report) return fail('NOT_FOUND');
  report.status = status;
  report.handledBy = me.id;
  commit();
  return ok({ ...report });
}

export async function getAdminStats(): Promise<
  Result<{ users: number; jobs: number; openJobs: number; applications: number; reviews: number; posts: number; pendingReports: number }>
> {
  await delay(100);
  if (!currentUser()) return fail('UNAUTHENTICATED');
  if (!isAdmin()) return fail('FORBIDDEN');
  const s = getState();
  return ok({
    users: s.profiles.length,
    jobs: s.jobPosts.length,
    openJobs: s.jobPosts.filter((j) => j.status === 'open').length,
    applications: s.applications.length,
    reviews: s.reviews.length,
    posts: s.posts.length,
    pendingReports: s.reports.filter((r) => r.status === 'pending').length,
  });
}
