import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.tsx';
import { ThemeProvider } from './context/ThemeContext.tsx';
import ProtectedRoute from './components/ProtectedRoute.tsx';
import RequireRole from './components/RequireRole.tsx';
import AppLayout from './layouts/AppLayout.tsx';

// Keep LoginPage as regular import (needed immediately)
import LoginPage from './pages/LoginPage.tsx';

// Lazy load all other pages for code splitting
const CampaignsPage = lazy(() => import('./pages/CampaignsPage.tsx'));
const CampaignDetailPage = lazy(() => import('./pages/CampaignDetailPage.tsx'));
const CampaignEditPage = lazy(() => import('./pages/CampaignEditPage.tsx'));
const CampaignKpiPage = lazy(() => import('./pages/CampaignKpiPage.tsx'));
const CampaignAccountsPage = lazy(() => import('./pages/CampaignAccountsPage.tsx'));
const PostsPage = lazy(() => import('./pages/PostsPage.tsx'));
const DailyPage = lazy(() => import('./pages/DailyPage.tsx'));
const AllPostsPage = lazy(() => import('./pages/AllPostsPage.tsx'));
const AccountsPage = lazy(() => import('./pages/AccountsPage.tsx'));
const PicsPage = lazy(() => import('./pages/PicsPage.tsx'));
const UsersPage = lazy(() => import('./pages/UsersPage.tsx'));
const ActivityLogsPage = lazy(() => import('./pages/ActivityLogsPage.tsx'));

// Loading fallback component
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading...</p>
      </div>
    </div>
  );
}

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AppLayout>
        <Suspense fallback={<PageLoader />}>
          {children}
        </Suspense>
      </AppLayout>
    </ProtectedRoute>
  );
}

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/', element: <ProtectedLayout><CampaignsPage /></ProtectedLayout> },
  { path: '/campaigns', element: <ProtectedLayout><CampaignsPage /></ProtectedLayout> },
  { path: '/campaigns/:id', element: <ProtectedLayout><CampaignDetailPage /></ProtectedLayout> },
  { 
    path: '/campaigns/:id/edit', 
    element: (
      <ProtectedLayout>
        <RequireRole roles={['ADMIN', 'CAMPAIGN_MANAGER']}>
          <CampaignEditPage />
        </RequireRole>
      </ProtectedLayout>
    )
  },
  { path: '/campaigns/:id/kpi', element: <ProtectedLayout><CampaignKpiPage /></ProtectedLayout> },
  { path: '/campaigns/:id/posts', element: <ProtectedLayout><PostsPage /></ProtectedLayout> },
  { path: '/posts/new', element: <ProtectedLayout><PostsPage /></ProtectedLayout> },
  { path: '/daily', element: <ProtectedLayout><DailyPage /></ProtectedLayout> },
  { path: '/posts/all', element: <ProtectedLayout><AllPostsPage /></ProtectedLayout> },
  { path: '/campaigns/:id/accounts', element: <ProtectedLayout><CampaignAccountsPage /></ProtectedLayout> },
  { path: '/accounts', element: <ProtectedLayout><AccountsPage /></ProtectedLayout> },
  { path: '/pics', element: <ProtectedLayout><PicsPage /></ProtectedLayout> },
  { 
    path: '/users', 
    element: (
      <ProtectedLayout>
        <RequireRole roles={['ADMIN']}>
          <UsersPage />
        </RequireRole>
      </ProtectedLayout>
    )
  },
  { 
    path: '/activity-logs', 
    element: (
      <ProtectedLayout>
        <RequireRole roles={['ADMIN']}>
          <ActivityLogsPage />
        </RequireRole>
      </ProtectedLayout>
    )
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>
);
