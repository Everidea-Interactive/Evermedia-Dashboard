import { useEffect } from 'react';
import type React from 'react';

type ToastProps = {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
  duration?: number;
};

export default function Toast({ message, type, onClose, duration = 5000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const getToastStyles = (type: 'success' | 'error' | 'info') => {
    const styles: Record<string, React.CSSProperties> = {
      success: {
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        color: '#059669',
      },
      error: {
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        color: '#dc2626',
      },
      info: {
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        color: '#2563eb',
      },
    };
    return styles[type];
  };

  return (
    <div className="fixed inset-x-0 bottom-4 flex justify-center px-4 pointer-events-none z-50">
      <div className="pointer-events-auto max-w-md w-full rounded-lg border px-4 py-3 text-sm" style={{ ...getToastStyles(type), boxShadow: 'var(--shadow-lg)' }}>
        <div className="flex items-center justify-between">
          <span>{message}</span>
          <button
            onClick={onClose}
            className="ml-4 text-current opacity-70 hover:opacity-100 transition-opacity"
            aria-label="Close"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}

