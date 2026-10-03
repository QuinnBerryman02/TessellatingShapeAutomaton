import {
  OWNER_PROG_BAD,
  OWNER_PROG_CURSOR,
  OWNER_PROG_FORCED,
  OWNER_PROG_GHOST,
  OWNER_PROG_PLACED,
  OWNER_PROG_SEED,
  packCell,
  paletteIndex,
} from "../core/cell.ts";
import { composeD4, D4_NAMES, type D4 } from "../core/d4.ts";
import { keyVec, type Vec2 } from "../core/vec2.ts";
import type { GridScene } from "../gpu/gridScene.ts";
import { transformedCells, type ShapeDef } from "../model/shape.ts";
import { rasterize, type TessellationDef } from "../model/tessellation.ts";
import { canonicalSignature } from "../solver/canonical.ts";
import { wallpaperGroup } from "../solver/symmetry.ts";
import { buildLevelList, computeTargets, type LevelInfo } from "./levels.ts";
import { loadProgress, saveProgress, type ProgSave } from "./progress.ts";
import {
  containsTile,
  filterCandidates,
  hashKey,
  overlaps,
  placementCells,
  tileKeyAt,
} from "./puzzle.ts";
import type { ProPlacement } from "./types.ts";

/**
 * The progression mode controller. Owns one level at a time: the player places
 * copies of the tile and we keep the set of target tessellations still
 * consistent with every placement. Cells every candidate agrees on are revealed
 * as forced, new reveals spread outward from the placed tile, and a collapsed
 * candidate set triggers the zoom-out discovery animation.
 */

const WALLPAPER_ORDER = [
  "p1",
  "p2",
  "pm",
  "pg",
  "cm",
  "pmm",
  "pmg",
  "pgg",
  "cmm",
  "p4",
  "p4m",
  "p4g",
];

const THUMB_PALETTE = [
  "#33cce6",
  "#e666cc",
  "#80e666",
  "#f2cc4d",
  "#598ce6",
  "#f27366",
  "#a673f2",
  "#8ce6bf",
  "#1c7080",
  "#7f3870",
  "#467f38",
  "#85702a",
  "#314d7f",
  "#853f38",
  "#5c407f",
  "#4d7f68",
];

/** Milliseconds for the forced-fill wave to travel one cell. */
const WAVE_MS_PER_CELL = 30;
const SOLVE_OUT_MS = 1100;
const SOLVE_HOLD_MS = 800;
const SOLVE_IN_MS = 900;

interface Wave {
  readonly old: Uint32Array;
  readonly next: Uint32Array;
  readonly delays: Uint16Array;
  readonly start: number;
  readonly maxDelay: number;
}

interface SolveAnim {
  readonly board: Uint32Array;
  readonly signature: string;
  readonly start: number;
  readonly from: number;
  readonly to: number;
}

export interface ProgressionOptions {
  readonly scene: GridScene;
  readonly canvas: HTMLCanvasElement;
  readonly root: HTMLElement;
  readonly onStatus: (text: string) => void;
}

export interface ProgressionState {
  readonly levelId: string;
  readonly levelIndex: number;
  readonly size: number;
  readonly found: number;
  readonly total: number;
  readonly pool: number;
  readonly placements: number;
}

const SEED: ProPlacement = { orientation: 0, offset: { x: 0, y: 0 } };

function easeInOut(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c < 0.5 ? 2 * c * c : 1 - (1 - c) * (1 - c) * 2;
}

function element<T extends HTMLElement>(root: ParentNode, id: string): T {
  const found = root.querySelector<T>(`#${id}`);
  if (!found) throw new Error(`missing #${id}`);
  return found;
}

export class Progression {
  private readonly scene: GridScene;
  private readonly canvas: HTMLCanvasElement;
  private readonly onStatus: (text: string) => void;

  private readonly infos: LevelInfo[];
  private readonly targetsCache = new Map<string, TessellationDef[]>();

  private readonly titleEl: HTMLElement;
  private readonly progressEl: HTMLElement;
  private readonly galleryEl: HTMLElement;
  private readonly messageEl: HTMLElement;
  private readonly hintButton: HTMLButtonElement;
  private readonly prevButton: HTMLButtonElement;
  private readonly nextButton: HTMLButtonElement;

  private save: ProgSave;
  private index = 0;
  private level: LevelInfo | null = null;
  private allTargets: TessellationDef[] = [];
  private remaining: TessellationDef[] = [];
  private pool: TessellationDef[] = [];
  private found = new Set<string>();
  private placements: ProPlacement[] = [SEED];
  private occupied = new Set<string>();

  private board: Uint32Array;
  private frame: Uint32Array;
  private wave: Wave | null = null;
  private solve: SolveAnim | null = null;
  private pendingSolve = false;

  private active = false;
  private dirty = false;
  private hintOn = false;
  private brush: D4 = 0;
  private brushAnchor: Vec2 | null = null;
  private readonly cx: number;
  private readonly cy: number;
  private playRadius = 6;

  constructor(options: ProgressionOptions) {
    this.scene = options.scene;
    this.canvas = options.canvas;
    this.onStatus = options.onStatus;
    this.infos = buildLevelList();
    this.save = loadProgress();
    this.cx = Math.floor(this.scene.width / 2);
    this.cy = Math.floor(this.scene.height / 2);

    const n = this.scene.width * this.scene.height;
    this.board = new Uint32Array(n);
    this.frame = new Uint32Array(n);

    this.titleEl = element(options.root, "prog-level");
    this.progressEl = element(options.root, "prog-progress");
    this.galleryEl = element(options.root, "prog-gallery");
    this.messageEl = element(options.root, "prog-message");
    this.hintButton = element(options.root, "prog-hint");
    this.prevButton = element(options.root, "prog-prev");
    this.nextButton = element(options.root, "prog-next");

    element(options.root, "prog-reset").addEventListener("click", () =>
      this.resetLevel(),
    );
    element(options.root, "prog-rotate").addEventListener("click", () =>
      this.rotate(),
    );
    element(options.root, "prog-flip").addEventListener("click", () =>
      this.flip(),
    );
    element(options.root, "prog-undo").addEventListener("click", () =>
      this.undo(),
    );
    this.hintButton.addEventListener("click", () => this.toggleHint());
    this.prevButton.addEventListener("click", () => this.go(-1));
    this.nextButton.addEventListener("click", () => this.go(1));

    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointerleave", this.onPointerLeave);
    this.canvas.addEventListener("contextmenu", (event) =>
      event.preventDefault(),
    );
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
    window.addEventListener("keydown", this.onKeyDown);
  }

  get isActive(): boolean {
    return this.active;
  }

  enter(): void {
    this.active = true;
    if (!this.level) {
      const startIndex = Math.min(
        Math.max(0, this.save.currentLevel),
        this.infos.length - 1,
      );
      this.loadLevel(startIndex);
      return;
    }
    // Keep any in-progress round; just re-show it.
    this.scene.setZoom(this.playZoom());
    this.frame.set(this.board);
    this.stampCursor();
    this.scene.setCells(this.frame);
    this.dirty = false;
  }

  leave(): void {
    this.active = false;
    this.brushAnchor = null;
  }

  state(): ProgressionState {
    return {
      levelId: this.level?.id ?? "",
      levelIndex: this.index,
      size: this.level?.size ?? 0,
      found: this.found.size,
      total: this.allTargets.length,
      pool: this.pool.length,
      placements: this.placements.length,
    };
  }

  // ---------------------------------------------------------------- levels

  private loadLevel(index: number): void {
    this.index = index;
    this.level = this.infos[index];
    this.allTargets = this.targetsFor(this.level);
    const foundList = this.save.found[this.level.id] ?? [];
    this.found = new Set(foundList);
    this.remaining = this.allTargets.filter(
      (def) => !this.found.has(canonicalSignature(def)),
    );
    this.playRadius = playRadiusFor(this.level.shape);
    this.buildGallery();
    this.resetRound();
    this.updateHeader();
    this.persist();
  }

  private targetsFor(level: LevelInfo): TessellationDef[] {
    const cached = this.targetsCache.get(level.id);
    if (cached) return cached;
    const computed = computeTargets(level.shape);
    this.targetsCache.set(level.id, computed);
    return computed;
  }

  private go(delta: number): void {
    if (this.solve) return;
    const next = Math.min(
      Math.max(0, this.index + delta),
      this.infos.length - 1,
    );
    if (next === this.index) return;
    this.loadLevel(next);
  }

  private resetLevel(): void {
    if (!this.level) return;
    const found = { ...this.save.found };
    delete found[this.level.id];
    this.save = { ...this.save, found };
    this.loadLevel(this.index);
    this.setMessage("Level reset.");
  }

  private resetRound(): void {
    if (!this.level) return;
    this.placements = [SEED];
    this.occupied = new Set(
      placementCells(this.level.shape, SEED).map((c) => keyVec(c)),
    );
    this.pool = [...this.remaining];
    this.wave = null;
    this.solve = null;
    this.pendingSolve = false;
    this.board = this.rebuildBoard();
    this.frame.set(this.board);
    this.scene.setZoom(this.playZoom());
    this.scene.setCells(this.frame);
    this.brushAnchor = null;
    this.dirty = false;
    this.updateStatus();
  }

  private get shape(): ShapeDef | null {
    return this.level ? this.level.shape : null;
  }

  private playZoom(): number {
    return this.scene.width / (2 * this.playRadius + 1);
  }

  // --------------------------------------------------------------- board

  private rebuildBoard(): Uint32Array {
    const W = this.scene.width;
    const H = this.scene.height;
    const buf = new Uint32Array(W * H);
    const shape = this.shape;
    if (!shape) return buf;
    const R = this.playRadius;

    if (this.pool.length > 0) {
      for (let py = -R; py <= R; py++) {
        for (let px = -R; px <= R; px++) {
          let covered = 0;
          let key0: string | null = null;
          let orientation: D4 = 0;
          let agree = true;
          for (const def of this.pool) {
            const info = tileKeyAt(def, { x: px, y: py });
            if (!info) continue;
            covered++;
            if (key0 === null) {
              key0 = info.key;
              orientation = info.orientation;
            } else if (info.key !== key0) {
              agree = false;
            }
          }
          if (covered === 0) continue;
          const bx = px + this.cx;
          const by = py + this.cy;
          if (bx < 0 || by < 0 || bx >= W || by >= H) continue;
          if (covered === this.pool.length) {
            buf[by * W + bx] = packCell({
              owner: OWNER_PROG_FORCED,
              orientation: agree ? orientation : 0,
              tag: agree && key0 ? hashKey(key0) & 0xffff : 0,
            });
          } else if (this.hintOn) {
            buf[by * W + bx] = packCell({ owner: OWNER_PROG_GHOST });
          }
        }
      }
    }

    this.placements.forEach((placement, i) => {
      for (const c of placementCells(shape, placement)) {
        const bx = c.x + this.cx;
        const by = c.y + this.cy;
        if (bx < 0 || by < 0 || bx >= W || by >= H) continue;
        buf[by * W + bx] = packCell({
          owner: i === 0 ? OWNER_PROG_SEED : OWNER_PROG_PLACED,
          orientation: placement.orientation,
          tag: i + 1,
        });
      }
    });

    return buf;
  }

  // ---------------------------------------------------------------- input

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (!this.active || this.solve) return;
    const cell = this.scene.screenToCell(event.clientX, event.clientY);
    if (!cell) return;
    const anchor = { x: cell.x - this.cx, y: cell.y - this.cy };
    if (
      !this.brushAnchor ||
      this.brushAnchor.x !== anchor.x ||
      this.brushAnchor.y !== anchor.y
    ) {
      this.brushAnchor = anchor;
      this.dirty = true;
    }
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (!this.active || this.solve) return;
    if (event.button === 2) {
      this.undo();
      return;
    }
    if (event.button !== 0) return;
    event.preventDefault();
    this.place();
  };

  private readonly onPointerLeave = (): void => {
    if (!this.brushAnchor) return;
    this.brushAnchor = null;
    this.dirty = true;
  };

  private readonly onWheel = (event: WheelEvent): void => {
    if (!this.active || this.solve || event.ctrlKey) return;
    event.preventDefault();
    if (event.deltaY > 0) this.rotate();
    else this.rotateBack();
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!this.active || this.solve) return;
    const target = event.target as HTMLElement | null;
    if (target && /^(input|textarea|select)$/i.test(target.tagName)) return;
    switch (event.key.toLowerCase()) {
      case "r":
        event.preventDefault();
        if (event.shiftKey) this.rotateBack();
        else this.rotate();
        break;
      case "e":
        this.rotate();
        break;
      case "q":
        this.rotateBack();
        break;
      case "f":
        this.flip();
        break;
      case "z":
        this.undo();
        break;
      case "escape":
      case "backspace":
        event.preventDefault();
        this.undo();
        break;
      case "h":
        this.toggleHint();
        break;
      default:
        break;
    }
  };

  private rotate(): void {
    this.brush = composeD4(this.brush, 1);
    this.dirty = true;
  }

  private rotateBack(): void {
    this.brush = composeD4(this.brush, 3);
    this.dirty = true;
  }

  private flip(): void {
    this.brush = composeD4(this.brush, 4);
    this.dirty = true;
  }

  private toggleHint(): void {
    this.hintOn = !this.hintOn;
    this.hintButton.classList.toggle("active", this.hintOn);
    this.board = this.rebuildBoard();
    this.dirty = true;
  }

  private placementFromBrush(): ProPlacement | null {
    const shape = this.shape;
    if (!shape || !this.brushAnchor) return null;
    const cells = transformedCells(shape, this.brush);
    let minX = Infinity;
    let minY = Infinity;
    for (const c of cells) {
      if (c.x < minX) minX = c.x;
      if (c.y < minY) minY = c.y;
    }
    return {
      orientation: this.brush,
      offset: { x: this.brushAnchor.x - minX, y: this.brushAnchor.y - minY },
    };
  }

  private cursorLegal(placement: ProPlacement): boolean {
    const shape = this.shape;
    if (!shape) return false;
    if (overlaps(shape, placement, this.occupied)) return false;
    return this.pool.some((def) => containsTile(def, placement));
  }

  private place(): void {
    const placement = this.placementFromBrush();
    const shape = this.shape;
    if (!placement || !shape) return;
    if (overlaps(shape, placement, this.occupied)) {
      this.setMessage("That overlaps a tile already placed.");
      return;
    }
    const nextPool = filterCandidates(this.pool, placement);
    if (nextPool.length === 0) {
      const anyTarget = filterCandidates(this.allTargets, placement);
      this.setMessage(
        anyTarget.length > 0
          ? "That line leads to a tiling you already found."
          : "No tiling can contain that — reverted.",
      );
      return;
    }

    const cells = placementCells(shape, placement);
    const old = this.board;
    this.placements.push(placement);
    for (const c of cells) this.occupied.add(keyVec(c));
    const before = this.pool.length;
    this.pool = nextPool;
    const next = this.rebuildBoard();
    this.board = next;
    this.startWave(old, next, placement);
    this.setMessage(
      before === nextPool.length
        ? "No new constraints from that tile."
        : `Narrowed ${before} → ${nextPool.length} tiling(s).`,
    );
    if (nextPool.length === 1) this.pendingSolve = true;
    this.updateStatus();
    this.dirty = true;
  }

  private undo(): void {
    if (this.placements.length <= 1 || this.solve) return;
    this.placements.pop();
    const shape = this.shape;
    if (!shape) return;
    this.occupied = new Set(
      this.placements
        .flatMap((p) => placementCells(shape, p))
        .map((c) => keyVec(c)),
    );
    this.pool = this.remaining.filter((def) =>
      this.placements.every((p) => containsTile(def, p)),
    );
    this.board = this.rebuildBoard();
    this.frame.set(this.board);
    this.scene.setCells(this.frame);
    this.wave = null;
    this.dirty = false;
    this.updateStatus();
  }

  // ------------------------------------------------------------- animation

  private startWave(
    old: Uint32Array,
    next: Uint32Array,
    placement: ProPlacement,
  ): void {
    const W = this.scene.width;
    const H = this.scene.height;
    const delays = new Uint16Array(W * H).fill(0xffff);
    let maxDelay = 0;
    for (let by = 0; by < H; by++) {
      for (let bx = 0; bx < W; bx++) {
        const i = by * W + bx;
        if (next[i] === old[i]) continue;
        const d =
          Math.abs(bx - this.cx - placement.offset.x) +
          Math.abs(by - this.cy - placement.offset.y);
        delays[i] = Math.min(0xffff, d);
        if (d > maxDelay) maxDelay = d;
      }
    }
    this.wave = {
      old,
      next,
      delays,
      start: performance.now(),
      maxDelay: Math.max(0, maxDelay),
    };
  }

  private buildWaveFrame(radius: number): void {
    const wave = this.wave;
    if (!wave) return;
    this.frame.set(wave.next);
    const { old, delays } = wave;
    for (let i = 0; i < this.frame.length; i++) {
      if (delays[i] > radius) this.frame[i] = old[i];
    }
  }

  private startSolve(now: number): void {
    const solved = this.pool[0];
    if (!solved) {
      this.pendingSolve = false;
      return;
    }
    const fullRegion = {
      minX: -this.cx,
      minY: -this.cy,
      maxX: this.scene.width - 1 - this.cx,
      maxY: this.scene.height - 1 - this.cy,
    };
    const raster = rasterize(solved, fullRegion, {
      shadeTiles: true,
      owner: OWNER_PROG_PLACED,
    });
    this.solve = {
      board: raster.cells,
      signature: canonicalSignature(solved),
      start: now,
      from: this.playZoom(),
      to: Math.min(1, this.playZoom()),
    };
    this.scene.setCells(raster.cells);
  }

  private tickSolve(now: number): void {
    const solve = this.solve;
    if (!solve) return;
    const t = now - solve.start;
    let zoom = solve.to;
    if (t < SOLVE_OUT_MS) {
      zoom = solve.from + (solve.to - solve.from) * easeInOut(t / SOLVE_OUT_MS);
    } else if (t < SOLVE_OUT_MS + SOLVE_HOLD_MS) {
      zoom = solve.to;
    } else if (t < SOLVE_OUT_MS + SOLVE_HOLD_MS + SOLVE_IN_MS) {
      const k =
        (t - SOLVE_OUT_MS - SOLVE_HOLD_MS) / SOLVE_IN_MS;
      zoom = solve.to + (solve.from - solve.to) * easeInOut(k);
    } else {
      this.finishSolve(solve);
      return;
    }
    this.scene.setZoom(zoom);
    this.scene.setCells(solve.board);
  }

  private finishSolve(solve: SolveAnim): void {
    this.solve = null;
    this.scene.setZoom(this.playZoom());
    this.recordDiscovery(solve.signature);
    this.resetRound();
  }

  private recordDiscovery(signature: string): void {
    if (this.level) {
      this.found.add(signature);
      const found = {
        ...this.save.found,
        [this.level.id]: [...this.found],
      };
      this.save = { ...this.save, found };
      this.remaining = this.allTargets.filter(
        (def) => !this.found.has(canonicalSignature(def)),
      );
      this.persist();
    }
    this.buildGallery();
    this.updateStatus();
    if (this.remaining.length === 0) {
      this.setMessage("All tilings found — press Next ▶.");
    } else {
      this.setMessage(
        `Discovered! ${this.found.size} / ${this.allTargets.length}.`,
      );
    }
  }

  tick(now: number): void {
    if (!this.active) return;
    if (this.solve) {
      this.tickSolve(now);
      return;
    }
    if (this.wave) {
      const radius = (now - this.wave.start) / WAVE_MS_PER_CELL;
      this.buildWaveFrame(radius);
      this.stampCursor();
      this.scene.setCells(this.frame);
      if (radius > this.wave.maxDelay) {
        this.wave = null;
        if (this.pendingSolve) {
          this.pendingSolve = false;
          this.startSolve(now);
          return;
        }
        this.frame.set(this.board);
        this.scene.setCells(this.frame);
      }
      return;
    }
    if (this.dirty) {
      this.frame.set(this.board);
      this.stampCursor();
      this.scene.setCells(this.frame);
      this.dirty = false;
    }
  }

  private stampCursor(): void {
    const placement = this.placementFromBrush();
    const shape = this.shape;
    if (!placement || !shape) return;
    const W = this.scene.width;
    const H = this.scene.height;
    const owner = this.cursorLegal(placement)
      ? OWNER_PROG_CURSOR
      : OWNER_PROG_BAD;
    for (const c of placementCells(shape, placement)) {
      const bx = c.x + this.cx;
      const by = c.y + this.cy;
      if (bx < 0 || by < 0 || bx >= W || by >= H) continue;
      this.frame[by * W + bx] = packCell({
        owner,
        orientation: placement.orientation,
        tag: 0xfffe,
      });
    }
  }

  // ----------------------------------------------------------------- UI

  private updateHeader(): void {
    if (!this.level) return;
    this.titleEl.innerHTML = "";
    const canvas = document.createElement("canvas");
    canvas.width = 46;
    canvas.height = 46;
    canvas.className = "prog-shape";
    drawShapeThumb(canvas, this.level.shape);
    const text = document.createElement("div");
    const name = document.createElement("div");
    name.textContent = `Size ${this.level.size} · tile ${this.index + 1}/${this.infos.length}`;
    const sub = document.createElement("div");
    sub.className = "muted";
    sub.textContent =
      this.remaining.length === 0
        ? "complete"
        : `${this.remaining.length} tiling(s) left`;
    text.append(name, sub);
    this.titleEl.append(canvas, text);
    this.prevButton.disabled = this.index === 0;
    this.nextButton.disabled = this.index >= this.infos.length - 1;
  }

  private updateStatus(): void {
    this.progressEl.textContent = `${this.found.size} / ${this.allTargets.length} tilings found`;
    const group = this.pool.length === 1 ? "solved" : `${this.pool.length} candidate(s)`;
    this.onStatus(
      `${this.allTargets.length}-tiling shape · ${this.found.size} found · ${group}`,
    );
  }

  private buildGallery(): void {
    this.galleryEl.innerHTML = "";
    if (this.allTargets.length === 0) {
      const empty = document.createElement("span");
      empty.className = "empty";
      empty.textContent = "This tile does not tile the plane.";
      this.galleryEl.appendChild(empty);
      return;
    }
    const groups = new Map<string, TessellationDef[]>();
    for (const def of this.allTargets) {
      const g = wallpaperGroup(def);
      const list = groups.get(g);
      if (list) list.push(def);
      else groups.set(g, [def]);
    }
    const ordered = [...groups.keys()].sort(
      (a, b) =>
        WALLPAPER_ORDER.indexOf(a) - WALLPAPER_ORDER.indexOf(b),
    );
    for (const g of ordered) {
      const heading = document.createElement("h2");
      heading.textContent = `${g} · ${groups.get(g)?.length ?? 0}`;
      this.galleryEl.appendChild(heading);
      const slots = document.createElement("div");
      slots.className = "prog-slots";
      for (const def of groups.get(g) ?? []) {
        const signature = canonicalSignature(def);
        const found = this.found.has(signature);
        const slot = document.createElement("div");
        slot.className = found ? "prog-slot found" : "prog-slot";
        if (found) {
          const canvas = document.createElement("canvas");
          canvas.width = 52;
          canvas.height = 52;
          drawTilingThumb(canvas, def);
          slot.appendChild(canvas);
        } else {
          slot.textContent = "?";
        }
        slots.appendChild(slot);
      }
      this.galleryEl.appendChild(slots);
    }
  }

  private setMessage(text: string): void {
    this.messageEl.textContent = text;
    this.messageEl.classList.add("show");
    window.clearTimeout((this.messageEl as unknown as { _t?: number })._t);
    (this.messageEl as unknown as { _t?: number })._t = window.setTimeout(
      () => this.messageEl.classList.remove("show"),
      2600,
    );
  }

  private persist(): void {
    this.save = { ...this.save, currentLevel: this.index };
    saveProgress(this.save);
  }

  /** Test hook: attempt a placement directly (used by the smoke test). */
  debugPlace(placement: ProPlacement): ProgressionState {
    const shape = this.shape;
    if (shape && !overlaps(shape, placement, this.occupied)) {
      this.brush = placement.orientation;
      this.brushAnchor = { x: 0, y: 0 };
      const cells = transformedCells(shape, placement.orientation);
      let minX = Infinity;
      let minY = Infinity;
      for (const c of cells) {
        if (c.x < minX) minX = c.x;
        if (c.y < minY) minY = c.y;
      }
      this.brushAnchor = {
        x: placement.offset.x + minX,
        y: placement.offset.y + minY,
      };
      this.place();
    }
    return this.state();
  }

  /** Test hook: jump to a level by index. */
  debugLoad(index: number): ProgressionState {
    const clamped = Math.min(Math.max(0, index), this.infos.length - 1);
    this.loadLevel(clamped);
    return this.state();
  }

  /** Test hook with plain numbers (used by scripts/browser-smoke.mjs). */
  debugPlaceAt(
    orientation: number,
    x: number,
    y: number,
  ): ProgressionState {
    return this.debugPlace({
      orientation: orientation as D4,
      offset: { x, y },
    });
  }

  /** Every orientation name, for debugging/UI. */
  static orientationName(g: D4): string {
    return D4_NAMES[g];
  }
}

function playRadiusFor(shape: ShapeDef): number {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of shape.cells) {
    minX = Math.min(minX, c.x);
    minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x);
    maxY = Math.max(maxY, c.y);
  }
  const span = Math.max(maxX - minX, maxY - minY) + 1;
  return Math.max(4, 2 * span, span + shape.cells.length) + 2;
}

function drawShapeThumb(canvas: HTMLCanvasElement, shape: ShapeDef): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const size = canvas.width;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of shape.cells) {
    minX = Math.min(minX, c.x);
    minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x);
    maxY = Math.max(maxY, c.y);
  }
  const cols = maxX - minX + 1;
  const rows = maxY - minY + 1;
  const cell = Math.max(3, Math.floor((size - 6) / Math.max(cols, rows)));
  const ox = Math.floor((size - cell * cols) / 2);
  const oy = Math.floor((size - cell * rows) / 2);
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "#f2cc4d";
  for (const c of shape.cells) {
    ctx.fillRect(
      ox + (c.x - minX) * cell + 1,
      oy + (c.y - minY) * cell + 1,
      cell - 2,
      cell - 2,
    );
  }
}

function drawTilingThumb(canvas: HTMLCanvasElement, def: TessellationDef): void {
  const size = canvas.width;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const extent = Math.max(
    Math.abs(def.basis1.x),
    Math.abs(def.basis1.y),
    Math.abs(def.basis2.x),
    Math.abs(def.basis2.y),
  );
  const radius = Math.min(8, Math.max(2, extent + 1));
  const raster = rasterize(
    def,
    { minX: -radius, minY: -radius, maxX: radius, maxY: radius },
    { shadeTiles: true },
  );
  const cell = size / raster.width;
  ctx.clearRect(0, 0, size, size);
  for (let y = 0; y < raster.height; y++) {
    for (let x = 0; x < raster.width; x++) {
      const value = raster.cells[y * raster.width + x];
      if (value === 0) continue;
      ctx.fillStyle = THUMB_PALETTE[paletteIndex(value) % THUMB_PALETTE.length];
      ctx.fillRect(x * cell, y * cell, Math.ceil(cell), Math.ceil(cell));
    }
  }
}
