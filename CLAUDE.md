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

## Tuning knobs (top of script)
`VF, VR, STEER, PHIMAX, BOOMRATE, BUCKRATE, TARGET, TLIMIT, TPP`. Pile resistance: `L.v/=(1+bucketContacts*0.4)` (penetration-based).

## Roadmap
### Phase 2
- Skill drills as separate levels: cone slalom, fill-the-bucket, precise truck dump (V-pattern loading).
- Dashboard gauges: boom height in metres, bucket load, hydraulic pressure feel.
- Per-trainee session log (localStorage) with progress over attempts; exportable CSV.
- Performance pass for mid-range Android phones (reduce shadow map, adaptive particle count).
### Phase 3
- ESP32-S3 firmware in `firmware/` acting as a USB HID gamepad (2 joysticks + buttons, hall-effect sensors). Map axes to the same Gamepad API layout the sim already reads.

## Testing
Headless check with Playwright is possible (Chromium preinstalled; serve three.min.js locally because CDN may be blocked). Drive the sim by stepping `step(FDT)` through a temporary debug hook; remove the hook before committing.
