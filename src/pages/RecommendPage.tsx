import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { getRecommendedJobs, type RecommendResult } from '@/services/recommend';
import { JOB_CATEGORY_LABEL } from '@/types/enums';
import { useLocationContext } from '@/features/location/LocationContext';
import { useAuth } from '@/features/auth/AuthContext';
import { JobCard } from '@/components/job/JobCard';
import { CategoryIcon } from '@/constants/categoryIcons';
import { Badge, Button, EmptyState, ErrorState, SkeletonList } from '@/components/ui';
import { PageHeader } from '@/components/layout/AppLayout';
import { formatKRW, formatPay, formatWorkDateShort, formatWorkTime } from '@/lib/format';
import { formatDistance } from '@/lib/geo';

/**
 * 맞춤 추천 화면.
 *
 * 구직자(= 등록한 공고가 없는 계정)의 FAB 자리에서 들어온다.
 * 지난 지원·근무 이력에서 뽑은 선호를 근거로 공고를 점수순으로 보여주고,
 * 1순위는 '바로 지원하기'로 공고 상세의 지원 모달까지 한 번에 연결한다.
 */
export function RecommendPage() {
  const { origin, label } = useLocationContext();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState<RecommendResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    getRecommendedJobs(origin, 6).then((res) => {
      if (res.error) setError(res.error.message);
      else setData(res.data);
      setLoading(false);
    });
  };

  useEffect(load, [origin.lat, origin.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <SkeletonList count={3} />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const top = data?.items[0];
  const rest = data?.items.slice(1) ?? [];
  const profile = data?.profile ?? null;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        title="맞춤 일자리 추천"
        description={`${label} 기준 · ${user?.nickname ?? ''}님의 지난 기록을 반영했습니다`}
        backTo="/"
      />

      {/* 추천 근거 요약 — 추천이 어떻게 계산됐는지 숨기지 않는다 */}
      <section className="haru-card p-4">
        <p className="flex items-center gap-1.5 text-sm font-bold">
          <Sparkles className="h-4 w-4 text-haru-primary" aria-hidden />
          추천 기준
        </p>
        {profile ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone="neutral">지원·근무 {profile.historyCount}건 분석</Badge>
            {profile.topCategories.map((c) => (
              <Badge key={c} tone="primary">
                <CategoryIcon category={c} /> {JOB_CATEGORY_LABEL[c]}
              </Badge>
            ))}
            {profile.avgHourlyPay && (
              <Badge tone="neutral">평소 시급 {formatKRW(profile.avgHourlyPay)}</Badge>
            )}
            {profile.prefersEarly && <Badge tone="neutral">이른 시간대 선호</Badge>}
          </div>
        ) : (
          <p className="mt-2 text-sm leading-relaxed text-haru-sub">
            아직 지원 이력이 없어 <b className="text-haru-text">거리·급여·업체 평점</b>을 기준으로 골랐습니다.
            한 번 지원하고 나면 그 기록을 반영해 더 정확해집니다.
          </p>
        )}
      </section>

      {!top ? (
        <EmptyState
          title="추천할 공고가 없습니다"
          description="주변에 모집 중인 공고가 없습니다. 지역을 바꾸거나 반경을 넓혀 보세요."
          action={
            <Link to="/jobs">
              <Button>주변 일자리 둘러보기</Button>
            </Link>
          }
        />
      ) : (
        <>
          {/* 1순위 */}
          <section>
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-6 items-center rounded-full bg-haru-primary px-2.5 text-xs font-bold text-white">
                1순위 추천
              </span>
              <span className="text-xs text-haru-sub">적합도 {top.score}점</span>
            </div>

            <div className="overflow-hidden rounded-2xl border-2 border-haru-primary bg-white shadow-float">
              <div className="p-5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone="primary">
                    <CategoryIcon category={top.job.category} /> {JOB_CATEGORY_LABEL[top.job.category]}
                  </Badge>
                  {top.reasons.map((r) => (
                    <Badge key={r} tone="success">{r}</Badge>
                  ))}
                </div>

                <h2 className="mt-3 text-[17px] font-bold leading-snug">{top.job.title}</h2>
                <p className="mt-1 text-sm text-haru-sub">{top.job.companyName}</p>

                <p className="mt-3 text-[22px] font-black text-haru-primary-dark">
                  {formatPay(top.job.payType, top.job.payAmount)}
                </p>
                <p className="mt-1 text-sm text-haru-sub">
                  {formatWorkDateShort(top.job.workDate)} · {formatWorkTime(top.job.startTime, top.job.endTime)}
                  {' · '}
                  {top.job.placeName}
                  {top.job.distanceM > 0 && (
                    <span className="font-semibold text-haru-primary">
                      {' '}
                      · {formatDistance(top.job.distanceM)}
                    </span>
                  )}
                </p>
              </div>

              <div className="flex gap-2 border-t border-haru-border bg-haru-bg p-4">
                <Button
                  variant="outline"
                  fullWidth
                  onClick={() => navigate(`/jobs/${top.job.id}`)}
                >
                  상세 보기
                </Button>
                {/* ?apply=1 로 들어가면 공고 상세에서 지원 모달이 바로 열린다 */}
                <Button
                  fullWidth
                  size="lg"
                  icon={<ArrowRight className="h-4 w-4" aria-hidden />}
                  onClick={() => navigate(`/jobs/${top.job.id}?apply=1`)}
                >
                  바로 지원하기
                </Button>
              </div>
            </div>
          </section>

          {/* 나머지 추천 */}
          {rest.length > 0 && (
            <section>
              <h2 className="mb-2 text-[17px] font-bold">이런 일자리도 맞을 것 같습니다</h2>
              <div className="space-y-3">
                {rest.map((r) => (
                  <div key={r.job.id}>
                    <JobCard job={r.job} />
                    {r.reasons.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1.5 px-1">
                        {r.reasons.map((reason) => (
                          <span key={reason} className="text-xs text-haru-sub">
                            · {reason}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <p className="rounded-xl border border-dashed border-haru-border bg-white/70 px-4 py-3 text-xs leading-relaxed text-haru-sub">
        추천은 거리·선호 직종·급여·업체 평점·시간대를 점수로 더해 정렬한 결과입니다. AI 모델을 쓰지 않으며,
        계산 근거는 위 배지에 그대로 표시됩니다.
      </p>
    </div>
  );
}
