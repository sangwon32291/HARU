/**
 * 리뷰 서비스 — Supabase 구현 (HARU 핵심 차별화)
 *
 * "근무 완료자만 후기 작성"은 RLS 정책 reviews_insert 가 강제합니다.
 * 아래 코드가 사전 검사를 하긴 하지만, 그것을 우회해도 DB가 막습니다.
 */
import type {
  CreateReviewInput,
  EmployerRatingSummary,
  JobApplicationWithRelations,
  Review,
  ReviewWithAuthor,
  UpdateReviewInput,
} from '@/types/database';
import { fail, ok, type Result, type ServiceErrorCode } from '../types';
import { supabase, mapPgError } from './client';
import { toReview, toReviewWithAuthor } from './mappers';

const REVIEW_REL = `
  *,
  reviewer:profiles!reviews_reviewer_id_fkey(id,nickname,avatar_url),
  job_post:job_posts!reviews_job_post_id_fkey(title,company_name)
`;

async function uid(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

export async function getJobReviews(jobId: string): Promise<Result<ReviewWithAuthor[]>> {
  const { data, error } = await supabase
    .from('reviews').select(REVIEW_REL).eq('job_post_id', jobId)
    .order('created_at', { ascending: false });
  if (error) {
    const m = mapPgError(error);
    return fail(m.code as ServiceErrorCode, m.message);
  }
  return ok((data ?? []).map(toReviewWithAuthor));
}

export async function getEmployerReviews(employerId: string): Promise<Result<ReviewWithAuthor[]>> {
  const { data, error } = await supabase
    .from('reviews').select(REVIEW_REL).eq('employer_id', employerId)
    .order('created_at', { ascending: false });
  if (error) {
    const m = mapPgError(error);
    return fail(m.code as ServiceErrorCode, m.message);
  }
  return ok((data ?? []).map(toReviewWithAuthor));
}

export async function getEmployerRating(employerId: string): Promise<Result<EmployerRatingSummary>> {
  const { data: profile, error: pe } = await supabase
    .from('profiles').select('id,nickname,rating_avg,review_count').eq('id', employerId).maybeSingle();
  if (pe || !profile) return fail('NOT_FOUND');

  const { data: rows } = await supabase
    .from('reviews')
    .select('rating_pay,rating_workload,rating_environment,rating_accuracy,rating_overall,would_work_again')
    .eq('employer_id', employerId).eq('is_hidden', false);

  const list = rows ?? [];
  const n = list.length;
  const avg = (f: (r: any) => number) =>
    n === 0 ? 0 : Math.round((list.reduce((a, r) => a + Number(f(r)), 0) / n) * 100) / 100;

  const { data: job } = await supabase
    .from('job_posts').select('company_name').eq('employer_id', employerId).limit(1).maybeSingle();

  return ok({
    employerId,
    nickname: profile.nickname,
    companyName: job?.company_name ?? profile.nickname,
    ratingAvg: avg((r) => r.rating_overall),
    reviewCount: n,
    breakdown: {
      pay: avg((r) => r.rating_pay),
      workload: avg((r) => r.rating_workload),
      environment: avg((r) => r.rating_environment),
      accuracy: avg((r) => r.rating_accuracy),
    },
    wouldWorkAgainRate: n === 0 ? 0 : list.filter((r) => r.would_work_again).length / n,
  });
}

export async function getReviewableApplications(): Promise<Result<JobApplicationWithRelations[]>> {
  const me = await uid();
  if (!me) return fail('UNAUTHENTICATED');

  const { data, error } = await supabase
    .from('job_applications')
    .select(`
      *,
      job_posts!inner(id,title,company_name,category,work_date,start_time,end_time,pay_type,pay_amount,place_name,employer_id,status),
      reviews(id)
    `)
    .eq('applicant_id', me).eq('status', 'completed');

  if (error) {
    const m = mapPgError(error);
    return fail(m.code as ServiceErrorCode, m.message);
  }

  const { data: profile } = await supabase
    .from('profiles').select('id,nickname,avatar_url,rating_avg').eq('id', me).maybeSingle();

  const rows = (data ?? []).filter((r: any) => !r.reviews || r.reviews.length === 0);
  return ok(rows.map((r: any) => {
    const j = r.job_posts ?? {};
    return {
      id: r.id, jobPostId: r.job_post_id, applicantId: r.applicant_id,
      message: r.message ?? null, status: r.status,
      appliedAt: r.applied_at, completedAt: r.completed_at ?? null,
      jobPost: {
        id: j.id, title: j.title ?? '삭제된 공고', companyName: j.company_name ?? '-',
        category: j.category ?? 'etc',
        workDate: j.work_date ?? '', startTime: (j.start_time ?? '').slice(0, 5),
        endTime: (j.end_time ?? '').slice(0, 5), payType: j.pay_type ?? 'hourly',
        payAmount: Number(j.pay_amount ?? 0), placeName: j.place_name ?? '-',
        employerId: j.employer_id ?? '', status: j.status ?? 'closed',
      },
      applicant: {
        id: me, nickname: profile?.nickname ?? '', avatarUrl: profile?.avatar_url ?? null,
        ratingAvg: Number(profile?.rating_avg ?? 0),
      },
      hasReview: false,
    };
  }));
}

export async function getMyReviews(): Promise<Result<ReviewWithAuthor[]>> {
  const me = await uid();
  if (!me) return fail('UNAUTHENTICATED');
  const { data, error } = await supabase
    .from('reviews').select(REVIEW_REL).eq('reviewer_id', me)
    .order('created_at', { ascending: false });
  if (error) {
    const m = mapPgError(error);
    return fail(m.code as ServiceErrorCode, m.message);
  }
  return ok((data ?? []).map(toReviewWithAuthor));
}

export async function getReviewByApplication(applicationId: string): Promise<Result<Review | null>> {
  const { data } = await supabase
    .from('reviews').select('*').eq('application_id', applicationId).maybeSingle();
  return ok(data ? toReview(data) : null);
}

function validate(i: Pick<CreateReviewInput,
  'ratingPay' | 'ratingWorkload' | 'ratingEnvironment' | 'ratingAccuracy' | 'content'>): string | null {
  const v = [i.ratingPay, i.ratingWorkload, i.ratingEnvironment, i.ratingAccuracy];
  if (v.some((x) => !Number.isInteger(x) || x < 1 || x > 5))
    return '모든 평가 항목에 1~5점을 선택해 주세요.';
  if (i.content.trim().length < 10) return '후기를 10자 이상 작성해 주세요.';
  return null;
}

export async function createReview(input: CreateReviewInput): Promise<Result<Review>> {
  const me = await uid();
  if (!me) return fail('UNAUTHENTICATED');
  const msg = validate(input);
  if (msg) return fail('VALIDATION_FAILED', msg);

  const { data: app } = await supabase
    .from('job_applications')
    .select('id,status,job_post_id,applicant_id,job_posts!inner(employer_id)')
    .eq('id', input.applicationId).maybeSingle();

  if (!app) return fail('NOT_FOUND');
  if (app.applicant_id !== me) return fail('FORBIDDEN');
  if (app.status !== 'completed') return fail('NOT_COMPLETED');

  const employerId = (app as any).job_posts?.employer_id;

  const { data, error } = await supabase.from('reviews').insert({
    application_id: input.applicationId,
    job_post_id: app.job_post_id,
    reviewer_id: me,
    employer_id: employerId,
    rating_pay: input.ratingPay,
    rating_workload: input.ratingWorkload,
    rating_environment: input.ratingEnvironment,
    rating_accuracy: input.ratingAccuracy,
    would_work_again: input.wouldWorkAgain,
    content: input.content.trim(),
  }).select('*').single();

  if (error) {
    const m = mapPgError(error);
    return fail(m.code as ServiceErrorCode, m.message);
  }
  return ok(toReview(data));
}

export async function updateReview(id: string, input: UpdateReviewInput): Promise<Result<Review>> {
  const me = await uid();
  if (!me) return fail('UNAUTHENTICATED');
  const msg = validate(input);
  if (msg) return fail('VALIDATION_FAILED', msg);

  const { data, error } = await supabase.from('reviews').update({
    rating_pay: input.ratingPay,
    rating_workload: input.ratingWorkload,
    rating_environment: input.ratingEnvironment,
    rating_accuracy: input.ratingAccuracy,
    would_work_again: input.wouldWorkAgain,
    content: input.content.trim(),
    updated_at: new Date().toISOString(),
  }).eq('id', id).select('*').maybeSingle();

  if (error) {
    const m = mapPgError(error);
    return fail(m.code as ServiceErrorCode, m.message);
  }
  if (!data) return fail('FORBIDDEN');
  return ok(toReview(data));
}

export async function deleteReview(id: string): Promise<Result<void>> {
  const me = await uid();
  if (!me) return fail('UNAUTHENTICATED');
  const { error } = await supabase.from('reviews').delete().eq('id', id);
  if (error) {
    const m = mapPgError(error);
    return fail(m.code as ServiceErrorCode, m.message);
  }
  return ok(undefined);
}

export async function getRecentReviews(limit = 4): Promise<Result<ReviewWithAuthor[]>> {
  const { data, error } = await supabase
    .from('reviews').select(REVIEW_REL).eq('is_hidden', false)
    .order('created_at', { ascending: false }).limit(limit);
  if (error) {
    const m = mapPgError(error);
    return fail(m.code as ServiceErrorCode, m.message);
  }
  return ok((data ?? []).map(toReviewWithAuthor));
}
