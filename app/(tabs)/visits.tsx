import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { Alert, FlatList, Image, Pressable, Text, TextInput, View } from "react-native";

import { ScreenHeader } from "@/components/screen-header";
import { ScreenContainer } from "@/components/screen-container";
import { useAccountSession } from "@/lib/account-session";
import { useVisitStore } from "@/lib/visit-store";
import { formatArabicDate } from "@/lib/visit-utils";

export default function VisitsScreen() {
  const { data, deleteVisit } = useVisitStore();
  const { session } = useAccountSession();
  const isManager = session?.role === "manager";
  const today = new Date();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "verified" | "rejected" | "pending">("all");
  const visibleVisits = data.visits.filter((visit) => isManager || (visit.representativeId === session?.representativeId && new Date(visit.recordedAt).toDateString() === today.toDateString()));
  const filtered = visibleVisits.filter((visit) => {
    const matchesQuery = `${visit.entityName} ${visit.entityKind} ${visit.specialty ?? ""} ${visit.category ?? ""} ${visit.geographicLocation ?? ""}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesStatus = statusFilter === "all" || visit.verificationStatus === statusFilter;
    return matchesQuery && matchesStatus;
  });

  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <View className="pt-[18px] flex-1">
        <ScreenHeader title="الزيارات" subtitle={isManager ? `${filtered.length} زيارة محفوظة` : `${filtered.length} زيارة لك اليوم`} icon="event-note" />
        <View className="h-13 rounded-2xl border border-border bg-surface px-4 flex-row-reverse items-center gap-2 mb-3">
          <MaterialIcons name="search" size={21} color="#102A43" />
          <TextInput value={query} onChangeText={setQuery} placeholder="ابحث بالجهة أو النوع أو التخصص أو الفئة أو الموقع" placeholderTextColor="#7C8798" textAlign="right" className="flex-1 h-full text-foreground font-semibold" />
        </View>
        <View className="flex-row-reverse gap-2 mb-4">
          {([{ value: "all", label: "الكل" }, { value: "verified", label: "مقبولة" }, { value: "rejected", label: "مرفوضة" }, { value: "pending", label: "بانتظار التحقق" }] as const).map((option) => <Pressable key={option.value} onPress={() => setStatusFilter(option.value)} className={`flex-1 min-h-10 rounded-xl items-center justify-center px-1 ${statusFilter === option.value ? option.value === "rejected" ? "bg-error" : option.value === "pending" ? "bg-warning" : "bg-primary" : "bg-surface border border-border"}`}><Text className={`text-[11px] font-bold text-center ${statusFilter === option.value ? "text-white" : "text-foreground"}`}>{option.label}</Text></Pressable>)}
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
                    <Text className="text-sm text-primary font-semibold mt-1 text-right">{item.entityKind} · {representative}</Text>{item.specialty || item.category ? <Text className="text-xs text-muted mt-1 text-right">{[item.specialty, item.category].filter(Boolean).join(" · ")}</Text> : null}{item.geographicLocation ? <Text className="text-xs text-muted mt-1 text-right">الموقع: {item.geographicLocation}</Text> : null}
                    <Text className="text-xs text-muted mt-1 text-right">{formatArabicDate(item.recordedAt)}</Text>
                    {item.location ? <Text className="text-xs text-success mt-1 text-right">تم توثيق الموقع</Text> : <Text className="text-xs text-warning mt-1 text-right">لم يتوفر الموقع</Text>}
                    {item.verificationStatus === "pending" ? <Text className="text-xs text-warning font-bold mt-1 text-right">بانتظار التحقق عند عودة الاتصال</Text> : null}
                    {item.verificationStatus === "verified" ? <Text className="text-xs text-success font-bold mt-1 text-right">تمت مطابقة الموقع وقبول الزيارة</Text> : null}
                    {item.verificationStatus === "rejected" ? <Text className="text-xs text-error font-bold mt-1 text-right">مرفوضة بعد التحقق: {item.verificationReason ?? "الموقع غير مطابق"}</Text> : null}
                    {item.verificationStatus === "override" ? <Text className="text-xs text-primary font-bold mt-1 text-right">مقبولة بتجاوز مدير النظام</Text> : null}
                  </View>
                </View>
                {item.photoUri ? <Image source={{ uri: item.photoUri }} className="w-full h-40 rounded-xl border border-border mt-3" resizeMode="cover" /> : null}
                {item.visitedItems?.length ? <Text className="text-xs text-primary mt-3 text-right">الأصناف المزارة: {item.visitedItems.join("، ")}</Text> : null}
                {item.notes ? <Text className="text-sm text-muted border-t border-border pt-3 mt-3 text-right leading-5">{item.notes}</Text> : null}
                {isManager ? <Pressable onPress={() => Alert.alert("حذف الزيارة", "هل تريد حذف هذه الزيارة نهائياً؟", [{ text: "إلغاء", style: "cancel" }, { text: "حذف", style: "destructive", onPress: () => deleteVisit(item.id) }])} className="self-start mt-3 px-2 py-1" style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}><Text className="text-error font-bold text-xs">حذف</Text></Pressable> : null}
              </View>
            );
          }}
        />
      </View>
    </ScreenContainer>
  );
}
