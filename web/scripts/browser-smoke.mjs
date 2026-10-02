// Boots the built app in headless Brave, drives a few frames, and fails if the
// GPU device, shaders, console, or frame loop had any problem.
//
//   npm run build && npm run smoke:browser
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { preview } from "vite";
import { findBrowser } from "./browser-path.mjs";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
// Random high port so a stray leftover server can't block the run.
const PORT = Number(process.env.PORT ?? 5300 + Math.floor(Math.random() * 400));
const APP_URL = `http://localhost:${PORT}/`;

const browserPath = findBrowser();
if (!browserPath) {
  console.error(
    "No Chromium/Chrome/Edge/Brave found. Set BROWSER_PATH to the executable.",
  );
  process.exit(2);
}

let server;
let browser;
let profile;
let exitCode = 0;

try {
  server = await preview({
    root: ROOT,
    preview: { port: PORT, strictPort: true },
  });

  profile = await mkdtemp(join(tmpdir(), "tsa-smoke-"));
  browser = await puppeteer.launch({
    executablePath: browserPath,
    headless: true,
    pipe: true,
    timeout: 60000,
    userDataDir: profile,
    args: [
      "--enable-unsafe-webgpu",
      "--enable-unsafe-swiftshader",
      "--no-sandbox",
      "--no-first-run",
      "--no-default-browser-check",
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });

  const consoleErrors = [];
  const pageErrors = [];
  const httpErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !/favicon/i.test(m.text())) {
      consoleErrors.push(m.text());
    }
  });
  page.on("pageerror", (e) => pageErrors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400 && !r.url().endsWith("/favicon.ico")) {
      httpErrors.push(`${r.status()} ${r.url()}`);
    }
  });

  await page.goto(APP_URL, { waitUntil: "load" });
  await page
    .waitForFunction("window.__tsaDiag && window.__tsaDiag.device === true", {
      timeout: 20000,
    })
    .catch(() => {});
  // Let the render loop produce a few frames and flush async GPU errors.
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const diag = await page.evaluate(() => window.__tsaDiag ?? null);

  // Exercise the Lab: draw an L-tromino, find its tilings, save one.
  const lab = await page.evaluate((requestedIndex) => {
    const api = window.__tsaLab;
    if (!api) return { error: "window.__tsaLab is missing" };
    api.setShape([
      [0, 0],
      [1, 0],
      [0, 1],
    ]);
    const count = api.find();
    const index = Math.max(0, Math.min(count - 1, requestedIndex));
    if (count > 0) {
      api.select(index);
      api.save();
    }
    return {
      count,
      index,
      collection: api.collectionSize(),
      info: document.getElementById("view-info")?.textContent ?? "",
    };
  }, Number(process.env.LAB_INDEX ?? 0));

  // Exercise the battle sim: run it twice from the same seed and confirm the
  // result is identical (determinism) while both sides gain ground and clash.
  const battle = await page.evaluate(async () => {
    const api = window.__tsaBattle;
    if (!api) return { error: "window.__tsaBattle is missing" };
    api.setMode("battle");
    api.pause();
    const runOnce = () => {
      api.reset();
      api.run(60);
      return {
        snapshots: api.snapshots(),
        contested: api.contested(),
        tick: api.tickCount(),
      };
    };
    const first = runOnce();
    const second = runOnce();
    return {
      first,
      second,
      deterministic: JSON.stringify(first) === JSON.stringify(second),
    };
  });

  // Toggle tile outlines and the symmetry palette; the renderer must accept it.
  const view = await page.evaluate(async () => {
    const api = window.__tsaView;
    if (!api) return { error: "window.__tsaView is missing" };
    api.setBorders(true);
    api.setSymmetry(true);
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    return { borders: api.borders(), symmetry: api.symmetry() };
  });

  if (process.env.SHOT) {
    await page.screenshot({ path: process.env.SHOT });
  }
  if (process.env.SHOT_PANEL) {
    await page.evaluate(async () => {
      window.__tsaBattle.setMode("lab");
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    });
    await page.screenshot({ path: process.env.SHOT_PANEL });
  }
  if (process.env.SHOT_LAB) {
    await page.evaluate(async () => {
      window.__tsaBattle.setMode("view");
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    });
    await page.screenshot({ path: process.env.SHOT_LAB });
  }
  if (process.env.SHOT_ZOOM) {
    await page.evaluate(async () => {
      window.__tsaView.setZoom(4);
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    });
    await page.screenshot({ path: process.env.SHOT_ZOOM });
  }

  console.log("diagnostics:", JSON.stringify(diag, null, 2));
  console.log("lab:", JSON.stringify(lab));
  console.log("battle:", JSON.stringify(battle));
  console.log("view:", JSON.stringify(view));

  const problems = [];
  if (!diag) {
    problems.push("window.__tsaDiag was never exposed");
  } else {
    if (!diag.supported) problems.push("navigator.gpu is missing");
    if (!diag.device) problems.push("no WebGPU device was created");
    for (const e of diag.gpuErrors ?? []) problems.push(`GPU: ${e}`);
    for (const e of diag.errors ?? []) problems.push(`PAGE: ${e}`);
    if (!(diag.renderedFrames > 0)) {
      problems.push("no frames finished on the GPU");
    }
  }
  if (lab.error) {
    problems.push(`LAB: ${lab.error}`);
  } else {
    if (!(lab.count > 0)) problems.push("lab found no tilings for the L-tromino");
    if (!(lab.collection > 0)) problems.push("lab did not save a discovery");
  }
  if (battle.error) {
    problems.push(`BATTLE: ${battle.error}`);
  } else {
    const snaps = battle.first?.snapshots ?? [];
    if (snaps.length !== 2) {
      problems.push(`battle expected 2 participants, got ${snaps.length}`);
    } else {
      if (!(snaps[0].cells > 0)) problems.push("battle: player A claimed nothing");
      if (!(snaps[1].cells > 0)) problems.push("battle: player B claimed nothing");
    }
    if (!(battle.first?.contested > 0)) {
      problems.push("battle: the two patterns never clashed");
    }
    if (!battle.deterministic) {
      problems.push("battle: two identical runs diverged");
    }
  }
  if (view.error) {
    problems.push(`VIEW: ${view.error}`);
  } else {
    if (!view.borders) problems.push("view: borders toggle did not stick");
    if (!view.symmetry) problems.push("view: symmetry toggle did not stick");
  }

  // The interactive explainer must load and build all of its figures.
  const learnErrors = [];
  const learnPage = await browser.newPage();
  learnPage.on("pageerror", (e) => learnErrors.push(e.message));
  learnPage.on("console", (m) => {
    if (m.type() === "error") learnErrors.push(m.text());
  });
  await learnPage.goto(new URL("/learn.html", APP_URL).href, {
    waitUntil: "load",
  });
  await new Promise((resolve) => setTimeout(resolve, 400));
  const learn = await learnPage.evaluate(() => ({
    wallpaper: !!document.getElementById("wallpaper"),
    holoFigures: document.querySelectorAll("#holo-figure canvas").length,
    tileFigures: document.querySelectorAll("#tile-figure canvas").length,
  }));
  if (process.env.SHOT_LEARN) {
    await learnPage.setViewport({ width: 900, height: 1200 });
    await learnPage.screenshot({ path: process.env.SHOT_LEARN, fullPage: true });
  }
  await learnPage.close();
  console.log("learn:", JSON.stringify(learn));
  for (const e of learnErrors) problems.push(`LEARN: ${e}`);
  if (!learn.wallpaper || learn.holoFigures !== 8 || learn.tileFigures !== 8) {
    problems.push(`learn.html figures missing: ${JSON.stringify(learn)}`);
  }

  // The encyclopedia: load it and search size 1, which must report one p4m
  // tiling for the single pixel.
  const encErrors = [];
  const encPage = await browser.newPage();
  encPage.on("pageerror", (e) => encErrors.push(e.message));
  encPage.on("console", (m) => {
    if (m.type() === "error") encErrors.push(m.text());
  });
  await encPage.goto(new URL("/encyclopedia.html", APP_URL).href, {
    waitUntil: "load",
  });
  await encPage.evaluate(async () => {
    document.querySelector(".size-block button")?.click();
    for (let i = 0; i < 400; i++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      const status = document.querySelector(".size-block .status")?.textContent ?? "";
      if (status.includes("done")) return;
    }
  });
  const enc = await encPage.evaluate(() => {
    const block = document.querySelector(".size-block");
    const headers = Array.from(block?.querySelectorAll("thead th") ?? []);
    const p4m = headers.findIndex((th) => th.textContent === "p4m");
    const row = block?.querySelector("tbody tr");
    return {
      sizes: document.querySelectorAll(".size-block").length,
      p4m: row && p4m >= 0 ? row.children[p4m].textContent : null,
    };
  });
  if (process.env.SHOT_ENC) {
    await encPage.setViewport({ width: 1200, height: 900 });
    await encPage.screenshot({ path: process.env.SHOT_ENC, fullPage: true });
  }
  await encPage.close();
  console.log("encyclopedia:", JSON.stringify(enc));
  for (const e of encErrors) problems.push(`ENC: ${e}`);
  if (enc.sizes < 6) problems.push(`encyclopedia rendered ${enc.sizes} sizes`);
  if (enc.p4m !== "1") {
    problems.push(`encyclopedia size-1 p4m expected 1, got ${enc.p4m}`);
  }

  // Following an encyclopedia tile loads it into the Lab drawer via ?shape=.
  const preloadPage = await browser.newPage();
  await preloadPage.goto(new URL("/?shape=0,0;1,0;0,1", APP_URL).href, {
    waitUntil: "load",
  });
  await preloadPage
    .waitForFunction("window.__tsaDiag && window.__tsaDiag.device === true", {
      timeout: 20000,
    })
    .catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, 500));
  const shapeInfo = await preloadPage.evaluate(
    () => document.getElementById("lab-shape-info")?.textContent ?? "",
  );
  await preloadPage.close();
  console.log("preload shape info:", JSON.stringify(shapeInfo));
  if (!/orientation/.test(shapeInfo)) {
    problems.push(`?shape= preload did not reach the Lab: "${shapeInfo}"`);
  }

  for (const e of pageErrors) problems.push(`PAGEERROR: ${e}`);
  for (const e of httpErrors) problems.push(`HTTP: ${e}`);
  for (const e of consoleErrors) problems.push(`CONSOLE.ERROR: ${e}`);

  if (problems.length) {
    console.error("\n✗ smoke failed:");
    for (const p of problems) console.error(`   - ${p}`);
    exitCode = 1;
  } else {
    const snaps = battle.first?.snapshots ?? [];
    console.log(
      `\n✓ WebGPU up, shaders clean, ${diag.renderedFrames} frame(s) rendered, ` +
        `lab found ${lab.count} tiling(s), battle ran ${battle.first?.tick ?? 0} ticks ` +
        `(${snaps.map((s) => `${s.name} ${s.cells}`).join(", ")}; ` +
        `${battle.first?.contested ?? 0} contested).`,
    );
  }
} catch (error) {
  console.error(error);
  exitCode = 1;
} finally {
  try {
    await browser?.close();
  } catch {
    /* ignore */
  }
  try {
    await server?.close();
  } catch {
    /* ignore */
  }
  if (profile) await rm(profile, { recursive: true, force: true }).catch(() => {});
}

process.exit(exitCode);
