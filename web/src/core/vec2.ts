/** Minimal 2D integer vector helpers. Everything in the model is grid-aligned. */
export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export function vec(x: number, y: number): Vec2 {
  return { x, y };
}

export function addVec(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function subVec(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scaleVec(a: Vec2, k: number): Vec2 {
  return { x: a.x * k, y: a.y * k };
}

export function negVec(a: Vec2): Vec2 {
  return { x: -a.x, y: -a.y };
}

export function eqVec(a: Vec2, b: Vec2): boolean {
  return a.x === b.x && a.y === b.y;
}

export function keyVec(a: Vec2): string {
  return `${a.x},${a.y}`;
}

export function manhattan(a: Vec2): number {
  return Math.abs(a.x) + Math.abs(a.y);
}
