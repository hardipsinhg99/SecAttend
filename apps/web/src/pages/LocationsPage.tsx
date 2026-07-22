import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Building2, MapPin, Pencil, Plus, RotateCcw, Search, ShieldCheck, Users } from 'lucide-react';
import { api } from '../lib/api';
import type { Location, Status } from '../types';
import { EmptyState, LoadingState, Modal, PageHeader, Toast } from '../components/ui';

type ManagedLocation = Location & { status: Status; createdAt: string; _count: { guards: number; managers: number } };
type LocationForm = { name: string; address: string; clientName: string };
const emptyForm: LocationForm = { name: '', address: '', clientName: '' };

export function LocationsPage() {
  const [locations, setLocations] = useState<ManagedLocation[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'ALL' | Status>('ACTIVE');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ManagedLocation | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [confirming, setConfirming] = useState<ManagedLocation | null>(null);
  const [form, setForm] = useState<LocationForm>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ includeInactive: 'true', ...(search && { search }) });
      const result = await api<{ data: ManagedLocation[] }>(`/locations?${query}`);
      setLocations(result.data);
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Could not load locations' });
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);

  function openForm(location?: ManagedLocation) {
    setEditing(location ?? null);
    setForm(location ? { name: location.name, address: location.address ?? '', clientName: location.clientName ?? '' } : emptyForm);
    setFormOpen(true);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api(editing ? `/locations/${editing.id}` : '/locations', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(form),
      });
      setFormOpen(false);
      setToast({ type: 'success', message: editing ? 'Location updated' : 'Location added and ready for assignment' });
      await load();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Could not save location' });
    } finally {
      setBusy(false);
    }
  }

  async function deactivate() {
    if (!confirming) return;
    setBusy(true);
    try {
      await api(`/locations/${confirming.id}`, { method: 'DELETE' });
      setConfirming(null);
      setToast({ type: 'success', message: 'Location deactivated' });
      await load();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Could not deactivate location' });
    } finally {
      setBusy(false);
    }
  }

  async function activate(location: ManagedLocation) {
    setBusy(true);
    try {
      await api(`/locations/${location.id}/activate`, { method: 'POST' });
      setToast({ type: 'success', message: `${location.name} is active again` });
      await load();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Could not activate location' });
    } finally {
      setBusy(false);
    }
  }

  const visible = locations.filter((location) => status === 'ALL' || location.status === status);
  const activeCount = locations.filter((location) => location.status === 'ACTIVE').length;

  return <div className="page">
    <PageHeader eyebrow="Deployment network" title="Locations" description="Maintain the live site, client and address directory used for guard and manager assignments." actions={<button className="button button--primary" onClick={() => openForm()}><Plus size={18} />Add location</button>} />
    <section className="location-summary">
      <article><Building2 /><div><span>Active sites</span><strong>{activeCount}</strong></div></article>
      <article><ShieldCheck /><div><span>Assigned guards</span><strong>{locations.reduce((sum, location) => sum + location._count.guards, 0)}</strong></div></article>
      <article><Users /><div><span>Assigned managers</span><strong>{locations.reduce((sum, location) => sum + location._count.managers, 0)}</strong></div></article>
    </section>
    <section className="toolbar">
      <div className="search-box"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search site, client or address…" aria-label="Search locations" /></div>
      <select value={status} onChange={(event) => setStatus(event.target.value as 'ALL' | Status)} aria-label="Filter location status"><option value="ACTIVE">Active locations</option><option value="INACTIVE">Inactive locations</option><option value="ALL">All locations</option></select>
      <span className="toolbar__count">{visible.length} sites</span>
    </section>
    <section className="location-grid">
      {loading ? <LoadingState /> : !visible.length ? <EmptyState icon={<MapPin />} title="No locations found" description="Add a deployment site or adjust your search and status filter." /> : visible.map((location) =>
        <article className={`location-card ${location.status === 'INACTIVE' ? 'location-card--inactive' : ''}`} key={location.id}>
          <header><span className="location-card__icon"><Building2 size={21} /></span><span className={`status-badge status-badge--${location.status.toLowerCase()}`}><i />{location.status.toLowerCase()}</span></header>
          <h2>{location.name}</h2>
          {location.clientName && <span className="location-card__client">Client: {location.clientName}</span>}
          <p><MapPin size={16} />{location.address}</p>
          <div className="location-card__coverage"><span><ShieldCheck size={16} /><strong>{location._count.guards}</strong> guards</span><span><Users size={16} /><strong>{location._count.managers}</strong> managers</span></div>
          <footer><button className="button button--secondary button--small" onClick={() => openForm(location)}><Pencil size={15} />Edit details</button>{location.status === 'ACTIVE' ? <button className="location-card__danger" onClick={() => setConfirming(location)}>Deactivate</button> : <button className="location-card__restore" onClick={() => activate(location)} disabled={busy}><RotateCcw size={15} />Reactivate</button>}</footer>
        </article>)}
    </section>
    <Modal open={formOpen} title={editing ? 'Edit location' : 'Add deployment location'} description="These details appear wherever guards and managers are assigned." onClose={() => setFormOpen(false)}>
      <form className="form-grid location-form" onSubmit={save}>
        <label className="form-grid__wide">Location name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Meridian Business Park" required /></label>
        <label className="form-grid__wide">Principal employer / client<input value={form.clientName} onChange={(event) => setForm({ ...form, clientName: event.target.value })} placeholder="e.g. JGKPL CTU" /></label>
        <label className="form-grid__wide">Full site address<textarea value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="Building, street, area, city and postal code" rows={4} required /></label>
        <footer className="modal__actions"><button type="button" className="button button--ghost" onClick={() => setFormOpen(false)}>Cancel</button><button className="button button--primary" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add location'}</button></footer>
      </form>
    </Modal>
    <Modal open={Boolean(confirming)} title="Deactivate location?" description="Inactive locations cannot be selected for new guard or manager assignments." onClose={() => setConfirming(null)}>
      <div className="confirm-dialog"><p>Before deactivation, <strong>{confirming?.name}</strong> must have no active guards or managers assigned.</p><footer><button className="button button--ghost" onClick={() => setConfirming(null)}>Cancel</button><button className="button button--danger" onClick={deactivate} disabled={busy}>{busy ? 'Checking assignments…' : 'Deactivate location'}</button></footer></div>
    </Modal>
    {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
  </div>;
}
