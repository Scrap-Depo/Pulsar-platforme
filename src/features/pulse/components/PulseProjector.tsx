import { PulseDistribution, PulseProjectorView } from '../model/types';
import { getPulseAverage, getPulseItems } from '../model/utils';
import { PulseMetricDisplay, PulseVisualization } from '../../../shared/types/common';

type PulseProjectorProps = {
  title: string;
  minLabel: string;
  maxLabel: string;
  value: number;
  projectorView: PulseProjectorView;
  distribution: PulseDistribution;
  visualization?: PulseVisualization;
  metricDisplay?: PulseMetricDisplay;
  compact?: boolean;
};

export default function PulseProjector({
  title,
  minLabel,
  maxLabel,
  value,
  projectorView,
  distribution,
  visualization = 'bars',
  metricDisplay = 'both',
  compact = false,
}: PulseProjectorProps) {
  const items = getPulseItems(distribution);
  const average = getPulseAverage(distribution);
  const showAverage = metricDisplay === 'average' || metricDisplay === 'both';
  const showParticipant = metricDisplay === 'participant' || metricDisplay === 'both';
  const hasMetrics = showAverage || showParticipant;

  function renderMetricsColumn() {
    if (!hasMetrics) {
      return null;
    }

    const metricCards = [
      showAverage ? (
        <div
          key="average"
          className="card"
          style={{
            padding: compact ? '12px 14px' : '18px 20px',
            minHeight: compact ? 0 : showParticipant ? 0 : 160,
            display: 'grid',
            alignContent: 'space-between',
          }}
        >
          <p className="muted" style={{ margin: 0 }}>Среднее по аудитории</p>
          <strong style={{ fontSize: compact ? (showParticipant ? 28 : 36) : showParticipant ? 44 : 56, lineHeight: 1, marginTop: 12 }}>{average}</strong>
        </div>
      ) : null,
      showParticipant ? (
        <div
          key="participant"
          className="card"
          style={{
            padding: compact ? '12px 14px' : '18px 20px',
            minHeight: compact ? 0 : showAverage ? 0 : 140,
            display: 'grid',
            alignContent: 'space-between',
          }}
        >
          <p className="muted" style={{ margin: 0 }}>Ваш ответ</p>
          <strong style={{ fontSize: compact ? (showAverage ? 24 : 30) : showAverage ? 34 : 48, lineHeight: 1, marginTop: 12 }}>{value}</strong>
        </div>
      ) : null,
    ].filter(Boolean);

    return (
      <aside
        style={{
          display: 'grid',
          gap: 14,
          gridTemplateRows: showAverage && showParticipant ? '1.62fr 1fr' : '1fr',
          minWidth: 0,
        }}
      >
        {metricCards}
      </aside>
    );
  }

  function renderLineChart() {
    return (
      <div className="card" style={{ padding: compact ? 12 : 20 }}>
        <svg viewBox="0 0 900 320" style={{ width: '100%', height: 'auto' }} aria-hidden="true">
          <polyline
            points={items
              .map((item, index) => {
                const x = 40 + index * 90;
                const y = 270 - item.count * 18;
                return `${x},${Math.max(y, 40)}`;
              })
              .join(' ')}
            fill="none"
            stroke="#67e8f9"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {items.map((item, index) => {
            const x = 40 + index * 90;
            const y = Math.max(270 - item.count * 18, 40);

            return (
              <g key={item.value}>
                <circle cx={x} cy={y} r="9" fill={item.value === value ? '#f8fafc' : '#c4b5fd'} />
                <text x={x} y="300" fill="#94a3b8" textAnchor="middle" fontSize="18">
                  {item.value}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  function renderScaleChart() {
    return (
      <div className="card" style={{ padding: compact ? 12 : 20 }}>
        <div style={{ position: 'relative', padding: compact ? '4px 2px 0' : '10px 4px 0' }}>
          <div
            style={{
              height: compact ? 10 : 12,
              borderRadius: 999,
              background: 'linear-gradient(90deg, #334155, #38bdf8, #22c55e)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: compact ? 0 : 2,
              left: `calc(${((Math.max(value, 1) - 1) / 9) * 100}% - ${compact ? 8 : 10}px)`,
              width: compact ? 16 : 20,
              height: compact ? 16 : 20,
              borderRadius: '50%',
              background: '#f8fafc',
              boxShadow: '0 8px 24px rgba(255,255,255,0.18)',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: compact ? 10 : 14, color: '#cbd5e1', fontWeight: 700, fontSize: compact ? 12 : 16 }}>
            <span>{minLabel}</span>
            <span>{maxLabel}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, color: '#94a3b8', fontSize: compact ? 11 : 16 }}>
            {items.map((item) => (
              <span key={item.value}>{item.value}</span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function renderBarsChart() {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
          gap: compact ? 8 : 12,
          alignItems: 'end',
          minHeight: compact ? 160 : 260,
        }}
      >
        {items.map((item) => (
          <div key={item.value} style={{ textAlign: 'center' }}>
            <div
              className="card"
              style={{
                height: `${Math.max(item.count * 6, 32)}px`,
                minHeight: compact ? 24 : undefined,
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                paddingBottom: compact ? 6 : 10,
                borderColor: item.value === value ? 'rgba(56, 189, 248, 0.6)' : undefined,
              }}
            >
              {item.count}
            </div>
            <p className="muted" style={{ fontSize: compact ? 11 : undefined }}>{item.value}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ width: '100%', maxWidth: compact ? '100%' : 920 }}>
      {!compact && <p className="muted" style={{ textAlign: 'center' }}>Проектор</p>}
      <h1 className="hero-title" style={{ textAlign: 'center', fontSize: compact ? 22 : undefined, lineHeight: compact ? 1.15 : undefined }}>{title}</h1>
      <p className="hero-text" style={{ textAlign: 'center', margin: compact ? '0 auto 10px' : '0 auto 16px', fontSize: compact ? 14 : undefined }}>
        {minLabel} {'->'} {maxLabel}
      </p>

      {projectorView === 'summary' ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: hasMetrics ? compact ? 'minmax(0, 0.95fr) minmax(120px, 0.9fr)' : 'minmax(0, 1.62fr) minmax(240px, 1fr)' : 'minmax(0, 1fr)',
            gap: compact ? 10 : 18,
            alignItems: 'stretch',
          }}
        >
          <div className="card" style={{ padding: compact ? 14 : 24, minHeight: compact ? 150 : 250, display: 'grid', alignContent: 'center', gap: compact ? 8 : 14 }}>
            <p className="muted" style={{ margin: 0, textAlign: 'center' }}>Главный показатель слайда</p>
            <strong style={{ fontSize: compact ? 42 : 72, lineHeight: 1, textAlign: 'center' }}>{showAverage ? average : value}</strong>
            <p className="hero-text" style={{ textAlign: 'center', margin: 0, fontSize: compact ? 12 : undefined }}>
              {showAverage ? 'Среднее значение по аудитории' : 'Ответ выбранного участника'}
            </p>
          </div>
          {renderMetricsColumn()}
        </div>
      ) : visualization === 'line' ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: hasMetrics ? compact ? 'minmax(0, 0.95fr) minmax(120px, 0.9fr)' : 'minmax(0, 1.62fr) minmax(240px, 1fr)' : 'minmax(0, 1fr)',
            gap: compact ? 10 : 18,
            alignItems: 'stretch',
          }}
        >
          {renderLineChart()}
          {renderMetricsColumn()}
        </div>
      ) : visualization === 'scale' ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: hasMetrics ? compact ? 'minmax(0, 0.95fr) minmax(120px, 0.9fr)' : 'minmax(0, 1.62fr) minmax(240px, 1fr)' : 'minmax(0, 1fr)',
            gap: compact ? 10 : 18,
            alignItems: 'stretch',
          }}
        >
          {renderScaleChart()}
          {renderMetricsColumn()}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: hasMetrics ? compact ? 'minmax(0, 0.95fr) minmax(120px, 0.9fr)' : 'minmax(0, 1.62fr) minmax(240px, 1fr)' : 'minmax(0, 1fr)',
            gap: compact ? 10 : 18,
            alignItems: 'stretch',
          }}
        >
          {renderBarsChart()}
          {renderMetricsColumn()}
        </div>
      )}
    </div>
  );
}
