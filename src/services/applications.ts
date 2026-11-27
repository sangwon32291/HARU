/**
 * applications 서비스 — 데이터 소스 분기.
 *
 * VITE_DATA_SOURCE 값에 따라 mock(샘플 데이터) 또는 supabase(실제 DB) 구현으로 연결합니다.
 * 두 구현은 함수 시그니처가 같으므로 화면 코드는 이 파일만 import 하면 됩니다.
 */
import { IS_SUPABASE } from './config';
import * as mock from './mock/applications';
import * as sb from './supabase/applications';

export const applyToJob = IS_SUPABASE ? sb.applyToJob : mock.applyToJob;
export const cancelApplication = IS_SUPABASE ? sb.cancelApplication : mock.cancelApplication;
export const getApplicants = IS_SUPABASE ? sb.getApplicants : mock.getApplicants;
export const getMyApplications = IS_SUPABASE ? sb.getMyApplications : mock.getMyApplications;
export const updateApplicationStatus = IS_SUPABASE ? sb.updateApplicationStatus : mock.updateApplicationStatus;
export const devForceComplete = IS_SUPABASE ? sb.devForceComplete : mock.devForceComplete;
