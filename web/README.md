# Tessellating Shape Automaton — web

WebGPU + TypeScript rebuild. The old Java code in `../src` is kept as a
reference for the group-theory ideas, but nothing here depends on it.

## Run

```bash
npm install
npm run dev              # vite dev server on http://localhost:5273
npm run build            # typecheck + production build

npm test                 # build + compile WGSL + headless GPU smoke test
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
  gpu/
    device.ts         adapter/device/context setup + canvas resize
    gridScene.ts      world-grid buffer, compute pass, render pass
  shaders/
    grid.wgsl         per-cell update kernel (placeholder for the sim/solver)
    render.wgsl       draws the grid
scripts/
  verify-wgsl.mjs     headless shader compile check
  browser-smoke.mjs   headless end-to-end run + console capture
  browser-path.mjs    locate a Chromium-family binary
```

## Current contract

The world is one `u32` per cell in a storage buffer, indexed `y * width + x`.
`grid.wgsl` owns writing it; `render.wgsl` owns reading it. This is the seam the
real model plugs into.

The compute kernel is currently a placeholder pattern. The next pieces to add:

1. **`solver/`** — pure TS tessellation validation / enumeration (group theory,
   symmetry transforms, overlap checks). CPU first; move the hot overlap checks
   to a compute kernel once the data model is stable.
2. **`model/`** — `TessellationDef` (shape mask, symmetry group, relative rules,
   offsets), serializable to JSON.
3. **`sim/`** — growth/claim/cut rules over the grid, fixed timestep.

## Notes

- Packed cell format (owner, type, hp, age) is not decided yet. Keep the buffer
  `u32` per cell so it can grow into that.
- Rendering the whole grid via a storage buffer scales to millions of cells;
  instanced shape rendering can come later for crisp tile art.
