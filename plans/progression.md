# Progression mode — design & implementation plan

## 0. What it is

A level is one tile (a polyomino) and its **target** is the set of *all* distinct
tessellations of that tile (the same canonical set the encyclopedia counts). The
player places copies of the tile in any D4 pose, anywhere on the board, and the
game continually shows the part of the tiling those placements **force**. A
placement that cannot belong to any remaining target is rejected with a message
and reverted. Pinning the targets down to a single tessellation **discovers**
it; find them all to finish the shape, then move up to the next size.

## 1. The core rule (the one correction to the brief)

The mirror example suggests "detect a symmetry and reflect it". That is a special
case of a simpler, fully general rule:

> Keep the set of target tessellations still consistent with everything placed,
> and reveal every cell that **all** of them agree on.

This is exact, needs no symmetry heuristics, produces the mirror fill-in as a
byproduct, and also reveals forced cells with no symmetry. Verified against the
real solver on the L-tromino:

- 12 tessellations, 26 legal second-tile placements.
- 8 single placements collapse 12 → **1** (the whole board fills at once);
  others leave 2–5.
- `#3 p2` and `#4 cm` share a lattice, so "lattice fixed" ≠ "tiling fixed".

## 2. Locked decisions

1. **Free placement.** Tiles may be placed anywhere on the board (no edge-
   adjacency requirement).
2. **Goal per shape: every tiling.** No two-tier mode.
3. **Legality:** no overlap with placed tiles, and contained in ≥1 remaining
   target. Anything else is rejected + reverted.
4. **Candidate pool** = targets containing every placed tile as an exact tile.
5. **Forced** cell = covered by every candidate; **possible** cell = covered by
   some. A whole tile is forced when every candidate places the same pose there.
6. **Impossible:** pool empties → message + revert.
7. **Discovery:** pool size == 1 → record, animate, reset to the seed.
8. **Distinctness:** exactly the encyclopedia's set (translation + D4 quotient,
   supercell-collapsed, single-orbit).
9. **Gallery** groups slots by **wallpaper group**.
10. **Window size scales with shape size** so several lattice cells are visible.
11. **Possibility layer** is a **hint** toggle (off by default) — it muddies the
    view if always on.
12. **Hover outcome preview** belongs to an **easy mode**; **hard mode** shows no
    previews (legality feedback only).
13. **Live pruning readout** (`12 → 3 → 1`) in easy mode.

## 3. Feel & animation (locked)

- **Placing a tile grows the tiling as a wave.** The cells that become forced are
  revealed **nearest-first from the placed tile outward**, so you watch the
  pattern spread in front of you.
- **On discovery, a zoom-out reveal.** The fully-constrained tiling is rasterised
  across the whole world grid, the camera zoom pulls back to show the infinite
  pattern (hold), then returns to the seed for a fresh round.

## 4. Core algorithms (pure CPU)

- `containsTile(def, shape, placement)` — cells map through the existing `tileAt`
  to one instance and the count matches the shape.
- `filterCandidates(pool, shape, placement)`.
- `tileKeyAt(def, local)` — the cell-set key of the tile covering a local cell.
- forced / possible / solve tests. O(pool × tiles × cells); pools ≤ a few
  hundred, so sub-millisecond. **No GPU compute needed.**

## 5. Modules & files

New `src/prog/`:

| file | responsibility |
| --- | --- |
| `types.ts` | `ProPlacement`, `Level` |
| `puzzle.ts` | pure candidate ops (unit-tested) |
| `levels.ts` | ordered levels from free polyominoes; `computeTargets` |
| `progress.ts` | persistence `tsa.prog.v1` |
| `progression.ts` | controller: input, waves, reveal, gallery, level flow |

Touched: `core/cell.ts` (owner ids), `shaders/render.wgsl` (progression colours),
`gpu/gridScene.ts` (`screenToCell`), `index.html` (+ Play mode & `aside#prog`),
`main.ts` (wiring), `scripts/browser-smoke.mjs`.

## 6. Board, window & rendering

- World grid stays 256×256; the seed sits at the centre. The **play radius**
  scales with the shape, e.g. `R = max(4, 2·span, span + cells) + 2` where `span`
  is the bounding-box side — enough to see several lattice cells.
- Play zoom = `width / (2R + 1)`.
- Owners: `SEED` (gold), `PLACED` (orientation palette), `FORCED` (dimmed
  auto-fill), `GHOST` (hint: possible), `CURSOR`/`BAD` (brush preview).
- Borders on for readability. Hint layer off by default.

## 7. Input / UX

- **Brush:** the tile follows the pointer; `R`/`Shift+R` (or scroll) rotates, `F`
  flips, click places, right-click/`Esc` removes the last, `Z` undoes.
- On-screen buttons mirror rotate / flip / undo / reset / hint.
- **Easy mode:** hovering shows the forced pattern the move *would* create and the
  pruning it causes. **Hard mode:** only green/red legality, no forecasts.
- Revert = undo + toast: "No tiling can contain that — reverted."

## 8. Target gallery

- One slot per target tiling, **grouped by wallpaper group**; found slots show a
  thumbnail + group, unfound show a `?`. Progress `x / N`.
- Click a found slot to view it full-board.
- Targets computed per level via `findTessellations` (same options as the
  encyclopedia) and cached in memory + save.

## 9. Progression & persistence

- Levels: free polyominoes by size ascending, canonical order within a size.
- `tsa.prog.v1` holds the current level index and, per level, the discovered
  target signatures. `Reset level` clears one; `Reset all` clears the file.
- On entering a level, recompute its targets and mark found ones.

## 10. Milestones

- **P1 — puzzle core** (this pass): `puzzle.ts` + tests; levels; progress store.
- **P2 — playable** (this pass): board, brush, placement, revert, wave, reveal,
  gallery, persistence, Play mode wiring.
- **P3 — polish:** easy/hard toggle, pruning readout, hint layer, full-board
  viewer, map screen.
- **P4 — juice & content:** sound, achievements, shapes of the week, larger sizes.

## 11. Fun improvements (status)

1. Live pruning readout — **planned (easy mode)**.
2. Possibility layer — **planned as a hint toggle**, off by default.
3. Hover outcome preview — **planned as easy mode**; hard mode has none.
4. Group slots by wallpaper group — **locked in**.
5. Big reveal — **locked in**: wave + zoom-out.
6. Efficiency scoring — planned for P3.
7. Hint economy — folded into the hint toggle.
8. "Explain the why" line on discovery — planned for P3.
9. Anti-grind — inherent: single placements often lock a whole tiling.
10. Two-tier completion — rejected in favour of all tilings.
