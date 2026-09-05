import { defineConfig } from "vite";
export default defineConfig({
  resolve: { dedupe: ["three"] },
  build: {
    rolldownOptions: {
      input: { app: "index.html", environment: "environment.html", simulation: "simulation.html", probe: "probe.html" },
    },
  },
});
