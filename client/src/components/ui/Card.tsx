export default function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`card ${className}`}><div className="card-inner">{children}</div></div>;
}

