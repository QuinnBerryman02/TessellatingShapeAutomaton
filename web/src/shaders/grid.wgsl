// Placeholder world-grid update kernel.
//
// This runs one thread per cell and writes the packed cell state. Right now it
// paints an animated diagonal band so we can prove the compute -> storage ->
// render path works. Replace the body with the real model (growth / solver).

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
@group(0) @binding(1) var<storage, read_write> cells: array<u32>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let x = gid.x;
  let y = gid.y;
  if (x >= params.width || y >= params.height) {
    return;
  }

  let i = y * params.width + x;
  let band = (x / 6u + y / 6u + u32(params.time)) % 4u;
  cells[i] = band + 1u;
}
