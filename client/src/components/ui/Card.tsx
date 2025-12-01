import React from 'react';

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  className?: string;
};

export default function Card({ children, className = '', ...rest }: CardProps) {
  return (
    <div className={`card ${className}`} {...rest}>
      <div className="card-inner">{children}</div>
    </div>
  );
}

