import React from 'react';

export const TableWrap = React.forwardRef<HTMLDivElement, { children: React.ReactNode; className?: string }>(
  ({ children, className = '' }, ref) => (
    <div ref={ref} className={`table-wrap ${className}`} style={{ overflowX: 'auto', overflowY: 'visible', width: '100%', minWidth: 0 }}>
      {children}
    </div>
  )
);

export function Table({ children }: { children: React.ReactNode }) {
  return <table className="table">{children}</table>;
}

export function THead({ children }: { children: React.ReactNode }) {
  return <thead className="thead">{children}</thead>;
}

export function TH({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`th ${className}`}>{children}</th>;
}

export function TR({ children }: { children: React.ReactNode }) {
  return <tr className="tr">{children}</tr>;
}

export function TD({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`td ${className}`}>{children}</td>;
}
