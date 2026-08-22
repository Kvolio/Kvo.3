# Target Configuration

**Panzerkampfwagen VI Tiger Ausf. H (Sd.Kfz. 182)**
Henschel production, **late February 1943**, Fgst. Nr. approximately 250050–250100.

This file is the authority for *what is on the vehicle*. `docs/RESEARCH.md` is the authority for
*how big it is*. `src/spec/variants.ts` encodes this file as the `AusfH_Feb1943` preset, and
`tests/variants/configuration.test.ts` asserts the built model matches it part-for-part.

---

## Why this date

`Ausf. H` is a date range, not a styling choice. The designation was used only until March 1943,
when the vehicle was renamed `Ausf. E` with no accompanying design change. A strictly correct
Ausf. H is therefore an early-production tank.

Late February 1943 is chosen because it sits in a narrow window that resolves cleanly:

- **After** the January 1943 cluster (S-mine dischargers, muffler exhaust guards, triangular
  track-guard ends, turret stowage bin) and the February 1943 cluster (engine compartment vent
  cover, 18-bolt road wheel rims, relocated starter shaft, six gun cleaning rods).
- **Before** the March 1943 changes (oval Feifel filters, loader's periscope, rear-deck triangle
  cover) and everything later.
- **After** the 18 February 1943 paint order, which puts the factory finish unambiguously in
  Dunkelgelb rather than on the Dunkelgrau/Dunkelgelb boundary.

The result is one coherent, tightly-dated, genuinely-produced configuration rather than an
arbitrary combination of Tiger I features.

---

## Present

### Powertrain
- Maybach **HL 210 P45**, 21.33 L V12, **aluminium** block, 650 PS @ 3,000 rpm
- Maybach Olvar OG 40 12 16 pre-selector gearbox, 8F/4R, right of the driver
- Regenerative dual-radius steering unit, transverse in the bow, steering wheel
- **Feifel air pre-cleaner system, early round canisters, 18 cyclone tubes**, with the V-duct at the
  engine hatch front slot and flexible trunking
- Two transverse radiators, twin fan assemblies each side
- Four fuel tanks, 569 L

### Turret
- **Drum-type commander's cupola with five vision slits** and a hinged hatch
- **Loader's hatch, long-hinge type**
- **Escape hatch on the right of the turret rear** (Dec 1942, replacing the right-hand pistol port)
- **One pistol port remaining, on the left of the turret rear**
- **3 × NbK 39 smoke candle dischargers per turret side**
- Turret stowage bin ("Rommelkiste") on the turret rear
- **Turret roof 25 mm**
- Turret ring: original bearing, 158 balls (40 mm load-bearing alternating with 39 mm spacers)
- Spare track links racked on the turret sides
- **No loader's periscope**
- **No turret ring guard**

### Armament
- 8.8 cm KwK 36 L/56 with the **heavy double-baffle muzzle brake**
- **TZF 9b binocular sight → TWO apertures in the mantlet.** This is one of the most reliable
  Ausf. H discriminators and is asserted mechanically by the configuration test.
- Reinforced mantlet (Nov 1942)
- Coaxial MG 34; hull MG 34 in a ball mount

### Running gear
- **Rubber-tyred road wheels, 800 × 75 mm, 24 per side, 3 per axle**, **18-bolt rims**
- 16 transverse torsion bars; swing arms forward on the driver's side, rearward on the other
- Hydraulic shock absorbers on stations 1 and 8 only
- Drive sprocket front, 20 teeth on twin rings; idler rear with draw-bolt tensioning
- **Kgs 63/725/130 tracks, 96 links per side, smooth — no chevrons**

### Hull and fittings
- **Two Bosch headlights** on the glacis
- **S-Minen dischargers** (Minenabwurfvorrichtung)
- Straight side track guards with **triangular ends**; hinged front and rear track guards
- Muffler exhaust guards
- Retaining hooks for the rear louvres; camouflage-frame mounting bosses
- Track cable on the hull side; convoy tail light and shovel on the glacis; tow cables reversed
- Engine compartment vent cover
- Six gun cleaning rods
- Complete tool set with brackets, jack and jack block
- **Deep-wading / submersion sealing** (early Tigers were built to ford to 4 m)

### Finish
- **RAL 7028 Dunkelgelb** base coat over RAL 8012 Rotbraun primer
- **No Zimmerit**

---

## Absent — and the date that would have added it

Asserted as *absent* by `tests/variants/configuration.test.ts`, because a model that quietly
acquires a later part is the single most likely way this reconstruction drifts out of variant.

| Feature | Would appear |
|---|---|
| Oval Feifel filters | Mar 1943 |
| Loader's periscope | Mar 1943 |
| Rear-deck triangle cover | Mar 1943 |
| Maybach HL 230 P45 | May 1943 (Fgst. 250251) |
| Smoke dischargers deleted | Jun 1943 |
| Cast cupola with 7 periscopes | Jul 1943 |
| Zimmerit | Jul 1943 |
| Single headlight | Aug 1943 |
| Widened turret vision slits | Aug 1943 |
| S-mine dischargers deleted | Oct 1943 |
| Feifel system deleted | Oct 1943 |
| Chevron track links | Oct 1943 |
| Steel road wheels (16/side) | Feb 1944 |
| Turret ring guard | Feb 1944 |
| Short hinged loader's hatch | Mar 1944 |
| TZF 9c monocular sight (one mantlet aperture) | Mar 1944 |
| 40 mm turret roof | Mar 1944 |
| Light muzzle brake with insert | Apr 1944 |
| Wood deck over fuel tanks | Apr 1944 |
| Two-bolt escape hatch hinge | Jun 1944 |

Nothing from the Tiger II, Panther, or any Tiger prototype appears in this model under any variant.

---

## Reference images

The supplied references are used for different things, and deliberately not interchangeably. No
component is modelled from a single image: each is reconstructed from the drawing (geometry) plus
photographs (presence and finish) plus a written source (dimension). Where the three disagree, the
disagreement goes into `docs/UNCERTAINTY.md` rather than being resolved by preference.

| Ref | Subject | Used for | **Not** used for |
|---|---|---|---|
| `REF-photo-1` | Tiger "211" beside a thatched cottage, summer, Eastern Front. Rubber-tyred wheels and no Zimmerit date it between Nov 1942 and Aug 1943 | Stance; fender and track-guard profile; hull/turret side proportion; gun and mantlet silhouette; engine-deck stowage. Crew standing alongside gives an absolute height check | Cupola type and any late-1943 fitting — this vehicle may post-date Feb 1943 |
| `REF-photo-2` | Tiger "11", frontal, open ground, spare track links on the nose | Frontal proportion: glacis layout, track-to-hull width ratio, driver's visor and MG ball-mount positions, headlight positions, tow shackles | Rear and interior detail |
| `REF-photo-3` | Tiger "12", crew in light kit, track links racked on the turret side | Turret side track-link racks; mantlet and cupola profile; crew scale | Dating — light uniforms are ambiguous |
| `REF-drawing` | Orthographic line drawing, 1:50, side / plan / front / rear. **Shows Feifel canisters on the rear plate**, dating it Nov 1942 – Oct 1943 | **Primary geometric reference.** Silhouette and plan-view layout | The printed 1:50 scale — re-scale against the known 6,316 mm hull length instead |
| `REF-cutaway` | Colour cutaway illustration | Interior **topology only**: engine bay aft, driveshaft under the fighting-compartment floor, gearbox front-right, gun and recoil, ammunition zones | **Any dimension.** Cutaway illustrations routinely distort proportions to expose components |

---

## Variant switching

The configuration above is the `AusfH_Feb1943` preset, but nothing is baked. `VariantConfig` in
`src/spec/variants.ts` carries independent switches for cupola type, road wheel type, Feifel
fitment, smoke dischargers, S-mine dischargers, Zimmerit, track type, turret roof thickness, gun
sight and engine. Every part builder returns `null` when the active variant excludes it, so a
different production block is a data change, not a rebuild.

`tests/variants/variants.test.ts` builds every permutation and checks each one is manifold and free
of interpenetration at its mount frames — a later configuration must not be allowed to rot while
the Ausf. H is the one being looked at.
