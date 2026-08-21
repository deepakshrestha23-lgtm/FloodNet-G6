import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';
import { roleHomePath } from './routes/roleHome';
import AppLayout from './layouts/AppLayout';

import PublicHomePage from './pages/public/PublicHomePage';
import PublicAlertsPage from './pages/public/PublicAlertsPage';
import PublicLayout from './layouts/PublicLayout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForbiddenPage from './pages/ForbiddenPage';
import ProfilePage from './pages/ProfilePage';

import ResidentDashboardPage from './pages/resident/ResidentDashboardPage';
import ReportsPage from './pages/resident/ReportsPage';
import ReportFormPage from './pages/resident/ReportFormPage';
import ReportDetailPage from './pages/resident/ReportDetailPage';
import ResidentAlertsPage from './pages/resident/ResidentAlertsPage';
import CentreDirectoryPage from './pages/resident/CentreDirectoryPage';
import PreparednessPage from './pages/resident/PreparednessPage';

import OfficerDashboardPage from './pages/officer/OfficerDashboardPage';
import ReviewQueuePage from './pages/officer/ReviewQueuePage';
import ReviewReportPage from './pages/officer/ReviewReportPage';
import AlertsPage from './pages/officer/AlertsPage';
import AlertFormPage from './pages/officer/AlertFormPage';

import EvacuationDashboardPage from './pages/evacuation/EvacuationDashboardPage';
import CentreListPage from './pages/evacuation/CentreListPage';
import EvacuationAlertsPage from './pages/evacuation/EvacuationAlertsPage';
import CentreFormPage from './pages/evacuation/CentreFormPage';

import AdminOverviewPage from './pages/admin/AdminOverviewPage';
import UserManagementPage from './pages/admin/UserManagementPage';
import ZoneManagementPage from './pages/admin/ZoneManagementPage';
import MasterDataPage from './pages/admin/MasterDataPage';
import AuditLogPage from './pages/admin/AuditLogPage';

/**
 * Sends a signed-in user to the dashboard for their role. Used by the legacy
 * /dashboard path so existing links keep working.
 */
function RoleHomeRedirect() {
  const { user, loading } = useAuth();

  if (loading) return <div className="container py-5">Checking your session...</div>;
  if (!user) return <Navigate to="/login" replace />;

  return <Navigate to={roleHomePath(user)} replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicHomePage />} />
        {/* Reachable without an account: someone deciding whether to leave
            their house should not have to register first. */}
        <Route path="/alerts" element={<PublicLayout><PublicAlertsPage /></PublicLayout>} />
        <Route
          path="/centres"
          element={(
            <PublicLayout>
              <div className="container public-section">
                <CentreDirectoryPage eyebrow="Public" />
              </div>
            </PublicLayout>
          )}
        />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forbidden" element={<ForbiddenPage />} />
        <Route path="/dashboard" element={<RoleHomeRedirect />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['RESIDENT']} />}>
          <Route element={<AppLayout />}>
            <Route path="/resident" element={<ResidentDashboardPage />} />
            <Route path="/resident/reports" element={<ReportsPage />} />
            <Route path="/resident/reports/new" element={<ReportFormPage />} />
            <Route path="/resident/reports/:id" element={<ReportDetailPage />} />
            <Route path="/resident/reports/:id/edit" element={<ReportFormPage />} />
            <Route path="/resident/alerts" element={<ResidentAlertsPage />} />
            <Route path="/resident/centres" element={<CentreDirectoryPage />} />
            <Route path="/resident/preparedness" element={<PreparednessPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['FLOOD_MONITORING_OFFICER']} />}>
          <Route element={<AppLayout />}>
            <Route path="/officer" element={<OfficerDashboardPage />} />
            <Route path="/officer/reports" element={<ReviewQueuePage />} />
            <Route path="/officer/reports/:id" element={<ReviewReportPage />} />
            <Route path="/officer/alerts" element={<AlertsPage />} />
            <Route path="/officer/alerts/new" element={<AlertFormPage />} />
            <Route path="/officer/alerts/:id/edit" element={<AlertFormPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['EVACUATION_OFFICER']} />}>
          <Route element={<AppLayout />}>
            <Route path="/evacuation" element={<EvacuationDashboardPage />} />
            <Route path="/evacuation/alerts" element={<EvacuationAlertsPage />} />
            <Route path="/evacuation/centres" element={<CentreListPage />} />
            <Route path="/evacuation/centres/new" element={<CentreFormPage />} />
            <Route path="/evacuation/centres/:id/edit" element={<CentreFormPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['ADMINISTRATOR']} />}>
          <Route element={<AppLayout />}>
            <Route path="/admin" element={<AdminOverviewPage />} />
            <Route path="/admin/users" element={<UserManagementPage />} />
            <Route path="/admin/zones" element={<ZoneManagementPage />} />
            <Route path="/admin/master-data" element={<MasterDataPage />} />
            <Route path="/admin/audit" element={<AuditLogPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
