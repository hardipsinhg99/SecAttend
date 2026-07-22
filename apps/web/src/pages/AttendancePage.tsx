import { useCallback, useEffect, useMemo, useState } from 'react';
import { addMonths, eachDayOfInterval, endOfMonth, format, getDay, isSameDay, startOfMonth, subMonths } from 'date-fns';
import { CalendarCheck, Check, ChevronLeft, ChevronRight, Clock3, Save, UserX } from 'lucide-react';
import { api } from '../lib/api';
import { businessDateKey, businessToday, localCalendarDateKey } from '../lib/businessDate';
import type { AttendanceStatus, Guard } from '../types';
import { Avatar, LoadingState, PageHeader, Toast } from '../components/ui';

type DaySummary = { date: string; marked: number; present: number; absent: number; total: number; state: string };

export function AttendancePage() {
  const [month, setMonth] = useState(() => startOfMonth(businessToday()));
  const [selected, setSelected] = useState(() => businessToday());
  const [summary, setSummary] = useState<DaySummary[]>([]);
  const [guards, setGuards] = useState<Guard[]>([]);
  const [records, setRecords] = useState<Record<string, AttendanceStatus>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editable, setEditable] = useState(true);
  const [toast, setToast] = useState('');
  const monthKey = format(month, 'yyyy-MM');
  const dateKey = localCalendarDateKey(selected);
  const today = businessToday();
  const todayKey = businessDateKey();

  const loadSummary = useCallback(() => api<{ data: DaySummary[] }>(`/attendance/calendar/summary?month=${monthKey}`).then((result) => setSummary(result.data)), [monthKey]);
  const loadDay = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<{ data: Guard[]; editable: boolean }>(`/attendance/${dateKey}`);
      setGuards(result.data);
      setRecords(Object.fromEntries(result.data.filter((guard) => guard.attendance).map((guard) => [guard.id, guard.attendance!.status])));
      setEditable(result.editable && dateKey <= businessDateKey());
    } finally {
      setLoading(false);
    }
  }, [dateKey]);

  useEffect(() => { void loadSummary(); }, [loadSummary]);
  useEffect(() => { void loadDay(); }, [loadDay]);
  useEffect(() => { if (format(selected, 'yyyy-MM') !== monthKey) setSelected(startOfMonth(month)); }, [month, monthKey, selected]);

  const summaryMap = useMemo(() => new Map(summary.map((item) => [item.date, item])), [summary]);
  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const blanks = Array.from({ length: getDay(startOfMonth(month)) });
  function statusFor(day: Date) { if (localCalendarDateKey(day) > todayKey) return 'future'; return summaryMap.get(localCalendarDateKey(day))?.state ?? 'none'; }
  function markAll() { setRecords(Object.fromEntries(guards.map((guard) => [guard.id, 'PRESENT']))); }

  async function save() {
    const values = Object.entries(records).map(([guardId, status]) => ({ guardId, status }));
    if (!values.length) return;
    setSaving(true);
    try {
      await api(`/attendance/${dateKey}`, { method: 'POST', body: JSON.stringify({ records: values }) });
      setToast(`${values.length} attendance records saved`);
      await Promise.all([loadDay(), loadSummary()]);
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Unable to save attendance');
    } finally {
      setSaving(false);
    }
  }

  return <div className="page">
    <PageHeader eyebrow="Daily field operations" title="Attendance" description="Mark guards present or absent for any current or past date, with their shift and post visible." actions={<button className="button button--primary" onClick={save} disabled={!editable || saving || !Object.keys(records).length}><Save size={17} />{saving ? 'Saving…' : 'Save attendance'}</button>} />
    <section className="attendance-layout">
      <article className="panel calendar-card">
        <header><button className="icon-button" onClick={() => setMonth(subMonths(month, 1))} aria-label="Previous month"><ChevronLeft /></button><h2>{format(month, 'MMMM yyyy')}</h2><button className="icon-button" onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month"><ChevronRight /></button></header>
        <div className="calendar-weekdays">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="calendar-grid">{blanks.map((_, index) => <span key={`blank-${index}`} />)}{days.map((day) => {
          const state = statusFor(day);
          const item = summaryMap.get(localCalendarDateKey(day));
          return <button key={day.toISOString()} className={`${state} ${isSameDay(day, selected) ? 'selected' : ''} ${isSameDay(day, today) ? 'today' : ''}`} disabled={state === 'future'} onClick={() => setSelected(day)}><span>{format(day, 'd')}</span><i />{item && <small>{item.marked}/{item.total}</small>}</button>;
        })}</div>
        <footer className="calendar-legend"><span><i className="complete" />Complete</span><span><i className="partial" />Partial</span><span><i className="none" />Unmarked</span></footer>
      </article>
      <article className="panel attendance-sheet">
        <header className="attendance-sheet__header"><div><p className="eyebrow">Attendance sheet</p><h2>{format(selected, 'EEEE, d MMMM')}</h2><p>{guards.length} assigned guards · {Object.keys(records).length} marked</p></div><div>{editable ? <span className="editable-chip"><Clock3 size={14} />Editing always open</span> : <span className="locked-chip">Future date</span>}<button className="button button--secondary button--small" onClick={markAll} disabled={!editable}><Check size={16} />Mark all present</button></div></header>
        {loading ? <LoadingState /> : <div className="attendance-list">{guards.map((guard) => <div className="attendance-row" key={guard.id}>
          <div className="person-cell"><Avatar name={guard.name} /><div><strong>{guard.name}</strong><span>{guard.employeeId} · {guard.shiftType ? `${guard.shiftType.toLowerCase()} shift` : 'Shift not set'} · {guard.postDetail || guard.location.name}</span></div></div>
          <div className="attendance-toggle"><button disabled={!editable} className={records[guard.id] === 'PRESENT' ? 'active present' : ''} onClick={() => setRecords({ ...records, [guard.id]: 'PRESENT' })}><CalendarCheck size={17} />Present</button><button disabled={!editable} className={records[guard.id] === 'ABSENT' ? 'active absent' : ''} onClick={() => setRecords({ ...records, [guard.id]: 'ABSENT' })}><UserX size={17} />Absent</button></div>
        </div>)}</div>}
        <footer className="attendance-sheet__footer"><span>{Object.keys(records).length === guards.length ? <><Check size={15} /> All guards marked</> : `${guards.length - Object.keys(records).length} guards still unmarked`}</span><button className="button button--primary" onClick={save} disabled={!editable || saving || !Object.keys(records).length}>{saving ? 'Saving…' : `Save ${Object.keys(records).length} records`}</button></footer>
      </article>
    </section>
    {toast && <Toast message={toast} onClose={() => setToast('')} />}
  </div>;
}
