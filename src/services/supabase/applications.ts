/**
 * 지원·채용 서비스 — Supabase 구현
 *
 * 중복 지원 차단은 UNIQUE(job_post_id, applicant_id) 제약이,
 * 본인 공고·마감 공고 지원 차단은 RLS 정책이 담당합니다.
 * 상태 전이 규칙은 DB 트리거가 검사합니다.
 */
import type { ApplicationStatus } from '@/types/enums';
import { ALLOWED_TRANSITIONS } from '@/types/enums';
import type { JobApplication, JobApplicationWithRelations } from '@/types/database';
import { fail, ok, type Result, type ServiceErrorCode } from '../types';
import { supabase, mapPgError } from './client';
import { toApplication } from './mappers';

const REL = `
  *,
  job_posts!inner(id,title,company_name,category,work_date,start_time,end_time,pay_type,pay_amount,place_name,employer_id,status),
  profiles!job_applications_applicant_id_fkey(id,nickname,avatar_url,rating_avg),
  reviews(id)
`;

async function uid(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

function withRelations(r: any): JobApplicationWithRelations {
  const j = r.job_posts ?? {};
  const a = r.profiles ?? {};
  return {
    ...toApplication(r),
    jobPost: {
      id: j.id ?? r.job_post_id,
      title: j.title ?? '삭제된 공고',
      companyName: j.company_name ?? '-',
      category: j.category ?? 'etc',
      workDate: j.work_date ?? '',
      startTime: (j.start_time ?? '').slice(0, 5),
      endTime: (j.end_time ?? '').slice(0, 5),
      payType: j.pay_type ?? 'hourly',
      payAmount: Number(j.pay_amount ?? 0),
      placeName: j.place_name ?? '-',
      employerId: j.employer_id ?? '',
      status: j.status ?? 'closed',
    },
    applicant: {
      id: r.applicant_id,
      nickname: a.nickname ?? '알 수 없음',
      avatarUrl: a.avatar_url ?? null,
      ratingAvg: Number(a.rating_avg ?? 0),
    },
    hasReview: Array.isArray(r.reviews) ? r.reviews.length > 0 : Boolean(r.reviews),
  };
}

export async function applyToJob(jobId: string, message?: string): Promise<Result<JobApplication>> {
  const me = await uid();
  if (!me) return fail('UNAUTHENTICATED');

  // 취소했던 건이 있으면 되살린다(UNIQUE 제약 때문에 새로 넣을 수 없다).
  const { data: existing } = await supabase
    .from('job_applications').select('*')
    .eq('job_post_id', jobId).eq('applicant_id', me).maybeSingle();

  if (existing) {
    if (existing.status !== 'cancelled') return fail('DUPLICATE_APPLICATION');
    const { data, error } = await supabase
      .from('job_applications')
      .update({ status: 'pending', message: message?.trim() || null, applied_at: new Date().toISOString() })
      .eq('id', existing.id).select('*').maybeSingle();
    if (error) {
      const m = mapPgError(error);
      return fail(m.code as ServiceErrorCode, m.message);
    }
    if (!data) return fail('FORBIDDEN');
    return ok(toApplication(data));
  }

  const { data, error } = await supabase
    .from('job_applications')
    .insert({ job_post_id: jobId, applicant_id: me, message: message?.trim() || null })
    .select('*').single();

  if (error) {
    const m = mapPgError(error);
    // RLS 가 막은 경우: 본인 공고이거나 마감된 공고
    if (m.code === 'FORBIDDEN') {
      const { data: job } = await supabase
        .from('job_posts').select('employer_id,status').eq('id', jobId).maybeSingle();
      if (job?.employer_id === me) return fail('SELF_APPLY');
      if (job && job.status !== 'open') return fail('JOB_CLOSED');
    }
    return fail(m.code as ServiceErrorCode, m.message);
  }
  return ok(toApplication(data));
}

export async function cancelApplication(id: string): Promise<Result<JobApplication>> {
  const me = await uid();
  if (!me) return fail('UNAUTHENTICATED');

  const { data, error } = await supabase
    .from('job_applications').update({ status: 'cancelled' })
    .eq('id', id).eq('applicant_id', me).eq('status', 'pending')
    .select('*').maybeSingle();

  if (error) {
    const m = mapPgError(error);
    return fail(m.code as ServiceErrorCode, m.message);
  }
  if (!data) return fail('INVALID_STATE', '대기중인 지원만 취소할 수 있습니다.');
  return ok(toApplication(data));
}

export async function getApplicants(jobId: string): Promise<Result<JobApplicationWithRelations[]>> {
  const me = await uid();
  if (!me) return fail('UNAUTHENTICATED');

  const { data: job } = await supabase
    .from('job_posts').select('employer_id').eq('id', jobId).maybeSingle();
  if (!job) return fail('NOT_FOUND');

  const { data, error } = await supabase
    .from('job_applications').select(REL)
    .eq('job_post_id', jobId).order('applied_at', { ascending: true });

  if (error) {
    const m = mapPgError(error);
    return fail(m.code as ServiceErrorCode, m.message);
  }
  // RLS 로 인해 타인 공고면 빈 배열이 돌아온다.
  if (job.employer_id !== me && (data ?? []).length === 0) return fail('FORBIDDEN');
  return ok((data ?? []).map(withRelations));
}

export async function getMyApplications(
  status?: ApplicationStatus,
): Promise<Result<JobApplicationWithRelations[]>> {
  const me = await uid();
  if (!me) return fail('UNAUTHENTICATED');

  let q = supabase.from('job_applications').select(REL).eq('applicant_id', me);
  if (status) q = q.eq('status', status);

  const { data, error } = await q.order('applied_at', { ascending: false });
  if (error) {
    const m = mapPgError(error);
    return fail(m.code as ServiceErrorCode, m.message);
  }
  return ok((data ?? []).map(withRelations));
}

export async function updateApplicationStatus(
  id: string,
  next: ApplicationStatus,
): Promise<Result<JobApplication>> {
  const me = await uid();
  if (!me) return fail('UNAUTHENTICATED');

  const { data: cur } = await supabase
    .from('job_applications').select('status').eq('id', id).maybeSingle();
  if (!cur) return fail('NOT_FOUND');
  if (!ALLOWED_TRANSITIONS[cur.status as ApplicationStatus].includes(next)) {
    return fail('INVALID_TRANSITION');
  }

  const patch: Record<string, unknown> = { status: next };
  if (next === 'completed') patch.completed_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('job_applications').update(patch).eq('id', id).select('*').maybeSingle();

  if (error) {
    const m = mapPgError(error);
    return fail(m.code as ServiceErrorCode, m.message);
  }
  if (!data) return fail('FORBIDDEN');
  return ok(toApplication(data));
}

/**
 * 개발용 근무 완료 처리.
 * Supabase 모드에서는 RLS 가 "구인자만 완료 처리"를 강제하므로 우회할 수 없습니다.
 * 이것이 정상 동작이며, 구인자 계정으로 처리해야 합니다.
 */
export async function devForceComplete(_id: string): Promise<Result<JobApplication>> {
  return fail(
    'FORBIDDEN',
    '실제 DB 모드에서는 구인자만 근무 완료를 처리할 수 있습니다. 구인자 계정으로 로그인해 주세요.',
  );
}
