type GlassToggleProps = {
  label: string;
  active: boolean;
  onClick: () => void;
};

export default function GlassToggle({ label, active, onClick }: GlassToggleProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="card"
      style={{
        width: '100%',
        padding: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: 18,
      }}
    >
      <span>{label}</span>
      <span
        style={{
          width: 46,
          height: 28,
          borderRadius: 999,
          background: active ? '#38bdf8' : 'rgba(148, 163, 184, 0.3)',
          position: 'relative',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 3,
            left: active ? 22 : 3,
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: '#f8fafc',
            transition: 'left 160ms ease',
          }}
        />
      </span>
    </button>
  );
}
