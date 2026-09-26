import { applyD4, composeD4, type D4 } from "../core/d4.ts";
import { addVec, scaleVec, type Vec2 } from "../core/vec2.ts";
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
  /** One entry per cell: 0 = empty, otherwise orientation + 1. */
  readonly cells: Uint32Array;
}

/** Area of the fundamental cell of the lattice. */
export function covolume(def: TessellationDef): number {
  return Math.abs(
    def.basis1.x * def.basis2.y - def.basis1.y * def.basis2.x,
  );
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
export function rasterize(def: TessellationDef, region: Region): Raster {
  const width = region.maxX - region.minX + 1;
  const height = region.maxY - region.minY + 1;
  const cells = new Uint32Array(width * height);
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

  for (let i = 0; i < def.placements.length; i++) {
    const placement = def.placements[i];
    for (let m = mMin; m <= mMax; m++) {
      for (let n = nMin; n <= nMax; n++) {
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
          cells[(p.y - region.minY) * width + (p.x - region.minX)] =
            placement.orientation + 1;
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
