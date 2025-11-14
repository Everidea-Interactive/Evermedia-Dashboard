import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.tsx';
import LoginPage from './pages/LoginPage.tsx';
import CampaignsPage from './pages/CampaignsPage.tsx';
import CampaignDetailPage from './pages/CampaignDetailPage.tsx';
import CampaignEditPage from './pages/CampaignEditPage.tsx';
import AccountKpiEditPage from './pages/AccountKpiEditPage.tsx';
import CampaignKpiPage from './pages/CampaignKpiPage.tsx';
import CampaignAccountsPage from './pages/CampaignAccountsPage.tsx';
import PostsPage from './pages/PostsPage.tsx';
import AccountsPage from './pages/AccountsPage.tsx';
import PicsPage from './pages/PicsPage.tsx';
import ProtectedRoute from './components/ProtectedRoute.tsx';
import AppLayout from './layouts/AppLayout.tsx';

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  );
}

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/', element: <ProtectedLayout><CampaignsPage /></ProtectedLayout> },
  { path: '/campaigns', element: <ProtectedLayout><CampaignsPage /></ProtectedLayout> },
  { path: '/campaigns/:id', element: <ProtectedLayout><CampaignDetailPage /></ProtectedLayout> },
  { path: '/campaigns/:id/edit', element: <ProtectedLayout><CampaignEditPage /></ProtectedLayout> },
  { path: '/campaigns/:id/kpi', element: <ProtectedLayout><CampaignKpiPage /></ProtectedLayout> },
  { path: '/campaigns/:id/posts', element: <ProtectedLayout><PostsPage /></ProtectedLayout> },
  { path: '/campaigns/:id/accounts', element: <ProtectedLayout><CampaignAccountsPage /></ProtectedLayout> },
  { path: '/campaigns/:campaignId/accounts/:accountId/edit', element: <ProtectedLayout><AccountKpiEditPage /></ProtectedLayout> },
  { path: '/accounts', element: <ProtectedLayout><AccountsPage /></ProtectedLayout> },
  { path: '/pics', element: <ProtectedLayout><PicsPage /></ProtectedLayout> },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>
);
