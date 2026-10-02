import assert from "node:assert/strict";
import { test } from "node:test";
import type { D4 } from "../core/d4.ts";
import { L_TROMINO, L_TROMINO_BRICK, UNIT_SQUARE } from "../model/builtins.ts";
import {
  transformTessellation,
  type TessellationDef,
} from "../model/tessellation.ts";
import { validateTessellation } from "./validate.ts";
import {
  analyzeSymmetry,
  canonicalSignature,
  pointSymmetries,
  sameTessellation,
  shapeOrientationCount,
  shapeSymmetryGroup,
  translationLattice,
  wallpaperGroup,
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

test("the unit-square tiling has the full square symmetry", () => {
  assert.deepEqual(
    pointSymmetries(UNIT_SQUARE)
      .map((p) => p.g)
      .sort((a, b) => a - b),
    [0, 1, 2, 3, 4, 5, 6, 7],
  );
  assert.equal(analyzeSymmetry(UNIT_SQUARE).orbitCount, 1);
});

test("a 180-symmetric shape written with the other orientation is the same tiling", () => {
  // This shape is itself 180-degree symmetric, so a tile can be written with
  // orientation 0 or 2. The two descriptions must canonicalise identically.
  const shape = {
    name: "lab-shape",
    cells: [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 3, y: 2 },
    ],
  };
  assert.deepEqual(shapeSymmetryGroup(shape), [0, 2]);
  const identity: TessellationDef = {
    name: "identity",
    shape,
    basis1: { x: 4, y: 1 },
    basis2: { x: 2, y: -1 },
    placements: [{ offset: { x: 0, y: 0 }, orientation: 0 }],
  };
  const rotated: TessellationDef = {
    ...identity,
    placements: [{ offset: { x: 3, y: 2 }, orientation: 2 }],
  };
  assert.ok(sameTessellation(identity, rotated));
});

test("tile orientation counts follow the shape's symmetry", () => {
  // square: stabiliser is all of D4 -> one orientation.
  assert.equal(shapeOrientationCount(UNIT_SQUARE.shape), 1);
  // L-tromino: the diagonal reflection is a symmetry, so 8/2 = 4.
  assert.equal(shapeOrientationCount(L_TROMINO), 4);
  // A fully asymmetric shape would have all 8.
  const skew = {
    name: "skew",
    cells: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
    ],
  };
  assert.equal(shapeOrientationCount(skew), 8);
});

test("wallpaper group symbols for known tilings", () => {
  assert.equal(wallpaperGroup(UNIT_SQUARE), "p4m");
  assert.equal(wallpaperGroup(L_TROMINO_BRICK), "p2");
});

test("the L-tromino realises the centred groups cm and cmm", () => {
  const cm: TessellationDef = {
    name: "cm",
    shape: L_TROMINO,
    basis1: { x: -5, y: -2 },
    basis2: { x: 1, y: 1 },
    placements: [{ offset: { x: 0, y: 0 }, orientation: 0 }],
  };
  assert.ok(validateTessellation(cm).valid);
  assert.equal(wallpaperGroup(cm), "cm");

  const cmm: TessellationDef = {
    name: "cmm",
    shape: L_TROMINO,
    basis1: { x: -3, y: -2 },
    basis2: { x: -3, y: 2 },
    placements: [
      { offset: { x: 0, y: 0 }, orientation: 0 },
      { offset: { x: 2, y: 1 }, orientation: 2 },
      { offset: { x: 0, y: -1 }, orientation: 3 },
      { offset: { x: -1, y: 0 }, orientation: 1 },
    ],
  };
  assert.ok(validateTessellation(cmm).valid);
  assert.equal(wallpaperGroup(cmm), "cmm");
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
