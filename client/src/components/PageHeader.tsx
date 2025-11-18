import React from 'react';
import BackButton from './BackButton';

type Props = {
  backPath: string;
  backLabel?: string;
  title: React.ReactNode;
  meta?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
};

export default function PageHeader({ backPath, backLabel = 'Back', title, meta, action, className = '' }: Props) {
  return (
    <div className={`mb-6 space-y-3 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <BackButton to={backPath} label={backLabel} />
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
      <div className="text-center md:text-left space-y-1">
        <div>{title}</div>
        {meta && (
          <div className="flex flex-col items-start gap-2 text-sm md:flex-row md:items-start md:justify-start" style={{ color: 'var(--text-tertiary)' }}>
            {meta}
          </div>
        )}
      </div>
    </div>
  );
}
