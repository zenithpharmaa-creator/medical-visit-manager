const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const projectScriptsPath = escapeRegExp(path.join(__dirname, "scripts"));
const projectTestsPath = escapeRegExp(path.join(__dirname, "tests"));
const playwrightReportPath = escapeRegExp(path.join(__dirname, "playwright-report"));
const testResultsPath = escapeRegExp(path.join(__dirname, "test-results"));
const temporaryExcelPath = escapeRegExp(path.join(__dirname, "temporary-data"));

// Exclude only project-owned test/tooling files. Do not use a broad /scripts/\/.*/
// pattern because it would also hide package scripts such as
// react-native-reanimated/scripts/validate-worklets-version.js from Metro.
config.resolver.blockList = [
  new RegExp(`${projectTestsPath}[\\/] .*`.replace("[\\/] ", "[\\/].*")),
  new RegExp(`${projectScriptsPath}[\\/] .*`.replace("[\\/] ", "[\\/].*")),
  new RegExp(`${playwrightReportPath}[\\/] .*`.replace("[\\/] ", "[\\/].*")),
  new RegExp(`${testResultsPath}[\\/] .*`.replace("[\\/] ", "[\\/].*")),
  new RegExp(`${temporaryExcelPath}[\\/].*\\.xlsx$`),
];

// A single worker is slower but avoids Metro/Watchman memory spikes in the
// constrained development sandbox and keeps the preview process responsive.
config.maxWorkers = 1;

module.exports = withNativeWind(config, {
  input: "./global.css",
});
