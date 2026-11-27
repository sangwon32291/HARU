import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Briefcase, Home, MapPin, MessageSquare, Plus, Search, Shield, Sparkles, User } from 'lucide-react';
import { getMyJobs } from '@/services/jobs';
import { useAuth } from '@/features/auth/AuthContext';
import { useLocationContext } from '@/features/location/LocationContext';
import { Button } from '@/components/ui';
import { cn } from '@/lib/format';

const NAV = [
  { to: '/', label: '홈', icon: Home, end: true },
  { to: '/jobs', label: '주변 일자리', icon: MapPin, end: false },
  { to: '/community', label: '커뮤니티', icon: MessageSquare, end: false },
  { to: '/my', label: '마이페이지', icon: User, end: false },
];

export function AppLayout() {
  const { user, isAdmin } = useAuth();
  const { label: locationLabel } = useLocationContext();
  const navigate = useNavigate();
  const location = useLocation();
  const [keyword, setKeyword] = useState('');

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = keyword.trim();
    navigate(q ? `/jobs?q=${encodeURIComponent(q)}` : '/jobs');
  };

  /**
   * FAB 분기.
   * 한 계정이 구직·구인을 겸하는 구조라 역할 컬럼이 없다. 그래서 "등록한 공고가 있는가"로
   * 판정한다. 공고가 0건이면 구직자로 보고 '맞춤 추천'을, 하나라도 있으면 구인자로 보고
   * '공고 등록'을 띄운다. 구직자도 마이페이지 → 등록한 공고에서 언제든 공고를 올릴 수 있다.
   */
  const [isEmployer, setIsEmployer] = useState<boolean | null>(null);
  useEffect(() => {
    if (!user) {
      setIsEmployer(null);
      return;
    }
    let alive = true;
    getMyJobs().then((res) => {
      if (alive) setIsEmployer((res.data?.length ?? 0) > 0);
    });
    return () => {
      alive = false;
    };
  }, [user]);

  const hideFab =
    location.pathname.startsWith('/jobs/new') ||
    location.pathname.startsWith('/login') ||
    location.pathname.startsWith('/recommend');

  // 로그인 전이거나 판정 중이면 기존대로 공고 등록을 보여준다.
  const showRecommendFab = Boolean(user) && isEmployer === false;

  return (
    <div className="flex min-h-full flex-col bg-haru-bg">
      <header className="sticky top-0 z-40 border-b border-haru-border bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="HARU 홈">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-haru-primary text-sm font-black text-white">
              H
            </span>
            <span className="text-lg font-black tracking-tight text-haru-primary-dark">HARU</span>
          </Link>

          <Link
            to="/jobs"
            className="hidden shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-haru-sub hover:bg-haru-bg sm:flex"
          >
            <MapPin className="h-4 w-4 text-haru-primary" aria-hidden />
            {locationLabel}
          </Link>

          <form onSubmit={submitSearch} className="relative hidden flex-1 md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-haru-sub" aria-hidden />
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="어떤 일을 찾으세요? (예: 상하차, 카페)"
              aria-label="일자리 검색"
              className="h-10 w-full rounded-xl border border-haru-border bg-haru-bg pl-9 pr-3 text-sm focus:border-haru-primary focus:bg-white focus:outline-none"
            />
          </form>

          <nav className="ml-auto hidden items-center gap-1 md:flex">
            {NAV.slice(1).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
                    isActive ? 'bg-haru-secondary text-haru-primary-dark' : 'text-haru-sub hover:bg-haru-bg',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
            {isAdmin && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold',
                    isActive ? 'bg-haru-secondary text-haru-primary-dark' : 'text-haru-sub hover:bg-haru-bg',
                  )
                }
              >
                <Shield className="h-4 w-4" aria-hidden />
                관리자
              </NavLink>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-2 md:ml-0">
            {user ? (
              <Link to="/my" className="hidden items-center gap-2 md:flex">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-haru-secondary text-xs font-bold text-haru-primary-dark">
                  {user.nickname.slice(0, 1)}
                </span>
              </Link>
            ) : (
              <Link to="/login">
                <Button size="sm" variant="outline">
                  로그인
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-4 md:pb-16">
        <Outlet />
      </main>

      <footer className="hidden border-t border-haru-border bg-white px-4 py-8 md:block">
        <div className="mx-auto max-w-6xl text-xs leading-relaxed text-haru-sub">
          <p className="font-semibold text-haru-text">HARU — 내 주변의 하루 일자리, 믿을 수 있는 후기와 함께</p>
          <p className="mt-2">
            학교 팀 프로젝트용 데모 서비스입니다. 실제 채용·급여 지급·결제 기능은 제공하지 않습니다.
          </p>
          <p className="mt-1">
            지도는 외부 지도 API 없이 자체 구현(Web Mercator 투영)했습니다. 행정 경계 데이터를 사용하는 경우 출처를 이곳에 표기합니다.
          </p>
        </div>
      </footer>

      {/* FAB — 구직자에게는 맞춤 추천, 구인자에게는 공고 등록 */}
      {!hideFab && (
        <Link
          to={showRecommendFab ? '/recommend' : '/jobs/new'}
          className="fixed bottom-24 right-4 z-40 flex h-14 items-center gap-2 rounded-full bg-haru-primary px-5 text-sm font-bold text-white shadow-float transition-transform hover:scale-[1.03] md:bottom-8"
        >
          {showRecommendFab ? (
            <>
              <Sparkles className="h-5 w-5" aria-hidden />
              맞춤 추천
            </>
          ) : (
            <>
              <Plus className="h-5 w-5" aria-hidden />
              공고 등록
            </>
          )}
        </Link>
      )}

      {/* 모바일 하단 네비게이션 */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-haru-border bg-white/95 backdrop-blur md:hidden">
        <div className="flex h-16">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex flex-1 flex-col items-center justify-center gap-1 text-xs font-medium',
                  isActive ? 'text-haru-primary' : 'text-haru-sub',
                )
              }
            >
              <item.icon className="h-5 w-5" aria-hidden />
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
  backTo,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  backTo?: string;
}) {
  const navigate = useNavigate();
  return (
    <div className="mb-5">
      {backTo !== undefined && (
        <button
          type="button"
          onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
          className="mb-2 text-sm font-medium text-haru-sub hover:text-haru-text"
        >
          ← 뒤로
        </button>
      )}
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-black tracking-tight">{title}</h1>
          {description && <p className="mt-1 text-sm text-haru-sub">{description}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}

export { Briefcase };
