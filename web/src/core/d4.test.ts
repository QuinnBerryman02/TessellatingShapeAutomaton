import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyD4,
  composeD4,
  D4_IDENTITY,
  D4_NAMES,
  inverseD4,
  type D4,
} from "./d4.ts";

const ALL: D4[] = D4_NAMES.map((_, i) => i as D4);

test("identity is neutral", () => {
  for (const g of ALL) {
    assert.equal(composeD4(g, D4_IDENTITY), g);
    assert.equal(composeD4(D4_IDENTITY, g), g);
  }
});

test("every element has an inverse", () => {
  for (const g of ALL) {
    assert.equal(composeD4(g, inverseD4(g)), D4_IDENTITY);
    assert.equal(composeD4(inverseD4(g), g), D4_IDENTITY);
  }
});

test("the set is closed under composition", () => {
  for (const a of ALL) {
    for (const b of ALL) {
      assert.ok(ALL.includes(composeD4(a, b)));
    }
  }
});

test("composition is associative", () => {
  for (const a of ALL) {
    for (const b of ALL) {
      for (const c of ALL) {
        assert.equal(
          composeD4(composeD4(a, b), c),
          composeD4(a, composeD4(b, c)),
        );
      }
    }
  }
});

test("apply matches the documented coordinate transforms", () => {
  const p = { x: 3, y: -2 };
  assert.deepEqual(applyD4(0, p), { x: 3, y: -2 });
  assert.deepEqual(applyD4(1, p), { x: 2, y: 3 });
  assert.deepEqual(applyD4(2, p), { x: -3, y: 2 });
  assert.deepEqual(applyD4(3, p), { x: -2, y: -3 });
  assert.deepEqual(applyD4(4, p), { x: -3, y: -2 });
  assert.deepEqual(applyD4(5, p), { x: 3, y: 2 });
  assert.deepEqual(applyD4(6, p), { x: 2, y: -3 });
  assert.deepEqual(applyD4(7, p), { x: -2, y: 3 });
});

test("compose applies the left element first", () => {
  const p = { x: 5, y: 1 };
  for (const a of ALL) {
    for (const b of ALL) {
      assert.deepEqual(
        applyD4(composeD4(a, b), p),
        applyD4(b, applyD4(a, p)),
      );
    }
  }
});
