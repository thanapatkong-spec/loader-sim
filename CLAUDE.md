# ลานฝึกรถตัก (Wheel Loader Training Sim)

Web-based training simulator for wheel-loader operators. Owner: Thanapat (PETSBOX SUPPLY). Talk to the owner in Thai.

## Stack
- Single file `index.html`: Three.js r128 (UMD from cdnjs) + a custom position-based-dynamics particle solver for soil. No build step.
- Keep it deployable as a static file (GitHub Pages / Vercel). Keep external scripts on cdnjs or jsdelivr only.

## Current state (Phase 1 — done)
- Articulated loader: rear frame (engine + cab) and front frame (boom + bucket) joined at a pivot; kinematics in `stepVehicle()`.
- Soil: ~480 particles, R=0.2 m, 0.1 t each, spatial-hash pair solver with friction, OBB colliders (`col()`), 4 substeps @60 Hz.
- Mission: load 15 t into the dump truck in 6 min. Penalties: spill (25/t) and truck collisions (50 each). Grades A–D.
- Inputs: keyboard, Gamepad API, two on-screen touch sticks (right stick uses real loader lever convention: pull back = raise boom, left = curl).
- Cameras: chase / cab / top.

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
  - `ex_ctrl`: touch 6 targets (`EX_TGT`) with the teeth (`EX_TIP`). `ex_trench`: pit `PIT` cut into the ground mesh (lid in other levels), floor handled in the particle ground pass, walls are static `mach:'pit'` colliders; `trenchStats()` gives dug %, per-1 m depth (volume based), spoil in `SPOIL`; submit with Enter once ≥85%. `ex_load`: truck parked via `lv.truckAt` so the swing never crosses the cab.
  - Excavations live in `PITS`: `trench` (box, pre-filled loose grains) and `dig` (`DIG`, a 7×7 m patch at x≈−10.5 of solid ground stored as a vertex heightfield `TH`, 0.2 m cells). `PT` is the active one and `pitFloor(x,z)` (→ `hAt` for the heightfield) is the floor for particles and the bucket.
  - Real digging on `DIG`: `carve()` lowers `TH` under the bucket's cutting face (`CUTPTS`: teeth, outer bottom, mouth edge at full width; back/pin end stay blocked); every `PV` m³ cut becomes a 0.1 t grain. Cut soil is pending load while the bucket is buried and appears in bucket `SLOTS` once they are above ground (`spawnSoil`). Grains inside the bucket (`inBk`) ignore the ground and take the bucket's velocity unless the mouth points >30° down (dumping). Cutting stops when the bucket is full (`BFULL`) or at `MAXD`.
  - Target shape `POND` (5×5 m, 1.2 m, 1:1 banks, design heights `DES`). `digStats()` measures volume dug to design, over-dig beyond 10 cm (m³, also painted red on the terrain), bottom/bank vertices within ±15 cm, loose soil left in the pond, spoil in `lv.spoil`, rim lumps.
  - `ex_pit` (dig the pond from flat ground; survey stakes `stakeG`) and `ex_trim` (banks left 20–40 cm thick + lumps on the rim; shave to the 1:1 line). Over-dig is allowed and costs points (−150 / −200 per m³); these levels set `allowNeg` so totals can go below 0 (chart handles negatives). Bucket strikes count only when the bucket reaches a surface faster than 1.2 m/s (`exVd`).
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
