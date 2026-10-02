# Progression mode — design & implementation plan

## 0. Is the mode clear?

Yes. It is a good idea, and the important news is that the solver we already
have supports it almost directly. Read back in my words:

- A **level** is one tile (a polyomino). The board is a window on the plane.
- The level's **target** is the set of all distinct tessellations of that tile —
  the same canonical set the encyclopedia counts.
- The player grows a tiling by placing copies of the tile, **edge-connected** to
  the cluster, in any D4 pose.
- The game continually shows the parts of the tiling that are **forced** by the
  placements so far.
- A placement that cannot be part of any target tessellation is an error:
  message + revert to the previous safe state.
- Pinning down exactly one tessellation **discovers** it. Collect them all to
  advance to the next shape.

There are four things to nail down first (see §2); none are blockers.

## 1. The one correction to the mental model

The mirror example ("place a mirrored L next to the centre, so the whole plane
mirrors across that axis") suggests the game *detects a symmetry* and reflects
it. That is a real and satisfying case, but it is a **special case** of a
simpler and fully general rule:

> Keep the set of target tessellations still consistent with everything placed
> so far. Reveal every cell that **all** of them agree on.

This is exact (no symmetry heuristics), it produces the mirror fill-in as a
byproduct, and it also reveals forced cells that have no symmetry at all —
which a symmetry-only rule would miss. I verified it against the real solver on
the L-tromino:

- L-tromino has **12** tessellations in our canonical set.
- There are **26** distinct legal second-tile placements (edge-adjacent, no
  overlap).
- Placing **one** of 8 of them collapses 12 → **1** candidate — the whole visible
  plane fills in immediately. The others leave 2–5 candidates.
- The same lattice can host several different tilings (`#3 p2` and `#4 cm` share
  a basis), so "the lattice is fixed" does **not** mean "the tiling is fixed".
  The candidate model gets this right; a lattice-only model would not.

So: implement **constraint propagation over candidate tilings**, not symmetry
detection. The user-facing feel is exactly what you described.

## 2. Rules to lock down

1. **Growth rule.** "Each placed shape touches an edge of the centre shape" is
   ambiguous. Taken literally it forbids growing outward. Recommendation: each
   new tile must share an edge with an **already-placed** tile (cluster-
   connected). A "must touch the centre" restriction can be an optional hard
   mode later.
2. **Placement** = (orientation, offset), orientation a representative D4 pose
   (`uniqueOrientations`), offset ∈ Z². The seed is fixed at (identity, offset 0).
3. **Legality:** edge-connected to the cluster, no overlap with placed tiles,
   and contained in at least one remaining candidate.
4. **Candidate pool:** target tessellations that contain every placed tile as an
   exact tile.
5. **Forced vs possible:** a cell is *forced* if every remaining candidate covers
   it; *possible* if at least one does. A whole tile is forced when every
   candidate places the same pose there.
6. **Impossible:** pool becomes empty → reject + revert. (Complete: any tiling
   consistent with the new placement is consistent with all previous ones, so it
   would already be in the pool.)
7. **Discover:** pool size == 1. Record it, remove from the target set, reset the
   board to the seed.
8. **Distinctness:** exactly the encyclopedia's set — translation + D4 quotient,
   supercell-collapsed, single-orbit. Same code → same numbers.

## 3. Core algorithms (pure, CPU, trivially fast)

- `containsTile(def, orientation, offset)` — a def contains the tile iff all its
  cells map through the existing `tileAt` to one instance and the cell count
  matches the shape. (Validated in a scratch run.)
- `filterCandidates(pool, placement)`.
- `forcedCells(pool, region)` / `possibleCells(pool, region)`.
- `nextPlacements(pool, placedCells)` — legal follow-ups (for ghost legality and
  hints).
- `isSolved(pool)`.

Cost is O(pool × tiles × cells); pools are ≤ a few hundred, windows ≤ ~1k cells,
so everything is sub-millisecond on the CPU. **No GPU work is needed** — this is
game logic, not a hot loop.

## 4. Modules & files

New `src/prog/`:

| file | responsibility |
| --- | --- |
| `types.ts` | `Level`, `Placement`, `ProgState` |
| `puzzle.ts` | the pure algorithms above (unit-tested) |
| `levels.ts` | ordered levels from free polyominoes; tiling counts; skip non-tilers |
| `progress.ts` | persistence: `tsa.prog.v1` (discovered signatures, current level) |
| `progression.ts` | mode controller: state machine, input, undo stack, board buffer |

Existing files to touch:

- `core/cell.ts` — add progression owner ids (`SEED`, `PLACED`, `FORCED`,
  `GHOST`) and any roles needed.
- `shaders/render.wgsl` — a branch for the progression owners (seed ring, bright
  placed, dimmed forced, faint possible).
- `gpu/gridScene.ts` — add `screenToCell(clientX, clientY)`, the inverse of the
  letterbox + zoom camera, for pointer input.
- `main.ts` / `index.html` — a fourth mode ("Play") plus an `aside#prog` panel.

## 5. Board & rendering

- A focused square window (e.g. 17×17 or 21×21) centred on the seed, rendered
  through `GridScene` zoomed in. Compute forced/possible over just that window
  and stamp the region into the existing 256×256 world buffer.
- Cell appearance: **seed** gold, **placed** bright (orientation palette),
  **forced** dimmed auto-fill, **possible** faint outline, **empty** background.
  Turn tile borders on.
- Motion: forced cells bloom outward from the newly placed tile; on discovery the
  tiling sweeps across the board and the thumbnail flies into a gallery slot.

## 6. Input / UX

- **Brush placement.** The shape follows the pointer as a ghost; `R` / `Shift+R`
  (or scroll) rotates, `F` flips, click places. Ghost is green when legal, red
  when not, and shows the pruning it would cause: `12 → 3 tilings`.
- Keyboard: `Z` undo, `Esc`/right-click remove last, `Tab` toggle panel.
- A simpler fallback if the brush is fiddly: click an empty cell beside the
  cluster; if several poses fit, click again / right-click to cycle.
- **Revert** is just undo with a toast: "No tiling can contain that — reverted."

## 7. Target gallery (side panel)

- One slot per target tessellation, grouped by wallpaper group. Found slots show
  a thumbnail + group; unfound show a `?` (optionally the group name as a hint).
- `x / N found` progress and the current shape preview.
- Compute N and the groups from `findTessellations` (same options as the
  encyclopedia) and cache per shape.
- Clicking a found slot opens it full-board / in the existing viewer.

## 8. Progression & persistence

- Level order: size ascending; within a size, tiling-count ascending (easiest
  first). Skip shapes with 0 tilings (show as "does not tile").
- Auto-advance when a shape is complete; a map screen lists every level with
  completion stars.
- `tsa.prog.v1` stores discovered signatures per shape and the current level.
  "Reset level" clears one; "Reset all" clears the file.

## 9. Milestones

- **P1 — puzzle core.** `puzzle.ts` + tests: filtering, forced/possible,
  `containsTile`. Property test: a randomly placed tile is accepted only if some
  target contains it; replay the L-tromino's 12.
- **P2 — playable mode.** Board window, cell states, seed, click/brush
  placement, undo + revert, discovery detection. Playable from the unit square
  through the trominoes.
- **P3 — collection.** Target gallery, progression, persistence, map.
- **P4 — juice.** Pruning readout, ghost legality/outcome preview, animations,
  the "why this tiling" line.
- **P5 — polish.** Optional hint economy, sound, achievements, and the viewer.

## 10. Improvements to make it more fun

1. **Show the pruning live** (`12 → 3 → 1`). Deduction games live on seeing the
   consequence of a move; this is the single biggest win.
2. **Render possibility, not just certainty.** A faint "could still be here"
   layer makes the frontier legible and teaches the underlying maths.
3. **Hover preview of the outcome.** Show the forced pattern a candidate move
   *would* create, so the player can set up the "lock-in" shot.
4. **Group slots by wallpaper group / lattice.** Reveals structure ("this tile
   tiles in several distinct lattices") and creates natural sub-goals. The
   group label on unfound slots is a good adjustable hint dial.
5. **Big reveal.** The moment a tiling locks should be a real reward.
6. **Efficiency scoring.** Placements-to-discover, a par, a "no-undo" bonus — a
   personal best that doesn't punish exploration.
7. **A hint escape hatch** (off by default): reveal one legal placement or one
   target, so a stuck player can keep moving.
8. **Explain the why.** On discovery: "p4 — your placements forced a 90°
   rotation about the seed." Ties this mode to the guide and encyclopedia.
9. **Anti-grind by design.** Because one placement often locks a tiling, a
   20-tiling shape is ~20 short puzzles, not 20 full builds. Keep the board
   reset instant.
10. **Two-tier completion.** Required = one tiling per wallpaper group; optional
    = the full set for completionists. Preserves the stated goal without a wall
    at the biggest shapes.

## 11. Open questions for you

1. Growth rule: cluster-connected (recommended) or must-touch-the-centre?
2. Should unfound slots show their wallpaper group as a hint, or stay blank?
3. Goal per shape: every tiling, or every wallpaper group (with the rest
   optional)?
4. Board window size — how much of the plane do you want visible at once?
