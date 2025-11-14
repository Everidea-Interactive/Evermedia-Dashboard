import React from 'react';

export const TableWrap = React.forwardRef<HTMLDivElement, { children: React.ReactNode }>(
  ({ children }, ref) => <div ref={ref} className="table-wrap">{children}</div>
);

export function Table({ children }: { children: React.ReactNode }) {
  return <table className="table">{children}</table>;
}

export function THead({ children }: { children: React.ReactNode }) {
  return <thead className="thead">{children}</thead>;
}

export function TH({ children }: { children: React.ReactNode }) {
  return <th className="th">{children}</th>;
}

export function TR({ children }: { children: React.ReactNode }) {
  return <tr className="tr">{children}</tr>;
}

export function TD({ children }: { children: React.ReactNode }) {
  return <td className="td">{children}</td>;
}
