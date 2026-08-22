# Tiger I Ausf. H — Sourced Specification

Every dimension used by this project traces back to this document. `src/spec/*.ts` holds
the numbers; `src/spec/meta.ts` holds a matching tree of `{ tol, source, confidence }`
records, and the type system will not compile a dimension that has no entry there.

**Confidence levels used throughout:**

| Level | Meaning |
|---|---|
| `primary` | Original wartime documentation, technical manuals, engineering drawings |
| `secondary` | Specialist historical research or high-quality museum documentation |
| `derived` | Computed from other spec values (and asserted against an independent figure where one exists) |
| `estimated` | Reconstructed. Not documented. Must be declared as such in the Gauntlet report. |

## Sources

| Key | Source |
|---|---|
| `TIC-tech` | Tiger I Information Center — Technical Specifications. https://www.alanhamby.com/technical.shtml |
| `TIC-susp` | Tiger I Information Center — Suspension. https://www.alanhamby.com/suspension.shtml |
| `TIC-trans` | Tiger I Information Center — Transmission and Steering. https://www.alanhamby.com/transmission.shtml |
| `TIC-maybach` | Tiger I Information Center — The Maybach Engine. https://www.alanhamby.com/maybach.shtml |
| `TIC-changes` | Tiger I Information Center — Major Model Changes. http://www.alanhamby.com/changes.shtml |
| `T1I-ring` | tiger1.info — Turret ring bearings. https://tiger1.info/EN/Turret-ring-bearings.html |
| `T1I-feifel` | tiger1.info — Feifel air pre-cleaners. https://tiger1.info/EN/Feifel-air-precleaners.html |
| `T1I-turret` | tiger1.info — Plan view of mid-production turret. https://tiger1.info/EN/Turret-layout.html |
| `TM-wheels` | The Tank Museum — Tiger Wheels. https://tankmuseum.org/article/tiger-wheels |
| `REF-drawing` | Supplied orthographic line drawing (1:50), side / plan / front / rear |
| `REF-photo-N` | Supplied historical photograph N (see `docs/CONFIGURATION.md` §Reference images) |

> **Not used as a source, deliberately:** War Thunder, World of Tanks, other games, AI-generated
> imagery, and 3D model marketplaces. Museum restorations are used only as corroboration, never as
> primary evidence, because restored vehicles routinely carry replacement and non-original parts.

---

## 1. Overall dimensions

| Quantity | Value | Source | Confidence |
|---|---|---|---|
| Hull length (without gun) | 6,316 mm | `TIC-tech` | secondary |
| Length, gun forward | 8,450 mm | `TIC-tech` | secondary |
| Width over combat tracks | 3,720 mm | `TIC-tech` | secondary — **conflict, see UNCERTAINTY #5** |
| Width over transport tracks | 3,140 mm | `TIC-tech` | secondary |
| Height to hull roof | 1,780 mm | `TIC-tech` | secondary |
| Height to cupola top | 3,000 mm | `TIC-tech` | secondary |
| Ground clearance | 470 mm | `TIC-tech` | secondary |
| Track contact length | 3,605 mm | `TIC-tech` | secondary |
| Combat weight | 57,250 kg | `TIC-tech` | secondary |

## 2. Running gear

| Quantity | Value | Source | Confidence |
|---|---|---|---|
| Track designation | `Kgs 63/725/130` | designation convention | primary |
| Track width (combat) | 725 mm | designation; `TIC-susp` gives 72.5 cm | primary — resolves the 720/725 conflict |
| Track pitch | 130 mm | designation | primary |
| Links per track | 96 | `TIC-tech`, `TIC-susp` | secondary |
| Track pin diameter | 28 mm | `TIC-susp` | secondary |
| Track width (transport) | 520 mm | `TIC-susp` (52.1 cm) | secondary |
| Road wheel diameter × width | 800 × 75 mm | `TIC-tech` | secondary |
| Road wheels per side | 24 (3 per axle) | `TM-wheels`, `TIC-susp` | secondary — **conflict, see UNCERTAINTY #1** |
| Axle stations per side | 8 | `TIC-susp` | secondary |
| Road wheel rim bolts | 18 (from Feb 1943) | `TIC-changes` | secondary |
| Torsion bars, total | 16 (8 per side, transverse) | `TIC-susp` | secondary |
| Torsion bar length | 1,644.6 mm | `TIC-susp` | secondary |
| Torsion bar diameter | 55–58 mm | `TIC-susp` | secondary |
| Swing arm direction | Forward on the driver's side, rearward on the other | `TIC-susp` | secondary |
| Shock absorbers | Hydraulic, internal, stations 1 and 8 only | `TIC-susp` | secondary |
| Bump stops | 2 per side, on the 1st and 8th torsion bars | `TIC-susp` | secondary |
| Drive sprocket (front) | 914.4 mm dia., 10 spokes, 20 teeth on twin removable rings | `TIC-susp` | secondary |
| Idler (rear) | ~686 mm dia. (27 in), draw-bolt track tensioning | `TIC-susp` | secondary |
| Return rollers | **None** — the top run rests on the road wheels | `REF-drawing`, `TIC-susp` | secondary |

**Derived cross-check.** Sprocket pitch radius for a 20-tooth wheel at 130 mm pitch is
`130 / (2·sin(π/20)) = 415.55 mm`, against a quoted outer radius of `914.4/2 = 457.2 mm`. The
41.65 mm difference is tooth-tip plus guide-horn allowance — a plausible margin, and the agreement
between an independently-sourced outer diameter and a derived pitch radius is treated as
corroborating evidence for both. Asserted in `tests/spec/dimensions.test.ts`.

## 3. Armament

| Quantity | Value | Source | Confidence |
|---|---|---|---|
| Gun | 8.8 cm KwK 36 L/56 | `TIC-tech` | primary |
| Bore | 88 mm | designation | primary |
| Barrel length | 4,928 mm (L/56 = 56 × 88) | derived | derived |
| Elevation | −6.5° to +17° | `TIC-tech` | secondary — **conflict, see UNCERTAINTY #3** |
| Main gun ammunition | 92 rounds | `TIC-tech` | secondary |
| Machine guns | 2 × MG 34 (coaxial + hull ball mount) | `TIC-tech` | secondary |
| MG ammunition | ~4,800 × 7.92 mm | `TIC-tech` | secondary |
| Gun sight (Ausf. H) | TZF 9b **binocular** → two mantlet apertures | `TIC-changes` (TZF 9c monocular only from Mar 1944) | secondary |

**Turret traverse** (`T1I-turret`, secondary): Boehringer-Sturm L4S variable-speed hydraulic motor
driven from the main engine by a secondary drive shaft. 360° in 60 s in low gear independent of
engine rpm; 19 s in high gear at idle; ~10 s at maximum permissible engine speed. Gunner controls
direction and speed by foot pedals or a control lever at his left; a lever at his right selects
high/low. Smooth enough for final laying without the handwheel. On power loss the turret traverses
slowly by hand, assisted by a second handwheel (**see UNCERTAINTY #8** for whose station it is on).

**Ammunition stowage** (`T1I-*`, secondary): four compartments per sponson, the middle two of each
holding 16 rounds → 64 rounds; a further 6 in the left sponson beside the driver; the remainder at
floor level. Sponson compartments close with a sheet-metal door of four segments hinged to the roof,
which folds down when released — shrapnel protection only. All rounds face forward except those in
the rear right-hand bin.

## 4. Armour

Confirmed figures:

| Plate | Thickness | Angle | Source |
|---|---|---|---|
| Hull front (nose) | 100 mm | 24° | `TIC-tech` |
| Hull sides, upper (superstructure) | 80 mm | — | Tank Encyclopedia summary |
| Hull sides, lower | 60 mm | — | Tank Encyclopedia summary |
| Turret front | 100 mm | 8° | `TIC-tech` |
| Gun mantlet | 120 mm | 0° | `TIC-tech` — **conflict, see UNCERTAINTY #4** |
| Turret roof (Ausf. H) | 25 mm | horizontal | `TIC-changes` (40 mm only from Mar 1944) |

Provisional and **flagged for confirmation before Gauntlet A passes** — carried at
`confidence: 'estimated'` in `src/spec/meta.ts` so they cannot be mistaken for sourced values:
driver's front plate, upper glacis, hull rear, hull roof, hull belly, turret sides, turret rear.

## 5. Powertrain

**Engine — Maybach HL 210 P45** (`TIC-maybach`, secondary). This is the Ausf. H engine: the HL 230
P45 only appears from Fgst. 250251 / May 1943.

| Quantity | Value |
|---|---|
| Displacement | 21.33 L |
| Configuration | V-12, water-cooled, petrol |
| Block | **Aluminium** (the HL 230's is cast iron) |
| Output | 650 PS @ 3,000 rpm |
| Envelope | ~1,220 × 970 × 940 mm (4 ft × 3 ft 2 in × 3 ft 1 in, without air cleaners) |
| Carburettors | 4 × Solex Duplex 52 JFF 2-2U 2046, twin-choke downdraught |
| Fuel pumps | 4 × Solex mechanical with bowl filters |
| Lubrication | Dry sump, pressure fed, 28 L, scavenge pumps at opposite ends |
| Cooling | Two transverse film-type radiators; twin fan assemblies each side on a two-speed drive |
| Fuel | 4 tanks (2 per side), 569 L total |

**Transmission — Maybach Olvar OG 40 12 16** (`TIC-trans`, secondary): hydraulically controlled
semi-automatic pre-selector, 8 forward / 4 reverse. Mounted **to the right of the driver**, driven by
a shaft running beneath the fighting-compartment floor from the rear engine. Overall ratios 15.4:1
(1st) to 0.98:1 (8th). Centrifugal clutch with hydraulic disengagement at the input. Power take-offs
supply the turret traverse hydraulics and the bilge pump.

**Steering** (`TIC-trans`, secondary): regenerative dual-radius unit derived from the British
Merritt-Brown type, mounted **transversely in the bow**. The first German tank with an actual
steering wheel; hydraulically assisted, epicyclic gears with multi-disc clutches fed by the
gearbox-driven pump, giving two distinct turn radii in each gear. Emergency steering via levers each
side of the driver acting on 550 mm Argus disc brakes on each drive shaft, which are also the
service brakes. Neutral turn in 3.44 m. **See UNCERTAINTY #7** for the unit's designation.

**Final drives** (`TIC-trans`, secondary): bolted externally to the hull, two-stage (spur then
epicyclic), 10.55:1 overall, 8 L of oil each.

**Performance** (`TIC-trans` / `TIC-tech`): 38 km/h governed on road (45.4 km/h appears in
`TIC-tech` and is the ungoverned figure), 20 km/h cross-country, 125 km road range.

## 6. Turret ring

`T1I-ring`, secondary. Bearing outer diameter 2,100 mm in all versions. Ball circle 1,990 mm in the
original design, 1,995 mm mid/late.

| Turret type | Balls |
|---|---|
| Original (Ausf. H) | 158 total — every second ball load-bearing at 40 mm dia., 39 mm spacer balls between |
| Mid/late (from July 1943) | 113 load-bearing, each carrying a loose 55 mm ring |
| Final | 130 load-bearing, ring on every second ball |

The **clear opening diameter** is not given by this source. See **UNCERTAINTY #2**.

## 7. Production change record

From `TIC-changes` (secondary). This is the backbone of the configuration decision in
`docs/CONFIGURATION.md` — it is what fixes the vehicle to a single month.

| Date | Change |
|---|---|
| Aug 1942 | Retaining hooks for rear louvres; camouflage-frame mounting bosses; smoke candle dischargers; complete tool sets |
| Sep 1942 | Track cable added to hull side |
| Oct 1942 | Antenna base removed from rear; convoy tail light and shovel on glacis; tow cables reversed |
| Nov 1942 | **Feifel air cleaner system mounted**; track guards added to hull sides; hinged track guards front and rear; reinforced gun mantlet |
| Dec 1942 | **Emergency escape hatch added** (replacing the right-hand turret rear pistol port); straight side track guards |
| Jan 1943 | S-Minen dischargers; muffler exhaust guards; triangular ends on side track guards; turret stowage bin |
| **Feb 1943** | Engine compartment vent cover; **road wheel rim changed to 18 bolts**; starter shaft relocated; six gun cleaning rods |
| Mar 1943 | Modified large oval Feifel filters; triangle cover on rear deck; **loader's periscope added** |
| May 1943 | **Engine changed to Maybach HL 230** (Fgst. 250251) |
| Jun 1943 | Smoke candle dischargers discontinued |
| Jul 1943 | **New turret with revised cupola**; escape hatch design changed; Zimmerit applied |
| Aug 1943 | Single headlight replaces dual; turret vision port slits widened |
| Oct 1943 | S-Minen dischargers discontinued; Feifel system discontinued; chevrons added to track links |
| Feb 1944 | Steel road wheels replace rubber-rimmed; turret ring guard added |
| Mar 1944 | Loader's hatch changed to short hinged version; monocular gun sight; turret roof to 40 mm |
| Apr 1944 | Lighter muzzle brake with insert; wood deck over fuel tanks |
| Jun 1944 | Two-bolt escape hatch hinge |

## 8. Designation and paint

**Designation** (secondary, multiple concurring sources): the first official designation was
`Panzerkampfwagen VI Ausführung H` (`Pz.Kpfw. VI Ausf. H1`), ordnance inventory `Sd.Kfz. 182`. In
**March 1943** it was renamed `Pz.Kpfw. Tiger Ausf. E`, `Sd.Kfz. 181`. **No vehicle change
corresponded to the rename** — it is purely a date boundary. A strictly correct "Ausf. H" is
therefore an early-production vehicle, which is what fixes this reconstruction's configuration.

**Paint** (secondary): `RAL 7021 Dunkelgrau` was the standard overall colour for German AFVs from
1939 to early 1943. On **18 February 1943** an order from Inspectorate 2 changed the factory base
coat to `RAL 7028 Dunkelgelb`. Research cited by modelling references indicates approximately the
first 50 Tigers left the factory in Dunkelgrau. Anchoring this reconstruction to **late** February
1943 places it unambiguously in Dunkelgelb; `RAL 7021` remains available as a variant switch.

Interior paint — ivory/`Elfenbein` above the sponson line over primer below — is the conventional
German practice but the exact demarcation for Feb 1943 Henschel production is **UNCERTAINTY #11**.

## 9. Feifel air pre-cleaner system

`T1I-feifel`, secondary. Two removable cylindrical pre-cleaners bolted to the hull rear plate at four
points each, introduced for Tunisia because the engine's integral oil-bath filters were inadequate
in dust.

- **Early type (the Ausf. H fitment):** internal partitions forming two upper chambers, a middle
  chamber and two conical dust bins; **18 vertical cyclone tubes** in the middle section. Dusty air
  enters side intakes, spins in the tubes, clean air leaves the top, dust falls into the bins.
- **Later type (March 1943 redesign):** a single upper compartment; 14 cyclone tubes, with two
  positions blanked off and the rest not relocated.
- **Pipework:** a V-shaped duct at the engine hatch's front rectangular slot (replacing the standard
  box cover) feeds flexible metal trunks to both filters; return ducts to the engine deck are covered
  by fine mesh screens.
- Dropped from production **October 1943**, though mounting points stayed welded on for roughly
  three more months.
