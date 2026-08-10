# Starfield

**Relativistic Visualizer and Simulator**

Starfield is for anyone who has heard that time slows down near the speed of light and wished they could watch it happen. It turns the equations of special relativity into the view from the window of a starship — one you steer yourself.

Accelerate from everyday speeds to 0.99999c and observe the consequences: starlight aberrates forward, colors Doppler-shift, and clocks and rulers diverge.

> Built from scratch in vanilla JavaScript — no frameworks, no libraries, no build step.

---

## Table of Contents

- [What You Will See](#what-you-will-see)
- [How to Use It](#how-to-use-it)
- [The Physics](#the-physics)
- [Running It Locally](#running-it-locally)
- [Project Structure](#project-structure)
- [Scope and Honesty](#scope-and-honesty)
- [Roadmap](#roadmap)
- [About the Author](#about-the-author)
- [Acknowledgments](#acknowledgments)
- [License](#license)

---

## What You Will See

**Aberration.** Starlight crowds into the direction of travel. The sky ahead tightens into a dense knot while the space behind you empties out.

**Doppler Shift.** Stars you are racing toward shift blue. The ones falling behind shift red.

**Clocks and Rulers.** Compare Earth's clock against your own, and Earth's measured distance against the length-contracted one rushing past your window.

---

## How to Use It

1. **Pick a cruising speed.** A logarithmic velocity slider and preset buttons let you travel from a leisurely 0.1c to an extreme 0.99999c, where the strangest effects live. The scale is logarithmic because everything interesting happens in the last fraction of a percent before *c*.

2. **Choose where you are headed.** Nine real destinations, from Proxima Centauri at 4.2 light-years to Sagittarius A* at the galactic center and the Andromeda Galaxy 2.5 million light-years out.

3. **Read the two journeys.** Live readouts compare the trip both ways — the time it takes on an Earth clock against the far shorter time you experience aboard the ship, and Earth's measured distance against the contracted one. The Lorentz factor γ ties them together: at high speeds, a voyage that takes centuries from Earth passes in a handful of years for the traveler.

---

## The Physics

Every number in the HUD comes from the standard equations of special relativity, computed in SI units.

**Lorentz factor** — the quantity that governs everything else, where β = v/c:

```
γ = 1 / √(1 − β²)
```

**Time dilation** — a journey taking `t` on Earth's clock is experienced as proper time `τ` aboard the ship:

```
τ = t / γ
```

**Length contraction** — a distance `L₀` measured from Earth contracts to `L` in the traveler's frame:

```
L = L₀ / γ
```

**Relativistic aberration** — a star at rest-frame angle θ from the direction of travel appears at θ′:

```
cos θ′ = (cos θ + β) / (1 + β cos θ)
```

**Relativistic Doppler factor** — sets each star's color shift and apparent brightness:

```
D = 1 / (γ (1 − β cos θ))
```

Note that at θ = 90°, where there is no classical Doppler effect at all, D still differs from 1. That residual is *transverse Doppler shift*, and it comes from time dilation alone — one of the cleanest fingerprints of relativity in the whole simulation.

---

## Running It Locally

The project is plain HTML, CSS, and JavaScript. There is nothing to install and nothing to build — but it **must be served over HTTP**, not opened as a `file://` path, because the code uses native ES modules and browsers block module imports from the filesystem.

```bash
# from the repository root
cd starfield2
python3 -m http.server 8000
```

Then open **http://localhost:8000/index.html**.

Any static server works equally well (`npx serve`, VS Code's Live Server, etc.).

The physics module is also runnable on its own, which executes its built-in test suite:

```bash
node starfield2/relativity_v2.js
```

---

## Project Structure

| File | Role |
| --- | --- |
| `index.html` | Landing page |
| `starfield_v2.html` | The simulator itself |
| `about.html`, `contact.html` | Supporting site pages |
| `relativity_v2.js` | Pure special-relativity math. No DOM, no canvas, no side effects. |
| `starfield-engine.js` | The reusable renderer: star population, aberration, Doppler color, beaming, animation loop |
| `starfield_v2.js` | Simulator UI — wires the slider, destinations, and HUD to the engine |
| `destination_v2.js` | The destination catalog and its distance data |
| `site.css`, `starfield_v2.css` | Styling |

---

## Scope and Honesty

The aberration and Doppler effects are **stylized for educational clarity** — an illustration of the physics, not an exact photometric rendering. Real relativistic starlight would shift most of its energy out of the visible band entirely, which is scientifically correct and visually useless. The geometry and the numeric readouts follow the real equations; the color mapping is tuned so you can see what those equations are doing.

Starfield models constant-velocity cruise. It does not simulate acceleration phases, and it does not attempt general relativity.

---

## Roadmap

- [x] **Milestone 01** — First prototype of the special relativity simulator engine
- [x] **Milestone 02** — First prototype of the starfield, relativistic aberration, and Doppler shifting visualizer
- [x] **Milestone 03** — Public launch as an educational site
- [ ] **Next** — Smoother visual effects, improved user interface, and a physics background page

---

## About the Author

Starfield was designed and built by **Quang Anh Nguyen**, a high school student based in Southern California.

I have been a physics enthusiast since a young age, and my passion for understanding the universe — along with a desire to share that knowledge with others — led me to create Starfield. Everybody has heard of Albert Einstein and special relativity, but few people get to see what its predictions actually look like. My goal is to make them tangible and accessible to anyone, regardless of their background in physics.

I hope Starfield inspires others to explore the wonders of physics and appreciate the beauty of our universe.

---

## Acknowledgments

Starfield was built with AI assistance (Claude), used as a coding collaborator.

The direction of the project is my own: I chose the architecture, selected the destinations, decided that the Doppler mapping should favor legibility over photometric accuracy, and debugged what came back.

---

## License

Released under the [MIT License](LICENSE) — free to use, copy, modify, and distribute, provided the copyright notice travels with it.

Copyright © 2026 Quang Anh Nguyen

See [NOTICE.md](NOTICE.md) for authorship and attribution details.
