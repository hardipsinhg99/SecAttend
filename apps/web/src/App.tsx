import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { AppShell } from './components/AppShell';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { GuardsPage } from './pages/GuardsPage';
import { ManagersPage } from './pages/ManagersPage';
import { AttendancePage } from './pages/AttendancePage';
import { PayrollPage } from './pages/PayrollPage';
import { ReportsPage } from './pages/ReportsPage';

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="app-loader"><span className="brand-mark"><i /><i /><i /></span><p>Preparing operations…</p></div>;
  if (!user) return <Routes><Route path="*" element={<LoginPage />} /></Routes>;
  return <AppShell><Routes>
    <Route path="/" element={<DashboardPage />} />
    <Route path="/guards" element={<GuardsPage />} />
    <Route path="/attendance" element={<AttendancePage />} />
    {user.role === 'ADMIN' && <>
      <Route path="/managers" element={<ManagersPage />} />
      <Route path="/payroll" element={<PayrollPage />} />
      <Route path="/reports" element={<ReportsPage />} />
    </>}
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></AppShell>;
}
