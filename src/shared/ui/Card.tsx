import { HTMLAttributes, ReactNode } from 'react';

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export default function Card({ children, style, ...props }: CardProps) {
  return (
    <div className="card" style={{ padding: 24, ...style }} {...props}>
      {children}
    </div>
  );
}
