import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Briefcase, ChevronRight, FileText, LogOut, MessageSquare, Star, UserCog } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { getMyJobs } from '@/services/jobs';
import { getMyApplications, cancelApplication, devForceComplete } from '@/services/applications';
import { getMyReviews, getReviewableApplications, deleteReview } from '@/services/reviews';
import { getCommunityPosts } from '@/services/community';
import type {
  CommunityPostWithAuthor,
  JobApplicationWithRelations,
  JobPostSummary,
  ReviewWithAuthor,
} from '@/types/database';
import {
  APPLICATION_STATUS_LABEL,
  COMMUNITY_CATEGORY_LABEL,
  JOB_STATUS_LABEL,
  type ApplicationStatus,
} from '@/types/enums';
import { useToast } from '@/components/ui/toast';
import { RatingStars } from '@/components/review/RatingStars';
import { Badge, Button, EmptyState, Field, Input, Select, SkeletonList, Tabs, Textarea } from '@/components/ui';
import { PageHeader } from '@/components/layout/AppLayout';
import { REGIONS } from '@/constants/regions';
import { formatPay, formatRelativeTime, formatWorkDate, formatWorkTime } from '@/lib/format';

/* ─────────────────────── 마이페이지 대시보드 ─────────────────────── */

export function MyPage() {
  const { user, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [counts, setCounts] = useState({ jobs: 0, applications: 0, reviewable: 0, reviews: 0 });

  useEffect(() => {
    Promise.all([getMyJobs(), getMyApplications(), getReviewableApplications(), getMyReviews()]).then(
      ([jobs, apps, reviewable, reviews]) => {
        setCounts({
          jobs: jobs.data?.length ?? 0,
          applications: apps.data?.filter((a) => a.status !== 'cancelled').length ?? 0,
          reviewable: reviewable.data?.length ?? 0,
          reviews: reviews.data?.length ?? 0,
        });
      },
    );
  }, []);

  if (!user) return null;

  const MENU = [
    { to: '/my/jobs', label: '등록한 공고', icon: Briefcase, count: counts.jobs },
    { to: '/my/applications', label: '지원 내역', icon: FileText, count: counts.applications },
    { to: '/my/reviews', label: '내 후기', icon: Star, count: counts.reviews, badge: counts.reviewable },
    { to: '/my/posts', label: '작성한 글', icon: MessageSquare },
    { to: '/my/profile', label: '프로필 설정', icon: UserCog },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="마이페이지" />

      <section className="haru-card flex items-center gap-4 p-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-haru-secondary text-lg font-black text-haru-primary-dark">
          {user.nickname.slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-[17px] font-bold">{user.nickname}</p>
            {isAdmin && <Badge tone="danger">관리자</Badge>}
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-haru-sub">
            <RatingStars value={user.ratingAvg} size={14} />
            {user.reviewCount > 0 ? `${user.ratingAvg.toFixed(1)} (후기 ${user.reviewCount}건)` : '받은 후기 없음'}
          </p>
        </div>
        <Link to="/my/profile">
          <Button variant="outline" size="sm">
            편집
          </Button>
        </Link>
      </section>

      {counts.reviewable > 0 && (
        <Link to="/my/reviews" className="block">
          <div className="flex items-center justify-between rounded-2xl bg-haru-primary px-5 py-4 text-white shadow-card">
            <div>
              <p className="text-sm font-bold">작성 가능한 후기가 {counts.reviewable}건 있습니다</p>
              <p className="mt-1 text-xs text-white/85">근무가 완료된 일자리에 후기를 남겨주세요</p>
            </div>
            <ChevronRight className="h-5 w-5" aria-hidden />
          </div>
        </Link>
      )}

      <section className="divide-y divide-haru-border overflow-hidden rounded-2xl border border-haru-border bg-white">
        {MENU.map((item) => (
          <Link key={item.to} to={item.to} className="flex items-center gap-3 px-5 py-4 hover:bg-haru-bg">
            <item.icon className="h-5 w-5 text-haru-primary" aria-hidden />
            <span className="flex-1 text-sm font-semibold">{item.label}</span>
            {item.badge ? <Badge tone="warn">{item.badge}</Badge> : null}
            {item.count !== undefined && <span className="text-sm text-haru-sub">{item.count}</span>}
            <ChevronRight className="h-4 w-4 text-haru-sub" aria-hidden />
          </Link>
        ))}
        {isAdmin && (
          <Link to="/admin" className="flex items-center gap-3 px-5 py-4 hover:bg-haru-bg">
            <UserCog className="h-5 w-5 text-haru-danger" aria-hidden />
            <span className="flex-1 text-sm font-semibold">관리자 페이지</span>
            <ChevronRight className="h-4 w-4 text-haru-sub" aria-hidden />
          </Link>
        )}
      </section>

      <Button
        variant="outline"
        fullWidth
        icon={<LogOut className="h-4 w-4" aria-hidden />}
        onClick={async () => {
          await signOut();
          navigate('/');
        }}
      >
        로그아웃
      </Button>
    </div>
  );
}

/* ─────────────────────── 프로필 설정 ─────────────────────── */

export function MyProfilePage() {
  const { user, updateProfile } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({
    nickname: user?.nickname ?? '',
    phone: user?.phone ?? '',
    bio: user?.bio ?? '',
    regionCode: user?.regionCode ?? '11500',
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const region = REGIONS.find((r) => r.code === form.regionCode);
    const res = await updateProfile({
      nickname: form.nickname,
      phone: form.phone,
      bio: form.bio,
      regionCode: form.regionCode,
      baseLat: region?.lat ?? null,
      baseLng: region?.lng ?? null,
    });
    setSaving(false);
    if (res.error) setError(res.error.message);
    else toast('프로필을 저장했습니다.', 'success');
  };

  return (
    <form onSubmit={submit} className="mx-auto max-w-xl space-y-5">
      <PageHeader title="프로필 설정" backTo="/my" />
      <section className="haru-card space-y-4 p-4">
        <Field label="닉네임" required hint="2~12자" htmlFor="p-nickname">
          <Input id="p-nickname" value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} required />
        </Field>
        <Field label="연락처" hint="다른 사용자에게 공개되지 않습니다." htmlFor="p-phone">
          <Input id="p-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label="한 줄 소개" hint="최대 200자" htmlFor="p-bio">
          <Textarea id="p-bio" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} className="min-h-[90px]" />
        </Field>
        <Field label="활동 지역" hint="일자리 탐색의 기본 기준점이 됩니다." error={error} htmlFor="p-region">
          <Select id="p-region" value={form.regionCode} onChange={(e) => setForm({ ...form, regionCode: e.target.value })}>
            {REGIONS.map((r) => (
              <option key={r.code} value={r.code}>
                {r.sido} {r.name}
              </option>
            ))}
          </Select>
        </Field>
      </section>
      <Button type="submit" fullWidth size="lg" loading={saving}>
        저장
      </Button>
    </form>
  );
}

/* ─────────────────────── 등록한 공고 ─────────────────────── */

export function MyJobsPage() {
  const [jobs, setJobs] = useState<JobPostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | 'open' | 'closed'>('all');

  useEffect(() => {
    getMyJobs().then((res) => {
      setJobs(res.data ?? []);
      setLoading(false);
    });
  }, []);

  const filtered = jobs.filter((j) => (tab === 'all' ? true : tab === 'open' ? j.status === 'open' : j.status !== 'open'));

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader
        title="등록한 공고"
        backTo="/my"
        action={
          <Link to="/jobs/new">
            <Button size="sm">새 공고</Button>
          </Link>
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'all', label: '전체', count: jobs.length },
          { value: 'open', label: '모집중', count: jobs.filter((j) => j.status === 'open').length },
          { value: 'closed', label: '마감', count: jobs.filter((j) => j.status !== 'open').length },
        ]}
      />

      {loading ? (
        <SkeletonList />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="등록한 공고가 없습니다"
          description="첫 공고를 올리고 지원자를 받아보세요."
          action={
            <Link to="/jobs/new">
              <Button>공고 등록하기</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((job) => (
            <div key={job.id} className="haru-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-1 flex items-center gap-1.5">
                    <Badge tone={job.status === 'open' ? 'success' : 'neutral'}>{JOB_STATUS_LABEL[job.status]}</Badge>
                    <span className="text-xs text-haru-sub">{formatWorkDate(job.workDate)}</span>
                  </div>
                  <Link to={`/jobs/${job.id}`} className="block truncate text-[15px] font-bold hover:underline">
                    {job.title}
                  </Link>
                  <p className="mt-1 text-sm text-haru-sub">
                    {formatPay(job.payType, job.payAmount)} · {formatWorkTime(job.startTime, job.endTime)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-haru-sub">지원자</p>
                  <p className="text-[20px] font-black text-haru-primary">{job.applicantCount}</p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Link to={`/my/jobs/${job.id}/applicants`} className="flex-1">
                  <Button variant="secondary" size="sm" fullWidth>
                    지원자 관리
                  </Button>
                </Link>
                <Link to={`/jobs/${job.id}/edit`} className="flex-1">
                  <Button variant="outline" size="sm" fullWidth>
                    수정
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────── 지원 내역 ─────────────────────── */

const APPLICATION_TABS: { value: ApplicationStatus | 'all'; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'pending', label: '대기중' },
  { value: 'accepted', label: '승인됨' },
  { value: 'completed', label: '근무완료' },
  { value: 'rejected', label: '거절됨' },
  { value: 'cancelled', label: '취소됨' },
];

export function MyApplicationsPage() {
  const [items, setItems] = useState<JobApplicationWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<ApplicationStatus | 'all'>('all');
  const { toast } = useToast();
  const devTools = import.meta.env.VITE_ENABLE_DEV_TOOLS === 'true';

  const load = () => {
    setLoading(true);
    getMyApplications().then((res) => {
      setItems(res.data ?? []);
      setLoading(false);
    });
  };
  useEffect(load, []);

  const filtered = items.filter((a) => (tab === 'all' ? true : a.status === tab));

  const handleCancel = async (id: string) => {
    const res = await cancelApplication(id);
    if (res.error) toast(res.error.message, 'error');
    else {
      toast('지원을 취소했습니다.');
      load();
    }
  };

  const handleDevComplete = async (id: string) => {
    const res = await devForceComplete(id);
    if (res.error) toast(res.error.message, 'error');
    else {
      toast('개발 모드: 근무 완료 처리했습니다.');
      load();
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="지원 내역" backTo="/my" />
      <Tabs
        value={tab}
        onChange={setTab}
        items={APPLICATION_TABS.map((t) => ({
          ...t,
          count: t.value === 'all' ? items.length : items.filter((a) => a.status === t.value).length,
        }))}
      />

      {loading ? (
        <SkeletonList />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="지원 내역이 없습니다"
          description="주변 일자리를 둘러보고 지원해 보세요."
          action={
            <Link to="/jobs">
              <Button>일자리 보러 가기</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((app) => (
            <div key={app.id} className="haru-card p-4">
              <div className="mb-2 flex items-center gap-2">
                <Badge
                  tone={
                    app.status === 'accepted'
                      ? 'success'
                      : app.status === 'completed'
                        ? 'primary'
                        : app.status === 'rejected'
                          ? 'danger'
                          : 'neutral'
                  }
                >
                  {APPLICATION_STATUS_LABEL[app.status]}
                </Badge>
                <span className="text-xs text-haru-sub">{formatRelativeTime(app.appliedAt)} 지원</span>
              </div>
              <Link to={`/jobs/${app.jobPost.id}`} className="block truncate font-bold hover:underline">
                {app.jobPost.title}
              </Link>
              <p className="mt-1 text-sm text-haru-sub">
                {app.jobPost.companyName} · {formatWorkDate(app.jobPost.workDate)} ·{' '}
                {formatPay(app.jobPost.payType, app.jobPost.payAmount)}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {app.status === 'pending' && (
                  <Button variant="outline" size="sm" onClick={() => handleCancel(app.id)}>
                    지원 취소
                  </Button>
                )}
                {app.status === 'completed' &&
                  (app.hasReview ? (
                    <Badge tone="primary">후기 작성 완료</Badge>
                  ) : (
                    <Link to={`/reviews/new?applicationId=${app.id}`}>
                      <Button size="sm">후기 작성</Button>
                    </Link>
                  ))}
                {devTools && app.status === 'accepted' && (
                  <Button variant="ghost" size="sm" onClick={() => handleDevComplete(app.id)}>
                    [개발용] 근무 완료 처리
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {devTools && (
        <p className="rounded-xl border border-dashed border-haru-border bg-white/70 px-4 py-3 text-xs leading-relaxed text-haru-sub">
          [개발용] 표시가 붙은 버튼은 후기 작성 흐름을 테스트하기 위한 기능으로, 환경 변수
          <code className="mx-1 rounded bg-haru-bg px-1">VITE_ENABLE_DEV_TOOLS</code>가 true일 때만 보입니다. 실제
          서비스에서는 구인자만 근무 완료를 처리할 수 있습니다.
        </p>
      )}
    </div>
  );
}

/* ─────────────────────── 내 후기 ─────────────────────── */

export function MyReviewsPage() {
  const [reviewable, setReviewable] = useState<JobApplicationWithRelations[]>([]);
  const [reviews, setReviews] = useState<ReviewWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const load = () => {
    setLoading(true);
    Promise.all([getReviewableApplications(), getMyReviews()]).then(([a, r]) => {
      setReviewable(a.data ?? []);
      setReviews(r.data ?? []);
      setLoading(false);
    });
  };
  useEffect(load, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm('후기를 삭제하시겠습니까?')) return;
    const res = await deleteReview(id);
    if (res.error) toast(res.error.message, 'error');
    else {
      toast('후기를 삭제했습니다.');
      load();
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="내 후기" backTo="/my" description="근무가 확인된 일자리에만 후기를 쓸 수 있습니다" />

      {loading ? (
        <SkeletonList />
      ) : (
        <>
          <section>
            <h2 className="mb-2 text-sm font-bold">작성 가능한 후기 {reviewable.length}건</h2>
            {reviewable.length === 0 ? (
              <p className="rounded-xl border border-dashed border-haru-border bg-white/60 px-4 py-6 text-center text-sm text-haru-sub">
                현재 작성 가능한 후기가 없습니다.
              </p>
            ) : (
              <div className="space-y-2">
                {reviewable.map((app) => (
                  <div key={app.id} className="flex items-center gap-3 rounded-xl border border-haru-border bg-white p-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{app.jobPost.title}</p>
                      <p className="mt-1 text-xs text-haru-sub">
                        {app.jobPost.companyName} · {formatWorkDate(app.jobPost.workDate)}
                      </p>
                    </div>
                    <Link to={`/reviews/new?applicationId=${app.id}`}>
                      <Button size="sm">작성</Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-sm font-bold">작성한 후기 {reviews.length}건</h2>
            {reviews.length === 0 ? (
              <EmptyState title="작성한 후기가 없습니다" description="근무를 마친 뒤 첫 후기를 남겨보세요." />
            ) : (
              <div className="space-y-3">
                {reviews.map((review) => (
                  <div key={review.id} className="haru-card p-4">
                    <div className="flex items-center justify-between">
                      <p className="truncate text-sm font-bold">{review.companyName}</p>
                      <RatingStars value={review.ratingOverall} size={14} />
                    </div>
                    <p className="mt-1 text-xs text-haru-sub">{review.jobTitle}</p>
                    <p className="mt-2 text-sm leading-relaxed">{review.content}</p>
                    <div className="mt-3 flex items-center gap-2">
                      <Link to={`/reviews/new?applicationId=${review.applicationId}`}>
                        <Button variant="outline" size="sm">
                          수정
                        </Button>
                      </Link>
                      <Button variant="danger" size="sm" onClick={() => handleDelete(review.id)}>
                        삭제
                      </Button>
                      <span className="ml-auto text-xs text-haru-sub">{formatRelativeTime(review.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

/* ─────────────────────── 작성한 글 ─────────────────────── */

export function MyPostsPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<CommunityPostWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getCommunityPosts({ authorId: user.id }).then((res) => {
      setPosts(res.data ?? []);
      setLoading(false);
    });
  }, [user]);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="작성한 글" backTo="/my" />
      {loading ? (
        <SkeletonList />
      ) : posts.length === 0 ? (
        <EmptyState
          title="작성한 글이 없습니다"
          action={
            <Link to="/community/new">
              <Button>글 쓰러 가기</Button>
            </Link>
          }
        />
      ) : (
        <div className="divide-y divide-haru-border overflow-hidden rounded-2xl border border-haru-border bg-white">
          {posts.map((post) => (
            <Link key={post.id} to={`/community/${post.id}`} className="block px-4 py-3 hover:bg-haru-bg">
              <div className="flex items-center gap-2">
                <Badge tone="primary">{COMMUNITY_CATEGORY_LABEL[post.category]}</Badge>
                <p className="truncate text-sm font-semibold">{post.title}</p>
              </div>
              <p className="mt-1 text-xs text-haru-sub">
                {formatRelativeTime(post.createdAt)} · 댓글 {post.commentCount} · 좋아요 {post.likeCount}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
