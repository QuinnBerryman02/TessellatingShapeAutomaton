import { applyD4, type D4 } from "../core/d4.ts";
import type { Vec2 } from "../core/vec2.ts";

/**
 * A tile shape: a finite set of grid cells relative to the tile centre. The
 * same shape placed under a symmetry of {@link D4} gives the orientations used
 * by a tessellation.
 */
export interface ShapeDef {
  readonly name: string;
  readonly cells: readonly Vec2[];
}

export interface Bounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export function shapeBounds(shape: ShapeDef): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of shape.cells) {
    if (c.x < minX) minX = c.x;
    if (c.x > maxX) maxX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.y > maxY) maxY = c.y;
  }
  return { minX, minY, maxX, maxY };
}

/** The shape's cells after applying a symmetry. */
export function transformedCells(shape: ShapeDef, g: D4): Vec2[] {
  return shape.cells.map((c) => applyD4(g, c));
}
