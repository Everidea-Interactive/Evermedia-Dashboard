import { NavLink } from 'react-router-dom';

export function Tabs({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-2 border-b mb-4">{children}</div>;
}

export function TabLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `px-3 py-2 rounded-t-lg ${isActive ? 'bg-white border-x border-t -mb-px border-gray-200 font-medium' : 'text-gray-600 hover:text-gray-900'}`}
      end
    >
      {children}
    </NavLink>
  );
}

