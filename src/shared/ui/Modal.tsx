import { ReactNode } from 'react';

type ModalProps = {
  children: ReactNode;
};

export default function Modal({ children }: ModalProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(2, 6, 23, 0.72)',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
      }}
    >
      <div className="card" style={{ maxWidth: 720, width: '100%', padding: 28 }}>
        {children}
      </div>
    </div>
  );
}
