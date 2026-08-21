const env = require('../config/env');

/*
 * River discharge and rainfall from Open-Meteo.
 *
 * Two separate services are combined: the flood API returns modelled river
 * discharge from GloFAS (the Copernicus Global Flood Awareness System) and the
 * forecast API returns precipitation. Neither needs an API key, so nothing
 * secret is configured here.
 *
 * This is corroborating context for an officer, never a verification in its
 * own right. A modelled discharge figure does not know about a blocked culvert
 * on one street, so the officer still decides. Nothing here is stored against a
 * report, and no call is ever allowed to fail a page: every failure degrades to
 * "unavailable" and the surrounding screen renders unchanged.
 */

const FLOOD_URL = 'https://flood-api.open-meteo.com/v1/flood';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const FORECAST_DAYS = 5;
const SOURCE_LABEL = 'Open-Meteo (GloFAS river discharge, ECMWF precipitation)';

/**
 * Coordinates are rounded to two decimals (roughly 1km) before they are used as
 * a cache key. Two reports from the same neighbourhood then share one upstream
 * call, and the exact position a resident stood in is not what gets retained.
 */
const CACHE_PRECISION = 2;
const cache = new Map();

function cacheKey(latitude, longitude) {
  return `${latitude.toFixed(CACHE_PRECISION)},${longitude.toFixed(CACHE_PRECISION)}`;
}

function readCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }

  return entry.value;
}

function writeCache(key, value) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + env.weatherCacheTtlSeconds * 1000
  });

  // The map is bounded so a long-running instance cannot grow without limit.
  if (cache.size > 500) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
}

function unavailable(reason) {
  return { available: false, reason };
}

async function fetchJson(url, parameters) {
  const query = new URLSearchParams(parameters).toString();
  const response = await fetch(`${url}?${query}`, {
    signal: AbortSignal.timeout(env.weatherTimeoutMs),
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) {
    throw new Error(`${url} responded ${response.status}`);
  }

  return response.json();
}

/** Pairs each forecast date with its value, dropping days the upstream omitted. */
function toSeries(daily, field) {
  if (!daily || !Array.isArray(daily.time) || !Array.isArray(daily[field])) return [];

  return daily.time
    .map((date, index) => ({ date, value: daily[field][index] }))
    .filter((point) => typeof point.value === 'number' && Number.isFinite(point.value));
}

/**
 * Describes where the river is heading rather than only where it is now.
 *
 * A rising trend is what makes this useful next to a report: a resident
 * describing deep water on a river that is still climbing is a different
 * situation from the same description on a river that has already peaked.
 */
function summariseDischarge(series) {
  if (series.length === 0) return null;

  const today = series[0].value;
  const rest = series.slice(1);
  const peak = rest.length ? Math.max(...rest.map((point) => point.value)) : today;
  const changePercent = today > 0 ? Math.round(((peak - today) / today) * 100) : 0;

  let trend = 'STEADY';
  if (changePercent >= 25) trend = 'RISING';
  else if (changePercent <= -25) trend = 'FALLING';

  return {
    unit: 'm³/s',
    today: Number(today.toFixed(2)),
    peak: Number(peak.toFixed(2)),
    changePercent,
    trend,
    days: series.map((point) => ({ date: point.date, value: Number(point.value.toFixed(2)) }))
  };
}

function summariseRainfall(series) {
  if (series.length === 0) return null;

  const next48h = series.slice(0, 2).reduce((total, point) => total + point.value, 0);

  return {
    unit: 'mm',
    today: Number(series[0].value.toFixed(1)),
    next48hTotal: Number(next48h.toFixed(1)),
    days: series.map((point) => ({ date: point.date, value: Number(point.value.toFixed(1)) }))
  };
}

/**
 * Deterministic stand-in for tests and offline development. Values derive from
 * the coordinates, so the same location always produces the same reading and an
 * assertion stays stable without any network access.
 */
function mockConditions(latitude, longitude) {
  const seed = Math.abs(Math.round((latitude + longitude) * 100)) % 40;
  const today = new Date();
  const days = Array.from({ length: FORECAST_DAYS }, (_, index) => {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });

  return {
    available: true,
    source: `${SOURCE_LABEL} [mock]`,
    fetchedAt: new Date().toISOString(),
    cached: false,
    latitude,
    longitude,
    riverDischarge: summariseDischarge(
      days.map((date, index) => ({ date, value: 10 + seed + index * 4 }))
    ),
    rainfall: summariseRainfall(
      days.map((date, index) => ({ date, value: 5 + ((seed + index * 3) % 25) }))
    )
  };
}

/**
 * Returns river and rainfall context for a coordinate, or an unavailable marker.
 *
 * Never throws and never rejects: callers render a panel when `available` is
 * true and simply omit it otherwise.
 */
async function getConditions(latitude, longitude) {
  if (env.weatherMode === 'disabled') {
    return unavailable('Conditions data is not enabled in this environment');
  }

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return unavailable('Coordinates are required');
  }

  if (env.weatherMode === 'mock') {
    return mockConditions(latitude, longitude);
  }

  const key = cacheKey(latitude, longitude);
  const cached = readCache(key);
  if (cached) return { ...cached, cached: true };

  const shared = {
    latitude: latitude.toFixed(4),
    longitude: longitude.toFixed(4),
    forecast_days: String(FORECAST_DAYS)
  };

  try {
    // Requested together: one slow service should not double the wait.
    const [flood, forecast] = await Promise.all([
      fetchJson(FLOOD_URL, { ...shared, daily: 'river_discharge' }),
      fetchJson(FORECAST_URL, { ...shared, daily: 'precipitation_sum', timezone: 'Asia/Kathmandu' })
    ]);

    const riverDischarge = summariseDischarge(toSeries(flood.daily, 'river_discharge'));
    const rainfall = summariseRainfall(toSeries(forecast.daily, 'precipitation_sum'));

    if (!riverDischarge && !rainfall) {
      return unavailable('No conditions data was returned for this location');
    }

    const value = {
      available: true,
      source: SOURCE_LABEL,
      fetchedAt: new Date().toISOString(),
      cached: false,
      latitude,
      longitude,
      riverDischarge,
      rainfall
    };

    writeCache(key, value);
    return value;
  } catch (error) {
    // Logged for the operator; the browser is told only that it is unavailable,
    // because an upstream hostname and error string are not useful there.
    console.error('[Weather]', {
      mode: env.weatherMode,
      key,
      name: error.name,
      message: error.message
    });

    return unavailable(
      error.name === 'TimeoutError' || error.name === 'AbortError'
        ? 'The conditions service did not respond in time'
        : 'The conditions service is unavailable'
    );
  }
}

/** Exposed so tests can assert cache behaviour without waiting for the TTL. */
function clearCache() {
  cache.clear();
}

module.exports = { getConditions, clearCache, SOURCE_LABEL };
