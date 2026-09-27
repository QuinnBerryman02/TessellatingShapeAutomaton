import type { Vec2 } from "../core/vec2.ts";
import type { ShapeDef } from "../model/shape.ts";
import { paletteIndex } from "../core/cell.ts";
import { covolume, rasterize, type TessellationDef } from "../model/tessellation.ts";
import { canonicalSignature } from "../solver/canonical.ts";
import { findTessellations } from "../solver/find.ts";
import { Collection } from "./collection.ts";

const GRID = 14;
const CELL = 20;
const PREVIEW_PALETTE = [
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
  "#5b3f85",
  "#4d7f69",
];

export interface LabPanelOptions {
  readonly root: HTMLElement;
  readonly onSelect: (def: TessellationDef) => void;
}

/**
 * The Lab: draw a tile shape on a small grid, search for the tessellations it
 * makes, and save discoveries to a collection.
 */
export class LabPanel {
  private readonly root: HTMLElement;
  private readonly onSelect: (def: TessellationDef) => void;
  private readonly drawCanvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly resultsEl: HTMLElement;
  private readonly collectionEl: HTMLElement;
  private readonly statusEl: HTMLElement;
  private readonly saveButton: HTMLButtonElement;
  private readonly collection = new Collection();

  private readonly drawn = new Set<string>();
  private paint: "add" | "remove" | null = null;
  private results: TessellationDef[] = [];
  private selected = -1;
  private dpr = 1;

  constructor(options: LabPanelOptions) {
    this.root = options.root;
    this.onSelect = options.onSelect;
    this.drawCanvas = this.query<HTMLCanvasElement>("#draw-grid");
    this.resultsEl = this.query<HTMLElement>("#lab-results");
    this.collectionEl = this.query<HTMLElement>("#lab-collection");
    this.statusEl = this.query<HTMLElement>("#lab-status");
    this.saveButton = this.query<HTMLButtonElement>("#lab-save");
    const ctx = this.drawCanvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context unavailable");
    this.ctx = ctx;

    this.setupCanvas();
    this.bindPointer();
    this.bindControls();
    this.renderDraw();
    this.renderResults();
    this.renderCollection();
  }

  private query<T extends Element>(selector: string): T {
    const element = this.root.querySelector<T>(selector);
    if (!element) throw new Error(`lab element ${selector} not found`);
    return element;
  }

  // --- public API (also used by the headless smoke test) --------------------

  setShape(cells: ReadonlyArray<readonly [number, number]>): void {
    this.drawn.clear();
    if (cells.length > 0) {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const [x, y] of cells) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
      const offX = Math.floor((GRID - (maxX - minX + 1)) / 2) - minX;
      const offY = Math.floor((GRID - (maxY - minY + 1)) / 2) - minY;
      for (const [x, y] of cells) this.drawn.add(`${x + offX},${y + offY}`);
    }
    this.renderDraw();
  }

  find(): number {
    const shape = this.shapeFromDrawn();
    if (shape.cells.length === 0) {
      this.results = [];
      this.selected = -1;
      this.renderResults();
      this.setStatus("draw some cells first");
      return 0;
    }

    this.setStatus("searching...");
    const start = performance.now();
    const found = findTessellations(shape, {
      maxBasis: 4,
      maxCovolume: 16,
      maxPlacements: 8,
      maxResults: 64,
    });
    found.sort(
      (a, b) =>
        a.placements.length - b.placements.length ||
        covolume(a) - covolume(b),
    );
    this.results = found;
    this.selected = -1;
    this.renderResults();
    const ms = Math.round(performance.now() - start);
    this.setStatus(
      found.length === 0
        ? `no tilings found (${ms}ms)`
        : `${found.length} tiling(s) (${ms}ms)`,
    );
    return found.length;
  }

  select(index: number): void {
    if (index < 0 || index >= this.results.length) return;
    this.selected = index;
    this.renderResults();
    this.saveButton.disabled = false;
    this.onSelect(this.results[index]);
  }

  saveSelected(): void {
    if (this.selected < 0) return;
    const def = this.results[this.selected];
    const id = canonicalSignature(def);
    this.collection.add(def, `Tiling ${this.collection.size() + 1}`, id);
    this.renderCollection();
  }

  resultDefinitions(): TessellationDef[] {
    return this.results.slice();
  }

  collectionSize(): number {
    return this.collection.size();
  }

  // --- drawing grid ---------------------------------------------------------

  private setupCanvas(): void {
    this.dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    const size = GRID * CELL;
    this.drawCanvas.width = size * this.dpr;
    this.drawCanvas.height = size * this.dpr;
    this.drawCanvas.style.width = `${size}px`;
    this.drawCanvas.style.height = `${size}px`;
  }

  private bindPointer(): void {
    this.drawCanvas.addEventListener("pointerdown", (event) => {
      const cell = this.cellFromEvent(event);
      if (!cell) return;
      this.drawCanvas.setPointerCapture(event.pointerId);
      const key = `${cell[0]},${cell[1]}`;
      this.paint = this.drawn.has(key) ? "remove" : "add";
      this.applyPaint(key, this.paint);
    });
    this.drawCanvas.addEventListener("pointermove", (event) => {
      if (!this.paint) return;
      const cell = this.cellFromEvent(event);
      if (cell) this.applyPaint(`${cell[0]},${cell[1]}`, this.paint);
    });
    const stop = (event: PointerEvent): void => {
      this.paint = null;
      if (this.drawCanvas.hasPointerCapture(event.pointerId)) {
        this.drawCanvas.releasePointerCapture(event.pointerId);
      }
    };
    this.drawCanvas.addEventListener("pointerup", stop);
    this.drawCanvas.addEventListener("pointercancel", stop);
  }

  private cellFromEvent(event: PointerEvent): [number, number] | null {
    const rect = this.drawCanvas.getBoundingClientRect();
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * GRID);
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * GRID);
    if (x < 0 || y < 0 || x >= GRID || y >= GRID) return null;
    return [x, y];
  }

  private applyPaint(key: string, mode: "add" | "remove"): void {
    if (mode === "add") this.drawn.add(key);
    else this.drawn.delete(key);
    this.renderDraw();
  }

  private renderDraw(): void {
    const ctx = this.ctx;
    const size = GRID * CELL;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const filled = this.drawn.has(`${x},${y}`);
        ctx.fillStyle = filled
          ? "#4d9fdc"
          : (x + y) % 2 === 0
            ? "#0c131c"
            : "#0a0f16";
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
    }
    ctx.strokeStyle = "#1b2634";
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL + 0.5, 0);
      ctx.lineTo(i * CELL + 0.5, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * CELL + 0.5);
      ctx.lineTo(size, i * CELL + 0.5);
      ctx.stroke();
    }
  }

  private shapeFromDrawn(): ShapeDef {
    let minX = Infinity;
    let minY = Infinity;
    for (const key of this.drawn) {
      const [x, y] = key.split(",").map(Number);
      if (x < minX) minX = x;
      if (y < minY) minY = y;
    }
    const cells: Vec2[] = [];
    for (const key of this.drawn) {
      const [x, y] = key.split(",").map(Number);
      cells.push({ x: x - minX, y: y - minY });
    }
    return { name: "lab-shape", cells };
  }

  // --- results / collection UI ---------------------------------------------

  private bindControls(): void {
    this.query<HTMLButtonElement>("#lab-clear").addEventListener("click", () => {
      this.drawn.clear();
      this.renderDraw();
      this.setStatus("");
    });
    this.query<HTMLButtonElement>("#lab-find").addEventListener("click", () =>
      this.find(),
    );
    this.saveButton.addEventListener("click", () => this.saveSelected());
    this.query<HTMLButtonElement>("#lab-export").addEventListener("click", () =>
      this.exportCollection(),
    );

    const file = document.createElement("input");
    file.type = "file";
    file.accept = "application/json";
    file.hidden = true;
    file.addEventListener("change", () => {
      const selected = file.files?.[0];
      if (!selected) return;
      void selected.text().then((text) => {
        try {
          const added = this.collection.importText(text);
          this.renderCollection();
          this.setStatus(`imported ${added} discovery(ies)`);
        } catch (error) {
          this.setStatus(`import failed: ${(error as Error).message}`);
        }
        file.value = "";
      });
    });
    this.root.appendChild(file);
    this.query<HTMLButtonElement>("#lab-import").addEventListener("click", () =>
      file.click(),
    );
  }

  private renderResults(): void {
    this.resultsEl.textContent = "";
    if (this.results.length === 0) {
      const span = document.createElement("span");
      span.className = "empty";
      span.textContent = "None yet.";
      this.resultsEl.appendChild(span);
      this.saveButton.disabled = true;
      return;
    }
    this.results.forEach((def, index) => {
      const item = document.createElement("div");
      item.className = index === this.selected ? "result selected" : "result";
      const canvas = document.createElement("canvas");
      renderPreview(canvas, def);
      const label = document.createElement("span");
      label.textContent = `${def.placements.length}p`;
      item.append(canvas, label);
      item.addEventListener("click", () => this.select(index));
      this.resultsEl.appendChild(item);
    });
    this.saveButton.disabled = this.selected < 0;
  }

  private renderCollection(): void {
    this.collectionEl.textContent = "";
    const items = this.collection.list();
    if (items.length === 0) {
      const span = document.createElement("span");
      span.className = "empty";
      span.textContent = "Nothing saved.";
      this.collectionEl.appendChild(span);
      return;
    }
    for (const item of items) {
      const row = document.createElement("div");
      row.className = "item";
      const name = document.createElement("span");
      name.textContent = item.name;
      name.className = "name";
      const load = document.createElement("button");
      load.textContent = "Load";
      load.addEventListener("click", () => {
        const def = this.collection.get(item.id);
        if (def) this.onSelect(def);
      });
      const remove = document.createElement("button");
      remove.textContent = "×";
      remove.title = "Delete";
      remove.addEventListener("click", () => {
        this.collection.remove(item.id);
        this.renderCollection();
      });
      row.append(name, load, remove);
      this.collectionEl.appendChild(row);
    }
  }

  private exportCollection(): void {
    const blob = new Blob([this.collection.toJSONText()], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "tsa-collection.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private setStatus(text: string): void {
    this.statusEl.textContent = text;
  }
}

function renderPreview(canvas: HTMLCanvasElement, def: TessellationDef): void {
  const size = 56;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const extent = Math.max(
    Math.abs(def.basis1.x),
    Math.abs(def.basis1.y),
    Math.abs(def.basis2.x),
    Math.abs(def.basis2.y),
  );
  const radius = Math.min(9, Math.max(3, extent + 1));
  const raster = rasterize(
    def,
    { minX: -radius, minY: -radius, maxX: radius, maxY: radius },
    { shadeTiles: true },
  );
  const cellSize = size / raster.width;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#0a0f16";
  ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < raster.height; y++) {
    for (let x = 0; x < raster.width; x++) {
      const value = raster.cells[y * raster.width + x];
      if (value === 0) continue;
      ctx.fillStyle = PREVIEW_PALETTE[paletteIndex(value) % PREVIEW_PALETTE.length];
      ctx.fillRect(x * cellSize, y * cellSize, Math.ceil(cellSize), Math.ceil(cellSize));
    }
  }
}
