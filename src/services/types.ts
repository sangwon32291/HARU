/** 모든 서비스 함수의 공통 반환 타입. 예외를 던지지 않고 Result로 돌려준다. */
export type Result<T> = { data: T; error: null } | { data: null; error: ServiceError };

export interface ServiceError {
  code: ServiceErrorCode;
  message: string;
  cause?: unknown;
}

export type ServiceErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_FAILED'
  | 'DUPLICATE_APPLICATION'
  | 'DUPLICATE_REVIEW'
  | 'DUPLICATE_REPORT'
  | 'SELF_APPLY'
  | 'JOB_CLOSED'
  | 'NOT_COMPLETED'
  | 'INVALID_TRANSITION'
  | 'INVALID_STATE'
  | 'EMAIL_TAKEN'
  | 'NICKNAME_TAKEN'
  | 'INVALID_CREDENTIALS'
  | 'LOCATION_REQUIRED'
  | 'UNKNOWN';

export const ERROR_MESSAGE: Record<ServiceErrorCode, string> = {
  UNAUTHENTICATED: '로그인이 필요합니다.',
  FORBIDDEN: '권한이 없습니다.',
  NOT_FOUND: '대상을 찾을 수 없습니다.',
  VALIDATION_FAILED: '입력값을 다시 확인해 주세요.',
  DUPLICATE_APPLICATION: '이미 지원한 공고입니다.',
  DUPLICATE_REVIEW: '이미 후기를 작성했습니다.',
  DUPLICATE_REPORT: '이미 신고한 대상입니다.',
  SELF_APPLY: '본인이 등록한 공고에는 지원할 수 없습니다.',
  JOB_CLOSED: '모집이 마감된 공고입니다.',
  NOT_COMPLETED: '근무가 완료된 지원 건만 후기를 작성할 수 있습니다.',
  INVALID_TRANSITION: '허용되지 않는 상태 변경입니다.',
  INVALID_STATE: '현재 상태에서는 처리할 수 없습니다.',
  EMAIL_TAKEN: '이미 가입된 이메일입니다.',
  NICKNAME_TAKEN: '이미 사용 중인 닉네임입니다.',
  INVALID_CREDENTIALS: '이메일 또는 비밀번호가 올바르지 않습니다.',
  LOCATION_REQUIRED: '위치 정보가 필요합니다.',
  UNKNOWN: '알 수 없는 오류가 발생했습니다.',
};

export function ok<T>(data: T): Result<T> {
  return { data, error: null };
}

export function fail<T>(code: ServiceErrorCode, message?: string, cause?: unknown): Result<T> {
  return { data: null, error: { code, message: message ?? ERROR_MESSAGE[code], cause } };
}

/** 네트워크 지연을 흉내 내 로딩 상태를 실제처럼 검증할 수 있게 한다. */
export function delay(ms = 180): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
