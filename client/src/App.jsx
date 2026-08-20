import { useEffect, useState } from 'react';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';
import DashboardPage from './pages/DashboardPage';
import ForbiddenPage from './pages/ForbiddenPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ReportsPage from './pages/ReportsPage';
import ReportFormPage from './pages/ReportFormPage';
import ReportDetailPage from './pages/ReportDetailPage';

function PublicHomePage() {
  const { isAuthenticated, user } = useAuth();
  const [healthStatus, setHealthStatus] = useState('checking');

  useEffect(() => {
    fetch('/api/health')
      .then((response) => {
        if (!response.ok) throw new Error('Health check failed');
        return response.json();
      })
      .then(() => setHealthStatus('ok'))
      .catch(() => setHealthStatus('unavailable'));
  }, []);

  return (
    <main className="app-shell container py-5">
      <div className="hero-panel p-4 p-md-5 rounded-4 shadow-sm">
        <div className="d-flex justify-content-between align-items-start gap-3">
          <span className="eyebrow">FloodNet</span>
          {isAuthenticated ? (
            <Link className="btn btn-outline-primary btn-sm" to="/dashboard">My dashboard</Link>
          ) : (
            <Link className="btn btn-primary btn-sm" to="/login">Sign in</Link>
          )}
        </div>
        <h1 className="display-5 fw-bold mt-4">Flood information people can trust.</h1>
        <p className="lead mb-4">
          A coordinated platform for community reports, verified incidents,
          official alerts and evacuation-centre information.
        </p>
        <div className="status-card d-flex align-items-center gap-3">
          <span className={`status-dot status-${healthStatus}`} aria-hidden="true" />
          <div>
            <div className="fw-semibold">Application status</div>
            <div className="text-secondary">
              {healthStatus === 'ok' ? 'Application running' : healthStatus === 'checking' ? 'Checking...' : 'Unavailable'}
            </div>
          </div>
        </div>
        {!isAuthenticated && (
          <p className="mt-4 mb-0 text-secondary">
            Residents can <Link to="/register">create an account</Link> to prepare for reporting features.
          </p>
        )}
        {isAuthenticated && <p className="mt-4 mb-0 text-secondary">Signed in as {user.email}.</p>}
      </div>
    </main>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicHomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forbidden" element={<ForbiddenPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardPage />} />
        </Route>
        <Route element={<ProtectedRoute allowedRoles={['RESIDENT']} />}>
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/reports/new" element={<ReportFormPage />} />
          <Route path="/reports/:id" element={<ReportDetailPage />} />
          <Route path="/reports/:id/edit" element={<ReportFormPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
