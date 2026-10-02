import assert from "node:assert/strict";
import { test } from "node:test";
import { transformedCells } from "../model/shape.ts";
import { L_TROMINO, L_TROMINO_BRICK, UNIT_SQUARE } from "../model/builtins.ts";
import { sameTessellation } from "./canonical.ts";
import { findTessellations } from "./find.ts";
import { analyzeSymmetry } from "./symmetry.ts";

test("finds the L-tromino brick", () => {
  const found = findTessellations(L_TROMINO, {
    maxBasis: 4,
    maxCovolume: 16,
    maxPlacements: 8,
    maxResults: 500,
  });
  assert.ok(found.length > 0, "expected at least one tiling");
  assert.ok(
    found.some((def) => sameTessellation(def, L_TROMINO_BRICK)),
    "expected the 2x3 brick tiling",
  );
});

test("finds a tiling for the unit square", () => {
  const found = findTessellations(UNIT_SQUARE.shape, {
    maxBasis: 3,
    maxCovolume: 8,
    maxPlacements: 4,
    maxResults: 20,
  });
  assert.ok(found.length > 0);
});

test("an empty shape finds nothing", () => {
  assert.deepEqual(findTessellations({ name: "empty", cells: [] }), []);
});

test("results are single-orbit tilings", () => {
  const found = findTessellations(L_TROMINO, {
    maxBasis: 4,
    maxCovolume: 16,
    maxPlacements: 8,
    maxResults: 200,
  });
  assert.ok(found.length > 0);
  for (const def of found) {
    assert.equal(
      analyzeSymmetry(def).orbitCount,
      1,
      "a multi-orbit tiling slipped through",
    );
  }
});

test("results contain the drawn shape, in its drawn orientation, at the origin", () => {
  const found = findTessellations(L_TROMINO, {
    maxBasis: 4,
    maxCovolume: 16,
    maxPlacements: 8,
    maxResults: 200,
  });
  const drawn = transformedCells(L_TROMINO, 0)
    .map((c) => `${c.x},${c.y}`)
    .sort()
    .join("|");
  for (const def of found) {
    const identity = def.placements.filter((p) => p.orientation === 0);
    assert.ok(identity.length > 0, "no as-drawn placement");
    const atOrigin = identity.some((p) =>
      transformedCells(def.shape, p.orientation)
        .map((c) =>
          `${c.x + p.offset.x},${c.y + p.offset.y}`,
        )
        .sort()
        .join("|") === drawn,
    );
    assert.ok(atOrigin, "the drawn shape is not at the origin");
  }
});
