import assert from "node:assert/strict";
import { test } from "node:test";
import { OWNER_LAB, ownerOf, tagOf } from "../core/cell.ts";
import { L_TROMINO_BRICK, UNIT_SQUARE } from "./builtins.ts";
import {
  covolume,
  fromJSON,
  rasterize,
  toJSON,
} from "./tessellation.ts";

test("the unit square fills the whole grid", () => {
  const raster = rasterize(UNIT_SQUARE, { minX: -4, minY: -4, maxX: 4, maxY: 4 });
  assert.equal(raster.width, 9);
  assert.equal(raster.height, 9);
  assert.ok(raster.cells.every((v) => ownerOf(v) === OWNER_LAB));
});

test("the L-tromino brick leaves no holes", () => {
  const raster = rasterize(L_TROMINO_BRICK, {
    minX: 0,
    minY: 0,
    maxX: 19,
    maxY: 19,
  });
  const holes = Array.from(raster.cells).filter((v) => v === 0).length;
  assert.equal(holes, 0);
});

test("the raster tags tile instances so boundaries can be drawn", () => {
  const raster = rasterize(L_TROMINO_BRICK, {
    minX: 0,
    minY: 0,
    maxX: 11,
    maxY: 11,
  });
  const tags = new Set<number>();
  for (const cell of raster.cells) {
    if (cell !== 0) tags.add(tagOf(cell));
  }
  assert.ok(tags.size > 1, `expected several tile tags, got ${tags.size}`);
});

test("covolume is the fundamental cell area", () => {
  assert.equal(covolume(UNIT_SQUARE), 1);
  assert.equal(covolume(L_TROMINO_BRICK), 6);
});

test("tessellations serialise and round-trip", () => {
  assert.deepEqual(fromJSON(toJSON(L_TROMINO_BRICK)), L_TROMINO_BRICK);
  assert.deepEqual(fromJSON(toJSON(UNIT_SQUARE)), UNIT_SQUARE);
});
