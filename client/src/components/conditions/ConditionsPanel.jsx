import { useEffect, useState } from 'react';
import { fetchConditions } from '../../services/conditionsApi';
import Icon from '../common/Icon';

/**
 * River discharge and rainfall for one coordinate.
 *
 * This is supporting context, never a verdict. A modelled catchment figure
 * cannot see a blocked culvert on one street, so the panel is deliberately
 * framed as something to weigh rather than something that decides, and it
 * always names its source.
 *
 * Every failure state renders as a quiet note instead of an error: the screen
 * around it must stay usable when the feature is switched off or the upstream
 * is unreachable.
 */

const TREND = {
  RISING: { label: 'Rising', tone: 'danger', symbol: '▲' },
  FALLING: { label: 'Falling', tone: 'success', symbol: '▼' },
  STEADY: { label: 'Steady', tone: 'secondary', symbol: '=' }
};

/** Sparkline drawn from the daily series, so the shape is visible at a glance. */
function Sparkline({ days, tone }) {
  if (!days || days.length < 2) return null;

  const values = days.map((day) => day.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const width = 100;
  const height = 28;

  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - min) / span) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg
      className={`fn-conditions-spark text-${tone}`}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Trend from ${values[0]} to ${values[values.length - 1]}`}
    >
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function ConditionsPanel({ latitude, longitude, title = 'River and rainfall conditions' }) {
  const [state, setState] = useState({ loading: true, conditions: null });

  useEffect(() => {
    if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
      setState({ loading: false, conditions: null });
      return undefined;
    }

    let active = true;
    setState({ loading: true, conditions: null });

    fetchConditions(latitude, longitude)
      .then((payload) => { if (active) setState({ loading: false, conditions: payload.data.conditions }); })
      // A failed request is treated exactly like an unavailable reading: this
      // panel must never be the reason an officer cannot work.
      .catch(() => { if (active) setState({ loading: false, conditions: { available: false, reason: 'The conditions service could not be reached' } }); });

    return () => { active = false; };
  }, [latitude, longitude]);

  if (latitude === null || latitude === undefined) return null;

  const { loading, conditions } = state;

  if (loading) {
    return (
      <section className="panel-card fn-conditions p-3 p-md-4 rounded-4">
        <h2 className="h6 fw-bold fn-section-title mb-0">
          <Icon name="wave" size={18} />
          {title}
        </h2>
        <p className="small text-secondary mb-0 mt-2" role="status">Checking river and rainfall data...</p>
      </section>
    );
  }

  if (!conditions || !conditions.available) {
    return (
      <section className="panel-card fn-conditions p-3 p-md-4 rounded-4">
        <h2 className="h6 fw-bold fn-section-title mb-0">
          <Icon name="wave" size={18} />
          {title}
        </h2>
        <p className="small text-secondary mb-0 mt-2">
          {conditions?.reason || 'Conditions are not available for this location.'}
        </p>
      </section>
    );
  }

  const { riverDischarge, rainfall, source, cached } = conditions;
  const trend = riverDischarge ? (TREND[riverDischarge.trend] || TREND.STEADY) : null;

  return (
    <section className="panel-card fn-conditions p-3 p-md-4 rounded-4">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-1">
        <h2 className="h6 fw-bold fn-section-title mb-0">
          <Icon name="wave" size={18} />
          {title}
        </h2>
        {cached && <span className="badge text-bg-secondary">Cached</span>}
      </div>

      <p className="small text-secondary mb-3">
        Modelled forecast for these coordinates. Supporting context only, not a verification.
      </p>

      <div className="row g-3">
        {riverDischarge && (
          <div className="col-12 col-sm-6">
            <p className="fn-conditions-label mb-1">River discharge</p>
            <p className="fn-conditions-value mb-1">
              {riverDischarge.today}
              <span className="fn-conditions-unit"> {riverDischarge.unit}</span>
            </p>
            <p className={`small mb-2 text-${trend.tone} fw-semibold`}>
              {trend.symbol} {trend.label}
              {riverDischarge.changePercent !== 0 && (
                <span className="fw-normal text-secondary">
                  {' '}peaks at {riverDischarge.peak} {riverDischarge.unit} ({riverDischarge.changePercent > 0 ? '+' : ''}{riverDischarge.changePercent}%)
                </span>
              )}
            </p>
            <Sparkline days={riverDischarge.days} tone={trend.tone} />
          </div>
        )}

        {rainfall && (
          <div className="col-12 col-sm-6">
            <p className="fn-conditions-label mb-1">Rainfall</p>
            <p className="fn-conditions-value mb-1">
              {rainfall.next48hTotal}
              <span className="fn-conditions-unit"> {rainfall.unit} / 48h</span>
            </p>
            <p className="small text-secondary mb-2">{rainfall.today} {rainfall.unit} forecast today</p>
            <Sparkline days={rainfall.days} tone="primary" />
          </div>
        )}
      </div>

      <p className="fn-conditions-source mb-0 mt-3">Source: {source}</p>
    </section>
  );
}

export default ConditionsPanel;
