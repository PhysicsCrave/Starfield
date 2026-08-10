/**
 * starfield_v2.js
 * ===============
 * UI controller for the relativistic starfield SIMULATOR page.
 *
 * The sky itself lives in starfield-engine.js (shared with the landing /
 * about / contact pages). This module owns everything the simulator adds on
 * top of it:
 *
 *   1. Velocity state — the single source of truth (exact β and its
 *      complement ε = 1 − β, tracked separately for precision near c)
 *   2. Physics readouts (exact values via relativity_v2.js)
 *   3. Formatting helpers
 *   4. UI bindings (slider, presets, destination select)
 *
 * Separation rule: the engine eases its RENDERED velocity for smooth motion;
 * every number shown to the user is computed from the exact state here.
 */

import {
  createStarfield,
  sliderToBeta,
  sliderToEpsilon,
  betaToSlider,
  BETA_MAX,
  EPS_MIN,
} from './starfield-engine.js';
import { lorentzFactorFromBetaComplement } from './relativity_v2.js';
import { DESTINATIONS } from './destination_v2.js';


// ─────────────────────────────────────────────────────────────────────────────
// 1. CONFIGURATION & STATE
// ─────────────────────────────────────────────────────────────────────────────

/** Speed of light (m/s) — for converting everyday speeds to fractions of c. */
const C_MS = 299_792_458;

/** Initial ship speed as a fraction of c (matches the landing page's drift). */
const INITIAL_BETA = 0.05;

// Speed presets — single source of truth for the buttons; add a line and the
// row rebuilds itself. Everyday speeds are m/s divided by c; the rest are
// already fractions of c.
const SPEED_PRESETS = [
  { group: 'Everyday',     label: 'Walking',     beta: 1.4   / C_MS },
  { group: 'Everyday',     label: 'ISS Orbit',   beta: 7660  / C_MS },
  { group: 'Everyday',     label: 'Escape Vel.', beta: 11186 / C_MS },
  { group: 'Relativistic', label: '0.1c',        beta: 0.1 },
  { group: 'Relativistic', label: '0.5c',        beta: 0.5 },
  { group: 'Relativistic', label: '0.9c',        beta: 0.9 },
  { group: 'Relativistic', label: '0.99c',       beta: 0.99 },
  { group: 'Relativistic', label: '0.999c',      beta: 0.999 },
  { group: 'Relativistic', label: '0.9999c',     beta: 0.9999 },
  { group: 'Relativistic', label: '0.99999c',    beta: 0.99999 },
];

const state = {
  /** Exact ship velocity as a fraction of c. Drives all physics readouts. */
  beta: 0,

  /**
   * ε = 1 − β, tracked separately so γ can be computed without cancellation.
   * When the speed comes from the slider, ε = 10^(−DECADES·t) exactly.
   */
  epsilon: 1,

  /** Slider position corresponding to `beta` (log space, [0, 1]). */
  sliderT: 0,
};


// ─────────────────────────────────────────────────────────────────────────────
// 2. PHYSICS READOUTS
// ─────────────────────────────────────────────────────────────────────────────
// Natural units throughout: distances in light-years, times in years, c = 1.
// Then β IS the velocity, t = d/β is in years, and:
//     traveler time  τ = t / γ      (properTime)
//     contracted distance L' = L / γ (lengthContraction)
// We compute γ ONCE from the exact complement ε = 1 − β (see relativity_v2's
// lorentzFactorFromBetaComplement) and divide — the same equations the
// library's properTime/lengthContraction implement, but fed the
// cancellation-free γ.

const destinationSelect = document.getElementById('destinationSelect');
const destinationMeta   = document.getElementById('destinationMeta');

const out = {
  earthDistance:    document.getElementById('out-earthDistance'),
  earthTime:        document.getElementById('out-earthTime'),
  travelerDistance: document.getElementById('out-travelerDistance'),
  travelerTime:     document.getElementById('out-travelerTime'),
  velocity:         document.getElementById('out-velocity'),
  gamma:            document.getElementById('out-gamma'),
  timeDilation:     document.getElementById('out-timeDilation'),
  lengthFactor:     document.getElementById('out-lengthFactor'),
};

/** Resolve the currently selected destination (falls back to the first). */
function currentDestination() {
  return DESTINATIONS.find((d) => d.id === destinationSelect.value) || DESTINATIONS[0];
}

/** Recompute every physics panel from the EXACT state (never the eased one). */
function updateReadouts() {
  const { beta: b, epsilon } = state;
  const dest = currentDestination();

  // γ from the exact complement: 1/√(ε(2−ε)) — no cancellation near β → 1.
  const gamma = lorentzFactorFromBetaComplement(epsilon);

  // Earth-frame travel time t = d/v (years). At v = 0 the trip never ends.
  const earthTime = b > 0 ? dest.distanceLy / b : Infinity;

  // Traveler proper time τ = t/γ and contracted distance L' = L/γ.
  const travelerTime = earthTime / gamma;
  const contractedLy = dest.distanceLy / gamma;

  destinationMeta.textContent = `${dest.blurb} · ${fmtNumber(dest.distanceLy)} ly away`;

  out.earthDistance.textContent    = fmtLy(dest.distanceLy);
  out.earthTime.textContent        = fmtDuration(earthTime);
  out.travelerDistance.textContent = fmtLy(contractedLy);
  out.travelerTime.textContent     = fmtDuration(travelerTime);

  out.velocity.textContent     = fmtVelocity(b);
  out.gamma.textContent        = fmtNumber(gamma, 4);
  out.timeDilation.textContent = `×${fmtNumber(gamma, 4)}`;      // clocks slow by γ
  out.lengthFactor.textContent = `×${fmtNumber(1 / gamma, 4)}`;  // lengths shrink to 1/γ
}


// ─────────────────────────────────────────────────────────────────────────────
// 3. FORMATTING HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Human-friendly number formatting: scientific notation for very large/small
 * magnitudes, grouped decimals otherwise. '∞' for non-finite values.
 */
function fmtNumber(value, decimals = 3) {
  if (value === null || value === undefined || !isFinite(value)) return '∞';
  const abs = Math.abs(value);
  if (abs === 0) return '0';
  if (abs >= 1e6 || abs < 1e-3) return value.toExponential(2);
  return value.toLocaleString('en-US', { maximumFractionDigits: decimals });
}

const fmtLy = (v) => `${fmtNumber(v)} ly`;

/**
 * Duration in years, stepped down to days/hours/minutes/seconds when short —
 * "7.14 days" reads far better than "0.02 yr".
 */
function fmtDuration(years) {
  if (!isFinite(years)) return '∞';
  if (years >= 0.1) return `${fmtNumber(years)} yr`;
  const days = years * 365.25; // Julian year, the same year the light-year uses
  if (days >= 1) return `${fmtNumber(days)} days`;
  const hours = days * 24;
  if (hours >= 1) return `${fmtNumber(hours)} hr`;
  const minutes = hours * 60;
  if (minutes >= 1) return `${fmtNumber(minutes)} min`;
  return `${fmtNumber(minutes * 60)} s`;
}

/**
 * Velocity for the metrics panel: β above 0.1% of c, real-world m/s below
 * (where β.toFixed(5) would render every everyday speed as "0.00000 c").
 */
function fmtVelocity(b) {
  if (b >= 0.001) return `${b.toFixed(5)} c`;
  const ms = b * C_MS;
  return `${ms.toLocaleString('en-US', { maximumFractionDigits: 1 })} m/s`;
}


// ─────────────────────────────────────────────────────────────────────────────
// 4. UI BINDINGS
// ─────────────────────────────────────────────────────────────────────────────

const speedSlider = document.getElementById('speedSlider');
const speedLabel  = document.getElementById('speedLabel');
const presetWrap  = document.getElementById('speedPresets');

const presetButtons = [];

function buildPresets() {
  for (const groupName of new Set(SPEED_PRESETS.map((p) => p.group))) {
    const groupLabel = document.createElement('div');
    groupLabel.className = 'preset-group-label';
    groupLabel.textContent = groupName;
    presetWrap.appendChild(groupLabel);

    const row = document.createElement('div');
    row.className = 'preset-row';
    presetWrap.appendChild(row);

    for (const preset of SPEED_PRESETS.filter((p) => p.group === groupName)) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'preset-btn';
      btn.textContent = preset.label;
      btn.addEventListener('click', () => setSpeedFromBeta(preset.beta));
      row.appendChild(btn);
      presetButtons.push({ btn, beta: preset.beta, sliderT: betaToSlider(preset.beta) });
    }
  }
}

/**
 * Highlight the preset the handle sits on.
 *
 * Two criteria must BOTH hold, because neither works alone on a log slider:
 *
 * 1. Slider-space distance ≤ PRESET_SNAP — the space the handle moves
 *    uniformly in, so a manual drag that lands NEAR a preset registers, and
 *    adjacent "nines" presets (0.9999c at t = 0.8 vs 0.99999c at t = 1.0)
 *    stay far apart and never bleed.
 * 2. β within RATIO_TOL of the preset's β — the log mapping compresses every
 *    sub-relativistic speed into t ≈ 0, so criterion 1 alone lit "Escape
 *    Vel." (11 km/s) while cruising at 0.05c, three orders of magnitude
 *    faster. The β ratio tells those apart; it is useless for the "nines"
 *    presets (0.9999c vs 0.99999c differ by 0.001%), which is exactly where
 *    criterion 1 takes over.
 */
const PRESET_SNAP = 0.01; // slider-space "on this preset" zone (~a few px)
const RATIO_TOL   = 1.10; // β may differ from the preset's by at most 10%

function highlightActivePreset() {
  const tNow = state.sliderT;
  const bNow = state.beta;

  let nearest = null;
  let nearestDist = Infinity;
  for (const p of presetButtons) {
    const dist = Math.abs(p.sliderT - tNow);
    if (dist < nearestDist) { nearestDist = dist; nearest = p; }
  }

  const betaAgrees =
    nearest !== null &&
    bNow > 0 &&
    Math.max(bNow, nearest.beta) / Math.min(bNow, nearest.beta) <= RATIO_TOL;

  for (const p of presetButtons) {
    p.btn.classList.toggle(
      'is-active',
      p === nearest && nearestDist <= PRESET_SNAP && betaAgrees
    );
  }
}

/**
 * Speed readout: 5 decimals to match the slider's reach to 0.99999c. Above
 * 0.1% c show the percentage of light speed; below (where that rounds to ~0)
 * show real-world m/s instead.
 */
function refreshSpeedReadout() {
  const b = state.beta;
  let aux;
  if (b >= 0.001) {
    aux = `${(b * 100).toFixed(3)}% c`;
  } else {
    const ms = b * C_MS;
    aux = `${ms.toLocaleString('en-US', { maximumFractionDigits: 1 })} m/s`;
  }
  speedLabel.innerHTML =
    `Speed: ${b.toFixed(5)}c <span class="speed-aux">(${aux})</span>`;
}

/** Paint the slider's filled-track portion (pure cosmetics, CSS var driven). */
function syncSliderFill() {
  speedSlider.style.setProperty('--fill', `${(state.sliderT * 100).toFixed(2)}%`);
}

/** Everything that must refresh whenever the speed changes, whatever the source. */
function onSpeedChanged() {
  starfield.setTargetT(state.sliderT); // engine eases the sky toward it
  syncSliderFill();
  refreshSpeedReadout();
  highlightActivePreset();
  updateReadouts();
}

/**
 * Set speed from a slider position t. ε comes straight from the slider law
 * (ε = 10^(−DECADES·t)) — exact, no subtraction. The slider's own value is
 * left alone: the browser already holds t, and writing it back mid-drag can
 * fight the pointer.
 */
function setSpeedFromSlider(t) {
  t = Math.max(0, Math.min(1, t));
  state.sliderT = t;
  state.epsilon = sliderToEpsilon(t);
  state.beta = 1 - state.epsilon; // exact whenever ε ≥ 2⁻⁵³, i.e. all slider positions
  onSpeedChanged();
}

/** Set speed from an explicit β (presets, initial value). Moves the handle. */
function setSpeedFromBeta(b) {
  if (!isFinite(b) || b <= 0) b = 0;
  if (b > BETA_MAX) b = BETA_MAX;
  state.beta = b;
  state.epsilon = b === BETA_MAX ? EPS_MIN : 1 - b;
  state.sliderT = betaToSlider(b);
  speedSlider.value = String(state.sliderT);
  onSpeedChanged();
}

speedSlider.addEventListener('input', () => {
  setSpeedFromSlider(parseFloat(speedSlider.value) || 0);
});

destinationSelect.addEventListener('change', updateReadouts);

/** Build the <option> list from the destination data (data-driven). */
function populateDestinations() {
  for (const [i, d] of DESTINATIONS.entries()) {
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = `${d.icon} ${d.name} — ${fmtNumber(d.distanceLy)} ly`;
    if (i === 0) opt.selected = true;
    destinationSelect.appendChild(opt);
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────────

// The engine starts AT the initial speed, so there is no spin-up lurch — and
// because the landing page drifts at the same β, entering the simulator
// feels like one continuous flight.
const starfield = createStarfield(document.getElementById('starfield'), {
  initialBeta: INITIAL_BETA,
});

populateDestinations();
buildPresets();
setSpeedFromBeta(INITIAL_BETA);
