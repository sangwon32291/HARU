import { Link, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { RequireAdmin, RequireAuth } from '@/features/auth/RequireAuth';
import { HomePage } from '@/pages/HomePage';
import { JobsPage } from '@/pages/JobsPage';
import { JobDetailPage } from '@/pages/JobDetailPage';
import { JobFormPage } from '@/pages/JobFormPage';
import { LoginPage, SignupPage } from '@/pages/AuthPages';
import {
  MyApplicationsPage,
  MyJobsPage,
  MyPage,
  MyPostsPage,
  MyProfilePage,
  MyReviewsPage,
} from '@/pages/MyPages';
import { ApplicantsPage } from '@/pages/ApplicantsPage';
import { EmployerReviewsPage, ReviewFormPage } from '@/pages/ReviewPages';
import { CommunityDetailPage, CommunityFormPage, CommunityPage } from '@/pages/CommunityPages';
import { AdminPage } from '@/pages/AdminPage';
import { RecommendPage } from '@/pages/RecommendPage';
import { Button, EmptyState } from '@/components/ui';

function NotFoundPage() {
  return (
    <EmptyState
      title="페이지를 찾을 수 없습니다"
      description="주소가 바뀌었거나 삭제된 페이지일 수 있습니다."
      action={
        <Link to="/">
          <Button>홈으로</Button>
        </Link>
      }
    />
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        {/* 공개 라우트 */}
        <Route path="/" element={<HomePage />} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/jobs/:id" element={<JobDetailPage />} />
        <Route path="/employers/:id/reviews" element={<EmployerReviewsPage />} />
        <Route path="/community" element={<CommunityPage />} />
        <Route path="/community/:id" element={<CommunityDetailPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        {/* 로그인 필요 */}
        <Route element={<RequireAuth />}>
          <Route path="/recommend" element={<RecommendPage />} />
          <Route path="/jobs/new" element={<JobFormPage />} />
          <Route path="/jobs/:id/edit" element={<JobFormPage />} />
          <Route path="/community/new" element={<CommunityFormPage />} />
          <Route path="/reviews/new" element={<ReviewFormPage />} />
          <Route path="/my" element={<MyPage />} />
          <Route path="/my/profile" element={<MyProfilePage />} />
          <Route path="/my/jobs" element={<MyJobsPage />} />
          <Route path="/my/jobs/:id/applicants" element={<ApplicantsPage />} />
          <Route path="/my/applications" element={<MyApplicationsPage />} />
          <Route path="/my/reviews" element={<MyReviewsPage />} />
          <Route path="/my/posts" element={<MyPostsPage />} />
        </Route>

        {/* 관리자 전용 */}
        <Route element={<RequireAdmin />}>
          <Route path="/admin" element={<AdminPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
