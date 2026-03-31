import { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  icon?: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
};

const variantMap: Record<NonNullable<ButtonProps['variant']>, CSSProperties> = {
  primary: {
    background: 'linear-gradient(135deg, #38bdf8, #2563eb)',
    color: '#eff6ff',
    border: '1px solid rgba(191, 219, 254, 0.24)',
  },
  secondary: {
    background: 'rgba(15, 23, 42, 0.72)',
    color: '#e2e8f0',
    border: '1px solid rgba(148, 163, 184, 0.22)',
  },
  ghost: {
    background: 'transparent',
    color: '#cbd5e1',
    border: '1px solid rgba(148, 163, 184, 0.16)',
  },
};

export default function Button({
  children,
  icon,
  type = 'button',
  variant = 'primary',
  style,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      {...props}
      style={{
        ...variantMap[variant],
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 16px',
        borderRadius: 16,
        fontWeight: 600,
        ...style,
      }}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}
