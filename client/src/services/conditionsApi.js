import { apiRequest } from './api';
import { buildQuery } from './query';

/**
 * River discharge and rainfall for a coordinate.
 *
 * The endpoint always answers 200, reporting `available: false` when the
 * feature is switched off or the upstream did not respond, so callers do not
 * need to treat an absent reading as an error.
 */
export function fetchConditions(latitude, longitude) {
  return apiRequest(`/api/conditions${buildQuery({ latitude, longitude })}`);
}
