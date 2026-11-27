/**
 * 맞춤 일자리 추천.
 *
 * 설계 원칙
 *  - 별도의 추천 API를 두지 않고, 이미 있는 서비스 함수(getMyApplications, getNearbyJobs)를
 *    조합해 만든다. 그래서 mock 모드와 supabase 모드 양쪽에서 **같은 코드**로 동작한다.
 *  - 점수 산출 근거를 함께 돌려준다. "왜 추천했는지"를 화면에 보여주기 위함이며,
 *    추천이 블랙박스처럼 보이지 않게 하려는 의도다.
 *  - 통계적 추천 모델이 아니라 규칙 기반 점수표다. AI를 쓰지 않는다.
 */
import type { JobPostSummary } from '@/types/database';
import type { JobCategory } from '@/types/enums';
import { JOB_CATEGORY_LABEL } from '@/types/enums';
import { getMyApplications } from './applications';
import { getNearbyJobs } from './jobs';
import { ok, type Result } from './types';
import { formatDistance } from '@/lib/geo';

export interface RecommendedJob {
  job: JobPostSummary;
  score: number;
  /** 화면에 배지로 보여줄 추천 근거 */
  reasons: string[];
}

export interface RecommendResult {
  items: RecommendedJob[];
  /** 이력에서 뽑아낸 취향 요약. 이력이 없으면 null */
  profile: {
    topCategories: JobCategory[];
    avgHourlyPay: number | null;
    prefersEarly: boolean;
    historyCount: number;
  } | null;
}

/** 시급/일급을 8시간 기준 시급으로 환산해 비교 가능하게 만든다. */
function toHourly(payType: string, amount: number): number {
  return payType === 'daily' ? Math.round(amount / 8) : amount;
}

export async function getRecommendedJobs(
  origin: { lat: number; lng: number },
  limit = 6,
): Promise<Result<RecommendResult>> {
  // 1) 내 이력 — 취소·거절 건은 취향으로 보기 어려우므로 제외
  const appsRes = await getMyApplications();
  const history = (appsRes.data ?? []).filter(
    (a) => a.status === 'completed' || a.status === 'accepted' || a.status === 'pending',
  );
  const appliedJobIds = new Set((appsRes.data ?? []).map((a) => a.jobPostId));

  // 2) 후보 공고 — 반경을 넉넉히 잡고 가져온 뒤 점수로 추린다
  const nearbyRes = await getNearbyJobs({
    ...origin,
    radiusM: 20000,
    sort: 'distance',
    pageSize: 60,
    dateFrom: new Date().toISOString().slice(0, 10),
  });
  if (nearbyRes.error) return { data: null, error: nearbyRes.error };

  const candidates = nearbyRes.data.items.filter((j) => !appliedJobIds.has(j.id));

  // 3) 이력에서 취향 뽑기
  let profile: RecommendResult['profile'] = null;
  const catCount = new Map<JobCategory, number>();
  let paySum = 0;
  let payN = 0;
  let earlyN = 0;

  for (const a of history) {
    catCount.set(a.jobPost.category, (catCount.get(a.jobPost.category) ?? 0) + 1);
    if (a.jobPost.payAmount > 0) {
      paySum += toHourly(a.jobPost.payType, a.jobPost.payAmount);
      payN += 1;
    }
    const hour = Number((a.jobPost.startTime || '12:00').slice(0, 2));
    if (hour <= 9) earlyN += 1;
  }

  const topCategories = [...catCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([c]) => c);

  if (history.length > 0) {
    profile = {
      topCategories,
      avgHourlyPay: payN > 0 ? Math.round(paySum / payN) : null,
      prefersEarly: history.length > 0 && earlyN / history.length >= 0.5,
      historyCount: history.length,
    };
  }

  // 4) 점수 매기기
  const scored: RecommendedJob[] = candidates.map((job) => {
    let score = 0;
    const reasons: string[] = [];

    // 거리: 가까울수록 최대 30점
    const km = job.distanceM / 1000;
    const distScore = Math.max(0, 30 - km * 2.5);
    score += distScore;
    if (km <= 3) reasons.push(`가까움 ${formatDistance(job.distanceM)}`);

    // 선호 직종: 1순위 28점, 그 외 상위 직종 18점
    if (profile && topCategories.length > 0) {
      const idx = topCategories.indexOf(job.category);
      if (idx === 0) {
        score += 28;
        reasons.push(`전에 한 ${JOB_CATEGORY_LABEL[job.category]}`);
      } else if (idx > 0) {
        score += 18;
        reasons.push(`해본 직종 ${JOB_CATEGORY_LABEL[job.category]}`);
      }
    }

    // 급여: 평소보다 높으면 최대 22점
    if (profile?.avgHourlyPay) {
      const h = toHourly(job.payType, job.payAmount);
      const ratio = h / profile.avgHourlyPay;
      if (ratio >= 1.0) {
        score += Math.min(22, (ratio - 1) * 60 + 8);
        if (ratio >= 1.1) reasons.push(`평소보다 급여 높음`);
      }
    } else {
      // 이력이 없으면 급여 자체를 가볍게 반영
      score += Math.min(14, toHourly(job.payType, job.payAmount) / 1500);
    }

    // 업체 평점: 최대 20점. 후기가 쌓인 업체를 우선한다.
    if (job.reviewCount > 0) {
      score += (job.ratingAvg / 5) * 20;
      if (job.ratingAvg >= 4.0) reasons.push(`평점 ${job.ratingAvg.toFixed(1)}`);
    }

    // 선호 시간대
    const hour = Number(job.startTime.slice(0, 2));
    if (profile) {
      if (profile.prefersEarly && hour <= 9) {
        score += 8;
        reasons.push('이른 시간대');
      } else if (!profile.prefersEarly && hour >= 10) {
        score += 8;
      }
    }

    // 오늘·내일 공고 가산
    const today = new Date().toISOString().slice(0, 10);
    if (job.workDate === today) {
      score += 10;
      reasons.push('오늘 근무');
    }

    // 경쟁률: 모집 인원 대비 지원자가 적으면 가산
    if (job.applicantCount < job.headcount) {
      score += 6;
      reasons.push('자리 여유');
    }

    return { job, score: Math.round(score), reasons: reasons.slice(0, 3) };
  });

  scored.sort((a, b) => b.score - a.score);
  return ok({ items: scored.slice(0, limit), profile });
}
