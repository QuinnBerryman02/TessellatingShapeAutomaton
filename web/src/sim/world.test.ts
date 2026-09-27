import assert from "node:assert/strict";
import { test } from "node:test";
import {
  OWNER_EMPTY,
  OWNER_PLAYER_A,
  OWNER_PLAYER_B,
  ownerOf,
  packCell,
} from "../core/cell.ts";
import { WorldGrid } from "./world.ts";

test("bounds and indexing are row-major", () => {
  const world = new WorldGrid(4, 3);
  assert.equal(world.index(2, 1), 6);
  assert.ok(world.inBounds(3, 2));
  assert.ok(!world.inBounds(4, 2));
  assert.ok(!world.inBounds(0, -1));
});

test("ownerAt reads back the packed owner", () => {
  const world = new WorldGrid(2, 2);
  world.set(1, 0, packCell({ owner: OWNER_PLAYER_A }));
  world.set(0, 1, packCell({ owner: OWNER_PLAYER_B }));
  assert.equal(world.ownerAt(1, 0), OWNER_PLAYER_A);
  assert.equal(world.ownerAt(0, 1), OWNER_PLAYER_B);
  assert.equal(world.ownerAt(0, 0), OWNER_EMPTY);
});

test("histogram and countOwner agree", () => {
  const world = new WorldGrid(3, 1);
  for (let x = 0; x < 3; x++) {
    world.set(x, 0, packCell({ owner: x === 0 ? OWNER_PLAYER_A : OWNER_PLAYER_B }));
  }
  assert.equal(world.countOwner(OWNER_PLAYER_A), 1);
  assert.equal(world.countOwner(OWNER_PLAYER_B), 2);
  const counts = world.histogram();
  assert.equal(counts.get(OWNER_PLAYER_A), 1);
  assert.equal(counts.get(OWNER_PLAYER_B), 2);
  assert.equal(counts.get(OWNER_EMPTY), undefined);
  assert.ok(ownerOf(world.at(0, 0)) === OWNER_PLAYER_A);
});
