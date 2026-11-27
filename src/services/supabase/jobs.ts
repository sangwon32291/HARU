/**
 * 공고 서비스 — Supabase 구현
 *
 * 근접 검색은 search_jobs RPC 가 담당합니다. 거리 계산을 DB 한 곳에 모아
 * 화면마다 다르게 구현되는 일을 막고, PostGIS 공간 인덱스로 가속합니다.
 */
import type {
  CreateJobInput,
  JobPost,
  JobPostDetail,
  JobPostSummary,
  NearbyJobsParams,
  UpdateJobInput,
} from '@/types/database';
import { fail, ok, type Result, type ServiceErrorCode } from '../types';
import { supabase, mapPgError } from './client';
import { jobToSummary, rpcToSummary, toApplication, toJobPost } from './mappers';

const JOB_COLS =
  'id,employer_id,title,company_name,category,description,work_date,start_time,end_time,' +
  'pay_type,pay_amount,headcount,place_name,address,lat,lng,requirements,belongings,status,' +
  'created_at,updated_at';

async function uid(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

export interface NearbyJobsResult {
  items: JobPostSummary[];
  total: number;
}

export async function getNearbyJobs(params: NearbyJobsParams): Promise<Result<NearbyJobsResult>> {
  if (!Number.isFinite(params.lat) || !Number.isFinite(params.lng)) {
    return fail('LOCATION_REQUIRED');
  }
  const {
    radiusM = 5000, category, dateFrom, dateTo, payType, minPay, keyword,
    sort = 'distance', page = 1, pageSize = 20,
  } = params;

  const args = {
    p_lat: params.lat,
    p_lng: params.lng,
    p_radius_m: radiusM,
    p_category: category ?? null,
    p_date_from: dateFrom ?? null,
    p_date_to: dateTo ?? null,
    p_pay_type: payType ?? null,
    p_min_pay: minPay ?? null,
    p_keyword: keyword?.trim() || null,
  };

  const [rows, count] = await Promise.all([
    supabase.rpc('search_jobs', {
      ...args, p_sort: sort, p_limit: pageSize, p_offset: (page - 1) * pageSize,
    }),
    supabase.rpc('count_jobs', args),
  ]);

  if (rows.error) {
    const m = mapPgError(rows.error);
    return fail(m.code as ServiceErrorCode, m.message);
  }
  return ok({
    items: (rows.data ?? []).map(rpcToSummary),
    total: Number(count.data ?? (rows.data ?? []).length),
  });
}

export async function getJobDetail(id: string): Promise<Result<JobPostDetail>> {
  const { data, error } = await supabase
    .from('job_posts')
    .select(`${JOB_COLS}, profiles!job_posts_employer_id_fkey(id,nickname,avatar_url,rating_avg,review_count)`)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    const m = mapPgError(error);
    return fail(m.code as ServiceErrorCode, m.message);
  }
  if (!data) return fail('NOT_FOUND', '공고를 찾을 수 없습니다.');

  const emp = (data as any).profiles ?? {};
  const me = await uid();

  const [{ count: applicantCount }, { count: acceptedCount }] = await Promise.all([
    supabase.from('job_applications').select('id', { count: 'exact', head: true }).eq('job_post_id', id),
    supabase.from('job_applications').select('id', { count: 'exact', head: true })
      .eq('job_post_id', id).in('status', ['accepted', 'completed']),
  ]);

  let myApplication = null;
  if (me) {
    const { data: mine } = await supabase
      .from('job_applications').select('*').eq('job_post_id', id).eq('applicant_id', me).maybeSingle();
    if (mine) myApplication = toApplication(mine);
  }

  return ok({
    ...toJobPost(data),
    employer: {
      id: emp.id ?? data.employer_id,
      nickname: emp.nickname ?? '알 수 없음',
      avatarUrl: emp.avatar_url ?? null,
      ratingAvg: Number(emp.rating_avg ?? 0),
      reviewCount: Number(emp.review_count ?? 0),
    },
    applicantCount: applicantCount ?? 0,
    acceptedCount: acceptedCount ?? 0,
    myApplication,
  });
}

function validate(input: Partial<CreateJobInput>): string | null {
  if (input.title !== undefined && (input.title.trim().length < 5 || input.title.trim().length > 60))
    return '공고 제목은 5~60자로 입력해 주세요.';
  if (input.companyName !== undefined && !input.companyName.trim()) return '업체명을 입력해 주세요.';
  if (input.description !== undefined && input.description.trim().length < 10)
    return '업무 내용을 10자 이상 입력해 주세요.';
  if (input.payAmount !== undefined && (!Number.isFinite(input.payAmount) || input.payAmount <= 0))
    return '급여는 0보다 큰 금액이어야 합니다.';
  if (input.headcount !== undefined && input.headcount < 1) return '모집 인원은 1명 이상이어야 합니다.';
  if (input.placeName !== undefined && !input.placeName.trim()) return '근무 장소를 입력해 주세요.';
  if ((input.lat !== undefined && !Number.isFinite(input.lat)) ||
      (input.lng !== undefined && !Number.isFinite(input.lng)))
    return '지도에서 근무 위치를 선택해 주세요.';
  return null;
}

function toRow(input: Partial<CreateJobInput>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  const m: Record<string, string> = {
    title: 'title', companyName: 'company_name', category: 'category', description: 'description',
    workDate: 'work_date', startTime: 'start_time', endTime: 'end_time', payType: 'pay_type',
    payAmount: 'pay_amount', headcount: 'headcount', placeName: 'place_name', address: 'address',
    lat: 'lat', lng: 'lng', requirements: 'requirements', belongings: 'belongings',
  };
  for (const [k, col] of Object.entries(m)) {
    const v = (input as any)[k];
    if (v !== undefined) r[col] = typeof v === 'string' ? (v.trim() || null) : v;
  }
  // NOT NULL 컬럼은 null 로 보내지 않는다.
  for (const col of ['title', 'company_name', 'description', 'place_name']) {
    if (r[col] === null) delete r[col];
  }
  return r;
}

export async function createJob(input: CreateJobInput): Promise<Result<JobPost>> {
  const me = await uid();
  if (!me) return fail('UNAUTHENTICATED');
  const msg = validate(input);
  if (msg) return fail('VALIDATION_FAILED', msg);

  const { data, error } = await supabase
    .from('job_posts').insert({ ...toRow(input), employer_id: me }).select(JOB_COLS).single();

  if (error) {
    const m = mapPgError(error);
    return fail(m.code as ServiceErrorCode, m.message);
  }
  return ok(toJobPost(data));
}

export async function updateJob(id: string, input: UpdateJobInput): Promise<Result<JobPost>> {
  const me = await uid();
  if (!me) return fail('UNAUTHENTICATED');
  const msg = validate(input);
  if (msg) return fail('VALIDATION_FAILED', msg);

  const row = toRow(input);
  if (input.status) row.status = input.status;

  const { data, error } = await supabase
    .from('job_posts').update(row).eq('id', id).select(JOB_COLS).maybeSingle();

  if (error) {
    const m = mapPgError(error);
    return fail(m.code as ServiceErrorCode, m.message);
  }
  if (!data) return fail('FORBIDDEN', '본인이 등록한 공고만 수정할 수 있습니다.');
  return ok(toJobPost(data));
}

export async function deleteJob(id: string): Promise<Result<void>> {
  const me = await uid();
  if (!me) return fail('UNAUTHENTICATED');
  const { error } = await supabase.from('job_posts').delete().eq('id', id);
  if (error) {
    const m = mapPgError(error);
    return fail(m.code as ServiceErrorCode, m.message);
  }
  return ok(undefined);
}

async function setStatus(id: string, status: 'open' | 'closed'): Promise<Result<JobPost>> {
  const me = await uid();
  if (!me) return fail('UNAUTHENTICATED');
  const { data, error } = await supabase
    .from('job_posts').update({ status }).eq('id', id).select(JOB_COLS).maybeSingle();
  if (error) {
    const m = mapPgError(error);
    return fail(m.code as ServiceErrorCode, m.message);
  }
  if (!data) return fail('FORBIDDEN', '본인이 등록한 공고만 변경할 수 있습니다.');
  return ok(toJobPost(data));
}

export const closeJob = (id: string) => setStatus(id, 'closed');
export const reopenJob = (id: string) => setStatus(id, 'open');

export async function getMyJobs(): Promise<Result<JobPostSummary[]>> {
  const me = await uid();
  if (!me) return fail('UNAUTHENTICATED');

  const { data, error } = await supabase
    .from('job_posts')
    .select(`${JOB_COLS}, job_applications(id)`)
    .eq('employer_id', me)
    .order('created_at', { ascending: false });

  if (error) {
    const m = mapPgError(error);
    return fail(m.code as ServiceErrorCode, m.message);
  }
  return ok((data ?? []).map((r) => jobToSummary(r)));
}

export async function getFeaturedJobs(
  origin: { lat: number; lng: number },
  limit = 6,
): Promise<Result<JobPostSummary[]>> {
  // 넓은 반경에서 급여순으로 뽑아 '추천'으로 보여준다.
  const res = await getNearbyJobs({
    ...origin, radiusM: 20000, sort: 'pay', pageSize: limit,
    dateFrom: new Date().toISOString().slice(0, 10),
  });
  if (res.error) return fail(res.error.code, res.error.message);
  return ok(res.data.items);
}

/** 시연용: 현재 위치 주변에 샘플 공고를 만든다(로그인 사용자 본인 명의). */
export async function devSeedJobsNearby(
  origin: { lat: number; lng: number },
  regionName: string,
  count = 12,
): Promise<Result<number>> {
  if (import.meta.env.VITE_ENABLE_DEV_TOOLS !== 'true') {
    return fail('FORBIDDEN', '개발 도구가 비활성화되어 있습니다.');
  }
  const me = await uid();
  if (!me) return fail('UNAUTHENTICATED', '샘플 공고를 만들려면 로그인이 필요합니다.');

  const titles = [
    ['logistics', '택배 상하차 보조 (단기)'], ['serving', '점심 피크타임 홀서빙'],
    ['cafe', '주말 카페 홀·음료 보조'], ['mart', '마트 진열 및 재고 정리'],
    ['cleaning', '사무실 입주 청소'], ['office', '서류 스캔·정리 사무보조'],
  ];
  const rows = Array.from({ length: count }, (_, i) => {
    const [category, title] = titles[i % titles.length];
    const hourly = Math.random() > 0.45;
    const day = Math.floor(Math.random() * 7);
    return {
      employer_id: me,
      title, company_name: `${regionName} 샘플업체 ${i + 1}`,
      category,
      description: '시연용으로 생성한 샘플 공고입니다. 실제 모집이 아닙니다.',
      work_date: new Date(Date.now() + day * 86_400_000).toISOString().slice(0, 10),
      start_time: '09:00', end_time: '18:00',
      pay_type: hourly ? 'hourly' : 'daily',
      pay_amount: hourly ? 12_000 + Math.floor(Math.random() * 30) * 100
                         : 100_000 + Math.floor(Math.random() * 50) * 1000,
      headcount: 1 + Math.floor(Math.random() * 4),
      place_name: `${regionName} 샘플 집합장소 ${i + 1}`,
      address: regionName,
      lat: origin.lat + (Math.random() - 0.5) * 0.05,
      lng: origin.lng + (Math.random() - 0.5) * 0.06,
      status: 'open',
    };
  });

  const { error, count: inserted } = await supabase
    .from('job_posts').insert(rows, { count: 'exact' });
  if (error) {
    const m = mapPgError(error);
    return fail(m.code as ServiceErrorCode, m.message);
  }
  return ok(inserted ?? rows.length);
}
