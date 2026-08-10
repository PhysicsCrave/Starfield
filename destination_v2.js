/**
 * destination_v2.js
 * =================
 * Interstellar destinations for the relativistic-travel simulator.
 *
 * `distanceLy` is the REST-FRAME (Earth-frame) distance in light-years.
 * To add a destination, append an object with the same shape — the UI
 * and physics pick it up automatically, no other code changes needed.
 *
 * Changes from v1: the original three destinations are preserved verbatim;
 * six more were added (sorted by distance) to give the log-scale velocity
 * slider more interesting territory — nearby stars where 0.5c already helps,
 * and deep targets where only many "nines" make the trip survivable.
 * Distances follow commonly cited parallax/VLBI values.
 */
export const DESTINATIONS = [
  {
    id: 'proxima-centauri',
    name: 'Proxima Centauri',
    distanceLy: 4.246,
    icon: '🔴',
    blurb: 'The Sun’s closest neighbor, a faint red dwarf.',
  },
  {
    id: 'alpha-centauri',
    name: 'Alpha Centauri',
    distanceLy: 4.37,
    icon: '⭐',
    blurb: 'The nearest star system to the Sun.',
  },
  {
    id: 'sirius',
    name: 'Sirius',
    distanceLy: 8.6,
    icon: '✨',
    blurb: 'The brightest star in Earth’s night sky.',
  },
  {
    id: 'vega',
    name: 'Vega',
    distanceLy: 25.04,
    icon: '💫',
    blurb: 'A young blue-white star, once Earth’s pole star.',
  },
  {
    id: 'trappist-1',
    name: 'TRAPPIST-1',
    distanceLy: 40.7,
    icon: '🪐',
    blurb: 'Seven Earth-sized planets around an ultra-cool dwarf.',
  },
  {
    id: 'pleiades',
    name: 'Pleiades',
    distanceLy: 444,
    icon: '🌠',
    blurb: 'The Seven Sisters open star cluster.',
  },
  {
    id: 'betelgeuse',
    name: 'Betelgeuse',
    distanceLy: 548,
    icon: '🟠',
    blurb: 'A red supergiant nearing the end of its life.',
  },
  {
    id: 'sagittarius-a',
    name: 'Sagittarius A*',
    distanceLy: 26_700,
    icon: '🕳️',
    blurb: 'The supermassive black hole at the heart of the Milky Way.',
  },
  {
    id: 'andromeda',
    name: 'Andromeda Galaxy',
    distanceLy: 2_540_000,
    icon: '🌀',
    blurb: 'The nearest large galaxy to our own.',
  },
];
