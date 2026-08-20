/**
 * Central label and presentation maps for the coded values the API returns.
 *
 * Every entry pairs a colour with a written label and a text symbol, so status
 * and severity are never communicated by colour alone.
 */

export const REPORT_STATUS = {
  PENDING_REVIEW: { label: 'Pending review', variant: 'warning', symbol: '○' },
  MORE_INFORMATION_REQUIRED: { label: 'More information needed', variant: 'info', symbol: '?' },
  VERIFIED: { label: 'Verified', variant: 'success', symbol: '✓' },
  REJECTED: { label: 'Rejected', variant: 'danger', symbol: '✕' },
  CLOSED: { label: 'Closed', variant: 'secondary', symbol: '■' }
};

export const OBSERVED_SEVERITY = {
  LOW: { label: 'Low', variant: 'success', symbol: '△' },
  MODERATE: { label: 'Moderate', variant: 'warning', symbol: '△' },
  HIGH: { label: 'High', variant: 'danger', symbol: '▲' },
  SEVERE: { label: 'Severe', variant: 'danger', symbol: '▲▲' },
  UNKNOWN: { label: 'Unknown', variant: 'secondary', symbol: '?' }
};

export const ROAD_CONDITION = {
  CLEAR: { label: 'Clear', variant: 'success', symbol: '✓' },
  RESTRICTED: { label: 'Restricted', variant: 'warning', symbol: '!' },
  BLOCKED: { label: 'Blocked', variant: 'danger', symbol: '✕' },
  UNKNOWN: { label: 'Unknown', variant: 'secondary', symbol: '?' }
};

export const ALERT_SEVERITY = {
  ADVISORY: { label: 'Advisory', variant: 'info', symbol: 'i', rank: 1 },
  WATCH: { label: 'Watch', variant: 'primary', symbol: '◉', rank: 2 },
  WARNING: { label: 'Warning', variant: 'warning', symbol: '!', rank: 3 },
  EMERGENCY: { label: 'Emergency', variant: 'danger', symbol: '!!', rank: 4 }
};

export const ALERT_STATUS = {
  DRAFT: { label: 'Draft', variant: 'secondary', symbol: '○' },
  PUBLISHED: { label: 'Published', variant: 'success', symbol: '◉' },
  EXPIRED: { label: 'Expired', variant: 'secondary', symbol: '□' },
  CANCELLED: { label: 'Cancelled', variant: 'danger', symbol: '✕' }
};

export const CENTRE_STATUS = {
  OPEN: { label: 'Open', variant: 'success', symbol: '✓' },
  NEAR_CAPACITY: { label: 'Near capacity', variant: 'warning', symbol: '!' },
  FULL: { label: 'Full', variant: 'danger', symbol: '✕' },
  CLOSED: { label: 'Closed', variant: 'secondary', symbol: '■' }
};

export const USER_STATUS = {
  ACTIVE: { label: 'Active', variant: 'success', symbol: '✓' },
  INACTIVE: { label: 'Inactive', variant: 'secondary', symbol: '□' }
};

export const ROLE = {
  RESIDENT: { label: 'Resident', variant: 'primary', symbol: '●' },
  FLOOD_MONITORING_OFFICER: { label: 'Flood Monitoring Officer', variant: 'info', symbol: '●' },
  EVACUATION_OFFICER: { label: 'Evacuation Officer', variant: 'warning', symbol: '●' },
  ADMINISTRATOR: { label: 'Administrator', variant: 'danger', symbol: '●' }
};

export const REVIEW_ACTION = {
  VERIFY: { label: 'Verified', variant: 'success', symbol: '✓' },
  REJECT: { label: 'Rejected', variant: 'danger', symbol: '✕' },
  MORE_INFORMATION_REQUIRED: { label: 'More information requested', variant: 'info', symbol: '?' },
  CLOSE: { label: 'Closed', variant: 'secondary', symbol: '■' }
};

export function describe(map, value, fallbackLabel = 'Unknown') {
  return map[value] || { label: value || fallbackLabel, variant: 'secondary', symbol: '?' };
}

export function toOptions(map) {
  return Object.entries(map).map(([value, meta]) => ({ value, label: meta.label }));
}
