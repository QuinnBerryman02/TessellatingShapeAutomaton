import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const root = fileURLToPath(new URL(".", import.meta.url));

// Project-specific ports so we never collide with another Vite app.
const PORT = 5273;

export default defineConfig({
  server: { port: PORT, strictPort: true },
  preview: { port: PORT, strictPort: true },
  build: {
    rollupOptions: {
      input: {
        main: resolve(root, "index.html"),
        encyclopedia: resolve(root, "encyclopedia.html"),
      },
    },
  },
});
