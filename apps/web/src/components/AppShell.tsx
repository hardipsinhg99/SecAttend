import { useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { BarChart3, Building2, CalendarDays, ChevronDown, LayoutDashboard, LogOut, Menu, ShieldCheck, Users, WalletCards } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Avatar } from './ui';
import { BrandLogo } from './BrandLogo';

const adminNav = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/guards', label: 'Guards', icon: ShieldCheck },
  { to: '/managers', label: 'Managers', icon: Users },
  { to: '/locations', label: 'Locations', icon: Building2 },
  { to: '/attendance', label: 'Attendance', icon: CalendarDays },
  { to: '/payroll', label: 'Payroll', icon: WalletCards },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const nav = user?.role === 'ADMIN' ? adminNav : adminNav.filter((item) => ['/', '/guards', '/attendance'].includes(item.to));
  const displayName = user?.role === 'ADMIN' ? 'Admin' : user?.name ?? '';
  return <div className="app-shell">
    <aside className={`sidebar ${open ? 'sidebar--open' : ''}`}>
      <div className="sidebar__brand"><BrandLogo /><div><strong>SHREEDEVI SECURITY SERVICE</strong><span>Workforce operations</span></div></div>
      <div className="sidebar__context"><span>Workspace</span><strong>SHREEDEVI SECURITY SERVICE</strong><ChevronDown size={15} /></div>
      <nav aria-label="Main navigation">{nav.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)} className={({ isActive }) => isActive ? 'active' : ''}><Icon size={19} /><span>{label}</span></NavLink>)}</nav>
      <div className="sidebar__status"><span className="status-dot" /><div><strong>All systems operational</strong><span>Last sync just now</span></div></div>
      <div className="sidebar__user"><Avatar name={displayName} /><div><strong>{displayName}</strong><span>{user!.role === 'ADMIN' ? 'Administrator' : 'Site Manager'}</span></div><button className="icon-button" onClick={logout} aria-label="Sign out"><LogOut size={18} /></button></div>
    </aside>
    {open && <button className="sidebar-scrim" onClick={() => setOpen(false)} aria-label="Close navigation" />}
    <div className="main-column"><header className="mobile-header"><button className="icon-button" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu /></button><div className="mobile-header__brand"><BrandLogo decorative /><strong>SHREEDEVI SECURITY SERVICE</strong></div><Avatar name={displayName} size="sm" /></header><main>{children}</main></div>
  </div>;
}
