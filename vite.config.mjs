import { createRequire } from "node:module";
import { resolve } from "node:path";
// Optional external dependency location for restricted build environments.
const dependencyRoot = process.env.EHS_DEPENDENCY_ROOT;
const req = dependencyRoot
  ? createRequire(resolve(dependencyRoot, "package.json"))
  : null;
export default {
  base: "./",
  cacheDir: "test/scratch/.vite",
  resolve: {
    alias: req
      ? [
          ...[
            "react/jsx-runtime",
            "react/jsx-dev-runtime",
            "react-dom/client",
            "react-dom",
            "react",
          ].map((name) => ({ find: name, replacement: req.resolve(name) })),
          {
            find: "lucide-react",
            replacement: resolve(
              dependencyRoot,
              "node_modules/lucide-react/dist/esm/lucide-react.js",
            ),
          },
        ]
      : [],
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 500,
  },
};
