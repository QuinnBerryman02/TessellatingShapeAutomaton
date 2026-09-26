import { existsSync } from "node:fs";

/** Resolve a Chromium-family binary: env override first, then common installs. */
export function findBrowser() {
  const candidates = [
    process.env.BROWSER_PATH,
    process.env.WGSL_BROWSER,
    "C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe",
    "C:/Program Files (x86)/BraveSoftware/Brave-Browser/Application/brave.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ].filter(Boolean);

  return candidates.find((p) => existsSync(p)) ?? null;
}
