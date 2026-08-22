import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ReactNode } from "react";
import { Text, TextInput, View } from "react-native";

type Props = {
  label: string;
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
  children?: ReactNode;
  value?: string;
  onChangeText?: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: React.ComponentProps<typeof TextInput>["keyboardType"];
};

export function FormField({ label, icon, children, value, onChangeText, placeholder, multiline, keyboardType }: Props) {
  return (
    <View className="mb-4">
      <View className="flex-row-reverse items-center gap-2 mb-2">
        <View className="w-7 h-7 rounded-lg bg-primary items-center justify-center">
          <MaterialIcons name={icon} size={15} color="#FFFFFF" />
        </View>
        <Text className="font-bold text-foreground text-right">{label}</Text>
      </View>
      {children ?? (
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#7C8798"
          multiline={multiline}
          keyboardType={keyboardType}
          textAlign="right"
          textAlignVertical={multiline ? "top" : "center"}
          className={`rounded-2xl border border-border bg-surface px-4 text-foreground font-semibold ${multiline ? "min-h-28 pt-3" : "h-14"}`}
        />
      )}
    </View>
  );
}
