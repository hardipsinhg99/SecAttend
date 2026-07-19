import { useEffect, useState } from 'react';
import { Download, FileBarChart, ShieldAlert, TrendingUp } from 'lucide-react';
import { format, startOfMonth } from 'date-fns';
import { api } from '../lib/api';
import { EmptyState, LoadingState, PageHeader } from '../components/ui';

type Compliance = { id: string; name: string; locations: string[]; expected: number; marked: number; compliance: number };
export function ReportsPage() {
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM')); const [data, setData] = useState<Compliance[]>([]); const [loading, setLoading] = useState(true);
  useEffect(() => { setLoading(true); api<{ data: Compliance[] }>(`/reports/compliance?month=${month}`).then((result) => setData(result.data)).finally(() => setLoading(false)); }, [month]);
  const average = data.length ? Math.round(data.reduce((sum, row) => sum + row.compliance, 0) / data.length) : 0;
  function exportAttendance() { const from = format(startOfMonth(new Date(`${month}-01T00:00:00`)), 'yyyy-MM-dd'); const to = format(new Date(), 'yyyy-MM-dd'); const token = localStorage.getItem('secattend_token'); fetch(`/api/reports/attendance/export?from=${from}&to=${to}`, { headers: { Authorization: `Bearer ${token}` } }).then((response) => response.blob()).then((blob) => { const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `attendance-${month}.xlsx`; link.click(); URL.revokeObjectURL(url); }); }
  return <div className="page"><PageHeader eyebrow="Insights & governance" title="Reports" description="Spot attendance gaps, review manager compliance, and export audit-ready data." actions={<button className="button button--primary" onClick={exportAttendance}><Download size={17} />Export attendance</button>} />
    <section className="report-controls"><label>Reporting month<input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label><div className="report-score"><span><TrendingUp size={18} />Average compliance</span><strong>{average}%</strong></div></section>
    <section className="panel compliance-panel"><div className="panel__header"><div><p className="eyebrow">Manager compliance</p><h2>Attendance completion by manager</h2></div><ShieldAlert size={21} /></div>{loading ? <LoadingState /> : !data.length ? <EmptyState icon={<FileBarChart />} title="No report data" description="Compliance results will appear as managers mark attendance." /> : <div className="compliance-list">{data.map((row) => <article key={row.id}><div><strong>{row.name}</strong><span>{row.locations.join(' · ')}</span></div><div className="compliance-bar"><i><b style={{ width: `${Math.min(100, row.compliance)}%` }} /></i><span>{row.marked} / {row.expected} records</span></div><strong className={row.compliance < 80 ? 'low' : row.compliance < 95 ? 'medium' : 'high'}>{row.compliance}%</strong></article>)}</div>}</section>
    <section className="report-cards"><article><FileBarChart /><div><strong>Attendance register</strong><p>Daily status, employee IDs, locations and marking timestamps.</p></div><button onClick={exportAttendance}>Export XLSX</button></article><article><TrendingUp /><div><strong>Payroll summary</strong><p>Gross salary, leave deductions and net payable by guard.</p></div><button>Open payroll</button></article></section>
  </div>;
}
