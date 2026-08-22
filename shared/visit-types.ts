export type CurrentEntityKind = "عيادة" | "مستشفى حكومي" | "مستشفى خاص" | "مركز حكومي" | "مركز خاص" | "برج طبي";
/** قيم قديمة تُقبل عند قراءة البيانات السابقة فقط، ولا تظهر في القوائم الجديدة. */
export type LegacyEntityKind = "صيدلية" | "مستشفى" | "مركز طبي";
export type EntityKind = CurrentEntityKind | LegacyEntityKind;
export type VisitShift = "morning" | "evening";

export type RepresentativeRegion = "north" | "south" | "sanaa";

export type Representative = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  username?: string;
  photoUri?: string;
  region?: RepresentativeRegion;
  assignedItems?: string[];
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
  sharedLocationId?: string;
  region?: RepresentativeRegion;
  nearestPharmacy?: string;
  notes?: string;
  createdAt: string;
};

export type VisitLocation = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
};

export type SharedLocation = {
  id: string;
  name: string;
  address?: string;
  coordinates: VisitLocation;
  usageCount: number;
  createdAt: string;
  updatedAt?: string;
};

export type PlannedVisitStatus = "planned" | "executed" | "cancelled";
export type PlanApprovalStatus = "pending" | "approved" | "rejected";
export type PlanApprovalAudit = { id: string; planId: string; action: "approved" | "rejected"; actedAt: string; actedBy: string; representativeId: string; representativeName: string; entityName: string; scheduledDate: string; reason?: string };

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
  approvalStatus?: PlanApprovalStatus;
  planStatus?: PlannedVisitStatus;
  cancellationReason?: string;
  assignedAt?: string;
  responseReason?: string;
  notes?: string;
};

export type VisitVerificationStatus = "pending" | "verified" | "rejected" | "override";
export type VisitVerificationLog = { checkedAt: string; status: VisitVerificationStatus; distanceMeters?: number; result: string };
export type VisitAuditEntry = { id: string; action: "updated"; actedAt: string; actedBy: string; actedByRole: "manager" | "representative"; changedFields: string[] };

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
  entityRegion?: RepresentativeRegion;
  entityAddress?: string;
  nearestPharmacy?: string;
  recordedAt: string;
  location: VisitLocation | null;
  notes: string;
  photoUri?: string;
  visitedItems?: string[];
  verificationStatus?: VisitVerificationStatus;
  verificationCheckedAt?: string;
  verificationDistanceMeters?: number;
  verificationReason?: string;
  verificationLog?: VisitVerificationLog[];
  auditLog?: VisitAuditEntry[];
  offlineRecorded?: boolean;
  managerOverride?: boolean;
  overrideReason?: string;
};

export type AppSettings = {
  managerName: string;
  reportEmail: string;
  reminderTime: string;
  geofenceRadiusMeters: number;
  managerPin: string;
  visitedItems: string[];
};

export type RepresentativeLocation = { location: VisitLocation; updatedAt: string };

export type AppData = {
  representatives: Representative[];
  representativeLocations: Record<string, RepresentativeLocation>;
  entities: MedicalEntity[];
  visits: Visit[];
  plannedVisits: PlannedVisit[];
  settings: AppSettings;
  savedLocations?: SharedLocation[];
  planApprovalHistory?: PlanApprovalAudit[];
  lastSuccessfulSyncAt?: string;
};
