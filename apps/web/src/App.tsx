import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { AppShell } from './components/AppShell';
import { BrandLogo } from './components/BrandLogo';
import { LoginPage } from './pages/LoginPage';

const DashboardPage = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const GuardsPage = lazy(() => import('./pages/GuardsPage').then((module) => ({ default: module.GuardsPage })));
const ManagersPage = lazy(() => import('./pages/ManagersPage').then((module) => ({ default: module.ManagersPage })));
const LocationsPage = lazy(() => import('./pages/LocationsPage').then((module) => ({ default: module.LocationsPage })));
const AttendancePage = lazy(() => import('./pages/AttendancePage').then((module) => ({ default: module.AttendancePage })));
const PayrollPage = lazy(() => import('./pages/PayrollPage').then((module) => ({ default: module.PayrollPage })));
const ReportsPage = lazy(() => import('./pages/ReportsPage').then((module) => ({ default: module.ReportsPage })));

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="app-loader"><BrandLogo decorative /><p>Preparing operations…</p></div>;
  if (!user) return <Routes><Route path="*" element={<LoginPage />} /></Routes>;
  return <AppShell><Suspense fallback={<LoadingFallback />}><Routes>
    <Route path="/" element={<DashboardPage />} />
    <Route path="/guards" element={<GuardsPage />} />
    <Route path="/attendance" element={<AttendancePage />} />
    {user.role === 'ADMIN' && <>
      <Route path="/managers" element={<ManagersPage />} />
      <Route path="/locations" element={<LocationsPage />} />
      <Route path="/payroll" element={<PayrollPage />} />
      <Route path="/reports" element={<ReportsPage />} />
    </>}
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></Suspense></AppShell>;
}

function LoadingFallback() {
  return <div className="page"><div className="loading-state">Loading workspace…</div></div>;
}
