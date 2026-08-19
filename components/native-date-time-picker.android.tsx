import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { View } from "react-native";

export function NativeDateTimePicker({ value, mode, onChange, minimumDate, maximumDate }: { value: Date; mode: "date" | "time"; onChange: (date: Date) => void; minimumDate?: Date; maximumDate?: Date }) {
  const handleChange = (_event: DateTimePickerEvent, selected?: Date) => { if (selected) onChange(selected); };
  return <View className="items-center"><DateTimePicker value={value} mode={mode} display={mode === "date" ? "calendar" : "spinner"} onChange={handleChange} is24Hour minimumDate={mode === "date" ? (minimumDate ?? new Date()) : undefined} maximumDate={mode === "date" ? maximumDate : undefined} /></View>;
}
