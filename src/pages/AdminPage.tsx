import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, RotateCcw } from 'lucide-react';
import { getAdminStats, getReports, resolveReport, setTargetHidden } from '@/services/reports';
import type { ReportWithContext } from '@/types/database';
import { REPORT_STATUS_LABEL, REPORT_TARGET_LABEL } from '@/types/enums';
import { useToast } from '@/components/ui/toast';
import { Badge, Button, EmptyState, SkeletonList, Tabs } from '@/components/ui';
import { PageHeader } from '@/components/layout/AppLayout';
import { resetState } from '@/services/mock/db';
import { formatRelativeTime } from '@/lib/format';

type TabKey = 'pending' | 'resolved' | 'rejected' | 'all';

export function AdminPage() {
  const { toast } = useToast();
  const [reports, setReports] = useState<ReportWithContext[]>([]);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getAdminStats>>['data']>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('pending');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([getReports(), getAdminStats()]).then(([r, s]) => {
      setReports(r.data ?? []);
      setStats(s.data);
      setLoading(false);
    });
  }, []);

  useEffect(load, [load]);

  const filtered = reports.filter((r) => (tab === 'all' ? true : r.status === tab));

  const handleHide = async (report: ReportWithContext, hidden: boolean) => {
    const res = await setTargetHidden(report.targetType, report.targetId, hidden);
    if (res.error) toast(res.error.message, 'error');
    else {
      toast(hidden ? '숨김 처리했습니다.' : '숨김을 해제했습니다.', 'success');
      load();
    }
  };

  const handleResolve = async (id: string, status: 'resolved' | 'rejected') => {
    const res = await resolveReport(id, status);
    if (res.error) toast(res.error.message, 'error');
    else {
      toast(status === 'resolved' ? '처리 완료로 변경했습니다.' : '반려했습니다.');
      load();
    }
  };

  const STAT_CARDS = stats
    ? [
        { label: '회원', value: stats.users },
        { label: '전체 공고', value: stats.jobs },
        { label: '모집중', value: stats.openJobs },
        { label: '지원', value: stats.applications },
        { label: '후기', value: stats.reviews },
        { label: '게시글', value: stats.posts },
        { label: '미처리 신고', value: stats.pendingReports },
      ]
    : [];

  return (
    <div className="space-y-5">
      <PageHeader title="관리자" description="신고 처리와 콘텐츠 관리" />

      <section className="grid grid-cols-3 gap-2 sm:grid-cols-7">
        {STAT_CARDS.map((card) => (
          <div key={card.label} className="rounded-xl border border-haru-border bg-white px-3 py-3 text-center">
            <p className="text-xs text-haru-sub">{card.label}</p>
            <p className="mt-1 text-[20px] font-black text-haru-primary-dark">{card.value}</p>
          </div>
        ))}
      </section>

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'pending', label: '처리 대기', count: reports.filter((r) => r.status === 'pending').length },
          { value: 'resolved', label: '처리 완료', count: reports.filter((r) => r.status === 'resolved').length },
          { value: 'rejected', label: '반려', count: reports.filter((r) => r.status === 'rejected').length },
          { value: 'all', label: '전체', count: reports.length },
        ]}
      />

      {loading ? (
        <SkeletonList />
      ) : filtered.length === 0 ? (
        <EmptyState title="신고 내역이 없습니다" description="사용자가 신고를 접수하면 이곳에 표시됩니다." />
      ) : (
        <div className="space-y-3">
          {filtered.map((report) => (
            <div key={report.id} className="haru-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="neutral">{REPORT_TARGET_LABEL[report.targetType]}</Badge>
                <Badge
                  tone={report.status === 'pending' ? 'warn' : report.status === 'resolved' ? 'success' : 'neutral'}
                >
                  {REPORT_STATUS_LABEL[report.status]}
                </Badge>
                <span className="text-xs text-haru-sub">
                  {report.reporter.nickname} · {formatRelativeTime(report.createdAt)}
                </span>
              </div>

              <p className="mt-2 text-sm font-bold">{report.reason}</p>
              {report.detail && <p className="mt-1 text-sm text-haru-sub">{report.detail}</p>}

              <div className="mt-3 rounded-xl bg-haru-bg p-3">
                {report.targetSummary ? (
                  <>
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">{report.targetSummary.title}</p>
                      {report.targetSummary.isHidden && <Badge tone="danger">숨김</Badge>}
                    </div>
                    <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-haru-sub">
                      {report.targetSummary.body}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-haru-sub">대상 콘텐츠가 이미 삭제되었습니다.</p>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {report.targetSummary &&
                  (report.targetSummary.isHidden ? (
                    <Button variant="outline" size="sm" onClick={() => handleHide(report, false)} icon={<Eye className="h-4 w-4" aria-hidden />}>
                      숨김 해제
                    </Button>
                  ) : (
                    <Button variant="danger" size="sm" onClick={() => handleHide(report, true)} icon={<EyeOff className="h-4 w-4" aria-hidden />}>
                      숨김 처리
                    </Button>
                  ))}
                {report.status === 'pending' && (
                  <>
                    <Button size="sm" onClick={() => handleResolve(report.id, 'resolved')}>
                      처리 완료
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleResolve(report.id, 'rejected')}>
                      반려
                    </Button>
                  </>
                )}
                {report.targetType === 'community_post' && (
                  <Link to={`/community/${report.targetId}`} className="ml-auto self-center text-xs font-semibold text-haru-primary">
                    원문 보기
                  </Link>
                )}
                {report.targetType === 'job_post' && (
                  <Link to={`/jobs/${report.targetId}`} className="ml-auto self-center text-xs font-semibold text-haru-primary">
                    원문 보기
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <section className="haru-card p-4">
        <h2 className="text-[17px] font-bold">개발/시연 도구</h2>
        <p className="mt-1 text-sm leading-relaxed text-haru-sub">
          샘플 데이터를 초기 상태로 되돌립니다. 지금까지 작성한 공고·지원·후기·게시글이 모두 사라지고 처음 배포된 샘플
          데이터로 복구됩니다. 발표 직전 상태를 깨끗하게 맞출 때 사용하세요.
        </p>
        <Button
          variant="outline"
          className="mt-3"
          icon={<RotateCcw className="h-4 w-4" aria-hidden />}
          onClick={() => {
            if (!window.confirm('샘플 데이터를 초기화하시겠습니까? 되돌릴 수 없습니다.')) return;
            resetState();
            window.location.reload();
          }}
        >
          샘플 데이터 초기화
        </Button>
      </section>
    </div>
  );
}
