/**
 * Tiny diagnostics record that the headless verification harness reads out of
 * the DOM. Keep it dependency-free and cheap to publish.
 */
export interface Diagnostics {
  supported: boolean;
  adapter: string;
  device: boolean;
  renderedFrames: number;
  gpuErrors: string[];
  errors: string[];
}

export const diag: Diagnostics = {
  supported: typeof navigator !== "undefined" && !!navigator.gpu,
  adapter: "",
  device: false,
  renderedFrames: 0,
  gpuErrors: [],
  errors: [],
};

export function installDiagnostics(): void {
  window.addEventListener("error", (event) => {
    diag.errors.push(String(event.message || event.error || "error"));
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason as { message?: string } | undefined;
    diag.errors.push(String(reason?.message ?? event.reason));
  });
}

export function publishDiagnostics(): void {
  let el = document.getElementById("diag");
  if (!el) {
    el = document.createElement("pre");
    el.id = "diag";
    el.style.display = "none";
    document.body.appendChild(el);
  }
  el.textContent = `DIAG:${JSON.stringify(diag)}`;
}
