import assert from "node:assert/strict";
import { test } from "node:test";
import { L_TROMINO, UNIT_SQUARE } from "../model/builtins.ts";
import { findTessellations } from "../solver/find.ts";
import {
  containsTile,
  filterCandidates,
  placementCells,
  tileKeyAt,
} from "./puzzle.ts";
import type { ProPlacement } from "./types.ts";

const OPTS = {
  maxBasis: 4,
  maxCovolume: 16,
  maxPlacements: 8,
  maxResults: 500,
};

const SEED: ProPlacement = { orientation: 0, offset: { x: 0, y: 0 } };

test("the seed tile is contained in every target tiling", () => {
  const targets = findTessellations(L_TROMINO, OPTS);
  assert.equal(targets.length, 12);
  for (const def of targets) {
    assert.ok(containsTile(def, SEED), "seed missing from a tiling");
  }
});

test("placing a mirror neighbour collapses the L-tromino to one candidate", () => {
  const targets = findTessellations(L_TROMINO, OPTS);
  // Identity-oriented tile whose cells are (-2,1),(-1,1),(-2,2).
  const placement: ProPlacement = {
    orientation: 0,
    offset: { x: -2, y: 1 },
  };
  const survivors = filterCandidates(targets, placement);
  assert.equal(survivors.length, 1);
});

test("a tile overlapping the seed cannot extend any pool", () => {
  const targets = findTessellations(L_TROMINO, OPTS);
  const pool = filterCandidates(targets, SEED);
  const overlapping: ProPlacement = {
    orientation: 0,
    offset: { x: 1, y: 0 },
  };
  assert.equal(filterCandidates(pool, overlapping).length, 0);
});

test("tileKeyAt agrees for two cells of the same tile", () => {
  const [def] = findTessellations(L_TROMINO, OPTS);
  assert.ok(def);
  const a = tileKeyAt(def, { x: 0, y: 0 });
  const b = tileKeyAt(def, { x: 1, y: 0 });
  assert.ok(a && b);
  assert.equal(a.key, b.key);
  assert.equal(a.orientation, b.orientation);
});

test("the unit square has a single target and every place keeps it", () => {
  const targets = findTessellations(UNIT_SQUARE.shape, OPTS);
  assert.equal(targets.length, 1);
  const pool = filterCandidates(targets, SEED);
  const neighbour: ProPlacement = {
    orientation: 0,
    offset: { x: 1, y: 0 },
  };
  assert.equal(filterCandidates(pool, neighbour).length, 1);
});

test("placementCells applies the orientation and offset", () => {
  const cells = placementCells(L_TROMINO, {
    orientation: 1, // R90: (x,y) -> (-y,x)
    offset: { x: 3, y: 0 },
  });
  // L-tromino {(0,0),(1,0),(0,1)} under R90 -> {(0,0),(0,1),(-1,0)},
  // translated by (3,0): {(3,0),(3,1),(2,0)}.
  const keys = cells.map((c) => `${c.x},${c.y}`).sort();
  assert.deepEqual(keys, ["2,0", "3,0", "3,1"]);
});
