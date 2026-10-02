import { applyD4, composeD4, D4_NAMES, type D4 } from "../core/d4.ts";
import { addVec, keyVec, subVec, type Vec2 } from "../core/vec2.ts";
import { transformedCells, type ShapeDef } from "../model/shape.ts";
import {
  reduceModLattice,
  transformTessellation,
  type Placement,
  type TessellationDef,
} from "../model/tessellation.ts";
import { isLatticeVector } from "./validate.ts";

/**
 * The symmetry group of a tessellation, and the classification of its tiles.
 *
 * A tiling is a **set of tile cell-sets** in the plane, periodic under a lattice
 * L*. Everything here works on those cell sets rather than on placement
 * orientations: an orientation label is not part of a tile's identity (a shape
 * that is itself symmetric can be written with several labels for the same
 * tile), and the actual cells — not just their residues modulo L* — are needed
 * to know a tile's phase within the fundamental domain.
 *
 * The **symmetry group** G is every isometry mapping the tiling onto itself; its
 * **translation subgroup** is L* (a sublattice of Z², possibly coarser than the
 * basis the tiling was described with). Tiles fall into **orbits** under G, and
 * within an orbit the D4 part of a symmetry carrying the reference tile to a
 * tile is its class.
 */

export interface TileInstance {
  readonly placement: number;
  readonly m: number;
  readonly n: number;
}

/** The tile instance covering a cell, or undefined if the tiling misses it. */
export function tileAt(def: TessellationDef, cell: Vec2): TileInstance | undefined {
  const { basis1, basis2 } = def;
  for (let p = 0; p < def.placements.length; p++) {
    const cells = transformedCells(def.shape, def.placements[p].orientation);
    const offset = def.placements[p].offset;
    for (const c of cells) {
      const t = subVec(subVec(cell, c), offset);
      const coords = latticeCoordsOrNull(t, basis1, basis2);
      if (!coords) continue;
      const m = Math.round(coords.t1);
      const n = Math.round(coords.t2);
      if (Math.abs(coords.t1 - m) < 1e-6 && Math.abs(coords.t2 - n) < 1e-6) {
        return { placement: p, m, n };
      }
    }
  }
  return undefined;
}

function latticeCoordsOrNull(
  u: Vec2,
  basis1: Vec2,
  basis2: Vec2,
): { t1: number; t2: number } | null {
  const det = basis1.x * basis2.y - basis1.y * basis2.x;
  if (det === 0) return null;
  return {
    t1: (basis2.y * u.x - basis2.x * u.y) / det,
    t2: (basis1.x * u.y - basis1.y * u.x) / det,
  };
}

function instanceBase(def: TessellationDef, instance: TileInstance): Vec2 {
  const offset = def.placements[instance.placement].offset;
  return addVec(
    offset,
    addVec(
      { x: def.basis1.x * instance.m, y: def.basis1.y * instance.m },
      { x: def.basis2.x * instance.n, y: def.basis2.y * instance.n },
    ),
  );
}

function placementCells(def: TessellationDef, p: number): Vec2[] {
  return transformedCells(
    def.shape,
    def.placements[p].orientation,
  ).map((c) => addVec(c, def.placements[p].offset));
}

function instanceCells(def: TessellationDef, instance: TileInstance): Vec2[] {
  const base = instanceBase(def, instance);
  return transformedCells(
    def.shape,
    def.placements[instance.placement].orientation,
  ).map((c) => addVec(c, base));
}

function cellsKey(cells: readonly Vec2[]): string {
  return cells.map(keyVec).sort().join("|");
}

/** True when `cells` is exactly one of the tiling's tiles. */
function containsTile(def: TessellationDef, cells: readonly Vec2[]): boolean {
  const instance = tileAt(def, cells[0]);
  if (!instance) return false;
  return cellsKey(instanceCells(def, instance)) === cellsKey(cells);
}

function preservesTranslation(def: TessellationDef, v: Vec2): boolean {
  for (let p = 0; p < def.placements.length; p++) {
    if (!containsTile(def, placementCells(def, p).map((c) => addVec(c, v)))) {
      return false;
    }
  }
  return true;
}

function preservesIsometry(def: TessellationDef, g: D4, t: Vec2): boolean {
  for (let p = 0; p < def.placements.length; p++) {
    const image = placementCells(def, p).map((c) =>
      addVec(applyD4(g, c), t),
    );
    if (!containsTile(def, image)) return false;
  }
  return true;
}

export interface TranslationLattice {
  readonly basis1: Vec2;
  readonly basis2: Vec2;
  /** Non-identity translations (mod the given basis) that preserve the tiling. */
  readonly extraTranslations: Vec2[];
}

/** The full translation subgroup of the symmetry group, as a reduced basis. */
export function translationLattice(def: TessellationDef): TranslationLattice {
  const [h1, h2] = hermiteBasis([def.basis1, def.basis2]);
  const extraTranslations: Vec2[] = [];
  for (let y = 0; y < h2.y; y++) {
    for (let x = 0; x < h1.x; x++) {
      if (x === 0 && y === 0) continue;
      if (preservesTranslation(def, { x, y })) extraTranslations.push({ x, y });
    }
  }
  const [basis1, basis2] = hermiteBasis([
    def.basis1,
    def.basis2,
    ...extraTranslations,
  ]);
  return { basis1, basis2, extraTranslations };
}

export interface PointSymmetry {
  readonly g: D4;
  readonly t: Vec2;
}

/** All non-translation symmetries: one representative `(g, t)` per D4 element. */
export function pointSymmetries(def: TessellationDef): PointSymmetry[] {
  const { basis1, basis2 } = translationLattice(def);
  const reference = tileAt(def, { x: 0, y: 0 });
  if (!reference) return [];
  const referenceCells = instanceCells(def, reference);

  const result: PointSymmetry[] = [];
  for (let gi = 0; gi < D4_NAMES.length; gi++) {
    const g = gi as D4;
    if (
      !isLatticeVector(applyD4(g, basis1), basis1, basis2) ||
      !isLatticeVector(applyD4(g, basis2), basis1, basis2)
    ) {
      continue;
    }
    for (let q = 0; q < def.placements.length; q++) {
      const target = placementCells(def, q);
      const t = subVec(target[0], applyD4(g, referenceCells[0]));
      if (preservesIsometry(def, g, t)) {
        result.push({ g, t });
        break;
      }
    }
  }
  return result;
}

export interface TileClass {
  readonly orbit: number;
  readonly label: D4;
}

export interface SymmetryAnalysis {
  readonly basis1: Vec2;
  readonly basis2: Vec2;
  readonly pointSymmetries: PointSymmetry[];
  readonly orbitCount: number;
  classAt(cell: Vec2): TileClass | undefined;
  slotAt(cell: Vec2): number;
  slotFor(orientation: D4, base: Vec2): number;
}

/**
 * Groups the tiles into orbits under the full symmetry group and labels each by
 * the D4 part of a symmetry carrying the reference tile to it.
 */
export function analyzeSymmetry(def: TessellationDef): SymmetryAnalysis {
  const { basis1, basis2 } = translationLattice(def);
  const point = pointSymmetries(def);

  // One representative tile per primitive cell, keyed by residue set.
  const residueKeyOf = (cells: readonly Vec2[]): string =>
    cells
      .map((c) => keyVec(reduceModLattice(c, basis1, basis2)))
      .sort()
      .join("|");
  const tiles = new Map<string, { cells: Vec2[]; label: D4; orbit: number }>();
  const reference = tileAt(def, { x: 0, y: 0 });
  const referenceCells = reference ? instanceCells(def, reference) : [];

  const addTile = (
    cells: Vec2[],
    label: D4,
    orbit: number,
  ): void => {
    const key = residueKeyOf(cells);
    if (!tiles.has(key)) tiles.set(key, { cells, label, orbit });
  };

  if (reference) addTile(referenceCells, 0, 0);

  // BFS over the point symmetries to find the reference orbit and its labels.
  const queue: Vec2[][] = reference ? [referenceCells] : [];
  while (queue.length > 0) {
    const current = queue.shift() as Vec2[];
    const currentKey = residueKeyOf(current);
    const currentLabel = tiles.get(currentKey)?.label ?? 0;
    for (const { g, t } of point) {
      const image = current.map((c) => addVec(applyD4(g, c), t));
      const imageKey = residueKeyOf(image);
      if (tiles.has(imageKey)) continue;
      addTile(image, composeD4(currentLabel, g), 0);
      queue.push(image);
    }
  }

  // Any tile not reachable from the reference starts a new orbit.
  let orbitCount = tiles.size > 0 ? 1 : 0;
  for (let p = 0; p < def.placements.length; p++) {
    const cells = placementCells(def, p);
    const key = residueKeyOf(cells);
    if (tiles.has(key)) continue;
    addTile(cells, 0, orbitCount++);
    const stack: Vec2[][] = [cells];
    while (stack.length > 0) {
      const current = stack.pop() as Vec2[];
      for (const { g, t } of point) {
        const image = current.map((c) => addVec(applyD4(g, c), t));
        const imageKey = residueKeyOf(image);
        if (tiles.has(imageKey)) continue;
        addTile(image, 0, orbitCount - 1);
        stack.push(image);
      }
    }
  }

  const slotOf = (key: string): number => {
    const tile = tiles.get(key);
    return tile ? (tile.label + 8 * tile.orbit) % 16 : 0;
  };

  const classAt = (cell: Vec2): TileClass | undefined => {
    const instance = tileAt(def, cell);
    if (!instance) return undefined;
    const tile = tiles.get(residueKeyOf(instanceCells(def, instance)));
    return tile ? { orbit: tile.orbit, label: tile.label } : undefined;
  };

  return {
    basis1,
    basis2,
    pointSymmetries: point,
    orbitCount,
    classAt,
    slotAt: (cell: Vec2): number => {
      const instance = tileAt(def, cell);
      return instance
        ? slotOf(residueKeyOf(instanceCells(def, instance)))
        : 0;
    },
    slotFor: (orientation: D4, base: Vec2): number => {
      const cells = transformedCells(def.shape, orientation).map((c) =>
        addVec(c, base),
      );
      return slotOf(residueKeyOf(cells));
    },
  };
}

/** The symmetry group of a shape, up to translation (a subgroup of D4). */
export function shapeSymmetryGroup(shape: ShapeDef): D4[] {
  const base = normalizedShapeKey(shape.cells);
  const group: D4[] = [];
  for (let g = 0; g < D4_NAMES.length; g++) {
    if (normalizedShapeKey(transformedCells(shape, g as D4)) === base) {
      group.push(g as D4);
    }
  }
  return group;
}

function normalizedShapeKey(cells: readonly Vec2[]): string {
  let minX = Infinity;
  let minY = Infinity;
  for (const c of cells) {
    if (c.x < minX) minX = c.x;
    if (c.y < minY) minY = c.y;
  }
  return cells
    .map((c) => `${c.x - minX},${c.y - minY}`)
    .sort()
    .join("|");
}

/** The smallest D4 element representing `orientation` for a shape. */
export function canonicalOrientation(group: readonly D4[], orientation: D4): D4 {
  let best = orientation;
  for (const s of group) {
    const candidate = composeD4(s, orientation);
    if (candidate < best) best = candidate;
  }
  return best;
}

/**
 * How many distinct orientations a shape has under the square's symmetries:
 * the size of its D4 orbit, `8 / |symmetry group|` (orbit-stabiliser).
 */
export function shapeOrientationCount(shape: ShapeDef): number {
  return D4_NAMES.length / shapeSymmetryGroup(shape).length;
}

/** Mirror (fixed-line) direction of each reflection element of D4. */
const MIRROR_DIRECTION: Partial<Record<D4, Vec2>> = {
  4: { x: 0, y: 1 }, // FX, mirrors parallel to y
  5: { x: 1, y: 0 }, // FY, mirrors parallel to x
  6: { x: 1, y: -1 }, // TR
  7: { x: 1, y: 1 }, // TL
};

/**
 * Whether the reflection `(g, t)` has a genuine mirror line, or is only ever a
 * glide. A reflection keeps a fixed line iff its translation has no component
 * along the mirror; whether one can be removed depends on the projection of the
 * translation lattice onto that direction.
 */
function hasMirrorAxis(g: D4, t: Vec2, basis1: Vec2, basis2: Vec2): boolean {
  const a = MIRROR_DIRECTION[g];
  if (!a) return false;
  const projected = gcd(
    basis1.x * a.x + basis1.y * a.y,
    basis2.x * a.x + basis2.y * a.y,
  );
  if (projected === 0) return true;
  const along = t.x * a.x + t.y * a.y;
  return ((along % projected) + projected) % projected === 0;
}

/** Gauss-reduced basis of a lattice (shortest vectors first). */
function gaussReduce(a: Vec2, b: Vec2): [Vec2, Vec2] {
  const dot = (p: Vec2, q: Vec2): number => p.x * q.x + p.y * q.y;
  let u = { ...a };
  let v = { ...b };
  if (dot(u, u) > dot(v, v)) [u, v] = [v, u];
  for (let i = 0; i < 100; i++) {
    const uu = dot(u, u);
    if (uu === 0) break;
    const m = Math.round(dot(u, v) / uu);
    const next = { x: v.x - m * u.x, y: v.y - m * u.y };
    if (next.x === v.x && next.y === v.y) break;
    v = next;
    if (dot(u, u) > dot(v, v)) [u, v] = [v, u];
  }
  return [u, v];
}

/** The metric class of a lattice, from its reduced basis. */
function latticeType(
  basis1: Vec2,
  basis2: Vec2,
): "square" | "rectangular" | "rhombic" | "oblique" {
  const [u, v] = gaussReduce(basis1, basis2);
  const dot = u.x * v.x + u.y * v.y;
  const lu = u.x * u.x + u.y * u.y;
  const lv = v.x * v.x + v.y * v.y;
  if (dot === 0) return lu === lv ? "square" : "rectangular";
  if (lu === lv) return "rhombic";
  return "oblique";
}

/**
 * The wallpaper group of a tiling, as its standard symbol.
 *
 * Since the tiles live on Z², only the square-lattice groups are reachable:
 * p1, p2, pm, pg, cm, pmm, pmg, pgg, cmm, p4, p4m, p4g. The point group and
 * the lattice metric pick the family; the mirror/glide check then separates
 * the mirror-bearing symbols (pm/pmm/pmg/p4m) from the glide-bearing ones
 * (pg/pgg/p4g) and the centred ones (cm/cmm).
 */
export function wallpaperGroup(def: TessellationDef): string {
  const lattice = translationLattice(def);
  const symmetries = pointSymmetries(def);
  const pointGroup = new Set<number>(symmetries.map((s) => s.g));
  const translationOf = new Map<number, Vec2>(
    symmetries.map((s) => [s.g, s.t] as const),
  );
  const type = latticeType(lattice.basis1, lattice.basis2);
  const has = (g: D4): boolean => pointGroup.has(g);
  const reflections = ([4, 5, 6, 7] as D4[]).filter(has);
  const isMirror = (g: D4): boolean =>
    hasMirrorAxis(g, translationOf.get(g) as Vec2, lattice.basis1, lattice.basis2);

  if (pointGroup.size === 1) return "p1";
  if (has(1) || has(3)) {
    if (reflections.length === 0) return "p4";
    return reflections.every(isMirror) ? "p4m" : "p4g";
  }
  if (has(2)) {
    if (reflections.length === 0) return "p2";
    const mirrors = reflections.filter(isMirror).length;
    if (mirrors === 2) return type === "rhombic" ? "cmm" : "pmm";
    if (mirrors === 1) return "pmg";
    return "pgg";
  }
  if (reflections.length === 1) {
    const g = reflections[0];
    if (!isMirror(g)) return "pg";
    return type === "rhombic" ? "cm" : "pm";
  }
  return "p1";
}

/** The translation making `applyD4(s, shape) + t` equal the shape. */
function shapeSymmetryTranslation(shape: ShapeDef, s: D4): Vec2 {
  const moved = transformedCells(shape, s);
  let movedMinX = Infinity;
  let movedMinY = Infinity;
  let baseMinX = Infinity;
  let baseMinY = Infinity;
  for (const c of moved) {
    if (c.x < movedMinX) movedMinX = c.x;
    if (c.y < movedMinY) movedMinY = c.y;
  }
  for (const c of shape.cells) {
    if (c.x < baseMinX) baseMinX = c.x;
    if (c.y < baseMinY) baseMinY = c.y;
  }
  return { x: movedMinX - baseMinX, y: movedMinY - baseMinY };
}

/** Rewrites a placement to the smallest equivalent orientation. */
function canonicalizePlacement(
  shape: ShapeDef,
  group: readonly D4[],
  placement: Placement,
): Placement {
  const orientation = placement.orientation;
  let bestS: D4 = 0;
  let best = composeD4(0, orientation);
  for (const s of group) {
    const candidate = composeD4(s, orientation);
    if (candidate < best) {
      best = candidate;
      bestS = s;
    }
  }
  if (bestS === 0 && best === orientation) return placement;
  const translation = shapeSymmetryTranslation(shape, bestS);
  return {
    orientation: best,
    offset: subVec(placement.offset, applyD4(orientation, translation)),
  };
}

/**
 * A canonical signature, invariant under translation, the symmetries of the
 * square, extra translational symmetry, and the orientation labels a
 * description happens to use. It is built from the tiling's tiles as cell sets
 * on its primitive lattice.
 */
export function canonicalSignature(def: TessellationDef): string {
  let best: string | undefined;
  for (let gi = 0; gi < D4_NAMES.length; gi++) {
    const transformed = transformTessellation(def, gi as D4);
    const signature = primitivizedSignature(transformed);
    if (best === undefined || signature < best) best = signature;
  }
  return best as string;
}

function primitivizedSignature(def: TessellationDef): string {
  const lattice = translationLattice(def);
  const [h1, h2] = hermiteBasis([lattice.basis1, lattice.basis2]);
  const group = shapeSymmetryGroup(def.shape);

  const reduced: Placement[] = [];
  const seen = new Set<string>();
  for (const placement of def.placements) {
    const canonical = canonicalizePlacement(def.shape, group, placement);
    const offset = reduceModLattice(canonical.offset, lattice.basis1, lattice.basis2);
    const key = `${offset.x},${offset.y}:${canonical.orientation}`;
    if (seen.has(key)) continue;
    seen.add(key);
    reduced.push({ offset, orientation: canonical.orientation });
  }

  const latticeKey = `${lattice.basis1.x},${lattice.basis1.y};${lattice.basis2.x},${lattice.basis2.y}`;
  let best: string | undefined;
  for (let y = 0; y < h2.y; y++) {
    for (let x = 0; x < h1.x; x++) {
      const encoded = reduced
        .map((p) => {
          const offset = reduceModLattice(
            addVec(p.offset, { x, y }),
            lattice.basis1,
            lattice.basis2,
          );
          return `${offset.x},${offset.y}:${p.orientation}`;
        })
        .sort()
        .join(";");
      const signature = `${latticeKey}|${encoded}`;
      if (best === undefined || signature < best) best = signature;
    }
  }
  return best as string;
}

export function sameTessellation(a: TessellationDef, b: TessellationDef): boolean {
  return canonicalSignature(a) === canonicalSignature(b);
}

/** A basis of the lattice generated by `gens` (Hermite normal form). */
function hermiteBasis(gens: readonly Vec2[]): [Vec2, Vec2] {
  let c = 0;
  let w: Vec2 = { x: 0, y: 0 };
  for (const g of gens) {
    if (g.y === 0) continue;
    const positive = g.y < 0 ? { x: -g.x, y: -g.y } : { x: g.x, y: g.y };
    if (c === 0) {
      c = positive.y;
      w = positive;
      continue;
    }
    const divisor = gcd(c, positive.y);
    const [s, t] = extGcd(c, positive.y);
    w = { x: s * w.x + t * positive.x, y: divisor };
    c = divisor;
  }
  if (c === 0) throw new Error("lattice has rank < 2");

  let a = 0;
  for (const g of gens) {
    if (g.y === 0) {
      a = gcd(a, g.x);
      continue;
    }
    a = gcd(a, (g.y / c) * w.x - g.x);
  }
  if (a === 0) throw new Error("lattice has rank < 2");
  const b = ((w.x % a) + a) % a;
  return [
    { x: a, y: 0 },
    { x: b, y: c },
  ];
}

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

function extGcd(a: number, b: number): [number, number] {
  if (b === 0) return [1, 0];
  const [x, y] = extGcd(b, a % b);
  return [y, x - Math.floor(a / b) * y];
}
