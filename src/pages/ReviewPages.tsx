import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ThumbsUp } from 'lucide-react';
import {
  createReview,
  getEmployerRating,
  getEmployerReviews,
  getReviewByApplication,
  updateReview,
} from '@/services/reviews';
import { getMyApplications } from '@/services/applications';
import { createReport, REPORT_REASONS } from '@/services/reports';
import type { EmployerRatingSummary, JobApplicationWithRelations, ReviewWithAuthor } from '@/types/database';
import { useAuth } from '@/features/auth/AuthContext';
import { useToast } from '@/components/ui/toast';
import { RatingInput, RatingStars } from '@/components/review/RatingStars';
import { Badge, Button, EmptyState, ErrorState, Modal, Select, Spinner, Textarea } from '@/components/ui';
import { PageHeader } from '@/components/layout/AppLayout';
import { formatRelativeTime, formatWorkDate } from '@/lib/format';

/* ─────────────────────── 후기 작성/수정 ─────────────────────── */

const CRITERIA = [
  { key: 'ratingPay', label: '급여 지급', description: '약속한 금액과 날짜를 지켰나요?' },
  { key: 'ratingWorkload', label: '업무 강도', description: '감당할 만한 강도였나요?' },
  { key: 'ratingEnvironment', label: '근무 환경', description: '안전하고 쾌적했나요?' },
  { key: 'ratingAccuracy', label: '공고 일치도', description: '공고 내용과 실제 업무가 같았나요?' },
] as const;

export function ReviewFormPage() {
  const [params] = useSearchParams();
  const applicationId = params.get('applicationId') ?? '';
  const navigate = useNavigate();
  const { toast } = useToast();

  const [application, setApplication] = useState<JobApplicationWithRelations | null>(null);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    ratingPay: 0,
    ratingWorkload: 0,
    ratingEnvironment: 0,
    ratingAccuracy: 0,
    wouldWorkAgain: true,
    content: '',
  });

  useEffect(() => {
    if (!applicationId) {
      setError('잘못된 접근입니다. 지원 내역에서 후기를 작성해 주세요.');
      setLoading(false);
      return;
    }
    Promise.all([getMyApplications(), getReviewByApplication(applicationId)]).then(([apps, review]) => {
      const found = apps.data?.find((a) => a.id === applicationId) ?? null;
      if (!found) {
        setError('본인의 지원 내역에서만 후기를 작성할 수 있습니다.');
      } else if (found.status !== 'completed') {
        setError('근무가 완료된 일자리에만 후기를 작성할 수 있습니다.');
      }
      setApplication(found);
      if (review.data) {
        setExistingId(review.data.id);
        setForm({
          ratingPay: review.data.ratingPay,
          ratingWorkload: review.data.ratingWorkload,
          ratingEnvironment: review.data.ratingEnvironment,
          ratingAccuracy: review.data.ratingAccuracy,
          wouldWorkAgain: review.data.wouldWorkAgain,
          content: review.data.content,
        });
      }
      setLoading(false);
    });
  }, [applicationId]);

  if (loading) return <Spinner label="지원 정보를 확인하는 중" />;
  if (error || !application) {
    return (
      <div className="mx-auto max-w-xl">
        <ErrorState message={error ?? '지원 정보를 찾을 수 없습니다.'} />
        <Link to="/my/applications" className="mt-4 block">
          <Button variant="outline" fullWidth>
            지원 내역으로 이동
          </Button>
        </Link>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const res = existingId
      ? await updateReview(existingId, form)
      : await createReview({ applicationId, ...form });
    setSubmitting(false);
    if (res.error) {
      toast(res.error.message, 'error');
      return;
    }
    toast(existingId ? '후기를 수정했습니다.' : '후기를 등록했습니다.', 'success');
    navigate('/my/reviews');
  };

  return (
    <form onSubmit={submit} className="mx-auto max-w-xl space-y-5">
      <PageHeader
        title={existingId ? '후기 수정' : '근무 후기 작성'}
        backTo="/my/reviews"
        description="솔직한 후기가 다른 구직자에게 큰 도움이 됩니다"
      />

      <section className="haru-card p-4">
        <p className="text-sm font-bold">{application.jobPost.title}</p>
        <p className="mt-1 text-sm text-haru-sub">
          {application.jobPost.companyName} · {formatWorkDate(application.jobPost.workDate)}
        </p>
      </section>

      <section className="space-y-2">
        {CRITERIA.map((c) => (
          <RatingInput
            key={c.key}
            label={c.label}
            description={c.description}
            value={form[c.key]}
            onChange={(next) => setForm((prev) => ({ ...prev, [c.key]: next }))}
          />
        ))}
      </section>

      <section className="haru-card p-4">
        <p className="mb-2 text-sm font-semibold">또 일하실 의향이 있나요?</p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={form.wouldWorkAgain ? 'primary' : 'outline'}
            fullWidth
            onClick={() => setForm({ ...form, wouldWorkAgain: true })}
            icon={<ThumbsUp className="h-4 w-4" aria-hidden />}
          >
            다시 일하고 싶어요
          </Button>
          <Button
            type="button"
            variant={!form.wouldWorkAgain ? 'danger' : 'outline'}
            fullWidth
            onClick={() => setForm({ ...form, wouldWorkAgain: false })}
          >
            추천하지 않아요
          </Button>
        </div>
      </section>

      <section className="haru-card p-4">
        <label className="haru-label" htmlFor="review-content">
          상세 후기 <span className="text-haru-danger">*</span>
        </label>
        <Textarea
          id="review-content"
          value={form.content}
          onChange={(e) => setForm({ ...form, content: e.target.value })}
          placeholder="실제 업무, 담당자 응대, 급여 지급 등 겪은 사실을 적어주세요. (10자 이상)"
          required
        />
        <p className="haru-hint">
          허위 사실 단정, 개인정보 노출, 욕설은 신고 대상이 될 수 있습니다. 겪은 사실 위주로 작성해 주세요.
        </p>
      </section>

      <div className="flex gap-2 pb-6">
        <Button type="button" variant="outline" fullWidth onClick={() => navigate(-1)}>
          취소
        </Button>
        <Button type="submit" fullWidth size="lg" loading={submitting}>
          {existingId ? '수정 완료' : '후기 등록'}
        </Button>
      </div>
    </form>
  );
}

/* ─────────────────────── 업체 후기 목록 ─────────────────────── */

export function EmployerReviewsPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [summary, setSummary] = useState<EmployerRatingSummary | null>(null);
  const [reviews, setReviews] = useState<ReviewWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportTarget, setReportTarget] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);

  useEffect(() => {
    Promise.all([getEmployerRating(id), getEmployerReviews(id)]).then(([s, r]) => {
      setSummary(s.data);
      setReviews(r.data ?? []);
      setLoading(false);
    });
  }, [id]);

  const handleReport = async () => {
    if (!reportTarget) return;
    const res = await createReport({ targetType: 'review', targetId: reportTarget, reason: reportReason });
    if (res.error) toast(res.error.message, 'error');
    else toast('신고가 접수되었습니다.', 'success');
    setReportTarget(null);
  };

  if (loading) return <Spinner label="후기를 불러오는 중" />;
  if (!summary) return <ErrorState message="업체 정보를 찾을 수 없습니다." />;

  const BREAKDOWN = [
    { label: '급여 지급', value: summary.breakdown.pay },
    { label: '업무 강도', value: summary.breakdown.workload },
    { label: '근무 환경', value: summary.breakdown.environment },
    { label: '공고 일치도', value: summary.breakdown.accuracy },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title={summary.companyName} backTo="" description="실제 근무가 확인된 사용자의 후기만 모았습니다" />

      <section className="haru-card p-4">
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="text-4xl font-black text-haru-primary-dark">
              {summary.reviewCount > 0 ? summary.ratingAvg.toFixed(1) : '-'}
            </p>
            <RatingStars value={summary.ratingAvg} size={14} />
            <p className="mt-1 text-xs text-haru-sub">후기 {summary.reviewCount}건</p>
          </div>
          <div className="flex-1 space-y-1.5">
            {BREAKDOWN.map((b) => (
              <div key={b.label} className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-xs text-haru-sub">{b.label}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-haru-border">
                  <div className="h-full rounded-full bg-haru-primary" style={{ width: `${(b.value / 5) * 100}%` }} />
                </div>
                <span className="w-7 shrink-0 text-right text-xs font-bold">{b.value.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
        {summary.reviewCount > 0 && (
          <p className="mt-4 rounded-xl bg-haru-secondary px-4 py-2.5 text-sm font-semibold text-haru-primary-dark">
            후기 작성자의 {Math.round(summary.wouldWorkAgainRate * 100)}%가 다시 일할 의향이 있다고 답했습니다
          </p>
        )}
      </section>

      {reviews.length === 0 ? (
        <EmptyState title="아직 후기가 없습니다" description="이 업체에서 근무를 마치면 후기를 남길 수 있습니다." />
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <article key={review.id} className="haru-card p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-haru-secondary text-xs font-bold text-haru-primary-dark">
                    {review.reviewer.nickname.slice(0, 1)}
                  </span>
                  <div>
                    <p className="text-sm font-bold">{review.reviewer.nickname}</p>
                    <p className="text-xs text-haru-sub">{formatRelativeTime(review.createdAt)}</p>
                  </div>
                </div>
                <RatingStars value={review.ratingOverall} size={14} />
              </div>

              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{review.content}</p>

              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <Badge tone="neutral">급여 {review.ratingPay}</Badge>
                <Badge tone="neutral">강도 {review.ratingWorkload}</Badge>
                <Badge tone="neutral">환경 {review.ratingEnvironment}</Badge>
                <Badge tone="neutral">일치도 {review.ratingAccuracy}</Badge>
                {review.wouldWorkAgain && <Badge tone="success">재근무 의향 있음</Badge>}
                <button
                  type="button"
                  onClick={() => (user ? setReportTarget(review.id) : navigate('/login'))}
                  className="ml-auto flex items-center gap-1 text-xs text-haru-sub hover:text-haru-danger"
                >
                  <AlertTriangle className="h-3 w-3" aria-hidden /> 신고
                </button>
              </div>
              <p className="mt-2 text-xs text-haru-sub/80">{review.jobTitle}</p>
            </article>
          ))}
        </div>
      )}

      <Modal
        open={reportTarget !== null}
        onClose={() => setReportTarget(null)}
        title="후기 신고"
        footer={
          <>
            <Button variant="outline" fullWidth onClick={() => setReportTarget(null)}>
              취소
            </Button>
            <Button variant="danger" fullWidth onClick={handleReport}>
              신고 접수
            </Button>
          </>
        }
      >
        <Select value={reportReason} onChange={(e) => setReportReason(e.target.value)} aria-label="신고 사유">
          {REPORT_REASONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </Select>
      </Modal>
    </div>
  );
}
