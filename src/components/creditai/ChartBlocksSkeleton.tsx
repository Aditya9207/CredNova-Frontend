/**
 * Placeholder while Recharts chunks load (lazy import). Reduces perceived wait vs blank space.
 */
export default function ChartBlocksSkeleton() {
  return (
    <div className="crednova-chart-skeleton" aria-hidden>
      <div className="crednova-chart-skeleton__card">
        <div className="crednova-chart-skeleton__title shimmer" />
        <div className="crednova-chart-skeleton__kpis">
          <div className="shimmer crednova-chart-skeleton__kpi" />
          <div className="shimmer crednova-chart-skeleton__kpi" />
          <div className="shimmer crednova-chart-skeleton__kpi" />
        </div>
        <div className="crednova-chart-skeleton__bars">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="crednova-chart-skeleton__bar-row">
              <div className="shimmer crednova-chart-skeleton__bar-label" />
              <div className="shimmer crednova-chart-skeleton__bar" style={{ width: `${40 + (i % 4) * 12}%` }} />
            </div>
          ))}
        </div>
      </div>
      <div className="crednova-chart-skeleton__card crednova-chart-skeleton__card--insights">
        <div className="crednova-chart-skeleton__title shimmer" style={{ width: "55%" }} />
        <div className="crednova-chart-skeleton__split">
          <div className="shimmer crednova-chart-skeleton__donut" />
          <div className="crednova-chart-skeleton__table">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="crednova-chart-skeleton__row shimmer" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
