/**
 * reports 서비스 — 데이터 소스 분기.
 *
 * VITE_DATA_SOURCE 값에 따라 mock(샘플 데이터) 또는 supabase(실제 DB) 구현으로 연결합니다.
 * 두 구현은 함수 시그니처가 같으므로 화면 코드는 이 파일만 import 하면 됩니다.
 */
import { IS_SUPABASE } from './config';
import * as mock from './mock/reports';
import * as sb from './supabase/reports';

export const createReport = IS_SUPABASE ? sb.createReport : mock.createReport;
export const getReports = IS_SUPABASE ? sb.getReports : mock.getReports;
export const setTargetHidden = IS_SUPABASE ? sb.setTargetHidden : mock.setTargetHidden;
export const resolveReport = IS_SUPABASE ? sb.resolveReport : mock.resolveReport;
export const getAdminStats = IS_SUPABASE ? sb.getAdminStats : mock.getAdminStats;

/** 신고 사유 목록은 DB와 무관한 고정 값이라 양쪽이 공유합니다. */
export { REPORT_REASONS } from './mock/reports';
