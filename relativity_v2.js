/**
 * relativity_v2.js
 * ================
 * Pure special relativity math functions for the Starfield simulator.
 *
 * - SI units by default (meters, seconds, kg, Hz, J, kg·m/s).
 * - All functions are pure: no DOM, no canvas, no side effects.
 * - Custom `c` supported for natural units (pass c = 1).
 * - Strict input validation with descriptive errors.
 *
 * Changes from v1
 * ---------------
 * 1. `lorentzFactor` now computes 1 − β² as (1 − β)(1 + β). The direct form
 *    `1 - b*b` suffers catastrophic cancellation as β → 1: the leading digits
 *    of b² are all 9s, so the subtraction wipes out most of the significand.
 *    The factored form keeps the small quantity (1 − β) as its own factor and
 *    loses no precision.
 * 2. New `lorentzFactorFromBetaComplement(epsilon)`: when the CALLER knows
 *    ε = 1 − β exactly (e.g. a log-scaled speed slider where β = 1 − 10^(−kt),
 *    so ε = 10^(−kt) is exact), γ can be computed with no subtraction at all:
 *        γ = 1 / √(ε · (2 − ε))
 *    This is the exact identity 1 − β² = (1 − β)(1 + β) = ε(2 − ε).
 * 3. The self-test suite no longer runs as an import side effect (v1 executed
 *    console.assert + console.log in the browser on every page load). It is
 *    now exported as `runSelfTests()` and auto-runs only under Node:
 *        node relativity_v2.js
 *
 * @module relativity_v2
 */


// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Speed of light in a vacuum (m/s). Exact by SI definition. */
export const C = 299_792_458;


// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Throws if `v` is not strictly subluminal (|v| must be < c).
 * @param {number} v - Velocity (m/s).
 * @param {number} c - Speed of light (m/s).
 */
function assertSubluminal(v, c) {
  if (Math.abs(v) >= c) {
    throw new RangeError(
      `Velocity |v| = ${Math.abs(v)} must be strictly less than c = ${c}. ` +
      `Only massless particles travel at c.`
    );
  }
}

/**
 * Throws if `value` is negative.
 * @param {number} value - The value to check.
 * @param {string} name  - Human-readable parameter name for the error message.
 */
function assertNonNegative(value, name) {
  if (value < 0) {
    throw new RangeError(`${name} must be >= 0, got ${value}.`);
  }
}

/**
 * Throws if `value` is not a finite number.
 * @param {number} value
 * @param {string} name
 */
function assertFinite(value, name) {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number, got ${value}.`);
  }
}

/**
 * Throws if `value` is not strictly positive. Used for `c`, which must never
 * be zero or negative (v1 accepted c = 0, which produced division by zero).
 * @param {number} value
 * @param {string} name
 */
function assertPositive(value, name) {
  if (!(value > 0)) {
    throw new RangeError(`${name} must be > 0, got ${value}.`);
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// FOUNDATIONAL FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes beta (β), the velocity as a fraction of the speed of light.
 *
 * β = v / c
 *
 * @param {number} v       - Velocity (m/s).
 * @param {number} [c=C]   - Speed of light (m/s). Override for natural units.
 * @returns {number}         β ∈ (-1, 1), dimensionless.
 */
export function beta(v, c = C) {
  assertFinite(v, "v");
  assertFinite(c, "c");
  assertPositive(c, "c");
  assertSubluminal(v, c);
  return v / c;
}

/**
 * Computes the Lorentz factor (γ).
 *
 * γ = 1 / √(1 - v²/c²) = 1 / √((1 - β)(1 + β))
 *
 * γ = 1 at rest; γ → ∞ as v → c.
 *
 * The factored radicand (1 − β)(1 + β) is algebraically identical to 1 − β²
 * but numerically far better behaved near β = 1, where the direct subtraction
 * 1 − β² cancels almost every significant digit of β².
 *
 * @param {number} v       - Velocity (m/s).
 * @param {number} [c=C]   - Speed of light (m/s).
 * @returns {number}         γ ≥ 1, dimensionless.
 */
export function lorentzFactor(v, c = C) {
  assertFinite(v, "v");
  assertFinite(c, "c");
  assertPositive(c, "c");
  assertSubluminal(v, c);
  const b = v / c;
  return 1 / Math.sqrt((1 - b) * (1 + b));
}

/**
 * Computes the Lorentz factor from the COMPLEMENT of beta, ε = 1 − β.
 *
 * γ = 1 / √(ε · (2 − ε))
 *
 * Use this when ε is known exactly and β is not — e.g. a logarithmic speed
 * control defined by β = 1 − 10^(−k·t), where ε = 10^(−k·t) can be computed
 * directly with full floating-point precision while β itself rounds to 1
 * for ε < 2⁻⁵³ ≈ 1.1×10⁻¹⁶. With this function γ stays accurate up to
 * ~10⁸ and beyond, instead of overflowing to Infinity at the double-precision
 * wall.
 *
 * @param {number} epsilon - 1 − β. Must satisfy 0 < ε ≤ 1 (ε = 1 means rest).
 * @returns {number}         γ ≥ 1, dimensionless.
 */
export function lorentzFactorFromBetaComplement(epsilon) {
  assertFinite(epsilon, "epsilon");
  if (!(epsilon > 0 && epsilon <= 1)) {
    throw new RangeError(`epsilon = 1 − β must be in (0, 1], got ${epsilon}.`);
  }
  return 1 / Math.sqrt(epsilon * (2 - epsilon));
}


// ─────────────────────────────────────────────────────────────────────────────
// KINEMATICS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes the coordinate-time interval measured in the rest frame for a
 * proper-time interval elapsed on a moving clock.
 *
 * Δt = γ · Δτ
 *
 * A clock moving at v ticks slower as seen from the rest frame: Δτ seconds
 * of ship time correspond to γ·Δτ seconds of rest-frame time.
 * (v1's docstring described this backwards — "time observed in a moving
 * frame" — the formula was always correct; only the wording is fixed.)
 *
 * @param {number} deltaT  - Proper time interval on the moving clock (s). Must be >= 0.
 * @param {number} v       - Velocity of the moving clock (m/s).
 * @param {number} [c=C]   - Speed of light (m/s).
 * @returns {number}         Elapsed coordinate time in the rest frame (s).
 */
export function timeDilation(deltaT, v, c = C) {
  assertFinite(deltaT, "deltaT");
  assertNonNegative(deltaT, "deltaT");
  assertFinite(v, "v");
  assertSubluminal(v, c);
  return lorentzFactor(v, c) * deltaT;
}

/**
 * Computes the proper time (τ) experienced by a moving observer.
 *
 * τ = t / γ
 *
 * The inverse of timeDilation: proper time is always the shortest elapsed time.
 *
 * @param {number} t       - Coordinate time in the rest frame (s). Must be >= 0.
 * @param {number} v       - Velocity of the moving observer (m/s).
 * @param {number} [c=C]   - Speed of light (m/s).
 * @returns {number}         Proper time (s).
 */
export function properTime(t, v, c = C) {
  assertFinite(t, "t");
  assertNonNegative(t, "t");
  assertFinite(v, "v");
  assertSubluminal(v, c);
  return t / lorentzFactor(v, c);
}

/**
 * Computes length contraction of an object moving at velocity v.
 *
 * L' = L / γ
 *
 * A rod of rest length L appears shorter by factor γ in the rest frame.
 *
 * @param {number} length  - Rest length of the object (m). Must be >= 0.
 * @param {number} v       - Velocity of the object (m/s).
 * @param {number} [c=C]   - Speed of light (m/s).
 * @returns {number}         Contracted length (m).
 */
export function lengthContraction(length, v, c = C) {
  assertFinite(length, "length");
  assertNonNegative(length, "length");
  assertFinite(v, "v");
  assertSubluminal(v, c);
  return length / lorentzFactor(v, c);
}

/**
 * Relativistic velocity addition.
 *
 * u' = (u - v) / (1 - uv/c²)
 *
 * Combines the velocity `u` of an object (in the rest frame) with the
 * velocity `v` of a moving frame, returning the object's velocity as
 * seen from the moving frame.
 *
 * @param {number} u       - Object velocity in the rest frame (m/s). |u| < c.
 * @param {number} v       - Frame velocity relative to the rest frame (m/s). |v| < c.
 * @param {number} [c=C]   - Speed of light (m/s).
 * @returns {number}         Velocity of the object in the moving frame (m/s).
 */
export function relativisticVelocityAddition(u, v, c = C) {
  assertFinite(u, "u");
  assertFinite(v, "v");
  assertSubluminal(u, c);
  assertSubluminal(v, c);
  return (u - v) / (1 - (u * v) / (c * c));
}


// ─────────────────────────────────────────────────────────────────────────────
// ENERGY AND MOMENTUM
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes relativistic momentum.
 *
 * p = γmv
 *
 * @param {number} mass    - Rest mass (kg). Must be >= 0.
 * @param {number} v       - Velocity (m/s).
 * @param {number} [c=C]   - Speed of light (m/s).
 * @returns {number}         Momentum (kg·m/s).
 */
export function relativisticMomentum(mass, v, c = C) {
  assertFinite(mass, "mass");
  assertNonNegative(mass, "mass");
  assertFinite(v, "v");
  assertSubluminal(v, c);
  return lorentzFactor(v, c) * mass * v;
}

/**
 * Computes rest energy.
 *
 * E₀ = mc²
 *
 * @param {number} mass    - Rest mass (kg). Must be >= 0.
 * @param {number} [c=C]   - Speed of light (m/s).
 * @returns {number}         Rest energy (J).
 */
export function restEnergy(mass, c = C) {
  assertFinite(mass, "mass");
  assertNonNegative(mass, "mass");
  assertFinite(c, "c");
  assertPositive(c, "c");
  return mass * c * c;
}

/**
 * Computes total relativistic energy.
 *
 * E = γmc²
 *
 * Includes rest energy and kinetic energy.
 *
 * @param {number} mass    - Rest mass (kg). Must be >= 0.
 * @param {number} v       - Velocity (m/s).
 * @param {number} [c=C]   - Speed of light (m/s).
 * @returns {number}         Total energy (J).
 */
export function totalEnergy(mass, v, c = C) {
  assertFinite(mass, "mass");
  assertNonNegative(mass, "mass");
  assertFinite(v, "v");
  assertSubluminal(v, c);
  return lorentzFactor(v, c) * mass * c * c;
}

/**
 * Computes relativistic kinetic energy.
 *
 * K = (γ - 1)mc²
 *
 * At low speeds this approaches the classical ½mv².
 *
 * @param {number} mass    - Rest mass (kg). Must be >= 0.
 * @param {number} v       - Velocity (m/s).
 * @param {number} [c=C]   - Speed of light (m/s).
 * @returns {number}         Kinetic energy (J).
 */
export function kineticEnergy(mass, v, c = C) {
  assertFinite(mass, "mass");
  assertNonNegative(mass, "mass");
  assertFinite(v, "v");
  assertSubluminal(v, c);
  return (lorentzFactor(v, c) - 1) * mass * c * c;
}

/**
 * Computes total energy from the energy-momentum relation.
 *
 * E = √((pc)² + (mc²)²)
 *
 * Works for massless particles (m = 0, e.g. photons): E = pc.
 *
 * @param {number} momentum - Relativistic momentum p (kg·m/s). Any real value.
 * @param {number} mass     - Rest mass (kg). Must be >= 0.
 * @param {number} [c=C]    - Speed of light (m/s).
 * @returns {number}          Total energy (J).
 */
export function energyMomentumRelation(momentum, mass, c = C) {
  assertFinite(momentum, "momentum");
  assertFinite(mass, "mass");
  assertNonNegative(mass, "mass");
  assertFinite(c, "c");
  assertPositive(c, "c");
  // Math.hypot avoids overflow/underflow when pc and mc² differ wildly in
  // magnitude (the naive √(a² + b²) overflows for a ≳ 1e154).
  return Math.hypot(momentum * c, mass * c * c);
}


// ─────────────────────────────────────────────────────────────────────────────
// SPACETIME
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes the spacetime interval s².
 *
 * s² = (ct)² - x²
 *
 * s² > 0: timelike separation (causally connected events).
 * s² = 0: lightlike (null) separation (photon path).
 * s² < 0: spacelike separation (no causal connection possible).
 *
 * @param {number} t       - Time coordinate (s).
 * @param {number} x       - Space coordinate (m).
 * @param {number} [c=C]   - Speed of light (m/s).
 * @returns {number}         Spacetime interval squared (m²).
 */
export function spacetimeInterval(t, x, c = C) {
  assertFinite(t, "t");
  assertFinite(x, "x");
  assertFinite(c, "c");
  assertPositive(c, "c");
  const ct = c * t;
  return ct * ct - x * x;
}

/**
 * Lorentz transform: position.
 *
 * x' = γ(x - vt)
 *
 * Transforms the position of an event from the rest frame S
 * to a frame S' moving at velocity v.
 *
 * @param {number} x       - Position in S (m).
 * @param {number} t       - Time in S (s).
 * @param {number} v       - Velocity of S' relative to S (m/s).
 * @param {number} [c=C]   - Speed of light (m/s).
 * @returns {number}         Position in S' (m).
 */
export function lorentzTransformPosition(x, t, v, c = C) {
  assertFinite(x, "x");
  assertFinite(t, "t");
  assertFinite(v, "v");
  assertSubluminal(v, c);
  return lorentzFactor(v, c) * (x - v * t);
}

/**
 * Lorentz transform: time.
 *
 * t' = γ(t - vx/c²)
 *
 * Transforms the time coordinate of an event from frame S to frame S'.
 *
 * @param {number} x       - Position in S (m).
 * @param {number} t       - Time in S (s).
 * @param {number} v       - Velocity of S' relative to S (m/s).
 * @param {number} [c=C]   - Speed of light (m/s).
 * @returns {number}         Time in S' (s).
 */
export function lorentzTransformTime(x, t, v, c = C) {
  assertFinite(x, "x");
  assertFinite(t, "t");
  assertFinite(v, "v");
  assertSubluminal(v, c);
  return lorentzFactor(v, c) * (t - (v * x) / (c * c));
}

/**
 * Inverse Lorentz transform: position.
 *
 * x = γ(x' + vt')
 *
 * Transforms position back from the moving frame S' to the rest frame S.
 *
 * @param {number} xPrime  - Position in S' (m).
 * @param {number} tPrime  - Time in S' (s).
 * @param {number} v       - Velocity of S' relative to S (m/s).
 * @param {number} [c=C]   - Speed of light (m/s).
 * @returns {number}         Position in S (m).
 */
export function inverseLorentzTransformPosition(xPrime, tPrime, v, c = C) {
  assertFinite(xPrime, "xPrime");
  assertFinite(tPrime, "tPrime");
  assertFinite(v, "v");
  assertSubluminal(v, c);
  return lorentzFactor(v, c) * (xPrime + v * tPrime);
}

/**
 * Inverse Lorentz transform: time.
 *
 * t = γ(t' + vx'/c²)
 *
 * Transforms time back from the moving frame S' to the rest frame S.
 *
 * @param {number} xPrime  - Position in S' (m).
 * @param {number} tPrime  - Time in S' (s).
 * @param {number} v       - Velocity of S' relative to S (m/s).
 * @param {number} [c=C]   - Speed of light (m/s).
 * @returns {number}         Time in S (s).
 */
export function inverseLorentzTransformTime(xPrime, tPrime, v, c = C) {
  assertFinite(xPrime, "xPrime");
  assertFinite(tPrime, "tPrime");
  assertFinite(v, "v");
  assertSubluminal(v, c);
  return lorentzFactor(v, c) * (tPrime + (v * xPrime) / (c * c));
}


// ─────────────────────────────────────────────────────────────────────────────
// DOPPLER SHIFT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Relativistic Doppler shift for an approaching source.
 *
 * f' = f · √((1 + β) / (1 - β))
 *
 * As the source approaches, the observed frequency is blueshifted (f' > f).
 *
 * @param {number} frequency - Emitted frequency (Hz). Must be >= 0.
 * @param {number} v         - Speed of the source (m/s). Must be >= 0 (magnitude).
 * @param {number} [c=C]     - Speed of light (m/s).
 * @returns {number}           Observed frequency (Hz).
 */
export function relativisticDopplerApproaching(frequency, v, c = C) {
  assertFinite(frequency, "frequency");
  assertNonNegative(frequency, "frequency");
  assertFinite(v, "v");
  assertNonNegative(v, "v");
  assertSubluminal(v, c);
  const b = v / c;
  return frequency * Math.sqrt((1 + b) / (1 - b));
}

/**
 * Relativistic Doppler shift for a receding source.
 *
 * f' = f · √((1 - β) / (1 + β))
 *
 * As the source recedes, the observed frequency is redshifted (f' < f).
 *
 * @param {number} frequency - Emitted frequency (Hz). Must be >= 0.
 * @param {number} v         - Speed of the source (m/s). Must be >= 0 (magnitude).
 * @param {number} [c=C]     - Speed of light (m/s).
 * @returns {number}           Observed frequency (Hz).
 */
export function relativisticDopplerReceding(frequency, v, c = C) {
  assertFinite(frequency, "frequency");
  assertNonNegative(frequency, "frequency");
  assertFinite(v, "v");
  assertNonNegative(v, "v");
  assertSubluminal(v, c);
  const b = v / c;
  return frequency * Math.sqrt((1 - b) / (1 + b));
}


// ─────────────────────────────────────────────────────────────────────────────
// SELF-TESTS
// ─────────────────────────────────────────────────────────────────────────────
// v1 ran these at module scope, so every browser page load executed the whole
// suite and logged to the console. They are now wrapped in an exported
// function and auto-run only under Node:
//
//     node relativity_v2.js
//
// or from a browser console:  import('./relativity_v2.js').then(m => m.runSelfTests())

/**
 * Runs the assertion suite. Throws on the first failure; returns true if all
 * assertions pass.
 * @returns {boolean}
 */
export function runSelfTests() {
  const EPSILON = 1e-9;
  const near = (a, b) => Math.abs(a - b) < EPSILON;
  // Relative comparison for large magnitudes, where a fixed absolute
  // tolerance is meaningless (e.g. γ ≈ 7×10⁴ or energies ≈ 10¹⁹ J).
  const nearRel = (a, b, rel = 1e-12) =>
    Math.abs(a - b) <= rel * Math.max(Math.abs(a), Math.abs(b));
  const check = (cond, msg) => {
    if (!cond) throw new Error(`relativity_v2 self-test failed: ${msg}`);
  };

  // --- beta ---
  check(beta(0) === 0,                           "beta: rest should be 0");
  check(near(beta(C * 0.5), 0.5),                "beta: 0.5c should be 0.5");
  check(near(beta(C * 0.5, C), 0.5),             "beta: custom c should work");

  // --- lorentzFactor ---
  check(lorentzFactor(0) === 1,                  "γ: rest should be 1");
  check(near(lorentzFactor(C * 0.6), 1.25),      "γ: 0.6c → 1.25");

  // --- lorentzFactorFromBetaComplement ---
  check(lorentzFactorFromBetaComplement(1) === 1, "γ(ε): ε = 1 (rest) should be 1");
  // ε = 1e-5 ↔ β = 0.99999: both paths must agree
  check(
    nearRel(lorentzFactorFromBetaComplement(1e-5), lorentzFactor(0.99999, 1), 1e-9),
    "γ(ε): must match lorentzFactor at β = 0.99999"
  );
  // Deep into the regime where β itself would round to 1 (ε = 1e-20):
  // verify the defining identity γ²·ε·(2 − ε) = 1 instead of comparing paths.
  {
    const eps = 1e-20;
    const g = lorentzFactorFromBetaComplement(eps);
    check(nearRel(g * g * eps * (2 - eps), 1), "γ(ε): identity γ²ε(2−ε) = 1 at ε = 1e-20");
  }

  // --- timeDilation ---
  check(timeDilation(1, 0) === 1,                "timeDilation: no dilation at rest");
  check(timeDilation(1, C * 0.6) > 1,            "timeDilation: dilated time > proper");

  // --- properTime ---
  check(properTime(1, 0) === 1,                  "properTime: no dilation at rest");
  check(properTime(1, C * 0.6) < 1,              "properTime: proper time < coord time");

  // --- lengthContraction ---
  check(lengthContraction(100, 0) === 100,       "lengthContraction: no contraction at rest");
  check(lengthContraction(100, C * 0.6) < 100,   "lengthContraction: contracted < rest length");

  // --- relativisticVelocityAddition ---
  // Two frames each at 0.6c: classical would give 1.2c, relativistic < c
  check(
    Math.abs(relativisticVelocityAddition(0.6 * C, -0.6 * C)) < C,
    "velocityAddition: combined 0.6c + 0.6c must be < c"
  );

  // --- restEnergy ---
  check(nearRel(restEnergy(1), C * C),           "restEnergy: E = mc²");

  // --- totalEnergy vs kineticEnergy ---
  {
    const m = 1, v60 = C * 0.6;
    check(
      nearRel(totalEnergy(m, v60), restEnergy(m) + kineticEnergy(m, v60)),
      "E_total = E_rest + KE"
    );
  }

  // --- energyMomentumRelation ---
  check(
    nearRel(energyMomentumRelation(0, 1), restEnergy(1)),
    "energyMomentum: p=0 → E = mc²"
  );
  // Consistency: E from (p, m) must equal γmc² at 0.8c
  {
    const m = 1, v = 0.8 * C;
    check(
      nearRel(energyMomentumRelation(relativisticMomentum(m, v), m), totalEnergy(m, v)),
      "energyMomentum: √((pc)² + (mc²)²) = γmc²"
    );
  }

  // --- spacetimeInterval: lightlike ---
  {
    const t1 = 1, x1 = C * t1;
    check(near(spacetimeInterval(t1, x1), 0),    "spacetimeInterval: photon path is null");
  }

  // --- Lorentz round-trip ---
  {
    const [x0, t0, vf] = [1000, 1e-6, C * 0.5];
    const xP = lorentzTransformPosition(x0, t0, vf);
    const tP = lorentzTransformTime(x0, t0, vf);
    check(nearRel(inverseLorentzTransformPosition(xP, tP, vf), x0, 1e-9), "Lorentz round-trip: x");
    check(nearRel(inverseLorentzTransformTime(xP, tP, vf), t0, 1e-9),     "Lorentz round-trip: t");
  }

  // --- Doppler symmetry ---
  {
    const f0 = 500e12; // 500 THz (visible green light)
    const vDop = C * 0.3;
    const fUp   = relativisticDopplerApproaching(f0, vDop);
    const fDown = relativisticDopplerReceding(f0, vDop);
    check(nearRel(fUp * fDown, f0 * f0),         "Doppler: approaching × receding = f₀²");
  }

  // --- Validation: v >= c should throw ---
  {
    let threw = false;
    try { lorentzFactor(C); } catch { threw = true; }
    check(threw, "should throw for v = c");
  }

  // --- Validation: negative mass should throw ---
  {
    let threw = false;
    try { restEnergy(-1); } catch { threw = true; }
    check(threw, "should throw for negative mass");
  }

  // --- Validation: bad epsilon should throw ---
  {
    let threw = false;
    try { lorentzFactorFromBetaComplement(0); } catch { threw = true; }
    check(threw, "γ(ε): should throw for ε = 0 (that would be v = c)");
  }

  console.log("✓ All relativity_v2.js self-tests passed.");
  return true;
}

// Auto-run only under Node (`node relativity_v2.js`); never in the browser,
// so importing this module stays side-effect free for the web app.
if (typeof window === "undefined" && typeof process !== "undefined") {
  runSelfTests();
}
