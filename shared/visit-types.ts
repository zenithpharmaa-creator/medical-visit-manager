export type EntityKind = "عيادة" | "صيدلية" | "مستشفى" | "مركز طبي";

export type Representative = {
  id: string;
  name: string;
  active: boolean;
};

export type MedicalEntity = {
  id: string;
  name: string;
  kind: EntityKind;
  contactName?: string;
  phone?: string;
  address?: string;
  specialty?: string;
  category?: string;
  geographicLocation?: string;
  geographicCoordinates?: VisitLocation;
  nearestPharmacy?: string;
  notes?: string;
  createdAt: string;
};

export type VisitLocation = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
};

export type Visit = {
  id: string;
  representativeId: string;
  entityId: string;
  entityName: string;
  entityKind: EntityKind;
  specialty?: string;
  category?: string;
  geographicLocation?: string;
  geographicCoordinates?: VisitLocation;
  nearestPharmacy?: string;
  recordedAt: string;
  location: VisitLocation | null;
  notes: string;
};

export type AppSettings = {
  managerName: string;
  reportEmail: string;
  reminderTime: string;
  geofenceRadiusMeters: number;
};

export type AppData = {
  representatives: Representative[];
  entities: MedicalEntity[];
  visits: Visit[];
  settings: AppSettings;
};
