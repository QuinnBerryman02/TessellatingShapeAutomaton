import { diag, installDiagnostics, publishDiagnostics } from "./diag.ts";
import { initGpu, resizeCanvas } from "./gpu/device.ts";
import { GridScene } from "./gpu/gridScene.ts";
import { L_TROMINO_BRICK } from "./model/builtins.ts";
import { rasterize } from "./model/tessellation.ts";

const canvas = document.getElementById("app") as HTMLCanvasElement;
const status = document.getElementById("status") as HTMLDivElement;

const GRID_WIDTH = 256;
const GRID_HEIGHT = 256;

async function main(): Promise<void> {
  installDiagnostics();
  // Exposed for the headless smoke test in scripts/browser-smoke.mjs.
  (window as unknown as { __tsaDiag: typeof diag }).__tsaDiag = diag;

  try {
    const gpu = await initGpu(canvas);
    resizeCanvas(canvas);

    const scene = new GridScene(gpu, GRID_WIDTH, GRID_HEIGHT);

    // M1: rasterise a real tessellation on the CPU and upload it. The compute
    // simulation will take over this buffer in M3.
    const halfW = Math.floor(GRID_WIDTH / 2);
    const halfH = Math.floor(GRID_HEIGHT / 2);
    const raster = rasterize(L_TROMINO_BRICK, {
      minX: -halfW,
      minY: -halfH,
      maxX: -halfW + GRID_WIDTH - 1,
      maxY: -halfH + GRID_HEIGHT - 1,
    });
    scene.setCells(raster.cells);

    const start = performance.now();
    let frameIndex = 0;
    const frame = (now: number): void => {
      resizeCanvas(canvas);
      scene.render((now - start) / 1000);
      if (frameIndex++ % 5 === 0) publishDiagnostics();
      requestAnimationFrame(frame);
    };

    status.remove();
    requestAnimationFrame(frame);
  } catch (error) {
    diag.errors.push((error as Error).message);
    publishDiagnostics();
    status.textContent = `Could not start: ${(error as Error).message}`;
    console.error(error);
  }
}

void main();
