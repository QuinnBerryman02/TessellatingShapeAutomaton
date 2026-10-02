import { D4_NAMES, inverseD4, type D4 } from "../core/d4.ts";
import { keyVec, type Vec2 } from "../core/vec2.ts";
import { transformedCells, type ShapeDef } from "../model/shape.ts";
import {
  reduceModLattice,
  transformTessellation,
  type Placement,
  type TessellationDef,
} from "../model/tessellation.ts";
import { canonicalSignature } from "./canonical.ts";
import {
  analyzeSymmetry,
  canonicalOrientation,
  shapeSymmetryGroup,
} from "./symmetry.ts";
import { validateTessellation } from "./validate.ts";

export interface FindOptions {
  /** Largest absolute coordinate allowed in a lattice basis vector. */
  readonly maxBasis?: number;
  /** Largest lattice covolume (tiles per fundamental cell). */
  readonly maxCovolume?: number;
  /** Largest number of placements in the motif. */
  readonly maxPlacements?: number;
  /** Stop after this many distinct tessellations. */
  readonly maxResults?: number;
  /** Cap the exact-cover solutions explored per lattice. */
  readonly maxSolutionsPerLattice?: number;
  /**
   * Keep only tessellations whose tiles form a single symmetry orbit. Default
   * true: multi-orbit tilings contain tiles that are the same shape but not
   * symmetry-equivalent, which is noisier to compare.
   */
  readonly singleOrbitOnly?: boolean;
}

interface Candidate {
  readonly placement: Placement;
  readonly mask: number;
}

interface Lattice {
  readonly basis1: Vec2;
  readonly basis2: Vec2;
  readonly vol: number;
}

/** Translates a shape so its bounding box starts at the origin. */
function normalizeCells(cells: readonly Vec2[]): Vec2[] {
  if (cells.length === 0) return [];
  let minX = Infinity;
  let minY = Infinity;
  for (const c of cells) {
    if (c.x < minX) minX = c.x;
    if (c.y < minY) minY = c.y;
  }
  return cells.map((c) => ({ x: c.x - minX, y: c.y - minY }));
}

/**
 * One representative per orientation up to the shape's own symmetry. A shape
 * that is (say) 180-degrees symmetric would otherwise produce two labels for
 * the same physical tile and duplicate every solution.
 */
function uniqueOrientations(shape: ShapeDef): D4[] {
  const group = shapeSymmetryGroup(shape);
  const seen = new Set<D4>();
  const result: D4[] = [];
  for (let g = 0; g < D4_NAMES.length; g++) {
    const representative = canonicalOrientation(group, g as D4);
    if (seen.has(representative)) continue;
    seen.add(representative);
    result.push(representative);
  }
  return result;
}

function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

/** Gauss lattice reduction, enough to give equal lattices an equal basis. */
function reduceBasis(basis1: Vec2, basis2: Vec2): [Vec2, Vec2] {
  let a: Vec2 = { ...basis1 };
  let b: Vec2 = { ...basis2 };
  if (dot(a, a) > dot(b, b)) [a, b] = [b, a];
  for (let i = 0; i < 100; i++) {
    const aa = dot(a, a);
    if (aa === 0) break;
    const mu = Math.round(dot(a, b) / aa);
    const next = { x: b.x - mu * a.x, y: b.y - mu * a.y };
    if (next.x === b.x && next.y === b.y) break;
    b = next;
    if (dot(a, a) > dot(b, b)) [a, b] = [b, a];
  }
  if (a.x * b.y - a.y * b.x < 0) b = { x: -b.x, y: -b.y };
  return [a, b];
}

/** A string that is equal for every basis of the same lattice. */
function latticeKey(basis1: Vec2, basis2: Vec2): string {
  const [a, b] = reduceBasis(basis1, basis2);
  const variants: [Vec2, Vec2][] = [];
  for (const [u, v] of [
    [a, b],
    [b, a],
  ] as [Vec2, Vec2][]) {
    for (const su of [1, -1]) {
      for (const sv of [1, -1]) {
        const uu = { x: su * u.x, y: su * u.y };
        let vv = { x: sv * v.x, y: sv * v.y };
        if (uu.x * vv.y - uu.y * vv.x < 0) vv = { x: -vv.x, y: -vv.y };
        variants.push([uu, vv]);
      }
    }
  }
  variants.sort(
    (p, q) =>
      p[0].x - q[0].x ||
      p[0].y - q[0].y ||
      p[1].x - q[1].x ||
      p[1].y - q[1].y,
  );
  const [u, v] = variants[0];
  return `${u.x},${u.y};${v.x},${v.y}`;
}

interface CandidateSet {
  readonly candidates: Candidate[];
  readonly universe: number;
}

function buildCandidates(
  shape: ShapeDef,
  orientations: readonly D4[],
  basis1: Vec2,
  basis2: Vec2,
  vol: number,
): CandidateSet | null {
  const residueIds = new Map<string, number>();
  const idOf = (cell: Vec2): number => {
    const key = keyVec(reduceModLattice(cell, basis1, basis2));
    let id = residueIds.get(key);
    if (id === undefined) {
      id = residueIds.size;
      residueIds.set(key, id);
    }
    return id;
  };

  // One offset representative per coset of Z^2 / L.
  const offsets: Vec2[] = [];
  const offsetSeen = new Set<string>();
  const reach =
    (Math.abs(basis1.x) +
      Math.abs(basis1.y) +
      Math.abs(basis2.x) +
      Math.abs(basis2.y)) *
      2 +
    2;
  for (let x = -reach; x <= reach; x++) {
    for (let y = -reach; y <= reach; y++) {
      const rep = reduceModLattice({ x, y }, basis1, basis2);
      const key = keyVec(rep);
      if (offsetSeen.has(key)) continue;
      offsetSeen.add(key);
      offsets.push(rep);
    }
  }

  const candidates: Candidate[] = [];
  for (const orientation of orientations) {
    const base = transformedCells(shape, orientation);
    for (const offset of offsets) {
      let mask = 0;
      let valid = true;
      for (const cell of base) {
        const id = idOf({ x: cell.x + offset.x, y: cell.y + offset.y });
        if (id >= 31) {
          valid = false;
          break;
        }
        const bit = 1 << id;
        if (mask & bit) {
          valid = false; // the tile overlaps its own translate
          break;
        }
        mask |= bit;
      }
      if (!valid || mask === 0) continue;
      candidates.push({ placement: { offset, orientation }, mask });
    }
  }

  if (candidates.length === 0) return null;

  let universe = 0;
  for (const candidate of candidates) universe |= candidate.mask;
  const expected = (1 << vol) - 1;
  if (universe !== expected) return null;
  return { candidates, universe };
}

function exactCover(
  candidates: readonly Candidate[],
  universe: number,
  maxPlacements: number,
  maxSolutions: number,
): Candidate[][] {
  const byResidue: number[][] = [];
  for (let i = 0; i < candidates.length; i++) {
    let mask = candidates[i].mask;
    while (mask !== 0) {
      const bit = mask & -mask;
      const residue = 31 - Math.clz32(bit);
      (byResidue[residue] ??= []).push(i);
      mask ^= bit;
    }
  }

  const solutions: Candidate[][] = [];
  const chosen: Candidate[] = [];
  const used = new Uint8Array(candidates.length);

  const recurse = (covered: number, count: number): void => {
    if (solutions.length >= maxSolutions) return;
    if (covered === universe) {
      solutions.push(chosen.slice());
      return;
    }
    if (count >= maxPlacements) return;
    let residue = 0;
    while (covered & (1 << residue)) residue++;
    for (const index of byResidue[residue] ?? []) {
      if (used[index]) continue;
      const candidate = candidates[index];
      if (candidate.mask & covered) continue;
      used[index] = 1;
      chosen.push(candidate);
      recurse(covered | candidate.mask, count + 1);
      chosen.pop();
      used[index] = 0;
      if (solutions.length >= maxSolutions) return;
    }
  };

  recurse(0, 0);
  return solutions;
}

/**
 * Re-expresses a tiling so the drawn (identity) orientation actually appears.
 * Rotating a tiling is only a change of description, but fixing every result to
 * contain the shape as drawn makes them directly comparable.
 */
function orientToIdentity(def: TessellationDef): TessellationDef {
  let oriented = def;
  if (!oriented.placements.some((p) => p.orientation === 0)) {
    const reference = oriented.placements.reduce((best, p) =>
      p.orientation < best.orientation ? p : best,
    );
    oriented = transformTessellation(def, inverseD4(reference.orientation));
  }
  // Put an identity-oriented (as-drawn) tile at the origin, so every result is
  // also aligned in position and not just in orientation.
  const anchor = oriented.placements
    .filter((p) => p.orientation === 0)
    .reduce((best, p) =>
      Math.abs(p.offset.x) + Math.abs(p.offset.y) <
        Math.abs(best.offset.x) + Math.abs(best.offset.y) ||
      (Math.abs(p.offset.x) + Math.abs(p.offset.y) ===
        Math.abs(best.offset.x) + Math.abs(best.offset.y) &&
        (p.offset.x < best.offset.x ||
          (p.offset.x === best.offset.x && p.offset.y < best.offset.y)))
        ? p
        : best,
    );
  return {
    ...oriented,
    placements: oriented.placements.map((p) => ({
      ...p,
      offset: { x: p.offset.x - anchor.offset.x, y: p.offset.y - anchor.offset.y },
    })),
  };
}

/**
 * Searches for lattice tilings of a tile shape, using its D4 orientations.
 *
 * For each candidate lattice the plane modulo the lattice is a finite set of
 * cells; a tiling is an exact cover of those cells by tile placements. Exact
 * cover is solved with backtracking, then every solution is run through the
 * validator and canonicalised so equivalent tilings are only reported once.
 */
export function findTessellations(
  shape: ShapeDef,
  options: FindOptions = {},
): TessellationDef[] {
  const maxBasis = options.maxBasis ?? 4;
  const maxCovolume = options.maxCovolume ?? 16;
  const maxPlacements = options.maxPlacements ?? 8;
  const maxResults = options.maxResults ?? 200;
  const maxSolutionsPerLattice = options.maxSolutionsPerLattice ?? 40;

  const singleOrbitOnly = options.singleOrbitOnly ?? true;
  const cells = normalizeCells(shape.cells);
  if (cells.length === 0) return [];
  const normalized: ShapeDef = { name: shape.name, cells };
  const area = cells.length;
  const orientations = uniqueOrientations(normalized);

  const lattices: Lattice[] = [];
  const seenLattices = new Set<string>();
  for (let x1 = -maxBasis; x1 <= maxBasis; x1++) {
    for (let y1 = -maxBasis; y1 <= maxBasis; y1++) {
      for (let x2 = -maxBasis; x2 <= maxBasis; x2++) {
        for (let y2 = -maxBasis; y2 <= maxBasis; y2++) {
          const basis1 = { x: x1, y: y1 };
          const basis2 = { x: x2, y: y2 };
          const det = basis1.x * basis2.y - basis1.y * basis2.x;
          if (det === 0) continue;
          const vol = Math.abs(det);
          if (vol > maxCovolume || vol % area !== 0) continue;
          const placementCount = vol / area;
          if (placementCount < 1 || placementCount > maxPlacements) continue;
          const key = latticeKey(basis1, basis2);
          if (seenLattices.has(key)) continue;
          seenLattices.add(key);
          lattices.push({ basis1, basis2, vol });
        }
      }
    }
  }

  // Search compact lattices first, so a result cap keeps the simplest tilings.
  const magnitude = (lattice: Lattice): number =>
    lattice.basis1.x ** 2 +
    lattice.basis1.y ** 2 +
    lattice.basis2.x ** 2 +
    lattice.basis2.y ** 2;
  lattices.sort((a, b) => a.vol - b.vol || magnitude(a) - magnitude(b));

  const results: TessellationDef[] = [];
  const seenSignatures = new Set<string>();

  for (const { basis1, basis2, vol } of lattices) {
    const built = buildCandidates(
      normalized,
      orientations,
      basis1,
      basis2,
      vol,
    );
    if (!built) continue;

    const solutions = exactCover(
      built.candidates,
      built.universe,
      maxPlacements,
      maxSolutionsPerLattice,
    );
    for (const solution of solutions) {
      const def: TessellationDef = {
        name: "discovery",
        shape: normalized,
        basis1,
        basis2,
        placements: solution.map((c) => c.placement),
      };
      if (!validateTessellation(def).valid) continue;
      const signature = canonicalSignature(def);
      if (seenSignatures.has(signature)) continue;
      const analysis = analyzeSymmetry(def);
      if (singleOrbitOnly && analysis.orbitCount > 1) continue;
      seenSignatures.add(signature);
      results.push(orientToIdentity(def));
      if (results.length >= maxResults) return results;
    }
  }

  return results;
}
