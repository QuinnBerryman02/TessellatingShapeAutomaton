// Draws the world grid (a storage buffer of packed u32 cells) to the canvas.
//
// Cell layout (see src/core/cell.ts):
//   bits  0..7   owner        (0 = empty, 1 = Lab, 2/3 = players)
//   bits  8..10  orientation  (D4 index)
//   bit   11     shade        (alternates neighbouring tile instances)
//   bits 12..15  role         (1 = core)
//   bits 16..31  reserved (integrity / age)

struct Params {
  width: u32,
  height: u32,
  time: f32,
  scaleX: f32,
  scaleY: f32,
  zoom: f32,
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
  // Fit the grid inside the viewport without stretching (letterbox), then zoom.
  let s = vec2<f32>(params.scaleX, params.scaleY) * params.zoom;
  let uv = (in.uv - vec2<f32>(0.5, 0.5)) / s + vec2<f32>(0.5, 0.5);
  if (uv.x < 0.0 || uv.x >= 1.0 || uv.y < 0.0 || uv.y >= 1.0) {
    return vec4<f32>(0.02, 0.03, 0.05, 1.0);
  }

  let gx = u32(uv.x * f32(params.width));
  let gy = u32(uv.y * f32(params.height));
  let v = cells[gy * params.width + gx];

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
  return colour;
}
