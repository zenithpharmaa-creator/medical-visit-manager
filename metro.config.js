const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Keep large source-only files out of Metro's file map. They are used by
// tests/report tooling and are never imported by the mobile/web bundle.
config.resolver.blockList = [
  /\/tests\/.*/,
  /\/scripts\/.*/,
  /\/playwright-report\/.*/,
  /\/test-results\/.*/,
  /\/temporary-data\/.*\.xlsx$/,
];
// A single worker is slower but avoids Metro/Watchman memory spikes in the
// constrained development sandbox and keeps the preview process responsive.
config.maxWorkers = 1;

module.exports = withNativeWind(config, {
  input: "./global.css",
});
