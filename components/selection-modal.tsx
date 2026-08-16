import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { FlatList, Modal, Pressable, Text, View } from "react-native";

type Option = { label: string; value: string; helper?: string };

type Props = {
  visible: boolean;
  title: string;
  options: Option[];
  selected?: string;
  onClose: () => void;
  onSelect: (option: Option) => void;
};

export function SelectionModal({ visible, title, options, selected, onClose, onSelect }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/35" onPress={onClose}>
        <Pressable className="bg-background rounded-t-[28px] px-5 pt-4 pb-8 max-h-[72%]" onPress={() => undefined}>
          <View className="flex-row-reverse justify-between items-center mb-4">
            <Text className="text-lg font-bold text-foreground">{title}</Text>
            <Pressable onPress={onClose} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
              <MaterialIcons name="close" size={24} color="#102A43" />
            </Pressable>
          </View>
          <FlatList
            data={options}
            keyExtractor={(item) => item.value}
            contentContainerStyle={{ gap: 10, paddingBottom: 4 }}
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
      </Pressable>
    </Modal>
  );
}
