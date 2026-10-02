import { OWNER_PLAYER_A, OWNER_PLAYER_B } from "./core/cell.ts";
import { diag, installDiagnostics, publishDiagnostics } from "./diag.ts";
import { initGpu, resizeCanvas } from "./gpu/device.ts";
import { GridScene } from "./gpu/gridScene.ts";
import { LabPanel } from "./lab/labPanel.ts";
import { L_TROMINO_BRICK, UNIT_SQUARE } from "./model/builtins.ts";
import { rasterize, type TessellationDef } from "./model/tessellation.ts";
import {
  analyzeSymmetry,
  shapeOrientationCount,
  wallpaperGroup,
} from "./solver/symmetry.ts";
import { Battle } from "./sim/battle.ts";

const canvas = document.getElementById("app") as HTMLCanvasElement;
const status = document.getElementById("status") as HTMLDivElement;
const labRoot = document.getElementById("lab") as HTMLElement;
const modeLab = document.getElementById("mode-lab") as HTMLButtonElement;
const modeBattle = document.getElementById("mode-battle") as HTMLButtonElement;
const modeView = document.getElementById("mode-view") as HTMLButtonElement;
const viewBorders = document.getElementById("view-borders") as HTMLButtonElement;
const viewSymmetry = document.getElementById("view-symmetry") as HTMLButtonElement;
const viewInfo = document.getElementById("view-info") as HTMLSpanElement;

const GRID_WIDTH = 256;
const GRID_HEIGHT = 256;
const BATTLE_TICK_MS = 90;

type Mode = "lab" | "battle" | "view";

/** Parse a `?shape=x,y;x,y` query into cell coordinates. */
function parseShapeParam(value: string | null): [number, number][] {
  if (!value) return [];
  const cells: [number, number][] = [];
  for (const part of value.split(";")) {
    const [x, y] = part.split(",").map(Number);
    if (Number.isFinite(x) && Number.isFinite(y)) cells.push([x, y]);
  }
  return cells;
}

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

    let mode: Mode = "lab";
    let showBorders = false;
    let showSymmetry = false;

    const region = {
      minX: -halfW,
      minY: -halfH,
      maxX: -halfW + GRID_WIDTH - 1,
      maxY: -halfH + GRID_HEIGHT - 1,
    };

    let selected: TessellationDef = L_TROMINO_BRICK;
    let selectedSymmetry = analyzeSymmetry(selected);

    const renderSelected = (): void => {
      const raster = rasterize(
        selected,
        region,
        showSymmetry
          ? {
              classify: (orientation, base) =>
                selectedSymmetry.slotFor(orientation, base),
            }
          : { shadeTiles: true },
      );
      scene.setCells(raster.cells);
      viewInfo.textContent =
        `${selected.placements.length} placement(s) · ` +
        `${selected.shape.cells.length}-cell tile · ` +
        `${shapeOrientationCount(selected.shape)} orient(s) · ` +
        `${wallpaperGroup(selected)}` +
        (showSymmetry
          ? ` · ${selectedSymmetry.orbitCount} orbit(s) · ${selectedSymmetry.pointSymmetries.length} symmetry op(s)`
          : "");
    };

    const applyStyle = (): void => {
      scene.setBorders(showBorders);
      scene.setSymmetry(showSymmetry);
      viewBorders.classList.toggle("active", showBorders);
      viewSymmetry.classList.toggle("active", showSymmetry);
      if (mode !== "battle") renderSelected();
    };

    const showTessellation = (def: TessellationDef): void => {
      selected = def;
      selectedSymmetry = analyzeSymmetry(def);
      renderSelected();
    };

    const battle = new Battle({
      width: GRID_WIDTH,
      height: GRID_HEIGHT,
      participants: [
        {
          name: "brick",
          owner: OWNER_PLAYER_A,
          def: L_TROMINO_BRICK,
          seed: { x: 104, y: 128 },
          maxRadius: 70,
        },
        {
          name: "square",
          owner: OWNER_PLAYER_B,
          def: UNIT_SQUARE,
          seed: { x: 152, y: 128 },
          ringsPerTick: 2,
          maxRadius: 70,
        },
      ],
    });

    const uploadBattle = (): void => scene.setCells(battle.world.cells);
    const battleInfo = (): string => {
      const parts = battle.snapshots().map((s) => `${s.name} ${s.cells}`);
      return `${parts.join(" · ")} · tick ${battle.tickCount}`;
    };

    let battlePaused = false;
    const setMode = (next: Mode): void => {
      mode = next;
      labRoot.hidden = next !== "lab";
      modeLab.classList.toggle("active", next === "lab");
      modeBattle.classList.toggle("active", next === "battle");
      modeView.classList.toggle("active", next === "view");
      if (next === "battle") {
        scene.setZoom(1);
        uploadBattle();
        viewInfo.textContent = battleInfo();
      } else {
        scene.setZoom(4);
        renderSelected();
      }
      resizeCanvas(canvas);
    };

    const lab = new LabPanel({
      root: labRoot,
      onSelect: (def) => showTessellation(def),
    });

    showTessellation(L_TROMINO_BRICK);

    // Test API for scripts/browser-smoke.mjs and manual console poking.
    (window as unknown as { __tsaLab: unknown }).__tsaLab = {
      setShape: (cells: [number, number][]) => lab.setShape(cells),
      find: () => lab.find(),
      results: () => lab.resultDefinitions().length,
      select: (index: number) => lab.select(index),
      save: () => lab.saveSelected(),
      collectionSize: () => lab.collectionSize(),
    };
    (window as unknown as { __tsaBattle: unknown }).__tsaBattle = {
      setMode,
      pause: () => {
        battlePaused = true;
      },
      resume: () => {
        battlePaused = false;
      },
      reset: () => {
        battle.reset();
        if (mode === "battle") uploadBattle();
      },
      run: (ticks = 1) => {
        battle.run(ticks);
        if (mode === "battle") {
          uploadBattle();
          viewInfo.textContent = battleInfo();
        }
      },
      snapshots: () => battle.snapshots(),
      contested: () => battle.contestedCells,
      tickCount: () => battle.tickCount,
    };
    (window as unknown as { __tsaView: unknown }).__tsaView = {
      setBorders: (on: boolean) => {
        showBorders = on;
        applyStyle();
      },
      setSymmetry: (on: boolean) => {
        showSymmetry = on;
        applyStyle();
      },
      borders: () => showBorders,
      symmetry: () => showSymmetry,
      setZoom: (zoom: number) => scene.setZoom(zoom),
    };

    viewBorders.addEventListener("click", () => {
      showBorders = !showBorders;
      applyStyle();
    });
    viewSymmetry.addEventListener("click", () => {
      showSymmetry = !showSymmetry;
      applyStyle();
    });
    applyStyle();

    modeLab.addEventListener("click", () => setMode("lab"));
    modeBattle.addEventListener("click", () => setMode("battle"));
    modeView.addEventListener("click", () => setMode("view"));
    setMode("lab");

    // The encyclopedia links here with ?shape=x,y;x,y to preload a tile.
    const requestedShape = parseShapeParam(
      new URLSearchParams(location.search).get("shape"),
    );
    if (requestedShape.length > 0) {
      lab.setShape(requestedShape);
      setMode("lab");
    }

    const start = performance.now();
    let frameIndex = 0;
    let last = start;
    let accumulator = 0;
    const frame = (now: number): void => {
      resizeCanvas(canvas);
      if (mode === "battle" && !battlePaused) {
        accumulator += Math.min(250, now - last);
        let steps = 0;
        while (accumulator >= BATTLE_TICK_MS && steps < 8) {
          battle.step();
          accumulator -= BATTLE_TICK_MS;
          steps++;
        }
        if (steps > 0) {
          uploadBattle();
          viewInfo.textContent = battleInfo();
        }
      }
      last = now;
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
