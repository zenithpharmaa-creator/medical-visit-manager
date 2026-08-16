import fs from "node:fs/promises";
import path from "node:path";

const zoom = 12;
const minLat = 15.28;
const maxLat = 15.48;
const minLon = 44.10;
const maxLon = 44.30;
const output = path.resolve("assets/maps/sanaa");

function tileX(lon) { return Math.floor(((lon + 180) / 360) * 2 ** zoom); }
function tileY(lat) { const rad = (lat * Math.PI) / 180; return Math.floor((1 - Math.asinh(Math.tan(rad)) / Math.PI) / 2 * 2 ** zoom); }

await fs.mkdir(output, { recursive: true });
const x0 = tileX(minLon); const x1 = tileX(maxLon); const y0 = tileY(maxLat); const y1 = tileY(minLat);
for (let x = x0; x <= x1; x += 1) {
  for (let y = y0; y <= y1; y += 1) {
    const file = path.join(output, `${zoom}_${x}_${y}.png`);
    try {
      await fs.access(file);
      continue;
    } catch {}
    const response = await fetch(`https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`, { headers: { "User-Agent": "medical-visit-manager/1.0" } });
    if (!response.ok) throw new Error(`Tile ${x}/${y} failed: ${response.status}`);
    await fs.writeFile(file, Buffer.from(await response.arrayBuffer()));
  }
}
await fs.writeFile(path.join(output, "README.txt"), "Offline Sana'a tiles at zoom 12. © OpenStreetMap contributors. Approximate coverage for Sana'a city.\n");
console.log(`Downloaded Sana'a tiles: x ${x0}-${x1}, y ${y0}-${y1}`);
