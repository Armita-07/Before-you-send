import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { cpSync, existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";

/**
 * Custom Vite plugin that builds all Chrome extension entry points
 * (content script, background script, popup) in a single build pass.
 */
function chromeExtensionPlugin() {
  return {
    name: "chrome-extension-build",
    closeBundle() {
      // Copy manifest.json to dist
      cpSync(
        resolve(__dirname, "manifest.json"),
        resolve(__dirname, "dist/manifest.json")
      );

      // Copy icons if they exist
      const iconsDir = resolve(__dirname, "public/icons");
      const distIconsDir = resolve(__dirname, "dist/icons");
      if (existsSync(iconsDir)) {
        cpSync(iconsDir, distIconsDir, { recursive: true });
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  // Content script build
  if (mode === "content") {
    return {
      plugins: [react()],
      define: {
        "process.env.NODE_ENV": JSON.stringify("production"),
      },
      build: {
        outDir: "dist",
        emptyOutDir: false,
        cssCodeSplit: false,
        lib: {
          entry: resolve(__dirname, "src/content/index.tsx"),
          name: "BeforeYouSendContent",
          formats: ["iife"],
          fileName: () => "content/index.js",
        },
        rollupOptions: {
          output: {
            assetFileNames: "content/[name].[ext]",
          },
        },
      },
    };
  }

  // Background script build
  if (mode === "background") {
    return {
      build: {
        outDir: "dist",
        emptyOutDir: false,
        lib: {
          entry: resolve(__dirname, "src/background/index.ts"),
          name: "BeforeYouSendBackground",
          formats: ["iife"],
          fileName: () => "background/index.js",
        },
      },
    };
  }

  // Default: Popup build (also copies manifest & icons)
  return {
    plugins: [react(), chromeExtensionPlugin()],
    base: "",
    build: {
      outDir: "dist",
      emptyOutDir: true,
      rollupOptions: {
        input: {
          popup: resolve(__dirname, "src/popup/index.html"),
        },
        output: {
          entryFileNames: "popup/[name].js",
          chunkFileNames: "popup/chunks/[name]-[hash].js",
          assetFileNames: "popup/assets/[name]-[hash].[ext]",
        },
      },
    },
  };
});
