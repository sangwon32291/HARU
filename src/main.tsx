import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { AuthProvider } from '@/features/auth/AuthContext';
import { LocationProvider } from '@/features/location/LocationContext';
import { ToastProvider } from '@/components/ui/toast';
import './index.css';

/** 라우트 이동 시 스크롤을 맨 위로 (SPA 기본 동작 보완) */
function ScrollToTop() {
  const { pathname } = window.location;
  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <LocationProvider>
            <ScrollToTop />
            <App />
          </LocationProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
