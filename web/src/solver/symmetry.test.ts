import assert from "node:assert/strict";
import { test } from "node:test";
import type { D4 } from "../core/d4.ts";
import { L_TROMINO_BRICK, UNIT_SQUARE } from "../model/builtins.ts";
import {
  transformTessellation,
  type TessellationDef,
} from "../model/tessellation.ts";
import {
  analyzeSymmetry,
  canonicalSignature,
  pointSymmetries,
  translationLattice,
} from "./symmetry.ts";

/** The unit square described with a doubling (supercell) lattice and 4 tiles. */
const SUPER_SQUARE: TessellationDef = {
  name: "super-square",
  shape: UNIT_SQUARE.shape,
  basis1: { x: 2, y: 0 },
  basis2: { x: 0, y: 2 },
  placements: [
    { offset: { x: 0, y: 0 }, orientation: 0 },
    { offset: { x: 1, y: 0 }, orientation: 0 },
    { offset: { x: 0, y: 1 }, orientation: 0 },
    { offset: { x: 1, y: 1 }, orientation: 0 },
  ],
};

test("a supercell reduces to the primitive translation lattice", () => {
  const lattice = translationLattice(SUPER_SQUARE);
  const det =
    lattice.basis1.x * lattice.basis2.y - lattice.basis1.y * lattice.basis2.x;
  assert.equal(Math.abs(det), 1);
  assert.ok(lattice.extraTranslations.length > 0);
});

test("a supercell description has the same signature as the primitive one", () => {
  assert.equal(canonicalSignature(SUPER_SQUARE), canonicalSignature(UNIT_SQUARE));
});

test("translation and D4 leave the signature unchanged", () => {
  const reference = canonicalSignature(L_TROMINO_BRICK);
  const translated: TessellationDef = {
    ...L_TROMINO_BRICK,
    placements: L_TROMINO_BRICK.placements.map((p) => ({
      ...p,
      offset: { x: p.offset.x + 7, y: p.offset.y - 4 },
    })),
  };
  assert.equal(canonicalSignature(translated), reference);
  for (let g = 0; g < 8; g++) {
    assert.equal(
      canonicalSignature(transformTessellation(L_TROMINO_BRICK, g as D4)),
      reference,
    );
  }
});

test("the unit square has only the identity point symmetry", () => {
  assert.deepEqual(
    pointSymmetries(UNIT_SQUARE).map((p) => p.g),
    [0],
  );
  assert.equal(analyzeSymmetry(UNIT_SQUARE).orbitCount, 1);
});

test("the L-tromino brick has a 180-degree symmetry", () => {
  const symmetries = pointSymmetries(L_TROMINO_BRICK);
  assert.deepEqual(symmetries.map((p) => p.g).sort(), [0, 2].sort());
  const analysis = analyzeSymmetry(L_TROMINO_BRICK);
  assert.equal(analysis.orbitCount, 1);
  // The reference (ID) tile is the identity class; the R180 placement is not.
  assert.equal(analysis.slotFor(0, { x: 0, y: 0 }), 0);
  assert.equal(analysis.slotFor(2, { x: 1, y: 2 }), 2);
});
