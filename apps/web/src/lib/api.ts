const API_URL = import.meta.env.VITE_API_URL || '/api';

export class ApiError extends Error {
  constructor(message: string, public status: number, public details?: unknown) { super(message); }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('secattend_token');
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: 'Request failed' }));
    if (response.status === 401) window.dispatchEvent(new Event('secattend:unauthorized'));
    throw new ApiError(payload.error || 'Request failed', response.status, payload.details);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function currency(value: string | number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value));
}

export async function downloadFile(path: string, filename: string) {
  const token = localStorage.getItem('secattend_token');
  const response = await fetch(`${API_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!response.ok) throw new ApiError('Download failed', response.status);
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
