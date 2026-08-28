import fs from "node:fs";

const packagePath = new URL("../package.json", import.meta.url);
const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
packageJson.scripts["dev:metro"] = "cross-env EXPO_NO_METRO_WORKSPACE_ROOT=1 npx expo start --web --port ${EXPO_PORT:-8081}";
packageJson.scripts["dev:metro:standalone"] = "cross-env EXPO_NO_METRO_WORKSPACE_ROOT=1 npx expo start --web --port ${EXPO_PORT:-8081}";
fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

for (const path of ["node_modules/.cache/metro", "node_modules/.cache/metro-file-map", ".metro-cache"]) {
  fs.rmSync(new URL(`../${path}`, import.meta.url), { recursive: true, force: true });
}
console.log("Metro cache cleared and Expo workspace-root scanning disabled.");
