import { ReactNode } from 'react';
import LiquidBackground from '../../shared/ui/LiquidBackground';

type ProjectorShellProps = {
  appTitle: string;
  children: ReactNode;
};

export default function ProjectorShell({ appTitle, children }: ProjectorShellProps) {
  return (
    <div className="page-shell">
      <LiquidBackground />
      <div className="page-content main-area">
        <header style={{ marginBottom: 24 }}>
          <p className="muted" style={{ margin: 0 }}>
            {appTitle} / Экран проектора
          </p>
        </header>
        {children}
      </div>
    </div>
  );
}
