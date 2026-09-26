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
  model/
    shape.ts          ShapeDef (a tile's cells)
    tessellation.ts   TessellationDef, lattice maths, rasteriser, JSON
    builtins.ts       example tessellations
  solver/
    validate.ts       exact-tiling validator
    canonical.ts      symmetry/translation-invariant signature
  gpu/
    device.ts         adapter/device/context setup + canvas resize
    gridScene.ts      world-grid buffer, compute + render passes, setCells()
  shaders/
    grid.wgsl         per-cell update kernel (placeholder; the sim takes over in M3)
    render.wgsl       draws the grid (palette keyed by tile orientation)
scripts/
  verify-wgsl.mjs     headless shader compile check
  browser-smoke.mjs   headless end-to-end run + console capture
  browser-path.mjs    locate a Chromium-family binary
```

CPU unit tests live next to their modules as `*.test.ts` and run under Node's
`--experimental-strip-types` (no test framework dependency).

## Current contract

The world is one `u32` per cell in a storage buffer, indexed `y * width + x`.
`render.wgsl` reads it; a labelled cell holds `orientation + 1` (0 = unowned).
In M1 the CPU rasterises a `TessellationDef` and uploads it with
`GridScene.setCells`; the compute kernel (behind `simEnabled`) takes the buffer
back over in M3.

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

Next: `sim/` (growth/claim/cut, fixed timestep) and a first `game/` skirmish
loop — the M2/M3 work in `plans/phase1.md`.

## Notes

- Packed cell format (owner, type, hp, age) is not decided yet. Keep the buffer
  `u32` per cell so it can grow into that.
- Rendering the whole grid via a storage buffer scales to millions of cells;
  instanced shape rendering can come later for crisp tile art.
