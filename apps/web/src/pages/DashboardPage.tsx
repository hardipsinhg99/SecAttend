import { useEffect, useState } from 'react';
import { ArrowRight, CalendarCheck, CheckCircle2, Clock3, MapPin, ShieldCheck, UserCheck, Users, WalletCards } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import type { DashboardData } from '../types';
import { LoadingState, PageHeader } from '../components/ui';

export function DashboardPage() {
  const { user } = useAuth(); const [data, setData] = useState<DashboardData | null>(null); const [error, setError] = useState('');
  useEffect(() => { api<DashboardData>('/dashboard').then(setData).catch((err) => setError(err.message)); }, []);
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening';
  if (!data && !error) return <LoadingState label="Building today’s operational view" />;
  if (error) return <div className="error-panel">{error}</div>;
  const stats = data!.stats;
  const cards = user!.role === 'ADMIN' ? [
    { label: 'Active guards', value: stats.totalGuards, note: 'Across all locations', icon: ShieldCheck, tone: 'green' },
    { label: 'Attendance today', value: `${stats.attendancePercent}%`, note: `${stats.markedToday} of ${stats.totalGuards} marked`, icon: UserCheck, tone: 'orange' },
    { label: 'Active managers', value: stats.activeManagers, note: 'Field supervisors', icon: Users, tone: 'blue' },
    { label: 'Pending payroll', value: stats.pendingSalaries, note: 'Current month', icon: WalletCards, tone: 'violet' },
  ] : [
    { label: 'Assigned guards', value: stats.totalGuards, note: 'Across your locations', icon: ShieldCheck, tone: 'green' },
    { label: 'Attendance today', value: `${stats.attendancePercent}%`, note: `${stats.markedToday} of ${stats.totalGuards} marked`, icon: UserCheck, tone: 'orange' },
    { label: 'Present today', value: stats.presentToday, note: `${stats.leaveToday} on leave`, icon: CheckCircle2, tone: 'blue' },
  ];
  return <div className="page page--dashboard">
    <PageHeader eyebrow={`${greeting}, ${user!.name.split(' ')[0]}`} title="Here’s today’s field picture." description={new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())} actions={<Link className="button button--primary" to="/attendance"><CalendarCheck size={18} />Mark attendance</Link>} />
    <section className="stat-grid">{cards.map(({ label, value, note, icon: Icon, tone }) => <article className="stat-card" key={label}><div className={`stat-card__icon stat-card__icon--${tone}`}><Icon size={20} /></div><span>{label}</span><strong>{value}</strong><p>{note}</p></article>)}</section>
    <section className="dashboard-grid">
      <article className="panel attendance-pulse"><div className="panel__header"><div><p className="eyebrow">Live attendance</p><h2>Today’s completion</h2></div><span className="live-chip"><i /> Live</span></div><div className="attendance-pulse__body"><div className="donut" style={{ '--progress': `${stats.attendancePercent * 3.6}deg` } as React.CSSProperties}><div><strong>{stats.attendancePercent}%</strong><span>complete</span></div></div><div className="attendance-breakdown"><div><span className="legend legend--green" /><p><strong>{stats.presentToday}</strong> Present</p></div><div><span className="legend legend--orange" /><p><strong>{stats.leaveToday}</strong> On leave</p></div><div><span className="legend legend--muted" /><p><strong>{Math.max(0, stats.totalGuards - stats.markedToday)}</strong> Unmarked</p></div><Link to="/attendance">Open attendance sheet <ArrowRight size={16} /></Link></div></div></article>
      <article className="panel locations-card"><div className="panel__header"><div><p className="eyebrow">Coverage</p><h2>Location overview</h2></div><MapPin size={20} /></div><div className="location-list">{data!.locationStats.map((location, index) => <div key={location.id}><span className={`location-rank location-rank--${index + 1}`}>{String(index + 1).padStart(2, '0')}</span><div><strong>{location.name}</strong><p>{location.address}</p></div><div className="location-count"><strong>{location._count?.guards ?? 0}</strong><span>guards</span></div></div>)}</div></article>
      <article className="panel activity-card"><div className="panel__header"><div><p className="eyebrow">Audit trail</p><h2>Recent activity</h2></div><Clock3 size={20} /></div><div className="timeline">{data!.recentActivity.map((item) => <div key={item.id}><span><i /></span><div><strong>{item.action.replaceAll('_', ' ').toLowerCase()}</strong><p>{item.entity} · {item.actor?.name ?? 'System'}</p></div><time>{new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(-Math.max(0, Math.round((Date.now() - new Date(item.createdAt).getTime()) / 3_600_000)), 'hour')}</time></div>)}</div></article>
    </section>
  </div>;
}
