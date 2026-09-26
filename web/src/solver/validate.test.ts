import assert from "node:assert/strict";
import { test } from "node:test";
import { L_TROMINO, L_TROMINO_BRICK, UNIT_SQUARE } from "../model/builtins.ts";
import type { TessellationDef } from "../model/tessellation.ts";
import { isLatticeVector, validateTessellation } from "./validate.ts";

test("the unit square is a valid tessellation", () => {
  const result = validateTessellation(UNIT_SQUARE);
  assert.equal(result.valid, true);
  assert.deepEqual(result.issues, []);
});

test("the L-tromino brick is a valid tessellation", () => {
  const result = validateTessellation(L_TROMINO_BRICK);
  assert.equal(result.valid, true);
  assert.equal(result.stats.motifArea, 6);
  assert.equal(result.stats.covolume, 6);
});

test("an area mismatch (a gap) is rejected", () => {
  const def: TessellationDef = { ...UNIT_SQUARE, basis1: { x: 2, y: 0 } };
  const result = validateTessellation(def);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((i) => i.code === "area-mismatch"));
});

test("a degenerate lattice is rejected", () => {
  const def: TessellationDef = { ...UNIT_SQUARE, basis2: { x: 2, y: 0 } };
  const result = validateTessellation(def);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((i) => i.code === "degenerate-lattice"));
});

test("duplicate placements overlap despite matching area", () => {
  const def: TessellationDef = {
    name: "duplicate",
    shape: L_TROMINO,
    basis1: { x: 2, y: 0 },
    basis2: { x: 0, y: 3 },
    placements: [
      { offset: { x: 0, y: 0 }, orientation: 0 },
      { offset: { x: 0, y: 0 }, orientation: 0 },
    ],
  };
  const result = validateTessellation(def);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((i) => i.code === "overlap"));
});

test("placements whose offsets differ by a lattice vector overlap", () => {
  const def: TessellationDef = {
    ...UNIT_SQUARE,
    basis1: { x: 2, y: 0 },
    basis2: { x: 0, y: 1 },
    placements: [
      { offset: { x: 0, y: 0 }, orientation: 0 },
      { offset: { x: 2, y: 0 }, orientation: 0 },
    ],
  };
  const result = validateTessellation(def);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((i) => i.code === "overlap"));
});

test("isLatticeVector identifies integer combinations", () => {
  const b1 = { x: 2, y: 0 };
  const b2 = { x: 0, y: 3 };
  assert.equal(isLatticeVector({ x: 0, y: 0 }, b1, b2), true);
  assert.equal(isLatticeVector({ x: 4, y: -3 }, b1, b2), true);
  assert.equal(isLatticeVector({ x: 1, y: 0 }, b1, b2), false);
  assert.equal(isLatticeVector({ x: 0, y: 1 }, b1, b2), false);
});
