/** 신고·관리자 서비스 — Supabase 구현 */
import type { CreateReportInput, Report, ReportWithContext } from '@/types/database';
import type { ReportTarget } from '@/types/enums';
import { fail, ok, type Result, type ServiceErrorCode } from '../types';
import { supabase, mapPgError } from './client';
import { toReport } from './mappers';

export { REPORT_REASONS } from '../mock/reports';

async function uid(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

async function isAdmin(): Promise<boolean> {
  const me = await uid();
  if (!me) return false;
  const { data } = await supabase.from('profiles').select('role').eq('id', me).maybeSingle();
  return data?.role === 'admin';
}

export async function createReport(input: CreateReportInput): Promise<Result<Report>> {
  const me = await uid();
  if (!me) return fail('UNAUTHENTICATED');
  if (!input.reason.trim()) return fail('VALIDATION_FAILED', '신고 사유를 선택해 주세요.');

  const { data, error } = await supabase.from('reports').insert({
    reporter_id: me,
    target_type: input.targetType,
    target_id: input.targetId,
    reason: input.reason,
    detail: input.detail?.trim() || null,
  }).select('*').single();

  if (error) {
    const m = mapPgError(error);
    return fail(m.code as ServiceErrorCode, m.message);
  }
  return ok(toReport(data));
}

/** 신고 대상 원문을 타입별로 조회한다(다형 참조라 FK 조인이 불가능). */
async function targetSummary(type: ReportTarget, id: string) {
  if (type === 'job_post') {
    const { data } = await supabase
      .from('job_posts').select('title,description,status').eq('id', id).maybeSingle();
    return data ? { title: data.title, body: data.description, isHidden: data.status === 'hidden' } : null;
  }
  if (type === 'review') {
    const { data } = await supabase
      .from('reviews').select('content,rating_overall,is_hidden').eq('id', id).maybeSingle();
    return data
      ? { title: `후기 (${Number(data.rating_overall).toFixed(1)}점)`, body: data.content, isHidden: data.is_hidden }
      : null;
  }
  if (type === 'community_post') {
    const { data } = await supabase
      .from('community_posts').select('title,content,is_hidden').eq('id', id).maybeSingle();
    return data ? { title: data.title, body: data.content, isHidden: data.is_hidden } : null;
  }
  const { data } = await supabase
    .from('community_comments').select('content,is_hidden').eq('id', id).maybeSingle();
  return data ? { title: '댓글', body: data.content, isHidden: data.is_hidden } : null;
}

export async function getReports(): Promise<Result<ReportWithContext[]>> {
  const me = await uid();
  if (!me) return fail('UNAUTHENTICATED');
  if (!(await isAdmin())) return fail('FORBIDDEN');

  const { data, error } = await supabase
    .from('reports')
    .select('*, reporter:profiles!reports_reporter_id_fkey(id,nickname)')
    .order('created_at', { ascending: false });

  if (error) {
    const m = mapPgError(error);
    return fail(m.code as ServiceErrorCode, m.message);
  }

  const rows = await Promise.all((data ?? []).map(async (r: any) => ({
    ...toReport(r),
    reporter: { id: r.reporter_id, nickname: r.reporter?.nickname ?? '알 수 없음' },
    targetSummary: await targetSummary(r.target_type, r.target_id),
  })));
  return ok(rows);
}

export async function setTargetHidden(
  targetType: ReportTarget, targetId: string, hidden: boolean,
): Promise<Result<void>> {
  const me = await uid();
  if (!me) return fail('UNAUTHENTICATED');
  if (!(await isAdmin())) return fail('FORBIDDEN');

  const table = targetType === 'job_post' ? 'job_posts'
    : targetType === 'review' ? 'reviews'
    : targetType === 'community_post' ? 'community_posts' : 'community_comments';

  const patch = targetType === 'job_post'
    ? { status: hidden ? 'hidden' : 'open' }
    : { is_hidden: hidden };

  const { error } = await supabase.from(table).update(patch).eq('id', targetId);
  if (error) {
    const m = mapPgError(error);
    return fail(m.code as ServiceErrorCode, m.message);
  }
  return ok(undefined);
}

export async function resolveReport(
  id: string, status: 'resolved' | 'rejected',
): Promise<Result<Report>> {
  const me = await uid();
  if (!me) return fail('UNAUTHENTICATED');
  if (!(await isAdmin())) return fail('FORBIDDEN');

  const { data, error } = await supabase
    .from('reports').update({ status, handled_by: me }).eq('id', id).select('*').maybeSingle();
  if (error) {
    const m = mapPgError(error);
    return fail(m.code as ServiceErrorCode, m.message);
  }
  if (!data) return fail('NOT_FOUND');
  return ok(toReport(data));
}

export async function getAdminStats(): Promise<Result<{
  users: number; jobs: number; openJobs: number; applications: number;
  reviews: number; posts: number; pendingReports: number;
}>> {
  const me = await uid();
  if (!me) return fail('UNAUTHENTICATED');
  if (!(await isAdmin())) return fail('FORBIDDEN');

  const n = async (table: string, f?: (q: any) => any) => {
    let q = supabase.from(table).select('id', { count: 'exact', head: true });
    if (f) q = f(q);
    const { count } = await q;
    return count ?? 0;
  };

  const [users, jobs, openJobs, applications, reviews, posts, pendingReports] = await Promise.all([
    n('profiles'), n('job_posts'),
    n('job_posts', (q) => q.eq('status', 'open')),
    n('job_applications'), n('reviews'), n('community_posts'),
    n('reports', (q) => q.eq('status', 'pending')),
  ]);

  return ok({ users, jobs, openJobs, applications, reviews, posts, pendingReports });
}
