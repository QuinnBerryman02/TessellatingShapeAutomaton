import type { Vec2 } from "../core/vec2.ts";

/**
 * Enumerates **free polyominoes** (fixed up to translation, rotation and
 * reflection) grouped by size. Used by the encyclopedia to list every distinct
 * tile of a given number of cells.
 */

const D4_TRANSFORMS: ReadonlyArray<(c: Vec2) => Vec2> = [
  (c) => ({ x: c.x, y: c.y }),
  (c) => ({ x: -c.y, y: c.x }),
  (c) => ({ x: -c.x, y: -c.y }),
  (c) => ({ x: c.y, y: -c.x }),
  (c) => ({ x: -c.x, y: c.y }),
  (c) => ({ x: c.x, y: -c.y }),
  (c) => ({ x: -c.y, y: -c.x }),
  (c) => ({ x: c.y, y: c.x }),
];

export function normalizeCells(cells: readonly Vec2[]): Vec2[] {
  let minX = Infinity;
  let minY = Infinity;
  for (const c of cells) {
    if (c.x < minX) minX = c.x;
    if (c.y < minY) minY = c.y;
  }
  return cells
    .map((c) => ({ x: c.x - minX, y: c.y - minY }))
    .sort((a, b) => a.x - b.x || a.y - b.y);
}

function cellsKey(cells: readonly Vec2[]): string {
  return cells.map((c) => `${c.x},${c.y}`).join("|");
}

/** Canonical key of the free polyomino (smallest over translation + D4). */
export function canonicalKey(cells: readonly Vec2[]): string {
  let best: string | undefined;
  for (const transform of D4_TRANSFORMS) {
    const key = cellsKey(normalizeCells(cells.map(transform)));
    if (best === undefined || key < best) best = key;
  }
  return best as string;
}

/** `bySize[n - 1]` is the list of free polyominoes with `n` cells. */
export function freePolyominoesBySize(maxSize: number): Vec2[][][] {
  const bySize: Vec2[][][] = [];
  let frontier: Vec2[][] = [[{ x: 0, y: 0 }]];
  const seen = new Set<string>();

  for (let size = 1; size <= maxSize; size++) {
    const unique: Vec2[][] = [];
    for (const shape of frontier) {
      const key = canonicalKey(shape);
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(normalizeCells(shape));
    }
    unique.sort((a, b) => (cellsKey(a) < cellsKey(b) ? -1 : 1));
    bySize.push(unique);

    const next: Vec2[][] = [];
    for (const shape of unique) {
      const occupied = new Set(shape.map((c) => `${c.x},${c.y}`));
      const candidates = new Set<string>();
      for (const c of shape) {
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const key = `${c.x + dx},${c.y + dy}`;
          if (!occupied.has(key)) candidates.add(key);
        }
      }
      for (const candidate of candidates) {
        const [x, y] = candidate.split(",").map(Number);
        next.push([...shape, { x, y }]);
      }
    }
    frontier = next;
  }
  return bySize;
}
