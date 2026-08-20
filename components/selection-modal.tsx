import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from "react-native";

type Option = { label: string; value: string; helper?: string };

type Props = {
  visible: boolean;
  title: string;
  options: Option[];
  selected?: string;
  onClose: () => void;
  onSelect: (option: Option) => void;
  searchable?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
};

export function SelectionModal({ visible, title, options, selected, onClose, onSelect, searchable = false, searchValue = "", onSearchChange, searchPlaceholder = "بحث سريع..." }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/35" onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}>
          <Pressable className="bg-background rounded-t-[28px] px-5 pt-4 pb-8 max-h-[78%]" onPress={() => undefined}>
            <View className="flex-row-reverse justify-between items-center mb-4">
              <Text className="text-lg font-bold text-foreground">{title}</Text>
              <Pressable onPress={onClose} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
                <MaterialIcons name="close" size={24} color="#102A43" />
              </Pressable>
            </View>
            {searchable ? <View className="h-12 rounded-xl border border-primary bg-surface px-3 flex-row-reverse items-center gap-2 mb-3"><MaterialIcons name="search" size={20} color="#102A43" /><TextInput value={searchValue} onChangeText={onSearchChange} placeholder={searchPlaceholder} placeholderTextColor="#7C8798" textAlign="right" returnKeyType="search" blurOnSubmit={false} className="flex-1 h-full text-foreground font-semibold" /></View> : null}
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator
              contentContainerStyle={{ gap: 10, paddingBottom: 8 }}
              renderItem={({ item }) => {
                const active = item.value === selected;
                return (
                  <Pressable
                    onPress={() => {
                      onSelect(item);
                      onClose();
                    }}
                    className={`rounded-2xl border p-4 flex-row-reverse items-center justify-between ${active ? "bg-primary/10 border-primary" : "bg-surface border-border"}`}
                    style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                  >
                    <View className="items-end flex-1">
                      <Text className="font-bold text-foreground text-right">{item.label}</Text>
                      {item.helper ? <Text className="text-xs text-muted mt-1 text-right">{item.helper}</Text> : null}
                    </View>
                    {active ? <MaterialIcons name="check-circle" size={22} color="#1565C0" /> : <MaterialIcons name="chevron-left" size={22} color="#64748B" />}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}
