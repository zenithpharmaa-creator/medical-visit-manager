from pathlib import Path

path = Path('/home/ubuntu/medical-visit-manager/app/(tabs)/record.tsx')
text = path.read_text()

location_start = text.index('        <View className="mb-4">\n          <View className="flex-row-reverse items-center gap-2 mb-2">')
location_end = text.index('\n        <View className="rounded-2xl border border-border bg-surface p-4 mb-4"><View className="flex-row-reverse items-center justify-between mb-3"><View className="flex-row-reverse items-center gap-2"><View className="w-7 h-7 rounded-lg bg-foreground items-center justify-center"><MaterialIcons name="bug-report"', location_start)
location_block = text[location_start:location_end]
text = text[:location_start] + text[location_end + 1:]

diagnostic_start = text.index('        <View className="rounded-2xl border border-border bg-surface p-4 mb-4"><View className="flex-row-reverse items-center justify-between mb-3"><View className="flex-row-reverse items-center gap-2"><View className="w-7 h-7 rounded-lg bg-foreground items-center justify-center"><MaterialIcons name="bug-report"')
diagnostic_end = text.index('\n\n        {isManager ? <View className="rounded-2xl border border-border bg-surface p-4 mb-4">', diagnostic_start)
text = text[:diagnostic_start] + text[diagnostic_end + 2:]

items_start = text.index('        <FormField label="الأصناف المزارة (اختياري)" icon="inventory-2">')
notes_start = text.index('        <FormField label="ملاحظات الزيارة (اختياري)"', items_start)
save_start = text.index('        <Pressable disabled={isLocating}', notes_start)
items_block = text[items_start:notes_start]
notes_block = text[notes_start:save_start]
text = text[:items_start] + notes_block + items_block + location_block + '\n\n' + text[save_start:]
path.write_text(text)
