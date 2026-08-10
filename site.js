/**
 * site.js
 * =======
 * Shared behavior for the site pages (landing, about, contact):
 *
 *   1. Boot the starfield background — the same renderer the simulator uses,
 *      drifting gently at 0.05c so the sky is already alive on load.
 *   2. Cinematic hand-off into the simulator: fade the console and close the
 *      black veil, THEN navigate. The simulator page opens behind its own
 *      clearing veil at the same 0.05c, so the cut reads as one continuous
 *      flight rather than a page load.
 *
 * Each feature activates only if its element exists, so the one script
 * serves every page.
 */

import { createStarfield } from './starfield-engine.js';

/** Drift speed for ambient (non-simulator) pages, as a fraction of c. */
const AMBIENT_BETA = 0.05;

/** How long the veil takes to close before navigation (ms). Matches the
 *  --t-veil transition in site.css, plus a small settle margin. */
const LEAVE_DURATION_MS = 750;

// 1. Ambient starfield background
const canvas = document.getElementById('starfield');
if (canvas) {
  createStarfield(canvas, { initialBeta: AMBIENT_BETA });
}

// 2. "Begin Simulation" — progressively enhanced <a>: with JS disabled (or
// reduced motion preferred) it remains a plain, instant link.
const begin = document.getElementById('beginSimulation');
if (begin) {
  begin.addEventListener('click', (event) => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) return; // plain navigation, no theatrics

    event.preventDefault();
    document.body.classList.add('is-leaving'); // console bows out, veil closes
    window.setTimeout(() => {
      window.location.href = begin.href;
    }, LEAVE_DURATION_MS);
  }, { once: true }); // double-clicks shouldn't queue a second navigation
}
