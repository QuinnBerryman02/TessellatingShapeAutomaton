import {
  fromJSON,
  toJSON,
  type TessellationDef,
  type TessellationJSON,
} from "../model/tessellation.ts";

export interface Discovery {
  readonly id: string;
  readonly name: string;
  readonly def: TessellationJSON;
}

const STORAGE_KEY = "tsa.collection.v1";

/**
 * The player's saved discoveries. Identified by the tessellation's canonical
 * signature, so the same tiling can never be saved twice. Persisted to
 * localStorage and exportable as JSON.
 */
export class Collection {
  private items: Discovery[] = [];

  constructor() {
    this.reload();
  }

  list(): Discovery[] {
    return this.items.slice();
  }

  size(): number {
    return this.items.length;
  }

  has(id: string): boolean {
    return this.items.some((item) => item.id === id);
  }

  get(id: string): TessellationDef | undefined {
    const item = this.items.find((entry) => entry.id === id);
    return item ? fromJSON(item.def) : undefined;
  }

  add(def: TessellationDef, name: string, id: string): Discovery {
    const existing = this.items.find((entry) => entry.id === id);
    if (existing) return existing;
    const discovery: Discovery = { id, name, def: toJSON(def) };
    this.items.push(discovery);
    this.persist();
    return discovery;
  }

  remove(id: string): void {
    this.items = this.items.filter((entry) => entry.id !== id);
    this.persist();
  }

  rename(id: string, name: string): void {
    const item = this.items.find((entry) => entry.id === id);
    if (!item) return;
    this.items = this.items.map((entry) =>
      entry.id === id ? { ...entry, name } : entry,
    );
    this.persist();
  }

  toJSONText(): string {
    return JSON.stringify(this.items, null, 2);
  }

  /** Merges discoveries from exported JSON; returns how many were new. */
  importText(text: string): number {
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error("collection JSON must be an array");
    let added = 0;
    for (const raw of parsed) {
      const item = raw as Partial<Discovery>;
      if (
        typeof item?.id !== "string" ||
        typeof item?.name !== "string" ||
        item?.def === undefined
      ) {
        continue;
      }
      if (this.has(item.id)) continue;
      this.items.push({ id: item.id, name: item.name, def: item.def });
      added++;
    }
    if (added > 0) this.persist();
    return added;
  }

  private reload(): void {
    try {
      const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) this.items = parsed as Discovery[];
    } catch {
      this.items = [];
    }
  }

  private persist(): void {
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(this.items));
    } catch {
      // Storage can be unavailable (private mode); the in-memory list still works.
    }
  }
}
