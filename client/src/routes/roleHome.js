/**
 * Where each role lands after signing in. Kept in one place so the login page,
 * the redirect route and the navigation all agree.
 */
const ROLE_HOME = {
  RESIDENT: '/resident',
  FLOOD_MONITORING_OFFICER: '/officer',
  EVACUATION_OFFICER: '/evacuation',
  ADMINISTRATOR: '/admin'
};

export function roleHomePath(user) {
  return ROLE_HOME[user?.role?.code] || '/';
}

export default ROLE_HOME;
