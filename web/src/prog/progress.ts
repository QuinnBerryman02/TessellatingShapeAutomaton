/**
 * Progression-mode persistence: which tessellations the player has discovered,
 * keyed by level id and canonical signature, plus the current level.
 */

const STORE_KEY = "tsa.prog.v1";

export interface ProgSave {
  readonly currentLevel: number;
  /** level id -> canonical signatures of discovered tilings. */
  readonly found: Record<string, string[]>;
}

const EMPTY: ProgSave = { currentLevel: 0, found: {} };

export function loadProgress(): ProgSave {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<ProgSave>;
    return {
      currentLevel: Number.isFinite(parsed.currentLevel)
        ? (parsed.currentLevel as number)
        : 0,
      found: parsed.found ?? {},
    };
  } catch {
    return EMPTY;
  }
}

export function saveProgress(save: ProgSave): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(save));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}
