import assert from "node:assert/strict";
import { test } from "node:test";
import { transformedCells } from "../model/shape.ts";
import { L_TROMINO, L_TROMINO_BRICK, UNIT_SQUARE } from "../model/builtins.ts";
import { sameTessellation } from "./canonical.ts";
import { findTessellations } from "./find.ts";
import { analyzeSymmetry, wallpaperGroup } from "./symmetry.ts";

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

test("the L-tetromino finds both mirror and glide tilings", () => {
  const shape = {
    name: "L4",
    cells: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
    ],
  };
  const found = findTessellations(shape, {
    maxBasis: 4,
    maxCovolume: 16,
    maxPlacements: 8,
    maxResults: 64,
  });
  const groups = new Set(found.map((def) => wallpaperGroup(def)));
  // A reflection whose translations are all glides is pg, not pm.
  assert.ok(groups.has("pg"), `expected pg among ${[...groups].join(",")}`);
  assert.ok(groups.has("pm"), `expected pm among ${[...groups].join(",")}`);
  assert.ok(groups.has("p1"), `expected p1 among ${[...groups].join(",")}`);
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
