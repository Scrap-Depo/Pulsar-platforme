import { ReactNode } from 'react';
import LiquidBackground from '../../shared/ui/LiquidBackground';

type ParticipantShellProps = {
  appTitle: string;
  children: ReactNode;
};

export default function ParticipantShell({ appTitle, children }: ParticipantShellProps) {
  return (
    <div className="page-shell">
      <LiquidBackground />
      <div className="page-content main-area">
        <header style={{ marginBottom: 24 }}>
          <p className="muted" style={{ margin: 0 }}>{appTitle}</p>
        </header>
        {children}
      </div>
    </div>
  );
}
