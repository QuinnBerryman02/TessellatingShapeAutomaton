import type { Vec2 } from "../core/vec2.ts";
import { findTessellations } from "../solver/find.ts";
import { wallpaperGroup } from "../solver/symmetry.ts";
import { freePolyominoesBySize } from "./polyominoes.ts";

/**
 * The polyomino encyclopedia: one row per free polyomino, counting how many
 * distinct tessellations of each wallpaper group it can make. Results are
 * computed on demand by the "Search" button and cached in localStorage.
 */

const GROUPS = [
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
] as const;

const MAX_SIZE = 6;
const STORE_KEY = "tsa.encyclopedia.v1";

interface ShapeRecord {
  readonly cells: [number, number][];
  readonly counts: Record<string, number>;
}
type Store = Record<string, ShapeRecord[]>;

function loadStore(): Store {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function saveStore(store: Store): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

const bySize = freePolyominoesBySize(MAX_SIZE);

function asCells(cells: readonly Vec2[]): Vec2[] {
  return cells.map((c) => ({ x: c.x, y: c.y }));
}

function labUrl(cells: readonly Vec2[]): string {
  return "/?shape=" + cells.map((c) => `${c.x},${c.y}`).join(";");
}

function drawThumb(canvas: HTMLCanvasElement, cells: readonly Vec2[]): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  let maxX = 0;
  let maxY = 0;
  for (const c of cells) {
    maxX = Math.max(maxX, c.x);
    maxY = Math.max(maxY, c.y);
  }
  const cell = Math.max(
    3,
    Math.floor(Math.min((w - 6) / (maxX + 1), (h - 6) / (maxY + 1))),
  );
  const ox = Math.floor((w - cell * (maxX + 1)) / 2);
  const oy = Math.floor((h - cell * (maxY + 1)) / 2);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#4d9fdc";
  for (const c of cells) {
    ctx.fillRect(ox + c.x * cell + 1, oy + c.y * cell + 1, cell - 2, cell - 2);
  }
}

function countGroups(cells: readonly Vec2[]): Record<string, number> {
  const defs = findTessellations(
    { name: "tile", cells },
    { maxBasis: 4, maxCovolume: 16, maxPlacements: 8, maxResults: 200 },
  );
  const counts: Record<string, number> = {};
  for (const def of defs) {
    const group = wallpaperGroup(def);
    counts[group] = (counts[group] ?? 0) + 1;
  }
  return counts;
}

function nextTick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function linkToLab(cells: readonly Vec2[], size: number): HTMLAnchorElement {
  const anchor = document.createElement("a");
  anchor.href = labUrl(cells);
  anchor.title = "Open this tile in the Lab";
  anchor.className = "thumb";
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  drawThumb(canvas, cells);
  anchor.appendChild(canvas);
  return anchor;
}

function appendRecord(
  gallery: HTMLElement,
  tbody: HTMLElement,
  record: ShapeRecord,
): void {
  const cells = record.cells.map(([x, y]) => ({ x, y }));
  gallery.appendChild(linkToLab(cells, 54));

  const row = document.createElement("tr");
  const tileCell = document.createElement("td");
  tileCell.className = "tile-cell";
  tileCell.appendChild(linkToLab(cells, 32));
  row.appendChild(tileCell);
  for (const group of GROUPS) {
    const value = record.counts[group] ?? 0;
    const cell = document.createElement("td");
    cell.textContent = value > 0 ? String(value) : "·";
    if (value > 0) cell.className = "hit";
    row.appendChild(cell);
  }
  tbody.appendChild(row);
}

function renderRecords(
  gallery: HTMLElement,
  tbody: HTMLElement,
  records: readonly ShapeRecord[],
): void {
  gallery.innerHTML = "";
  tbody.innerHTML = "";
  for (const record of records) appendRecord(gallery, tbody, record);
}

async function runSearch(
  size: number,
  gallery: HTMLElement,
  tbody: HTMLElement,
  status: HTMLElement,
): Promise<void> {
  const store = loadStore();
  const shapes = bySize[size - 1];
  const records: ShapeRecord[] = [];
  gallery.innerHTML = "";
  tbody.innerHTML = "";
  store[String(size)] = records;
  saveStore(store);

  for (let i = 0; i < shapes.length; i++) {
    status.textContent = `searching ${i + 1}/${shapes.length}…`;
    await nextTick();
    const cells = asCells(shapes[i]);
    const record: ShapeRecord = {
      cells: cells.map((c) => [c.x, c.y]),
      counts: countGroups(cells),
    };
    records.push(record);
    store[String(size)] = records;
    saveStore(store);
    appendRecord(gallery, tbody, record);
  }
  status.textContent = `done — ${shapes.length} tile(s)`;
}

function buildSizeSection(size: number, saved: readonly ShapeRecord[]): void {
  const root = document.getElementById("sizes");
  if (!root) return;
  const shapes = bySize[size - 1];

  const section = document.createElement("section");
  section.className = "size-block";

  const head = document.createElement("div");
  head.className = "size-head";
  const h2 = document.createElement("h2");
  h2.textContent = `Size ${size}`;
  const count = document.createElement("span");
  count.className = "muted";
  count.textContent = `${shapes.length} free polyomino${shapes.length === 1 ? "" : "es"}`;
  const search = document.createElement("button");
  search.textContent = "Search";
  const status = document.createElement("span");
  status.className = "status";
  head.append(h2, count, search, status);

  const row = document.createElement("div");
  row.className = "size-row";
  const gallery = document.createElement("div");
  gallery.className = "gallery";
  const counts = document.createElement("div");
  counts.className = "counts";
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const corner = document.createElement("th");
  corner.textContent = "tile";
  headRow.appendChild(corner);
  for (const group of GROUPS) {
    const th = document.createElement("th");
    th.textContent = group;
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  const tbody = document.createElement("tbody");
  table.append(thead, tbody);
  counts.appendChild(table);
  row.append(gallery, counts);
  section.append(head, row);
  root.appendChild(section);

  renderRecords(gallery, tbody, saved);
  if (saved.length > 0) status.textContent = `${saved.length} saved`;
  search.addEventListener("click", () => {
    void runSearch(size, gallery, tbody, status);
  });
}

const store = loadStore();
for (let size = 1; size <= MAX_SIZE; size++) {
  buildSizeSection(size, store[String(size)] ?? []);
}

const resetAll = document.getElementById("reset-all");
resetAll?.addEventListener("click", () => {
  saveStore({});
  location.reload();
});
