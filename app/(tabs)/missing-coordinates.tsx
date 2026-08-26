import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { goBackToPreviousScreen } from "@/lib/navigation";

import { ScreenContainer } from "@/components/screen-container";
import { ScreenHeader } from "@/components/screen-header";
import { useAccountSession } from "@/lib/account-session";
import { buildEntityExportRows } from "@/lib/entity-export-format";
import { createEntitiesExcelFile, shareOrDownloadFile } from "@/lib/entity-export";
import { useVisitStore } from "@/lib/visit-store";
import type { MedicalEntity } from "@/shared/visit-types";

type SortMode = "name" | "region" | "kind";

const sortLabels: Record<SortMode, string> = { name: "الاسم", region: "المنطقة", kind: "نوع الجهة" };

const hasCoordinates = (entity: MedicalEntity) => Boolean(
  entity.geographicCoordinates
  && Number.isFinite(entity.geographicCoordinates.latitude)
  && Number.isFinite(entity.geographicCoordinates.longitude),
);

export default function MissingCoordinatesScreen() {
  const { data } = useVisitStore();
  const { session } = useAccountSession();
  const [query, setQuery] = useState("");
  const [exporting, setExporting] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("name");
  const missing = useMemo(() => data.entities.filter((entity) => !hasCoordinates(entity)), [data.entities]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return missing;
    return missing.filter((entity) => [entity.name, entity.address, entity.region, entity.nearestPharmacy, entity.specialty].filter(Boolean).join(" ").toLocaleLowerCase().includes(normalized));
  }, [missing, query]);
  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    const left = (sortMode === "region" ? a.region : sortMode === "kind" ? a.kind : a.name) ?? "";
    const right = (sortMode === "region" ? b.region : sortMode === "kind" ? b.kind : b.name) ?? "";
    return left.localeCompare(right, "ar");
  }), [filtered, sortMode]);

  const cycleSort = () => setSortMode((value) => value === "name" ? "region" : value === "region" ? "kind" : "name");

  const exportMissing = async () => {
    if (!missing.length || exporting) return;
    setExporting(true);
    try {
      const uri = await createEntitiesExcelFile(buildEntityExportRows(missing), "جهات-بدون-إحداثيات");
      await shareOrDownloadFile(uri, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    } catch (error) {
      Alert.alert("تعذر التصدير", error instanceof Error ? error.message : "تعذر إنشاء ملف Excel.");
    } finally {
      setExporting(false);
    }
  };

  if (session?.role !== "manager") {
    return <ScreenContainer className="px-5" containerClassName="bg-background"><View className="flex-1 items-center justify-center"><MaterialIcons name="lock-outline" size={42} color="#C0392B" /><Text className="text-lg font-bold text-foreground mt-3 text-center">هذه الشاشة متاحة لمدير النظام فقط</Text><Pressable onPress={goBackToPreviousScreen} className="h-12 px-6 rounded-2xl bg-primary items-center justify-center mt-5"><Text className="text-white font-bold">عودة</Text></Pressable></View></ScreenContainer>;
  }

  return <ScreenContainer className="px-5" containerClassName="bg-background"><View className="flex-1"><View className="pt-4"><ScreenHeader title="جهات بلا إحداثيات" subtitle="متابعة الجهات التي تحتاج تحديد خط الطول والعرض" icon="location-off" /></View><View className="rounded-2xl bg-warning/10 border border-warning/30 p-4 mb-4 flex-row-reverse items-center gap-3"><View className="w-11 h-11 rounded-xl bg-warning items-center justify-center"><MaterialIcons name="location-searching" size={23} color="#FFFFFF" /></View><View className="flex-1 items-end"><Text className="text-2xl font-bold text-foreground">{missing.length}</Text><Text className="text-sm text-muted text-right mt-1">جهة تحتاج إحداثيات</Text></View></View><View className="flex-row-reverse gap-2 mb-4"><Pressable disabled={!missing.length || exporting} onPress={() => void exportMissing()} className="flex-1 h-12 rounded-2xl bg-success items-center justify-center flex-row-reverse gap-2" style={({ pressed }) => [{ opacity: !missing.length || exporting ? 0.55 : pressed ? 0.8 : 1 }]}><MaterialIcons name="file-download" size={20} color="#FFFFFF" /><Text className="text-white font-bold">{exporting ? "جارٍ التصدير..." : "تصدير Excel"}</Text></Pressable><Pressable onPress={cycleSort} className="h-12 px-3 rounded-2xl bg-primary/10 border border-primary/20 items-center justify-center"><MaterialIcons name="sort" size={19} color="#1257A6" /><Text className="text-xs text-primary font-bold mt-1">حسب {sortLabels[sortMode]}</Text></Pressable><Pressable onPress={() => setQuery("")} className="h-12 px-3 rounded-2xl bg-surface border border-border items-center justify-center"><MaterialIcons name="clear" size={20} color="#102A43" /><Text className="text-xs text-foreground font-bold mt-1">مسح</Text></Pressable></View><View className="flex-row-reverse items-center rounded-2xl border border-border bg-surface px-3 mb-4"><MaterialIcons name="search" size={21} color="#64748B" /><TextInput value={query} onChangeText={setQuery} placeholder="ابحث بالاسم أو العنوان أو الصيدلية" placeholderTextColor="#7C8798" textAlign="right" className="flex-1 h-12 px-3 text-foreground" /></View><Text className="text-xs text-muted text-right mb-3">عرض {sorted.length} من {missing.length} جهة · الفرز: {sortLabels[sortMode]}</Text><FlatList data={sorted} keyExtractor={(item) => item.id} contentContainerStyle={{ paddingBottom: 30 }} showsVerticalScrollIndicator={false} ListEmptyComponent={<View className="rounded-2xl bg-surface border border-border p-6 items-center"><MaterialIcons name="task-alt" size={35} color="#16835B" /><Text className="font-bold text-foreground mt-3 text-center">لا توجد جهات مطابقة</Text></View>} renderItem={({ item, index }) => <View className="rounded-2xl bg-surface border border-border p-4 mb-3"><View className="flex-row-reverse items-start gap-3"><View className="w-10 h-10 rounded-xl bg-error/10 items-center justify-center"><MaterialIcons name="location-off" size={20} color="#C0392B" /></View><View className="flex-1 items-end"><Text className="font-bold text-foreground text-right">{index + 1}. {item.name}</Text><Text className="text-xs text-muted text-right mt-1">{item.kind}{item.specialty ? ` · ${item.specialty}` : ""}{item.category ? ` · الفئة ${item.category}` : ""}</Text><Text className="text-xs text-muted text-right mt-1">العنوان: {item.address || "غير مسجل"}</Text><Text className="text-xs text-muted text-right mt-1">المنطقة: {item.region === "north" ? "شمال صنعاء" : item.region === "south" ? "جنوب صنعاء" : "صنعاء"}{item.nearestPharmacy ? ` · أقرب صيدلية: ${item.nearestPharmacy}` : ""}</Text></View></View></View>} /></View></ScreenContainer>;
}
