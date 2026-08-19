from pathlib import Path
path = Path('/home/ubuntu/medical-visit-manager/app/(tabs)/record.tsx')
text = path.read_text()
notes_start = text.index('        <FormField label="ملاحظات الزيارة (اختياري)"')
items_start = text.index('        <FormField label="الأصناف المزارة (اختياري)"', notes_start)
photo_start = text.index('        {isManager ? <View className="rounded-2xl border border-border bg-surface p-4 mb-4">', text.index('        <FormField label="اسم الطبيب أو الجهة"'))
notes_block = text[notes_start:items_start]
items_block = text[items_start:photo_start]
text = text[:notes_start] + items_block + notes_block + text[photo_start:]
path.write_text(text)
