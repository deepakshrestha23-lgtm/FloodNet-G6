import { useEffect, useRef } from 'react';
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip
} from 'chart.js';
import EmptyState from '../common/EmptyState';

// Only the controllers and elements FloodNet actually renders are registered,
// which keeps the production bundle smaller than importing all of Chart.js.
Chart.register(
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  DoughnutController,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip
);

/**
 * Wraps a Chart.js canvas in a titled card. The chart instance is destroyed and
 * rebuilt whenever the data changes so no stale canvas is left behind.
 */
function ChartCard({ title, description, type, data, options, height = 260, isEmpty, emptyDescription }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (isEmpty || !canvasRef.current) return undefined;

    chartRef.current = new Chart(canvasRef.current, {
      type,
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        ...options
      }
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [type, data, options, isEmpty]);

  return (
    <section className="panel-card h-100 p-3 p-md-4 rounded-4">
      <h2 className="h6 fw-semibold mb-1">{title}</h2>
      {description && <p className="small text-secondary mb-3">{description}</p>}
      {isEmpty ? (
        <EmptyState
          title="No data yet"
          description={emptyDescription || 'This chart will populate as records are added.'}
        />
      ) : (
        <div style={{ height }}>
          <canvas ref={canvasRef} role="img" aria-label={title} />
        </div>
      )}
    </section>
  );
}

export default ChartCard;
