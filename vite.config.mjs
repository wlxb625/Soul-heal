import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  root: fileURLToPath(new URL("./react-ui", import.meta.url)),
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000"
    }
  },
  build: {
    outDir: fileURLToPath(new URL("./react-ui-dist", import.meta.url)),
    emptyOutDir: true
  }
});
