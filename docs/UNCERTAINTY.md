# Uncertainty Register

Open questions where the evidence is incomplete or sources disagree. The rule for this project is
that uncertainty is **documented, never invented**: where a dimension is reconstructed rather than
sourced it is carried at `confidence: 'estimated'` in `src/spec/meta.ts`, and every Gauntlet report
must list the estimated values its subsystem depends on.

**An entry blocks its subsystem's Gauntlet from passing until it is either researched to a
conclusion or explicitly accepted as reconstructed, with that acceptance recorded here.**

`tests/spec/meta.test.ts` prints the current count of reconstructed values on every run.
It stood at 91 when Stage 0 closed and at **82** after the Stage 1 research pass.

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

## #2 — Turret ring clear opening diameter · `ADOPTED` · Turret, Interior

`tiger1.info` gives the bearing outer diameter as 2,100 mm and the ball circle as 1,990 mm (1,995 mm
mid/late), but does not give the clear opening cut in the hull roof. The figure 1,830 mm is widely
repeated in secondary literature without attribution.

**Adopted: 1,830 mm, as a reconstruction, with the reasoning stated.** It is not sourced and is not
presented as sourced. What can be said for it is that it sits coherently between the two figures
that *are* sourced: the clear opening must be cut inside the race, so it is necessarily smaller than
the 1,990 mm ball circle, and 1,830 mm leaves 80 mm of race radially inboard of the balls — a
sensible section for a bearing carrying eleven tonnes of turret. A figure much larger would leave no
race; one much smaller would not pass a crewman.

`tests/spec/turretFit.test.ts` asserts the ordering — clear opening < ball circle < bearing outer
diameter — so the three cannot drift into an impossible arrangement.

**Why it matters:** the clear opening sets the turret basket diameter, which sets the crew station
spacing, which sets essentially the whole fighting-compartment layout. Building the interior on an
unverified number risks a cascade, so this entry stays open in spirit: **if a drawing turns up, the
interior is rebuilt, not patched.**

**No longer blocks** Stage 2 (Turret). Still flagged for Stage 6 (Interior).

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

## #5 — Width over combat tracks · `ADOPTED` · Hull, Running gear

Four figures in circulation: **3,720 mm** (TIC), **3,705 mm** (Jentz-derived summaries),
**3,560 mm** (Wikipedia), **3,547 mm**.

**Partly resolved.** The two clusters measure different things. 3,705/3,720 mm is the width over the
725 mm combat tracks *including* the outer track guards; 3,547/3,560 mm is almost certainly the
width without them. The transport figure supports this: swapping 725 mm tracks for 520 mm ones
should narrow the vehicle by 2 x 205 = 410 mm, but the quoted transport width is 563 mm narrower —
because rail loading also removed the outer road wheel of every axle and the outer track guards.

**Adopted: 3,720 mm over combat tracks**, tolerance 15 mm, which spans the 3,705 figure. The
remaining question is only which of the two nearly-identical figures is the drawing value; it does
not affect the model at this tolerance.

`REF-photo-2` (frontal) remains the cross-check once the hull is built: the track-to-hull width
ratio can be measured off it directly.

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

## #13 — S-mine discharger stations · `OPEN` · Hull fittings

Five `Minenabwurfvorrichtung "S"` per vehicle is well attested for this period, and the device
itself is documented — a short mortar on the superstructure roof firing a bounding anti-personnel
charge. **Where the five sat is not.** Published arrangements differ, and surviving vehicles have
had them removed and their mounting pads plated over.

Modelled as two per side plus one at the tail. Carried at `confidence: 'estimated'` with a 250 mm
tolerance on the longitudinal stations, which is wide enough to say plainly that the positions are
reconstructed rather than known.

**Blocks:** nothing structurally. Listed so the arrangement is never presented as documented.

## #14 — Turret shell external dimensions · `ADOPTED` · Turret

The shell was carried at 2,680 mm long and **1,860 mm wide**. The width is impossible: it is
narrower than the 2,100 mm ring bearing the turret sits on, and a turret cannot be narrower than its
own race. Nothing caught it because both numbers were individually plausible and nothing compared
them.

Measured off the 1:50 plan view by scanning the turret outline column by column and scaling on the
superstructure width: **about 2,170 mm wide and 2,290 mm long**, good to roughly 150 mm at that
resolution. Both adopted at that figure with 150 mm tolerances.

The measurement puts the side walls only about 35 mm outboard of the bearing's outer edge, which is
tight. Either the walls really are nearly flush with the race, or the true width is a little greater
than measured. The tolerance spans both readings.

---

## Resolution log

| Date | Entry | Action |
|---|---|---|
| Stage 0 | #6 | Resolved from the `Kgs 63/725/130` designation |
| Stage 0 | #1 | Adopted 24/side on two concurring sources; TIC technical page treated as erroneous |
| Stage 0 | #12 | Accepted as reconstruction; flagging mechanism defined |
| Stage 1 | #5 | Adopted 3,720 mm; the 3,547/3,560 cluster identified as excluding the outer track guards |
| Stage 1 | — | Hull armour promoted from reconstructed to sourced against Jentz & Doyle: nose 100 mm @ 25 deg, driver plate 100 mm, upper glacis 60 mm @ 80 deg, superstructure side 80 mm, lower side 60 mm, rear 80 mm @ 9 deg, roof and floor 25 mm. Corroborated by the SHAEF armour-arrangement diagram of October 1944 |
| Stage 1 | — | Turret side and rear promoted to sourced at 80 mm on two concurring sources |
| Stage 1 | — | Lower side walls established as standing 5 mm proud of the belly plate |
| Stage 1 | #13 | Registered: S-mine discharger count attested at five, stations not |
| Stage 2 | #2 | Adopted 1,830 mm as declared reconstruction; ordering against the two sourced ring figures asserted in tests |
| Stage 2 | #14 | Registered and adopted: turret shell was narrower than its own ring bearing; corrected from the plan view |
