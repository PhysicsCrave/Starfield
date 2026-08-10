/**
 * starfield-engine.js
 * ===================
 * The reusable relativistic starfield renderer.
 *
 * Extracted from starfield_v2.js so the same living sky can back both the
 * simulator (driven by the velocity slider) and the site pages (landing,
 * about, contact — fixed gentle drift, no controls). One renderer, zero
 * duplicated math.
 *
 * The engine owns everything about DRAWING the sky:
 *   - canvas sizing (devicePixelRatio-aware, resize-safe)
 *   - the star population and its rest-frame drift
 *   - relativistic aberration, Doppler color, beaming
 *   - the step cap + motion streaks that keep high-β exits visible
 *   - the animation loop with velocity easing in log (slider) space
 *
 * It owns NOTHING about UI or physics readouts — callers push a target
 * velocity in and the engine eases toward it. Physics numbers shown to the
 * user must come from the exact state the caller keeps, never from the
 * engine's eased rendering velocity.
 *
 * Also exported: the "count the nines" speed-scale math (slider position ↔ β),
 * shared by the engine's easing and the simulator's slider UI.
 */


// ─────────────────────────────────────────────────────────────────────────────
// SPEED-SCALE MATH (shared with the simulator UI)
// ─────────────────────────────────────────────────────────────────────────────
// The velocity control holds a normalized POSITION t ∈ [0, 1], mapped to β
// with a "count the nines" law:
//
//     β = 1 − 10^(−DECADES · t)        (so ε = 1 − β = 10^(−DECADES · t))
//
// Each 1/DECADES of travel adds one nine of closeness to c:
//     t = 0.2 → 0.9c,  0.4 → 0.99c,  0.6 → 0.999c,  0.8 → 0.9999c,  1 → 0.99999c
//
// This spends the control's resolution where the physics actually changes
// (β → 1) while still sweeping smoothly up from 0 on the left.

export const DECADES  = 5;
export const BETA_MAX = 1 - Math.pow(10, -DECADES); // 0.99999
export const EPS_MIN  = Math.pow(10, -DECADES);     // 1 − BETA_MAX, exact

/** Slider position t ∈ [0, 1] → β. */
export function sliderToBeta(t) {
  if (t <= 0) return 0;
  return 1 - Math.pow(10, -DECADES * t);
}

/**
 * Slider position t → ε = 1 − β, computed DIRECTLY (no subtraction from 1).
 * This is the exact complement the precision-safe γ path feeds on.
 */
export function sliderToEpsilon(t) {
  if (t <= 0) return 1;
  return Math.pow(10, -DECADES * t);
}

/** Inverse mapping: β → slider position t (for presets / initial speed). */
export function betaToSlider(b) {
  if (b <= 0) return 0;
  return Math.max(0, Math.min(1, -Math.log10(1 - b) / DECADES));
}


// ─────────────────────────────────────────────────────────────────────────────
// RENDER CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

const STARFIELD = {
  numStars: 300,

  /** Max star radius as a fraction of viewport width (v1: 0.005 · w / 2). */
  maxRadiusFrac: 0.0025,

  /** Star size multiplier at dead-center (rendering fix for crowding). */
  minCenterScale: 0.2,

  /** Drift-speed floor so respawned stars never freeze at the vanishing point. */
  minDriftFactor: 0.05,

  /**
   * Angular drift rate (rad/s at β = 1, scaled by viewportWidth/maxRadius).
   * Derivation from v1, which computed 0.25·β·(w / 0.2·maxR)·π per "second"
   * but divided elapsed ms by 3000 (a hidden ×1/3):
   *     (0.25 / 0.2) · π / 3  =  1.25π/3  ≈ 1.309 rad/s
   * Same pacing as v1, now with honest units.
   */
  baseDriftRate: (1.25 * Math.PI) / 3,

  /** Time constant (s) for easing the rendered velocity toward the target. */
  betaSmoothingTau: 0.15,

  /**
   * Largest frame step we integrate (s). Caps the jump after a background
   * tab is resumed — v1 would advance every star by the full away-time.
   */
  maxFrameDt: 0.05,

  /** Dimmest a receding star may get from beaming (keeps the sky readable). */
  minBeamAlpha: 0.45,

  /**
   * Largest apparent displacement a star may make in one frame, as a
   * fraction of the screen radius. The aberration map stretches apparent
   * angular velocity by dθ'/dθ = γ at mid-screen, so at 0.99999c (γ ≈ 224) a
   * star would hop from mid-screen past the edge between two frames —
   * "disappearing" instead of exiting. Capping the step keeps every star on
   * screen for at least 1/maxApparentStep frames, so each exit reads as a
   * continuous outward sweep (~0.2 s) rather than a one-frame flash. This
   * deliberately trades a little timing accuracy for visual flow — the
   * physics readouts never see it. At mid and low β the cap never engages.
   */
  maxApparentStep: 0.08,

  /**
   * Draw a motion streak instead of a dot once a star moves more than this
   * many dot-diameters in a single frame — the swept path is what the eye
   * should see, and it turns the fast outer stars into warp streaks instead
   * of sparsely sampled flashes.
   */
  streakThreshold: 2.5,
};


// ─────────────────────────────────────────────────────────────────────────────
// RELATIVISTIC RENDERING MATH
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Relativistic aberration: given a star's rest-frame angle from the direction
 * of travel (theta) and the ship's β, returns the angle at which the star
 * APPEARS to the moving observer:
 *
 *     cos θ' = (cos θ + β) / (1 + β cos θ)
 *
 * At β = 0, θ' = θ. As β → 1, θ' → 0 for every star except the one at exactly
 * θ = π — the whole sky funnels toward dead-ahead.
 */
function aberrate(theta, b) {
  const cosTheta = Math.cos(theta);
  let cosPrime = (cosTheta + b) / (1 + b * cosTheta);
  cosPrime = Math.max(-1, Math.min(1, cosPrime)); // guard fp drift past ±1
  return Math.acos(cosPrime);
}

/** Smoothstep easing 3t² − 2t³ for t ∈ [0, 1]. */
function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

/**
 * Star-size falloff near the center. A RENDERING fix, not physics: aberration
 * crowds stars near dead-ahead; shrinking them smoothly keeps the cluster
 * readable instead of blobbing.
 */
function sizeScaleFromAngle(apparentTheta) {
  const t = smoothstep(apparentTheta / Math.PI);
  return STARFIELD.minCenterScale + (1 - STARFIELD.minCenterScale) * t;
}

/**
 * Classical perspective drift: things dead-ahead barely move, things
 * alongside sweep past (the train-window effect). Acts only on the REST-frame
 * angle during the drift step — before aberration or Doppler read it.
 * The cubic keeps accelerating all the way to the edge (smoothstep would
 * flatten off right before a star exits, the opposite of what we want).
 */
function driftSpeedFactor(theta) {
  const t = theta / Math.PI;
  return STARFIELD.minDriftFactor + (1 - STARFIELD.minDriftFactor) * t * t * t;
}

/**
 * Relativistic Doppler factor, source-frame form:
 *
 *     D = γ (1 + β cos θ)     θ = rest-frame angle from direction of motion
 *
 * D > 1 → blueshift, D < 1 → redshift. Head-on: D = γ(1+β) → ∞ as β → 1;
 * directly behind: D = γ(1−β) → 0. Perpendicular: D = γ — the transverse
 * Doppler effect from time dilation alone.
 */
function dopplerFactor(theta, b, gamma) {
  return gamma * (1 + b * Math.cos(theta));
}

// Approximate color mapping: no real stellar spectrum, just a blend from
// white toward warm red or cool blue. We work in log(D) because the Doppler
// factor is multiplicative (2× blueshift and 2× redshift should read as
// equal-and-opposite), then squash with tanh so color saturates smoothly.
const REDSHIFT_RGB  = { r: 255, g: 70,  b: 40 };  // warm red-orange
const BLUESHIFT_RGB = { r: 140, g: 180, b: 255 }; // cool blue-white

function dopplerColor(doppler) {
  const shift = Math.tanh(Math.log(doppler)); // −1 (red) … 0 (white) … +1 (blue)
  const target = shift >= 0 ? BLUESHIFT_RGB : REDSHIFT_RGB;
  const mix = Math.abs(shift);
  const r = 255 + (target.r - 255) * mix;
  const g = 255 + (target.g - 255) * mix;
  const b = 255 + (target.b - 255) * mix;
  return `rgb(${r | 0}, ${g | 0}, ${b | 0})`;
}

/**
 * Relativistic beaming (the "headlight effect") as an opacity multiplier.
 * True bolometric intensity scales as D⁴ — far too harsh to look at (a
 * handful of forward stars would blow out and the rest would vanish), so we
 * compress hard: alpha falls linearly with D down to a floor.
 *
 * The compression is deliberately gentle because D collapses fast: a star
 * drawn at mid-screen has exactly D = 1/γ, so at 0.99c the whole outer half
 * of the sky already sits at D < 0.15. An earlier D² curve with a 0.15 floor
 * made those stars (already tinted deep red) effectively invisible — the
 * "stars vanish halfway to the edge" regression. Beaming should TINT the
 * story the Doppler color tells, never erase it.
 *
 * At rest (D = 1) every star renders at full opacity, exactly as in v1.
 */
function beamingAlpha(doppler) {
  const min = STARFIELD.minBeamAlpha;
  return min + (1 - min) * Math.min(1, doppler);
}


// ─────────────────────────────────────────────────────────────────────────────
// ENGINE FACTORY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates and starts a starfield on the given canvas.
 *
 * @param {HTMLCanvasElement} canvas - Full-viewport render target.
 * @param {object}  [options]
 * @param {number}  [options.initialBeta=0] - Starting velocity (fraction of c).
 *                  The sky begins AT this speed — no spin-up lurch.
 * @returns {{ setTargetT(t: number): void,
 *             setTargetBeta(b: number): void,
 *             destroy(): void }}
 *          setTargetT/setTargetBeta ease the RENDERED velocity toward the
 *          target; destroy() stops the loop and detaches listeners.
 */
export function createStarfield(canvas, { initialBeta = 0 } = {}) {
  const ctx = canvas.getContext('2d');

  // All geometry derives from `view`, recomputed on resize. Stars store
  // angles (theta, phi) rather than pixels, so a resize just changes the
  // projection — no star state is invalidated.
  const view = { w: 0, h: 0, cx: 0, cy: 0, maxRadius: 1 };

  function resizeCanvas() {
    // Cap DPR at 2: beyond that the extra pixels are invisible for 1–2 px
    // dots but quadruple the fill cost.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    view.w = window.innerWidth;
    view.h = window.innerHeight;
    view.cx = view.w / 2;
    view.cy = view.h / 2;
    view.maxRadius = Math.hypot(view.cx, view.cy); // center → screen corner

    // Backing store in device pixels, element in CSS pixels. BOTH must be
    // set: without an explicit CSS size, a canvas element falls back to its
    // intrinsic (attribute) size, so on a retina display it would render at
    // dpr× the viewport with only its top-left corner visible.
    canvas.width = Math.round(view.w * dpr);
    canvas.height = Math.round(view.h * dpr);
    canvas.style.width = `${view.w}px`;
    canvas.style.height = `${view.h}px`;
    // Draw in CSS-pixel coordinates; the transform maps them to device px.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Aberration needs a fixed "forward" point to bend angles around: the
  // canvas center is dead-ahead (the ship's direction of travel). Each star
  // is stored as an angle from that point (theta, its REST-frame angle) plus
  // a bearing around it (phi), instead of raw x/y.
  const stars = [];

  function initStars() {
    stars.length = 0;
    for (let i = 0; i < STARFIELD.numStars; i++) {
      // Uniform scatter across the viewport, converted to (theta, phi):
      // theta = 0 at center (forward), theta = π at the far corners.
      const dx = Math.random() * view.w - view.cx;
      const dy = Math.random() * view.h - view.cy;
      stars.push({
        radiusFrac: Math.random() * STARFIELD.maxRadiusFrac,
        theta: (Math.hypot(dx, dy) / view.maxRadius) * Math.PI,
        phi: Math.atan2(dy, dx),
        // Per-star drift-rate multiplier (0.5–1) for visual depth; the
        // aberration/Doppler physics reads theta, never this.
        speedMultiplier: Math.random() * 0.5 + 0.5,
        // Last frame's apparent position (as a fraction of screen radius),
        // for motion streaks and the per-frame step cap. null = "just
        // (re)spawned, draw a dot" — never streak across the screen from a
        // star's previous life.
        prevFrac: null,
      });
    }
  }

  /** Advance and draw every star. `b` is the (smoothed) rendering β. */
  function drawFrame(dt, b) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, view.w, view.h);

    // γ for the Doppler factor — same for every star (they share the ship's
    // speed). The rendered β caps at BETA_MAX, so the factored form is plenty.
    const gamma = 1 / Math.sqrt((1 - b) * (1 + b));

    // Outward drift rate (rad/s) at the current speed. Zero speed = zero drift.
    const angularSpeed = STARFIELD.baseDriftRate * b * (view.w / view.maxRadius);

    for (const star of stars) {
      // 0) Recycle only once the star has VISIBLY exited — its drawn
      // position reached the corner ring (frac ≥ 1) on a previous frame.
      // Respawning off the rest angle instead (v1's `theta > π`) breaks
      // under the step cap: the cap rewinds theta to just below π, the next
      // drift step pushes it past π, and the star would vanish mid-flight
      // from wherever the cap first engaged.
      if (star.prevFrac !== null && star.prevFrac >= 1) {
        star.theta = 0;
        star.phi = Math.random() * 2 * Math.PI;
        star.speedMultiplier = Math.random() * 0.5 + 0.5;
        star.prevFrac = null;
      }

      // 1) Rest-frame drift, slowed near center, accelerating toward the
      // edge. Clamped at π ("directly behind"), which aberration maps to
      // exactly frac = 1 — the exit ring that triggers recycling above.
      star.theta = Math.min(
        star.theta + angularSpeed * star.speedMultiplier * driftSpeedFactor(star.theta) * dt,
        Math.PI
      );

      // 2) Aberration bends the rest angle into the apparent position.
      let apparentTheta = aberrate(star.theta, b);
      let frac = apparentTheta / Math.PI; // 0 = center, 1 = screen corner

      // 2b) Step cap: if this frame's OUTWARD apparent step exceeds the cap,
      // clamp the apparent position and pull the rest angle back through the
      // exact inverse aberration, cos θ = (cos θ' − β)/(1 − β cos θ'), so
      // Doppler color and beaming stay consistent with where the star is
      // actually drawn. (Inward steps — decelerating — stay uncapped:
      // they're bounded anyway.)
      if (star.prevFrac !== null && frac - star.prevFrac > STARFIELD.maxApparentStep) {
        frac = star.prevFrac + STARFIELD.maxApparentStep;
        apparentTheta = frac * Math.PI;
        const cosApparent = Math.cos(apparentTheta);
        const cosRest = (cosApparent - b) / (1 - b * cosApparent);
        star.theta = Math.acos(Math.max(-1, Math.min(1, cosRest)));
      }

      const apparentRadius = frac * view.maxRadius;
      const cosPhi = Math.cos(star.phi);
      const sinPhi = Math.sin(star.phi);
      const px = view.cx + apparentRadius * cosPhi;
      const py = view.cy + apparentRadius * sinPhi;

      // 3) Doppler factor from the REST-frame angle: colors + beams the star.
      const doppler = dopplerFactor(star.theta, b, gamma);
      const color = dopplerColor(doppler);

      // 4) Size falloff so the aberrated cluster at center stays readable.
      const radius = star.radiusFrac * view.w * sizeScaleFromAngle(apparentTheta);

      const prevFrac = star.prevFrac;
      star.prevFrac = frac;

      ctx.globalAlpha = beamingAlpha(doppler);

      // 5) Fast movers render as motion streaks — the path actually swept
      // during this frame — so high-β outer stars read as continuous warp
      // lines instead of sparsely sampled dots. Slow stars (everything near
      // the center, and the whole sky at low β) still render as dots.
      const prevRadius = prevFrac === null ? apparentRadius : prevFrac * view.maxRadius;
      const moved = Math.abs(apparentRadius - prevRadius);
      if (moved > radius * STARFIELD.streakThreshold) {
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(radius * 2, 0.6);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(view.cx + prevRadius * cosPhi, view.cy + prevRadius * sinPhi);
        ctx.lineTo(px, py);
        ctx.stroke();
      } else {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // ── Animation loop ─────────────────────────────────────────────────────
  // The rendered velocity eases toward the target in log (slider) space —
  // easing β linearly would spend nearly the whole transition inside the
  // last "nine". Exponential smoothing with a fixed time constant is
  // frame-rate independent: the same real-time response at 30, 60, or 144 Hz.

  let targetT = betaToSlider(Math.max(0, Math.min(BETA_MAX, initialBeta)));
  let visualT = targetT; // start AT the initial speed — no lurch
  let lastTime = null;
  let rafId = 0;

  function animate(now) {
    // First frame: no previous timestamp, so integrate nothing.
    if (lastTime === null) lastTime = now;
    const dt = Math.min((now - lastTime) / 1000, STARFIELD.maxFrameDt);
    lastTime = now;

    const gap = targetT - visualT;
    if (Math.abs(gap) < 1e-6) {
      visualT = targetT;
    } else {
      visualT += gap * (1 - Math.exp(-dt / STARFIELD.betaSmoothingTau));
    }

    drawFrame(dt, sliderToBeta(visualT));
    rafId = requestAnimationFrame(animate);
  }

  // ── Boot ───────────────────────────────────────────────────────────────
  resizeCanvas();
  initStars();
  window.addEventListener('resize', resizeCanvas);
  rafId = requestAnimationFrame(animate);

  return {
    /** Ease the rendered velocity toward slider position t ∈ [0, 1]. */
    setTargetT(t) {
      targetT = Math.max(0, Math.min(1, t));
    },
    /** Ease the rendered velocity toward β (fraction of c). */
    setTargetBeta(b) {
      targetT = betaToSlider(Math.max(0, Math.min(BETA_MAX, b)));
    },
    /** Stop the loop and detach listeners. */
    destroy() {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resizeCanvas);
    },
  };
}
