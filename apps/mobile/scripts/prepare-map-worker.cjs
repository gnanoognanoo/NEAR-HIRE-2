// MapLibre 6 workers must be served as ESM outside Metro's main bundle.
const fs = require("node:fs");
const path = require("node:path");
const dist = path.join(path.dirname(require.resolve("maplibre-gl/package.json")), "dist");
const output = path.join(__dirname, "../public/maplibre");
fs.mkdirSync(output, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  const content = fs.readFileSync(path.join(dist, file));
  const target = path.join(output, file);
  if (!fs.existsSync(target) || !fs.readFileSync(target).equals(content))
    fs.writeFileSync(target, content);
}
