import { diag } from "../diag.ts";
import type { GpuContext } from "./device.ts";
import gridShader from "../shaders/grid.wgsl?raw";
import renderShader from "../shaders/render.wgsl?raw";

/** Must match the `Params` struct in both WGSL files: 8 x 4 bytes. */
const PARAMS_BYTES = 32;
const WORKGROUP = 8;

/**
 * Owns the world-grid storage buffer and the compute/render pipelines that
 * operate on it. For now the kernel is a placeholder; the buffer layout (one
 * u32 per cell) is the contract the solver and sim will build on.
 */
export class GridScene {
  readonly width: number;
  readonly height: number;

  private readonly device: GPUDevice;
  private readonly context: GPUCanvasContext;
  private readonly canvas: HTMLCanvasElement;
  private readonly computePipeline: GPUComputePipeline;
  private readonly renderPipeline: GPURenderPipeline;
  private readonly paramsBuffer: GPUBuffer;
  private readonly cellsBuffer: GPUBuffer;
  private readonly computeBindGroup: GPUBindGroup;
  private readonly renderBindGroup: GPUBindGroup;
  private readonly paramsData: ArrayBuffer;
  private readonly paramsF32: Float32Array;
  private readonly paramsU32: Uint32Array;

  /**
   * When true the compute kernel rewrites the grid every frame. Off in M1/M2,
   * where the CPU uploads a static tessellation; the growth sim turns it on.
   */
  simEnabled = false;

  /** Magnification of the world grid. 4 shows about a quarter of the width. */
  zoom = 4;

  constructor(gpu: GpuContext, width: number, height: number) {
    this.device = gpu.device;
    this.context = gpu.context;
    this.canvas = gpu.canvas;
    this.width = width;
    this.height = height;

    this.paramsData = new ArrayBuffer(PARAMS_BYTES);
    this.paramsF32 = new Float32Array(this.paramsData);
    this.paramsU32 = new Uint32Array(this.paramsData);
    this.paramsU32[0] = width;
    this.paramsU32[1] = height;

    // Capture any shader/pipeline validation errors for the headless harness.
    this.device.pushErrorScope("validation");

    this.paramsBuffer = this.device.createBuffer({
      label: "grid-params",
      size: PARAMS_BYTES,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.cellsBuffer = this.device.createBuffer({
      label: "grid-cells",
      size: width * height * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    const computeModule = this.device.createShaderModule({
      label: "grid.wgsl",
      code: gridShader,
    });
    this.computePipeline = this.device.createComputePipeline({
      label: "grid-update",
      layout: "auto",
      compute: { module: computeModule, entryPoint: "main" },
    });

    const renderModule = this.device.createShaderModule({
      label: "render.wgsl",
      code: renderShader,
    });
    this.renderPipeline = this.device.createRenderPipeline({
      label: "grid-draw",
      layout: "auto",
      vertex: { module: renderModule, entryPoint: "vs" },
      fragment: {
        module: renderModule,
        entryPoint: "fs",
        targets: [{ format: gpu.format }],
      },
      primitive: { topology: "triangle-list" },
    });

    this.computeBindGroup = this.device.createBindGroup({
      layout: this.computePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.paramsBuffer } },
        { binding: 1, resource: { buffer: this.cellsBuffer } },
      ],
    });

    this.renderBindGroup = this.device.createBindGroup({
      layout: this.renderPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.paramsBuffer } },
        { binding: 1, resource: { buffer: this.cellsBuffer } },
      ],
    });

    this.device.popErrorScope().then((error) => {
      if (error) diag.gpuErrors.push(error.message);
    });
  }

  setZoom(zoom: number): void {
    this.zoom = Math.max(0.25, zoom);
  }

  /** Uploads one u32 per cell (see `model/tessellation.ts` raster format). */
  setCells(cells: Uint32Array): void {
    if (cells.length !== this.width * this.height) {
      throw new Error(
        `expected ${this.width * this.height} cells, got ${cells.length}`,
      );
    }
    this.device.queue.writeBuffer(this.cellsBuffer, 0, cells);
  }

  render(timeSeconds: number): void {
    this.updateCamera(timeSeconds);

    const encoder = this.device.createCommandEncoder();

    if (this.simEnabled) {
      const compute = encoder.beginComputePass();
      compute.setPipeline(this.computePipeline);
      compute.setBindGroup(0, this.computeBindGroup);
      compute.dispatchWorkgroups(
        Math.ceil(this.width / WORKGROUP),
        Math.ceil(this.height / WORKGROUP),
      );
      compute.end();
    }

    const view = this.context.getCurrentTexture().createView();
    const render = encoder.beginRenderPass({
      colorAttachments: [
        {
          view,
          clearValue: { r: 0.02, g: 0.03, b: 0.05, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    render.setPipeline(this.renderPipeline);
    render.setBindGroup(0, this.renderBindGroup);
    render.draw(3);
    render.end();

    this.device.queue.submit([encoder.finish()]);
    this.device.queue.onSubmittedWorkDone().then(() => {
      diag.renderedFrames++;
    });
  }

  /** Letterbox the square-ish grid inside the current canvas aspect. */
  private updateCamera(timeSeconds: number): void {
    const canvasAspect = this.canvas.width / this.canvas.height;
    const gridAspect = this.width / this.height;

    let scaleX = 1;
    let scaleY = 1;
    if (canvasAspect > gridAspect) {
      scaleX = gridAspect / canvasAspect;
    } else {
      scaleY = canvasAspect / gridAspect;
    }

    this.paramsF32[2] = timeSeconds;
    this.paramsF32[3] = scaleX;
    this.paramsF32[4] = scaleY;
    this.paramsF32[5] = this.zoom;

    this.device.queue.writeBuffer(this.paramsBuffer, 0, this.paramsData);
  }
}
