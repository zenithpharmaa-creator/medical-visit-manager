import AsyncStorage from "@react-native-async-storage/async-storage";
import { PropsWithChildren, createContext, useContext, useEffect, useMemo, useState } from "react";
import { useNetworkState } from "expo-network";

import { AppData, AppSettings, MedicalEntity, Representative, Visit, PlanApprovalAudit } from "@/shared/visit-types";
import { synchronizePendingVisits } from "@/lib/visit-sync";
import { EMBEDDED_ENTITIES } from "@/data/embedded-entities";
import { EMBEDDED_COORDINATES_MIGRATION_VERSION, mergeEmbeddedEntities, preserveExistingCoordinates } from "@/lib/entity-migration";

const STORAGE_KEY = "medical-visit-manager-data-v1";
const EMBEDDED_COORDINATES_MIGRATION_KEY = "medical-visit-manager-embedded-coordinates-version";
const REPRESENTATIVE_NAMES: Record<string, string> = { "rep-1": "علي الشعيبي", "rep-2": "محمد الحداد", "rep-3": "محمود الرميمة" };
const REPRESENTATIVE_REGIONS: Record<string, "north" | "south" | "sanaa"> = { "rep-1": "south", "rep-2": "north", "rep-3": "sanaa" };
const LEGACY_REPRESENTATIVE_NAMES = new Set(["المندوب الأول", "المندوب الثاني", "المندوب الثالث"]);
const REP_1_ITEMS = ["Akisol 2mg tab", "Akisol 5mg tab", "Losart 50mg tab", "Magnacef 200mg cap", "Magnacef 400mg cap", "Magnacef 30ml susp", "Magnacef 60ml susp", "Norcetam 200mg syr", "Norcetam 800mg tab", "Norcetam 400mg tab", "Novepam 1.5mg tab", "Novepam 3mg tab", "Pangesic 500mg tab", "Ramlac 300ml syr", "Zenoril 5mg tab", "Zenoril 10mg tab", "Zenoril 20mg tab", "Moxiram 1g tab", "Lanzoram 30mg cap"];
const REP_2_ITEMS = [...REP_1_ITEMS];
const REP_3_ITEMS = ["Amiram 25mg tab", "Amlocard 5mg tab", "Claritop 125mg susp", "Claritop 250mg tab", "Claritop 500mg tab", "Forticef 250mg susp", "Hyposec 20mg cap", "Infantril 50mg tab", "loxicam 15mg tab", "Zolam 0.25mg tab", "Zolam 0.5mg tab", "Trianil 25mg tab", "Vertizin 25mg tab", "Vertizin 75mg cap", "OflacinRam 200mg tab", "Ramoclav 156mg susp", "Ramoclav 312mg susp", "Motilat 1mg susp", "Motilat 10mg tab"];
const REPRESENTATIVE_ITEMS: Record<string, string[]> = { "rep-1": REP_1_ITEMS, "rep-2": REP_2_ITEMS, "rep-3": REP_3_ITEMS };

const INITIAL_DATA: AppData = {
  representatives: [
    { id: "rep-1", name: REPRESENTATIVE_NAMES["rep-1"], region: REPRESENTATIVE_REGIONS["rep-1"], assignedItems: REP_1_ITEMS, active: true },
    { id: "rep-2", name: REPRESENTATIVE_NAMES["rep-2"], region: REPRESENTATIVE_REGIONS["rep-2"], assignedItems: REP_2_ITEMS, active: true },
    { id: "rep-3", name: REPRESENTATIVE_NAMES["rep-3"], region: REPRESENTATIVE_REGIONS["rep-3"], assignedItems: REP_3_ITEMS, active: true },
  ],
  representativeLocations: {},
  entities: EMBEDDED_ENTITIES,
  plannedVisits: [],
  visits: [],
  settings: { managerName: "مدير النظام", reportEmail: "", reminderTime: "18:00", geofenceRadiusMeters: 200, managerPin: "", visitedItems: [] },
  planApprovalHistory: [],
};

type VisitStoreValue = {
  data: AppData;
  loading: boolean;
  addVisit: (visit: Visit) => void;
  updateVisit: (visit: Visit) => void;
  addPlannedVisit: (visit: AppData["plannedVisits"][number]) => void;
  updatePlannedVisit: (visit: AppData["plannedVisits"][number]) => void;
  addEntity: (entity: MedicalEntity) => void;
  updateEntity: (entity: MedicalEntity) => void;
  deleteEntity: (id: string) => void;
  deleteVisit: (id: string) => void;
  updateRepresentative: (representative: Representative) => void;
  addRepresentative: (representative: Representative) => void;
  deleteRepresentative: (id: string) => void;
  updateSettings: (settings: AppSettings) => void;
  replaceEntities: (entities: MedicalEntity[]) => void;
  restoreData: (data: AppData) => void;
  updateRepresentativeLocation: (id: string, value: AppData["representativeLocations"][string]) => void;
  addPlanApprovalAudit: (audit: PlanApprovalAudit) => void;
  syncPendingVisits: () => Promise<{ processed: number; syncedAt?: string; error?: string }>;
};

const VisitStore = createContext<VisitStoreValue | null>(null);

export function VisitProvider({ children }: PropsWithChildren) {
  const [data, setData] = useState<AppData>(INITIAL_DATA);
  const [loading, setLoading] = useState(true);
  const networkState = useNetworkState();

  useEffect(() => {
    const loadStoredData = async () => {
      try {
        const [saved, migrationVersionValue] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(EMBEDDED_COORDINATES_MIGRATION_KEY),
        ]);
        if (saved) {
          const parsed = JSON.parse(saved) as Partial<AppData>;
          const shouldApplyEmbeddedCoordinates = Number(migrationVersionValue) < EMBEDDED_COORDINATES_MIGRATION_VERSION;
          setData({
            ...INITIAL_DATA,
            ...parsed,
            representatives: parsed.representatives?.length ? parsed.representatives.map((item) => ({ ...item, ...(REPRESENTATIVE_NAMES[item.id] && LEGACY_REPRESENTATIVE_NAMES.has(item.name) ? { name: REPRESENTATIVE_NAMES[item.id] } : {}), ...(REPRESENTATIVE_REGIONS[item.id] ? { region: REPRESENTATIVE_REGIONS[item.id] } : {}), ...(!Array.isArray(item.assignedItems) && REPRESENTATIVE_ITEMS[item.id] ? { assignedItems: REPRESENTATIVE_ITEMS[item.id] } : {}) })) : INITIAL_DATA.representatives,
            representativeLocations: parsed.representativeLocations ?? {},
            entities: mergeEmbeddedEntities(parsed.entities, EMBEDDED_ENTITIES, true),
            plannedVisits: parsed.plannedVisits ?? [],
            visits: parsed.visits ?? [],
            planApprovalHistory: parsed.planApprovalHistory ?? [],
            lastSuccessfulSyncAt: parsed.lastSuccessfulSyncAt,
            settings: { ...INITIAL_DATA.settings, ...(parsed.settings ?? {}), geofenceRadiusMeters: Number(parsed.settings?.geofenceRadiusMeters) || INITIAL_DATA.settings.geofenceRadiusMeters, managerPin: String(parsed.settings?.managerPin ?? INITIAL_DATA.settings.managerPin), visitedItems: Array.isArray(parsed.settings?.visitedItems) ? parsed.settings.visitedItems.filter((item): item is string => typeof item === "string") : [] },
          });
        }
        await AsyncStorage.setItem(EMBEDDED_COORDINATES_MIGRATION_KEY, String(EMBEDDED_COORDINATES_MIGRATION_VERSION));
      } catch {
        // Keep the embedded data available if local storage is unavailable or corrupted.
      } finally {
        setLoading(false);
      }
    };
    void loadStoredData();
  }, []);

  const syncPendingVisits = async () => {
    if (networkState.isInternetReachable !== true) return { processed: 0, error: "لا يوجد اتصال بالإنترنت حالياً." };
    const checkedAt = new Date().toISOString();
    let processed = 0;
    setData((current) => {
      const result = synchronizePendingVisits(current, checkedAt);
      processed = result.processed;
      const next = { ...result.data, lastSuccessfulSyncAt: checkedAt };
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    return { processed, syncedAt: checkedAt };
  };

  useEffect(() => {
    if (networkState.isInternetReachable === true) void syncPendingVisits();
  }, [networkState.isInternetReachable]);

  const save = (updater: (current: AppData) => AppData) => {
    setData((current) => {
      const next = updater(current);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  };

  const value = useMemo<VisitStoreValue>(
    () => ({
      data,
      loading,
      addVisit: (visit) => save((current) => ({ ...current, visits: [visit, ...current.visits] })),
      updateVisit: (visit) => save((current) => ({ ...current, visits: current.visits.map((item) => item.id === visit.id ? visit : item) })),
      addPlannedVisit: (visit) => save((current) => ({ ...current, plannedVisits: [visit, ...current.plannedVisits] })),
      updatePlannedVisit: (visit) => save((current) => ({ ...current, plannedVisits: current.plannedVisits.map((item) => item.id === visit.id ? visit : item) })),
      addEntity: (entity) => save((current) => ({ ...current, entities: [entity, ...current.entities] })),
      updateEntity: (entity) => save((current) => ({ ...current, entities: current.entities.map((item) => item.id === entity.id ? preserveExistingCoordinates(item, entity) : item) })),
      deleteEntity: (id) => save((current) => ({ ...current, entities: current.entities.filter((item) => item.id !== id) })),
      deleteVisit: (id) => save((current) => ({ ...current, visits: current.visits.filter((visit) => visit.id !== id) })),
      updateRepresentative: (representative) =>
        save((current) => ({
          ...current,
          representatives: current.representatives.map((item) => (item.id === representative.id ? representative : item)),
        })),
      addRepresentative: (representative) => save((current) => ({ ...current, representatives: [...current.representatives, representative] })),
      deleteRepresentative: (id) => save((current) => ({ ...current, representatives: current.representatives.filter((item) => item.id !== id), plannedVisits: current.plannedVisits.filter((item) => item.representativeId !== id), representativeLocations: Object.fromEntries(Object.entries(current.representativeLocations).filter(([key]) => key !== id)) })),
      updateSettings: (settings) => save((current) => ({ ...current, settings })),
      replaceEntities: (entities) => save((current) => ({ ...current, entities: entities.map((entity) => { const previous = current.entities.find((item) => item.id === entity.id); return previous ? preserveExistingCoordinates(previous, entity) : entity; }) })),
      restoreData: (restored) => save(() => ({ ...restored, entities: mergeEmbeddedEntities(restored.entities, EMBEDDED_ENTITIES, true) })),
      updateRepresentativeLocation: (id, value) => save((current) => ({ ...current, representativeLocations: { ...current.representativeLocations, [id]: value } })),
      addPlanApprovalAudit: (audit) => save((current) => ({ ...current, planApprovalHistory: [audit, ...(current.planApprovalHistory ?? [])] })),
      syncPendingVisits,
    }),
    [data, loading, networkState.isInternetReachable],
  );

  return <VisitStore.Provider value={value}>{children}</VisitStore.Provider>;
}

export function useVisitStore() {
  const value = useContext(VisitStore);
  if (!value) throw new Error("useVisitStore must be used inside VisitProvider");
  return value;
}
