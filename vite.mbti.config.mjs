import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  define: {
    "process.env.NODE_ENV": JSON.stringify("production")
  },
  build: {
    lib: {
      entry: fileURLToPath(new URL("./react-ui/src/mbti-island.jsx", import.meta.url)),
      name: "YugeMbtiNavigator",
      formats: ["iife"],
      fileName: "mbti-navigator"
    },
    outDir: fileURLToPath(new URL("./assets/react-mbti", import.meta.url)),
    emptyOutDir: true
  }
});
