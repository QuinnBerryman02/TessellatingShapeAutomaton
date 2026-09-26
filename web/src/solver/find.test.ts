import assert from "node:assert/strict";
import { test } from "node:test";
import { L_TROMINO, L_TROMINO_BRICK, UNIT_SQUARE } from "../model/builtins.ts";
import { sameTessellation } from "./canonical.ts";
import { findTessellations } from "./find.ts";

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
