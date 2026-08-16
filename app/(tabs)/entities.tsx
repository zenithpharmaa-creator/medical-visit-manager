import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { useState } from "react";
import { Alert, FlatList, Modal, Pressable, Text, TextInput, View } from "react-native";
import * as XLSX from "xlsx";

import { FormField } from "@/components/form-field";
import { ScreenHeader } from "@/components/screen-header";
import { SelectionModal } from "@/components/selection-modal";
import { useVisitStore } from "@/lib/visit-store";
import { buildId, ENTITY_KINDS } from "@/lib/visit-utils";
import { parseEntitiesFromRows } from "@/lib/entity-import";
import { EntityKind } from "@/shared/visit-types";

export default function EntitiesScreen() {
  const { data, addEntity, replaceEntities } = useVisitStore();
  const [modalVisible, setModalVisible] = useState(false);
  const [kindModal, setKindModal] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<EntityKind>("عيادة");
  const [contactName, setContactName] = useState("");
  const [address, setAddress] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const saveEntity = () => {
    if (!name.trim()) {
      Alert.alert("اكتب اسم الجهة", "اسم الجهة حقل مطلوب قبل الحفظ.");
      return;
    }
    addEntity({ id: buildId("entity"), name: name.trim(), kind, contactName: contactName.trim(), address: address.trim(), createdAt: new Date().toISOString() });
    setName(""); setKind("عيادة"); setContactName(""); setAddress(""); setModalVisible(false);
  };

  const importExcel = async () => {
    setIsImporting(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel", "text/csv"],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = new File(result.assets[0].uri);
      const bytes = await file.arrayBuffer();
      const workbook = XLSX.read(bytes, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "" });
      const entities = parseEntitiesFromRows(rows);
      if (!entities.length) {
        Alert.alert("لم نعثر على أسماء", "أضف عموداً باسم «الاسم» أو «اسم الجهة» في الصف الأول من ملف Excel ثم أعد المحاولة.");
        return;
      }
      Alert.alert("تمت قراءة الملف", `تم العثور على ${entities.length} جهة. هل تريد استبدال القائمة الحالية؟`, [
        { text: "إلغاء", style: "cancel" },
        { text: "إضافة للقائمة", onPress: () => entities.forEach(addEntity) },
        { text: "استبدال", style: "destructive", onPress: () => replaceEntities(entities) },
      ]);
    } catch {
      Alert.alert("تعذر استيراد الملف", "تأكد أن الملف بصيغة Excel أو CSV وأن الصف الأول يحتوي عناوين الأعمدة.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <View className="flex-1 bg-background px-5 pt-[18px]">
      <ScreenHeader title="جهات الزيارة" subtitle="عيادات وصيدليات ومستشفيات ومراكز طبية" icon="local-hospital" />
      <View className="flex-row-reverse gap-3 mb-4">
        <Pressable onPress={() => setModalVisible(true)} className="flex-1 h-12 rounded-xl bg-primary items-center justify-center flex-row-reverse gap-2" style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}><MaterialIcons name="add" size={20} color="#FFFFFF" /><Text className="text-white font-bold">إضافة جهة</Text></Pressable>
        <Pressable onPress={importExcel} disabled={isImporting} className="flex-1 h-12 rounded-xl bg-foreground items-center justify-center flex-row-reverse gap-2" style={({ pressed }) => [{ opacity: pressed || isImporting ? 0.75 : 1 }]}><MaterialIcons name="upload-file" size={20} color="#FFFFFF" /><Text className="text-white font-bold">{isImporting ? "جاري القراءة..." : "استيراد Excel"}</Text></Pressable>
      </View>
      <View className="rounded-xl bg-primary/10 border border-primary/20 p-3 mb-4 flex-row-reverse items-start gap-2"><MaterialIcons name="info-outline" size={19} color="#1565C0" /><Text className="text-primary text-xs leading-5 flex-1 text-right">يمكن أن يحتوي ملف Excel على: الاسم، النوع، الطبيب/المسؤول، الهاتف، العنوان، ملاحظات. يكفي وجود عمود الاسم.</Text></View>
      <FlatList
        data={data.entities}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 12, paddingBottom: 26, flexGrow: 1 }}
        ListEmptyComponent={() => <View className="rounded-2xl bg-surface border border-border p-7 items-center"><MaterialIcons name="folder-open" size={32} color="#64748B" /><Text className="font-bold text-foreground mt-3">لم تُضف جهات بعد</Text><Text className="text-sm text-muted mt-1 text-center">أضف جهة يدوياً أو استورد ملف Excel عندما يصبح جاهزاً.</Text></View>}
        renderItem={({ item }) => <View className="rounded-2xl bg-surface border border-border p-4 flex-row-reverse items-center gap-3"><View className="w-10 h-10 rounded-xl bg-primary items-center justify-center"><MaterialIcons name={item.kind === "صيدلية" ? "local-pharmacy" : "local-hospital"} size={20} color="#FFFFFF" /></View><View className="items-end flex-1"><Text className="font-bold text-foreground text-right">{item.name}</Text><Text className="text-sm text-primary font-semibold mt-1 text-right">{item.kind}</Text>{item.contactName ? <Text className="text-xs text-muted mt-1 text-right">{item.contactName}</Text> : null}</View></View>}
      />

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View className="flex-1 justify-end bg-black/35"><View className="bg-background rounded-t-[28px] px-5 pt-5 pb-8"><View className="flex-row-reverse justify-between items-center mb-5"><Text className="text-lg font-bold text-foreground">إضافة جهة زيارة</Text><Pressable onPress={() => setModalVisible(false)}><MaterialIcons name="close" size={24} color="#102A43" /></Pressable></View><FormField label="اسم الجهة" icon="local-hospital" value={name} onChangeText={setName} placeholder="مثال: عيادة د. أحمد" /><FormField label="نوع الجهة" icon="category"><Pressable onPress={() => setKindModal(true)} className="h-14 rounded-2xl border border-border bg-surface px-4 flex-row-reverse items-center justify-between"><Text className="font-bold text-foreground">{kind}</Text><MaterialIcons name="keyboard-arrow-down" size={24} color="#102A43" /></Pressable></FormField><FormField label="الطبيب أو المسؤول (اختياري)" icon="person" value={contactName} onChangeText={setContactName} placeholder="الاسم" /><FormField label="العنوان (اختياري)" icon="place" value={address} onChangeText={setAddress} placeholder="المدينة أو العنوان" /><Pressable onPress={saveEntity} className="h-14 rounded-2xl bg-success items-center justify-center flex-row-reverse gap-2" style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}><MaterialIcons name="save" size={20} color="#FFFFFF" /><Text className="text-white font-bold">حفظ الجهة</Text></Pressable></View></View>
      </Modal>
      <SelectionModal visible={kindModal} title="اختر نوع الجهة" options={ENTITY_KINDS.map((item) => ({ label: item, value: item }))} selected={kind} onClose={() => setKindModal(false)} onSelect={(option) => setKind(option.value as EntityKind)} />
    </View>
  );
}
