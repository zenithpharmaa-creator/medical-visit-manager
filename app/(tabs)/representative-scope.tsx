import { MaterialIcons } from "@expo/vector-icons";
import { goBackToPreviousScreen } from "@/lib/navigation";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { ScreenHeader } from "@/components/screen-header";
import { SelectionModal } from "@/components/selection-modal";
import { useAccountSession } from "@/lib/account-session";
import { useVisitStore } from "@/lib/visit-store";
import { ENTITY_KINDS } from "@/lib/visit-utils";
import type { EntityKind, RepresentativeRegion } from "@/shared/visit-types";

const regionOptions: { label: string; value: RepresentativeRegion }[] = [
  { label: "صنعاء كاملة", value: "sanaa" },
  { label: "المنطقة الشمالية", value: "north" },
  { label: "المنطقة الجنوبية", value: "south" },
];

function ToggleRow({ label, helper, selected, onPress }: { label: string; helper?: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className={`rounded-2xl border p-3 flex-row-reverse items-center gap-3 ${selected ? "bg-primary/10 border-primary" : "bg-surface border-border"}`} style={({ pressed }) => [{ opacity: pressed ? 0.72 : 1 }]}>
      <View className={`w-7 h-7 rounded-lg items-center justify-center ${selected ? "bg-primary" : "bg-background border border-border"}`}>
        {selected ? <MaterialIcons name="check" size={18} color="#FFFFFF" /> : null}
      </View>
      <View className="flex-1 items-end">
        <Text className="font-bold text-foreground text-right">{label}</Text>
        {helper ? <Text className="text-xs text-muted text-right mt-1" numberOfLines={2}>{helper}</Text> : null}
      </View>
    </Pressable>
  );
}

function SectionTitle({ title, count }: { title: string; count?: number }) {
  return <View className="flex-row-reverse items-center justify-between mb-2"><Text className="font-bold text-foreground text-right">{title}</Text>{count !== undefined ? <Text className="text-xs text-primary font-bold">{count} محدد</Text> : null}</View>;
}

export default function RepresentativeScopeScreen() {
  const { data, updateRepresentative } = useVisitStore();
  const { session } = useAccountSession();
  const isManager = session?.role === "manager";
  const [selectedRepId, setSelectedRepId] = useState(data.representatives.find((item) => item.active)?.id ?? data.representatives[0]?.id ?? "");
  const [representativeModal, setRepresentativeModal] = useState(false);
  const [regionModal, setRegionModal] = useState(false);
  const [region, setRegion] = useState<RepresentativeRegion>("sanaa");
  const [assignedItems, setAssignedItems] = useState<string[]>([]);
  const [assignedKinds, setAssignedKinds] = useState<EntityKind[]>([]);
  const [assignedEntityIds, setAssignedEntityIds] = useState<string[]>([]);
  const [assignedSharedLocationIds, setAssignedSharedLocationIds] = useState<string[]>([]);
  const [itemQuery, setItemQuery] = useState("");
  const [entityQuery, setEntityQuery] = useState("");

  const selectedRepresentative = data.representatives.find((item) => item.id === selectedRepId);
  const availableItems = data.settings.visitedItems;
  const filteredItems = useMemo(() => availableItems.filter((item) => item.toLocaleLowerCase().includes(itemQuery.trim().toLocaleLowerCase())), [availableItems, itemQuery]);
  const filteredEntities = useMemo(() => data.entities.filter((item) => `${item.name} ${item.address ?? ""} ${item.nearestPharmacy ?? ""}`.toLocaleLowerCase().includes(entityQuery.trim().toLocaleLowerCase())).slice(0, 80), [data.entities, entityQuery]);
  const availableLocations = data.savedLocations ?? [];

  useEffect(() => {
    if (!selectedRepresentative) return;
    setRegion(selectedRepresentative.region ?? "sanaa");
    setAssignedItems(selectedRepresentative.assignedItems ?? []);
    setAssignedKinds(selectedRepresentative.assignedKinds ?? []);
    setAssignedEntityIds(selectedRepresentative.assignedEntityIds ?? []);
    setAssignedSharedLocationIds(selectedRepresentative.assignedSharedLocationIds ?? []);
  }, [selectedRepId, selectedRepresentative]);

  if (!isManager) {
    return <ScreenContainer className="px-5" containerClassName="bg-background"><View className="flex-1 items-center justify-center"><MaterialIcons name="lock" size={40} color="#C0392B" /><Text className="font-bold text-foreground text-center mt-3">هذه الشاشة متاحة لمدير النظام فقط</Text><Pressable onPress={goBackToPreviousScreen} className="h-12 rounded-xl bg-primary px-6 items-center justify-center mt-4"><Text className="text-white font-bold">رجوع</Text></Pressable></View></ScreenContainer>;
  }

  const toggle = <T,>(values: T[], value: T, setValues: (next: T[]) => void) => setValues(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  const regionLabel = regionOptions.find((item) => item.value === region)?.label ?? "صنعاء كاملة";
  const save = () => {
    if (!selectedRepresentative) return;
    updateRepresentative({ ...selectedRepresentative, region, assignedItems, assignedKinds, assignedEntityIds, assignedSharedLocationIds });
    Alert.alert("تم حفظ التخصيص", `تم تحديث نطاق ${selectedRepresentative.name}. سيظهر التغيير عند فتح قائمة الجهات أو إجراء المزامنة التالية.`);
  };

  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <ScrollView contentContainerStyle={{ paddingTop: 18, paddingBottom: 48 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <ScreenHeader title="تخصيص المندوبين" subtitle="حدد البيانات التي تظهر لكل حساب" icon="tune" />
        <View className="rounded-2xl bg-primary/10 border border-primary/20 p-4 mb-4 flex-row-reverse items-start gap-3"><MaterialIcons name="admin-panel-settings" size={23} color="#1565C0" /><Text className="flex-1 text-right text-primary text-sm leading-6">التخصيص يطبق على تسجيل الزيارة والبحث والخريطة. ترك قائمة الجهات أو الأصناف فارغة يعني السماح بها وفق المنطقة والأنواع المحددة.</Text></View>
        <Text className="font-bold text-foreground text-right mb-2">حساب المندوب</Text>
        <Pressable onPress={() => setRepresentativeModal(true)} className="h-14 rounded-2xl border border-primary bg-surface px-4 flex-row-reverse items-center justify-between mb-5"><Text className="font-bold text-foreground">{selectedRepresentative?.name ?? "اختر المندوب"}</Text><MaterialIcons name="keyboard-arrow-down" size={24} color="#102A43" /></Pressable>

        <View className="rounded-2xl bg-surface border border-border p-4 mb-4"><SectionTitle title="المنطقة المسموحة" /><Pressable onPress={() => setRegionModal(true)} className="h-13 rounded-xl border border-border bg-background px-3 flex-row-reverse items-center justify-between"><Text className="font-bold text-foreground">{regionLabel}</Text><MaterialIcons name="map" size={20} color="#1565C0" /></Pressable></View>

        <View className="rounded-2xl bg-surface border border-border p-4 mb-4"><SectionTitle title="الأصناف المسموحة" count={assignedItems.length} /><TextInput value={itemQuery} onChangeText={setItemQuery} placeholder="بحث داخل الأصناف" placeholderTextColor="#7C8798" textAlign="right" className="h-12 rounded-xl border border-border bg-background px-3 text-foreground mb-3" />{filteredItems.length ? <View className="gap-2">{filteredItems.map((item) => <ToggleRow key={item} label={item} selected={assignedItems.includes(item)} onPress={() => toggle(assignedItems, item, setAssignedItems)} />)}</View> : <Text className="text-sm text-muted text-right">لا توجد أصناف مطابقة.</Text>}</View>

        <View className="rounded-2xl bg-surface border border-border p-4 mb-4"><SectionTitle title="أنواع الجهات" count={assignedKinds.length} /><View className="gap-2">{ENTITY_KINDS.map((kind) => <ToggleRow key={kind} label={kind} selected={assignedKinds.includes(kind)} onPress={() => toggle(assignedKinds, kind, setAssignedKinds)} />)}</View></View>

        <View className="rounded-2xl bg-surface border border-border p-4 mb-4"><SectionTitle title="جهات محددة" count={assignedEntityIds.length} /><TextInput value={entityQuery} onChangeText={setEntityQuery} placeholder="ابحث باسم الجهة أو العنوان" placeholderTextColor="#7C8798" textAlign="right" className="h-12 rounded-xl border border-border bg-background px-3 text-foreground mb-3" />{filteredEntities.length ? <View className="gap-2">{filteredEntities.map((entity) => <ToggleRow key={entity.id} label={entity.name} helper={`${entity.kind} · ${entity.address || "العنوان غير مسجل"}`} selected={assignedEntityIds.includes(entity.id)} onPress={() => toggle(assignedEntityIds, entity.id, setAssignedEntityIds)} />)}</View> : <Text className="text-sm text-muted text-right">لا توجد جهات مطابقة.</Text>}</View>

        <View className="rounded-2xl bg-surface border border-border p-4 mb-4"><SectionTitle title="مواقع مشتركة محددة" count={assignedSharedLocationIds.length} /><View className="gap-2">{availableLocations.length ? availableLocations.map((location) => <ToggleRow key={location.id} label={location.name} helper={location.address} selected={assignedSharedLocationIds.includes(location.id)} onPress={() => toggle(assignedSharedLocationIds, location.id, setAssignedSharedLocationIds)} />) : <Text className="text-sm text-muted text-right">لا توجد مواقع مشتركة محفوظة.</Text>}</View></View>

        <View className="rounded-2xl bg-warning/10 border border-warning/25 p-4 mb-4 flex-row-reverse items-start gap-3"><MaterialIcons name="info-outline" size={22} color="#B45309" /><Text className="flex-1 text-right text-warning text-xs leading-5">إذا اخترت جهات محددة أو مواقع مشتركة، فلن تظهر لل مندوب إلا العناصر المحددة منها، بالإضافة إلى قيود المنطقة والنوع والصنف.</Text></View>
        <Pressable onPress={save} disabled={!selectedRepresentative} className="h-14 rounded-2xl bg-primary items-center justify-center flex-row-reverse gap-2" style={({ pressed }) => [{ opacity: pressed ? 0.78 : 1 }]}><MaterialIcons name="save" size={21} color="#FFFFFF" /><Text className="text-white font-bold">حفظ تخصيص المندوب</Text></Pressable>
        <Pressable onPress={goBackToPreviousScreen} className="h-12 rounded-xl bg-surface border border-border items-center justify-center mt-3"><Text className="font-bold text-foreground">رجوع</Text></Pressable>
      </ScrollView>
      <SelectionModal visible={representativeModal} title="اختر المندوب" options={data.representatives.filter((item) => item.active).map((item) => ({ label: item.name, value: item.id, helper: item.region === "north" ? "المنطقة الشمالية" : item.region === "south" ? "المنطقة الجنوبية" : "صنعاء كاملة" }))} selected={selectedRepId} onClose={() => setRepresentativeModal(false)} onSelect={(option) => { setSelectedRepId(option.value); setRepresentativeModal(false); }} />
      <SelectionModal visible={regionModal} title="اختر المنطقة" options={regionOptions} selected={region} onClose={() => setRegionModal(false)} onSelect={(option) => { setRegion(option.value as RepresentativeRegion); setRegionModal(false); }} />
    </ScreenContainer>
  );
}
