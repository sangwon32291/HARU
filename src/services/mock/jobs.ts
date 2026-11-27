/**
 * 공고 서비스 (JOB-01 ~ JOB-04, MAP-05 ~ MAP-09)
 *
 * getNearbyJobs 의 distanceM 은 "데이터 계층"이 계산한다.
 * Supabase 전환 시 이 함수 본문만 search_jobs RPC 호출로 교체되고,
 * 화면 코드는 그대로 유지된다.
 */
import type {
  CreateJobInput,
  JobPost,
  JobPostDetail,
  JobPostSummary,
  NearbyJobsParams,
  UpdateJobInput,
} from '@/types/database';
import { haversineM } from '@/lib/geo';
import {
  commit,
  countApplicants,
  currentUser,
  findProfile,
  getState,
  isAdmin,
  nextId,
  nowIso,
} from './db';
import { delay, fail, ok, type Result } from '../types';

function toSummary(job: JobPost, origin: { lat: number; lng: number }): JobPostSummary {
  const employer = findProfile(job.employerId);
  return {
    id: job.id,
    title: job.title,
    companyName: job.companyName,
    category: job.category,
    workDate: job.workDate,
    startTime: job.startTime,
    endTime: job.endTime,
    payType: job.payType,
    payAmount: job.payAmount,
    headcount: job.headcount,
    placeName: job.placeName,
    lat: job.lat,
    lng: job.lng,
    employerId: job.employerId,
    status: job.status,
    createdAt: job.createdAt,
    distanceM: haversineM(origin, { lat: job.lat, lng: job.lng }),
    ratingAvg: employer?.ratingAvg ?? 0,
    reviewCount: employer?.reviewCount ?? 0,
    applicantCount: countApplicants(job.id),
  };
}

export interface NearbyJobsResult {
  items: JobPostSummary[];
  total: number;
}

export async function getNearbyJobs(params: NearbyJobsParams): Promise<Result<NearbyJobsResult>> {
  await delay(140);
  if (!Number.isFinite(params.lat) || !Number.isFinite(params.lng)) {
    return fail('LOCATION_REQUIRED');
  }
  const {
    radiusM = 5000,
    category,
    dateFrom,
    dateTo,
    payType,
    minPay,
    keyword,
    sort = 'distance',
    page = 1,
    pageSize = 20,
  } = params;

  const origin = { lat: params.lat, lng: params.lng };
  const kw = keyword?.trim().toLowerCase();

  let rows = getState()
    .jobPosts.filter((j) => j.status === 'open')
    .map((j) => toSummary(j, origin))
    .filter((j) => j.distanceM <= radiusM)
    .filter((j) => (category ? j.category === category : true))
    .filter((j) => (dateFrom ? j.workDate >= dateFrom : true))
    .filter((j) => (dateTo ? j.workDate <= dateTo : true))
    .filter((j) => (payType ? j.payType === payType : true))
    .filter((j) => (minPay ? j.payAmount >= minPay : true));

  if (kw) {
    const jobs = getState().jobPosts;
    rows = rows.filter((row) => {
      const full = jobs.find((j) => j.id === row.id)!;
      return (
        full.title.toLowerCase().includes(kw) ||
        full.description.toLowerCase().includes(kw) ||
        full.companyName.toLowerCase().includes(kw) ||
        full.placeName.toLowerCase().includes(kw)
      );
    });
  }

  rows.sort((a, b) => {
    if (sort === 'pay') {
      const pa = a.payType === 'daily' ? a.payAmount : a.payAmount * 8;
      const pb = b.payType === 'daily' ? b.payAmount : b.payAmount * 8;
      return pb - pa;
    }
    if (sort === 'recent') return b.createdAt.localeCompare(a.createdAt);
    return a.distanceM - b.distanceM;
  });

  const total = rows.length;
  const start = (page - 1) * pageSize;
  return ok({ items: rows.slice(start, start + pageSize), total });
}

export async function getJobDetail(id: string): Promise<Result<JobPostDetail>> {
  await delay(120);
  const job = getState().jobPosts.find((j) => j.id === id);
  if (!job) return fail('NOT_FOUND', '공고를 찾을 수 없습니다.');
  if (job.status === 'hidden' && !isAdmin() && currentUser()?.id !== job.employerId) {
    return fail('NOT_FOUND', '공고를 찾을 수 없습니다.');
  }

  const employer = findProfile(job.employerId);
  const me = currentUser();
  const myApplication =
    me != null
      ? getState().applications.find((a) => a.jobPostId === job.id && a.applicantId === me.id) ?? null
      : null;

  return ok({
    ...job,
    employer: {
      id: job.employerId,
      nickname: employer?.nickname ?? '알 수 없음',
      avatarUrl: employer?.avatarUrl ?? null,
      ratingAvg: employer?.ratingAvg ?? 0,
      reviewCount: employer?.reviewCount ?? 0,
    },
    applicantCount: countApplicants(job.id),
    acceptedCount: countApplicants(job.id, ['accepted', 'completed']),
    myApplication,
  });
}

function validateJobInput(input: Partial<CreateJobInput>): string | null {
  if (input.title !== undefined && (input.title.trim().length < 5 || input.title.trim().length > 60)) {
    return '공고 제목은 5~60자로 입력해 주세요.';
  }
  if (input.companyName !== undefined && !input.companyName.trim()) return '업체명을 입력해 주세요.';
  if (input.description !== undefined && input.description.trim().length < 10) {
    return '업무 내용을 10자 이상 입력해 주세요.';
  }
  if (input.payAmount !== undefined && (!Number.isFinite(input.payAmount) || input.payAmount <= 0)) {
    return '급여는 0보다 큰 금액이어야 합니다.';
  }
  if (input.headcount !== undefined && input.headcount < 1) return '모집 인원은 1명 이상이어야 합니다.';
  if (input.placeName !== undefined && !input.placeName.trim()) return '근무 장소를 입력해 주세요.';
  if (
    (input.lat !== undefined && !Number.isFinite(input.lat)) ||
    (input.lng !== undefined && !Number.isFinite(input.lng))
  ) {
    return '지도에서 근무 위치를 선택해 주세요.';
  }
  return null;
}

export async function createJob(input: CreateJobInput): Promise<Result<JobPost>> {
  await delay();
  const me = currentUser();
  if (!me) return fail('UNAUTHENTICATED');
  const message = validateJobInput(input);
  if (message) return fail('VALIDATION_FAILED', message);

  const s = getState();
  const now = nowIso();
  const job: JobPost = {
    id: nextId('j'),
    employerId: me.id,
    title: input.title.trim(),
    companyName: input.companyName.trim(),
    category: input.category,
    description: input.description.trim(),
    workDate: input.workDate,
    startTime: input.startTime,
    endTime: input.endTime,
    payType: input.payType,
    payAmount: Math.round(input.payAmount),
    headcount: input.headcount,
    placeName: input.placeName.trim(),
    address: input.address?.trim() || null,
    lat: input.lat,
    lng: input.lng,
    requirements: input.requirements?.trim() || null,
    belongings: input.belongings?.trim() || null,
    status: 'open',
    createdAt: now,
    updatedAt: now,
  };
  s.jobPosts.unshift(job);
  commit();
  return ok(job);
}

export async function updateJob(id: string, input: UpdateJobInput): Promise<Result<JobPost>> {
  await delay();
  const me = currentUser();
  if (!me) return fail('UNAUTHENTICATED');
  const job = getState().jobPosts.find((j) => j.id === id);
  if (!job) return fail('NOT_FOUND');
  if (job.employerId !== me.id && !isAdmin()) return fail('FORBIDDEN');

  const message = validateJobInput(input);
  if (message) return fail('VALIDATION_FAILED', message);

  Object.assign(job, input, { updatedAt: nowIso() });
  commit();
  return ok({ ...job });
}

export async function deleteJob(id: string): Promise<Result<void>> {
  await delay();
  const me = currentUser();
  if (!me) return fail('UNAUTHENTICATED');
  const s = getState();
  const job = s.jobPosts.find((j) => j.id === id);
  if (!job) return fail('NOT_FOUND');
  if (job.employerId !== me.id && !isAdmin()) return fail('FORBIDDEN');

  s.jobPosts = s.jobPosts.filter((j) => j.id !== id);
  s.applications = s.applications.filter((a) => a.jobPostId !== id);
  commit();
  return ok(undefined);
}

export async function closeJob(id: string): Promise<Result<JobPost>> {
  await delay();
  const me = currentUser();
  if (!me) return fail('UNAUTHENTICATED');
  const job = getState().jobPosts.find((j) => j.id === id);
  if (!job) return fail('NOT_FOUND');
  if (job.employerId !== me.id && !isAdmin()) return fail('FORBIDDEN');
  if (job.status === 'closed') return fail('INVALID_STATE', '이미 마감된 공고입니다.');

  job.status = 'closed';
  job.updatedAt = nowIso();
  commit();
  return ok({ ...job });
}

export async function reopenJob(id: string): Promise<Result<JobPost>> {
  await delay();
  const me = currentUser();
  if (!me) return fail('UNAUTHENTICATED');
  const job = getState().jobPosts.find((j) => j.id === id);
  if (!job) return fail('NOT_FOUND');
  if (job.employerId !== me.id && !isAdmin()) return fail('FORBIDDEN');
  job.status = 'open';
  job.updatedAt = nowIso();
  commit();
  return ok({ ...job });
}

export async function getMyJobs(): Promise<Result<JobPostSummary[]>> {
  await delay(120);
  const me = currentUser();
  if (!me) return fail('UNAUTHENTICATED');
  const origin = { lat: me.baseLat ?? 37.5509, lng: me.baseLng ?? 126.8495 };
  const rows = getState()
    .jobPosts.filter((j) => j.employerId === me.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((j) => toSummary(j, origin));
  return ok(rows);
}

/**
 * 시연용: 지정한 좌표 주변에 샘플 공고를 생성한다.
 *
 * 기본 샘플 데이터는 서울 강서구 일대에만 있으므로, 다른 지역에서 실행하면
 * 결과가 0건으로 보인다. 이 함수는 기존 샘플 공고의 내용을 그대로 재사용해
 * 좌표와 근무일만 현재 위치 기준으로 바꾼 공고를 만들어 준다.
 *
 * 생성된 공고는 실제 모집이 아니며, 제목에 표시는 하지 않되 업체명 뒤에
 * 지역명을 붙여 샘플임을 알아볼 수 있게 한다. VITE_ENABLE_DEV_TOOLS 가
 * true 일 때만 화면에서 호출된다.
 */
export async function devSeedJobsNearby(
  origin: { lat: number; lng: number },
  regionName: string,
  count = 24,
): Promise<Result<number>> {
  if (import.meta.env.VITE_ENABLE_DEV_TOOLS !== 'true') {
    return fail('FORBIDDEN', '개발 도구가 비활성화되어 있습니다.');
  }
  await delay(200);
  const s = getState();
  const templates = s.jobPosts.slice(0, 40);
  if (templates.length === 0) return fail('NOT_FOUND', '복제할 샘플 공고가 없습니다.');

  const today = new Date();
  const created: JobPost[] = [];

  for (let i = 0; i < count; i += 1) {
    const tpl = templates[i % templates.length];
    // 약 ±0.035도(≈ 3km) 범위에 분포시킨다
    const lat = origin.lat + (Math.random() - 0.5) * 0.07;
    const lng = origin.lng + (Math.random() - 0.5) * 0.085;
    const workDate = new Date(today.getTime() + Math.floor(Math.random() * 7) * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const now = nowIso();

    created.push({
      ...tpl,
      id: nextId('j'),
      companyName: `${tpl.companyName} (${regionName})`,
      workDate,
      placeName: `${regionName} ${tpl.placeName.replace(/^.*?\s/, '')}`,
      address: regionName,
      lat,
      lng,
      status: 'open',
      createdAt: now,
      updatedAt: now,
    });
  }

  s.jobPosts.unshift(...created);
  commit();
  return ok(created.length);
}

/** 홈 화면용: 오늘/내일 추천 공고 */
export async function getFeaturedJobs(
  origin: { lat: number; lng: number },
  limit = 6,
): Promise<Result<JobPostSummary[]>> {
  await delay(120);
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const rows = getState()
    .jobPosts.filter((j) => j.status === 'open' && j.workDate >= todayStr)
    .map((j) => toSummary(j, origin))
    .sort((a, b) => {
      const payA = a.payType === 'daily' ? a.payAmount : a.payAmount * 8;
      const payB = b.payType === 'daily' ? b.payAmount : b.payAmount * 8;
      // 평점과 급여를 함께 고려한 단순 추천 점수 (추천 로직임을 화면에 명시)
      return payB + b.ratingAvg * 8000 - (payA + a.ratingAvg * 8000);
    })
    .slice(0, limit);
  return ok(rows);
}
