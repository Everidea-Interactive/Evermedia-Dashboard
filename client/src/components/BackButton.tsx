import { Link } from 'react-router-dom';

type Props = {
  to: string;
  label?: string;
  className?: string;
};

export default function BackButton({ to, label = 'Back', className = '' }: Props) {
  return (
    <Link
      to={to}
      className={`btn btn-ghost text-sm flex items-center gap-2 px-3 py-1 ${className}`}
    >
      <span aria-hidden="true">←</span>
      <span>{label}</span>
    </Link>
  );
}
