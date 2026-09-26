# CLAUDE.md

Guidance for AI coding agents working in this repository. Follow it unless the
user explicitly says otherwise.

## What this repo is

An investigation into tessellation and symmetry, being turned into a game.

- **`web/` — the active project.** TypeScript + WebGPU + Vite, rebuilt from
  scratch. All new work happens here.
- **`src/` — the original Java prototype. Reference only.** Do not build on it or
  modify it unless the user explicitly asks. It is useful for understanding the
  group-theory and tessellation ideas.
- `HEADLESS_BRAVE_WGSL.md` — recipe for headless WebGPU verification.

## Ground rules

1. **Commit, never push.** After completing a unit of work, make a git commit.
   Do **not** `git push`, force-push, or rewrite history — pushing is the user's
   job after they have verified the work.
2. **Commit only your own work.** Don't sweep unrelated or user-authored
   uncommitted changes into your commit.
3. **Run the checks before committing.** From `web/`:
   - `npm test` — build + WGSL compile + headless GPU smoke test.
   - A green `npm test` is required before you commit. If it cannot run in the
     current environment, say so explicitly; never claim success you did not
     observe.
4. **Never silently skip verification.** A missing browser or GPU adapter must be
   a loud failure, not a pass.
5. **Ask before adding dependencies or making large architectural changes.**
6. **Don't commit generated artifacts** (`node_modules/`, `dist/`); they are
   gitignored.
7. Keep changes scoped. Don't reformat files unrelated to the task.

## `web/` quick reference

- Dev server port: **5273** (`web/vite.config.ts`).
- Commands:
  - `npm run dev` — vite dev server
  - `npm run build` — `tsc` typecheck + vite build
  - `npm run verify:wgsl` — compile every `src/shaders/**/*.wgsl` in headless Brave
  - `npm run smoke:browser` — build + run the app headlessly, read `window.__tsaDiag`
  - `npm test` — build + `verify:wgsl` + `smoke:browser`
- Browser resolution lives in `scripts/browser-path.mjs`; override with
  `BROWSER_PATH=/path/to/brave` (Brave is preferred on Windows).
- Diagnostics live in `src/diag.ts` and are published to `window.__tsaDiag` and
  a hidden `#diag` element for the smoke test / DOM dumps.

## WebGPU gotchas learned here

- **WebGPU requires a secure context.** `about:blank` has an opaque origin in
  Brave where `navigator.gpu` is `undefined`. Always test against
  `http://localhost`; `verify-wgsl.mjs` spins up a throwaway localhost server.
- Headless Chromium may need `--enable-unsafe-webgpu` and
  `--enable-unsafe-swiftshader`; this repo passes both (software fallback when no
  hardware adapter exists).
- Use `puppeteer-core` with `pipe: true` and `headless: true` for reliable
  launches; don't assume `createShaderModule` threw — read
  `module.getCompilationInfo()` for real diagnostics.

## Architecture (current contract)

- The world is a storage buffer of one `u32` per cell, indexed `y * width + x`.
  `src/shaders/grid.wgsl` writes it; `src/shaders/render.wgsl` reads it. Keep
  this seam stable.
- `grid.wgsl` currently paints a placeholder pattern; the real solver/sim will
  replace its body.
- Planned modules: `solver/` (validation/enumeration — CPU reference first, then
  a GPU batch path), `model/` (serializable `TessellationDef`), `sim/`
  (growth / claim / cut rules).

## Shader workflow

- Add WGSL under `web/src/shaders/`; `npm run verify:wgsl` discovers and compiles
  each file as its own module.
- Compile what you ship: the verify script reads the same files Vite serves via
  `?raw`, so there is a single source of truth.

## Commit style

- Short, lowercase, imperative summaries, matching the existing history, e.g.
  `add webgpu grid renderer`.
- Commit only after `npm test` passes, and only changes relevant to the task.
