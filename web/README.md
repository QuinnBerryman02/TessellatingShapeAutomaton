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
    symmetry.ts       tiling symmetry group, tile orbits, canonical signature
    canonical.ts      re-exports the canonical signature
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
bits 16..31  tile tag      (per-tile id, for drawing boundaries)
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

### Symmetry and equivalence (`solver/symmetry.ts`)

A tiling is a **set of tile cell-sets**, periodic under a **translation
subgroup** L* — a sublattice of Z², possibly coarser than the basis the tiling
was described with. The analysis finds L* by testing translation candidates
against the cell sets, reduces it to a Hermite basis, and then finds the point
symmetries (a D4 element plus an integer translation).

The whole analysis works on **cell sets, not orientation labels**. That matters
in two ways: a shape that is itself symmetric (e.g. 180°-rotational) can write
the same tile with different labels, and a tile's *phase* within the fundamental
domain is only stored by its actual cells, not by their residues modulo L*.

- **Dedupe.** `canonicalSignature` is built from the tiles' cell sets on L*,
  minimised over the choice of origin and the eight square symmetries. Two
  descriptions of one tiling — a supercell, a different orientation label, or a
  translated copy — therefore collapse to a single result.
- **Tile classes.** Tiles fall into **orbits** under the symmetry group. Two
  tiles in different orbits are the same shape but not symmetry-equivalent
  (the game's "two shape tessellations"); within an orbit the D4 part of a
  symmetry carrying the reference tile to a tile is its **class**.
- **Shape symmetry.** `shapeSymmetryGroup` gives the D4 elements that fix a
  shape up to translation, and `shapeOrientationCount` is the size of the
  shape's D4 orbit, `8 / |group|` (e.g. L-tromino 4, square 1, an asymmetric
  tetromino 8). The finder generates one orientation per class, so a
  180°-symmetric shape does not produce doubled solutions.
- **Wallpaper group.** `wallpaperGroup` names the tiling's symmetry group.
  Because the tiles live on Z² only the square-lattice symbols are reachable
  (p1, p2, pm, pg, cm, pmm, pmg, pgg, cmm, p4, p4m, p4g): the point group and
  the lattice metric choose the family, then a mirror-vs-glide test on each
  reflection's translation separates the rest (e.g. pm from pg, pmm/pmg/pgg,
  p4m from p4g). The Lab
  shows the tile's orientation count under the drawing and each result's
  wallpaper symbol, and the main HUD repeats them for the selected tiling.

## Lab (M2)

`LabPanel` is the discovery loop. Draw a tile on the 14×14 grid and
`findTessellations` searches small lattices for exact tilings of that shape,
reporting compact ones first. Results appear as live previews; clicking one
renders it in the main view. Discoveries are stored in `Collection`
(localStorage) keyed by the canonical signature, and export/import as JSON.

The finder orders lattices by covolume, works modulo the lattice, and solves an
exact cover of the residue cells with tile placements (backtracking). Every
solution is re-validated and canonicalised before it is shown.

Two presentation rules (`FindOptions`):

- **Single orbit only** (default): tilings whose tiles fall into more than one
  symmetry orbit are dropped, since they contain the same shape in
  non-equivalent positions. Pass `singleOrbitOnly: false` to keep them.
- **Drawn orientation at the origin**: each result is re-expressed so a tile in
  the as-drawn orientation sits at the origin. Rotating/translating a tiling is
  only a change of description, but this makes every result directly
  comparable.

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

### View toggles

The HUD has two render toggles that work in every mode:

- **Borders** draws a thin dark outline between cells whose *tile tag* differs,
  so the actual tile shapes (not just the owner regions) are visible — including
  a 1×1 tiling's grid. The tag is written per tile by both the rasteriser and
  the sim.
- **Symmetry** colours each tile by its class within the tiling: a tone per D4
  symmetry, and a shifted tone base per orbit. In the Lab this shows the
  tiling's *actual* symmetries (a translation-only tiling stays one tone; one
  with a 180° rotation splits into two), and the HUD reports the orbit and
  symmetry-op counts. For battle players it tints each owner's tiles by the
  orientation stored in the cell.

Next: `game/` skirmish state machine, a camera, a HUD, and a basic AI — the M4
work in `plans/phase1.md`.

## Notes

- Rendering the whole grid via a storage buffer scales to millions of cells;
  instanced shape rendering can come later for crisp tile art.
