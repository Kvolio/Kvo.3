# Acceptance criteria stated by the project owner

Requirements given directly, over and above the original brief. Each one is
tracked here so it cannot be lost between stages, and each has a mechanical test
named against it once the relevant subsystem exists.

---

## R1 — Vision devices must be to scale and must actually work from inside

> "Make sure that vision slits and viewholes actually are to scale and work
> inside the tank."

This is the strongest form of the requirement and is treated as such: a vision
port is not a texture, not a recess, and not a hole that stops at the outer
face. It is a real aperture cut clean through the armour, at its historical
dimensions, positioned so that a crewman seated at his station can put his eye
to it and see out.

**How it is enforced.** Apertures are hole polygons in the plate outline, so
they pass through the full plate thickness by construction — the same mechanism
that makes an open hatch a hole you can climb through. On top of that,
`tests/parts/vision.test.ts` does the part prose cannot:

1. Places an eye point at each crew station, at the seated head position.
2. Fires a fan of rays from that eye through the aperture and out.
3. Asserts that rays through the opening **escape the hull**, and that rays
   just outside it are **stopped by armour**.
4. Measures the resulting field of view and checks it against the angle the
   aperture geometry implies — so a slit that is the right size but in the
   wrong place, or at the wrong distance from the eye, fails.
5. Asserts the aperture's clear dimensions against `src/spec/vision.ts`, which
   carries provenance like every other measurement.

A vision port that renders correctly but that you cannot see through is a
failure, and the test says so.

**Status:** infrastructure in place from Stage 1. Devices are added as their
host plates are built — driver's visor and hull MG aperture with the hull;
cupola slits, turret vision ports and the gunner's sight apertures with the
turret.

---

## R2 — A full detail pass at the end

> "Try your best to detail the tank, AFTER you've finished everything."

Detailing is a dedicated pass over the finished vehicle, not something spread
thinly as each subsystem is built. That ordering is deliberate on both sides:
detail applied to geometry that later moves has to be redone, and a detail pass
over a complete vehicle can be consistent across it in a way that per-subsystem
detailing never is.

Scope when it runs: fasteners and their patterns, weld beads on every joint,
tool stowage and its brackets, tow cables and clamps, grab handles, hinges and
latches, lifting eyes, data plates, conduit and pipe runs, casting texture,
and the wear profile as a whole.

**Status:** scheduled as Stage 9, after every subsystem is complete.

---

## R3 — Polish the hull edges once the structure is done

> "The hull looks good, just polish up the edges once ur done."

Specifically the plate edges: chamfer sizes that read correctly at close range,
interlocked joints where the Tiger had them, weld beads sized to the joint
rather than uniform, and the arris treatment where plates meet at a corner.

Interlocking is the substantial part. `interlockEdge` exists and is tested, but
applying it needs both mating plates authored against a shared joint line so the
teeth of one fill notches in the other — cutting teeth into one side alone put
50 mm of steel below the belly on the first attempt.

**Status:** folded into Stage 9, together with R2.
