import { ButtonHTMLAttributes, ReactNode } from 'react';

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: ReactNode;
};

export default function IconButton({ icon, type = 'button', style, ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      {...props}
      style={{
        width: 42,
        height: 42,
        display: 'inline-grid',
        placeItems: 'center',
        borderRadius: 14,
        border: '1px solid rgba(148, 163, 184, 0.22)',
        background: 'rgba(15, 23, 42, 0.7)',
        color: '#e2e8f0',
        ...style,
      }}
    >
      {icon}
    </button>
  );
}
