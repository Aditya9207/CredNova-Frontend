import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,   // listen on 0.0.0.0 — accessible from LAN/mobile
    port: 5174,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-antd": ["@ant-design/icons"],
          "vendor-clerk": ["@clerk/clerk-react"],
          "vendor-query": ["@tanstack/react-query"],
        },
      },
    },
  },
});
