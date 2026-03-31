import Button from '../../shared/ui/Button';

type FreezeOverlayProps = {
  onResume: () => void;
};

export default function FreezeOverlay({ onResume }: FreezeOverlayProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10,
        background: 'rgba(2, 6, 23, 0.72)',
        backdropFilter: 'blur(12px)',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
      }}
    >
      <div className="card" style={{ padding: 28, maxWidth: 520, textAlign: 'center' }}>
        <p className="muted">Трансляция приостановлена</p>
        <h2 style={{ marginTop: 0 }}>Экран аудитории сейчас заморожен</h2>
        <p className="hero-text" style={{ margin: '0 auto' }}>
          Это полезно, когда нужно подготовить следующий экран и не показывать промежуточные изменения.
        </p>
        <div className="button-row" style={{ marginTop: 20, justifyContent: 'center' }}>
          <Button onClick={onResume}>Снять паузу</Button>
        </div>
      </div>
    </div>
  );
}
