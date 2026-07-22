import { useEffect, useMemo, useState } from 'react';
import { Download, FileBarChart, ShieldAlert, TrendingUp, WalletCards } from 'lucide-react';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import { Link } from 'react-router-dom';
import { api, currency, downloadFile } from '../lib/api';
import { EmptyState, LoadingState, PageHeader, Toast } from '../components/ui';

type Compliance = { id: string; name: string; locations: string[]; expected: number; marked: number; compliance: number };
type Summary = { attendance: { present: number; leave: number; marked: number; activeGuards: number }; payroll: { guardNet: number; companyNet: number; margin: number } };

export function ReportsPage() {
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [data, setData] = useState<Compliance[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  useEffect(() => {
    setLoading(true);
    Promise.all([
      api<{ data: Compliance[] }>(`/reports/compliance?month=${month}`),
      api<Summary>(`/reports/summary?month=${month}`),
    ]).then(([compliance, totals]) => { setData(compliance.data); setSummary(totals); })
      .catch((err) => setToast(err instanceof Error ? err.message : 'Could not load reports'))
      .finally(() => setLoading(false));
  }, [month]);
  const average = useMemo(() => {
    const expected = data.reduce((sum, row) => sum + row.expected, 0);
    const marked = data.reduce((sum, row) => sum + row.marked, 0);
    return expected ? Math.min(100, Math.round((marked / expected) * 100)) : 0;
  }, [data]);
  async function exportAttendance() {
    const selected = new Date(`${month}-01T00:00:00`);
    const from = format(startOfMonth(selected), 'yyyy-MM-dd');
    const to = format(endOfMonth(selected) < new Date() ? endOfMonth(selected) : new Date(), 'yyyy-MM-dd');
    try { await downloadFile(`/reports/attendance/export?from=${from}&to=${to}`, `attendance-${month}.xlsx`); }
    catch (err) { setToast(err instanceof Error ? err.message : 'Export failed'); }
  }
  return <div className="page"><PageHeader eyebrow="Live insights & governance" title="Reports" description="Attendance, compliance, and payroll metrics calculated directly from current records." actions={<button className="button button--primary" onClick={exportAttendance}><Download size={17} />Export attendance</button>} />
    <section className="report-controls"><label>Reporting month<input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label><div className="report-score"><span><TrendingUp size={18} />Weighted compliance</span><strong>{average}%</strong></div></section>
    <section className="report-metrics"><article><span>Present records</span><strong>{summary?.attendance.present ?? 0}</strong><p>Daily guard attendance</p></article><article><span>Leave records</span><strong>{summary?.attendance.leave ?? 0}</strong><p>Driving salary deductions</p></article><article><span>Guard net payroll</span><strong>{currency(summary?.payroll.guardNet ?? 0)}</strong><p>Live payable amount</p></article><article><span>Company net billing</span><strong>{currency(summary?.payroll.companyNet ?? 0)}</strong><p>Live invoice value</p></article></section>
    <section className="panel compliance-panel"><div className="panel__header"><div><p className="eyebrow">Manager compliance</p><h2>Assigned-location completion</h2></div><ShieldAlert size={21} /></div>{loading ? <LoadingState /> : !data.length ? <EmptyState icon={<FileBarChart />} title="No report data" description="Compliance results will appear as managers mark attendance." /> : <div className="compliance-list">{data.map((row) => <article key={row.id}><div><strong>{row.name}</strong><span>{row.locations.join(' · ') || 'No assigned locations'}</span></div><div className="compliance-bar"><i><b style={{ width: `${Math.min(100, row.compliance)}%` }} /></i><span>{row.marked} / {row.expected} records</span></div><strong className={row.compliance < 80 ? 'low' : row.compliance < 95 ? 'medium' : 'high'}>{row.compliance}%</strong></article>)}</div>}</section>
    <section className="report-cards"><article><FileBarChart /><div><strong>Attendance register</strong><p>Daily status, employee IDs, locations and marking timestamps.</p></div><button onClick={exportAttendance}>Export XLSX</button></article><article><WalletCards /><div><strong>Payroll detail</strong><p>Dual salaries, leave deductions, net billing and guard pay.</p></div><Link to="/payroll">Open payroll</Link></article></section>
    {toast && <Toast type="error" message={toast} onClose={() => setToast('')} />}
  </div>;
}
