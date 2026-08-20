import { useCallback, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { fetchMyReports } from '../../services/reportApi';
import { useApiResource } from '../../hooks/useApiResource';
import PageHeader from '../../components/common/PageHeader';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import FilterBar from '../../components/common/FilterBar';
import Pagination from '../../components/common/Pagination';
import StatusBadge from '../../components/common/StatusBadge';
import { REPORT_STATUS, OBSERVED_SEVERITY, toOptions } from '../../utils/enums';
import { formatDateTime, formatRelative } from '../../utils/formatters';

const PAGE_SIZE = 12;

function ReportsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const status = searchParams.get('status') || '';
  const offset = Number(searchParams.get('offset') || 0);

  const loader = useCallback(
    () => fetchMyReports({ status: status || undefined, limit: PAGE_SIZE, offset }),
    [status, offset]
  );

  const { data, loading, error, reload } = useApiResource(loader);

  const filters = useMemo(() => ({ status }), [status]);

  function updateFilter(name, value) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(name, value); else next.delete(name);
    next.delete('offset');
    setSearchParams(next);
  }

  function changePage(nextOffset) {
    const next = new URLSearchParams(searchParams);
    next.set('offset', String(nextOffset));
    setSearchParams(next);
  }

  return (
    <>
      <PageHeader
        eyebrow="Resident"
        title="My flood reports"
        description="Track the reports you have submitted and any feedback from a flood monitoring officer."
        actions={<Link className="btn btn-primary" to="/resident/reports/new">Report flooding</Link>}
      />

      <FilterBar
        filters={[{
          name: 'status',
          label: 'Status',
          type: 'select',
          placeholder: 'All statuses',
          columnClass: 'col-12 col-md-6 col-lg-4',
          options: toOptions(REPORT_STATUS)
        }]}
        values={filters}
        onChange={updateFilter}
        onReset={() => setSearchParams(new URLSearchParams())}
      />

      {loading && <LoadingState label="Loading your reports..." />}
      {error && <ErrorState message={error.message} details={error.details} onRetry={reload} />}

      {!loading && !error && data && (
        data.reports.length === 0 ? (
          <EmptyState
            title={status ? 'No reports match this filter' : 'You have not submitted any reports'}
            description={
              status
                ? 'Try clearing the filter to see all of your reports.'
                : 'Reporting what you can see safely helps officers build an accurate picture of the flooding.'
            }
            action={<Link className="btn btn-primary" to="/resident/reports/new">Report flooding</Link>}
          />
        ) : (
          <>
            <div className="row g-3">
              {data.reports.map((report) => (
                <div className="col-12 col-md-6 col-xl-4" key={report.id}>
                  <article className="panel-card p-3 p-md-4 rounded-4 h-100 d-flex flex-column">
                    <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
                      <div>
                        <span className="small text-secondary d-block">{report.reportReference}</span>
                        <h2 className="h6 fw-semibold mb-0 mt-1">{report.zone.name}</h2>
                      </div>
                      <StatusBadge map={REPORT_STATUS} value={report.status} />
                    </div>

                    <p className="small mb-2">{report.locationDescription}</p>

                    <div className="d-flex flex-wrap gap-1 mb-3">
                      <StatusBadge map={OBSERVED_SEVERITY} value={report.observedSeverity} />
                    </div>

                    <p className="small text-secondary mb-3">
                      Observed {formatDateTime(report.observedAt)}
                      <span className="d-block">Submitted {formatRelative(report.createdAt)}</span>
                    </p>

                    {report.status === 'MORE_INFORMATION_REQUIRED' && (
                      <div className="alert alert-info py-2 small mb-3" role="alert">
                        An officer has asked for more information about this report.
                      </div>
                    )}

                    <div className="mt-auto d-flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => navigate(`/resident/reports/${report.id}`)}
                      >
                        View report
                      </button>
                      {report.status === 'MORE_INFORMATION_REQUIRED' && (
                        <Link className="btn btn-sm btn-warning" to={`/resident/reports/${report.id}/edit`}>
                          Add information
                        </Link>
                      )}
                    </div>
                  </article>
                </div>
              ))}
            </div>

            <Pagination
              total={data.pagination.total}
              limit={data.pagination.limit}
              offset={data.pagination.offset}
              onChange={changePage}
            />
          </>
        )
      )}
    </>
  );
}

export default ReportsPage;
