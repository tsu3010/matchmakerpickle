import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Serves POST /api/extract during `npm run dev`, using the same handler as the
 * Vercel function, so the whole app works locally with just a .env file.
 */
function localApi(): Plugin {
  return {
    name: "local-api",
    configureServer(server: ViteDevServer) {
      const env = { ...process.env, ...loadEnv(server.config.mode, process.cwd(), "") };
      server.middlewares.use("/api/extract", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "Use POST." }));
          return;
        }
        let raw = "";
        req.on("data", (c) => (raw += c));
        req.on("end", async () => {
          let body: unknown = null;
          try {
            body = JSON.parse(raw);
          } catch {
            /* handled by handler */
          }
          const mod = await server.ssrLoadModule("/server/extract.ts");
          const pass = req.headers["x-app-passcode"];
          const result = await mod.handleExtract(body, Array.isArray(pass) ? pass[0] : pass, env);
          res.statusCode = result.status;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(result.body));
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), localApi()],
  test: {
    environment: "node",
  },
} as Parameters<typeof defineConfig>[0]);
