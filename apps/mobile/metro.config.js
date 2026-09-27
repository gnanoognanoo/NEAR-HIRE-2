const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
require("./scripts/prepare-map-worker.cjs");
const config = getDefaultConfig(__dirname);
// Shared core sources live at the monorepo root, outside the mobile project.
config.watchFolders = [...config.watchFolders, path.resolve(__dirname, "../..")];
// EAS installs the mobile dependencies; shared sources must resolve them here too.
config.resolver.nodeModulesPaths = [path.resolve(__dirname, "node_modules"), ...(config.resolver.nodeModulesPaths || [])];
module.exports = config;

