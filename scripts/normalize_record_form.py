from pathlib import Path

path = Path('/home/ubuntu/medical-visit-manager/app/(tabs)/record.tsx')
text = path.read_text()

photo_start_marker = '        {isManager ? <View className="rounded-2xl border border-border bg-surface p-4 mb-4">'
photo_end_marker = '        </View> : null}\n'
photo_blocks = []
while photo_start_marker in text:
    start = text.index(photo_start_marker)
    end = text.index(photo_end_marker, start) + len(photo_end_marker)
    photo_blocks.append(text[start:end])
    text = text[:start] + text[end:]

note_line = '        <FormField label="ملاحظات الزيارة (اختياري)" icon="notes" value={notes} onChangeText={setNotes} placeholder="اكتب ملخصاً قصيراً للزيارة" multiline />\n'
while text.count(note_line) > 1:
    text = text.replace(note_line, '', 1)

items_start = text.index('        <FormField label="الأصناف المزارة (اختياري)" icon="inventory-2">')
notes_start = text.index(note_line)
location_start = text.index('        <View className="mb-4">', items_start)
if notes_start < items_start:
    notes_block = text[notes_start:items_start]
    items_block = text[items_start:location_start]
    text = text[:notes_start] + items_block + notes_block + text[location_start:]

if photo_blocks:
    location_start = text.index('        <View className="mb-4">', text.index('        <FormField label="الأصناف المزارة (اختياري)"'))
    text = text[:location_start] + photo_blocks[0] + '\n' + text[location_start:]

path.write_text(text)
