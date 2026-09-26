/**
 * The dihedral group D4: the 8 symmetries of the square.
 *
 * Elements are the eight 2x2 integer matrices that permute the four corners of
 * a square. Names match the Java prototype so old configurations stay readable:
 *
 *   ID   identity          (x, y)
 *   R90  rotate 90deg      (-y, x)
 *   R180 rotate 180deg     (-x, -y)
 *   R270 rotate 270deg     (y, -x)
 *   FX   flip x            (-x, y)
 *   FY   flip y            (x, -y)
 *   TR   transpose         (-y, -x)
 *   TL   anti-transpose    (y, x)
 */
import type { Vec2 } from "./vec2.ts";

export const D4_NAMES = [
  "ID",
  "R90",
  "R180",
  "R270",
  "FX",
  "FY",
  "TR",
  "TL",
] as const;

export type D4Name = (typeof D4_NAMES)[number];
export type D4 = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const D4_IDENTITY: D4 = 0;

/** Row-major [a, b, c, d] acting as (x, y) -> (a*x + b*y, c*x + d*y). */
type Mat = readonly [number, number, number, number];

const MATRICES: readonly Mat[] = [
  [1, 0, 0, 1], // ID
  [0, -1, 1, 0], // R90
  [-1, 0, 0, -1], // R180
  [0, 1, -1, 0], // R270
  [-1, 0, 0, 1], // FX
  [1, 0, 0, -1], // FY
  [0, -1, -1, 0], // TR
  [0, 1, 1, 0], // TL
];

export function applyD4(g: D4, p: Vec2): Vec2 {
  const [a, b, c, d] = MATRICES[g];
  return { x: a * p.x + b * p.y, y: c * p.x + d * p.y };
}

function mulMat(left: Mat, right: Mat): Mat {
  const [a1, b1, c1, d1] = left;
  const [a2, b2, c2, d2] = right;
  return [
    a1 * a2 + b1 * c2,
    a1 * b2 + b1 * d2,
    c1 * a2 + d1 * c2,
    c1 * b2 + d1 * d2,
  ];
}

function indexOfMat(m: Mat): D4 {
  const i = MATRICES.findIndex(
    (x) => x[0] === m[0] && x[1] === m[1] && x[2] === m[2] && x[3] === m[3],
  );
  if (i < 0) throw new Error("matrix is not an element of D4");
  return i as D4;
}

/** `composeD4(a, b)` applies `a` first, then `b`. */
const COMPOSE: readonly (readonly D4[])[] = D4_NAMES.map((_, a) =>
  D4_NAMES.map((_, b) => indexOfMat(mulMat(MATRICES[b], MATRICES[a]))),
);

export function composeD4(a: D4, b: D4): D4 {
  return COMPOSE[a][b];
}

// D4 matrices are orthogonal, so the inverse is the transpose.
const INVERSE: readonly D4[] = D4_NAMES.map((_, g) => {
  const [a, b, c, d] = MATRICES[g];
  return indexOfMat([a, c, b, d]);
});

export function inverseD4(g: D4): D4 {
  return INVERSE[g];
}

export function d4Name(g: D4): D4Name {
  return D4_NAMES[g];
}
