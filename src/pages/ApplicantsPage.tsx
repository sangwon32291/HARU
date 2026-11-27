import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import { getApplicants, updateApplicationStatus } from '@/services/applications';
import { closeJob, getJobDetail } from '@/services/jobs';
import type { JobApplicationWithRelations, JobPostDetail } from '@/types/database';
import { APPLICATION_STATUS_LABEL } from '@/types/enums';
import { useToast } from '@/components/ui/toast';
import { RatingStars } from '@/components/review/RatingStars';
import { Badge, Button, EmptyState, ErrorState, SkeletonList, Tabs } from '@/components/ui';
import { PageHeader } from '@/components/layout/AppLayout';
import { formatPay, formatRelativeTime, formatWorkDate, formatWorkTime } from '@/lib/format';

type TabKey = 'all' | 'pending' | 'accepted' | 'completed' | 'rejected';

export function ApplicantsPage() {
  const { id = '' } = useParams();
  const { toast } = useToast();
  const [job, setJob] = useState<JobPostDetail | null>(null);
  const [items, setItems] = useState<JobApplicationWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('all');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([getJobDetail(id), getApplicants(id)]).then(([j, a]) => {
      if (a.error) {
        setError(a.error.message);
      } else {
        setItems(a.data);
        setError(null);
      }
      setJob(j.data);
      setLoading(false);
    });
  }, [id]);

  useEffect(load, [load]);

  const change = async (applicationId: string, status: 'accepted' | 'rejected' | 'completed') => {
    const res = await updateApplicationStatus(applicationId, status);
    if (res.error) toast(res.error.message, 'error');
    else {
      toast(`${APPLICATION_STATUS_LABEL[status]} 처리했습니다.`, 'success');
      load();
    }
  };

  const handleClose = async () => {
    const res = await closeJob(id);
    if (res.error) toast(res.error.message, 'error');
    else {
      toast('모집을 마감했습니다.', 'success');
      load();
    }
  };

  if (loading) return <SkeletonList count={3} />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const filtered = items.filter((a) => (tab === 'all' ? true : a.status === tab));
  const accepted = items.filter((a) => a.status === 'accepted' || a.status === 'completed').length;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader
        title="지원자 관리"
        backTo="/my/jobs"
        description={job ? `${job.title} · ${formatWorkDate(job.workDate)}` : undefined}
      />

      {job && (
        <section className="haru-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-haru-sub">
                {formatWorkTime(job.startTime, job.endTime)} · {formatPay(job.payType, job.payAmount)}
              </p>
              <p className="mt-1 text-sm font-bold">
                모집 {job.headcount}명 중 <span className="text-haru-primary">{accepted}명</span> 확정
              </p>
            </div>
            {job.status === 'open' ? (
              <Button variant="outline" size="sm" onClick={handleClose}>
                모집 마감
              </Button>
            ) : (
              <Badge tone="neutral">마감됨</Badge>
            )}
          </div>
          {accepted >= job.headcount && job.status === 'open' && (
            <p className="mt-3 rounded-lg bg-haru-secondary px-3 py-2 text-xs font-medium text-haru-primary-dark">
              모집 인원이 모두 찼습니다. 모집 마감을 눌러 더 이상 지원을 받지 않을 수 있습니다.
            </p>
          )}
        </section>
      )}

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'all', label: '전체', count: items.length },
          { value: 'pending', label: '대기중', count: items.filter((a) => a.status === 'pending').length },
          { value: 'accepted', label: '승인', count: items.filter((a) => a.status === 'accepted').length },
          { value: 'completed', label: '근무완료', count: items.filter((a) => a.status === 'completed').length },
          { value: 'rejected', label: '거절', count: items.filter((a) => a.status === 'rejected').length },
        ]}
      />

      {filtered.length === 0 ? (
        <EmptyState title="해당하는 지원자가 없습니다" description="지원이 들어오면 이곳에 표시됩니다." />
      ) : (
        <div className="space-y-3">
          {filtered.map((app) => (
            <div key={app.id} className="haru-card p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-haru-secondary text-sm font-bold text-haru-primary-dark">
                  {app.applicant.nickname.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-bold">{app.applicant.nickname}</p>
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
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-xs text-haru-sub">
                    <RatingStars value={app.applicant.ratingAvg} size={12} />
                    {formatRelativeTime(app.appliedAt)} 지원
                  </p>
                  {app.message && (
                    <p className="mt-2 rounded-lg bg-haru-bg px-3 py-2 text-sm leading-relaxed text-haru-text">
                      {app.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {app.status === 'pending' && (
                  <>
                    <Button size="sm" onClick={() => change(app.id, 'accepted')} icon={<CheckCircle2 className="h-4 w-4" aria-hidden />}>
                      승인
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => change(app.id, 'rejected')} icon={<XCircle className="h-4 w-4" aria-hidden />}>
                      거절
                    </Button>
                  </>
                )}
                {app.status === 'accepted' && (
                  <Button size="sm" onClick={() => change(app.id, 'completed')}>
                    근무 완료 처리
                  </Button>
                )}
                {app.status === 'completed' && (
                  <Badge tone="primary">{app.hasReview ? '후기 작성됨' : '후기 작성 대기'}</Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="rounded-xl border border-dashed border-haru-border bg-white/70 px-4 py-3 text-xs leading-relaxed text-haru-sub">
        근무 완료로 처리하면 해당 지원자에게 후기 작성 권한이 생깁니다. 실제 근무가 이뤄진 뒤에 처리해 주세요.
        <br />
        지원자의 연락처는 공개되지 않으며, HARU는 급여 지급을 중개하지 않습니다.
      </p>

      {job && (
        <Link to={`/jobs/${job.id}`} className="block">
          <Button variant="outline" fullWidth>
            공고 상세 보기
          </Button>
        </Link>
      )}
    </div>
  );
}
