import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { EmptyState, Spinner } from '@/components/ui';
import { ShieldAlert } from 'lucide-react';

/** 로그인이 필요한 라우트 보호 (AUTH-05). 로그인 후 원래 경로로 복귀한다. */
export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner label="세션 확인 중" />;
  if (!user) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }
  return <Outlet />;
}

/** 관리자 전용 라우트 (ADM-04). 프론트 가드는 편의일 뿐, 실제 권한은 데이터 계층에서 검증한다. */
export function RequireAdmin() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner label="세션 확인 중" />;
  if (!user) {
    const redirect = encodeURIComponent(location.pathname);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }
  if (user.role !== 'admin') {
    return (
      <EmptyState
        icon={<ShieldAlert className="h-6 w-6" aria-hidden />}
        title="접근 권한이 없습니다"
        description="관리자 계정으로 로그인해야 이용할 수 있는 화면입니다."
      />
    );
  }
  return <Outlet />;
}
