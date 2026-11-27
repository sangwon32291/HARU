/**
 * DB(snake_case) ↔ 애플리케이션(camelCase) 변환.
 *
 * 변환은 이 파일에서만 합니다. 화면 코드에 snake_case 가 새어나가지 않게 하는 것이
 * 4명이 따로 작업해도 타입이 어긋나지 않는 핵심 규칙입니다.
 */
import type {
  CommunityComment,
  CommunityCommentWithAuthor,
  CommunityPost,
  CommunityPostWithAuthor,
  JobApplication,
  JobPost,
  JobPostSummary,
  Profile,
  Report,
  Review,
  ReviewWithAuthor,
} from '@/types/database';
import type {
  ApplicationStatus,
  CommunityCategory,
  JobCategory,
  JobStatus,
  PayType,
  ReportStatus,
  ReportTarget,
  UserRole,
} from '@/types/enums';

type Row = Record<string, any>;

/** 'HH:mm:ss' → 'HH:mm' */
const hhmm = (t: string | null): string => (t ? t.slice(0, 5) : '');

export function toProfile(r: Row): Profile {
  return {
    id: r.id,
    nickname: r.nickname,
    phone: r.phone ?? null,
    bio: r.bio ?? null,
    avatarUrl: r.avatar_url ?? null,
    regionCode: r.region_code ?? null,
    baseLat: r.base_lat ?? null,
    baseLng: r.base_lng ?? null,
    ratingAvg: Number(r.rating_avg ?? 0),
    reviewCount: Number(r.review_count ?? 0),
    role: (r.role ?? 'user') as UserRole,
    createdAt: r.created_at,
  };
}

export function toJobPost(r: Row): JobPost {
  return {
    id: r.id,
    employerId: r.employer_id,
    title: r.title,
    companyName: r.company_name,
    category: r.category as JobCategory,
    description: r.description,
    workDate: r.work_date,
    startTime: hhmm(r.start_time),
    endTime: hhmm(r.end_time),
    payType: r.pay_type as PayType,
    payAmount: Number(r.pay_amount),
    headcount: Number(r.headcount),
    placeName: r.place_name,
    address: r.address ?? null,
    lat: Number(r.lat),
    lng: Number(r.lng),
    requirements: r.requirements ?? null,
    belongings: r.belongings ?? null,
    status: r.status as JobStatus,
    createdAt: r.created_at,
    updatedAt: r.updated_at ?? r.created_at,
  };
}

/** search_jobs RPC 의 한 행 → JobPostSummary */
export function rpcToSummary(r: Row): JobPostSummary {
  return {
    id: r.id,
    title: r.title,
    companyName: r.company_name,
    category: r.category as JobCategory,
    workDate: r.work_date,
    startTime: hhmm(r.start_time),
    endTime: hhmm(r.end_time),
    payType: r.pay_type as PayType,
    payAmount: Number(r.pay_amount),
    headcount: Number(r.headcount),
    placeName: r.place_name,
    lat: Number(r.lat),
    lng: Number(r.lng),
    employerId: r.employer_id,
    status: (r.status ?? 'open') as JobStatus,
    createdAt: r.created_at,
    distanceM: Number(r.distance_m ?? 0),
    ratingAvg: Number(r.rating_avg ?? 0),
    reviewCount: Number(r.review_count ?? 0),
    applicantCount: Number(r.applicant_count ?? 0),
  };
}

/** 일반 job_posts 행 → JobPostSummary (거리 계산이 없는 목록용) */
export function jobToSummary(r: Row, distanceM = 0): JobPostSummary {
  const p = r.profiles ?? r.employer ?? {};
  return {
    ...rpcToSummary({ ...r, distance_m: distanceM }),
    ratingAvg: Number(p.rating_avg ?? 0),
    reviewCount: Number(p.review_count ?? 0),
    applicantCount: Number(
      Array.isArray(r.job_applications) ? r.job_applications.length : r.applicant_count ?? 0,
    ),
  };
}

export function toApplication(r: Row): JobApplication {
  return {
    id: r.id,
    jobPostId: r.job_post_id,
    applicantId: r.applicant_id,
    message: r.message ?? null,
    status: r.status as ApplicationStatus,
    appliedAt: r.applied_at,
    completedAt: r.completed_at ?? null,
  };
}

export function toReview(r: Row): Review {
  return {
    id: r.id,
    applicationId: r.application_id,
    jobPostId: r.job_post_id,
    reviewerId: r.reviewer_id,
    employerId: r.employer_id,
    ratingPay: Number(r.rating_pay),
    ratingWorkload: Number(r.rating_workload),
    ratingEnvironment: Number(r.rating_environment),
    ratingAccuracy: Number(r.rating_accuracy),
    wouldWorkAgain: Boolean(r.would_work_again),
    ratingOverall: Number(r.rating_overall),
    content: r.content,
    isHidden: Boolean(r.is_hidden),
    createdAt: r.created_at,
    updatedAt: r.updated_at ?? r.created_at,
  };
}

export function toReviewWithAuthor(r: Row): ReviewWithAuthor {
  const rev = r.reviewer ?? r.profiles ?? {};
  const job = r.job_post ?? r.job_posts ?? {};
  return {
    ...toReview(r),
    reviewer: {
      id: r.reviewer_id,
      nickname: rev.nickname ?? '알 수 없음',
      avatarUrl: rev.avatar_url ?? null,
    },
    jobTitle: job.title ?? '삭제된 공고',
    companyName: job.company_name ?? '-',
  };
}

export function toPost(r: Row): CommunityPost {
  return {
    id: r.id,
    authorId: r.author_id,
    category: r.category as CommunityCategory,
    title: r.title,
    content: r.content,
    viewCount: Number(r.view_count ?? 0),
    likeCount: Number(r.like_count ?? 0),
    commentCount: Number(r.comment_count ?? 0),
    isHidden: Boolean(r.is_hidden),
    createdAt: r.created_at,
    updatedAt: r.updated_at ?? r.created_at,
  };
}

export function toPostWithAuthor(r: Row, likedByMe = false): CommunityPostWithAuthor {
  const a = r.author ?? r.profiles ?? {};
  return {
    ...toPost(r),
    author: {
      id: r.author_id,
      nickname: a.nickname ?? '알 수 없음',
      avatarUrl: a.avatar_url ?? null,
    },
    likedByMe,
  };
}

export function toComment(r: Row): CommunityComment {
  return {
    id: r.id,
    postId: r.post_id,
    authorId: r.author_id,
    content: r.content,
    isHidden: Boolean(r.is_hidden),
    createdAt: r.created_at,
  };
}

export function toCommentWithAuthor(r: Row): CommunityCommentWithAuthor {
  const a = r.author ?? r.profiles ?? {};
  return {
    ...toComment(r),
    author: {
      id: r.author_id,
      nickname: a.nickname ?? '알 수 없음',
      avatarUrl: a.avatar_url ?? null,
    },
  };
}

export function toReport(r: Row): Report {
  return {
    id: r.id,
    reporterId: r.reporter_id,
    targetType: r.target_type as ReportTarget,
    targetId: r.target_id,
    reason: r.reason,
    detail: r.detail ?? null,
    status: r.status as ReportStatus,
    handledBy: r.handled_by ?? null,
    createdAt: r.created_at,
  };
}
