import { Image } from "expo-image";
import { MaterialIcons } from "@expo/vector-icons";
import { View } from "react-native";

type Props = { representativeId?: string; photoUri?: string; size?: number };

const bundledPhotos: Record<string, number> = {
  "rep-1": require("../assets/images/representatives/ali-alshaibi.jpg"),
  "rep-2": require("../assets/images/representatives/mohammed-alhaddad.jpg"),
  "rep-3": require("../assets/images/representatives/mahmoud-alrumaima.jpg"),
};

export function RepresentativeAvatar({ representativeId, photoUri, size = 40 }: Props) {
  const source = photoUri ? { uri: photoUri } : representativeId ? bundledPhotos[representativeId] : undefined;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", backgroundColor: "#EAF3FF", alignItems: "center", justifyContent: "center" }}>
      {source ? <Image source={source} contentFit="cover" style={{ width: size, height: size }} /> : <MaterialIcons name="account-circle" size={Math.max(22, size * 0.66)} color="#1257A6" />}
    </View>
  );
}
