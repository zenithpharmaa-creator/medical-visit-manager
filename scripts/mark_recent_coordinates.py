import json
import subprocess
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[1]
TARGET = PROJECT / "data" / "embedded-entities.ts"
BATCH = "2026-08-26-map-xlsx"


def read_entities(text: str):
    return json.loads(text[text.index("= [") + 2 : text.rindex("];" ) + 1])


def identity(entity):
    return "|".join(str(entity.get(field, "")).strip().casefold() for field in ("name", "address", "specialty", "category"))

current_text = TARGET.read_text(encoding="utf-8")
current = read_entities(current_text)
previous_text = subprocess.check_output(["git", "show", "b2a649d:data/embedded-entities.ts"], cwd=PROJECT, text=True)
previous = read_entities(previous_text)
previous_by_identity = {identity(entity): entity for entity in previous}
marked = 0
for entity in current:
    coords = entity.get("geographicCoordinates")
    if not isinstance(coords, dict) or coords.get("latitude") is None or coords.get("longitude") is None:
        continue
    old = previous_by_identity.get(identity(entity))
    old_coords = old.get("geographicCoordinates") if old else None
    had_old_coords = isinstance(old_coords, dict) and old_coords.get("latitude") is not None and old_coords.get("longitude") is not None
    if not had_old_coords:
        entity["coordinatesAddedAt"] = BATCH
        marked += 1

TARGET.write_text(
    "// Generated from Map.xlsx. Coordinates merged without duplicate entities.\n"
    'import type { MedicalEntity } from "@/shared/visit-types";\n'
    "export const EMBEDDED_ENTITIES: MedicalEntity[] = "
    + json.dumps(current, ensure_ascii=False, indent=2)
    + ";\n",
    encoding="utf-8",
)
print(json.dumps({"marked": marked, "total": len(current)}, ensure_ascii=False))
