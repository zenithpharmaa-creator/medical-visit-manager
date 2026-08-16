export type EntityKind = "عيادة" | "صيدلية" | "مستشفى" | "مركز طبي";
export type VisitShift = "morning" | "evening";

export type Representative = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  username?: string;
  photoUri?: string;
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

export type PlannedVisit = {
  id: string;
  representativeId: string;
  entityId: string;
  entityName: string;
  entityKind: EntityKind;
  scheduledDate: string;
  scheduledTime?: string;
  shift: VisitShift;
  assignmentType?: "planned" | "assigned";
  taskStatus?: "assigned" | "accepted" | "rejected" | "completed";
  assignedAt?: string;
  responseReason?: string;
  notes?: string;
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
  managerOverride?: boolean;
  overrideReason?: string;
};

export type AppSettings = {
  managerName: string;
  reportEmail: string;
  reminderTime: string;
  geofenceRadiusMeters: number;
  managerPin: string;
};

export type RepresentativeLocation = { location: VisitLocation; updatedAt: string };

export type AppData = {
  representatives: Representative[];
  representativeLocations: Record<string, RepresentativeLocation>;
  entities: MedicalEntity[];
  visits: Visit[];
  plannedVisits: PlannedVisit[];
  settings: AppSettings;
};
