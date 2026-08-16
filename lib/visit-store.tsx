import AsyncStorage from "@react-native-async-storage/async-storage";
import { PropsWithChildren, createContext, useContext, useEffect, useMemo, useState } from "react";

import { AppData, AppSettings, MedicalEntity, Representative, Visit } from "@/shared/visit-types";

const STORAGE_KEY = "medical-visit-manager-data-v1";
const REPRESENTATIVE_NAMES: Record<string, string> = { "rep-1": "علي الشعيبي", "rep-2": "محمد الحداد", "rep-3": "محمود الرميمة" };
const REPRESENTATIVE_REGIONS: Record<string, "north" | "south" | "sanaa"> = { "rep-1": "south", "rep-2": "north", "rep-3": "sanaa" };
const LEGACY_REPRESENTATIVE_NAMES = new Set(["المندوب الأول", "المندوب الثاني", "المندوب الثالث"]);

const INITIAL_DATA: AppData = {
  representatives: [
    { id: "rep-1", name: REPRESENTATIVE_NAMES["rep-1"], region: REPRESENTATIVE_REGIONS["rep-1"], active: true },
    { id: "rep-2", name: REPRESENTATIVE_NAMES["rep-2"], region: REPRESENTATIVE_REGIONS["rep-2"], active: true },
    { id: "rep-3", name: REPRESENTATIVE_NAMES["rep-3"], region: REPRESENTATIVE_REGIONS["rep-3"], active: true },
  ],
  representativeLocations: {},
  entities: [],
  plannedVisits: [],
  visits: [],
  settings: { managerName: "مدير النظام", reportEmail: "", reminderTime: "18:00", geofenceRadiusMeters: 200, managerPin: "" },
};

type VisitStoreValue = {
  data: AppData;
  loading: boolean;
  addVisit: (visit: Visit) => void;
  addPlannedVisit: (visit: AppData["plannedVisits"][number]) => void;
  updatePlannedVisit: (visit: AppData["plannedVisits"][number]) => void;
  addEntity: (entity: MedicalEntity) => void;
  updateEntity: (entity: MedicalEntity) => void;
  deleteVisit: (id: string) => void;
  updateRepresentative: (representative: Representative) => void;
  addRepresentative: (representative: Representative) => void;
  deleteRepresentative: (id: string) => void;
  updateSettings: (settings: AppSettings) => void;
  replaceEntities: (entities: MedicalEntity[]) => void;
  updateRepresentativeLocation: (id: string, value: AppData["representativeLocations"][string]) => void;
};

const VisitStore = createContext<VisitStoreValue | null>(null);

export function VisitProvider({ children }: PropsWithChildren) {
  const [data, setData] = useState<AppData>(INITIAL_DATA);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved) {
          const parsed = JSON.parse(saved) as Partial<AppData>;
          setData({
            ...INITIAL_DATA,
            ...parsed,
            representatives: parsed.representatives?.length ? parsed.representatives.map((item) => ({ ...item, ...(REPRESENTATIVE_NAMES[item.id] && LEGACY_REPRESENTATIVE_NAMES.has(item.name) ? { name: REPRESENTATIVE_NAMES[item.id] } : {}), ...(REPRESENTATIVE_REGIONS[item.id] ? { region: REPRESENTATIVE_REGIONS[item.id] } : {}) })) : INITIAL_DATA.representatives,
            representativeLocations: parsed.representativeLocations ?? {},
            entities: parsed.entities ?? [],
            plannedVisits: parsed.plannedVisits ?? [],
            visits: parsed.visits ?? [],
            settings: { ...INITIAL_DATA.settings, ...(parsed.settings ?? {}), geofenceRadiusMeters: Number(parsed.settings?.geofenceRadiusMeters) || INITIAL_DATA.settings.geofenceRadiusMeters, managerPin: String(parsed.settings?.managerPin ?? INITIAL_DATA.settings.managerPin) },
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

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
      addPlannedVisit: (visit) => save((current) => ({ ...current, plannedVisits: [visit, ...current.plannedVisits] })),
      updatePlannedVisit: (visit) => save((current) => ({ ...current, plannedVisits: current.plannedVisits.map((item) => item.id === visit.id ? visit : item) })),
      addEntity: (entity) => save((current) => ({ ...current, entities: [entity, ...current.entities] })),
      updateEntity: (entity) => save((current) => ({ ...current, entities: current.entities.map((item) => item.id === entity.id ? entity : item) })),
      deleteVisit: (id) => save((current) => ({ ...current, visits: current.visits.filter((visit) => visit.id !== id) })),
      updateRepresentative: (representative) =>
        save((current) => ({
          ...current,
          representatives: current.representatives.map((item) => (item.id === representative.id ? representative : item)),
        })),
      addRepresentative: (representative) => save((current) => ({ ...current, representatives: [...current.representatives, representative] })),
      deleteRepresentative: (id) => save((current) => ({ ...current, representatives: current.representatives.filter((item) => item.id !== id), plannedVisits: current.plannedVisits.filter((item) => item.representativeId !== id), representativeLocations: Object.fromEntries(Object.entries(current.representativeLocations).filter(([key]) => key !== id)) })),
      updateSettings: (settings) => save((current) => ({ ...current, settings })),
      replaceEntities: (entities) => save((current) => ({ ...current, entities })),
      updateRepresentativeLocation: (id, value) => save((current) => ({ ...current, representativeLocations: { ...current.representativeLocations, [id]: value } })),
    }),
    [data, loading],
  );

  return <VisitStore.Provider value={value}>{children}</VisitStore.Provider>;
}

export function useVisitStore() {
  const value = useContext(VisitStore);
  if (!value) throw new Error("useVisitStore must be used inside VisitProvider");
  return value;
}
