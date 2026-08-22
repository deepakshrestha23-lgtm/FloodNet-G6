/**
 * Coordinate entry helpers.
 *
 * Officers do not know their decimal degrees, but they can copy a position out
 * of a map application. These parsers accept the shapes that actually get
 * pasted so nobody has to retype numbers by hand, because a mistyped shelter
 * position is worse than an absent one.
 */

/**
 * Nepal's approximate bounding box, used only to warn. It is deliberately a
 * little generous and never blocks a save: the box is a sanity check on data
 * entry, not an authority on where the border runs.
 */
export const NEPAL_BOUNDS = { minLat: 26.0, maxLat: 30.7, minLon: 79.8, maxLon: 88.5 };

/**
 * Browser GPS is restricted to secure contexts. Localhost is treated as a
 * secure context by browsers, while a deployed HTTP address is not.
 *
 * Keeping this check in one place lets every location control explain the
 * deployment limitation consistently without affecting pasted or manual
 * coordinates.
 */
export function getGeolocationAvailability() {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return 'unsupported';
  if (typeof window === 'undefined' || window.isSecureContext !== true) return 'insecure';
  return 'available';
}

const DECIMAL_PAIR = /^\s*(-?\d{1,3}(?:\.\d+)?)\s*[,;]?\s+?\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;
const DECIMAL_PAIR_COMMA = /^\s*(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;
/* Google and Apple map links carry the position after an @ or a q= parameter. */
const URL_AT = /@(-?\d{1,3}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)/;
const URL_QUERY = /[?&](?:q|ll|daddr|sll)=(-?\d{1,3}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)/;
/* 27°41'38.0"N  and the looser 27 41 38 N that map apps also produce. */
const DMS_PART = /(\d{1,3})\s*[°d:\s]\s*(\d{1,2})\s*['′m:\s]\s*([\d.]+)\s*["″s]?\s*([NSEW])/gi;

function toDecimal(degrees, minutes, seconds, hemisphere) {
  const value = Number(degrees) + Number(minutes) / 60 + Number(seconds) / 3600;
  const negative = hemisphere.toUpperCase() === 'S' || hemisphere.toUpperCase() === 'W';
  return negative ? -value : value;
}

function inRange(latitude, longitude) {
  return (
    Number.isFinite(latitude) && Number.isFinite(longitude) &&
    latitude >= -90 && latitude <= 90 &&
    longitude >= -180 && longitude <= 180
  );
}

/**
 * Reads a pasted position and returns { latitude, longitude }, or null.
 *
 * Returning null rather than guessing is deliberate: silently accepting
 * something half-understood is how a centre ends up in the wrong district.
 */
export function parseCoordinates(input) {
  if (typeof input !== 'string') return null;
  const text = input.trim();
  if (!text) return null;

  // Degrees/minutes/seconds first: it also contains digits and separators that
  // the looser decimal patterns would otherwise match on.
  const dms = [...text.matchAll(DMS_PART)];
  if (dms.length >= 2) {
    const values = dms.slice(0, 2).map((part) => ({
      value: toDecimal(part[1], part[2], part[3], part[4]),
      hemisphere: part[4].toUpperCase()
    }));

    const latitudePart = values.find((v) => v.hemisphere === 'N' || v.hemisphere === 'S');
    const longitudePart = values.find((v) => v.hemisphere === 'E' || v.hemisphere === 'W');

    if (latitudePart && longitudePart && inRange(latitudePart.value, longitudePart.value)) {
      return { latitude: latitudePart.value, longitude: longitudePart.value };
    }
    return null;
  }

  for (const pattern of [URL_AT, URL_QUERY]) {
    const match = text.match(pattern);
    if (match) {
      const latitude = Number(match[1]);
      const longitude = Number(match[2]);
      if (inRange(latitude, longitude)) return { latitude, longitude };
      return null;
    }
  }

  // A bare pair only counts when the whole string is the pair, so a sentence
  // that happens to contain two numbers is not mistaken for a position.
  for (const pattern of [DECIMAL_PAIR_COMMA, DECIMAL_PAIR]) {
    const match = text.match(pattern);
    if (match) {
      const latitude = Number(match[1]);
      const longitude = Number(match[2]);
      if (inRange(latitude, longitude)) return { latitude, longitude };
      return null;
    }
  }

  return null;
}

/** True when a position sits outside Nepal, which usually means it was transposed. */
export function isOutsideNepal(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;

  return (
    lat < NEPAL_BOUNDS.minLat || lat > NEPAL_BOUNDS.maxLat ||
    lon < NEPAL_BOUNDS.minLon || lon > NEPAL_BOUNDS.maxLon
  );
}

/** True when swapping the pair would bring it inside Nepal. */
export function swapWouldFixNepal(latitude, longitude) {
  return isOutsideNepal(latitude, longitude) && !isOutsideNepal(longitude, latitude);
}
