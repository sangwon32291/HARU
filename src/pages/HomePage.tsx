import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, MapPin, Navigation, Search, Sparkles } from 'lucide-react';
import { getFeaturedJobs, getNearbyJobs } from '@/services/jobs';
import { getRecentReviews } from '@/services/reviews';
import { getCommunityPosts } from '@/services/community';
import type { CommunityPostWithAuthor, JobPostSummary, ReviewWithAuthor } from '@/types/database';
import { JOB_CATEGORY, JOB_CATEGORY_LABEL, COMMUNITY_CATEGORY_LABEL } from '@/types/enums';
import { CategoryIcon } from '@/constants/categoryIcons';
import { useLocationContext } from '@/features/location/LocationContext';
import { JobCard } from '@/components/job/JobCard';
import { RatingStars } from '@/components/review/RatingStars';
import { Badge, Button, SectionHeader, SkeletonList } from '@/components/ui';
import { REGION_GROUPS } from '@/constants/regions';
import { formatRelativeTime } from '@/lib/format';

export function HomePage() {
  const { origin, region, label, source, geoStatus, geoMessage, setRegionByCode, requestCurrentPosition } =
    useLocationContext();
  const navigate = useNavigate();

  const [featured, setFeatured] = useState<JobPostSummary[]>([]);
  const [nearby, setNearby] = useState<JobPostSummary[]>([]);
  const [reviews, setReviews] = useState<ReviewWithAuthor[]>([]);
  const [posts, setPosts] = useState<CommunityPostWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      getFeaturedJobs(origin, 6),
      getNearbyJobs({ ...origin, radiusM: 5000, sort: 'distance', pageSize: 5 }),
      getRecentReviews(3),
      getCommunityPosts({ limit: 4 }),
    ]).then(([f, n, r, p]) => {
      if (!alive) return;
      setFeatured(f.data ?? []);
      setNearby(n.data?.items ?? []);
      setReviews(r.data ?? []);
      setPosts(p.data ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [origin.lat, origin.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-8">
      {/* 히어로 + 지역 선택 + 검색 */}
      {/*
        데스크톱에서는 2단으로 나눈다. 한 단으로 두면 오른쪽 절반이 빈 채로 남아
        화면이 허전해 보인다. 모바일에서는 그대로 세로로 쌓인다.
      */}
      <section className="grid gap-5 rounded-2xl bg-gradient-to-br from-haru-primary to-haru-primary-light px-5 py-6 text-white shadow-card md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:items-center md:gap-8 md:px-7 md:py-7">
        <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-white/75">HARU</p>
        <h1 className="mt-1 text-[22px] font-black leading-snug md:text-[26px]">
          내 주변의 하루 일자리,
          <br />
          믿을 수 있는 후기와 함께
        </h1>
        </div>

        <div className="md:space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/80" aria-hidden />
            <select
              value={region.code}
              onChange={(e) => setRegionByCode(e.target.value)}
              aria-label="지역 선택"
              className="h-10 appearance-none rounded-xl border border-white/30 bg-white/15 pl-9 pr-8 text-sm font-semibold text-white backdrop-blur focus:outline-none focus:ring-2 focus:ring-white/50"
            >
              {REGION_GROUPS.map((group) => (
                <optgroup key={group.sido} label={group.sido} className="text-haru-text">
                  {group.regions.map((r) => (
                    <option key={r.code} value={r.code} className="text-haru-text">
                      {r.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <Button
            variant="secondary"
            size="md"
            onClick={requestCurrentPosition}
            loading={geoStatus === 'loading'}
            icon={<Navigation className="h-4 w-4" aria-hidden />}
            className="bg-white/15 text-white hover:bg-white/25"
          >
            {source === 'gps' ? '현재 위치 사용 중' : '현재 위치로'}
          </Button>
        </div>
        {geoMessage && <p className="mt-2 text-xs text-white/85">{geoMessage}</p>}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            navigate(keyword.trim() ? `/jobs?q=${encodeURIComponent(keyword.trim())}` : '/jobs');
          }}
          className="relative mt-3 md:mt-0"
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-haru-sub" aria-hidden />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="어떤 일을 찾으세요?"
            aria-label="일자리 검색"
            className="h-12 w-full rounded-xl bg-white pl-10 pr-24 text-sm text-haru-text placeholder:text-haru-sub focus:outline-none focus:ring-2 focus:ring-white/60"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 h-9 -translate-y-1/2 rounded-lg bg-haru-primary px-4 text-sm font-bold text-white"
          >
            검색
          </button>
        </form>
        </div>
      </section>

      {/* 직종 카테고리 */}
      <section>
        <SectionHeader title="직종별로 찾기" />
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-11">
          {JOB_CATEGORY.map((category) => (
            <Link
              key={category}
              to={`/jobs?category=${category}`}
              className="group flex flex-col items-center gap-2 rounded-xl border border-haru-border bg-white px-1 py-3 text-center transition-colors hover:border-haru-primary/50 hover:bg-haru-secondary/40"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-haru-secondary text-haru-primary-dark transition-colors group-hover:bg-white">
                <CategoryIcon category={category} className="h-[18px] w-[18px]" />
              </span>
              <span className="text-xs font-semibold leading-tight text-haru-text">
                {JOB_CATEGORY_LABEL[category]}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* 오늘의 추천 */}
      <section>
        <SectionHeader
          title="오늘의 추천 일자리"
          description="급여와 업체 평점을 함께 고려해 정렬했습니다"
          action={
            <Link to="/jobs?sort=pay" className="flex items-center text-sm font-semibold text-haru-primary">
              더보기 <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          }
        />
        {loading ? (
          <SkeletonList count={2} />
        ) : featured.length === 0 ? (
          <p className="rounded-xl border border-dashed border-haru-border bg-white/60 px-4 py-6 text-center text-sm text-haru-sub">
            아직 등록된 공고가 없습니다.
          </p>
        ) : (
          <div className="no-scrollbar -mx-4 flex items-stretch gap-3 overflow-x-auto px-4 pb-1">
            {featured.map((job) => (
              <div key={job.id} className="w-[320px] shrink-0">
                <JobCard job={job} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 내 주변 */}
      <section>
        <SectionHeader
          title={`${label} 주변 일자리`}
          description={source === 'gps' ? '현재 위치 기준 5km 이내' : '선택한 지역 기준 5km 이내'}
          action={
            <Link to="/jobs" className="flex items-center text-sm font-semibold text-haru-primary">
              지도로 보기 <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          }
        />
        {loading ? (
          <SkeletonList count={3} />
        ) : nearby.length === 0 ? (
          <div className="rounded-xl border border-dashed border-haru-border bg-white/60 px-4 py-6 text-center">
            <p className="text-sm text-haru-sub">이 지역 반경 5km 내에 모집 중인 공고가 없습니다.</p>
            <Link to="/jobs" className="mt-3 inline-block">
              <Button variant="outline" size="sm">
                반경 넓혀서 찾아보기
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {nearby.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-9 lg:grid-cols-2">
        {/* 최근 후기 */}
        <section>
          <SectionHeader
            title="최근 근무 후기"
            description="실제 근무가 확인된 사용자만 작성할 수 있습니다"
            action={<Sparkles className="h-4 w-4 text-haru-primary" aria-hidden />}
          />
          <div className="space-y-3">
            {reviews.length === 0 && !loading && (
              <p className="rounded-xl border border-dashed border-haru-border bg-white/60 px-4 py-6 text-center text-sm text-haru-sub">
                아직 등록된 후기가 없습니다.
              </p>
            )}
            {reviews.map((review) => (
              <Link
                key={review.id}
                to={`/employers/${review.employerId}/reviews`}
                className="block rounded-2xl border border-haru-border bg-white p-4 shadow-card transition-colors hover:border-haru-primary/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-bold">{review.companyName}</p>
                  <RatingStars value={review.ratingOverall} size={14} />
                </div>
                <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-haru-sub">{review.content}</p>
                <p className="mt-2 text-xs text-haru-sub/80">
                  {review.reviewer.nickname} · {formatRelativeTime(review.createdAt)}
                </p>
              </Link>
            ))}
          </div>
        </section>

        {/* 커뮤니티 */}
        <section>
          <SectionHeader
            title="커뮤니티 최신 글"
            action={
              <Link to="/community" className="flex items-center text-sm font-semibold text-haru-primary">
                더보기 <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
            }
          />
          <div className="divide-y divide-haru-border overflow-hidden rounded-2xl border border-haru-border bg-white">
            {posts.length === 0 && !loading && (
              <p className="px-4 py-6 text-center text-sm text-haru-sub">아직 게시글이 없습니다.</p>
            )}
            {posts.map((post) => (
              <Link key={post.id} to={`/community/${post.id}`} className="block px-4 py-3 hover:bg-haru-bg">
                <div className="flex items-center gap-2">
                  <Badge tone={post.category === 'caution' ? 'danger' : 'primary'}>
                    {COMMUNITY_CATEGORY_LABEL[post.category]}
                  </Badge>
                  <p className="truncate text-sm font-semibold">{post.title}</p>
                </div>
                <p className="mt-1 text-xs text-haru-sub">
                  {post.author.nickname} · {formatRelativeTime(post.createdAt)} · 댓글 {post.commentCount}
                </p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
