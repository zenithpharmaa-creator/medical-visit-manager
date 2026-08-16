export type SanaaNeighborhood = {
  id: string;
  district: string;
  name: string;
  latitude: number;
  longitude: number;
  approximate: true;
};

// الإحداثيات تقريبية للاختيار المحلي، وليست بديلاً عن GPS أو المسح الميداني.
export const SANAA_NEIGHBORHOODS: SanaaNeighborhood[] = [
  { id: "old-sanaa", district: "صنعاء القديمة", name: "مدينة صنعاء القديمة", latitude: 15.355, longitude: 44.207, approximate: true },
  { id: "bab-yemen", district: "صنعاء القديمة", name: "باب اليمن", latitude: 15.353, longitude: 44.207, approximate: true },
  { id: "bir-al-azab", district: "صنعاء القديمة", name: "بير العزب", latitude: 15.365, longitude: 44.197, approximate: true },
  { id: "al-qaa", district: "صنعاء القديمة", name: "القاع", latitude: 15.369, longitude: 44.202, approximate: true },
  { id: "tahrir-square", district: "التحرير", name: "ميدان التحرير", latitude: 15.369, longitude: 44.194, approximate: true },
  { id: "zubairi", district: "التحرير", name: "شارع الزبيري", latitude: 15.365, longitude: 44.201, approximate: true },
  { id: "shouub", district: "شعوب", name: "شعوب", latitude: 15.385, longitude: 44.221, approximate: true },
  { id: "hasaba", district: "شعوب", name: "الحصبة", latitude: 15.393, longitude: 44.213, approximate: true },
  { id: "thawra", district: "الثورة", name: "حي الثورة", latitude: 15.405, longitude: 44.225, approximate: true },
  { id: "al-jiraf", district: "الثورة", name: "الجراف", latitude: 15.417, longitude: 44.236, approximate: true },
  { id: "azal", district: "أزال", name: "أزال", latitude: 15.353, longitude: 44.225, approximate: true },
  { id: "safiya", district: "الصافية", name: "الصافية", latitude: 15.337, longitude: 44.221, approximate: true },
  { id: "shamilah", district: "الصافية", name: "شميلة", latitude: 15.322, longitude: 44.226, approximate: true },
  { id: "sabeen", district: "السبعين", name: "السبعين", latitude: 15.333, longitude: 44.204, approximate: true },
  { id: "hadda", district: "السبعين", name: "حدة", latitude: 15.338, longitude: 44.198, approximate: true },
  { id: "bayt-bous", district: "السبعين", name: "بيت بوس", latitude: 15.310, longitude: 44.180, approximate: true },
  { id: "unity", district: "الوحدة", name: "الوحدة", latitude: 15.356, longitude: 44.183, approximate: true },
  { id: "sixtieth", district: "الوحدة", name: "شارع الستين", latitude: 15.385, longitude: 44.170, approximate: true },
  { id: "maeen", district: "معين", name: "معين", latitude: 15.393, longitude: 44.174, approximate: true },
  { id: "sineina", district: "معين", name: "السنينة", latitude: 15.414, longitude: 44.157, approximate: true },
  { id: "asir", district: "معين", name: "عصر", latitude: 15.309, longitude: 44.142, approximate: true },
  { id: "bani-harith", district: "بني الحارث", name: "بني الحارث", latitude: 15.446, longitude: 44.236, approximate: true },
  { id: "daras", district: "بني الحارث", name: "دارس", latitude: 15.440, longitude: 44.240, approximate: true },
  { id: "rawdah", district: "بني الحارث", name: "الروضة", latitude: 15.430, longitude: 44.220, approximate: true },
  { id: "nahdah", district: "شعوب", name: "النهضة", latitude: 15.400, longitude: 44.190, approximate: true },
  { id: "qadisiyah", district: "الوحدة", name: "القادسية", latitude: 15.350, longitude: 44.160, approximate: true },
  { id: "wady-ahmad", district: "بني الحارث", name: "وادي أحمد", latitude: 15.400, longitude: 44.240, approximate: true },
];

export const SANAA_NEIGHBORHOOD_SOURCE_NOTE = "إحداثيات تقريبية للاستدلال والاختيار offline؛ يجب تأكيد الموقع عبر GPS عند الزيارة.";
