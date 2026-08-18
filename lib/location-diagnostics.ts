import AsyncStorage from "@react-native-async-storage/async-storage";

const LOCATION_DIAGNOSTICS_KEY = "medical-visit-manager-location-diagnostics-v1";
const MAX_DIAGNOSTICS = 50;

export type LocationDiagnostic = {
  id: string;
  createdAt: string;
  stage: "started" | "permission" | "gps" | "last_known" | "success" | "failure";
  result: "pending" | "success" | "failed";
  source?: "gps" | "last_known" | "none";
  accuracy?: number | null;
  latitude?: number;
  longitude?: number;
  offline: boolean;
  message: string;
};

export async function loadLocationDiagnostics(): Promise<LocationDiagnostic[]> {
  try {
    const raw = await AsyncStorage.getItem(LOCATION_DIAGNOSTICS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.slice(0, MAX_DIAGNOSTICS) as LocationDiagnostic[] : [];
  } catch {
    return [];
  }
}

export async function appendLocationDiagnostic(entry: Omit<LocationDiagnostic, "id" | "createdAt">): Promise<LocationDiagnostic> {
  const diagnostic: LocationDiagnostic = { ...entry, id: `locdiag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, createdAt: new Date().toISOString() };
  const current = await loadLocationDiagnostics();
  await AsyncStorage.setItem(LOCATION_DIAGNOSTICS_KEY, JSON.stringify([diagnostic, ...current].slice(0, MAX_DIAGNOSTICS)));
  return diagnostic;
}

export async function clearLocationDiagnostics() {
  await AsyncStorage.removeItem(LOCATION_DIAGNOSTICS_KEY);
}
