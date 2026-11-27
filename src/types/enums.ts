/**
 * 팀 전체가 공유하는 상태값 정의.
 * 이 파일의 값은 DB CHECK 제약과 1:1로 대응한다. 임의 변경 금지.
 */

export const JOB_STATUS = ['open', 'closed', 'hidden'] as const;
export const APPLICATION_STATUS = ['pending', 'accepted', 'rejected', 'cancelled', 'completed'] as const;
export const PAY_TYPE = ['hourly', 'daily'] as const;
export const JOB_CATEGORY = [
  'serving',
  'kitchen',
  'cafe',
  'delivery',
  'logistics',
  'construction',
  'event',
  'mart',
  'cleaning',
  'office',
  'etc',
] as const;
export const COMMUNITY_CATEGORY = ['review', 'info', 'free', 'caution'] as const;
export const REPORT_TARGET = ['job_post', 'review', 'community_post', 'community_comment'] as const;
export const REPORT_STATUS = ['pending', 'resolved', 'rejected'] as const;
export const USER_ROLE = ['user', 'admin'] as const;

export type JobStatus = (typeof JOB_STATUS)[number];
export type ApplicationStatus = (typeof APPLICATION_STATUS)[number];
export type PayType = (typeof PAY_TYPE)[number];
export type JobCategory = (typeof JOB_CATEGORY)[number];
export type CommunityCategory = (typeof COMMUNITY_CATEGORY)[number];
export type ReportTarget = (typeof REPORT_TARGET)[number];
export type ReportStatus = (typeof REPORT_STATUS)[number];
export type UserRole = (typeof USER_ROLE)[number];

/** 화면에 노출되는 한국어 라벨 — 라벨은 여기서만 정의한다. */
export const JOB_CATEGORY_LABEL: Record<JobCategory, string> = {
  serving: '서빙·홀',
  kitchen: '주방·조리',
  cafe: '카페·베이커리',
  delivery: '배달·운전',
  logistics: '물류·상하차',
  construction: '건설·현장',
  event: '행사·스태프',
  mart: '마트·편의점',
  cleaning: '청소·미화',
  office: '사무보조',
  etc: '기타',
};

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  pending: '대기중',
  accepted: '승인됨',
  rejected: '거절됨',
  cancelled: '취소됨',
  completed: '근무완료',
};

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  open: '모집중',
  closed: '모집마감',
  hidden: '숨김',
};

export const PAY_TYPE_LABEL: Record<PayType, string> = {
  hourly: '시급',
  daily: '일급',
};

export const COMMUNITY_CATEGORY_LABEL: Record<CommunityCategory, string> = {
  review: '일자리 후기',
  info: '알바 정보',
  free: '자유게시판',
  caution: '주의 정보',
};

export const REPORT_TARGET_LABEL: Record<ReportTarget, string> = {
  job_post: '공고',
  review: '리뷰',
  community_post: '게시글',
  community_comment: '댓글',
};

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  pending: '처리 대기',
  resolved: '처리 완료',
  rejected: '반려',
};

/**
 * 지원 상태 전이 규칙. 서비스 계층에서 이 표로 검증한다.
 * (DB 측에서도 동일 규칙을 RLS/트리거로 중복 검증한다)
 */
export const ALLOWED_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  pending: ['accepted', 'rejected', 'cancelled'],
  accepted: ['completed', 'rejected'],
  rejected: [],
  cancelled: [],
  completed: [],
};
