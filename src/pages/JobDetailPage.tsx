import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Calendar, CheckCircle2, Clock, MapPin, Package, Pencil, Trash2, Users } from 'lucide-react';
import { closeJob, deleteJob, getJobDetail } from '@/services/jobs';
import { applyToJob, cancelApplication } from '@/services/applications';
import { getJobReviews } from '@/services/reviews';
import { createReport, REPORT_REASONS } from '@/services/reports';
import type { JobPostDetail, ReviewWithAuthor } from '@/types/database';
import { APPLICATION_STATUS_LABEL, JOB_CATEGORY_LABEL } from '@/types/enums';
import { CategoryIcon } from '@/constants/categoryIcons';
import { useAuth } from '@/features/auth/AuthContext';
import { useToast } from '@/components/ui/toast';
import { HaruMap } from '@/components/map/HaruMap';
import { RatingStars } from '@/components/review/RatingStars';
import { Badge, Button, ErrorState, Modal, Select, Spinner, Textarea } from '@/components/ui';
import { PageHeader } from '@/components/layout/AppLayout';
import { estimatedDailyPay, formatKRW, formatPay, formatRelativeTime, formatWorkDate, formatWorkTime } from '@/lib/format';

export function JobDetailPage() {
  const { id = '' } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [job, setJob] = useState<JobPostDetail | null>(null);
  const [reviews, setReviews] = useState<ReviewWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyMessage, setApplyMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [reportDetail, setReportDetail] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    getJobDetail(id).then((res) => {
      if (res.error) {
        setError(res.error.message);
        setJob(null);
      } else {
        setJob(res.data);
        setError(null);
      }
      setLoading(false);
    });
    getJobReviews(id).then((res) => setReviews(res.data ?? []));
  }, [id]);

  useEffect(load, [load]);

  /**
   * 맞춤 추천 화면의 '바로 지원하기'로 들어온 경우(?apply=1) 지원 모달을 자동으로 연다.
   * 이미 지원했거나 마감된 공고, 본인 공고라면 열지 않는다.
   */
  useEffect(() => {
    if (searchParams.get('apply') !== '1' || !job || !user) return;
    const mine = job.employerId === user.id;
    const already = job.myApplication && job.myApplication.status !== 'cancelled';
    if (!mine && !already && job.status === 'open') setApplyOpen(true);
  }, [searchParams, job, user]);

  if (loading) return <Spinner label="공고를 불러오는 중" />;
  if (error || !job) return <ErrorState message={error ?? '공고를 찾을 수 없습니다.'} onRetry={load} />;

  const isOwner = user?.id === job.employerId;
  const myApp = job.myApplication;
  const applied = myApp != null && myApp.status !== 'cancelled';

  const handleApply = async () => {
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(`/jobs/${id}`)}`);
      return;
    }
    setSubmitting(true);
    const res = await applyToJob(id, applyMessage);
    setSubmitting(false);
    if (res.error) {
      toast(res.error.message, 'error');
      return;
    }
    toast('지원이 완료되었습니다.', 'success');
    setApplyOpen(false);
    setApplyMessage('');
    load();
  };

  const handleCancel = async () => {
    if (!myApp) return;
    const res = await cancelApplication(myApp.id);
    if (res.error) toast(res.error.message, 'error');
    else {
      toast('지원을 취소했습니다.');
      load();
    }
  };

  const handleClose = async () => {
    const res = await closeJob(job.id);
    if (res.error) toast(res.error.message, 'error');
    else {
      toast('모집을 마감했습니다.', 'success');
      load();
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('공고를 삭제하시겠습니까? 지원 내역도 함께 삭제됩니다.')) return;
    const res = await deleteJob(job.id);
    if (res.error) toast(res.error.message, 'error');
    else {
      toast('공고를 삭제했습니다.');
      navigate('/my/jobs');
    }
  };

  const handleReport = async () => {
    const res = await createReport({
      targetType: 'job_post',
      targetId: job.id,
      reason: reportReason,
      detail: reportDetail,
    });
    if (res.error) toast(res.error.message, 'error');
    else {
      toast('신고가 접수되었습니다. 운영팀이 확인합니다.', 'success');
      setReportOpen(false);
      setReportDetail('');
    }
  };

  const estimated = estimatedDailyPay(job.payType, job.payAmount, job.startTime, job.endTime);

  return (
    <div className="pb-20 lg:pb-0">
      <PageHeader title={job.title} backTo="" description={job.companyName} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          {/* 요약 카드 */}
          <section className="haru-card p-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone="primary">
                <CategoryIcon category={job.category} /> {JOB_CATEGORY_LABEL[job.category]}
              </Badge>
              {job.status === 'open' ? <Badge tone="success">모집중</Badge> : <Badge tone="neutral">모집마감</Badge>}
              {applied && <Badge tone="warn">{APPLICATION_STATUS_LABEL[myApp!.status]}</Badge>}
            </div>

            <p className="mt-4 text-[28px] font-black text-haru-primary-dark">
              {formatPay(job.payType, job.payAmount)}
            </p>
            {job.payType === 'hourly' && (
              <p className="mt-1 text-xs text-haru-sub">
                근무 시간 기준 예상 일당 약 {formatKRW(estimated)} (세전 추정치이며 실제 지급액과 다를 수 있습니다)
              </p>
            )}

            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              <Row icon={<Calendar className="h-4 w-4" aria-hidden />} label="근무일" value={`${formatWorkDate(job.workDate)} (${job.workDate})`} />
              <Row icon={<Clock className="h-4 w-4" aria-hidden />} label="근무 시간" value={formatWorkTime(job.startTime, job.endTime)} />
              <Row icon={<Users className="h-4 w-4" aria-hidden />} label="모집 인원" value={`${job.headcount}명 (현재 지원 ${job.applicantCount}명 / 승인 ${job.acceptedCount}명)`} />
              <Row icon={<MapPin className="h-4 w-4" aria-hidden />} label="근무 장소" value={job.placeName} />
            </dl>
          </section>

          {/* 업무 내용 */}
          <section className="haru-card p-4">
            <h2 className="mb-3 text-[17px] font-bold">업무 내용</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-haru-text">{job.description}</p>

            {job.requirements && (
              <div className="mt-5">
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold">
                  <CheckCircle2 className="h-4 w-4 text-haru-primary" aria-hidden /> 지원 자격
                </h3>
                <p className="text-sm leading-relaxed text-haru-sub">{job.requirements}</p>
              </div>
            )}
            {job.belongings && (
              <div className="mt-4">
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold">
                  <Package className="h-4 w-4 text-haru-primary" aria-hidden /> 준비물
                </h3>
                <p className="text-sm leading-relaxed text-haru-sub">{job.belongings}</p>
              </div>
            )}
          </section>

          {/* 위치 */}
          <section className="haru-card overflow-hidden">
            <div className="p-5 pb-3">
              <h2 className="text-[17px] font-bold">근무 위치</h2>
              <p className="mt-1 text-sm text-haru-sub">
                {job.placeName}
                {job.address ? ` · ${job.address}` : ''}
              </p>
            </div>
            <HaruMap
              center={{ lat: job.lat, lng: job.lng }}
              zoom={15}
              markers={[{ id: job.id, lat: job.lat, lng: job.lng, label: '근무지' }]}
              selectedId={job.id}
              showOrigin={false}
              className="h-56 rounded-none border-0 border-t"
            />
          </section>

          {/*
            후기 섹션은 데스크톱에서 오른쪽 사이드바로 올라간다(lg:hidden).
            왼쪽 본문만 길어지면 오른쪽 아래가 크게 비어 보이기 때문이다.
            모바일에서는 사이드바가 없으므로 여기 그대로 표시된다.
          */}
          <div className="lg:hidden">
            <ReviewSummary job={job} reviews={reviews} />
          </div>

          <button
            type="button"
            onClick={() => (user ? setReportOpen(true) : navigate('/login'))}
            className="flex items-center gap-1.5 text-xs font-medium text-haru-sub hover:text-haru-danger"
          >
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> 이 공고 신고하기
          </button>
        </div>

        {/* 사이드 액션 */}
        <aside className="space-y-3 lg:sticky lg:top-20 lg:self-start">
          <div className="haru-card p-4">
            <p className="text-sm font-semibold text-haru-sub">등록자</p>
            <div className="mt-2 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-haru-secondary text-sm font-bold text-haru-primary-dark">
                {job.employer.nickname.slice(0, 1)}
              </span>
              <div>
                <p className="text-sm font-bold">{job.employer.nickname}</p>
                <p className="text-xs text-haru-sub">
                  평점 {job.employer.reviewCount > 0 ? job.employer.ratingAvg.toFixed(1) : '-'} · 후기{' '}
                  {job.employer.reviewCount}건
                </p>
              </div>
            </div>
          </div>

          {isOwner ? (
            <div className="haru-card space-y-2 p-4">
              <p className="text-sm font-semibold">내가 등록한 공고</p>
              <Link to={`/my/jobs/${job.id}/applicants`} className="block">
                <Button fullWidth>지원자 {job.applicantCount}명 관리</Button>
              </Link>
              <Link to={`/jobs/${job.id}/edit`} className="block">
                <Button variant="outline" fullWidth icon={<Pencil className="h-4 w-4" aria-hidden />}>
                  공고 수정
                </Button>
              </Link>
              {job.status === 'open' && (
                <Button variant="outline" fullWidth onClick={handleClose}>
                  모집 마감
                </Button>
              )}
              <Button variant="danger" fullWidth onClick={handleDelete} icon={<Trash2 className="h-4 w-4" aria-hidden />}>
                공고 삭제
              </Button>
            </div>
          ) : (
            <div className="haru-card space-y-2 p-4">
              {applied ? (
                <>
                  <p className="rounded-xl bg-haru-secondary px-4 py-3 text-sm font-semibold text-haru-primary-dark">
                    지원 상태: {APPLICATION_STATUS_LABEL[myApp!.status]}
                  </p>
                  {myApp!.status === 'pending' && (
                    <Button variant="outline" fullWidth onClick={handleCancel}>
                      지원 취소
                    </Button>
                  )}
                  {myApp!.status === 'completed' && (
                    <Link to={`/reviews/new?applicationId=${myApp!.id}`} className="block">
                      <Button fullWidth>근무 후기 작성</Button>
                    </Link>
                  )}
                  <Link to="/my/applications" className="block">
                    <Button variant="ghost" fullWidth>
                      지원 내역 보기
                    </Button>
                  </Link>
                </>
              ) : (
                <Button
                  fullWidth
                  size="lg"
                  disabled={job.status !== 'open'}
                  onClick={() => (user ? setApplyOpen(true) : navigate(`/login?redirect=${encodeURIComponent(`/jobs/${id}`)}`))}
                >
                  {job.status === 'open' ? '지원하기' : '모집이 마감되었습니다'}
                </Button>
              )}
              {!user && <p className="text-center text-xs text-haru-sub">지원하려면 로그인이 필요합니다.</p>}
            </div>
          )}

          {/* 데스크톱에서만: 비어 보이던 사이드바 아래를 후기로 채운다 */}
          <div className="hidden lg:block">
            <ReviewSummary job={job} reviews={reviews} />
          </div>
        </aside>
      </div>

      {/* 모바일 하단 고정 지원 버튼 */}
      {!isOwner && !applied && job.status === 'open' && (
        <div className="fixed inset-x-0 bottom-16 z-30 border-t border-haru-border bg-white/95 p-3 backdrop-blur lg:hidden">
          <Button
            fullWidth
            size="lg"
            onClick={() => (user ? setApplyOpen(true) : navigate(`/login?redirect=${encodeURIComponent(`/jobs/${id}`)}`))}
          >
            {formatPay(job.payType, job.payAmount)} · 지원하기
          </Button>
        </div>
      )}

      <Modal
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
        title="이 공고에 지원할까요?"
        footer={
          <>
            <Button variant="outline" fullWidth onClick={() => setApplyOpen(false)}>
              취소
            </Button>
            <Button fullWidth loading={submitting} onClick={handleApply}>
              지원하기
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="rounded-xl bg-haru-bg p-3 text-sm">
            <p className="font-bold">{job.title}</p>
            <p className="mt-1 text-haru-sub">
              {formatWorkDate(job.workDate)} · {formatWorkTime(job.startTime, job.endTime)} ·{' '}
              {formatPay(job.payType, job.payAmount)}
            </p>
          </div>
          <Textarea
            value={applyMessage}
            onChange={(e) => setApplyMessage(e.target.value)}
            placeholder="구인자에게 전할 메시지를 입력하세요 (선택)"
            aria-label="지원 메시지"
            className="min-h-[90px]"
          />
          <p className="text-xs text-haru-sub">
            지원 시 닉네임과 평점이 구인자에게 공개됩니다. 연락처는 공개되지 않습니다.
          </p>
        </div>
      </Modal>

      <Modal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title="공고 신고"
        footer={
          <>
            <Button variant="outline" fullWidth onClick={() => setReportOpen(false)}>
              취소
            </Button>
            <Button variant="danger" fullWidth onClick={handleReport}>
              신고 접수
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Select value={reportReason} onChange={(e) => setReportReason(e.target.value)} aria-label="신고 사유">
            {REPORT_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
          <Textarea
            value={reportDetail}
            onChange={(e) => setReportDetail(e.target.value)}
            placeholder="구체적인 내용을 적어주시면 처리에 도움이 됩니다 (선택)"
            aria-label="신고 상세 내용"
          />
        </div>
      </Modal>
    </div>
  );
}

/**
 * 업체 후기 요약.
 * 데스크톱에서는 오른쪽 사이드바, 모바일에서는 본문 흐름에 표시된다.
 * 같은 내용을 두 곳에 쓰므로 컴포넌트로 뽑아 중복을 없앴다.
 */
function ReviewSummary({ job, reviews }: { job: JobPostDetail; reviews: ReviewWithAuthor[] }) {
  return (
    <section className="haru-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[17px] font-bold">이 업체의 후기</h2>
        <Link to={`/employers/${job.employerId}/reviews`} className="text-sm font-semibold text-haru-primary">
          전체 보기
        </Link>
      </div>

      <div className="mb-4 flex items-center gap-3 rounded-xl bg-haru-secondary/60 px-4 py-3">
        <RatingStars value={job.employer.ratingAvg} />
        <p className="text-sm font-bold">
          {job.employer.reviewCount > 0 ? job.employer.ratingAvg.toFixed(1) : '-'}
          <span className="ml-1 font-normal text-haru-sub">후기 {job.employer.reviewCount}건</span>
        </p>
      </div>

      {reviews.length === 0 ? (
        <p className="py-6 text-center text-sm text-haru-sub">아직 이 공고에 등록된 후기가 없습니다.</p>
      ) : (
        <ul className="divide-y divide-haru-border">
          {reviews.slice(0, 3).map((review) => (
            <li key={review.id} className="py-3 first:pt-0">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-semibold">{review.reviewer.nickname}</p>
                <RatingStars value={review.ratingOverall} size={14} />
              </div>
              <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-haru-sub">{review.content}</p>
              <p className="mt-1 text-xs text-haru-sub/70">{formatRelativeTime(review.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-1 text-haru-primary">{icon}</span>
      <div>
        <dt className="text-xs text-haru-sub">{label}</dt>
        <dd className="text-sm font-semibold">{value}</dd>
      </div>
    </div>
  );
}
