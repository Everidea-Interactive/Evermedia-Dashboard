import React from 'react';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'outline' | 'ghost';
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
};

export default function Button({ variant = 'primary', className = '', iconLeft, iconRight, children, ...rest }: Props) {
  const base = 'btn ' + (variant === 'primary' ? 'btn-primary' : variant === 'outline' ? 'btn-outline' : 'btn-ghost');
  return (
    <button className={`${base} ${className}`} {...rest}>
      {iconLeft}
      {children}
      {iconRight}
    </button>
  );
}
