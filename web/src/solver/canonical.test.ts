import assert from "node:assert/strict";
import { test } from "node:test";
import { D4_NAMES, type D4 } from "../core/d4.ts";
import { addVec } from "../core/vec2.ts";
import { L_TROMINO_BRICK, UNIT_SQUARE } from "../model/builtins.ts";
import { transformTessellation, type TessellationDef } from "../model/tessellation.ts";
import { canonicalSignature, sameTessellation } from "./canonical.ts";

test("shifting an offset by a lattice vector keeps the identity", () => {
  const shifted: TessellationDef = {
    ...L_TROMINO_BRICK,
    placements: L_TROMINO_BRICK.placements.map((p, i) =>
      i === 1 ? { ...p, offset: addVec(p.offset, L_TROMINO_BRICK.basis1) } : p,
    ),
  };
  assert.equal(
    canonicalSignature(shifted),
    canonicalSignature(L_TROMINO_BRICK),
  );
  assert.ok(sameTessellation(L_TROMINO_BRICK, shifted));
});

test("plane symmetries keep the identity", () => {
  const reference = canonicalSignature(L_TROMINO_BRICK);
  for (let g = 0; g < D4_NAMES.length; g++) {
    const transformed = transformTessellation(L_TROMINO_BRICK, g as D4);
    assert.equal(
      canonicalSignature(transformed),
      reference,
      `symmetry ${D4_NAMES[g]}`,
    );
  }
});

test("different tessellations have different signatures", () => {
  assert.notEqual(
    canonicalSignature(UNIT_SQUARE),
    canonicalSignature(L_TROMINO_BRICK),
  );
});
