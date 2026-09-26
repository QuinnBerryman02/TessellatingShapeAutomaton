import { diag, installDiagnostics, publishDiagnostics } from "./diag.ts";
import { initGpu, resizeCanvas } from "./gpu/device.ts";
import { GridScene } from "./gpu/gridScene.ts";
import { LabPanel } from "./lab/labPanel.ts";
import { L_TROMINO_BRICK } from "./model/builtins.ts";
import { rasterize, type TessellationDef } from "./model/tessellation.ts";

const canvas = document.getElementById("app") as HTMLCanvasElement;
const status = document.getElementById("status") as HTMLDivElement;
const labRoot = document.getElementById("lab") as HTMLElement;
const modeLab = document.getElementById("mode-lab") as HTMLButtonElement;
const modeView = document.getElementById("mode-view") as HTMLButtonElement;
const viewInfo = document.getElementById("view-info") as HTMLSpanElement;

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
    const halfW = Math.floor(GRID_WIDTH / 2);
    const halfH = Math.floor(GRID_HEIGHT / 2);

    const showTessellation = (def: TessellationDef): void => {
      const raster = rasterize(
        def,
        {
          minX: -halfW,
          minY: -halfH,
          maxX: -halfW + GRID_WIDTH - 1,
          maxY: -halfH + GRID_HEIGHT - 1,
        },
        { shadeTiles: true },
      );
      scene.setCells(raster.cells);
      viewInfo.textContent = `${def.placements.length} placement(s) · ${def.shape.cells.length}-cell tile`;
    };

    showTessellation(L_TROMINO_BRICK);

    const lab = new LabPanel({ root: labRoot, onSelect: showTessellation });
    // API for scripts/browser-smoke.mjs and manual console poking.
    (window as unknown as { __tsaLab: unknown }).__tsaLab = {
      setShape: (cells: [number, number][]) => lab.setShape(cells),
      find: () => lab.find(),
      results: () => lab.resultDefinitions().length,
      select: (index: number) => lab.select(index),
      save: () => lab.saveSelected(),
      collectionSize: () => lab.collectionSize(),
    };

    const setMode = (labOn: boolean): void => {
      labRoot.hidden = !labOn;
      modeLab.classList.toggle("active", labOn);
      modeView.classList.toggle("active", !labOn);
      resizeCanvas(canvas);
    };
    modeLab.addEventListener("click", () => setMode(true));
    modeView.addEventListener("click", () => setMode(false));
    setMode(true);

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
