export default function LiquidBackground() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        background: `
          radial-gradient(circle at 20% 20%, rgba(56, 189, 248, 0.18), transparent 25%),
          radial-gradient(circle at 80% 30%, rgba(37, 99, 235, 0.16), transparent 20%),
          radial-gradient(circle at 50% 80%, rgba(14, 165, 233, 0.12), transparent 22%)
        `,
        filter: 'blur(18px)',
      }}
    />
  );
}
