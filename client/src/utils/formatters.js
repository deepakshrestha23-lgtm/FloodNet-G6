const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short'
});

const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

export function formatDateTime(value) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : dateTimeFormatter.format(parsed);
}

export function formatDate(value) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : dateFormatter.format(parsed);
}

export function formatRelative(value) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';

  const diffMinutes = Math.round((Date.now() - parsed.getTime()) / 60000);

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;

  const diffDays = Math.round(diffHours / 24);
  return diffDays === 1 ? 'yesterday' : `${diffDays} days ago`;
}

/**
 * Converts an ISO timestamp into the value a datetime-local input expects,
 * expressed in the browser's local time zone.
 */
export function toDateTimeLocalValue(value) {
  const parsed = value ? new Date(value) : new Date();
  if (Number.isNaN(parsed.getTime())) return '';

  const offsetMs = parsed.getTimezoneOffset() * 60000;
  return new Date(parsed.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function formatNumber(value) {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat().format(value);
}

export function formatPercent(value) {
  if (value === null || value === undefined) return '—';
  return `${Math.round(value)}%`;
}

export function fullName(person) {
  if (!person) return '—';
  const name = [person.firstName, person.lastName].filter(Boolean).join(' ');
  return name || person.email || '—';
}

export function describeArea(item) {
  if (!item) return 'Location not specified';
  if (item.geography) {
    return [
      item.geography.ward?.name,
      item.geography.localLevel?.name,
      item.geography.district?.name,
      item.geography.province?.name
    ].filter(Boolean).join(', ');
  }
  if (item.zone) return item.zone.name;
  return 'Location not specified';
}
