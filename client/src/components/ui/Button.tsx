import React from 'react';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'outline' | 'ghost';
  color?: 'blue' | 'red' | 'green';
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
};

export default function Button({ variant = 'primary', color, className = '', iconLeft, iconRight, children, ...rest }: Props) {
  let base = 'btn ';
  if (variant === 'primary') {
    base += color === 'blue' ? 'btn-primary-blue' : color === 'red' ? 'btn-primary-red' : color === 'green' ? 'btn-primary-green' : 'btn-primary';
  } else if (variant === 'outline') {
    base += color === 'blue' ? 'btn-outline-blue' : color === 'red' ? 'btn-outline-red' : color === 'green' ? 'btn-outline-green' : 'btn-outline';
  } else {
    base += color === 'blue' ? 'btn-ghost-blue' : color === 'red' ? 'btn-ghost-red' : color === 'green' ? 'btn-ghost-green' : 'btn-ghost';
  }
  return (
    <button className={`${base} ${className}`} {...rest}>
      {iconLeft}
      {children}
      {iconRight}
    </button>
  );
}
