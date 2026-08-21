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
import Icon from '../common/Icon';

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

// Shared presentation defaults, so every chart picks up the FloodNet palette
// and typography without each caller repeating the same options.
Chart.defaults.font.family = "'Plus Jakarta Sans', Inter, system-ui, sans-serif";
Chart.defaults.font.size = 12;
Chart.defaults.color = '#4a6980';
Chart.defaults.borderColor = 'rgba(218, 231, 240, 0.9)';
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.boxWidth = 8;
Chart.defaults.plugins.legend.labels.padding = 16;
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(7, 32, 51, 0.94)';
Chart.defaults.plugins.tooltip.padding = 12;
Chart.defaults.plugins.tooltip.cornerRadius = 10;
Chart.defaults.plugins.tooltip.titleFont = { weight: '700' };
Chart.defaults.elements.bar.borderRadius = 6;
Chart.defaults.elements.bar.borderSkipped = false;
Chart.defaults.elements.point.radius = 3;
Chart.defaults.elements.point.hoverRadius = 6;
Chart.defaults.elements.arc.borderWidth = 0;

/**
 * Wraps a Chart.js canvas in a titled card. The chart instance is destroyed and
 * rebuilt whenever the data changes so no stale canvas is left behind.
 */
function ChartCard({
  title,
  description,
  type,
  data,
  options,
  height = 260,
  isEmpty,
  emptyDescription,
  icon = 'chart'
}) {
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
    <section className="panel-card h-100 p-3 p-md-4 fn-anim-up">
      <div className="d-flex align-items-start gap-2 mb-3">
        <span className="feature-icon" style={{ width: '2.2rem', height: '2.2rem', marginBottom: 0 }}>
          <Icon name={icon} size={15} strokeWidth={2} />
        </span>
        <div>
          <h2 className="h6 fw-bold mb-0">{title}</h2>
          {description && <p className="small text-secondary mb-0">{description}</p>}
        </div>
      </div>

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
