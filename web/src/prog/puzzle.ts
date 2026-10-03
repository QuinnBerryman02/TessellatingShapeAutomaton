import { addVec, keyVec, scaleVec, type Vec2 } from "../core/vec2.ts";
import { transformedCells, type ShapeDef } from "../model/shape.ts";
import type { Placement, TessellationDef } from "../model/tessellation.ts";
import { tileAt } from "../solver/symmetry.ts";
import type { ProPlacement } from "./types.ts";

/**
 * Pure, allocation-light operations for progression mode: reasoning about
 * which target tessellations are still consistent with the player's placements.
 *
 * A placement is a tile at an orientation and integer offset. A tessellation
 * "contains" it when one of its tiles occupies exactly the same cells.
 */

export function placementCells(
  shape: ShapeDef,
  placement: ProPlacement,
): Vec2[] {
  return transformedCells(shape, placement.orientation).map((c) =>
    addVec(c, placement.offset),
  );
}

export function cellsKey(cells: readonly Vec2[]): string {
  return cells.map(keyVec).sort().join("|");
}

/** True when `def` contains exactly this placed tile. */
export function containsTile(
  def: TessellationDef,
  placement: ProPlacement,
): boolean {
  const cells = placementCells(def.shape, placement);
  if (cells.length !== def.shape.cells.length) return false;
  const first = tileAt(def, cells[0]);
  if (!first) return false;
  for (const cell of cells) {
    const instance = tileAt(def, cell);
    if (
      !instance ||
      instance.placement !== first.placement ||
      instance.m !== first.m ||
      instance.n !== first.n
    ) {
      return false;
    }
  }
  return true;
}

export function filterCandidates(
  pool: readonly TessellationDef[],
  placement: ProPlacement,
): TessellationDef[] {
  return pool.filter((def) => containsTile(def, placement));
}

export interface TileAt {
  /** Cell-set key identifying the physical tile (stable across descriptions). */
  readonly key: string;
  readonly orientation: Placement["orientation"];
  /** Packed identity of the tile instance within this particular def. */
  readonly instance: { placement: number; m: number; n: number };
}

/**
 * The tile covering a cell in *plane* coordinates (the seed sits at the
 * origin), or null if the tiling misses it. Used to compare what different
 * candidate tilings do with a cell.
 */
export function tileKeyAt(def: TessellationDef, local: Vec2): TileAt | null {
  const instance = tileAt(def, local);
  if (!instance) return null;
  const placement = def.placements[instance.placement];
  const base = addVec(
    placement.offset,
    addVec(scaleVec(def.basis1, instance.m), scaleVec(def.basis2, instance.n)),
  );
  const cells = transformedCells(def.shape, placement.orientation).map((c) =>
    addVec(c, base),
  );
  return {
    key: cellsKey(cells),
    orientation: placement.orientation,
    instance,
  };
}

/** Whether the placement overlaps a tile already stamped in `occupied`. */
export function overlaps(
  shape: ShapeDef,
  placement: ProPlacement,
  occupied: ReadonlySet<string>,
): boolean {
  for (const cell of placementCells(shape, placement)) {
    if (occupied.has(keyVec(cell))) return true;
  }
  return false;
}

/** 32-bit FNV-1a, pinned to 16 bits for the packed tile tag. */
export function hashKey(key: string): number {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
