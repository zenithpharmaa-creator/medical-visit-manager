import json
from collections import defaultdict
from pathlib import Path

path = Path(__file__).resolve().parents[1] / "data" / "embedded-entities.ts"
text = path.read_text(encoding="utf-8")
entities = json.loads(text[text.index("= [") + 2 : text.rindex("];" ) + 1])
by_name = defaultdict(list)
by_identity = defaultdict(list)
for entity in entities:
    by_name[entity.get("name", "")].append(entity)
    identity = "|".join(str(entity.get(field, "")) for field in ("name", "address", "specialty", "category"))
    by_identity[identity].append(entity)
name_dupes = {name: items for name, items in by_name.items() if len(items) > 1}
identity_dupes = {identity: items for identity, items in by_identity.items() if len(items) > 1}
print(json.dumps({
    "total": len(entities),
    "unique_names": len(by_name),
    "duplicate_name_groups": len(name_dupes),
    "duplicate_identity_groups": len(identity_dupes),
    "duplicate_names": {name: [{"id": item.get("id"), "address": item.get("address"), "specialty": item.get("specialty"), "category": item.get("category")} for item in items] for name, items in list(name_dupes.items())[:30]},
}, ensure_ascii=False, indent=2))
