import assert from "node:assert/strict";
import { test } from "node:test";
import {
  OWNER_EMPTY,
  OWNER_LAB,
  OWNER_PLAYER_A,
  OWNER_PLAYER_B,
  ROLE_CORE,
  ROLE_NORMAL,
  orientationOf,
  ownerOf,
  packCell,
  paletteIndex,
  roleOf,
  shadeOf,
  tagOf,
  tileKey,
} from "./cell.ts";

test("packed cells round-trip every field", () => {
  const cell = packCell({
    owner: OWNER_PLAYER_B,
    orientation: 5,
    shade: 1,
    role: ROLE_CORE,
    tag: 0xabcd,
  });
  assert.equal(ownerOf(cell), OWNER_PLAYER_B);
  assert.equal(orientationOf(cell), 5);
  assert.equal(shadeOf(cell), 1);
  assert.equal(roleOf(cell), ROLE_CORE);
  assert.equal(tagOf(cell), 0xabcd);
});

test("fields do not bleed into each other", () => {
  const cell = packCell({
    owner: OWNER_PLAYER_A,
    orientation: 7,
    shade: 1,
    role: 0xf,
    tag: 0xffff,
  });
  assert.equal(ownerOf(cell), OWNER_PLAYER_A);
  assert.equal(orientationOf(cell), 7);
  assert.equal(shadeOf(cell), 1);
  assert.equal(roleOf(cell), 0xf);
  assert.equal(tagOf(cell), 0xffff);
});

test("empty and lab owners are distinct", () => {
  assert.equal(ownerOf(packCell({ owner: OWNER_EMPTY })), 0);
  assert.equal(ownerOf(packCell({ owner: OWNER_LAB })), OWNER_LAB);
  assert.equal(roleOf(packCell({ owner: OWNER_LAB })), ROLE_NORMAL);
});

test("paletteIndex follows orientation then shade", () => {
  assert.equal(paletteIndex(packCell({ owner: OWNER_LAB, orientation: 3 })), 3);
  assert.equal(
    paletteIndex(packCell({ owner: OWNER_LAB, orientation: 3, shade: 1 })),
    11,
  );
});

test("tileKey ignores orientation and shade but keeps owner and tag", () => {
  const a = packCell({ owner: OWNER_PLAYER_A, orientation: 1, shade: 1, tag: 7 });
  const b = packCell({ owner: OWNER_PLAYER_A, orientation: 6, shade: 0, tag: 7 });
  const c = packCell({ owner: OWNER_PLAYER_A, orientation: 1, shade: 1, tag: 8 });
  assert.equal(tileKey(a), tileKey(b));
  assert.notEqual(tileKey(a), tileKey(c));
});
