import { defineConfig } from "vite";

// Project-specific ports so we never collide with another Vite app.
const PORT = 5273;

export default defineConfig({
  server: { port: PORT, strictPort: true },
  preview: { port: PORT, strictPort: true },
});
