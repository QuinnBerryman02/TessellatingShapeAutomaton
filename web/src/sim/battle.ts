import { ownerOf, packCell, ROLE_CORE, ROLE_NORMAL } from "../core/cell.ts";
import type { Vec2 } from "../core/vec2.ts";
import type { TessellationDef } from "../model/tessellation.ts";
import { GrowPattern, type TileInstance } from "./grow.ts";
import { WorldGrid } from "./world.ts";

export interface ParticipantConfig {
  readonly name: string;
  readonly owner: number;
  readonly def: TessellationDef;
  /** World cell the pattern is seeded from (its core tile). */
  readonly seed: Vec2;
  /** How many tile layers the pattern advances each tick. Default 1. */
  readonly ringsPerTick?: number;
  /** Stop growing tiles whose anchor is farther than this (world cells). */
  readonly maxRadius?: number;
}

export interface ParticipantSnapshot {
  readonly name: string;
  readonly owner: number;
  readonly cells: number;
  readonly tiles: number;
  readonly destroyed: number;
}

export interface BattleConfig {
  readonly width: number;
  readonly height: number;
  readonly participants: readonly ParticipantConfig[];
}

interface FrontierEntry {
  readonly instance: TileInstance;
  readonly dist2: number;
}

interface CellClaim {
  readonly index: number;
  readonly owner: number;
  readonly value: number;
}

/**
 * One participant's growing tessellation. Claiming is decoupled from writing:
 * `planTick` advances the internal tile flood and returns the cells it wants,
 * and the {@link Battle} resolves everyone's claims together so simultaneous
 * clashes are handled symmetrically.
 */
class Expander {
  readonly config: ParticipantConfig;
  readonly pattern: GrowPattern;
  readonly claimed = new Set<string>();
  destroyed = 0;

  private readonly frontier = new Map<string, FrontierEntry>();
  private readonly seedAnchor: Vec2;
  private readonly cellBuffer: Vec2[] = [];
  private nextTag = 0;

  constructor(config: ParticipantConfig, world: WorldGrid) {
    this.config = config;
    this.pattern = new GrowPattern(config.def);
    const seed = this.pattern.instanceAt(config.seed);
    if (!seed) {
      throw new Error(`seed ${config.seed.x},${config.seed.y} is not tiled`);
    }
    this.seedAnchor = this.pattern.base(seed);
    this.claimed.add(this.pattern.key(seed));
    this.writeSeed(seed, world);
    this.extendFrontier(seed);
  }

  get tileCount(): number {
    return this.claimed.size;
  }

  /** Advances `rings` layers and returns the world cells to claim. */
  planTick(world: WorldGrid, rings: number): CellClaim[] {
    const claims: CellClaim[] = [];
    const layers = Math.max(1, Math.floor(rings));
    for (let layer = 0; layer < layers; layer++) {
      const entries = [...this.frontier.values()].sort(compareEntries);
      if (entries.length === 0) break;
      for (const entry of entries) {
        this.claim(entry.instance);
        this.emit(entry.instance, world, claims);
      }
    }
    return claims;
  }

  private claim(instance: TileInstance): void {
    const key = this.pattern.key(instance);
    if (this.claimed.has(key)) return;
    this.claimed.add(key);
    this.frontier.delete(key);
    this.extendFrontier(instance);
  }

  private extendFrontier(instance: TileInstance): void {
    const { maxRadius } = this.config;
    for (const neighbor of this.pattern.neighborInstances(instance)) {
      const key = this.pattern.key(neighbor);
      if (this.claimed.has(key) || this.frontier.has(key)) continue;
      const anchor = this.pattern.base(neighbor);
      const dist2 =
        (anchor.x - this.seedAnchor.x) ** 2 +
        (anchor.y - this.seedAnchor.y) ** 2;
      if (maxRadius !== undefined && dist2 > maxRadius * maxRadius) continue;
      this.frontier.set(key, { instance: neighbor, dist2 });
    }
  }

  /** The seed tile is the core, marked so the renderer can highlight it. */
  private writeSeed(seed: TileInstance, world: WorldGrid): void {
    const value = this.cellValue(seed, ROLE_CORE, this.nextTag++);
    for (const cell of this.pattern.cells(seed, this.cellBuffer)) {
      if (world.inBounds(cell.x, cell.y)) {
        world.set(cell.x, cell.y, value);
      }
    }
  }

  private emit(instance: TileInstance, world: WorldGrid, out: CellClaim[]): void {
    const value = this.cellValue(instance, ROLE_NORMAL, this.nextTag++);
    for (const cell of this.pattern.cells(instance, this.cellBuffer)) {
      if (!world.inBounds(cell.x, cell.y)) continue;
      out.push({
        index: world.index(cell.x, cell.y),
        owner: this.config.owner,
        value,
      });
    }
  }

  private cellValue(instance: TileInstance, role: number, tag: number): number {
    const orientation =
      this.pattern.def.placements[instance.placement].orientation;
    const shade = (((instance.m + instance.n) % 2) + 2) % 2;
    return packCell({
      owner: this.config.owner,
      orientation,
      shade,
      role,
      tag: tag & 0xffff,
    });
  }
}

function compareEntries(a: FrontierEntry, b: FrontierEntry): number {
  if (a.dist2 !== b.dist2) return a.dist2 - b.dist2;
  const ka = `${a.instance.placement}:${a.instance.m}:${a.instance.n}`;
  const kb = `${b.instance.placement}:${b.instance.m}:${b.instance.n}`;
  return ka < kb ? -1 : ka > kb ? 1 : 0;
}

/**
 * A deterministic match between two or more growing tessellations over a shared
 * world. Every tick, each participant advances by `ringsPerTick` tile layers;
 * claims are then applied together. A cell claimed by one participant is taken
 * (destroying any previous owner); a cell claimed by several at once is razed.
 */
export class Battle {
  readonly world: WorldGrid;
  readonly config: BattleConfig;
  tickCount = 0;
  contestedCells = 0;

  private expanders: Expander[];

  constructor(config: BattleConfig) {
    const owners = new Set(config.participants.map((p) => p.owner));
    if (owners.size !== config.participants.length) {
      throw new Error("participants must have distinct owners");
    }
    this.config = config;
    this.world = new WorldGrid(config.width, config.height);
    this.expanders = config.participants.map((p) => new Expander(p, this.world));
  }

  reset(): void {
    this.world.clear();
    this.tickCount = 0;
    this.contestedCells = 0;
    this.expanders = this.config.participants.map(
      (p) => new Expander(p, this.world),
    );
  }

  step(): void {
    const pending = new Map<number, CellClaim>();
    const contested = new Set<number>();
    for (const expander of this.expanders) {
      const claims = expander.planTick(
        this.world,
        expander.config.ringsPerTick ?? 1,
      );
      for (const claim of claims) {
        if (contested.has(claim.index)) continue;
        const existing = pending.get(claim.index);
        if (existing === undefined) {
          pending.set(claim.index, claim);
        } else {
          pending.delete(claim.index);
          contested.add(claim.index);
        }
      }
    }

    for (const claim of pending.values()) {
      const previous = ownerOf(this.world.cells[claim.index]);
      if (previous !== 0 && previous !== claim.owner) {
        const expander = this.expanders.find(
          (e) => e.config.owner === claim.owner,
        );
        if (expander) expander.destroyed++;
      }
      this.world.cells[claim.index] = claim.value;
    }

    this.contestedCells += contested.size;
    for (const index of contested) {
      this.world.cells[index] = 0;
    }

    this.tickCount++;
  }

  run(ticks: number): void {
    for (let i = 0; i < ticks; i++) this.step();
  }

  snapshots(): ParticipantSnapshot[] {
    return this.config.participants.map((config, i) => ({
      name: config.name,
      owner: config.owner,
      cells: this.world.countOwner(config.owner),
      tiles: this.expanders[i].tileCount,
      destroyed: this.expanders[i].destroyed,
    }));
  }
}
