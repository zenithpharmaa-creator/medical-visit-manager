import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

export type ReportActionFormat = "pdf" | "xlsx" | "csv" | "html";
export type ReportActionChannel = "email" | "whatsapp";
export type ReportActionContact = { id: string; name: string; email?: string; whatsapp?: string };

const CONTACTS_KEY = "medical-visit-manager:report-action-contacts";
const TEMPLATE_KEY = "medical-visit-manager:report-action-template";
const formatOptions: Array<{ value: ReportActionFormat; label: string; icon: keyof typeof MaterialIcons.glyphMap }> = [
  { value: "xlsx", label: "Excel", icon: "table-view" },
  { value: "pdf", label: "PDF", icon: "picture-as-pdf" },
  { value: "csv", label: "CSV", icon: "grid-on" },
  { value: "html", label: "HTML", icon: "language" },
];

export function ReportActionSheet({
  visible,
  title,
  onClose,
  onExport,
  onSend,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  onExport: (format: ReportActionFormat) => void;
  onSend: (channel: ReportActionChannel, format: ReportActionFormat, contacts: ReportActionContact[], template: string) => void;
}) {
  const [format, setFormat] = useState<ReportActionFormat>("pdf");
  const [contacts, setContacts] = useState<ReportActionContact[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [contactQuery, setContactQuery] = useState("");
  const [template, setTemplate] = useState("مرفق تقرير الزيارات الطبية المطلوب من برنامج مدير الزيارات الطبية.");
  const [contactModalVisible, setContactModalVisible] = useState(false);
  const [templateModalVisible, setTemplateModalVisible] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactWhatsapp, setContactWhatsapp] = useState("");
  const [templateDraft, setTemplateDraft] = useState("");

  useEffect(() => {
    if (!visible) return;
    let active = true;
    void Promise.all([AsyncStorage.getItem(CONTACTS_KEY), AsyncStorage.getItem(TEMPLATE_KEY)]).then(([savedContacts, savedTemplate]) => {
      if (!active) return;
      if (savedContacts) {
        try {
          const parsed = JSON.parse(savedContacts) as ReportActionContact[];
          setContacts(Array.isArray(parsed) ? parsed : []);
        } catch {
          setContacts([]);
        }
      }
      if (savedTemplate) setTemplate(savedTemplate);
    });
    return () => {
      active = false;
    };
  }, [visible]);

  const filteredContacts = useMemo(() => {
    const query = contactQuery.trim().toLowerCase();
    if (!query) return contacts;
    return contacts.filter((contact) => [contact.name, contact.email, contact.whatsapp].filter(Boolean).join(" ").toLowerCase().includes(query));
  }, [contactQuery, contacts]);

  const selectedContacts = contacts.filter((contact) => selectedContactIds.includes(contact.id));
  const addContact = async () => {
    const name = contactName.trim();
    const email = contactEmail.trim();
    const whatsapp = contactWhatsapp.trim();
    if (!name || (!email && !whatsapp)) {
      Alert.alert("بيانات غير مكتملة", "أدخل اسم جهة الاتصال والبريد الإلكتروني أو رقم WhatsApp على الأقل.");
      return;
    }
    const contact: ReportActionContact = { id: `report-contact-${Date.now()}`, name, email: email || undefined, whatsapp: whatsapp || undefined };
    const next = [...contacts, contact];
    setContacts(next);
    setSelectedContactIds((current) => [...current, contact.id]);
    await AsyncStorage.setItem(CONTACTS_KEY, JSON.stringify(next));
    setContactName("");
    setContactEmail("");
    setContactWhatsapp("");
    setContactModalVisible(false);
  };

  const saveTemplate = async () => {
    const next = templateDraft.trim();
    if (!next) {
      Alert.alert("قالب فارغ", "اكتب نص الرسالة قبل الحفظ.");
      return;
    }
    setTemplate(next);
    await AsyncStorage.setItem(TEMPLATE_KEY, next);
    setTemplateModalVisible(false);
    Alert.alert("تم حفظ القالب", "سيُستخدم هذا النص عند إرسال التقرير بالبريد أو WhatsApp.");
  };

  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.overlay}>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="إغلاق قائمة الإجراء" style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}><MaterialIcons name="close" size={22} color="#102A43" /></Pressable>
          <View style={styles.headerText}><Text style={styles.title}>إجراء التقرير</Text><Text style={styles.subtitle}>{title}</Text></View>
          <MaterialIcons name="pending-actions" size={25} color="#1257A6" />
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.sectionTitle}>تحميل</Text>
          {formatOptions.map((option) => <Pressable key={option.value} onPress={() => { setFormat(option.value); onExport(option.value); }} accessibilityRole="button" accessibilityLabel={`تصدير ${option.label}`} style={({ pressed }) => [styles.option, format === option.value && styles.optionActive, pressed && styles.pressed]}><MaterialIcons name={option.icon} size={20} color={format === option.value ? "#1257A6" : "#40566F"} /><Text style={[styles.optionText, format === option.value && styles.optionTextActive]}>{option.label}</Text>{format === option.value ? <MaterialIcons name="check-circle" size={18} color="#16835B" /> : null}</Pressable>)}
          <View style={styles.divider} />
          <Text style={styles.sectionTitle}>إرسال</Text>
          <Text style={styles.helperTitle}>بحث جهات الاتصال</Text>
          <Text style={styles.helperText}>ابحث بالاسم أو البريد أو رقم WhatsApp ثم حدد جهة أو أكثر.</Text>
          <TextInput value={contactQuery} onChangeText={setContactQuery} placeholder="الاسم أو البريد أو رقم WhatsApp" placeholderTextColor="#7C8798" textAlign="right" style={styles.input} />
          <View style={styles.contactsBox}>{filteredContacts.length ? filteredContacts.map((contact) => { const selected = selectedContactIds.includes(contact.id); return <Pressable key={contact.id} onPress={() => setSelectedContactIds((current) => selected ? current.filter((id) => id !== contact.id) : [...current, contact.id])} style={({ pressed }) => [styles.contactRow, selected && styles.contactSelected, pressed && styles.pressed]}><MaterialIcons name={selected ? "check-box" : "check-box-outline-blank"} size={20} color={selected ? "#16835B" : "#7C8798"} /><View style={styles.contactText}><Text style={styles.contactName}>{contact.name}</Text><Text style={styles.contactDetails}>{[contact.email, contact.whatsapp].filter(Boolean).join(" · ")}</Text></View></Pressable>; }) : <Text style={styles.emptyContacts}>لا توجد جهات مطابقة محفوظة حالياً</Text>}</View>
          <Pressable onPress={() => setContactModalVisible(true)} style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}><MaterialIcons name="person-add" size={19} color="#1257A6" /><Text style={styles.outlineButtonText}>إضافة جهة اتصال</Text></Pressable>
          <Pressable onPress={() => { setTemplateDraft(template); setTemplateModalVisible(true); }} style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}><MaterialIcons name="edit-note" size={19} color="#1257A6" /><Text style={styles.outlineButtonText}>حفظ قالب رسالة</Text></Pressable>
          <View style={styles.templatePreview}><Text style={styles.templateLabel}>القالب الحالي</Text><Text style={styles.templateText}>{template}</Text></View>
          <View style={styles.sendRow}>
            <Pressable onPress={() => onSend("whatsapp", format, selectedContacts, template)} style={({ pressed }) => [styles.whatsappButton, pressed && styles.pressed]}><MaterialIcons name="share" size={18} color="#FFFFFF" /><Text style={styles.sendText}>WhatsApp</Text></Pressable>
            <Pressable onPress={() => onSend("email", format, selectedContacts, template)} style={({ pressed }) => [styles.emailButton, pressed && styles.pressed]}><MaterialIcons name="email" size={18} color="#FFFFFF" /><Text style={styles.sendText}>البريد</Text></Pressable>
          </View>
          <Text style={styles.footerNote}>الصيغة المحددة للإرسال: {formatOptions.find((option) => option.value === format)?.label}. يمكن تغييرها من قسم التحميل.</Text>
        </ScrollView>
      </View>
    </View>
    <Modal visible={contactModalVisible} transparent animationType="fade" onRequestClose={() => setContactModalVisible(false)}><View style={styles.overlay}><View style={styles.dialog}><Text style={styles.dialogTitle}>إضافة جهة اتصال</Text><TextInput value={contactName} onChangeText={setContactName} placeholder="الاسم" placeholderTextColor="#7C8798" textAlign="right" style={styles.input} /><TextInput value={contactEmail} onChangeText={setContactEmail} placeholder="البريد الإلكتروني (اختياري)" placeholderTextColor="#7C8798" keyboardType="email-address" autoCapitalize="none" textAlign="right" style={styles.input} /><TextInput value={contactWhatsapp} onChangeText={setContactWhatsapp} placeholder="رقم WhatsApp (اختياري)" placeholderTextColor="#7C8798" keyboardType="phone-pad" textAlign="right" style={styles.input} /><View style={styles.dialogActions}><Pressable onPress={() => setContactModalVisible(false)} style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}><Text style={styles.cancelText}>إلغاء</Text></Pressable><Pressable onPress={() => void addContact()} style={({ pressed }) => [styles.confirmButton, pressed && styles.pressed]}><Text style={styles.confirmText}>حفظ</Text></Pressable></View></View></View></Modal>
    <Modal visible={templateModalVisible} transparent animationType="fade" onRequestClose={() => setTemplateModalVisible(false)}><View style={styles.overlay}><View style={styles.dialog}><Text style={styles.dialogTitle}>حفظ قالب رسالة</Text><TextInput value={templateDraft} onChangeText={setTemplateDraft} placeholder="اكتب نص الرسالة" placeholderTextColor="#7C8798" multiline textAlign="right" style={[styles.input, styles.multiline]} /><View style={styles.dialogActions}><Pressable onPress={() => setTemplateModalVisible(false)} style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}><Text style={styles.cancelText}>إلغاء</Text></Pressable><Pressable onPress={() => void saveTemplate()} style={({ pressed }) => [styles.confirmButton, pressed && styles.pressed]}><Text style={styles.confirmText}>حفظ القالب</Text></Pressable></View></View></View></Modal>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.38)" },
  sheet: { maxHeight: "91%", borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: "#FFFFFF", paddingBottom: 16 },
  header: { minHeight: 72, paddingHorizontal: 18, paddingVertical: 12, flexDirection: "row-reverse", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  headerText: { flex: 1, alignItems: "flex-end" },
  title: { color: "#102A43", fontSize: 18, fontWeight: "800" },
  subtitle: { color: "#7C8798", fontSize: 11, marginTop: 3 },
  closeButton: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" },
  content: { padding: 18, gap: 9 },
  sectionTitle: { color: "#102A43", fontSize: 15, fontWeight: "800", textAlign: "right", marginTop: 2 },
  option: { minHeight: 46, borderRadius: 13, borderWidth: 1, borderColor: "#E2E8F0", paddingHorizontal: 13, flexDirection: "row-reverse", alignItems: "center", gap: 10, backgroundColor: "#FFFFFF" },
  optionActive: { borderColor: "#A9C7E8", backgroundColor: "#EFF6FF" },
  optionText: { flex: 1, color: "#40566F", fontSize: 14, fontWeight: "700", textAlign: "right" },
  optionTextActive: { color: "#1257A6" },
  divider: { height: 1, backgroundColor: "#E2E8F0", marginVertical: 5 },
  helperTitle: { color: "#102A43", fontSize: 14, fontWeight: "800", textAlign: "right" },
  helperText: { color: "#7C8798", fontSize: 11, textAlign: "right" },
  input: { minHeight: 46, borderRadius: 13, borderWidth: 1, borderColor: "#D8E0EA", backgroundColor: "#F8FAFC", paddingHorizontal: 13, color: "#102A43", fontSize: 13 },
  contactsBox: { maxHeight: 170, borderRadius: 13, borderWidth: 1, borderColor: "#E2E8F0", overflow: "hidden" },
  contactRow: { minHeight: 52, paddingHorizontal: 12, flexDirection: "row-reverse", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: "#EEF2F6" },
  contactSelected: { backgroundColor: "#ECFDF3" },
  contactText: { flex: 1, alignItems: "flex-end" },
  contactName: { color: "#102A43", fontSize: 13, fontWeight: "800", textAlign: "right" },
  contactDetails: { color: "#7C8798", fontSize: 10, marginTop: 2, textAlign: "right" },
  emptyContacts: { padding: 16, color: "#7C8798", textAlign: "right", fontSize: 12 },
  outlineButton: { minHeight: 45, borderRadius: 13, borderWidth: 1.5, borderColor: "#1257A6", alignItems: "center", justifyContent: "center", flexDirection: "row-reverse", gap: 7 },
  outlineButtonText: { color: "#1257A6", fontSize: 13, fontWeight: "800" },
  templatePreview: { borderRadius: 13, backgroundColor: "#F8FAFC", padding: 12, borderWidth: 1, borderColor: "#E2E8F0" },
  templateLabel: { color: "#7C8798", fontSize: 10, textAlign: "right" },
  templateText: { color: "#40566F", fontSize: 11, lineHeight: 18, marginTop: 4, textAlign: "right" },
  sendRow: { flexDirection: "row-reverse", gap: 9, marginTop: 2 },
  emailButton: { flex: 1, minHeight: 48, borderRadius: 14, backgroundColor: "#1257A6", alignItems: "center", justifyContent: "center", flexDirection: "row-reverse", gap: 7 },
  whatsappButton: { flex: 1, minHeight: 48, borderRadius: 14, backgroundColor: "#16835B", alignItems: "center", justifyContent: "center", flexDirection: "row-reverse", gap: 7 },
  sendText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  footerNote: { color: "#7C8798", fontSize: 10, textAlign: "right", lineHeight: 16 },
  dialog: { margin: 22, borderRadius: 22, backgroundColor: "#FFFFFF", padding: 18, gap: 10 },
  dialogTitle: { color: "#102A43", fontSize: 17, fontWeight: "800", textAlign: "right" },
  multiline: { minHeight: 130, textAlignVertical: "top", lineHeight: 20 },
  dialogActions: { flexDirection: "row-reverse", gap: 9, marginTop: 4 },
  cancelButton: { flex: 1, minHeight: 44, borderRadius: 12, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" },
  cancelText: { color: "#40566F", fontWeight: "800" },
  confirmButton: { flex: 1, minHeight: 44, borderRadius: 12, backgroundColor: "#1257A6", alignItems: "center", justifyContent: "center" },
  confirmText: { color: "#FFFFFF", fontWeight: "800" },
  pressed: { opacity: 0.74 },
});
