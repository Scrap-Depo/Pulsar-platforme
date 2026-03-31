import { MultipleChoiceOption } from '../model/types';
import { getVotePercent, sortOptionsByVotes } from '../model/utils';
import { MultipleChoiceResultDisplay, MultipleChoiceVisualization } from '../../../shared/types/common';

type MultipleChoiceProjectorProps = {
  question: string;
  options: MultipleChoiceOption[];
  visualization?: MultipleChoiceVisualization;
  resultDisplay?: MultipleChoiceResultDisplay;
  compact?: boolean;
};

export default function MultipleChoiceProjector({
  question,
  options,
  visualization = 'bar',
  resultDisplay = 'both',
  compact = false,
}: MultipleChoiceProjectorProps) {
  const sorted = sortOptionsByVotes(options);
  const total = sorted.reduce((sum, option) => sum + option.votes, 0);
  const chartColors = ['#38bdf8', '#2563eb', '#a855f7', '#f97316', '#22c55e', '#f43f5e'];
  const chartSize = compact ? 150 : 340;
  const chartInset = compact ? 34 : 72;
  const chartCardMinHeight = compact ? 190 : 440;
  const cardPadding = compact ? 14 : 28;
  const optionPadding = compact ? 14 : 20;
  const titleStyle = compact
    ? { textAlign: 'center' as const, fontSize: 'clamp(0.95rem, 1.1vw, 1.3rem)', marginBottom: 12 }
    : { textAlign: 'center' as const };

  function getResultLabel(option: MultipleChoiceOption, percent: number) {
    if (resultDisplay === 'percent') {
      return `${percent}%`;
    }

    if (resultDisplay === 'votes') {
      return `${option.votes} голосов`;
    }

    return `${percent}% · ${option.votes} голосов`;
  }

  if (visualization === 'pie' || visualization === 'donut') {
    const gradientStops = sorted
      .reduce<{ stops: string[]; offset: number }>(
        (accumulator, option, index) => {
          const percent = getVotePercent(option.votes, total);
          const nextOffset = accumulator.offset + percent;
          const color = chartColors[index % chartColors.length];
          accumulator.stops.push(`${color} ${accumulator.offset}% ${nextOffset}%`);
          accumulator.offset = nextOffset;
          return accumulator;
        },
        { stops: [], offset: 0 },
      )
      .stops;

    const chartBackground =
      total > 0
        ? `conic-gradient(${gradientStops.join(', ')})`
        : 'conic-gradient(rgba(148, 163, 184, 0.2) 0 100%)';

    return (
      <div style={{ width: '100%', maxWidth: 920 }}>
        <p className="muted" style={{ textAlign: 'center' }}>Проектор</p>
        <h1 className="hero-title" style={titleStyle}>{question}</h1>
        <div className="feature-grid" style={{ alignItems: 'center', gap: compact ? 12 : 20 }}>
          <div className="card" style={{ padding: cardPadding, display: 'grid', placeItems: 'center', minHeight: chartCardMinHeight }}>
            <div
              style={{
                width: chartSize,
                height: chartSize,
                borderRadius: '50%',
                background: chartBackground,
                position: 'relative',
              }}
            >
              {visualization === 'donut' && (
                <div
                  style={{
                    position: 'absolute',
                    inset: chartInset,
                    borderRadius: '50%',
                    background: '#0f172a',
                    display: 'grid',
                    placeItems: 'center',
                    color: '#e2e8f0',
                    fontWeight: 700,
                    textAlign: 'center',
                    fontSize: compact ? '0.85rem' : '1rem',
                  }}
                >
                  <span>{total} голосов</span>
                </div>
              )}
            </div>
          </div>
          <div className="section-stack">
            {sorted.map((option) => {
              const percent = getVotePercent(option.votes, total);

              return (
                <div key={option.id} className="card" style={{ padding: optionPadding }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: '50%',
                          background: option.color,
                          display: 'inline-block',
                        }}
                      />
                      <strong>{option.text}</strong>
                    </div>
                    <span className="muted">{getResultLabel(option, percent)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', maxWidth: 920 }}>
      <p className="muted" style={{ textAlign: 'center' }}>Проектор</p>
      <h1 className="hero-title" style={titleStyle}>{question}</h1>
      <div className="section-stack">
        {sorted.map((option) => {
          const percent = getVotePercent(option.votes, total);

          return (
            <div key={option.id} className="card" style={{ padding: optionPadding }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <strong>{option.text}</strong>
                <span className="muted">{getResultLabel(option, percent)}</span>
              </div>
              <div
                style={{
                  height: 12,
                  marginTop: 12,
                  borderRadius: 999,
                  background: 'rgba(148, 163, 184, 0.16)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${percent}%`,
                    height: '100%',
                    background: option.color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
