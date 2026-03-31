import Card from '../../../shared/ui/Card';

type PulseParticipantProps = {
  title: string;
  minLabel: string;
  maxLabel: string;
  value: number;
  onValueChange: (value: number) => void;
};

export default function PulseParticipant({
  title,
  minLabel,
  maxLabel,
  value,
  onValueChange,
}: PulseParticipantProps) {
  return (
    <Card>
      <p className="muted">Участник</p>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      <div className="section-stack">
        <div className="button-row" style={{ justifyContent: 'space-between' }}>
          <span className="muted">{minLabel}</span>
          <strong>{value}</strong>
          <span className="muted">{maxLabel}</span>
        </div>
        <input
          type="range"
          min="1"
          max="10"
          value={value}
          onChange={(event) => onValueChange(Number(event.target.value))}
        />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(10, minmax(0, 1fr))',
            gap: 8,
          }}
        >
          {Array.from({ length: 10 }, (_, index) => {
            const item = index + 1;

            return (
              <button
                key={item}
                type="button"
                onClick={() => onValueChange(item)}
                className="card"
                style={{
                  padding: 12,
                  borderColor: value === item ? 'rgba(56, 189, 248, 0.6)' : undefined,
                }}
              >
                {item}
              </button>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
