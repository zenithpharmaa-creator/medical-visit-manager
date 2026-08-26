import json
from pathlib import Path

path = Path(__file__).resolve().parents[1] / "data" / "embedded-entities.ts"
text = path.read_text(encoding="utf-8")
start = text.index("= [") + 2
end = text.rindex("];" ) + 1
entities = json.loads(text[start:end])
with_coordinates = [
    entity for entity in entities
    if isinstance(entity.get("geographicCoordinates"), dict)
    and isinstance(entity["geographicCoordinates"].get("latitude"), (int, float))
    and isinstance(entity["geographicCoordinates"].get("longitude"), (int, float))
]
print(json.dumps({
    "total": len(entities),
    "with_coordinates": len(with_coordinates),
    "without_coordinates": len(entities) - len(with_coordinates),
}, ensure_ascii=False))
