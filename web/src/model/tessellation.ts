import { OWNER_LAB, packCell } from "../core/cell.ts";
import { applyD4, composeD4, type D4 } from "../core/d4.ts";
import { addVec, manhattan, scaleVec, type Vec2 } from "../core/vec2.ts";
import { transformedCells, type ShapeDef } from "./shape.ts";

/**
 * One tile placement within the fundamental cell: a symmetry of the shape and
 * an integer offset. Every instance of the tessellation is this placement
 * translated by a lattice vector.
 */
export interface Placement {
  readonly offset: Vec2;
  readonly orientation: D4;
}

/**
 * A tessellation described as a finite motif (a set of placed tiles) together
 * with the lattice that repeats it. The tiling is the union of
 * `transform(shape, orientation) + offset + lattice` for every placement.
 *
 * Validity (see `solver/validate.ts`) means that union is an exact partition of
 * the integer grid.
 */
export interface TessellationDef {
  readonly name: string;
  readonly shape: ShapeDef;
  readonly basis1: Vec2;
  readonly basis2: Vec2;
  readonly placements: readonly Placement[];
}

export interface Region {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export interface Raster {
  readonly minX: number;
  readonly minY: number;
  readonly width: number;
  readonly height: number;
  /**
   * One packed cell per entry (see `core/cell.ts`): owner, orientation, and an
   * optional shade bit. 0 means empty; by default cells are `OWNER_LAB` so the
   * renderer draws them with the orientation palette.
   */
  readonly cells: Uint32Array;
}

export interface RasterOptions {
  /** Alternate the shade of neighbouring tile instances (by lattice parity). */
  readonly shadeTiles?: boolean;
  /** Owner id stamped into every non-empty cell (default `OWNER_LAB`). */
  readonly owner?: number;
  /**
   * Optional palette slot (0..15) for a tile instance, given its orientation
   * and base point. Used to colour tiles by their symmetry class.
   */
  readonly classify?: (orientation: D4, base: Vec2) => number;
}

/** Area of the fundamental cell of the lattice. */
export function covolume(def: TessellationDef): number {
  return Math.abs(
    def.basis1.x * def.basis2.y - def.basis1.y * def.basis2.x,
  );
}

function isBetterRep(candidate: Vec2, best: Vec2): boolean {
  const dc = manhattan(candidate);
  const db = manhattan(best);
  if (dc !== db) return dc < db;
  if (candidate.x !== best.x) return candidate.x < best.x;
  return candidate.y < best.y;
}

/**
 * Canonical, small integer representative of `u` modulo the lattice: the
 * translate with the smallest Manhattan distance from the origin (ties broken
 * by x then y). Consistent, so equal cosets reduce to equal vectors.
 */
export function reduceModLattice(u: Vec2, basis1: Vec2, basis2: Vec2): Vec2 {
  const { t1, t2 } = latticeCoords(u, basis1, basis2);
  const m0 = Math.floor(t1);
  const n0 = Math.floor(t2);
  // A wide window so even a skewed basis still finds the true minimum.
  const radius = 3;
  let best: Vec2 | undefined;
  for (let m = m0 - radius; m <= m0 + radius; m++) {
    for (let n = n0 - radius; n <= n0 + radius; n++) {
      const candidate = addVec(
        u,
        addVec(scaleVec(basis1, -m), scaleVec(basis2, -n)),
      );
      if (best === undefined || isBetterRep(candidate, best)) best = candidate;
    }
  }
  return best as Vec2;
}

/**
 * Coordinates of `u` in the lattice basis, as fractions of the basis vectors.
 * Throws when the basis is degenerate.
 */
export function latticeCoords(
  u: Vec2,
  basis1: Vec2,
  basis2: Vec2,
): { t1: number; t2: number } {
  const det = basis1.x * basis2.y - basis1.y * basis2.x;
  if (det === 0) throw new Error("degenerate lattice basis");
  return {
    t1: (basis2.y * u.x - basis2.x * u.y) / det,
    t2: (basis1.x * u.y - basis1.y * u.x) / det,
  };
}

/** Applies a plane symmetry to an entire tessellation. */
export function transformTessellation(
  def: TessellationDef,
  g: D4,
): TessellationDef {
  return {
    name: def.name,
    shape: def.shape,
    basis1: applyD4(g, def.basis1),
    basis2: applyD4(g, def.basis2),
    placements: def.placements.map((p) => ({
      offset: applyD4(g, p.offset),
      orientation: composeD4(p.orientation, g),
    })),
  };
}

/**
 * Rasterises the tiling over an inclusive cell region. Later placements win on
 * a collision, but a valid tessellation has no collisions, so every cell is
 * covered exactly once.
 */
export function rasterize(
  def: TessellationDef,
  region: Region,
  options: RasterOptions = {},
): Raster {
  const width = region.maxX - region.minX + 1;
  const height = region.maxY - region.minY + 1;
  const cells = new Uint32Array(width * height);
  const owner = options.owner ?? OWNER_LAB;
  const tiles = def.placements.map((p) =>
    transformedCells(def.shape, p.orientation),
  );

  // Margin in cells: far enough that any tile touching the region is reached.
  let margin = 1;
  for (let i = 0; i < def.placements.length; i++) {
    const off = def.placements[i].offset;
    margin = Math.max(margin, Math.abs(off.x) + Math.abs(off.y));
    for (const c of tiles[i]) {
      margin = Math.max(margin, Math.abs(c.x) + Math.abs(c.y));
    }
  }

  const corners: Vec2[] = [
    { x: region.minX - margin, y: region.minY - margin },
    { x: region.maxX + margin, y: region.minY - margin },
    { x: region.minX - margin, y: region.maxY + margin },
    { x: region.maxX + margin, y: region.maxY + margin },
  ];
  let t1Min = Infinity;
  let t1Max = -Infinity;
  let t2Min = Infinity;
  let t2Max = -Infinity;
  for (const corner of corners) {
    const { t1, t2 } = latticeCoords(corner, def.basis1, def.basis2);
    t1Min = Math.min(t1Min, t1);
    t1Max = Math.max(t1Max, t1);
    t2Min = Math.min(t2Min, t2);
    t2Max = Math.max(t2Max, t2);
  }
  const mMin = Math.floor(t1Min) - 1;
  const mMax = Math.ceil(t1Max) + 1;
  const nMin = Math.floor(t2Min) - 1;
  const nMax = Math.ceil(t2Max) + 1;

  let nextTag = 0;
  for (let i = 0; i < def.placements.length; i++) {
    const placement = def.placements[i];
    for (let m = mMin; m <= mMax; m++) {
      for (let n = nMin; n <= nMax; n++) {
        const tag = nextTag++ & 0xffff;
        const base = addVec(
          placement.offset,
          addVec(scaleVec(def.basis1, m), scaleVec(def.basis2, n)),
        );
        for (const cell of tiles[i]) {
          const p = addVec(cell, base);
          if (
            p.x < region.minX ||
            p.x > region.maxX ||
            p.y < region.minY ||
            p.y > region.maxY
          ) {
            continue;
          }
          const shade = options.shadeTiles ? (m + n) & 1 : 0;
          const slot = options.classify
            ? options.classify(placement.orientation, base)
            : placement.orientation + 8 * shade;
          cells[(p.y - region.minY) * width + (p.x - region.minX)] = packCell({
            owner,
            orientation: slot & 0x7,
            shade: (slot >> 3) & 1,
            tag,
          });
        }
      }
    }
  }

  return {
    minX: region.minX,
    minY: region.minY,
    width,
    height,
    cells,
  };
}

export interface TessellationJSON {
  readonly name: string;
  readonly shape: { readonly name: string; readonly cells: [number, number][] };
  readonly basis1: [number, number];
  readonly basis2: [number, number];
  readonly placements: { readonly offset: [number, number]; readonly orientation: number }[];
}

export function toJSON(def: TessellationDef): TessellationJSON {
  return {
    name: def.name,
    shape: {
      name: def.shape.name,
      cells: def.shape.cells.map((c) => [c.x, c.y] as [number, number]),
    },
    basis1: [def.basis1.x, def.basis1.y],
    basis2: [def.basis2.x, def.basis2.y],
    placements: def.placements.map((p) => ({
      offset: [p.offset.x, p.offset.y] as [number, number],
      orientation: p.orientation,
    })),
  };
}

export function fromJSON(json: TessellationJSON): TessellationDef {
  return {
    name: json.name,
    shape: {
      name: json.shape.name,
      cells: json.shape.cells.map(([x, y]) => ({ x, y })),
    },
    basis1: { x: json.basis1[0], y: json.basis1[1] },
    basis2: { x: json.basis2[0], y: json.basis2[1] },
    placements: json.placements.map((p) => ({
      offset: { x: p.offset[0], y: p.offset[1] },
      orientation: p.orientation as D4,
    })),
  };
}
