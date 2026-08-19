from pathlib import Path
import re

path = Path('/home/ubuntu/medical-visit-manager/app/(tabs)/reports.tsx')
text = path.read_text()
pattern = r'        \{period === "daily" \? <View className="rounded-2xl bg-surface border border-border p-4 mb-5"><View className="flex-row-reverse items-center justify-between mb-3"><Text className="font-bold text-foreground text-right">معاينة التقرير اليومي</Text>.*?</View> : null\}\n        <View className="rounded-2xl bg-primary'
replacement = '''        {period === "daily" ? <View className="rounded-2xl bg-surface border border-border p-4 mb-5"><View className="flex-row-reverse items-center justify-between mb-3"><Text className="font-bold text-foreground text-right">معاينة التقرير اليومي</Text><Pressable onPress={() => setPreviewFullscreen(true)} className="h-9 rounded-xl bg-foreground px-3 items-center justify-center flex-row-reverse gap-1"><MaterialIcons name="fullscreen" size={17} color="#FFFFFF" /><Text className="text-white text-xs font-bold">تكبير</Text></Pressable></View>{reportPreview()}</View> : null}
        <Modal visible={previewFullscreen} animationType="slide" onRequestClose={() => setPreviewFullscreen(false)}><View className="flex-1 bg-background"><View className="px-5 pt-5 pb-3 border-b border-border flex-row-reverse items-center justify-between"><Pressable onPress={() => setPreviewFullscreen(false)} className="w-10 h-10 rounded-xl bg-surface items-center justify-center"><MaterialIcons name="close" size={23} color="#102A43" /></Pressable><View className="flex-1 items-end mr-3"><Text className="text-lg font-bold text-foreground">معاينة التقرير بملء الشاشة</Text><Text className="text-xs text-muted mt-1">أعمدة ثابتة · ترتيب تصاعدي حسب وقت الزيارة</Text></View><MaterialIcons name="table-view" size={22} color="#1257A6" /></View><ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>{reportPreview(true)}</ScrollView></View></Modal>
        <View className="rounded-2xl bg-primary'''
new_text, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
if count != 1:
    raise SystemExit(f'preview block not found: {count}')
path.write_text(new_text)
