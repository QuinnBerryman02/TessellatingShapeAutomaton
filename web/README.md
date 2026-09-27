# Tessellating Shape Automaton — web

WebGPU + TypeScript rebuild. The old Java code in `../src` is kept as a
reference for the group-theory ideas, but nothing here depends on it.

## Run

```bash
npm install
npm run dev              # vite dev server on http://localhost:5273
npm run build            # typecheck + production build

npm test                 # build + unit tests + compile WGSL + headless GPU smoke test
npm run test:unit        # fast CPU unit tests (node --test, no browser)
npm run verify:wgsl      # compile shaders in headless Brave (real tint)
npm run smoke:browser    # boot the app headlessly, capture console + errors
```

The dev server uses port **5273** (set in `vite.config.ts`). WebGPU requires a
recent Chrome/Edge/Brave or Safari; on localhost it works without HTTPS.

## Headless GPU verification

`npm test` fails if a shader does not compile or the app cannot bring up a GPU
device, so a WGSL typo can never ship quietly. See
[`../HEADLESS_BRAVE_WGSL.md`](../HEADLESS_BRAVE_WGSL.md) for the recipe.

- `scripts/verify-wgsl.mjs` compiles every `src/shaders/**/*.wgsl` in a real
  headless Chromium via `createShaderModule` + `getCompilationInfo()`.
- `scripts/browser-smoke.mjs` serves the build, runs it, and checks
  `window.__tsaDiag` (adapter, device, completed frames, GPU/console errors).
- `scripts/browser-path.mjs` finds Brave/Chrome/Edge; override with
  `BROWSER_PATH=...`.

**Gotcha:** WebGPU needs a secure context, and `about:blank` has an opaque
origin where `navigator.gpu` is `undefined` in Brave. The scripts serve a page
on `http://localhost` instead.

## Layout

```
src/
  main.ts             bootstrap: device -> scene -> render loop
  diag.ts             diagnostics published to the DOM / window.__tsaDiag
  core/
    vec2.ts           integer vector helpers
    d4.ts             the 8 square symmetries (transforms + group table)
    cell.ts           packed u32 world-cell format (pack/unpack helpers)
  model/
    shape.ts          ShapeDef (a tile's cells)
    tessellation.ts   TessellationDef, lattice maths, rasteriser, JSON
    builtins.ts       example tessellations
  solver/
    validate.ts       exact-tiling validator
    canonical.ts      symmetry/translation-invariant signature
    find.ts           search for lattice tilings of a drawn shape
  lab/
    collection.ts     saved discoveries (localStorage + JSON)
    labPanel.ts       draw grid, finder UI, results and collection
  sim/
    world.ts          WorldGrid: packed cells, bounds, ownership counts
    grow.ts           GrowPattern: tile instances + adjacency for growth
    battle.ts         Expander + Battle: growth/claim/destroy tick loop
  gpu/
    device.ts         adapter/device/context setup + canvas resize
    gridScene.ts      world-grid buffer, compute + render passes, setCells()
  shaders/
    grid.wgsl         per-cell update kernel (placeholder; the sim is CPU for now)
    render.wgsl       draws the grid (owner/orientation palette; core highlight)
scripts/
  verify-wgsl.mjs     headless shader compile check
  browser-smoke.mjs   headless end-to-end run + console capture
  browser-path.mjs    locate a Chromium-family binary
```

CPU unit tests live next to their modules as `*.test.ts` and run under Node's
`--experimental-strip-types` (no test framework dependency).

## Current contract

The world is one `u32` per cell in a storage buffer, indexed `y * width + x`.
The CPU simulates it and uploads it with `GridScene.setCells`; `render.wgsl`
reads it. The bit layout lives in `core/cell.ts`:

```
bits  0..7   owner         (0 empty, 1 Lab, 2/3 players)
bits  8..10  orientation   (D4 index, for shading a tile)
bit   11     shade         (alternates neighbouring tile instances)
bits 12..15  role          (1 = core)
bits 16..31  reserved      (integrity / age)
```

Keep it `u32` per cell so the sim can grow into more fields without a rewrite.

## Model & solver (M1)

- A **`TessellationDef`** is a tile shape plus a lattice (`basis1`, `basis2`) and
  a finite **motif** of placements. Every instance is a placement translated by a
  lattice vector.
- **`validateTessellation`** proves the motif tiles the plane exactly. It checks
  that the motif area equals the lattice covolume, then uses difference sets to
  rule out overlaps; together those force a perfect partition.
- **`canonicalSignature`** is invariant under translation and the square's
  symmetries, so a rotated copy is not counted as a new tessellation.

Known limitation: canonicalisation reduces placements modulo the lattice, so it
is exact for the reduced bases used so far but is not yet a general lattice
canonical form.

## Lab (M2)

`LabPanel` is the discovery loop. Draw a tile on the 14×14 grid and
`findTessellations` searches small lattices for exact tilings of that shape,
reporting compact ones first. Results appear as live previews; clicking one
renders it in the main view. Discoveries are stored in `Collection`
(localStorage) keyed by the canonical signature, and export/import as JSON.

The finder orders lattices by covolume, works modulo the lattice, and solves an
exact cover of the residue cells with tile placements (backtracking). Every
solution is re-validated and canonicalised before it is shown.

The world view has a `zoom` uniform (`GridScene.setZoom`) and shades tiles by
lattice parity, so even single-orientation tilings are legible.

## Simulation (M3)

`sim/` is the deterministic battle core, independent of rendering.

- A `GrowPattern` derives a tessellation's **tile-instance adjacency graph**: two
  instances touch when any of their cells are edge-adjacent. Because the tiling
  is periodic, one precomputed rule set covers every instance.
- An `Expander` floods that graph one tile layer per tick from a seed core. The
  frontier is ordered by distance then a canonical key, so the same battle always
  plays out the same way.
- Every tick, all participants submit their claims and `Battle` resolves them
  **together**: a lone claim takes the cell (destroying the previous owner), but
  a cell claimed by several at once is **razed**. That makes the front a
  symmetric no-man's-land instead of rewarding whoever moved last.

Growth is CPU-side for now (still ~10k cells in 60 ticks, fast enough); a GPU
compute path is the M7 batch work. The `Battle`/`Expander` classes are pure TS,
so the tick loop is unit-tested under `node --test`.

Next: `game/` skirmish state machine, a camera, a HUD, and a basic AI — the M4
work in `plans/phase1.md`.

## Notes

- Rendering the whole grid via a storage buffer scales to millions of cells;
  instanced shape rendering can come later for crisp tile art.
