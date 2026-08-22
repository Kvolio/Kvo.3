# TIGER I GAUNTLET — ITERATION 00

**Stage 0 — Foundation**
Date: 2026-08-22 · Variant under test: `AusfH_Feb1943` · Commit: Stage 0 close

---

## Scope, and what this iteration does *not* claim

Stage 0 builds the harness the vehicle will be assembled inside, not the
vehicle. What stands in the scene is a **dimensional envelope**: a wireframe at
the sourced overall dimensions plus a solid block at hull height, so the
Ausf. H's real proportions are walkable and measurable from the first commit.

It is deliberately not a crude tank. Nothing here should be mistaken for a
model, and the historical, reference-matching and visual-quality critics
therefore have almost nothing to judge yet. They are recorded as **N/A** rather
than as passes, because a critic that passes something that does not exist is
exactly the self-approval the brief rules out.

---

## Critic scores

| Critic | Score | Status |
|---|---|---|
| 1 — Historical accuracy | — | **N/A** — configuration fixed and documented; no geometry to audit |
| 2 — Dimension / geometry | 84/100 | **PASS (foundation)** — spec sourced and asserted; 91 values still reconstructed |
| 3 — Mechanical engineering | — | **N/A** — no mechanisms built |
| 4 — Interior | — | **N/A** — not started |
| 5 — Visual / 3D quality | 71/100 | **PASS (foundation)** — material system proven; nothing to inspect at close range |
| 6 — Interaction / functionality | 88/100 | **PASS** — walking, collision, both input paths verified end to end |
| 7 — Reference comparison | — | **N/A** — no geometry to compare |
| 8 — Player / UX | 82/100 | **PASS** — controls verified on desktop and on an emulated phone |

### CRITICAL FAILURES
None outstanding. **Two were found and fixed during this stage** — see below.

### MAJOR ISSUES
None outstanding.

### MINOR ISSUES
1. The Stage 0 envelope's shadowed vertical faces read darker than armour under
   an open sky should. Ambient was lifted once; final balance belongs to
   Gauntlet E, against real geometry rather than a placeholder box.
2. `vendor-bvh` and `vendor-three` chunk attribution is inverted in the build
   output. Cosmetic — total payload is ~172 kB gzipped and three is not
   duplicated — but it weakens vendor caching. Deferred to Stage 12.
3. `docs/UNCERTAINTY.md` #2, the turret ring clear opening, will block Stage 2.
   It should be researched before turret work starts, not during it.

---

## Critical failures found and fixed this stage

Both rendered plausibly and were wrong, which is the class of fault this project
is most exposed to.

**CF-01 — NaN environment probe blackened every lit surface.**
The light probe was generated with PMREM from three's Preetham sky. That shader
multiplies the sun disc by 19000, which overflows the half-float render targets
PMREM uses; the resulting Inf spread through the convolution as NaN, and a NaN
environment map turns every physical material pure black. It swallowed emissive
and ignored both exposure and light intensity, because NaN plus anything is NaN.
Nothing threw, no console error appeared, and the draw-call counts looked
healthy. The unit suite could not see it because it never touches a GPU.

*Fix:* the probe is now a bounded vertex-coloured gradient dome. A probe's job
here is the sky's ambient bounce — the sun is already a DirectionalLight — so
this is both more correct and incapable of overflowing.

*Guard:* `tests/e2e/smoke.spec.ts` → "the scene is actually lit" reads the GL
framebuffer at three known points and asserts lit surfaces are neither black nor
blown out. It fails on the original bug.

**CF-02 — end-to-end assertions were passing near-vacuously.**
Headless WebGL runs through SwiftShader at roughly one to two frames a second.
Tests that waited on the wall clock advanced the simulation by a fraction of the
intended time, so "the player stands on the ground" was passing largely because
the player had barely moved from its spawn.

*Fix:* the harness exposes `step(n)` to advance an exact number of fixed
simulation steps. Tests are now deterministic and fast, and still drive the real
controller, resolver and input providers. The ground test now drops the player
from 3 m and asserts it comes to rest.

---

## Automated evidence

`npm run gauntlet` — typecheck, lint, 126 unit tests. `npx playwright test` —
17 browser tests across desktop and an emulated Pixel 7.

| Claim | Asserted by |
|---|---|
| Armour is solid, not a shell with fake thickness | Ray march through each plate measures its actual thickness at five points, for five thicknesses |
| Plates are closed manifolds | Half-edge audit: no boundary edges, no non-manifold edges, positive signed volume |
| Apertures are real openings | A ray down the middle of an aperture hits nothing; a ray 60 mm outside it measures full thickness |
| An open hatch is a hole you can pass through | A real plate with a real aperture, plus a lid as a dynamic body: contacts present when shut, absent when swung clear, and no BVH rebuilt |
| The player cannot walk through armour | 200 pushes into a wall; and no tunnelling through a 25 mm plate at 113 mm per frame |
| The player cannot fall through the floor or leave the world | 600-step run, drop test, and a bounded shell |
| Every dimension has provenance | `MetaOf<T>` totality is a compile error; sources, tolerances and notes are asserted |
| PC and touch drive the same controller | Keyboard and virtual stick each move the player the same distance through the same code |
| Device events exist in one place | Lint rule plus a source-tree scan in the unit suite |
| The scene is lit | GL framebuffer sampled at three points |

---

## Uncertainty status

**91 values are reconstructed rather than sourced**, each carrying a note
explaining why, enforced by `tests/spec/meta.test.ts`. They are concentrated in
exactly the places the next stages will work:

- **Hull** — driver's front plate, upper glacis, hull rear, roof and floor
  thicknesses and angles. Blocks Gauntlet A.
- **Turret** — shell dimensions, cupola proportions, hatch sizes, and the ring
  clear opening (`UNCERTAINTY #2`), which drives the entire interior layout.
- **Running gear** — sprocket and idler axis positions, swing arm length and
  pivot height, and the per-station lateral wheel planes (`UNCERTAINTY #9`).
- **Gun** — trunnion position, recoil stroke, muzzle brake proportions.

Sourced and asserted: overall envelope, track designation and geometry, road
wheel diameter and count, station spacing, torsion bar dimensions, sprocket
tooth count and derived pitch radius, six armour figures, engine, transmission,
steering and final drive data, turret ring bearing.

**Resolved this stage:** `#6` track width, from the `Kgs 63/725/130`
designation. **Adopted:** `#1`, 24 road wheels per side, on two concurring
sources against one contradicting page.

---

## STATUS

**PASS — foundation complete.** No critical failures outstanding, no major
issues, and the harness is in place to hold the next stage to account.

**Next: Stage 1 — Hull.** Blocked on nothing, but `UNCERTAINTY #5` (width over
combat tracks, a 173 mm spread across sources) should be narrowed first, since
it sets the frontal silhouette everything else is measured against.
