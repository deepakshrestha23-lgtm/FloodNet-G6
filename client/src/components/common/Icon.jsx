/**
 * A small inline SVG icon set. Icons are decorative by default (aria-hidden) so
 * they never duplicate the written label that always sits beside them.
 *
 * Everything is drawn with `currentColor` and a 24x24 viewBox, which lets an
 * icon inherit the colour and size of whatever it is placed inside.
 */
const PATHS = {
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="2" /><rect x="14" y="3" width="7" height="5" rx="2" /><rect x="14" y="12" width="7" height="9" rx="2" /><rect x="3" y="16" width="7" height="5" rx="2" /></>,
  report: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h4" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  bell: <><path d="M18 8a6 6 0 1 0-12 0c0 6-3 7-3 7h18s-3-1-3-7" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>,
  shelter: <><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v10h14V10" /><path d="M10 20v-5h4v5" /></>,
  shield: <><path d="M12 3 5 6v6c0 4.4 3 8.2 7 9 4-.8 7-4.6 7-9V6z" /><path d="m9 12 2 2 4-4" /></>,
  users: <><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16.5 5.3a3.2 3.2 0 0 1 0 5.4M18 14.4a6.5 6.5 0 0 1 3.5 5.6" /></>,
  map: <><path d="m9 4 6 2.5L21 4v14l-6 2.5L9 18l-6 2.5V6.5z" /><path d="M9 4v14M15 6.5v14" /></>,
  database: <><ellipse cx="12" cy="6" rx="8" ry="3" /><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6" /><path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></>,
  history: <><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" /><path d="M3 4v5h5" /><path d="M12 8v4.5l3 1.8" /></>,
  user: <><circle cx="12" cy="8" r="3.5" /><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" /></>,
  logout: <><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 8 6 12l4 4" /><path d="M6 12h9" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  chevronRight: <path d="m9 5 7 7-7 7" />,
  chevronLeft: <path d="m15 5-7 7 7 7" />,
  arrowRight: <><path d="M4 12h15" /><path d="m13 6 6 6-6 6" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  warning: <><path d="M12 3.5 2.8 19.5h18.4z" /><path d="M12 9.5v4.5M12 17.2v.1" /></>,
  drop: <path d="M12 3.2s6.2 6.4 6.2 10.6a6.2 6.2 0 0 1-12.4 0C5.8 9.6 12 3.2 12 3.2z" />,
  wave: <><path d="M2 8.5c2.6-2 4.6-2 7 0s5.5 2 8 0" /><path d="M2 13c2.6-2 4.6-2 7 0s5.5 2 8 0" /><path d="M2 17.5c2.6-2 4.6-2 7 0s5.5 2 8 0" /></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5.2l3.2 2" /></>,
  phone: <path d="M6.5 3.5h3l1.5 4L9 9.5a11 11 0 0 0 5.5 5.5l2-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2z" />,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
  filter: <path d="M3.5 5.5h17l-6.5 7.5v6l-4 2v-8z" />,
  refresh: <><path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1" /><path d="M21 3v5h-5" /></>,
  lock: <><rect x="4.5" y="10" width="15" height="10.5" rx="2.5" /><path d="M8 10V7.5a4 4 0 0 1 8 0V10" /></>,
  radar: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" /></>,
  megaphone: <><path d="M4 10v4a2 2 0 0 0 2 2h2l8 4V4L8 8H6a2 2 0 0 0-2 2z" /><path d="M19 9.5a3.5 3.5 0 0 1 0 5" /></>,
  spark: <path d="M12 3.5 13.9 9l5.6 1.9-5.6 1.9L12 18.4l-1.9-5.6L4.5 10.9 10.1 9z" />,
  pin: <><path d="M12 21s6.5-6.1 6.5-10.5a6.5 6.5 0 1 0-13 0C5.5 14.9 12 21 12 21z" /><circle cx="12" cy="10.5" r="2.5" /></>,
  people: <><circle cx="12" cy="7" r="3" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></>,
  eye: <><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" /><circle cx="12" cy="12" r="2.8" /></>,
  inbox: <><path d="M3.5 13h4l1.5 3h6l1.5-3h4" /><path d="M5.5 5h13l2 8v4a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-4z" /></>
};

function Icon({ name, size = 18, strokeWidth = 1.8, className = '', title }) {
  const path = PATHS[name];
  if (!path) return null;

  return (
    <svg
      className={`fn-icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : 'true'}
      role={title ? 'img' : undefined}
      focusable="false"
    >
      {title && <title>{title}</title>}
      {path}
    </svg>
  );
}

export default Icon;
