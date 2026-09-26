import { applyD4, composeD4, D4_NAMES, type D4 } from "../core/d4.ts";
import { addVec, keyVec, manhattan, scaleVec, type Vec2 } from "../core/vec2.ts";
import { transformedCells } from "../model/shape.ts";
import type { TessellationDef } from "../model/tessellation.ts";

interface ColoredCell {
  readonly cell: Vec2;
  readonly orientation: D4;
}

/**
 * All minimal integer representatives of `offset + lattice`.
 *
 * A placement is only defined up to lattice translation, so reducing it to a
 * "smallest" representative is the first step of canonicalisation. There can be
 * several equally small representatives (they are symmetric under the square's
 * symmetries), and picking one by an arbitrary tie-break would make the whole
 * signature depend on orientation. So we return them all and let the caller try
 * every combination; the canonical signature keeps the smallest result.
 */
function offsetCandidates(def: TessellationDef, offset: Vec2): Vec2[] {
  let best = Infinity;
  const candidates: Vec2[] = [];
  const seen = new Set<string>();
  for (let m = -2; m <= 2; m++) {
    for (let n = -2; n <= 2; n++) {
      const candidate = addVec(
        offset,
        addVec(scaleVec(def.basis1, -m), scaleVec(def.basis2, -n)),
      );
      const distance = manhattan(candidate);
      if (distance > best) continue;
      if (distance < best) {
        best = distance;
        candidates.length = 0;
        seen.clear();
      }
      const key = keyVec(candidate);
      if (!seen.has(key)) {
        seen.add(key);
        candidates.push(candidate);
      }
    }
  }
  return candidates;
}

function* combinations(lists: readonly (readonly Vec2[])[]): Generator<Vec2[]> {
  if (lists.some((list) => list.length === 0)) return;
  const indices = new Array<number>(lists.length).fill(0);
  for (;;) {
    yield indices.map((index, i) => lists[i][index]);
    let i = lists.length - 1;
    while (i >= 0) {
      indices[i]++;
      if (indices[i] < lists[i].length) break;
      indices[i] = 0;
      i--;
    }
    if (i < 0) return;
  }
}

function motifWithOffsets(
  def: TessellationDef,
  offsets: readonly Vec2[],
): ColoredCell[] {
  const result: ColoredCell[] = [];
  def.placements.forEach((placement, i) => {
    for (const cell of transformedCells(def.shape, placement.orientation)) {
      result.push({
        cell: addVec(cell, offsets[i]),
        orientation: placement.orientation,
      });
    }
  });
  return result;
}

function signatureFor(colors: readonly ColoredCell[], g: D4): string {
  let minX = Infinity;
  let minY = Infinity;
  const transformed = colors.map(({ cell, orientation }) => {
    const moved = applyD4(g, cell);
    if (moved.x < minX) minX = moved.x;
    if (moved.y < minY) minY = moved.y;
    return { x: moved.x, y: moved.y, o: composeD4(orientation, g) };
  });
  transformed.sort((a, b) => a.x - b.x || a.y - b.y);
  return transformed.map((t) => `${t.x - minX},${t.y - minY}:${t.o}`).join(";");
}

/**
 * A canonical signature for a tessellation, invariant under translations,
 * lattice re-basing and the symmetries of the square. Two tessellations are the
 * same if their signatures match.
 *
 * Limitation: the lattice basis itself is taken as given. Two descriptions that
 * use genuinely different bases for the same lattice are compared by their
 * (equivalent) motifs, which this handles for the reduced bases built so far
 * but is not yet a general lattice canonical form.
 */
export function canonicalSignature(def: TessellationDef): string {
  const lists = def.placements.map((p) => offsetCandidates(def, p.offset));
  let best: string | undefined;
  for (const offsets of combinations(lists)) {
    const colors = motifWithOffsets(def, offsets);
    for (let g = 0; g < D4_NAMES.length; g++) {
      const signature = signatureFor(colors, g as D4);
      if (best === undefined || signature < best) best = signature;
    }
  }
  return best as string;
}

export function sameTessellation(a: TessellationDef, b: TessellationDef): boolean {
  return canonicalSignature(a) === canonicalSignature(b);
}
