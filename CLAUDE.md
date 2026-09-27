# ลานฝึกรถตัก (Wheel Loader Training Sim)

Web-based training simulator for wheel-loader operators. Owner: Thanapat (PETSBOX SUPPLY). Talk to the owner in Thai.

## Stack
- Single file `index.html`: Three.js r128 (UMD from cdnjs) + a custom position-based-dynamics particle solver for soil. No build step.
- Keep it deployable as a static file (GitHub Pages / Vercel). Keep external scripts on cdnjs or jsdelivr only.

## Current state (Phase 1 — done)
- Articulated loader: rear frame (engine + cab) and front frame (boom + bucket) joined at a pivot; kinematics in `stepVehicle()`.
- Soil: ~480 particles, R=0.2 m, 0.1 t each, spatial-hash pair solver with friction, OBB colliders (`col()`), 4 substeps @60 Hz.
- Soil rendering (sand look): each particle is drawn as `SUBP` small sand points (`THREE.Points`, sand palette) plus an unlit flat-colour core (`soilCore`, InstancedMesh) only where the grain has ≥3 neighbours within 0.5 m, so piles read as one sand mass and stray grains as loose sand, never as round balls. Grains in the truck bed are covered by `truckLoad`, a truck-local height grid (`TL`) domed over each grain.
- Mission: load 15 t into the dump truck in 6 min. Penalties: spill (25/t) and truck collisions (50 each). Grades A–D.
- Inputs: keyboard, Gamepad API, two on-screen touch sticks (right stick uses real loader lever convention: pull back = raise boom, left = curl).
- Cameras: chase / cab / top.
- Sound (`SND`): all synthesized with Web Audio, no files; the context starts on the first key/pointer press and suspends when the tab is hidden. Continuous layers set every frame in `SND.tick()` from `lastInp` and joint motion: diesel engine (rpm from throttle, hydraulics, digging), hydraulic whine, relief-valve squeal (lever held but the joint does not move), bucket crunch (`cutLast` / `bucketContacts`), sand-pour hiss (grains falling > 1.2 m/s), track rattle, reverse/travel alarm. One-shots: `SND.hit(kind)` (truck/wall/ground/cone), thud when soil lands in the truck, `SND.ding()` on gates/targets/weighings, `SND.chime(ok)` in `finish()`. Toggle with V or the tools button (`localStorage['loaderSnd']`). `SND.levels` exposes the last layer levels for tests.

## Phase 2 — done
- Levels live in the `LEVELS` table (`slalom`, `fill`, `dump`, `mission`), each with `setup/tick/hud/result/key`. `reset(id,run)` builds the scene per level (truck on/off via `setTruck`, pile on/off, slalom course `slalomG`, weigh pad `padG`).
  - Level 1 slalom: 4 staggered gates (`GATES`, half-width `GHW`), finish at `FINZ`, par `SLALOM_PAR`; cone contact = sampled cone points vs loader OBBs.
  - Level 2 fill: 3 weighings on the pad (stopped, bucket raised > 0.25 m, 1 s); re-armed when the bucket is emptied. Fill % vs `BCAP`.
  - Level 3 dump: a dump cycle is loaded → tipping near the truck (snapshot gap to bed / offset along bed / approach angle via `dumpGeom()`) → settled; delivered = truck-count delta.
- `countSoil()` no longer counts grains still inside the bucket as "in truck".
- Gauges: bucket height (lowest bucket point, green above truck rim `RIM`), bucket-load bar vs `BCAP`.
- Log: `localStorage['loaderLog.v1']` (array of attempts, per trainee name `loaderWho`), history overlay with SVG progress chart, CSV export (UTF-8 BOM).
- Performance: quality tiers `QUAL` (pixel ratio, shadow map size, grain count, grain mesh detail); `monitor()` drops a tier when FPS < 40 (trims untouched pile grains mid-run) and climbs back when > 57, never above a tier that stuttered. Low tiers update shadows every other frame; wheel lugs are instanced.

## Excavator + readiness (Phase 2b — done)
- Second machine: excavator (`E` state, `exG→exUp→exBoom→exArm→exBkt`, `stepEx()`), ISO pattern: left stick arm/swing, right stick boom/bucket; keys W/S arm, A/D swing, ↑ boom down, ↓ boom up, ←/→ curl/dump, I/K/J/L tracks. Levels carry `machine:'ex'`; `setScene()` toggles machine, truck, trench and colliders (`b.mach`).
  - Joint rates/limits `EXR`/`EXLIM`, bucket `BCAP_EX`; soil resistance scales joints down to 35% min. Ground constraint releases joints one at a time (boom first) so the bucket can drag along the floor; ground strikes counted in `gndHits`.
  - `ex_ctrl`: touch 6 targets (`EX_TGT`) with the teeth (`EX_TIP`). `ex_trench`: pit `PIT` cut into the ground mesh (lid in other levels), floor handled in the particle ground pass, walls are static `mach:'pit'` colliders; `trenchStats()` gives dug %, per-1 m depth (volume based), spoil in `SPOIL`; submit with Enter once ≥85%. `ex_load`: digs the same solid ground as the pond (`pit:'dig'`, flat `terrInit`, stakes mark the dig zone, `noOver` turns off the red over-dig paint, no spoil frame) and loads a truck parked side-on at `lv.truckAt` (cab away from the swing). Spill = lifted soil that lands outside `inDigZone()` (pond + 1.2 m), counted in `countSoil()` or when `absorb()` takes it.
  - Excavations live in `PITS`: `trench` (box, pre-filled loose grains) and `dig` (`DIG`, an 11×9 m patch x −14..−3, z −10.5..−1.5 of solid ground stored as a vertex heightfield `TH`, 0.2 m cells, plus a loose-soil layer `LSO` on top). `PT` is the active one and `pitFloor(x,z)` (→ `hAt` for the heightfield) is the floor for particles and the bucket.
  - Real digging on `DIG`: `carve()` lowers `TH` under the bucket's cutting face (`CUTPTS`: teeth, outer bottom, mouth edge at full width; back/pin end stay blocked); every `PV` m³ cut becomes a 0.1 t grain. Cut soil is pending load while the bucket is buried and appears in bucket `SLOTS` once they are above ground (`spawnSoil`). Grains inside the bucket (`inBk`) ignore the ground and take the bucket's velocity unless the mouth points >30° down (dumping). Cutting stops when the bucket is full (`BFULL`) or at `MAXD`. `carve()` takes loose soil first, then solid. In the excavator the load is drawn as a sand `heap` mesh in the bucket; grains that land on the ground are absorbed into `LSO` (`absorb()`, 5×5 tent kernel) and `slump()` keeps loose soil at its angle of repose, so dumped soil becomes sand mounds in the terrain and N stays small. Bucket grains pushed below the surface go back to pending load (`spawnSoil`), a slot is skipped if a grain already sits in it, and the heap region of `BKBOX.ex` extends past the mouth (local −y is the open face) so heaped soil rides along. The solver caps grain speed at 5 m/s horizontally and upward (`VCAP`) so collision push-outs never launch sand.
  - Target shape `POND` (5×5 m, 1.2 m, 1:1 banks, design heights `DES`). `digStats()` measures volume dug to design, over-dig beyond 10 cm (m³, also painted red on the terrain), bottom/bank vertices within ±15 cm, loose soil (`LSO`) left in the pond, share of loose soil in `lv.spoil`, loose soil in the rim band. `ex_trim` lumps are `LSO` mounds (`addLumps`).
  - `ex_pit` (dig the pond from flat ground; survey stakes `stakeG`) and `ex_trim` (banks left 20–40 cm thick + lumps on the rim; shave to the 1:1 line). Over-dig is allowed and costs points (−150 / −200 per m³); these levels set `allowNeg` so totals can go below 0 (chart handles negatives). Bucket strikes count only when the bucket reaches a surface faster than 1.2 m/s (`exVd`).
  - `ex_slope` (dig on a hill): `lv.hill` turns on `hillOn`; `hillH()` is a 2.4 m hill (20° ramp from z −1.5, 60° sides/back = the edges you can fall off) drawn by `hillMesh` around the patch and used by `hAt()` outside it; the patch TH starts as the hill. Dig zone `DZ` (0.8 m below the hill surface, stakes `dzG`, orange tint via `DZT` in `terrSync`), spoil frame `SPOIL_S` at the foot; `slopeStats()` = dug %, share of spawned grains (`spawnCnt`) in the frame.
  - Machine on terrain (only when `hillOn`): `exApplyT()` samples 9 points along each track (`XS`) and rests the tracks on the upper hull of the profile under the balance point `COMX` (crests see-saw), roll from the left/right track average. `exStability()` sums `MASS` (undercarriage, upper, counterweight, boom, arm, bucket + load; the bucket is dropped when it rests on the ground) in exG space, projects the centre of mass along gravity onto the ±2.0 × ±1.5 m track footprint → `STAB` (0..1, HUD + alarm below 25%). Ground steeper than 30° counts against the margin (the machine slides). Past an edge `TIP` rotates the machine about it (`TIPE`, inverted pendulum); a bucket on the ground holds it and boom-down levers it back; beyond 0.45 rad it rolls over (`TIP.fall`, controls dead), ends on its side dropped to the ground and the attempt fails (`G.tipped`, score 0).
- Soil on the floor: grains lying on the ground get a soft sand splat (`soilSplat`) instead of a core; cores need ≥3 neighbours, ≥6 for grains on the floor.
- Pass criteria: `CRIT[levelId]` (list of checks with a coaching tip). A level is passed when `PASS_NEED` (2) of the last `PASS_WIN` (3) attempts pass every check (`lvStatus`). Result screen lists ✓/✗ and tips; menu marks passed levels and the recommended next one; "ประเมินความพร้อม" overlay (`openReady`) summarises per machine and prints. CSV has a pass column and excavator metrics.

## Desktop build (`desktop/`)
- Electron shell (`main.js`) around a generated offline copy of `index.html`: `build-app.js` writes `desktop/app/` and swaps the cdnjs Three.js tag and Google Fonts links for local copies from `node_modules` (`three@0.128.0`, `@fontsource/*`). It throws if those tags change in `index.html`, so update the regexes there when editing them.
- `.github/workflows/desktop.yml` builds the Windows NSIS installer + portable exe on `windows-latest` and an ad-hoc-signed universal macOS dmg on `macos-latest` (no Apple Developer ID / notarization yet) (artifact on every push touching the app, GitHub Release on `v*` tags). NSIS needs Windows (wine on Linux), but `npx electron-builder --win --dir` works on Linux for a quick packaging check.
- Local check: `xvfb-run` + Playwright `_electron.launch` against `desktop/node_modules/electron/dist/electron`.

## Tuning knobs (top of script)
`VF, VR, STEER, PHIMAX, BOOMRATE, BUCKRATE, TARGET, TLIMIT, TPP, BCAP, RIM`, plus `QUAL` tiers and per-level `limit`/`grades`. Pile resistance: `L.v/=(1+bucketContacts*0.4)` (penetration-based).

## Roadmap
### Phase 2 leftovers
- Hydraulic pressure feel on the dashboard.
- Tune excavator criteria/targets with real trainees (thresholds were set from scripted runs, not people). Scripted bots reached ~60% on `ex_pit` and ~20 cm accuracy on `ex_trim` banks (only with the bucket bottom kept parallel to the slope), so both need a human check.
### Phase 3
- ESP32-S3 firmware in `firmware/` acting as a USB HID gamepad (2 joysticks + buttons, hall-effect sensors). Map axes to the same Gamepad API layout the sim already reads.

## Testing
Headless check with Playwright is possible (Chromium preinstalled; serve three.min.js locally because CDN may be blocked). Drive the sim by stepping `step(FDT)` through a temporary debug hook; remove the hook before committing.
