import React from 'react';

type Props = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: React.ReactNode;
};

export default function Select({ label, className = '', children, ...rest }: Props) {
  return (
    <div>
      {label && <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</label>}
      <select className={`select ${className}`} {...rest}>{children}</select>
    </div>
  );
}

