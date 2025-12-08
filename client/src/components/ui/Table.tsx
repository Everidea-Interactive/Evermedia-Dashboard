import React from 'react';

type DivProps = React.HTMLAttributes<HTMLDivElement>;
type TableProps = React.TableHTMLAttributes<HTMLTableElement>;
type SectionProps = React.HTMLAttributes<HTMLTableSectionElement>;
type THProps = React.ThHTMLAttributes<HTMLTableHeaderCellElement>;
type TRProps = React.HTMLAttributes<HTMLTableRowElement>;
type TDProps = React.TdHTMLAttributes<HTMLTableCellElement>;

export const TableWrap = React.forwardRef<HTMLDivElement, DivProps>(
  ({ children, className = '', style, ...rest }, ref) => (
    <div
      ref={ref}
      className={`table-wrap ${className}`}
      style={{ overflowX: 'auto', overflowY: 'visible', width: '100%', minWidth: 0, ...style }}
      {...rest}
    >
      {children}
    </div>
  )
);

export function Table({ children, className = '', ...rest }: TableProps) {
  return (
    <table className={`table ${className}`} {...rest}>
      {children}
    </table>
  );
}

export function THead({ children, className = '', ...rest }: SectionProps) {
  return (
    <thead className={`thead ${className}`} {...rest}>
      {children}
    </thead>
  );
}

export function TH({ children, className = '', ...rest }: THProps) {
  return (
    <th className={`th ${className}`} {...rest}>
      {children}
    </th>
  );
}

export function TR({ children, className = '', ...rest }: TRProps) {
  return (
    <tr className={`tr ${className}`} {...rest}>
      {children}
    </tr>
  );
}

export function TD({ children, className = '', ...rest }: TDProps) {
  return (
    <td className={`td ${className}`} {...rest}>
      {children}
    </td>
  );
}
