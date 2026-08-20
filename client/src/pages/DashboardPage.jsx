import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../services/api';

function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(user.role.code === 'RESIDENT');

  useEffect(() => {
    if (user.role.code !== 'RESIDENT') return undefined;

    apiRequest('/api/reports/mine?limit=5')
      .then((payload) => setReports(payload.data.reports))
      .finally(() => setReportsLoading(false));

    return undefined;
  }, [user.role.code]);

  async function handleLogout() {
    await logout();
    navigate('/', { replace: true });
  }

  return (
    <main className="container py-5">
      <div className="d-flex justify-content-between align-items-start gap-3 mb-4">
        <div>
          <span className="eyebrow">Authenticated area</span>
          <h1 className="h2 mt-2">Welcome, {user.profile.firstName}</h1>
          <p className="text-secondary mb-0">Your FloodNet account is active.</p>
        </div>
        <button className="btn btn-outline-secondary" type="button" onClick={handleLogout}>Sign out</button>
      </div>

      <div className="row g-4">
        <div className="col-md-4">
          <div className="card border-0 shadow-sm h-100 p-4">
            <div className="text-secondary small">Role</div>
            <div className="fw-semibold mt-1">{user.role.displayName}</div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card border-0 shadow-sm h-100 p-4">
            <div className="text-secondary small">Email</div>
            <div className="fw-semibold mt-1 text-break">{user.email}</div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card border-0 shadow-sm h-100 p-4">
            <div className="text-secondary small">Account status</div>
            <div className="fw-semibold mt-1">{user.status}</div>
          </div>
        </div>
      </div>

      {user.role.code === 'RESIDENT' && (
        <section className="card border-0 shadow-sm p-4 mt-4">
          <div className="d-flex justify-content-between align-items-center gap-3 mb-3">
            <h2 className="h5 mb-0">Recent flood reports</h2>
            <Link className="btn btn-sm btn-outline-primary" to="/reports">View all reports</Link>
          </div>
          {reportsLoading && <div className="text-secondary">Loading reports...</div>}
          {!reportsLoading && reports.length === 0 && (
            <div className="text-secondary">You have not submitted a report yet.</div>
          )}
          {!reportsLoading && reports.length > 0 && (
            <div className="list-group list-group-flush">
              {reports.map((report) => (
                <Link className="list-group-item list-group-item-action px-0" to={`/reports/${report.id}`} key={report.id}>
                  <div className="d-flex justify-content-between gap-3">
                    <span>{report.reportReference} · {report.zone.name}</span>
                    <span className="text-secondary small">{report.status.replaceAll('_', ' ')}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}

export default DashboardPage;
