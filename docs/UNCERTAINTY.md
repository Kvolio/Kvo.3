# Uncertainty Register

Open questions where the evidence is incomplete or sources disagree. The rule for this project is
that uncertainty is **documented, never invented**: where a dimension is reconstructed rather than
sourced it is carried at `confidence: 'estimated'` in `src/spec/meta.ts`, and every Gauntlet report
must list the estimated values its subsystem depends on.

**An entry blocks its subsystem's Gauntlet from passing until it is either researched to a
conclusion or explicitly accepted as reconstructed, with that acceptance recorded here.**

| Status | Meaning |
|---|---|
| `OPEN` | Unresolved. Blocks the listed subsystem. |
| `ADOPTED` | Sources disagree; one reading adopted with stated reasoning. Not silently resolved. |
| `RESOLVED` | Settled by evidence. |
| `RECONSTRUCTED` | Not documented anywhere available. Modelled from engineering reasoning and declared as such. |

---

## #1 — Road wheel count per side · `ADOPTED` · Suspension

**Conflict.** The Tiger I Information Center *technical specifications* page states "4 double and
4 triple" road wheels per side, which totals 20. Its own *suspension* page states 3 wheels per axle
across 8 axles, and The Tank Museum independently states "3 wheels per axle for a total of 24 per
side", adding that the January/February 1944 steel wheels dropped the outer row to give 2 per axle
and 16 per side.

**Adopted: 24 per side, 3 per axle.** Two independent sources agree on it, including the more
detailed of the two TIC pages, and the 24 → 16 transition is coherently explained by removing one
row. The TIC technical page is treated as an error.

**Consequence if wrong:** the outer wheel row would not exist, changing the vehicle's visible width
at the running gear and the track's wheel-contact envelope. High visual impact — worth a primary
source before Gauntlet B closes.

## #2 — Turret ring clear opening diameter · `OPEN` · Turret, Interior

`tiger1.info` gives the bearing outer diameter as 2,100 mm and the ball circle as 1,990 mm (1,995 mm
mid/late), but does not give the clear opening cut in the hull roof. The figure 1,830 mm is widely
repeated in secondary literature without attribution.

**Why it matters:** the clear opening sets the turret basket diameter, which sets the crew station
spacing, which sets essentially the whole fighting-compartment layout. Building the interior on an
unverified number risks a cascade.

**Blocks:** Stage 2 (Turret) and Stage 6 (Interior) Gauntlets.

## #3 — Gun elevation and depression limits · `OPEN` · Gun

The Tiger I Information Center gives **−6.5° to +17°**. Wikipedia and several other secondary
sources give **−8° to +15°** (or −8°/+16°). Both are in wide circulation.

Also to establish: whether depression was restricted over the engine deck arc, as it is on several
contemporaries. If so the limit is a function of turret azimuth, not a constant, and
`GunMount` must take the traverse angle as an input.

**Blocks:** Stage 3 (Gun) Gauntlet.

## #4 — Gun mantlet thickness · `OPEN` · Turret, Gun

The Tiger I Information Center gives 120 mm at 0°. Other secondary sources quote a 100–200 mm range,
which is plausible if they are describing the varying section of a curved cast mantlet rather than a
single figure. Needs a source that states *where* it is measured.

## #5 — Width over combat tracks · `OPEN` · Hull, Running gear

Three figures in circulation: **3,720 mm** (TIC), **3,705 mm**, and **3,547 mm**. Currently carrying
3,720 mm. The spread is 173 mm, which is well outside any sensible tolerance and is visible in the
frontal silhouette.

`REF-photo-2` (frontal) is the best available cross-check: the track-to-hull width ratio can be
measured off it once the hull width is fixed independently.

**Blocks:** Stage 1 (Hull) Gauntlet.

## #6 — Track width · `RESOLVED`

720 mm vs 725 mm appears across sources. Resolved by the track designation itself:
**`Kgs 63/725/130`** encodes 725 mm width and 130 mm pitch. The 720 mm figure is a rounding.

## #7 — Steering unit designation · `OPEN` · Interior, Powertrain

The Tiger I Information Center calls it the "Argus Lenkapparat L, ST, 0, 2, designed by Henschel
based on the British Merritt-Brown type". Other sources call it the Henschel L 801, which is also
widely cited for the Tiger II. The *mechanism* is agreed (regenerative, dual-radius, transverse in
the bow, steering wheel with hydraulic assist); only the name is in doubt.

Low geometric risk, but it must not be labelled wrongly in the interior annotations.

## #8 — Auxiliary hand-traverse wheel station · `OPEN` · Turret, Interior

On loss of hydraulic power the Tiger's turret is traversed by hand, "assisted by the loader who had
an additional wheel" per one source. Other accounts place a secondary traverse control at the
commander's station. These are different pieces of geometry in different places.

**Blocks:** Stage 6 (Interior) Gauntlet.

## #9 — Per-station lateral wheel row assignment · `OPEN` · Suspension

24 wheels per side across 8 axles at 3 wheels per axle is settled (#1), but *which* of the three
interleave rows each station's wheels occupy — and therefore the exact overlap pattern — is not yet
sourced from a drawing.

Held as **data** in `SPEC.runningGear.stations[i].wheelLateralOffsets`, so a correction is a spec
edit rather than a code change. Carried at `confidence: 'estimated'` until a drawing confirms it.

## #10 — Hull/turret serial correlation for Feb 1943 · `OPEN` · Documentation only

Hull and turret numbers ran in separate sequences, so "Fgst. 250050–250100" does not by itself fix
which turret number the vehicle carries. Affects only the descriptive text and any data-plate decal,
not geometry.

## #11 — Interior paint demarcation · `OPEN` · Interior, Materials

German practice was ivory (`Elfenbein`) on interior surfaces above a line, over red-brown primer
below. The exact demarcation height for February 1943 Henschel Tiger production — and whether the
turret and hull were treated identically — is not established.

**Blocks:** Stage 6 (Interior) and Gauntlet E (Materials).

## #12 — Interior wiring, conduit and pipe routing · `RECONSTRUCTED` · Interior

Photographic documentation of Tiger I interior electrical looms and hydraulic/fuel line routing is
poor, and surviving vehicles have been rewired during restoration. Runs will be reconstructed from
component positions and plausible engineering practice.

**Explicitly declared as reconstruction, not documentation.** Every such part carries
`confidence: 'estimated'`, is tagged `reconstructed: true` in its part metadata, and the Stage 6
Gauntlet report must list them. They are not to be presented as historically attested.

---

## Resolution log

| Date | Entry | Action |
|---|---|---|
| Stage 0 | #6 | Resolved from the `Kgs 63/725/130` designation |
| Stage 0 | #1 | Adopted 24/side on two concurring sources; TIC technical page treated as erroneous |
| Stage 0 | #12 | Accepted as reconstruction; flagging mechanism defined |
