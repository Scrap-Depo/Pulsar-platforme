import { ReactNode } from 'react';
import LiquidBackground from '../../shared/ui/LiquidBackground';

type ParticipantShellProps = {
  children: ReactNode;
};

export default function ParticipantShell({ children }: ParticipantShellProps) {
  return (
    <div className="page-shell">
      <LiquidBackground />
      <div className="page-content main-area">{children}</div>
    </div>
  );
}
