import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { Alert, FlatList, Pressable, Text, TextInput, View } from "react-native";

import { ScreenHeader } from "@/components/screen-header";
import { ScreenContainer } from "@/components/screen-container";
import { useVisitStore } from "@/lib/visit-store";
import { formatArabicDate } from "@/lib/visit-utils";

export default function VisitsScreen() {
  const { data, deleteVisit } = useVisitStore();
  const [query, setQuery] = useState("");
  const filtered = data.visits.filter((visit) => `${visit.entityName} ${visit.entityKind}`.includes(query.trim()));

  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <View className="pt-[18px] flex-1">
        <ScreenHeader title="الزيارات" subtitle={`${data.visits.length} زيارة محفوظة`} icon="event-note" />
        <View className="h-13 rounded-2xl border border-border bg-surface px-4 flex-row-reverse items-center gap-2 mb-4">
          <MaterialIcons name="search" size={21} color="#102A43" />
          <TextInput value={query} onChangeText={setQuery} placeholder="ابحث باسم الجهة أو النوع" placeholderTextColor="#7C8798" textAlign="right" className="flex-1 h-full text-foreground font-semibold" />
        </View>
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ gap: 12, paddingBottom: 24, flexGrow: 1 }}
          ListEmptyComponent={() => <View className="rounded-2xl bg-surface border border-border p-7 items-center"><MaterialIcons name="event-busy" size={30} color="#64748B" /><Text className="font-bold text-foreground mt-3">لا توجد زيارات مطابقة</Text><Text className="text-sm text-muted text-center mt-1">يمكنك تسجيل زيارة جديدة من تبويب «تسجيل».</Text></View>}
          renderItem={({ item }) => {
            const representative = data.representatives.find((rep) => rep.id === item.representativeId)?.name ?? "مندوب غير معروف";
            return (
              <View className="rounded-2xl bg-surface border border-border p-4">
                <View className="flex-row-reverse gap-3 items-start">
                  <View className="w-10 h-10 rounded-xl bg-primary items-center justify-center"><MaterialIcons name="location-on" size={20} color="#FFFFFF" /></View>
                  <View className="flex-1 items-end">
                    <Text className="font-bold text-foreground text-right">{item.entityName}</Text>
                    <Text className="text-sm text-primary font-semibold mt-1 text-right">{item.entityKind} · {representative}</Text>
                    <Text className="text-xs text-muted mt-1 text-right">{formatArabicDate(item.recordedAt)}</Text>
                    {item.location ? <Text className="text-xs text-success mt-1 text-right">تم توثيق الموقع</Text> : <Text className="text-xs text-warning mt-1 text-right">لم يتوفر الموقع</Text>}
                  </View>
                </View>
                {item.notes ? <Text className="text-sm text-muted border-t border-border pt-3 mt-3 text-right leading-5">{item.notes}</Text> : null}
                <Pressable onPress={() => Alert.alert("حذف الزيارة", "هل تريد حذف هذه الزيارة نهائياً؟", [{ text: "إلغاء", style: "cancel" }, { text: "حذف", style: "destructive", onPress: () => deleteVisit(item.id) }])} className="self-start mt-3 px-2 py-1" style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
                  <Text className="text-error font-bold text-xs">حذف</Text>
                </Pressable>
              </View>
            );
          }}
        />
      </View>
    </ScreenContainer>
  );
}
