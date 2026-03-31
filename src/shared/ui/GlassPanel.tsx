import { HTMLAttributes, ReactNode } from 'react';

type GlassPanelProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export default function GlassPanel({ children, style, ...props }: GlassPanelProps) {
  return (
    <div
      className="card"
      style={{
        padding: 24,
        backdropFilter: 'blur(18px)',
        background: 'rgba(15, 23, 42, 0.55)',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
