import AsyncStorage from "@react-native-async-storage/async-storage";
import { PropsWithChildren, createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNetworkState } from "expo-network";

import { AppData, AppSettings, EmptyDayReview, ManagerDecisionAudit, MedicalEntity, OfficialHoliday, PasswordResetRequest, PlanApprovalAudit, Representative, RepresentativeLeave, SharedLocation, SyncLogEntry, SyncOperation, SyncRecordType, Visit } from "@/shared/visit-types";
import { normalizeEntityKind } from "@/lib/visit-utils";
import { synchronizePendingVisits } from "@/lib/visit-sync";
import { EMBEDDED_ENTITIES } from "@/data/embedded-entities";
import { EMBEDDED_COORDINATES_MIGRATION_VERSION, mergeEmbeddedEntities, preserveExistingCoordinates } from "@/lib/entity-migration";
import { deriveSharedLocations, normalizeSharedLocations, sortSharedLocations } from "@/lib/shared-locations";
import { createSyncChange, enqueueSyncChange, applyRemoteRecords, buildConflicts, syncKey } from "@/lib/sync-queue";
import { getSendableQueue, loadPersistedSyncQueue, markQueueFailure, markQueueSending, persistSyncQueue } from "@/lib/sync-queue-storage";
import { createTRPCClient } from "@/lib/trpc";
import { getActivatedDevice } from "@/lib/sync-device";
import { notifySyncStatus } from "@/lib/sync-notifications";
import { appendSyncLog } from "@/lib/sync-history";
import { startGlobalLoading } from "@/lib/navigation";
import { resolvePasswordResetRequest as buildResolvedPasswordResetRequest } from "@/lib/password-reset";
import { getYemenOfficialHolidaySeeds } from "@/lib/calendar-date";

const STORAGE_KEY = "medical-visit-manager-data-v1";
const EMBEDDED_COORDINATES_MIGRATION_KEY = "medical-visit-manager-embedded-coordinates-version";
const REPRESENTATIVE_NAMES: Record<string, string> = { "rep-1": "علي الشعيبي", "rep-2": "محمد الحداد", "rep-3": "محمود الرميمة" };
const REPRESENTATIVE_REGIONS: Record<string, "north" | "south" | "central"> = { "rep-1": "south", "rep-2": "north", "rep-3": "central" };
const LEGACY_REPRESENTATIVE_NAMES = new Set(["المندوب الأول", "المندوب الثاني", "المندوب الثالث"]);
const REP_1_ITEMS = ["Akisol 2mg tab", "Akisol 5mg tab", "Losart 50mg tab", "Magnacef 200mg cap", "Magnacef 400mg cap", "Magnacef 30ml susp", "Magnacef 60ml susp", "Norcetam 200mg syr", "Norcetam 800mg tab", "Norcetam 400mg tab", "Novepam 1.5mg tab", "Novepam 3mg tab", "Pangesic 500mg tab", "Ramlac 300ml syr", "Zenoril 5mg tab", "Zenoril 10mg tab", "Zenoril 20mg tab", "Moxiram 1g tab", "Lanzoram 30mg cap"];
const REP_2_ITEMS = [...REP_1_ITEMS];
const REP_3_ITEMS = ["Amiram 25mg tab", "Amlocard 5mg tab", "Claritop 125mg susp", "Claritop 250mg tab", "Claritop 500mg tab", "Forticef 250mg susp", "Hyposec 20mg cap", "Infantril 50mg tab", "loxicam 15mg tab", "Zolam 0.25mg tab", "Zolam 0.5mg tab", "Trianil 25mg tab", "Vertizin 25mg tab", "Vertizin 75mg cap", "OflacinRam 200mg tab", "Ramoclav 156mg susp", "Ramoclav 312mg susp", "Motilat 1mg susp", "Motilat 10mg tab"];
const REPRESENTATIVE_ITEMS: Record<string, string[]> = { "rep-1": REP_1_ITEMS, "rep-2": REP_2_ITEMS, "rep-3": REP_3_ITEMS };
const DEFAULT_YEMEN_HOLIDAYS = getYemenOfficialHolidaySeeds(new Date().getFullYear());

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
  representativeLeaves: [],
  officialHolidays: DEFAULT_YEMEN_HOLIDAYS,
  visits: [],
  settings: { managerName: "مدير النظام", reportEmail: "", reminderTime: "18:00", geofenceRadiusMeters: 200, managerPin: "", visitedItems: [] },
  planApprovalHistory: [],
  emptyDayReviews: [],
  managerDecisionHistory: [],
  passwordResetRequests: [],
};

type VisitStoreValue = {
  data: AppData;
  loading: boolean;
  addVisit: (visit: Visit) => void;
  updateVisit: (visit: Visit) => void;
  addPlannedVisit: (visit: AppData["plannedVisits"][number]) => void;
  updatePlannedVisit: (visit: AppData["plannedVisits"][number]) => void;
  upsertRepresentativeLeave: (leave: RepresentativeLeave) => void;
  deleteRepresentativeLeave: (id: string) => void;
  upsertOfficialHoliday: (holiday: OfficialHoliday) => void;
  decideOfficialHoliday: (id: string, status: "approved" | "excluded", decisionNote?: string) => void;
  deleteOfficialHoliday: (id: string) => void;
  reviewEmptyDay: (review: EmptyDayReview) => void;
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
  resolveSyncConflict: (id: string, choice: "local" | "server", note: string) => void;
  recordNotificationTest: (status: "passed" | "failed") => Promise<void>;
  addPasswordResetRequest: (request: PasswordResetRequest) => void;
  resolvePasswordResetRequest: (id: string, status: "approved" | "dismissed", note?: string) => void;
};

const VisitStore = createContext<VisitStoreValue | null>(null);

export function VisitProvider({ children }: PropsWithChildren) {
  const [data, setData] = useState<AppData>(INITIAL_DATA);
  const [loading, setLoading] = useState(true);
  const networkState = useNetworkState();
  const syncPendingVisitsRef = useRef<() => Promise<{ processed: number; syncedAt?: string; error?: string }>>(() => Promise.resolve({ processed: 0 }));

  useEffect(() => {
    const loadStoredData = async () => {
      try {
        const [saved, migrationVersionValue, persistedQueue] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(EMBEDDED_COORDINATES_MIGRATION_KEY),
          loadPersistedSyncQueue(),
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
            representativeLeaves: parsed.representativeLeaves ?? [],
            officialHolidays: [...DEFAULT_YEMEN_HOLIDAYS.filter((holiday) => !(parsed.officialHolidays ?? []).some((saved) => saved.id === holiday.id)), ...(parsed.officialHolidays ?? [])],
            visits: normalizedVisits,
            planApprovalHistory: parsed.planApprovalHistory ?? [],
            emptyDayReviews: parsed.emptyDayReviews ?? [],
            managerDecisionHistory: parsed.managerDecisionHistory ?? [],
            syncQueue: parsed.syncQueue?.length ? parsed.syncQueue : persistedQueue,
            syncConflicts: parsed.syncConflicts ?? [],
            syncHistory: parsed.syncHistory ?? [],
            notificationTests: parsed.notificationTests ?? [],
            passwordResetRequests: parsed.passwordResetRequests ?? [],
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

  const syncPendingVisitsInternal = async () => {
    const startedAt = new Date().toISOString();
    if (networkState.isInternetReachable !== true) {
      const completedAt = new Date().toISOString();
      setData((current) => {
        const next = appendSyncLog(current, { id: `sync-${Date.now()}`, status: "offline", startedAt, completedAt, pushed: 0, pulled: 0, conflicts: 0, message: "لا يوجد اتصال بالإنترنت؛ تم الاحتفاظ بالتغييرات محلياً." });
        void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
      return { processed: 0, error: "لا يوجد اتصال بالإنترنت حالياً." };
    }
    const checkedAt = new Date().toISOString();
    const activated = await getActivatedDevice();
    let processed = 0;
    let currentData = data;
    setData((current) => {
      const result = synchronizePendingVisits(current, checkedAt);
      processed = result.processed;
      currentData = result.data;
      return result.data;
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const representativeName = activated?.representativeId ? currentData.representatives.find((item) => item.id === activated.representativeId)?.name : undefined;
    if (!activated) {
      setData((current) => {
        const next = appendSyncLog(current, { id: `sync-${Date.now()}`, status: "skipped", startedAt, completedAt: new Date().toISOString(), pushed: 0, pulled: 0, conflicts: 0, message: "الجهاز غير مفعّل للمزامنة المركزية." });
        void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
      return { processed, error: "الجهاز غير مفعّل للمزامنة المركزية." };
    }
    let batchIdsForRetry = new Set<string>();
    try {
      const queue = getSendableQueue(currentData.syncQueue ?? []);
      const batch = queue.slice(0, 100);
      if (batch.length === 0) return { processed, syncedAt: checkedAt };
      const batchIds = new Set(batch.map((item) => item.changeId));
      batchIdsForRetry = batchIds;
      setData((current) => {
        const nextQueue = markQueueSending(current.syncQueue ?? [], batchIds);
        const next = { ...current, syncQueue: nextQueue };
        void Promise.all([AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)), persistSyncQueue(nextQueue)]);
        return next;
      });
      const response = await createTRPCClient().sync.pushPull.mutate({ deviceId: activated.deviceId, deviceToken: activated.deviceToken, changes: batch.map((item) => ({ ...item, payload: item.payload })) });
      if (!response.authorized) {
        const message = "تم رفض هوية الجهاز. اطلب من المدير إعادة تفعيل الجهاز.";
        setData((current) => { const next = appendSyncLog(current, { id: `sync-${Date.now()}`, status: "error", startedAt, completedAt: new Date().toISOString(), pushed: 0, pulled: 0, conflicts: 0, message, representativeId: activated.representativeId, representativeName, deviceId: activated.deviceId }); void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)); return next; });
        void notifySyncStatus({ success: false, pushed: 0, pulled: 0, message });
        return { processed, error: message };
      }
      const accepted = new Set(response.accepted);
      const conflictIds = new Set(response.conflicts.map((item) => item.changeId));
      const conflictCount = response.conflicts.length;
      setData((value) => {
        const protectedKeys = new Set(value.syncQueue?.filter((item) => conflictIds.has(item.changeId)).map((item) => syncKey(item.recordType, item.recordId)) ?? []);
        const pulled = applyRemoteRecords(value, response.records as never[], protectedKeys);
        const conflicts = buildConflicts(pulled.syncConflicts ?? [], response.conflicts as never[], value.syncQueue ?? []);
        const nextQueue = (pulled.syncQueue ?? []).filter((item) => !accepted.has(item.changeId) && !conflictIds.has(item.changeId));
        const message = conflictCount ? `اكتملت المزامنة مع ${conflictCount} تعارض يحتاج مراجعة.` : `اكتملت المزامنة: رُفع ${accepted.size} تغيير وسُحب ${response.records.length} سجل.`;
        const next = appendSyncLog({ ...pulled, syncQueue: nextQueue, syncConflicts: conflicts, lastSuccessfulSyncAt: checkedAt }, { id: `sync-${Date.now()}`, status: conflictCount ? "conflict" : "success", startedAt, completedAt: new Date().toISOString(), pushed: accepted.size, pulled: response.records.length, conflicts: conflictCount, message, representativeId: activated.representativeId, representativeName, deviceId: activated.deviceId });
        void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        void notifySyncStatus({ success: conflictCount === 0, pushed: accepted.size, pulled: response.records.length, conflicts: conflictCount, message });
        return next;
      });
      return { processed, syncedAt: checkedAt };
    } catch (error) {
      const message = error instanceof Error ? error.message : "تعذر الاتصال بخادم المزامنة.";
      setData((current) => {
        const failedQueue = markQueueFailure(current.syncQueue ?? [], batchIdsForRetry, message);
        const next = appendSyncLog({ ...current, syncQueue: failedQueue }, { id: `sync-${Date.now()}`, status: "error", startedAt, completedAt: new Date().toISOString(), pushed: 0, pulled: 0, conflicts: 0, message, representativeId: activated.representativeId, representativeName, deviceId: activated.deviceId });
        void Promise.all([AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)), persistSyncQueue(failedQueue)]);
        return next;
      });
      void notifySyncStatus({ success: false, pushed: 0, pulled: 0, message: "تعذر الاتصال بخادم المزامنة؛ ستبقى البيانات محفوظة على الجهاز." });
      return { processed, error: message };
    }
  };

  const syncPendingVisits = async () => {
    const shouldShowLoading = (data.syncQueue?.length ?? 0) > 0;
    const stopLoading = shouldShowLoading ? startGlobalLoading("جاري مزامنة البيانات...") : () => undefined;
    try {
      return await syncPendingVisitsInternal();
    } finally {
      stopLoading();
    }
  };

  syncPendingVisitsRef.current = syncPendingVisits;
  const queueSignature = (data.syncQueue ?? []).map((item) => `${item.changeId}:${item.state ?? "pending"}:${item.nextAttemptAt ?? ""}`).join("|");
  useEffect(() => {
    if (networkState.isInternetReachable !== true || loading || !data.syncQueue?.length) return;
    const sendable = getSendableQueue(data.syncQueue);
    const nextRetryAt = data.syncQueue
      .map((item) => item.nextAttemptAt ? new Date(item.nextAttemptAt).getTime() : Number.POSITIVE_INFINITY)
      .reduce((earliest, value) => Math.min(earliest, value), Number.POSITIVE_INFINITY);
    const delay = sendable.length > 0 ? 0 : Number.isFinite(nextRetryAt) ? Math.max(250, nextRetryAt - Date.now()) : -1;
    if (delay < 0) return;
    const timer = setTimeout(() => void syncPendingVisitsRef.current(), delay);
    return () => clearTimeout(timer);
  }, [data.syncQueue, loading, networkState.isInternetReachable, queueSignature]);

  const save = (updater: (current: AppData) => AppData, change?: { recordType: SyncRecordType; recordId: string; operation?: SyncOperation; payload?: unknown }) => {
    const stopLoading = startGlobalLoading(change?.recordType === "entity" ? "جاري حفظ جهة الزيارة..." : change?.recordType === "visit" ? "جاري حفظ الزيارة..." : "جاري حفظ البيانات...");
    setData((current) => {
      const next = updater(current);
      const queued = change ? enqueueSyncChange(next.syncQueue ?? [], createSyncChange({ recordType: change.recordType, recordId: change.recordId, operation: change.operation ?? "upsert", baseVersion: next.syncVersions?.[syncKey(change.recordType, change.recordId)] ?? 0, payload: change.payload })) : next.syncQueue;
      const persisted = queued ? { ...next, syncQueue: queued } : next;
      Promise.all([AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(persisted)), persistSyncQueue(persisted.syncQueue ?? [])]).catch(() => undefined).finally(stopLoading);
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
      upsertRepresentativeLeave: (leave) => save((current) => ({ ...current, representativeLeaves: [leave, ...(current.representativeLeaves ?? []).filter((item) => item.id !== leave.id && !(item.representativeId === leave.representativeId && item.date === leave.date && item.period === leave.period))] })),
      deleteRepresentativeLeave: (id) => save((current) => ({ ...current, representativeLeaves: (current.representativeLeaves ?? []).filter((item) => item.id !== id) })),
      upsertOfficialHoliday: (holiday) => save((current) => ({ ...current, officialHolidays: [holiday, ...(current.officialHolidays ?? []).filter((item) => item.id !== holiday.id)] })),
      decideOfficialHoliday: (id, status, decisionNote) => save((current) => {
        const holiday = (current.officialHolidays ?? []).find((item) => item.id === id);
        if (!holiday) return current;
        const decidedAt = new Date().toISOString();
        const decidedBy = current.settings.managerName || "مدير النظام";
        const audit: ManagerDecisionAudit = { id: `manager-decision-${Date.now()}`, decisionType: "official-holiday", targetId: id, decision: status, reason: decisionNote?.trim() || undefined, decidedBy, decidedAt };
        return { ...current, officialHolidays: (current.officialHolidays ?? []).map((item) => item.id === id ? { ...item, status, decisionNote: decisionNote?.trim() || undefined, decidedBy, decidedAt, updatedAt: decidedAt } : item), managerDecisionHistory: [audit, ...(current.managerDecisionHistory ?? [])] };
      }),
      deleteOfficialHoliday: (id) => save((current) => ({ ...current, officialHolidays: (current.officialHolidays ?? []).filter((item) => item.id !== id) })),
      reviewEmptyDay: (review) => save((current) => {
        const previous = (current.emptyDayReviews ?? []).find((item) => item.representativeId === review.representativeId && item.date === review.date);
        const decidedAt = review.decidedAt || new Date().toISOString();
        const audit: ManagerDecisionAudit = { id: `manager-decision-${Date.now()}`, decisionType: "empty-day", targetId: review.id, representativeId: review.representativeId, date: review.date, decision: review.decision, reason: review.reason, decidedBy: review.decidedBy, decidedAt };
        return { ...current, emptyDayReviews: [{ ...review, decidedAt }, ...(current.emptyDayReviews ?? []).filter((item) => item.id !== review.id && !(item.representativeId === review.representativeId && item.date === review.date))], managerDecisionHistory: [audit, ...(current.managerDecisionHistory ?? [])], ...(previous ? {} : {}) };
      }),
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
      restoreData: (restored) => save(() => { const entities = mergeEmbeddedEntities(restored.entities, EMBEDDED_ENTITIES, true); return { ...restored, entities, plannedVisits: restored.plannedVisits.map((item) => ({ ...item, entityKind: normalizeEntityKind(item.entityKind) })), representativeLeaves: restored.representativeLeaves ?? [], officialHolidays: restored.officialHolidays ?? [], emptyDayReviews: restored.emptyDayReviews ?? [], managerDecisionHistory: restored.managerDecisionHistory ?? [], visits: restored.visits.map((item) => ({ ...item, entityKind: normalizeEntityKind(item.entityKind) })), savedLocations: normalizeSharedLocations(restored.savedLocations, entities) }; }),
      updateRepresentativeLocation: (id, value) => save((current) => ({ ...current, representativeLocations: { ...current.representativeLocations, [id]: value } })),
      addPlanApprovalAudit: (audit) => save((current) => ({ ...current, planApprovalHistory: [audit, ...(current.planApprovalHistory ?? [])] })),
      syncPendingVisits,
      resolveSyncConflict: (id, choice, note) => setData((current) => {
        const conflict = (current.syncConflicts ?? []).find((item) => item.id === id);
        if (!conflict) return current;
        let resolved = current;
        if (choice === "server") {
          resolved = applyRemoteRecords(current, [{ recordType: conflict.recordType, recordId: conflict.recordId, payload: JSON.stringify(conflict.serverPayload ?? null), version: conflict.serverVersion, deletedAt: null }], new Set());
        } else {
          const entry = createSyncChange({ recordType: conflict.recordType, recordId: conflict.recordId, operation: "upsert", baseVersion: conflict.serverVersion, payload: conflict.localPayload });
          resolved = { ...current, syncQueue: enqueueSyncChange(current.syncQueue ?? [], entry) };
        }
        const completedAt = new Date().toISOString();
        const next = appendSyncLog({ ...resolved, syncConflicts: (resolved.syncConflicts ?? []).map((item) => item.id === id ? { ...item, status: choice === "local" ? "kept-local" as const : "kept-server" as const, resolutionNote: note.trim() || undefined, resolvedAt: completedAt } : item) }, { id: `sync-resolution-${Date.now()}`, status: choice === "local" ? "success" : "success", startedAt: completedAt, completedAt, pushed: choice === "local" ? 1 : 0, pulled: choice === "server" ? 1 : 0, conflicts: 0, message: `تم حل التعارض باعتماد ${choice === "local" ? "النسخة المحلية" : "نسخة الخادم"}.`, resolutionChoice: choice, resolutionNote: note.trim() || undefined });
        void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      }),
      recordNotificationTest: async (status) => {
        const device = await getActivatedDevice();
        if (!device) return;
        setData((current) => {
          const tests = [{ deviceId: device.deviceId, deviceLabel: device.deviceId, testedAt: new Date().toISOString(), status }, ...(current.notificationTests ?? [])].slice(0, 20);
          const next = { ...current, notificationTests: tests };
          void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          return next;
        });
      },
      addPasswordResetRequest: (request) => save((current) => ({ ...current, passwordResetRequests: [request, ...(current.passwordResetRequests ?? [])].slice(0, 50) })),
      resolvePasswordResetRequest: (id, status, note) => save((current) => ({ ...current, passwordResetRequests: (current.passwordResetRequests ?? []).map((request) => request.id === id ? buildResolvedPasswordResetRequest(request, status, note ?? "") : request) })),
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
