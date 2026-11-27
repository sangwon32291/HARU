import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { List, Map as MapIcon, Navigation, SlidersHorizontal, X } from 'lucide-react';
import { devSeedJobsNearby, getNearbyJobs } from '@/services/jobs';
import type { JobPostSummary } from '@/types/database';
import {
  JOB_CATEGORY,

  JOB_CATEGORY_LABEL,
  PAY_TYPE_LABEL,
  type JobCategory,
  type PayType,
} from '@/types/enums';
import { useLocationContext } from '@/features/location/LocationContext';
import { HaruMap, type MapMarker } from '@/components/map/HaruMap';
import { JobCard } from '@/components/job/JobCard';
import { Badge, Button, EmptyState, ErrorState, Select, SkeletonList } from '@/components/ui';
import { RADIUS_OPTIONS, REGION_GROUPS } from '@/constants/regions';
import { CategoryIcon } from '@/constants/categoryIcons';
import { addDays, cn, formatPayShort, toDateInput } from '@/lib/format';
import { zoomForRadius } from '@/lib/geo';

type SortKey = 'distance' | 'pay' | 'recent';
type DatePreset = 'all' | 'today' | 'tomorrow' | 'week';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'distance', label: '거리순' },
  { value: 'pay', label: '급여순' },
  { value: 'recent', label: '최신순' },
];

const DATE_OPTIONS: { value: DatePreset; label: string }[] = [
  { value: 'all', label: '전체 날짜' },
  { value: 'today', label: '오늘' },
  { value: 'tomorrow', label: '내일' },
  { value: 'week', label: '이번 주' },
];

function dateRange(preset: DatePreset): { from: string | null; to: string | null } {
  const today = new Date();
  if (preset === 'today') return { from: toDateInput(today), to: toDateInput(today) };
  if (preset === 'tomorrow') {
    const t = toDateInput(addDays(today, 1));
    return { from: t, to: t };
  }
  if (preset === 'week') return { from: toDateInput(today), to: toDateInput(addDays(today, 7)) };
  return { from: null, to: null };
}

export function JobsPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { origin, region, label, source, geoMessage, setRegionByCode, requestCurrentPosition } =
    useLocationContext();

  const keyword = params.get('q') ?? '';
  const category = (params.get('category') as JobCategory | null) ?? null;
  const sort = (params.get('sort') as SortKey) ?? 'distance';
  const datePreset = (params.get('date') as DatePreset) ?? 'all';
  const payType = (params.get('payType') as PayType | null) ?? null;
  const minPay = params.get('minPay') ? Number(params.get('minPay')) : null;
  const radiusM = Number(params.get('radius') ?? 5000);

  const [items, setItems] = useState<JobPostSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'map'>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchText, setSearchText] = useState(keyword);
  const [seeding, setSeeding] = useState(false);
  const devTools = import.meta.env.VITE_ENABLE_DEV_TOOLS === 'true';

  useEffect(() => setSearchText(keyword), [keyword]);

  const patch = (next: Record<string, string | null>) => {
    const merged = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === '') merged.delete(key);
      else merged.set(key, value);
    }
    setParams(merged, { replace: true });
  };

  const load = () => {
    setLoading(true);
    setError(null);
    const { from, to } = dateRange(datePreset);
    getNearbyJobs({
      lat: origin.lat,
      lng: origin.lng,
      radiusM,
      category,
      dateFrom: from,
      dateTo: to,
      payType,
      minPay,
      keyword,
      sort,
      pageSize: 50,
    }).then((res) => {
      if (res.error) {
        setError(res.error.message);
        setItems([]);
      } else {
        setItems(res.data.items);
        setTotal(res.data.total);
      }
      setLoading(false);
    });
  };

  useEffect(load, [
    origin.lat,
    origin.lng,
    radiusM,
    category,
    datePreset,
    payType,
    minPay,
    keyword,
    sort,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSeedNearby = async () => {
    setSeeding(true);
    const res = await devSeedJobsNearby(origin, region.name);
    setSeeding(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    load();
  };

  const markers = useMemo<MapMarker[]>(
    () =>
      items.map((job) => ({
        id: job.id,
        lat: job.lat,
        lng: job.lng,
        label: formatPayShort(job.payAmount),
        tone: selectedId === job.id ? 'selected' : 'default',
      })),
    [items, selectedId],
  );

  const mapZoom = useMemo(() => zoomForRadius(radiusM, origin.lat, 420), [radiusM, origin.lat]);
  const selectedJob = items.find((j) => j.id === selectedId) ?? null;

  const activeFilterCount =
    (category ? 1 : 0) + (datePreset !== 'all' ? 1 : 0) + (payType ? 1 : 0) + (minPay ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* 검색 + 지역 */}
      <div className="flex flex-wrap items-center gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            patch({ q: searchText.trim() || null });
          }}
          className="flex min-w-[220px] flex-1 gap-2"
        >
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="공고 제목·업무 내용 검색"
            aria-label="공고 검색"
            className="h-10 flex-1 rounded-xl border border-haru-border bg-white px-3 text-sm focus:border-haru-primary focus:outline-none"
          />
          <Button type="submit" size="sm" className="h-10 px-4">
            검색
          </Button>
        </form>

        {/* 폭을 바깥 div가 정한다. Select 자체는 w-full이라 className으로는 좁힐 수 없다. */}
        <div className="w-[160px] shrink-0">
        <Select
          value={region.code}
          onChange={(e) => setRegionByCode(e.target.value)}
          aria-label="지역 선택"
          className="h-10"
        >
          {REGION_GROUPS.map((group) => (
            <optgroup key={group.sido} label={group.sido}>
              {group.regions.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.name}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="h-10 shrink-0"
          onClick={requestCurrentPosition}
          icon={<Navigation className="h-4 w-4" aria-hidden />}
        >
          {source === 'gps' ? '현재 위치' : '내 위치'}
        </Button>
      </div>

      {geoMessage && (
        <p className="rounded-lg bg-haru-secondary px-3 py-2 text-xs text-haru-primary-dark">{geoMessage}</p>
      )}

      {/* 필터 바 */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={filterOpen || activeFilterCount > 0 ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setFilterOpen((v) => !v)}
          icon={<SlidersHorizontal className="h-4 w-4" aria-hidden />}
        >
          필터{activeFilterCount > 0 ? ` ${activeFilterCount}` : ''}
        </Button>

        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {DATE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => patch({ date: opt.value === 'all' ? null : opt.value })}
              className={cn(
                'inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-sm font-medium',
                datePreset === opt.value
                  ? 'border-haru-primary bg-haru-primary text-white'
                  : 'border-haru-border bg-white text-haru-sub',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Select
            value={String(radiusM)}
            onChange={(e) => patch({ radius: e.target.value })}
            aria-label="반경"
            className="h-9 w-auto min-w-[112px] text-sm"
          >
            {RADIUS_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                반경 {r.label}
              </option>
            ))}
          </Select>
          <Select
            value={sort}
            onChange={(e) => patch({ sort: e.target.value })}
            aria-label="정렬"
            className="h-9 w-auto min-w-[112px] text-sm"
          >
            {SORT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {filterOpen && (
        <div className="space-y-4 rounded-2xl border border-haru-border bg-white p-4">
          <div>
            <p className="haru-label">직종</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => patch({ category: null })}
                className={cn(
                  'inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-medium',
                  !category ? 'border-haru-primary bg-haru-primary text-white' : 'border-haru-border bg-white text-haru-sub',
                )}
              >
                전체
              </button>
              {JOB_CATEGORY.map((c) => (
                <button
                  key={c}
                  onClick={() => patch({ category: category === c ? null : c })}
                  className={cn(
                    'inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-medium',
                    category === c
                      ? 'border-haru-primary bg-haru-primary text-white'
                      : 'border-haru-border bg-white text-haru-sub',
                  )}
                >
                  <CategoryIcon category={c} /> {JOB_CATEGORY_LABEL[c]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="haru-label">급여 유형</p>
              <div className="flex gap-1.5">
                {(['hourly', 'daily'] as PayType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => patch({ payType: payType === t ? null : t })}
                    className={cn(
                      'inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-medium',
                      payType === t
                        ? 'border-haru-primary bg-haru-primary text-white'
                        : 'border-haru-border bg-white text-haru-sub',
                    )}
                  >
                    {PAY_TYPE_LABEL[t]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="haru-label" htmlFor="minPay">
                최소 금액
              </label>
              <input
                id="minPay"
                type="number"
                inputMode="numeric"
                value={minPay ?? ''}
                onChange={(e) => patch({ minPay: e.target.value || null })}
                placeholder="예: 12000"
                className="h-10 w-full rounded-xl border border-haru-border px-3 text-sm focus:border-haru-primary focus:outline-none"
              />
            </div>
          </div>

          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => patch({ category: null, date: null, payType: null, minPay: null })}
              icon={<X className="h-4 w-4" aria-hidden />}
            >
              필터 초기화
            </Button>
          )}
        </div>
      )}

      {/* 결과 요약 + 뷰 전환 */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-haru-sub">
          <b className="text-haru-text">{label}</b> 기준 반경 {radiusM / 1000}km ·{' '}
          {loading ? '검색 중…' : <>총 <b className="text-haru-text">{total}</b>건</>}
          {category && <Badge tone="primary" className="ml-2">{JOB_CATEGORY_LABEL[category]}</Badge>}
        </p>
        <div className="flex rounded-lg border border-haru-border bg-white p-0.5 lg:hidden">
          <button
            onClick={() => setView('list')}
            className={cn(
              'flex h-9 items-center gap-1 rounded-md px-3.5 text-sm font-medium',
              view === 'list' ? 'bg-haru-primary text-white' : 'text-haru-sub',
            )}
          >
            <List className="h-4 w-4" aria-hidden /> 목록
          </button>
          <button
            onClick={() => setView('map')}
            className={cn(
              'flex h-9 items-center gap-1 rounded-md px-3.5 text-sm font-medium',
              view === 'map' ? 'bg-haru-primary text-white' : 'text-haru-sub',
            )}
          >
            <MapIcon className="h-4 w-4" aria-hidden /> 지도
          </button>
        </div>
      </div>

      {/* 본문: PC는 좌우 분할, 모바일은 탭 전환 */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div className={cn(view === 'map' && 'hidden lg:block')}>
          {loading ? (
            <SkeletonList count={4} />
          ) : error ? (
            <ErrorState message={error} onRetry={load} />
          ) : items.length === 0 ? (
            <EmptyState
              title="조건에 맞는 공고가 없습니다"
              description={
                devTools
                  ? '반경을 넓히거나 필터를 줄여 보세요. 샘플 데이터는 서울 강서구 일대에만 있어, 다른 지역에서는 결과가 비어 있을 수 있습니다.'
                  : '반경을 넓히거나 필터를 줄여 보세요.'
              }
              action={
                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    onClick={() => patch({ category: null, date: null, payType: null, minPay: null, radius: '20000' })}
                  >
                    반경 20km로 다시 찾기
                  </Button>
                  {devTools && (
                    <Button variant="secondary" loading={seeding} onClick={handleSeedNearby}>
                      이 지역에 샘플 공고 만들기
                    </Button>
                  )}
                </div>
              }
            />
          ) : (
            <div className="space-y-3">
              {items.map((job) => (
                <JobCard key={job.id} job={job} highlighted={selectedId === job.id} onHover={setSelectedId} />
              ))}
            </div>
          )}
        </div>

        <div className={cn('lg:sticky lg:top-20 lg:h-[calc(100vh-7rem)]', view === 'list' && 'hidden lg:block')}>
          <div className="relative h-[55vh] lg:h-full">
            <HaruMap
              center={origin}
              zoom={mapZoom}
              markers={markers}
              selectedId={selectedId}
              radiusM={radiusM}
              onMarkerClick={(id) => setSelectedId(id)}
              className="h-full"
            />
            {selectedJob && (
              <div className="absolute inset-x-3 bottom-3 animate-fade-up">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    aria-label="닫기"
                    className="absolute -top-2 right-1 z-10 rounded-full bg-haru-text/80 p-1 text-white"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  <JobCard job={selectedJob} />
                </div>
              </div>
            )}
          </div>
          <p className="mt-2 hidden text-xs text-haru-sub lg:block">
            마커를 누르면 공고 요약이 표시됩니다. 지도는 외부 API 없이 직접 구현했습니다.
          </p>
        </div>
      </div>

      {/* 모바일에서 지도 보기 중 결과가 없을 때 안내 */}
      {view === 'map' && !loading && items.length === 0 && (
        <div className="lg:hidden">
          <Button variant="outline" fullWidth onClick={() => navigate('/jobs')}>
            조건 초기화
          </Button>
        </div>
      )}
    </div>
  );
}
