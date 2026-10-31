import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import fs from "node:fs";

function dbSyncPlugin(): Plugin {
  return {
    name: "db-sync-plugin",
    configureServer(server) {
      server.middlewares.use("/api/db", (req, res) => {
        const dbPath = path.resolve(__dirname, "data/kanban.sqlite");
        if (req.method === "GET") {
          if (fs.existsSync(dbPath)) {
            const data = fs.readFileSync(dbPath);
            res.setHeader("Content-Type", "application/octet-stream");
            res.end(data);
          } else {
            res.statusCode = 404;
            res.end("Not found");
          }
        } else if (req.method === "POST") {
          const chunks: Buffer[] = [];
          req.on("data", (chunk: Buffer) => chunks.push(chunk));
          req.on("end", () => {
            const buffer = Buffer.concat(chunks);
            fs.mkdirSync(path.dirname(dbPath), { recursive: true });
            fs.writeFileSync(dbPath, buffer);
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: true, bytes: buffer.length }));
          });
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), dbSyncPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Prevent vite from obscuring rust errors
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  // Environment prefix for Tauri
  envPrefix: ["VITE_", "TAURI_"],
});

