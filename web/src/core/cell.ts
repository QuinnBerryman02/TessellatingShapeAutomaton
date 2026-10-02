/**
 * The packed world-cell format. The world is one `u32` per cell, layered as:
 *
 *   bits  0..7    owner id          (0 = unowned; see OWNER_*)
 *   bits  8..10   tile orientation  (a D4 index, 0..7)
 *   bit   11      tile shade        (alternates neighbouring tile instances)
 *   bits 12..15   cell role         (see ROLE_*)
 *   bits 16..31   tile tag          (per-participant tile instance id)
 *
 * The tag is what lets the renderer tell two touching tiles apart even when
 * they share an owner and an orientation, so it can draw tile boundaries.
 *
 * This is the contract between the simulation, the CPU rasteriser, and the
 * render shader, so the bit positions live in one place.
 */

export const CELL_OWNER_MASK = 0xff;
export const CELL_ORIENTATION_MASK = 0x7;
export const CELL_ROLE_MASK = 0xf;
export const CELL_TAG_MASK = 0xffff;

export const CELL_ORIENTATION_SHIFT = 8;
export const CELL_SHADE_SHIFT = 11;
export const CELL_ROLE_SHIFT = 12;
export const CELL_TAG_SHIFT = 16;

/** Owner ids. 1 is the neutral "just show me a tiling" owner used by the Lab. */
export const OWNER_EMPTY = 0;
export const OWNER_LAB = 1;
export const OWNER_PLAYER_A = 2;
export const OWNER_PLAYER_B = 3;

/** Cell roles. Only NORMAL and CORE are used so far. */
export const ROLE_NORMAL = 0;
export const ROLE_CORE = 1;

export interface CellFields {
  owner: number;
  orientation?: number;
  shade?: number;
  role?: number;
  tag?: number;
}

export function packCell(fields: CellFields): number {
  const owner = fields.owner & CELL_OWNER_MASK;
  const orientation = (fields.orientation ?? 0) & CELL_ORIENTATION_MASK;
  const shade = (fields.shade ?? 0) & 1;
  const role = (fields.role ?? ROLE_NORMAL) & CELL_ROLE_MASK;
  const tag = (fields.tag ?? 0) & CELL_TAG_MASK;
  return (
    owner |
    (orientation << CELL_ORIENTATION_SHIFT) |
    (shade << CELL_SHADE_SHIFT) |
    (role << CELL_ROLE_SHIFT) |
    (tag << CELL_TAG_SHIFT)
  ) >>> 0;
}

export function ownerOf(cell: number): number {
  return cell & CELL_OWNER_MASK;
}

export function orientationOf(cell: number): number {
  return (cell >>> CELL_ORIENTATION_SHIFT) & CELL_ORIENTATION_MASK;
}

export function shadeOf(cell: number): number {
  return (cell >>> CELL_SHADE_SHIFT) & 1;
}

export function roleOf(cell: number): number {
  return (cell >>> CELL_ROLE_SHIFT) & CELL_ROLE_MASK;
}

export function tagOf(cell: number): number {
  return (cell >>> CELL_TAG_SHIFT) & CELL_TAG_MASK;
}

/**
 * Palette slot for a Lab-owned cell: the 8 orientations followed by the 8 dark
 * variants. Matches the ordering the render shader and Lab preview use.
 */
export function paletteIndex(cell: number): number {
  return orientationOf(cell) + 8 * shadeOf(cell);
}

/** Owner + tile tag: equal for cells of the same tile, different otherwise. */
export function tileKey(cell: number): number {
  return (cell & 0xffff00ff) >>> 0;
}
