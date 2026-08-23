import AsyncStorage from "@react-native-async-storage/async-storage";
import { PropsWithChildren, createContext, useContext, useEffect, useMemo, useState } from "react";
import { useNetworkState } from "expo-network";

import { AppData, AppSettings, MedicalEntity, Representative, Visit, PlanApprovalAudit, SharedLocation, SyncOperation, SyncRecordType } from "@/shared/visit-types";
import { normalizeEntityKind } from "@/lib/visit-utils";
import { synchronizePendingVisits } from "@/lib/visit-sync";
import { EMBEDDED_ENTITIES } from "@/data/embedded-entities";
import { EMBEDDED_COORDINATES_MIGRATION_VERSION, mergeEmbeddedEntities, preserveExistingCoordinates } from "@/lib/entity-migration";
import { deriveSharedLocations, normalizeSharedLocations, sortSharedLocations } from "@/lib/shared-locations";
import { createSyncChange, enqueueSyncChange, applyRemoteRecords, buildConflicts, syncKey } from "@/lib/sync-queue";
import { createTRPCClient } from "@/lib/trpc";
import { getActivatedDevice } from "@/lib/sync-device";

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
  savedLocations: deriveSharedLocations(EMBEDDED_ENTITIES),
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
  addSharedLocation: (location: SharedLocation) => void;
  updateSharedLocation: (location: SharedLocation) => void;
  deleteSharedLocation: (id: string) => void;
  incrementSharedLocationUsage: (id: string) => void;
  adjustSharedLocationUsage: (id: string, delta: number) => void;
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
  resolveSyncConflict: (id: string, choice: "local" | "server") => void;
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
          const mergedEntities = mergeEmbeddedEntities(parsed.entities, EMBEDDED_ENTITIES, true);
          const normalizedPlannedVisits = (parsed.plannedVisits ?? []).map((item) => ({ ...item, entityKind: normalizeEntityKind(item.entityKind) }));
          const normalizedVisits = (parsed.visits ?? []).map((item) => ({ ...item, entityKind: normalizeEntityKind(item.entityKind) }));
          setData({
            ...INITIAL_DATA,
            ...parsed,
            representatives: parsed.representatives?.length ? parsed.representatives.map((item) => ({ ...item, ...(REPRESENTATIVE_NAMES[item.id] && LEGACY_REPRESENTATIVE_NAMES.has(item.name) ? { name: REPRESENTATIVE_NAMES[item.id] } : {}), ...(REPRESENTATIVE_REGIONS[item.id] ? { region: REPRESENTATIVE_REGIONS[item.id] } : {}), ...(!Array.isArray(item.assignedItems) && REPRESENTATIVE_ITEMS[item.id] ? { assignedItems: REPRESENTATIVE_ITEMS[item.id] } : {}) })) : INITIAL_DATA.representatives,
            representativeLocations: parsed.representativeLocations ?? {},
            entities: mergedEntities,
            savedLocations: normalizeSharedLocations(parsed.savedLocations, mergedEntities),
            plannedVisits: normalizedPlannedVisits,
            visits: normalizedVisits,
            planApprovalHistory: parsed.planApprovalHistory ?? [],
            syncQueue: parsed.syncQueue ?? [],
            syncConflicts: parsed.syncConflicts ?? [],
            syncVersions: parsed.syncVersions ?? {},
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
    const activated = await getActivatedDevice();
    let processed = 0;
    let syncError: string | undefined;
    let syncedAt: string | undefined;
    setData((current) => {
      const result = synchronizePendingVisits(current, checkedAt);
      processed = result.processed;
      return { ...result.data, lastSuccessfulSyncAt: checkedAt };
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (!activated) {
      return { processed, error: "الجهاز غير مفعّل للمزامنة المركزية." };
    }
    try {
      const current = await new Promise<AppData>((resolve) => setData((value) => { resolve(value); return value; }));
      const queue = current.syncQueue ?? [];
      const client = createTRPCClient();
      const response = await client.sync.pushPull.mutate({ deviceId: activated.deviceId, deviceToken: activated.deviceToken, changes: queue.slice(0, 100).map((item) => ({ ...item, payload: item.payload })) });
      if (!response.authorized) return { processed, error: "تم رفض هوية الجهاز. اطلب من المدير إعادة تفعيل الجهاز." };
      const accepted = new Set(response.accepted);
      const conflictIds = new Set(response.conflicts.map((item) => item.changeId));
      setData((value) => {
        const protectedKeys = new Set(value.syncQueue?.filter((item) => conflictIds.has(item.changeId)).map((item) => syncKey(item.recordType, item.recordId)) ?? []);
        const pulled = applyRemoteRecords(value, response.records as never[], protectedKeys);
        const conflicts = buildConflicts(pulled.syncConflicts ?? [], response.conflicts as never[], value.syncQueue ?? []);
        const nextQueue = (pulled.syncQueue ?? []).filter((item) => !accepted.has(item.changeId) && !conflictIds.has(item.changeId));
        syncedAt = checkedAt;
        const next = { ...pulled, syncQueue: nextQueue, syncConflicts: conflicts, lastSuccessfulSyncAt: checkedAt };
        void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    } catch (error) {
      syncError = error instanceof Error ? error.message : "تعذر الاتصال بخادم المزامنة.";
    }
    return { processed, syncedAt, error: syncError };
  };

  useEffect(() => {
    if (networkState.isInternetReachable === true) void syncPendingVisits();
  }, [networkState.isInternetReachable]);

  const save = (updater: (current: AppData) => AppData, change?: { recordType: SyncRecordType; recordId: string; operation?: SyncOperation; payload?: unknown }) => {
    setData((current) => {
      const next = updater(current);
      const queued = change ? enqueueSyncChange(next.syncQueue ?? [], createSyncChange({ recordType: change.recordType, recordId: change.recordId, operation: change.operation ?? "upsert", baseVersion: next.syncVersions?.[syncKey(change.recordType, change.recordId)] ?? 0, payload: change.payload })) : next.syncQueue;
      const persisted = queued ? { ...next, syncQueue: queued } : next;
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(persisted)).catch(() => undefined);
      return persisted;
    });
  };

  const value = useMemo<VisitStoreValue>(
    () => ({
      data,
      loading,
      addVisit: (visit) => save((current) => ({ ...current, visits: [visit, ...current.visits] }), { recordType: "visit", recordId: visit.id, payload: visit }),
      updateVisit: (visit) => save((current) => ({ ...current, visits: current.visits.map((item) => item.id === visit.id ? visit : item) }), { recordType: "visit", recordId: visit.id, payload: visit }),
      addPlannedVisit: (visit) => save((current) => ({ ...current, plannedVisits: [visit, ...current.plannedVisits] }), { recordType: "plannedVisit", recordId: visit.id, payload: visit }),
      updatePlannedVisit: (visit) => save((current) => ({ ...current, plannedVisits: current.plannedVisits.map((item) => item.id === visit.id ? visit : item) }), { recordType: "plannedVisit", recordId: visit.id, payload: visit }),
      addEntity: (entity) => save((current) => ({ ...current, entities: [entity, ...current.entities] }), { recordType: "entity", recordId: entity.id, payload: entity }),
      updateEntity: (entity) => save((current) => ({ ...current, entities: current.entities.map((item) => item.id === entity.id ? preserveExistingCoordinates(item, entity) : item) }), { recordType: "entity", recordId: entity.id, payload: entity }),
      addSharedLocation: (location) => save((current) => ({ ...current, savedLocations: sortSharedLocations([...(current.savedLocations ?? []), location]) }), { recordType: "sharedLocation", recordId: location.id, payload: location }),
      updateSharedLocation: (location) => save((current) => ({ ...current, savedLocations: sortSharedLocations((current.savedLocations ?? []).map((item) => item.id === location.id ? { ...location, usageCount: item.usageCount } : item)) }), { recordType: "sharedLocation", recordId: location.id, payload: location }),
      deleteSharedLocation: (id) => save((current) => ({ ...current, savedLocations: (current.savedLocations ?? []).filter((item) => item.id !== id) }), { recordType: "sharedLocation", recordId: id, operation: "delete" }),
      incrementSharedLocationUsage: (id) => save((current) => ({ ...current, savedLocations: sortSharedLocations((current.savedLocations ?? []).map((item) => item.id === id ? { ...item, usageCount: item.usageCount + 1, updatedAt: new Date().toISOString() } : item)) })),
      adjustSharedLocationUsage: (id, delta) => save((current) => ({ ...current, savedLocations: sortSharedLocations((current.savedLocations ?? []).map((item) => item.id === id ? { ...item, usageCount: Math.max(0, item.usageCount + delta), updatedAt: new Date().toISOString() } : item)) })),
      deleteEntity: (id) => save((current) => ({ ...current, entities: current.entities.filter((item) => item.id !== id) }), { recordType: "entity", recordId: id, operation: "delete" }),
      deleteVisit: (id) => save((current) => ({ ...current, visits: current.visits.filter((visit) => visit.id !== id) }), { recordType: "visit", recordId: id, operation: "delete" }),
      updateRepresentative: (representative) =>
        save((current) => ({
          ...current,
          representatives: current.representatives.map((item) => (item.id === representative.id ? representative : item)),
        })),
      addRepresentative: (representative) => save((current) => ({ ...current, representatives: [...current.representatives, representative] })),
      deleteRepresentative: (id) => save((current) => ({ ...current, representatives: current.representatives.filter((item) => item.id !== id), plannedVisits: current.plannedVisits.filter((item) => item.representativeId !== id), representativeLocations: Object.fromEntries(Object.entries(current.representativeLocations).filter(([key]) => key !== id)) })),
      updateSettings: (settings) => save((current) => ({ ...current, settings })),
      replaceEntities: (entities) => save((current) => ({ ...current, entities: entities.map((entity) => { const previous = current.entities.find((item) => item.id === entity.id); return previous ? preserveExistingCoordinates(previous, entity) : entity; }) })),
      restoreData: (restored) => save(() => { const entities = mergeEmbeddedEntities(restored.entities, EMBEDDED_ENTITIES, true); return { ...restored, entities, plannedVisits: restored.plannedVisits.map((item) => ({ ...item, entityKind: normalizeEntityKind(item.entityKind) })), visits: restored.visits.map((item) => ({ ...item, entityKind: normalizeEntityKind(item.entityKind) })), savedLocations: normalizeSharedLocations(restored.savedLocations, entities) }; }),
      updateRepresentativeLocation: (id, value) => save((current) => ({ ...current, representativeLocations: { ...current.representativeLocations, [id]: value } })),
      addPlanApprovalAudit: (audit) => save((current) => ({ ...current, planApprovalHistory: [audit, ...(current.planApprovalHistory ?? [])] })),
      syncPendingVisits,
      resolveSyncConflict: (id, choice) => setData((current) => {
        const conflict = (current.syncConflicts ?? []).find((item) => item.id === id);
        if (!conflict) return current;
        let resolved = current;
        if (choice === "server") {
          resolved = applyRemoteRecords(current, [{ recordType: conflict.recordType, recordId: conflict.recordId, payload: JSON.stringify(conflict.serverPayload ?? null), version: conflict.serverVersion, deletedAt: null }], new Set());
        } else {
          const entry = createSyncChange({ recordType: conflict.recordType, recordId: conflict.recordId, operation: "upsert", baseVersion: conflict.serverVersion, payload: conflict.localPayload });
          resolved = { ...current, syncQueue: enqueueSyncChange(current.syncQueue ?? [], entry) };
        }
        const next = { ...resolved, syncConflicts: (resolved.syncConflicts ?? []).map((item) => item.id === id ? { ...item, status: choice === "local" ? "kept-local" as const : "kept-server" as const } : item) };
        void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      }),
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
