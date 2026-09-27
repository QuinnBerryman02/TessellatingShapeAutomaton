import { addVec, scaleVec, subVec, type Vec2 } from "../core/vec2.ts";
import { transformedCells } from "../model/shape.ts";
import { latticeCoords, type TessellationDef } from "../model/tessellation.ts";

/**
 * One tile instance of a tessellation: placement `p` translated by
 * `m * basis1 + n * basis2`.
 */
export interface TileInstance {
  readonly placement: number;
  readonly m: number;
  readonly n: number;
}

/**
 * A neighbouring tile instance relative to the current one. If tile
 * `(p, m, n)` is adjacent to `(q, m + dm, n + dn)` for one instance then, by
 * translation invariance of the lattice, it is adjacent for every instance.
 */
export interface NeighborRule {
  readonly placement: number;
  readonly dm: number;
  readonly dn: number;
}

/**
 * Precomputes, for a tessellation, which tile instances touch which. Growth is
 * a flood over this adjacency graph, so a pattern's frontier shape comes from
 * its tiling rather than from the raw grid.
 */
export class GrowPattern {
  readonly def: TessellationDef;
  /** Per placement, the tile's cells (symmetry applied, relative to origin). */
  readonly tileCells: readonly (readonly Vec2[])[];
  /** Per placement, the instances edge-adjacent to it. */
  readonly neighbors: readonly (readonly NeighborRule[])[];

  constructor(def: TessellationDef) {
    this.def = def;
    this.tileCells = def.placements.map((p) =>
      transformedCells(def.shape, p.orientation),
    );
    this.neighbors = computeNeighbors(def, this.tileCells);
  }

  get placementCount(): number {
    return this.def.placements.length;
  }

  get cellsPerTile(): number {
    return this.def.shape.cells.length;
  }

  key(ti: TileInstance): string {
    return `${ti.placement}:${ti.m}:${ti.n}`;
  }

  /** Reference point of a tile instance (its placement offset + lattice shift). */
  base(ti: TileInstance): Vec2 {
    const p = this.def.placements[ti.placement];
    return addVec(
      p.offset,
      addVec(scaleVec(this.def.basis1, ti.m), scaleVec(this.def.basis2, ti.n)),
    );
  }

  /** World-space cells covered by a tile instance. */
  cells(ti: TileInstance, out: Vec2[] = []): Vec2[] {
    out.length = 0;
    const base = this.base(ti);
    for (const c of this.tileCells[ti.placement]) {
      out.push(addVec(c, base));
    }
    return out;
  }

  /** Instances edge-adjacent to `ti`. */
  neighborInstances(ti: TileInstance): TileInstance[] {
    return this.neighbors[ti.placement].map((r) => ({
      placement: r.placement,
      m: ti.m + r.dm,
      n: ti.n + r.dn,
    }));
  }

  /**
   * The tile instance covering a world cell, or undefined if the cell is not
   * covered (a valid tessellation covers everything, so this normally hits).
   */
  instanceAt(cell: Vec2): TileInstance | undefined {
    const { basis1, basis2 } = this.def;
    for (let p = 0; p < this.def.placements.length; p++) {
      const { offset } = this.def.placements[p];
      for (const c of this.tileCells[p]) {
        const t = subVec(subVec(cell, c), offset);
        const { t1, t2 } = latticeCoords(t, basis1, basis2);
        const m = Math.round(t1);
        const n = Math.round(t2);
        if (Math.abs(t1 - m) < 1e-6 && Math.abs(t2 - n) < 1e-6) {
          return { placement: p, m, n };
        }
      }
    }
    return undefined;
  }
}

function tilesAdjacent(
  cellsA: readonly Vec2[],
  baseA: Vec2,
  cellsB: readonly Vec2[],
  baseB: Vec2,
): boolean {
  for (const a of cellsA) {
    const ax = a.x + baseA.x;
    const ay = a.y + baseA.y;
    for (const b of cellsB) {
      const dx = ax - (b.x + baseB.x);
      const dy = ay - (b.y + baseB.y);
      if (Math.abs(dx) + Math.abs(dy) === 1) return true;
    }
  }
  return false;
}

function computeNeighbors(
  def: TessellationDef,
  tileCells: readonly (readonly Vec2[])[],
): NeighborRule[][] {
  const { basis1: b1, basis2: b2 } = def;
  const det = b1.x * b2.y - b1.y * b2.x;
  if (det === 0) throw new Error("degenerate lattice basis");

  let maxOffset = 0;
  let maxCell = 0;
  for (const p of def.placements) {
    maxOffset = Math.max(
      maxOffset,
      Math.abs(p.offset.x),
      Math.abs(p.offset.y),
    );
  }
  for (const cells of tileCells) {
    for (const c of cells) {
      maxCell = Math.max(maxCell, Math.abs(c.x), Math.abs(c.y));
    }
  }

  // Adjacent tiles differ by a vector of bounded size, so lattice coords of the
  // candidate shifts are bounded too. `B` is a safe bound on |t_x|, |t_y|.
  const B = 2 + 2 * maxOffset + 2 * maxCell;
  const r1 =
    Math.ceil(((Math.abs(b2.y) + Math.abs(b2.x)) * B) / Math.abs(det)) + 1;
  const r2 =
    Math.ceil(((Math.abs(b1.x) + Math.abs(b1.y)) * B) / Math.abs(det)) + 1;

  const neighbors: NeighborRule[][] = def.placements.map(() => []);
  for (let p = 0; p < def.placements.length; p++) {
    for (let q = 0; q < def.placements.length; q++) {
      const baseQ0 = def.placements[q].offset;
      for (let dm = -r1; dm <= r1; dm++) {
        for (let dn = -r2; dn <= r2; dn++) {
          if (p === q && dm === 0 && dn === 0) continue;
          const baseQ = addVec(
            baseQ0,
            addVec(scaleVec(b1, dm), scaleVec(b2, dn)),
          );
          if (
            tilesAdjacent(
              tileCells[p],
              def.placements[p].offset,
              tileCells[q],
              baseQ,
            )
          ) {
            neighbors[p].push({ placement: q, dm, dn });
          }
        }
      }
    }
  }
  return neighbors;
}
