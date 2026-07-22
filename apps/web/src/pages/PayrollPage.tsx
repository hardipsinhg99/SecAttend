import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, RefreshCw, Search, WalletCards } from 'lucide-react';
import { format } from 'date-fns';
import { api, currency, downloadFile } from '../lib/api';
import { Avatar, EmptyState, LoadingState, PageHeader, Toast } from '../components/ui';

type SalaryRow = {
  id: string; totalDays: number; eligibleDays: number; payableDays: number; presentDays: number; absentDays: number; leaveDays: number;
  guardDailyRate: number; guardGrossSalary: number; guardDeductions: number; guardNetSalary: number;
  companyDailyRate: number; companyGrossSalary: number; companyDeductions: number; companyNetSalary: number;
  guard: { id: string; name: string; employeeId: string; location: { name: string } };
};
type Totals = { guardGross: number; guardDeductions: number; guardNet: number; companyGross: number; companyDeductions: number; companyNet: number; margin: number };
const emptyTotals: Totals = { guardGross: 0, guardDeductions: 0, guardNet: 0, companyGross: 0, companyDeductions: 0, companyNet: 0, margin: 0 };

export function PayrollPage() {
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [rows, setRows] = useState<SalaryRow[]>([]);
  const [totals, setTotals] = useState<Totals>(emptyTotals);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<{ data: SalaryRow[]; totals: Totals }>(`/salary/${month}`);
      setRows(result.data); setTotals(result.totals);
    } catch (err) { setToast(err instanceof Error ? err.message : 'Could not load payroll'); }
    finally { setLoading(false); }
  }, [month]);
  useEffect(() => { void load(); }, [load]);
  const filtered = useMemo(() => rows.filter((row) => `${row.guard.name} ${row.guard.employeeId}`.toLowerCase().includes(search.toLowerCase())), [rows, search]);
  async function exportPayroll() {
    try { await downloadFile(`/salary/${month}/export`, `payroll-${month}.xlsx`); }
    catch (err) { setToast(err instanceof Error ? err.message : 'Export failed'); }
  }
  return <div className="page"><PageHeader eyebrow="Live compensation operations" title="Payroll" description="Guard pay and company billing update automatically as leave is recorded." actions={<button className="button button--primary" onClick={exportPayroll} disabled={!rows.length}><Download size={17} />Export payroll</button>} />
    <section className="payroll-controls"><label>Payroll month<input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label><div className="search-box"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a guard…" aria-label="Find a guard" /></div><button className="icon-button" onClick={load} aria-label="Refresh live payroll"><RefreshCw size={18} /></button><span className="live-chip"><i /> Live from attendance</span></section>
    <section className="payroll-summary payroll-summary--four"><article><span>Company billing</span><strong>{currency(totals.companyNet)}</strong><p>After attendance adjustments</p></article><article><span>Guard payroll</span><strong>{currency(totals.guardNet)}</strong><p>Joining-date adjusted payable</p></article><article><span>Payroll adjustments</span><strong>{currency(totals.guardDeductions)}</strong><p>Pre-joining, absence and leave</p></article><article className="payroll-summary__net"><span>Agency margin</span><strong>{currency(totals.margin)}</strong><p>Billing less guard pay</p></article></section>
    <section className="table-card">{loading ? <LoadingState label="Calculating live payroll" /> : !filtered.length ? <EmptyState icon={<WalletCards />} title="No payroll rows" description="No active guards match this month and search." /> : <div className="data-table-wrap"><table className="data-table payroll-table"><thead><tr><th>Guard</th><th>Location</th><th>Attendance</th><th>Eligible days</th><th>Guard base</th><th>Adjustments</th><th>Guard payable</th><th>Company base</th><th>Company billing</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.id}><td data-label="Guard"><div className="person-cell"><Avatar name={row.guard.name} /><div><strong>{row.guard.name}</strong><span>{row.guard.employeeId}</span></div></div></td><td data-label="Location">{row.guard.location.name}</td><td data-label="Attendance"><span className={(row.absentDays || row.leaveDays) ? 'leave-count' : ''}>{row.presentDays} P · {row.absentDays} A · {row.leaveDays} L</span></td><td data-label="Eligible days">{row.eligibleDays} / {row.totalDays}</td><td data-label="Guard base">{currency(row.guardGrossSalary)}</td><td data-label="Adjustments" className="deduction">− {currency(row.guardDeductions)}</td><td data-label="Guard payable"><strong className="salary-cell">{currency(row.guardNetSalary)}</strong></td><td data-label="Company base">{currency(row.companyGrossSalary)}</td><td data-label="Company billing"><strong className="salary-cell">{currency(row.companyNetSalary)}</strong></td></tr>)}</tbody></table></div>}</section>
    {toast && <Toast type="error" message={toast} onClose={() => setToast('')} />}
  </div>;
}
