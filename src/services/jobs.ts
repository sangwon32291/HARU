/**
 * jobs 서비스 — 데이터 소스 분기.
 *
 * VITE_DATA_SOURCE 값에 따라 mock(샘플 데이터) 또는 supabase(실제 DB) 구현으로 연결합니다.
 * 두 구현은 함수 시그니처가 같으므로 화면 코드는 이 파일만 import 하면 됩니다.
 */
import { IS_SUPABASE } from './config';
import * as mock from './mock/jobs';
import * as sb from './supabase/jobs';

export const getNearbyJobs = IS_SUPABASE ? sb.getNearbyJobs : mock.getNearbyJobs;
export const getJobDetail = IS_SUPABASE ? sb.getJobDetail : mock.getJobDetail;
export const createJob = IS_SUPABASE ? sb.createJob : mock.createJob;
export const updateJob = IS_SUPABASE ? sb.updateJob : mock.updateJob;
export const deleteJob = IS_SUPABASE ? sb.deleteJob : mock.deleteJob;
export const closeJob = IS_SUPABASE ? sb.closeJob : mock.closeJob;
export const reopenJob = IS_SUPABASE ? sb.reopenJob : mock.reopenJob;
export const getMyJobs = IS_SUPABASE ? sb.getMyJobs : mock.getMyJobs;
export const devSeedJobsNearby = IS_SUPABASE ? sb.devSeedJobsNearby : mock.devSeedJobsNearby;
export const getFeaturedJobs = IS_SUPABASE ? sb.getFeaturedJobs : mock.getFeaturedJobs;
