import assert from "node:assert/strict";
import { test } from "node:test";
import {
  OWNER_EMPTY,
  OWNER_LAB,
  OWNER_PLAYER_A,
  OWNER_PLAYER_B,
  ROLE_CORE,
  ROLE_NORMAL,
  ageOf,
  integrityOf,
  orientationOf,
  ownerOf,
  packCell,
  paletteIndex,
  roleOf,
  shadeOf,
} from "./cell.ts";

test("packed cells round-trip every field", () => {
  const cell = packCell({
    owner: OWNER_PLAYER_B,
    orientation: 5,
    shade: 1,
    role: ROLE_CORE,
    integrity: 77,
    age: 9,
  });
  assert.equal(ownerOf(cell), OWNER_PLAYER_B);
  assert.equal(orientationOf(cell), 5);
  assert.equal(shadeOf(cell), 1);
  assert.equal(roleOf(cell), ROLE_CORE);
  assert.equal(integrityOf(cell), 77);
  assert.equal(ageOf(cell), 9);
});

test("fields do not bleed into each other", () => {
  const cell = packCell({
    owner: OWNER_PLAYER_A,
    orientation: 7,
    shade: 1,
    role: 0xf,
    integrity: 0xff,
    age: 0xff,
  });
  assert.equal(ownerOf(cell), OWNER_PLAYER_A);
  assert.equal(orientationOf(cell), 7);
  assert.equal(shadeOf(cell), 1);
  assert.equal(roleOf(cell), 0xf);
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
