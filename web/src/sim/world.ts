import { ownerOf } from "../core/cell.ts";

/**
 * The world: one packed `u32` per cell, indexed `y * width + x`. This is the
 * buffer the browser uploads straight to the GPU, so its layout is stable.
 */
export class WorldGrid {
  readonly width: number;
  readonly height: number;
  readonly cells: Uint32Array;

  constructor(width: number, height: number, cells?: Uint32Array) {
    this.width = width;
    this.height = height;
    this.cells = cells ?? new Uint32Array(width * height);
    if (this.cells.length !== width * height) {
      throw new Error(
        `expected ${width * height} cells, got ${this.cells.length}`,
      );
    }
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  index(x: number, y: number): number {
    return y * this.width + x;
  }

  at(x: number, y: number): number {
    return this.cells[this.index(x, y)];
  }

  set(x: number, y: number, value: number): void {
    this.cells[this.index(x, y)] = value;
  }

  ownerAt(x: number, y: number): number {
    return ownerOf(this.cells[this.index(x, y)]);
  }

  clear(): void {
    this.cells.fill(0);
  }

  /** Number of cells owned by each id, as a sparse map (id -> count). */
  histogram(): Map<number, number> {
    const counts = new Map<number, number>();
    for (const cell of this.cells) {
      const owner = ownerOf(cell);
      counts.set(owner, (counts.get(owner) ?? 0) + 1);
    }
    return counts;
  }

  countOwner(owner: number): number {
    let n = 0;
    for (const cell of this.cells) {
      if (ownerOf(cell) === owner) n++;
    }
    return n;
  }

  clone(): WorldGrid {
    return new WorldGrid(this.width, this.height, this.cells.slice());
  }
}
