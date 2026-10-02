// Draws the world grid (a storage buffer of packed u32 cells) to the canvas.
//
// Cell layout (see src/core/cell.ts):
//   bits  0..7   owner        (0 = empty, 1 = Lab, 2/3 = players)
//   bits  8..10  orientation  (D4 index)
//   bit   11     shade        (alternates neighbouring tile instances)
//   bits 12..15  role         (1 = core)
//   bits 16..31  tile tag     (per-tile id; lets us draw boundaries)

struct Params {
  width: u32,
  height: u32,
  time: f32,
  scaleX: f32,
  scaleY: f32,
  zoom: f32,
  borders: f32,
  symmetry: f32,
};

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> cells: array<u32>;

struct VSOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs(@builtin(vertex_index) vi: u32) -> VSOut {
  // Oversized triangle covering the clip-space square.
  var pts = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0),
  );
  let p = pts[vi];
  var out: VSOut;
  out.pos = vec4<f32>(p, 0.0, 1.0);
  out.uv = p * 0.5 + vec2<f32>(0.5, 0.5);
  return out;
}

fn cellAt(x: i32, y: i32) -> u32 {
  if (x < 0 || y < 0 || x >= i32(params.width) || y >= i32(params.height)) {
    return 0xffffffffu;
  }
  return cells[u32(y) * params.width + u32(x)];
}

// Owner + tile tag: equal for cells of the same tile, different otherwise.
fn tileKey(v: u32) -> u32 {
  return v & 0xffff00ffu;
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4<f32> {
  // Fit the grid inside the viewport without stretching (letterbox), then zoom.
  let s = vec2<f32>(params.scaleX, params.scaleY) * params.zoom;
  let uv = (in.uv - vec2<f32>(0.5, 0.5)) / s + vec2<f32>(0.5, 0.5);

  // Position in cell units, and how many cells one screen pixel spans. Computed
  // before any branch so the derivative stays in uniform control flow.
  let cellSpace = uv * vec2<f32>(f32(params.width), f32(params.height));
  let cellPx = max(fwidth(cellSpace.x), fwidth(cellSpace.y));
  if (uv.x < 0.0 || uv.x >= 1.0 || uv.y < 0.0 || uv.y >= 1.0) {
    return vec4<f32>(0.02, 0.03, 0.05, 1.0);
  }

  let gx = i32(cellSpace.x);
  let gy = i32(cellSpace.y);
  let v = cellAt(gx, gy);

  let owner = v & 0xffu;
  if (owner == 0u) {
    return vec4<f32>(0.06, 0.07, 0.10, 1.0);
  }

  let orientation = (v >> 8u) & 0x7u;
  let shade = (v >> 11u) & 0x1u;
  let role = (v >> 12u) & 0xfu;

  var colour: vec4<f32>;
  if (owner == 1u) {
    // Lab / neutral: colour by tile orientation + shade.
    var palette = array<vec4<f32>, 16>(
      vec4<f32>(0.20, 0.80, 0.90, 1.0),
      vec4<f32>(0.90, 0.40, 0.80, 1.0),
      vec4<f32>(0.50, 0.90, 0.40, 1.0),
      vec4<f32>(0.95, 0.80, 0.30, 1.0),
      vec4<f32>(0.35, 0.55, 0.90, 1.0),
      vec4<f32>(0.95, 0.45, 0.40, 1.0),
      vec4<f32>(0.65, 0.45, 0.95, 1.0),
      vec4<f32>(0.55, 0.90, 0.75, 1.0),
      vec4<f32>(0.11, 0.44, 0.50, 1.0),
      vec4<f32>(0.50, 0.22, 0.44, 1.0),
      vec4<f32>(0.27, 0.50, 0.22, 1.0),
      vec4<f32>(0.52, 0.44, 0.16, 1.0),
      vec4<f32>(0.19, 0.30, 0.50, 1.0),
      vec4<f32>(0.52, 0.25, 0.22, 1.0),
      vec4<f32>(0.36, 0.25, 0.52, 1.0),
      vec4<f32>(0.30, 0.50, 0.41, 1.0),
    );
    colour = palette[orientation + 8u * shade];
  } else if (params.symmetry > 0.5) {
    // Eight tones per owner: one per D4 symmetry of the tile.
    var paletteA = array<vec4<f32>, 8>(
      vec4<f32>(0.18, 0.86, 0.95, 1.0),
      vec4<f32>(0.22, 0.62, 0.96, 1.0),
      vec4<f32>(0.40, 0.46, 0.96, 1.0),
      vec4<f32>(0.26, 0.90, 0.68, 1.0),
      vec4<f32>(0.20, 0.74, 0.52, 1.0),
      vec4<f32>(0.52, 0.88, 0.94, 1.0),
      vec4<f32>(0.55, 0.60, 0.97, 1.0),
      vec4<f32>(0.12, 0.55, 0.76, 1.0),
    );
    var paletteB = array<vec4<f32>, 8>(
      vec4<f32>(0.98, 0.62, 0.20, 1.0),
      vec4<f32>(0.95, 0.42, 0.34, 1.0),
      vec4<f32>(0.96, 0.78, 0.24, 1.0),
      vec4<f32>(0.92, 0.36, 0.58, 1.0),
      vec4<f32>(0.86, 0.56, 0.14, 1.0),
      vec4<f32>(0.98, 0.82, 0.56, 1.0),
      vec4<f32>(0.82, 0.42, 0.78, 1.0),
      vec4<f32>(0.94, 0.48, 0.12, 1.0),
    );
    if (owner == 2u) {
      colour = paletteA[orientation];
    } else {
      colour = paletteB[orientation];
    }
  } else {
    // Players: two shades of the owner colour so the tiling stays readable.
    let base = select(
      vec4<f32>(0.95, 0.52, 0.20, 1.0),
      vec4<f32>(0.16, 0.85, 0.72, 1.0),
      owner == 2u,
    );
    let factor = select(0.68, 1.0, shade == 1u);
    colour = vec4<f32>(base.rgb * factor, 1.0);
  }

  if (role == 1u) {
    return vec4<f32>(1.0, 1.0, 1.0, 1.0);
  }

  if (params.borders > 0.5) {
    // Border thickness in cell units, targeting ~1 screen pixel, but never
    // more than a fifth of a cell so small tiles stay mostly their own colour.
    let bw = clamp(cellPx, 0.02, 0.2);
    let local = fract(cellSpace);
    let key = tileKey(v);
    var edge = false;
    if (local.x < bw && tileKey(cellAt(gx - 1, gy)) != key) { edge = true; }
    if (local.x > 1.0 - bw && tileKey(cellAt(gx + 1, gy)) != key) { edge = true; }
    if (local.y < bw && tileKey(cellAt(gx, gy - 1)) != key) { edge = true; }
    if (local.y > 1.0 - bw && tileKey(cellAt(gx, gy + 1)) != key) { edge = true; }
    if (edge) {
      return vec4<f32>(0.03, 0.04, 0.06, 1.0);
    }
  }

  return colour;
}
