import { subVec, type Vec2 } from "../core/vec2.ts";
import { transformedCells } from "../model/shape.ts";
import { covolume, type TessellationDef } from "../model/tessellation.ts";

export interface ValidationIssue {
  readonly code: string;
  readonly message: string;
}

export interface TessellationStats {
  readonly tileCells: number;
  readonly placements: number;
  readonly motifArea: number;
  readonly covolume: number;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly issues: readonly ValidationIssue[];
  readonly stats: TessellationStats;
}

/**
 * True when `u` is an integer combination of the basis vectors.
 *
 * Solves `[b1 b2] t = u` with the lattice determinant; `u` is in the lattice
 * iff both components of `t` are integers.
 */
export function isLatticeVector(u: Vec2, basis1: Vec2, basis2: Vec2): boolean {
  const det = basis1.x * basis2.y - basis1.y * basis2.x;
  if (det === 0) return false;
  const n1 = basis2.y * u.x - basis2.x * u.y;
  const n2 = basis1.x * u.y - basis1.y * u.x;
  return n1 % det === 0 && n2 % det === 0;
}

/**
 * Validates that a tessellation is an exact tiling of the plane.
 *
 * Two facts make this cheap and exact:
 *
 * 1. The motif area must equal the lattice covolume, otherwise there are gaps
 *    or overlaps on average.
 * 2. With no overlaps, the coverage of the (periodic) integer grid is 0 or 1
 *    everywhere and averages 1, so it is exactly 1 everywhere.
 *
 * Overlaps are found with difference sets. Instances `(i, v)` and `(j, w)`
 * (placement plus lattice vector) share a cell iff some `d` in `T_i - T_j`
 * equals `offset_j - offset_i + (w - v)`, i.e. `d - (offset_j - offset_i)` is a
 * lattice vector. Difference `0` for `i === j` is the same instance and is
 * skipped.
 */
export function validateTessellation(
  def: TessellationDef,
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const tileCells = def.shape.cells.length;
  const placements = def.placements.length;
  const motifArea = tileCells * placements;
  const vol = covolume(def);
  const stats: TessellationStats = {
    tileCells,
    placements,
    motifArea,
    covolume: vol,
  };

  if (tileCells === 0) {
    issues.push({ code: "empty-shape", message: "shape has no cells" });
  }
  if (placements === 0) {
    issues.push({ code: "empty-motif", message: "tessellation has no placements" });
  }
  if (vol === 0) {
    issues.push({
      code: "degenerate-lattice",
      message: "basis vectors are collinear (zero covolume)",
    });
  }
  if (issues.length > 0) {
    return { valid: false, issues, stats };
  }

  if (motifArea !== vol) {
    issues.push({
      code: "area-mismatch",
      message: `motif covers ${motifArea} cells but the fundamental cell has area ${vol} (gaps or overlaps)`,
    });
  }

  const tiles = def.placements.map((p) =>
    transformedCells(def.shape, p.orientation),
  );
  const offsets = def.placements.map((p) => p.offset);

  outer: for (let i = 0; i < placements; i++) {
    for (let j = 0; j < placements; j++) {
      const base = subVec(offsets[j], offsets[i]);
      for (const a of tiles[i]) {
        for (const b of tiles[j]) {
          const d = subVec(a, b);
          if (i === j && d.x === 0 && d.y === 0) continue;
          if (isLatticeVector(subVec(d, base), def.basis1, def.basis2)) {
            issues.push({
              code: "overlap",
              message: `tiles ${i} and ${j} overlap (difference ${d.x},${d.y})`,
            });
            break outer;
          }
        }
      }
    }
  }

  return { valid: issues.length === 0, issues, stats };
}
