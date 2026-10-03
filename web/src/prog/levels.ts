import { freePolyominoesBySize } from "../encyclopedia/polyominoes.ts";
import type { ShapeDef } from "../model/shape.ts";
import type { TessellationDef } from "../model/tessellation.ts";
import { findTessellations } from "../solver/find.ts";

/**
 * The ordered set of shapes the progression walks through: every free
 * polyomino by size, smallest first, canonical order within a size.
 */

/** Largest shape the progression offers. Shape 5 is the last cheap one. */
export const DEFAULT_MAX_SIZE = 5;

export interface LevelInfo {
  readonly id: string;
  readonly shape: ShapeDef;
  readonly size: number;
}

export function buildLevelList(maxSize = DEFAULT_MAX_SIZE): LevelInfo[] {
  const bySize = freePolyominoesBySize(maxSize);
  const list: LevelInfo[] = [];
  for (let size = 1; size <= bySize.length; size++) {
    bySize[size - 1].forEach((cells, index) => {
      list.push({
        id: `s${size}-${index}`,
        size,
        shape: { name: `polyomino-${size}-${index}`, cells },
      });
    });
  }
  return list;
}

/** All canonical tilings of a shape. Same options as the encyclopedia. */
export function computeTargets(shape: ShapeDef): TessellationDef[] {
  return findTessellations(shape, {
    maxBasis: 4,
    maxCovolume: 16,
    maxPlacements: 8,
    maxResults: 500,
  });
}
