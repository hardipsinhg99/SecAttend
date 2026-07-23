import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CircleDollarSign, Download, RefreshCw, Search, WalletCards } from 'lucide-react';
import { format } from 'date-fns';
import { api, currency, downloadFile } from '../lib/api';
import { Avatar, EmptyState, LoadingState, PageHeader, Toast } from '../components/ui';

type PaymentStatus = 'PAID' | 'UNPAID';
type SalaryRow = {
  id: string; totalDays: number; payableDays: number; presentDays: number; absentDays: number;
  guardDailyRate: number; guardGrossSalary: number; guardDeductions: number; guardNetSalary: number;
  companyDailyRate: number; companyGrossSalary: number; companyDeductions: number; companyNetSalary: number;
  paymentStatus: PaymentStatus; paidAt: string | null; paymentNote: string | null;
  guard: { id: string; name: string; employeeId: string; location: { name: string } };
};
type Totals = { guardGross: number; guardDeductions: number; guardNet: number; companyGross: number; companyDeductions: number; companyNet: number; margin: number };
const emptyTotals: Totals = { guardGross: 0, guardDeductions: 0, guardNet: 0, companyGross: 0, companyDeductions: 0, companyNet: 0, margin: 0 };

export function PayrollPage() {
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [rows, setRows] = useState<SalaryRow[]>([]);
  const [totals, setTotals] = useState<Totals>(emptyTotals);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState('');
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | PaymentStatus>('ALL');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<{ data: SalaryRow[]; totals: Totals }>(`/salary/${month}`);
      setRows(result.data);
      setTotals(result.totals);
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Could not load payroll' });
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => rows.filter((row) => {
    const matchesSearch = `${row.guard.name} ${row.guard.employeeId}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (paymentFilter === 'ALL' || row.paymentStatus === paymentFilter);
  }), [rows, search, paymentFilter]);
  const paidCount = rows.filter((row) => row.paymentStatus === 'PAID').length;
  const paidPayroll = useMemo(
    () => rows.reduce((sum, row) => sum + (row.paymentStatus === 'PAID' ? Number(row.guardNetSalary) : 0), 0),
    [rows],
  );

  async function exportPayroll() {
    try {
      await downloadFile(`/salary/${month}/export`, `payroll-${month}.xlsx`);
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Export failed' });
    }
  }

  async function updatePayment(row: SalaryRow) {
    const status: PaymentStatus = row.paymentStatus === 'PAID' ? 'UNPAID' : 'PAID';
    setUpdatingId(row.guard.id);
    try {
      await api(`/salary/${month}/${row.guard.id}/payment`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setRows((current) => current.map((item) => item.guard.id === row.guard.id ? { ...item, paymentStatus: status, paidAt: status === 'PAID' ? new Date().toISOString() : null } : item));
      setToast({ type: 'success', message: `${row.guard.name} marked ${status.toLowerCase()}` });
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Could not update payment status' });
    } finally {
      setUpdatingId('');
    }
  }

  return <div className="page">
    <PageHeader eyebrow="Live compensation operations" title="Payroll" description="Track calculated guard pay and manually mark each monthly payment as paid or unpaid." actions={<button className="button button--primary" onClick={exportPayroll} disabled={!rows.length}><Download size={17} />Export payroll</button>} />
    <section className="payroll-controls">
      <label>Payroll month<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label>
      <label>Payment status<select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value as 'ALL' | PaymentStatus)}><option value="ALL">All payments</option><option value="UNPAID">Unpaid only</option><option value="PAID">Paid only</option></select></label>
      <div className="search-box"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a guard…" aria-label="Find a guard" /></div>
      <button className="icon-button" onClick={load} aria-label="Refresh live payroll"><RefreshCw size={18} /></button>
      <span className="live-chip"><i />{paidCount} paid · {rows.length - paidCount} unpaid</span>
    </section>
    <section className="payroll-summary payroll-summary--four"><article><span>Company billing</span><strong>{currency(totals.companyNet)}</strong><p>After attendance adjustments</p></article><article><span>Guard payroll</span><strong>{currency(totals.guardNet)}</strong><p>Joining-date adjusted payable</p></article><article><span>Payroll adjustments</span><strong>{currency(totals.guardDeductions)}</strong><p>Pre-joining and absence deductions</p></article><article className="payroll-summary__paid"><span>Paid payroll</span><strong>{currency(paidPayroll)}</strong><p>{paidCount} guard{paidCount === 1 ? '' : 's'} marked paid</p></article></section>
    <section className="table-card">{loading ? <LoadingState label="Calculating live payroll" /> : !filtered.length ? <EmptyState icon={<WalletCards />} title="No payroll rows" description="No guards match this month, payment status and search." /> : <div className="data-table-wrap"><table className="data-table payroll-table"><thead><tr><th>Guard</th><th>Location</th><th>Attendance</th><th>Guard base</th><th>Adjustments</th><th>Guard payable</th><th>Company billing</th><th>Payment</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.id}><td data-label="Guard"><div className="person-cell"><Avatar name={row.guard.name} /><div><strong>{row.guard.name}</strong><span>{row.guard.employeeId}</span></div></div></td><td data-label="Location">{row.guard.location.name}</td><td data-label="Attendance"><span className={row.absentDays ? 'leave-count' : ''}>{row.presentDays} P · {row.absentDays} A</span></td><td data-label="Guard base">{currency(row.guardGrossSalary)}</td><td data-label="Adjustments" className="deduction">− {currency(row.guardDeductions)}</td><td data-label="Guard payable"><strong className="salary-cell">{currency(row.guardNetSalary)}</strong></td><td data-label="Company billing"><strong className="salary-cell">{currency(row.companyNetSalary)}</strong></td><td data-label="Payment"><button className={`payment-toggle payment-toggle--${row.paymentStatus.toLowerCase()}`} onClick={() => updatePayment(row)} disabled={updatingId === row.guard.id} aria-label={`${row.guard.name}: ${row.paymentStatus === 'PAID' ? 'mark unpaid' : 'mark paid'}`}>{row.paymentStatus === 'PAID' ? <CheckCircle2 size={16} /> : <CircleDollarSign size={16} />}{updatingId === row.guard.id ? 'Updating…' : row.paymentStatus === 'PAID' ? 'Paid' : 'Mark paid'}</button>{row.paidAt && <span className="payment-date">{format(new Date(row.paidAt), 'd MMM yyyy')}</span>}</td></tr>)}</tbody></table></div>}</section>
    {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
  </div>;
}
