import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthKey(date: Date) {
  return date.getFullYear() * 12 + date.getMonth();
}

export function NativeDateTimePicker({ value, mode, onChange, minimumDate, maximumDate }: { value: Date; mode: "date" | "time"; onChange: (date: Date) => void; minimumDate?: Date; maximumDate?: Date }) {
  const [visibleMonth, setVisibleMonth] = useState(() => monthStart(value));

  const days = useMemo(() => {
    if (mode !== "date") return [];
    const firstWeekday = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1).getDay();
    const totalDays = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate();
    return Array.from({ length: firstWeekday + totalDays }, (_, index) => index < firstWeekday ? null : new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), index - firstWeekday + 1));
  }, [mode, visibleMonth]);

  if (mode === "time") {
    const handleChange = (_event: DateTimePickerEvent, selected?: Date) => { if (selected) onChange(selected); };
    return <View className="items-center"><DateTimePicker value={value} mode="time" display="spinner" onChange={handleChange} is24Hour /></View>;
  }

  const minKey = minimumDate ? monthKey(minimumDate) : Number.NEGATIVE_INFINITY;
  const maxKey = maximumDate ? monthKey(maximumDate) : Number.POSITIVE_INFINITY;
  const canGoPrevious = monthKey(visibleMonth) > minKey;
  const canGoNext = monthKey(visibleMonth) < maxKey;
  const monthLabel = new Intl.DateTimeFormat("ar-YE", { month: "long", year: "numeric" }).format(visibleMonth);
  const weekdays = ["أحد", "اثن", "ثلث", "أرب", "خمي", "جمع", "سبت"];

  return <View className="w-full rounded-2xl bg-background border border-border p-3">
    <View className="flex-row-reverse items-center justify-between mb-3">
      <Pressable disabled={!canGoNext} onPress={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))} className={`w-10 h-10 rounded-xl items-center justify-center ${canGoNext ? "bg-primary/10" : "bg-surface opacity-40"}`}><Text className="text-xl font-bold text-primary">‹</Text></Pressable>
      <Text className="text-base font-bold text-foreground">{monthLabel}</Text>
      <Pressable disabled={!canGoPrevious} onPress={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))} className={`w-10 h-10 rounded-xl items-center justify-center ${canGoPrevious ? "bg-primary/10" : "bg-surface opacity-40"}`}><Text className="text-xl font-bold text-primary">›</Text></Pressable>
    </View>
    <View className="flex-row-reverse mb-1">{weekdays.map((day) => <Text key={day} className="flex-1 text-center text-[11px] font-bold text-muted">{day}</Text>)}</View>
    <View className="flex-row-reverse flex-wrap">{days.map((day, index) => {
      const disabled = !day || (minimumDate ? day < new Date(minimumDate.getFullYear(), minimumDate.getMonth(), minimumDate.getDate()) : false) || (maximumDate ? day > new Date(maximumDate.getFullYear(), maximumDate.getMonth(), maximumDate.getDate()) : false);
      const selected = day ? sameDay(day, value) : false;
      const today = day ? sameDay(day, new Date()) : false;
      return <Pressable key={`${day?.toISOString() ?? "empty"}-${index}`} disabled={disabled} onPress={() => day && onChange(day)} className={`w-[14.285%] h-11 items-center justify-center rounded-xl ${selected ? "bg-primary" : today ? "bg-foreground/10" : "bg-transparent"} ${disabled ? "opacity-30" : ""}`}><Text className={`text-sm font-semibold ${selected ? "text-white" : "text-foreground"}`}>{day?.getDate() ?? ""}</Text></Pressable>;
    })}</View>
  </View>;
}
