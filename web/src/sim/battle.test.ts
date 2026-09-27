import assert from "node:assert/strict";
import { test } from "node:test";
import { OWNER_PLAYER_A, OWNER_PLAYER_B } from "../core/cell.ts";
import { L_TROMINO_BRICK, UNIT_SQUARE } from "../model/builtins.ts";
import { Battle, type BattleConfig } from "./battle.ts";

function config(
  participants: BattleConfig["participants"],
  size = 64,
): BattleConfig {
  return { width: size, height: size, participants };
}

test("a lone tessellation grows a filled diamond", () => {
  const battle = new Battle(
    config([
      {
        name: "solo",
        owner: OWNER_PLAYER_A,
        def: UNIT_SQUARE,
        seed: { x: 32, y: 32 },
      },
    ]),
  );
  battle.run(3);
  // Edge adjacency makes each layer a diamond: 2t^2 + 2t + 1 cells after t.
  assert.equal(battle.world.countOwner(OWNER_PLAYER_A), 25);
  assert.equal(battle.tickCount, 3);
});

test("growth is deterministic across identical battles", () => {
  const build = (): Battle =>
    new Battle(
      config([
        {
          name: "A",
          owner: OWNER_PLAYER_A,
          def: L_TROMINO_BRICK,
          seed: { x: 20, y: 32 },
        },
        {
          name: "B",
          owner: OWNER_PLAYER_B,
          def: UNIT_SQUARE,
          seed: { x: 44, y: 32 },
        },
      ]),
    );
  const first = build();
  const second = build();
  first.run(25);
  second.run(25);
  assert.deepEqual(Array.from(first.world.cells), Array.from(second.world.cells));
  assert.deepEqual(first.snapshots(), second.snapshots());
});

test("simultaneous claims on the same cell are razed", () => {
  const battle = new Battle(
    config([
      {
        name: "A",
        owner: OWNER_PLAYER_A,
        def: UNIT_SQUARE,
        seed: { x: 31, y: 32 },
      },
      {
        name: "B",
        owner: OWNER_PLAYER_B,
        def: UNIT_SQUARE,
        seed: { x: 33, y: 32 },
      },
    ]),
  );
  battle.run(5);
  const snapshots = battle.snapshots();
  assert.ok(battle.contestedCells > 0);
  assert.ok(snapshots[0].cells > 0, "A survives");
  assert.ok(snapshots[1].cells > 0, "B survives");
});

test("a faster pattern holds more ground", () => {
  const battle = new Battle(
    config([
      {
        name: "fast",
        owner: OWNER_PLAYER_A,
        def: UNIT_SQUARE,
        seed: { x: 12, y: 32 },
        ringsPerTick: 2,
      },
      {
        name: "slow",
        owner: OWNER_PLAYER_B,
        def: UNIT_SQUARE,
        seed: { x: 52, y: 32 },
        ringsPerTick: 1,
      },
    ]),
  );
  battle.run(18);
  const snapshots = battle.snapshots();
  assert.ok(
    snapshots[0].cells > snapshots[1].cells,
    `expected fast (${snapshots[0].cells}) > slow (${snapshots[1].cells})`,
  );
});

test("reset reproduces the opening position", () => {
  const battle = new Battle(
    config([
      {
        name: "A",
        owner: OWNER_PLAYER_A,
        def: L_TROMINO_BRICK,
        seed: { x: 20, y: 32 },
      },
      {
        name: "B",
        owner: OWNER_PLAYER_B,
        def: L_TROMINO_BRICK,
        seed: { x: 44, y: 32 },
      },
    ]),
  );
  battle.run(10);
  const after = Array.from(battle.world.cells);
  battle.reset();
  battle.run(10);
  assert.deepEqual(Array.from(battle.world.cells), after);
  assert.equal(battle.tickCount, 10);
});
