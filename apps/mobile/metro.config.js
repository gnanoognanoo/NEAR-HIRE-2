const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
require("./scripts/prepare-map-worker.cjs");
const config = getDefaultConfig(__dirname);
// Shared core sources live at the monorepo root, outside the mobile project.
config.watchFolders = [...config.watchFolders, path.resolve(__dirname, "../..")];
module.exports = config;
