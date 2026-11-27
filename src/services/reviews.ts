/**
 * reviews 서비스 — 데이터 소스 분기.
 *
 * VITE_DATA_SOURCE 값에 따라 mock(샘플 데이터) 또는 supabase(실제 DB) 구현으로 연결합니다.
 * 두 구현은 함수 시그니처가 같으므로 화면 코드는 이 파일만 import 하면 됩니다.
 */
import { IS_SUPABASE } from './config';
import * as mock from './mock/reviews';
import * as sb from './supabase/reviews';

export const getJobReviews = IS_SUPABASE ? sb.getJobReviews : mock.getJobReviews;
export const getEmployerReviews = IS_SUPABASE ? sb.getEmployerReviews : mock.getEmployerReviews;
export const getEmployerRating = IS_SUPABASE ? sb.getEmployerRating : mock.getEmployerRating;
export const getReviewableApplications = IS_SUPABASE ? sb.getReviewableApplications : mock.getReviewableApplications;
export const getMyReviews = IS_SUPABASE ? sb.getMyReviews : mock.getMyReviews;
export const getReviewByApplication = IS_SUPABASE ? sb.getReviewByApplication : mock.getReviewByApplication;
export const createReview = IS_SUPABASE ? sb.createReview : mock.createReview;
export const updateReview = IS_SUPABASE ? sb.updateReview : mock.updateReview;
export const deleteReview = IS_SUPABASE ? sb.deleteReview : mock.deleteReview;
export const getRecentReviews = IS_SUPABASE ? sb.getRecentReviews : mock.getRecentReviews;
