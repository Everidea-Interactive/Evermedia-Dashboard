import React from 'react';

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
};

export default function Input({ label, hint, className = '', ...rest }: Props) {
  return (
    <div>
      {label && <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</label>}
      <input className={`input ${className}`} {...rest} />
      {hint && <div className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>{hint}</div>}
    </div>
  );
}

