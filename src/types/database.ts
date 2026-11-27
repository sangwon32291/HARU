/**
 * 팀 전체 공통 도메인 타입.
 * DB는 snake_case, 애플리케이션은 camelCase를 쓴다.
 * 변환은 services 계층(mock/db.ts, supabase/mappers.ts)에서만 수행한다.
 */
import type {
  ApplicationStatus,
  CommunityCategory,
  JobCategory,
  JobStatus,
  PayType,
  ReportStatus,
  ReportTarget,
  UserRole,
} from './enums';

export interface Profile {
  id: string;
  nickname: string;
  phone: string | null;
  bio: string | null;
  avatarUrl: string | null;
  regionCode: string | null;
  baseLat: number | null;
  baseLng: number | null;
  /** 구인자로서 받은 평균 평점 (집계 캐시) */
  ratingAvg: number;
  reviewCount: number;
  role: UserRole;
  createdAt: string;
}

export interface JobPost {
  id: string;
  employerId: string;
  title: string;
  companyName: string;
  category: JobCategory;
  description: string;
  /** 'YYYY-MM-DD' */
  workDate: string;
  /** 'HH:mm' */
  startTime: string;
  endTime: string;
  payType: PayType;
  /** 원화 정수 */
  payAmount: number;
  headcount: number;
  placeName: string;
  address: string | null;
  lat: number;
  lng: number;
  requirements: string | null;
  belongings: string | null;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
}

/** 목록·지도용 조회 전용 타입. distanceM은 서버(또는 mock DB)가 계산한다. */
export interface JobPostSummary
  extends Pick<
    JobPost,
    | 'id'
    | 'title'
    | 'companyName'
    | 'category'
    | 'workDate'
    | 'startTime'
    | 'endTime'
    | 'payType'
    | 'payAmount'
    | 'headcount'
    | 'placeName'
    | 'lat'
    | 'lng'
    | 'employerId'
    | 'status'
    | 'createdAt'
  > {
  distanceM: number;
  ratingAvg: number;
  reviewCount: number;
  applicantCount: number;
}

export interface JobPostDetail extends JobPost {
  employer: Pick<Profile, 'id' | 'nickname' | 'avatarUrl' | 'ratingAvg' | 'reviewCount'>;
  applicantCount: number;
  acceptedCount: number;
  /** 로그인 사용자의 지원 건 (없으면 null) */
  myApplication: JobApplication | null;
}

export interface JobApplication {
  id: string;
  jobPostId: string;
  applicantId: string;
  message: string | null;
  status: ApplicationStatus;
  appliedAt: string;
  completedAt: string | null;
}

export interface JobApplicationWithRelations extends JobApplication {
  jobPost: Pick<
    JobPost,
    | 'id' | 'title' | 'companyName' | 'category' | 'workDate' | 'startTime' | 'endTime'
    | 'payType' | 'payAmount' | 'placeName' | 'employerId' | 'status'
  >;
  applicant: Pick<Profile, 'id' | 'nickname' | 'avatarUrl' | 'ratingAvg'>;
  hasReview: boolean;
}

export interface Review {
  id: string;
  applicationId: string;
  jobPostId: string;
  reviewerId: string;
  employerId: string;
  ratingPay: number;
  ratingWorkload: number;
  ratingEnvironment: number;
  ratingAccuracy: number;
  wouldWorkAgain: boolean;
  ratingOverall: number;
  content: string;
  isHidden: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewWithAuthor extends Review {
  reviewer: Pick<Profile, 'id' | 'nickname' | 'avatarUrl'>;
  jobTitle: string;
  companyName: string;
}

export interface EmployerRatingSummary {
  employerId: string;
  nickname: string;
  companyName: string;
  ratingAvg: number;
  reviewCount: number;
  breakdown: { pay: number; workload: number; environment: number; accuracy: number };
  /** 0~1 */
  wouldWorkAgainRate: number;
}

export interface CommunityPost {
  id: string;
  authorId: string;
  category: CommunityCategory;
  title: string;
  content: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  isHidden: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CommunityPostWithAuthor extends CommunityPost {
  author: Pick<Profile, 'id' | 'nickname' | 'avatarUrl'>;
  likedByMe: boolean;
}

export interface CommunityComment {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  isHidden: boolean;
  createdAt: string;
}

export interface CommunityCommentWithAuthor extends CommunityComment {
  author: Pick<Profile, 'id' | 'nickname' | 'avatarUrl'>;
}

export interface Report {
  id: string;
  reporterId: string;
  targetType: ReportTarget;
  targetId: string;
  reason: string;
  detail: string | null;
  status: ReportStatus;
  handledBy: string | null;
  createdAt: string;
}

export interface ReportWithContext extends Report {
  reporter: Pick<Profile, 'id' | 'nickname'>;
  /** 신고 대상 원문 요약 (삭제되었으면 null) */
  targetSummary: { title: string; body: string; isHidden: boolean } | null;
}

/* ───────────────── 입력 타입 ───────────────── */

export interface CreateJobInput {
  title: string;
  companyName: string;
  category: JobCategory;
  description: string;
  workDate: string;
  startTime: string;
  endTime: string;
  payType: PayType;
  payAmount: number;
  headcount: number;
  placeName: string;
  address?: string | null;
  lat: number;
  lng: number;
  requirements?: string | null;
  belongings?: string | null;
}

export type UpdateJobInput = Partial<CreateJobInput> & { status?: JobStatus };

export interface NearbyJobsParams {
  lat: number;
  lng: number;
  /** 기본 5000 */
  radiusM?: number;
  category?: JobCategory | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  payType?: PayType | null;
  minPay?: number | null;
  keyword?: string | null;
  sort?: 'distance' | 'pay' | 'recent';
  page?: number;
  pageSize?: number;
}

export interface CreateReviewInput {
  applicationId: string;
  ratingPay: number;
  ratingWorkload: number;
  ratingEnvironment: number;
  ratingAccuracy: number;
  wouldWorkAgain: boolean;
  content: string;
}

export type UpdateReviewInput = Omit<CreateReviewInput, 'applicationId'>;

export interface CreatePostInput {
  category: CommunityCategory;
  title: string;
  content: string;
}

export interface CreateReportInput {
  targetType: ReportTarget;
  targetId: string;
  reason: string;
  detail?: string | null;
}

export interface SignUpInput {
  email: string;
  password: string;
  nickname: string;
  phone?: string;
}
