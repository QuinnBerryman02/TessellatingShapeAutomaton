import assert from "node:assert/strict";
import { test } from "node:test";
import { L_TROMINO_BRICK, UNIT_SQUARE } from "../model/builtins.ts";
import { GrowPattern } from "./grow.ts";

test("the unit square has its four edge neighbours", () => {
  const pattern = new GrowPattern(UNIT_SQUARE);
  const keys = pattern.neighbors[0]
    .map((r) => `${r.placement}:${r.dm}:${r.dn}`)
    .sort();
  assert.deepEqual(keys, ["0:-1:0", "0:0:-1", "0:0:1", "0:1:0"]);
});

test("instanceAt inverts the lattice exactly", () => {
  const pattern = new GrowPattern(UNIT_SQUARE);
  assert.deepEqual(pattern.instanceAt({ x: 3, y: -2 }), {
    placement: 0,
    m: 3,
    n: -2,
  });
});

test("an L-tromino brick covers exactly three cells", () => {
  const pattern = new GrowPattern(L_TROMINO_BRICK);
  assert.equal(pattern.cellsPerTile, 3);
  const instance = pattern.instanceAt({ x: 0, y: 0 });
  assert.ok(instance);
  assert.equal(pattern.cells(instance).length, 3);
  assert.ok(pattern.neighbors[instance.placement].length > 0);
});

test("translated L-tromino bricks never overlap", () => {
  const pattern = new GrowPattern(L_TROMINO_BRICK);
  const seen = new Set<string>();
  for (let m = -3; m <= 3; m++) {
    for (let n = -3; n <= 3; n++) {
      for (let p = 0; p < pattern.placementCount; p++) {
        for (const cell of pattern.cells({ placement: p, m, n })) {
          const key = `${cell.x},${cell.y}`;
          assert.ok(!seen.has(key), `two tile instances cover ${key}`);
          seen.add(key);
        }
      }
    }
  }
});
