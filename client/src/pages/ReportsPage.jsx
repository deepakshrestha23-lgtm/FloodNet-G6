import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../services/api';

const statuses = [
  '',
  'PENDING_REVIEW',
  'MORE_INFORMATION_REQUIRED',
  'VERIFIED',
  'REJECTED',
  'CLOSED'
];

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function ReportsPage() {
  const [reports, setReports] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    const query = status ? `?status=${encodeURIComponent(status)}&limit=100` : '?limit=100';
    apiRequest(`/api/reports/mine${query}`)
      .then((payload) => {
        if (active) setReports(payload.data.reports);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [status]);

  return (
    <main className="container py-5">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <span className="eyebrow">Resident module</span>
          <h1 className="h2 mt-2 mb-1">My flood reports</h1>
          <p className="text-secondary mb-0">Track reports you have submitted to FloodNet.</p>
        </div>
        <Link className="btn btn-primary" to="/reports/new">Submit a report</Link>
      </div>

      <div className="card border-0 shadow-sm p-3 mb-4">
        <label className="form-label mb-1" htmlFor="report-status-filter">Filter by status</label>
        <select id="report-status-filter" className="form-select" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          {statuses.slice(1).map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}
        </select>
      </div>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {loading && <div className="text-secondary">Loading your reports...</div>}
      {!loading && !error && reports.length === 0 && (
        <div className="empty-state text-center p-5">
          <h2 className="h5">No reports found</h2>
          <p className="text-secondary mb-3">Submit a report when you observe a flood incident.</p>
          <Link className="btn btn-outline-primary" to="/reports/new">Submit your first report</Link>
        </div>
      )}

      {!loading && reports.length > 0 && (
        <div className="row g-4">
          {reports.map((report) => (
            <div className="col-lg-6" key={report.id}>
              <article className="card border-0 shadow-sm h-100 p-4">
                <div className="d-flex justify-content-between align-items-start gap-3">
                  <div>
                    <div className="text-secondary small">{report.reportReference}</div>
                    <h2 className="h5 mt-1">{report.zone.name}</h2>
                  </div>
                  <span className={`badge text-bg-${report.status === 'VERIFIED' ? 'success' : report.status === 'REJECTED' ? 'danger' : report.status === 'MORE_INFORMATION_REQUIRED' ? 'warning' : 'secondary'}`}>
                    {report.status.replaceAll('_', ' ')}
                  </span>
                </div>
                <p className="mb-2">{report.locationDescription}</p>
                <div className="text-secondary small mb-3">Observed {formatDate(report.observedAt)}</div>
                <Link to={`/reports/${report.id}`} className="btn btn-sm btn-outline-primary align-self-start">View report</Link>
              </article>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

export default ReportsPage;
