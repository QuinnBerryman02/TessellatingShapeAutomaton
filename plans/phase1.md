# Phase 1 — The Web Game

> Phase 0 was the Java prototype in `../src`: a research spike into tessellation
> and symmetry. It proved the ideas but was never structured as a game. Phase 1
> rebuilds everything from scratch as a real, shippable game.

## 1. Vision

A game about **growing mathematical tilings and fighting with them**.

The player designs a tessellation in a lab, then deploys it onto a shared field
where it expands outward. Two patterns competing for the same ground cannot
coexist: whichever claims a cell first destroys what was there. The result is a
living, crystalline battle-line where topology and symmetry are the actual
weapons.

Pillars:

1. **The maths is the content.** Symmetry and tiling aren't decoration; they
   determine how a pattern grows, where it touches itself, and how it fights.
2. **Discovery is a mode, not a tutorial.** Finding a new valid tessellation
   should feel like discovering a species.
3. **Readable, deterministic battles.** A player should always be able to see
   who is winning and why. Determinism enables replays and async duels.

## 2. Modes

### 2.1 Skirmish (core)

The primary mode. Two tessellations (player vs AI, or player vs player) are
seeded onto a field and grow at a fixed tick. Conflicting claims destroy the
losing cell. Stats that matter: **growth speed**, **maximum extent / footprint
density**, and (later) which cell roles a tessellation contains.

- Win conditions: eliminate the enemy's core, control the majority of the field,
  or reach a target first.
- Field objectives / terrain create chokepoints so positioning matters.

### 2.2 Survival

Mechanically a variant of skirmish against an AI or a static enemy pattern that
grows on a scripted schedule. Cheap to build once skirmish exists; good for
single-player progression and teaching counter-patterns.

### 2.3 Lab (collection)

The discovery loop and the content pipeline.

- The player places/removes cells on a small grid; the solver continuously
  reports whether the arrangement closes into a valid tessellation and what its
  neighbours are.
- Valid discoveries are **canonicalised** (up to translation, rotation,
  reflection) and added to a collection.
- The collection is organised into **categories** (e.g. by symmetry group,
  number of orientations, lattice type, tile size). The goal is to find every
  tessellation in a category.
- Collected tessellations are saved as data and become playable units in
  skirmish/survival.

### 2.4 Zen / garden (later, cheap)

Pure aesthetic sandbox: grow patterns with no opponent, export/share them.
Directly leverages the visual identity of two lattices overlapping.

### 2.5 Puzzle (optional)

Only if a genuinely interesting constraint appears. Candidate: "create a valid
tessellation using this exact tile set" or "tile this bounded region." Not in
scope until the solver + lab exist.

### 2.6 Async duel (later)

Because the sim is deterministic, players can submit a tessellation and a
strategy, and the match replays on a fixed seed. Great fit for a web game and
server-cheap.

## 3. Core mechanics

### 3.1 Growth, claim, destroy

- The world is a grid of cells with an owner id and a cell state.
- Each tick, every tessellation expands into adjacent unowned cells according to
  its pattern, limited by its **energy budget**.
- A claim on an occupied enemy cell destroys that cell instead of converting it
  (initial rule). This makes fast, thin patterns a legitimate counter to large
  slow ones.
- Later: **severing**. Destroying a bridge disconnects a region; disconnected
  regions either die or become independent growers. This is the anti-snowball
  tool and makes topology matter.

### 3.2 Tempo and trade-offs

- **Energy / growth budget** per tick, so "fast and thin" vs "slow and dense" is
  a real choice.
- **Maximum extent** so a pattern cannot grow forever unopposed.

### 3.3 Cell roles (iteration 2)

Once the base loop is fun, add role variety so battles have counterplay:

- `spreader` (default growth), `wall` (blocks), `cutter` (severs), `converter`
  (turns enemy cells), `core` (must be protected).

### 3.4 Determinism

Fixed simulation tick, seeded RNG, and an explicit, total ordering for
simultaneous claims. Rules must never depend on frame rate.

## 4. Technical architecture

### 4.1 Stack

- **TypeScript + Vite** (`web/`), dev server on port **5273**.
- **WebGPU** for rendering and GPU batch work. WGSL shaders.
- **No game framework.** Custom renderer over a single storage buffer; add
  instanced tile rendering later for art.
- **`puppeteer-core` + headless Brave** for GPU verification (`npm test`).
- **Steam path:** wrap the web build in Electron/Tauri later. Keep game logic in
  a portable `core`-style layer; WGSL ports cleanly to native `wgpu` if needed.

### 4.2 Module layout (target)

```
web/src/
  core/       vec2, lattice, D4 group, bit ops, rng, fixed-point helpers
  model/      ShapeDef, TessellationDef, Placement, serialization
  solver/     CPU reference validator + enumerator
    gpu/      compute kernels + host wrappers for batch validation
  sim/        WorldGrid, growth, claim, cut, rules, tick loop
  render/     grid renderer, camera, palette, overlays
  game/       mode state machines: skirmish, survival, lab
  ui/         minimal HTML/overlay UI
  gpu/        device, pipeline/buffer helpers (already exists)
  shaders/    WGSL (auto-discovered and compiled by verify:wgsl)
  diag.ts     diagnostics for headless tests
  main.ts     bootstrap
```

### 4.3 The world contract (keep stable)

The world is one `u32` per cell in a storage buffer, indexed `y * width + x`.
`grid.wgsl` writes it and `render.wgsl` reads it. Finalised bit layout (M3,
see `web/src/core/cell.ts`):

```
bits  0..7   owner id        (0 = unowned, 1 = Lab, 2/3 = players)
bits  8..10  orientation     (D4 index, for tile shading)
bit   11     shade           (alternates neighbouring tile instances)
bits 12..15  role            (1 = core)
bits 16..31  tile tag        (per-tile id, for boundary drawing)
```

(The tag lets the renderer outline tiles even when they share owner and
orientation, so 1x1 tilings and multi-symmetry tilings are both legible. The
HUD has **Borders** and **Symmetry** toggles for this.)

Keep the buffer `u32`-per-cell so it can grow into this without a rewrite.

### 4.4 Data model — `TessellationDef`

A tessellation is a lattice plus a set of placements:

- `ShapeDef`: tile mask (small bit grid), its symmetry group (a subgroup of D4).
- `Placements`: for each orientation, an offset within the fundamental cell. All
  instances of one orientation form a coset `offset_o + L`.
- `NeighbourRules`: for each orientation, the set of touching neighbours as
  `(relative cell, orientation)` pairs — the "per-orientation grids + offset
  set" idea from Phase 0, cleaned up.
- `metadata`: canonical id/hash, category tags, names.

Everything serialises to JSON so the Lab can save discoveries and the battle
mode can load units without running the solver.

### 4.5 Solver — correct first, fast second

1. **CPU reference** in `solver/`: given a shape + candidate lattice + offsets,
   verify (a) no overlaps, (b) full coverage of the fundamental domain, (c) all
   touching rules satisfied. Small, readable, unit-tested with `node --test`.
2. **Enumeration:** search candidate basis vectors / offsets in increasing size,
   canonicalising results to dedupe.
3. **GPU batch path:** rasterise candidate placements into occupancy bitmasks and
   test overlaps with shifted `AND` + `popcount`, and coverage with `OR`. The GPU
   validates millions of candidates in parallel; the CPU reference is the oracle
   that proves the GPU is right.

This is the main reason WebGPU was chosen. It will be added only after the CPU
validator is trusted.

### 4.6 Rendering

- Start: one cell = one pixel-ish quad from the world buffer (already working).
- Later: camera (pan/zoom), palettes keyed by owner/role, and instanced crisp
  tile art.
- Overlays: claim fronts, severed regions, selection, solver previews in the Lab.

### 4.7 Verification & workflow

- `npm test` = `build` + `verify:wgsl` + `smoke:browser` (headless Brave).
- New CPU modules get `node --test` unit tests, added to the `test` chain.
- Per repo policy: **commit, never push**; run the checks before committing.

## 5. Milestones

- **M0 — Scaffold & GPU pipeline.** ✅ WebGPU device, world storage buffer,
  compute + render passes, headless verification (`npm test` green).
- **M1 — Model + CPU solver + first real tiling.** `TessellationDef`, CPU
  validator with tests, canonicalisation. Render an actual tessellation instead
  of the placeholder pattern.
- **M2 — Lab v1.** Click to add/remove cells, live validity feedback, save/load
  discoveries as JSON, a simple collection list.
- **M3 — Simulation core.** ✅ Packed cell format, growth/claim/destroy tick
  loop, determinism + tests. Two hardcoded tessellations fighting on a field.
- **M4 — Skirmish v1.** Camera, HUD (energy, extent), win/lose conditions, a
  basic AI opponent.
- **M5 — Lab collection.** Categories, discovery tracking, using collected
  tessellations as loadout.
- **M6 — Survival.** Scripted/expanding enemy patterns and progression.
- **M7 — GPU solver batch path.** Port the hot overlap/coverage checks to
  compute, validated against the CPU oracle.
- **M8 — Polish & packaging.** Audio, accessibility, Electron/Tauri wrap for
  Steam, save data.
- **Later:** severing, cell roles, zen mode, async duel, puzzle mode.

## 6. Open questions / risks

- **Claim resolution.** Attacker-wins is simple; do we need per-cell strength or
  a total order to avoid unfair simultaneous ties?
- **Coverage semantics.** Must a valid tessellation cover the *whole* plane, or
  just a bounded fundamental domain? This changes the solver's acceptance test.
- ~~**Canonicalisation.** Exact hash for "same tessellation up to symmetry" —
  needed for collection and dedupe.~~ Done: `solver/symmetry.ts` finds the
  primitive translation lattice, so supercell descriptions of one tiling
  collapse, and tile classes are read off the tiling's symmetry group.
- **Growth model.** Does a pattern grow only from its frontier (geometric), or
  does it spend energy to place shapes (economic)? The second is more game-like.
- **Scale.** Field size and tick rate that keep battles readable while still
  letting GPU advantages matter.
- **Art direction.** Flat, high-contrast colors are readable and cheap; tile art
  is prettier but risks muddying the "who owns what" read.
- **Fun check.** The snowball problem is the biggest design risk: growth +
  first-touch-wins can become a runaway. Severing and energy budgets are the
  planned answers; validate them early (M3/M4), not at polish.

## Progress log

- **M0 — done.** WebGPU device, world storage buffer, compute + render passes,
  headless verification (`npm test` green).
- **M1 — done.** `core/` (`vec2`, `D4`), `model/` (`ShapeDef`,
  `TessellationDef`, builtins, JSON), `solver/` (exact-tiling validator and
  canonical signature), CPU unit tests via `node --test` (`npm run test:unit`),
  and the L-tromino brick rasterised from the model and rendered in place of the
  placeholder pattern. Open follow-ups: a general lattice canonical form, and a
  richer multi-orientation example once the enumerator exists.
- **M2 — done (Lab v1).** `solver/find.ts` searches lattices (compact first)
  for exact tilings of a drawn shape using exact cover; `lab/labPanel.ts` adds
  the draw grid, live previews, selection, and export/import;
  `lab/collection.ts` persists discoveries (keyed by canonical signature) in
  localStorage. The headless smoke test drives the Lab (`window.__tsaLab`) and
  asserts it finds and saves a tiling. The world view gained zoom and
  lattice-parity shading. Follow-ups: naming/renaming discoveries, categories,
  and a Web Worker so larger searches stay off the main thread.
- **M3 — done (simulation core).** `core/cell.ts` finalises the packed `u32`
  world format. `sim/world.ts` wraps the buffer; `sim/grow.ts` derives each
  tessellation's tile-instance adjacency graph; `sim/battle.ts` floods it one
  tile layer per tick and resolves all claims simultaneously (lone claims take
  the cell, simultaneous claims raze it). Growth is deterministic and covered by
  unit tests; the headless smoke test runs two tessellations for 60 ticks twice
  and asserts identical results and a contested front. The app gained a
  **Battle** mode (CPU sim uploaded each tick). The cell format gained a
  per-tile tag so the renderer can outline tile boundaries, and the HUD has
  **Borders** and **Symmetry** toggles. Follow-up (same milestone):
  `solver/symmetry.ts` now computes each tiling's translation lattice, point
  symmetries and tile **orbits**, giving a correct canonical signature (dedupe)
  and a true per-tile symmetry class, which the Lab colours and reports. The
  finder now keeps only **single-orbit** tilings (all tiles
  symmetry-equivalent) and orients each result so the drawn shape appears, at
  the origin, in the orientation it was drawn. Dedupe was then rewritten to
  canonicalise the tiling's **cell sets** (not orientation labels, which are
  ambiguous for a shape with its own symmetry, and which lose each tile's phase
  within the fundamental domain). The finder also generates one orientation per
  shape-symmetry class. Also added `shapeOrientationCount` (a shape's D4 orbit
  size, shown under the Lab drawing) and `wallpaperGroup` (accurate
  square-lattice wallpaper symbol per result, from the point group + lattice
  metric + mirror/glide test). Follow-ups from the design doc: energy budgets,
  max extent, and the anti-snowball severing mechanic.
