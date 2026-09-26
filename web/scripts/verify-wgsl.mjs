// Compiles every WGSL shader inside a real headless Chromium (Brave) so a
// shader typo fails the test run instead of silently shipping.
//
//   npm run verify:wgsl
//
// Reads the same files Vite serves via `?raw`, so it compiles what ships.
import { readFileSync, readdirSync } from "node:fs";
import http from "node:http";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { findBrowser } from "./browser-path.mjs";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const SHADER_DIR = join(ROOT, "src", "shaders");

function discoverShaders() {
  return readdirSync(SHADER_DIR, { recursive: true })
    .map(String)
    .filter((name) => name.endsWith(".wgsl"))
    .map((name) => ({
      label: relative(ROOT, join(SHADER_DIR, name)).replaceAll("\\", "/"),
      code: readFileSync(join(SHADER_DIR, name), "utf8"),
    }));
}

const browserPath = findBrowser();
if (!browserPath) {
  console.error(
    "No Chromium/Chrome/Edge/Brave found. Set BROWSER_PATH to the executable.",
  );
  process.exit(2);
}

const shaders = discoverShaders();
if (shaders.length === 0) {
  console.error(`No .wgsl files found under ${SHADER_DIR}`);
  process.exit(2);
}

const browser = await puppeteer.launch({
  executablePath: browserPath,
  headless: true,
  pipe: true,
  timeout: 60000,
  args: [
    "--enable-unsafe-webgpu",
    "--enable-unsafe-swiftshader",
    "--no-sandbox",
    "--no-first-run",
    "--no-default-browser-check",
  ],
});

// WebGPU requires a secure context, and in this Chromium `about:blank` has an
// opaque origin where navigator.gpu is undefined. Serve a trivial page on
// http://localhost (a secure context) instead.
const server = http.createServer((_req, res) => {
  res.setHeader("content-type", "text/html");
  res.end("<!doctype html><title>wgsl-check</title>");
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;

let exitCode = 0;
try {
  const page = await browser.newPage();
  await page.goto(`http://localhost:${port}/`);

  const results = await page.evaluate(async (list) => {
    if (!navigator.gpu) return { fatal: "navigator.gpu is undefined" };
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return { fatal: "requestAdapter() returned null" };
    const device = await adapter.requestDevice();

    const out = [];
    for (const { label, code } of list) {
      device.pushErrorScope("validation");
      const module = device.createShaderModule({ code, label });
      const creationError = await device.popErrorScope();
      const info = await module.getCompilationInfo();
      out.push({
        label,
        errors: [
          ...info.messages
            .filter((m) => m.type === "error")
            .map((m) => `${m.lineNum}:${m.linePos} ${m.message}`),
          ...(creationError ? [creationError.message] : []),
        ],
        warnings: info.messages.filter((m) => m.type === "warning").length,
      });
    }
    return { out, vendor: adapter.info?.vendor ?? "unknown" };
  }, shaders);

  if (results.fatal) {
    console.error(`✗ ${results.fatal}`);
    exitCode = 2;
  } else {
    console.log(`adapter: ${results.vendor}`);
    let failed = 0;
    for (const r of results.out) {
      if (r.errors.length) {
        failed++;
        console.error(`✗ ${r.label}`);
        for (const e of r.errors) console.error(`      ${e}`);
      } else {
        const warn = r.warnings ? ` (${r.warnings} warning(s))` : "";
        console.log(`✓ ${r.label}${warn}`);
      }
    }
    if (failed) {
      console.error(`\n${failed} module(s) failed to compile`);
      exitCode = 1;
    } else {
      console.log(`\nAll ${results.out.length} module(s) compile clean.`);
    }
  }
} catch (error) {
  console.error(error);
  exitCode = 1;
} finally {
  await browser.close();
  server.close();
}

process.exit(exitCode);
