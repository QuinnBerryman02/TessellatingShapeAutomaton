import { diag } from "../diag.ts";

/** Thin wrapper around the WebGPU device + canvas context bootstrap. */
export interface GpuContext {
  device: GPUDevice;
  context: GPUCanvasContext;
  format: GPUTextureFormat;
  canvas: HTMLCanvasElement;
}

export async function initGpu(canvas: HTMLCanvasElement): Promise<GpuContext> {
  if (!navigator.gpu) {
    diag.errors.push("navigator.gpu is missing");
    throw new Error(
      "WebGPU is not available in this browser. Use a recent Chrome/Edge or Safari.",
    );
  }

  const adapter = await navigator.gpu.requestAdapter({
    powerPreference: "high-performance",
  });
  if (!adapter) {
    diag.errors.push("requestAdapter returned null");
    throw new Error("No suitable GPU adapter was found.");
  }

  const info = (adapter as unknown as { info?: GPUAdapterInfo }).info;
  if (info) {
    diag.adapter = [info.vendor, info.architecture, info.description]
      .filter((part) => part)
      .join(" / ");
  }

  const device = await adapter.requestDevice();
  diag.device = true;

  device.addEventListener("uncapturederror", (event) => {
    const error = (event as unknown as { error: { message: string } }).error;
    diag.gpuErrors.push(error.message);
  });

  const context = canvas.getContext("webgpu");
  if (!context) {
    diag.errors.push("failed to acquire webgpu canvas context");
    throw new Error("Failed to acquire a WebGPU canvas context.");
  }

  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: "opaque" });

  return { device, context, format, canvas };
}

/**
 * Keeps the drawing buffer in sync with the CSS size (and device pixel ratio).
 * Returns true when the size changed, so callers can react (e.g. re-fit a camera).
 */
export function resizeCanvas(canvas: HTMLCanvasElement): boolean {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
  const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
  if (canvas.width === width && canvas.height === height) return false;
  canvas.width = width;
  canvas.height = height;
  return true;
}
