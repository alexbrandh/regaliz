export function formatDate(dateString: string, opts?: { withTime?: boolean }): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(opts?.withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date);
}

export function formatDateShort(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short' }).format(date);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('es-CO').format(n);
}

export function relativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = Date.now();
  const diffSec = Math.round((now - date.getTime()) / 1000);

  if (diffSec < 60) return 'hace un momento';
  if (diffSec < 3600) {
    const m = Math.floor(diffSec / 60);
    return `hace ${m} min`;
  }
  if (diffSec < 86400) {
    const h = Math.floor(diffSec / 3600);
    return `hace ${h} h`;
  }
  if (diffSec < 2592000) {
    const d = Math.floor(diffSec / 86400);
    return `hace ${d} ${d === 1 ? 'día' : 'días'}`;
  }
  return formatDate(dateString);
}

export function formatDelta(current: number, previous: number): { value: number; pct: number; sign: 'up' | 'down' | 'flat' } {
  const value = current - previous;
  const pct = previous === 0 ? (current > 0 ? 100 : 0) : Math.round((value / previous) * 100);
  const sign: 'up' | 'down' | 'flat' = value > 0 ? 'up' : value < 0 ? 'down' : 'flat';
  return { value, pct, sign };
}

export function initials(firstName: string | null, lastName: string | null, email?: string): string {
  if (firstName || lastName) {
    return `${(firstName?.[0] || '').toUpperCase()}${(lastName?.[0] || '').toUpperCase()}` || '?';
  }
  if (email) return email[0]?.toUpperCase() ?? '?';
  return '?';
}
