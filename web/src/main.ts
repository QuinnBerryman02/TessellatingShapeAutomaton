import { initGpu, resizeCanvas } from "./gpu/device";
import { GridScene } from "./gpu/gridScene";
import { diag, installDiagnostics, publishDiagnostics } from "./diag";

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
