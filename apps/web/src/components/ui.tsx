import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, LoaderCircle, X } from 'lucide-react';

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) {
  return <header className="page-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>{actions && <div className="page-header__actions">{actions}</div>}</header>;
}

export function EmptyState({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return <div className="empty-state"><span>{icon}</span><h3>{title}</h3><p>{description}</p></div>;
}

export function LoadingState({ label = 'Loading information' }: { label?: string }) {
  return <div className="loading-state"><LoaderCircle size={22} className="spin" /><span>{label}</span></div>;
}

export function Modal({ open, title, description, onClose, children, size = 'md' }: { open: boolean; title: string; description?: string; onClose: () => void; children: ReactNode; size?: 'md' | 'lg' }) {
  if (!open) return null;
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className={`modal modal--${size}`} role="dialog" aria-modal="true" aria-labelledby="modal-title"><header><div><p className="eyebrow">SHREEDEVI SECURITY SERVICE</p><h2 id="modal-title">{title}</h2>{description && <p>{description}</p>}</div><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={20} /></button></header>{children}</section></div>;
}

export function Toast({ type = 'success', message, onClose }: { type?: 'success' | 'error'; message: string; onClose: () => void }) {
  return <div className={`toast toast--${type}`} role="status">{type === 'success' ? <CheckCircle2 /> : <AlertCircle />}<span>{message}</span><button onClick={onClose} aria-label="Dismiss"><X size={16} /></button></div>;
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  return <span className={`avatar avatar--${size}`} aria-label={name}>{initials}</span>;
}
