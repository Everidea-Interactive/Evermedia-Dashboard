import React, { useRef } from 'react';

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: React.ReactNode;
  hint?: string;
};

export default function Input({ label, hint, className = '', type, onClick, ...rest }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = (e: React.MouseEvent<HTMLInputElement>) => {
    // If it's a date input, open the picker when clicking anywhere on the field
    if (type === 'date' && inputRef.current) {
      // Use showPicker() if available (modern browsers)
      if ('showPicker' in HTMLInputElement.prototype) {
        try {
          inputRef.current.showPicker();
        } catch (err) {
          // Fallback: focus the input
          inputRef.current.focus();
        }
      } else {
        // Fallback: focus the input
        inputRef.current.focus();
      }
    }
    
    // Call original onClick if provided
    if (onClick) {
      onClick(e);
    }
  };

  return (
    <div>
      {label && <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</label>}
      <input 
        ref={inputRef}
        className={`input ${className}`} 
        type={type}
        onClick={handleClick}
        {...rest} 
      />
      {hint && <div className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>{hint}</div>}
    </div>
  );
}

