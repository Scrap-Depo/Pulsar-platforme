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
      <div className="page-content main-area">{children}</div>
    </div>
  );
}
