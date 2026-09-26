// Draws the world grid (a storage buffer of packed cell ids) to the canvas.
// Cell 0 is empty; values 1..8 index a palette keyed by tile orientation (M1).

struct Params {
  width: u32,
  height: u32,
  time: f32,
  scaleX: f32,
  scaleY: f32,
  pad0: f32,
  pad1: f32,
  pad2: f32,
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

@fragment
fn fs(in: VSOut) -> @location(0) vec4<f32> {
  // Fit the grid inside the viewport without stretching (letterbox).
  let s = vec2<f32>(params.scaleX, params.scaleY);
  let uv = (in.uv - vec2<f32>(0.5, 0.5)) / s + vec2<f32>(0.5, 0.5);
  if (uv.x < 0.0 || uv.x >= 1.0 || uv.y < 0.0 || uv.y >= 1.0) {
    return vec4<f32>(0.02, 0.03, 0.05, 1.0);
  }

  let gx = u32(uv.x * f32(params.width));
  let gy = u32(uv.y * f32(params.height));
  let v = cells[gy * params.width + gx];
  if (v == 0u) {
    return vec4<f32>(0.06, 0.07, 0.10, 1.0);
  }

  var palette = array<vec4<f32>, 8>(
    vec4<f32>(0.20, 0.80, 0.90, 1.0),
    vec4<f32>(0.90, 0.40, 0.80, 1.0),
    vec4<f32>(0.50, 0.90, 0.40, 1.0),
    vec4<f32>(0.95, 0.80, 0.30, 1.0),
    vec4<f32>(0.35, 0.55, 0.95, 1.0),
    vec4<f32>(0.95, 0.45, 0.40, 1.0),
    vec4<f32>(0.65, 0.45, 0.95, 1.0),
    vec4<f32>(0.55, 0.90, 0.75, 1.0),
  );
  return palette[(v - 1u) % 8u];
}
