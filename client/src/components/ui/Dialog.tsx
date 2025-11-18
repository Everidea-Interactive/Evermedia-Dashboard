import React, { useEffect } from 'react';

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export default function Dialog({ open, onClose, title, children, footer }: DialogProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }} onClick={onClose} />
      <div className="relative rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', boxShadow: 'var(--shadow-lg)' }}>
        <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
        </div>
        <div className="px-6 py-4 overflow-y-auto flex-1" style={{ color: 'var(--text-primary)' }}>{children}</div>
        {footer && <div className="px-6 py-4 border-t flex justify-end gap-2" style={{ borderColor: 'var(--border-color)' }}>{footer}</div>}
      </div>
    </div>
  );
}

