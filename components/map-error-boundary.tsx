import React from "react";
import { Pressable, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

type Props = {
  children: React.ReactNode;
  fallback: React.ReactNode;
};

type State = { hasError: boolean };

export class MapErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    if (__DEV__) console.warn("تعذر تحميل الخريطة:", error);
  }

  retry = () => this.setState({ hasError: false });

  render() {
    if (this.state.hasError) {
      return (
        <View className="flex-1 items-center justify-center bg-surface px-5">
          <MaterialIcons name="map" size={34} color="#64748B" />
          {this.props.fallback}
          <Pressable
            onPress={this.retry}
            accessibilityRole="button"
            accessibilityLabel="إعادة تحميل الخريطة"
            className="mt-3 h-11 rounded-xl bg-primary px-5 items-center justify-center"
            style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}
          >
            <Text className="text-white font-bold">إعادة تحميل الخريطة</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}
