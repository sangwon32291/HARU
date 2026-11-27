import { Link } from 'react-router-dom';
import { CalendarDays, Clock, MapPin, Star, Users } from 'lucide-react';
import type { JobPostSummary } from '@/types/database';
import { JOB_CATEGORY_LABEL, JOB_STATUS_LABEL } from '@/types/enums';
import { CategoryIcon } from '@/constants/categoryIcons';
import { formatDistance } from '@/lib/geo';
import { cn, formatPay, formatWorkDateShort, formatWorkTime, urgencyLabel } from '@/lib/format';
import { Badge } from '@/components/ui';

/**
 * 공고 카드.
 *
 * 크기 규칙
 *  - 바깥은 flex 세로 박스 + h-full 이라, 부모가 items-stretch 면 같은 줄의 카드가 모두 같은 높이가 된다.
 *  - 배지 줄은 절대 줄바꿈되지 않는다(직종 + 오늘/내일 + 마감만). 날짜 전체는 아래 메타 줄로 내린다.
 *    배지가 두 줄이 되면 카드마다 높이가 달라져 목록이 들쭉날쭉해지기 때문이다.
 *  - 메타는 항상 3줄 고정(근무일시 / 장소 / 모집인원)이라 어느 폭에서도 높이가 같다.
 */
export function JobCard({
  job,
  showDistance = true,
  highlighted = false,
  onHover,
}: {
  job: JobPostSummary;
  showDistance?: boolean;
  highlighted?: boolean;
  onHover?: (id: string | null) => void;
}) {
  const closed = job.status !== 'open';
  const urgent = urgencyLabel(job.workDate);

  return (
    <Link
      to={`/jobs/${job.id}`}
      onMouseEnter={() => onHover?.(job.id)}
      onMouseLeave={() => onHover?.(null)}
      className={cn(
        'flex h-full flex-col rounded-2xl border bg-white p-4 shadow-card transition-all hover:border-haru-primary/50 hover:shadow-float',
        highlighted ? 'border-haru-primary' : 'border-haru-border',
        closed && 'opacity-70',
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* 줄바꿈 금지: 짧은 배지만 둔다 */}
          <div className="mb-2 flex min-w-0 items-center gap-1.5">
            <Badge tone="primary" className="shrink-0">
              <CategoryIcon category={job.category} /> {JOB_CATEGORY_LABEL[job.category]}
            </Badge>
            {urgent && <Badge tone="warn" className="shrink-0">{urgent}</Badge>}
            {closed && <Badge tone="neutral" className="shrink-0">{JOB_STATUS_LABEL[job.status]}</Badge>}
          </div>

          <h3 className="truncate text-[15px] font-bold leading-snug">{job.title}</h3>
          <p className="mt-1 truncate text-sm text-haru-sub">{job.companyName}</p>
        </div>

        <div className="shrink-0 text-right">
          <p className="whitespace-nowrap text-[17px] font-black text-haru-primary-dark">
            {formatPay(job.payType, job.payAmount)}
          </p>
          <p className="mt-1 inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-haru-sub">
            <Star
              className={cn(
                'h-3.5 w-3.5 shrink-0',
                job.reviewCount > 0 ? 'fill-[#F2B01E] text-[#F2B01E]' : 'text-haru-border',
              )}
              aria-hidden
            />
            {job.reviewCount > 0 ? (
              <>
                {job.ratingAvg.toFixed(1)}
                <span className="font-normal text-haru-sub/80">({job.reviewCount})</span>
              </>
            ) : (
              <span className="font-normal text-haru-sub/80">후기 없음</span>
            )}
          </p>
        </div>
      </div>

      {/* 항상 3줄 — 카드 폭이 달라도 높이가 같다 */}
      <div className="mt-3 space-y-1 text-xs text-haru-sub">
        <p className="flex min-w-0 items-center gap-1">
          <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="shrink-0 font-semibold text-haru-text">{formatWorkDateShort(job.workDate)}</span>
          <Clock className="ml-1 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate">{formatWorkTime(job.startTime, job.endTime)}</span>
        </p>
        <p className="flex min-w-0 items-center gap-1">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate">{job.placeName}</span>
          {showDistance && job.distanceM > 0 && (
            <span className="shrink-0 font-semibold text-haru-primary">
              · {formatDistance(job.distanceM)}
            </span>
          )}
        </p>
        <p className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{job.headcount}명 모집</span>
        </p>
      </div>
    </Link>
  );
}
