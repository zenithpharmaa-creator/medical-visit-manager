import type { AppData, Visit } from "@/shared/visit-types";
import { distanceBetweenMeters, isWithinGeofence } from "./visit-utils";

export function synchronizePendingVisits(data: AppData, checkedAt: string) {
  let processed = 0;
  const visits = data.visits.map((visit): Visit => {
    if (visit.verificationStatus !== "pending") return visit;
    processed += 1;
    const entity = data.entities.find((item) => item.id === visit.entityId);
    const expected = entity?.geographicCoordinates ?? visit.geographicCoordinates;
    if (!visit.location || !expected) {
      const result = "تعذر التحقق: لا توجد إحداثيات كافية للجهة أو الزيارة.";
      return { ...visit, verificationStatus: "rejected", verificationCheckedAt: checkedAt, verificationReason: result, verificationLog: [...(visit.verificationLog ?? []), { checkedAt, status: "rejected", result }] };
    }
    const distanceMeters = distanceBetweenMeters(visit.location, expected);
    const accepted = isWithinGeofence(distanceMeters, data.settings.geofenceRadiusMeters);
    const result = accepted ? "تمت المطابقة تلقائياً عند المزامنة." : `مرفوضة: موقع الزيارة يبعد ${Math.round(distanceMeters)} متراً عن موقع الجهة، والحد المسموح ${data.settings.geofenceRadiusMeters} متر.`;
    const status = accepted ? "verified" : "rejected";
    return { ...visit, geographicCoordinates: expected, verificationStatus: status, verificationCheckedAt: checkedAt, verificationDistanceMeters: Math.round(distanceMeters), verificationReason: result, verificationLog: [...(visit.verificationLog ?? []), { checkedAt, status, distanceMeters: Math.round(distanceMeters), result }] };
  });
  return { data: processed ? { ...data, visits } : data, processed };
}
