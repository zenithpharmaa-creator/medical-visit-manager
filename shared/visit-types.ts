export type CurrentEntityKind = "عيادة" | "مستشفى حكومي" | "مستشفى خاص" | "مركز حكومي" | "مركز خاص" | "برج طبي";
/** قيم قديمة تُقبل عند قراءة البيانات السابقة فقط، ولا تظهر في القوائم الجديدة. */
export type LegacyEntityKind = "صيدلية" | "مستشفى" | "مركز طبي";
export type EntityKind = CurrentEntityKind | LegacyEntityKind;
export type VisitShift = "morning" | "evening";
export type RepresentativeLeavePeriod = "full-day" | VisitShift;
export type RepresentativeLeave = {
  id: string;
  representativeId: string;
  date: string;
  period: RepresentativeLeavePeriod;
  note?: string;
  createdAt: string;
  updatedAt?: string;
};

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
  assignedEntityIds?: string[];
  assignedKinds?: EntityKind[];
  assignedSharedLocationIds?: string[];
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
  coordinatesAddedAt?: string;
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

export type SyncRecordType = "entity" | "visit" | "plannedVisit" | "sharedLocation";
export type SyncOperation = "upsert" | "delete";
export type SyncQueueEntry = {
  changeId: string;
  recordType: SyncRecordType;
  recordId: string;
  operation: SyncOperation;
  baseVersion: number;
  payload?: unknown;
  createdAt: string;
};
export type SyncLogStatus = "success" | "error" | "conflict" | "offline" | "skipped";
export type NotificationTestRecord = {
  deviceId: string;
  deviceLabel: string;
  testedAt: string;
  status: "passed" | "failed";
};
export type PasswordResetRequest = {
  id: string;
  accountType: "manager" | "representative";
  representativeId?: string;
  accountLabel: string;
  requestedAt: string;
  status: "pending" | "approved" | "dismissed";
  resolvedAt?: string;
  resolutionNote?: string;
};
export type SyncLogEntry = {
  id: string;
  status: SyncLogStatus;
  startedAt: string;
  completedAt: string;
  pushed: number;
  pulled: number;
  conflicts: number;
  message: string;
  representativeId?: string;
  representativeName?: string;
  deviceId?: string;
  resolutionChoice?: "local" | "server";
  resolutionNote?: string;
};
export type SyncConflict = {
  id: string;
  changeId: string;
  recordType: SyncRecordType;
  recordId: string;
  localPayload?: unknown;
  serverPayload?: unknown;
  serverVersion: number;
  detectedAt: string;
  status: "pending" | "kept-local" | "kept-server";
  resolutionNote?: string;
  resolvedAt?: string;
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
  representativeLeaves?: RepresentativeLeave[];
  settings: AppSettings;
  savedLocations?: SharedLocation[];
  planApprovalHistory?: PlanApprovalAudit[];
  syncQueue?: SyncQueueEntry[];
  syncConflicts?: SyncConflict[];
  syncHistory?: SyncLogEntry[];
  notificationTests?: NotificationTestRecord[];
  passwordResetRequests?: PasswordResetRequest[];
  syncVersions?: Record<string, number>;
  lastSuccessfulSyncAt?: string;
};
