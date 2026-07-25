import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Pencil, Plus, Receipt, Search, Trash2, Wallet } from 'lucide-react';
import { api, currency } from '../lib/api';
import type { Expense } from '../types';
import { EmptyState, LoadingState, Modal, PageHeader, Toast } from '../components/ui';

type ExpenseForm = { title: string; category: string; amount: string; expenseDate: string; note: string };
const emptyForm: ExpenseForm = { title: '', category: '', amount: '', expenseDate: new Date().toISOString().slice(0, 10), note: '' };

export function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [confirming, setConfirming] = useState<Expense | null>(null);
  const [form, setForm] = useState<ExpenseForm>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ pageSize: '100', ...(search && { search }), ...(from && { from }), ...(to && { to }) });
      const result = await api<{ data: Expense[]; totalAmount: number }>(`/expenses?${query}`);
      setExpenses(result.data);
      setTotalAmount(Number(result.totalAmount));
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Could not load expenses' });
    } finally {
      setLoading(false);
    }
  }, [search, from, to]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);

  const categoryCount = useMemo(() => new Set(expenses.map((expense) => expense.category.trim().toLowerCase())).size, [expenses]);

  function openForm(expense?: Expense) {
    setEditing(expense ?? null);
    setForm(expense
      ? { title: expense.title, category: expense.category, amount: String(expense.amount), expenseDate: expense.expenseDate.slice(0, 10), note: expense.note ?? '' }
      : emptyForm);
    setFormOpen(true);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api(editing ? `/expenses/${editing.id}` : '/expenses', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(form),
      });
      setFormOpen(false);
      setToast({ type: 'success', message: editing ? 'Expense updated' : 'Expense recorded' });
      await load();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Could not save expense' });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirming) return;
    setBusy(true);
    try {
      await api(`/expenses/${confirming.id}`, { method: 'DELETE' });
      setConfirming(null);
      setToast({ type: 'success', message: 'Expense deleted' });
      await load();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Could not delete expense' });
    } finally {
      setBusy(false);
    }
  }

  return <div className="page">
    <PageHeader eyebrow="Cost tracking" title="Expenses" description="Record and review company expenses such as fuel, maintenance and utilities." actions={<button className="button button--primary" onClick={() => openForm()}><Plus size={18} />Add expense</button>} />
    <section className="payroll-summary">
      <article><span>Total recorded</span><strong>{currency(totalAmount)}</strong><p>Matches current filters</p></article>
      <article><span>Entries</span><strong>{expenses.length}</strong><p>Expense records shown</p></article>
      <article><span>Categories</span><strong>{categoryCount}</strong><p>Distinct categories in view</p></article>
    </section>
    <section className="toolbar">
      <div className="search-box"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, category or note…" aria-label="Search expenses" /></div>
      <label className="sr-only" htmlFor="expenses-from">From date</label>
      <input id="expenses-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="From date" />
      <label className="sr-only" htmlFor="expenses-to">To date</label>
      <input id="expenses-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label="To date" />
      <span className="toolbar__count">{expenses.length} records</span>
    </section>
    <section className="table-card">
      {loading ? <LoadingState /> : !expenses.length ? <EmptyState icon={<Receipt />} title="No expenses found" description="Add an expense or adjust your search and date filters." /> : <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Title</th><th>Category</th><th>Date</th><th>Amount</th><th>Added by</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{expenses.map((expense) => <tr key={expense.id}>
        <td data-label="Title"><strong className="cell-main">{expense.title}</strong>{expense.note && <span className="cell-sub">{expense.note}</span>}</td>
        <td data-label="Category"><span className="location-tag"><Wallet size={14} />{expense.category}</span></td>
        <td data-label="Date">{new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(expense.expenseDate))}</td>
        <td data-label="Amount"><strong className="salary-cell">{currency(expense.amount)}</strong></td>
        <td data-label="Added by">{expense.createdBy?.name ?? '—'}</td>
        <td className="row-action"><button className="icon-button" onClick={() => openForm(expense)} aria-label={`Edit ${expense.title}`}><Pencil size={16} /></button><button className="icon-button" onClick={() => setConfirming(expense)} aria-label={`Delete ${expense.title}`}><Trash2 size={16} /></button></td>
      </tr>)}</tbody></table></div>}
    </section>
    <Modal open={formOpen} title={editing ? 'Edit expense' : 'Add expense'} description="Keep a record of company spending for reporting and audits." onClose={() => setFormOpen(false)}>
      <form className="form-grid" onSubmit={save}>
        <label className="form-grid__wide">Title<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Diesel for site generator" required /></label>
        <label>Category<input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder="e.g. Fuel" required /></label>
        <label>Amount (₹)<input type="number" min="1" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} required /></label>
        <label>Expense date<input type="date" value={form.expenseDate} onChange={(event) => setForm({ ...form, expenseDate: event.target.value })} required /></label>
        <label className="form-grid__wide">Note (optional)<textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Additional details" rows={3} /></label>
        <footer className="modal__actions"><button type="button" className="button button--ghost" onClick={() => setFormOpen(false)}>Cancel</button><button className="button button--primary" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add expense'}</button></footer>
      </form>
    </Modal>
    <Modal open={Boolean(confirming)} title="Delete expense?" description="This will permanently remove the record." onClose={() => setConfirming(null)}>
      <div className="confirm-dialog"><p>Delete <strong>{confirming?.title}</strong> ({confirming && currency(confirming.amount)})? This cannot be undone.</p><footer><button className="button button--ghost" onClick={() => setConfirming(null)}>Cancel</button><button className="button button--danger" onClick={remove} disabled={busy}>{busy ? 'Deleting…' : 'Delete expense'}</button></footer></div>
    </Modal>
    {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
  </div>;
}
