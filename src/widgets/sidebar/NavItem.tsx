import { ReactNode } from 'react';
import { cn } from '../../shared/lib/cn';

type NavItemProps = {
  icon: ReactNode;
  label: string;
  active?: boolean;
  isLive?: boolean;
  onClick: () => void;
};

export default function NavItem({
  icon,
  label,
  active = false,
  isLive = false,
  onClick,
}: NavItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('card', active ? 'nav-active' : 'nav-idle')}
      style={{
        width: '100%',
        padding: 14,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        borderRadius: 18,
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span>{icon}</span>
        <span>{label}</span>
      </span>
      {isLive && (
        <span className="sidebar-live-badge">
          <span className="sidebar-live-dot" />
          Live
        </span>
      )}
    </button>
  );
}
