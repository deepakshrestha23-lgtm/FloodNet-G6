/**
 * Coordinate parsing.
 *
 * This runs on whatever an officer pastes into the centre and report forms. A
 * wrong parse does not fail loudly, it silently records a shelter in the wrong
 * place, so the refusal cases matter as much as the accepted ones.
 *
 * The module under test is browser ESM inside the client workspace, which is
 * declared "type": "module", so it is loaded with a dynamic import rather than
 * required.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');

const MODULE_PATH = path.join(__dirname, '..', 'client', 'src', 'utils', 'coordinates.js');

let parseCoordinates;
let isOutsideNepal;
let swapWouldFixNepal;

test.before(async () => {
  ({ parseCoordinates, isOutsideNepal, swapWouldFixNepal } =
    await import(pathToFileURL(MODULE_PATH).href));
});

const KATHMANDU = { latitude: 27.6939, longitude: 85.314 };

test('a pasted decimal pair is accepted in the forms people actually paste', () => {
  for (const input of ['27.6939, 85.3140', '27.6939,85.3140', '27.6939 85.3140', '  27.6939 , 85.3140  ']) {
    const parsed = parseCoordinates(input);
    assert.ok(parsed, `expected "${input}" to parse`);
    assert.equal(Number(parsed.latitude.toFixed(4)), KATHMANDU.latitude);
    assert.equal(Number(parsed.longitude.toFixed(4)), KATHMANDU.longitude);
  }
});

test('a map application link is accepted', () => {
  for (const input of [
    'https://www.google.com/maps/@27.6939,85.3140,15z',
    'https://maps.google.com/?q=27.6939,85.3140'
  ]) {
    const parsed = parseCoordinates(input);
    assert.ok(parsed, `expected "${input}" to parse`);
    assert.equal(Number(parsed.latitude.toFixed(4)), KATHMANDU.latitude);
    assert.equal(Number(parsed.longitude.toFixed(4)), KATHMANDU.longitude);
  }
});

test('degrees, minutes and seconds are accepted and ordered by hemisphere', () => {
  const parsed = parseCoordinates('27°41\'38.0"N 85°18\'50.4"E');
  assert.ok(parsed);
  assert.equal(Number(parsed.latitude.toFixed(3)), 27.694);
  assert.equal(Number(parsed.longitude.toFixed(3)), 85.314);
});

test('anything that is not clearly a position is refused rather than guessed', () => {
  for (const input of [
    '',
    '   ',
    '27.6939',
    'Ward 5, Sulikot',
    'the water is 2 feet deep near 5 houses',
    '999, 888',
    'not a location at all',
    null,
    undefined
  ]) {
    assert.equal(parseCoordinates(input), null, `expected ${JSON.stringify(input)} to be refused`);
  }
});

test('a transposed pair is detected so it can be offered as a fix', () => {
  assert.equal(isOutsideNepal(27.69, 85.31), false, 'Kathmandu is inside Nepal');
  assert.equal(isOutsideNepal(85.31, 27.69), true, 'the transposed pair is not');
  assert.equal(swapWouldFixNepal(85.31, 27.69), true);
});

test('a genuinely foreign position is not mistaken for a transposition', () => {
  // London. Swapping it does not land in Nepal either, so an officer is not
  // prompted to "fix" a position that may well be deliberate.
  assert.equal(swapWouldFixNepal(51.5, -0.12), false);
});
