export type DailyVisitReportRow = {
  representativeName: string;
  entityName: string;
  category?: string;
  specialty?: string;
  entityAddress?: string;
  nearestPharmacy?: string;
  shift: string;
  visitedItems: string;
  notes?: string;
};

function escapeHtml(value: string | undefined) {
  return String(value ?? "—")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDateArabic(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ar-YE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function createReportSerial() {
  const stamp = new Date();
  const datePart = `${stamp.getFullYear()}${String(stamp.getMonth() + 1).padStart(2, "0")}${String(stamp.getDate()).padStart(2, "0")}`;
  return `MV-${datePart}-${String(Date.now()).slice(-6)}`;
}

const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="42" height="42" viewBox="0 0 42 42" aria-label="شعار مدير الزيارات الطبية"><rect width="42" height="42" rx="10" fill="#1257A6"/><path d="M21 8c-6.3 0-11.4 5.1-11.4 11.4 0 8.2 11.4 14.7 11.4 14.7s11.4-6.5 11.4-14.7C32.4 13.1 27.3 8 21 8Z" fill="#fff"/><circle cx="21" cy="19.4" r="3.8" fill="#1257A6"/><path d="M18 25h6M21 22v6" stroke="#1257A6" stroke-width="1.8" stroke-linecap="round"/></svg>`;

export function buildDailyVisitPdfHtml(rows: DailyVisitReportRow[], reportDate: string, appName = "مدير الزيارات الطبية", reportSerial = createReportSerial()) {
  const representativeNames = [...new Set(rows.map((row) => row.representativeName).filter(Boolean))].join("، ") || "جميع المندوبين";
  const tableRows = rows.map((row) => `
    <tr>
      <td>${escapeHtml(row.entityName)}</td>
      <td>${escapeHtml(row.category)}</td>
      <td>${escapeHtml(row.specialty)}</td>
      <td>${escapeHtml(row.entityAddress)}</td>
      <td>${escapeHtml(row.nearestPharmacy)}</td>
      <td>${escapeHtml(row.shift)}</td>
      <td>${escapeHtml(row.visitedItems)}</td>
      <td>${escapeHtml(row.notes)}</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    @page { size: A4 landscape; margin: 12mm 10mm 14mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #182230; background: #fff; font-family: Arial, "Tahoma", sans-serif; direction: rtl; font-size: 10px; }
    .report { width: 100%; }
    .header { display: flex; flex-direction: row-reverse; justify-content: space-between; align-items: center; border-bottom: 2px solid #25364a; padding: 0 0 8px; margin-bottom: 10px; gap: 14px; }
    .brand { display: flex; flex-direction: row; align-items: center; gap: 7px; min-width: 190px; font-size: 14px; font-weight: 800; color: #183b63; }
    .brand img { width: 42px; height: 42px; }
    .title { text-align: center; flex: 1; font-size: 16px; font-weight: 800; color: #172b4d; }
    .meta { min-width: 220px; font-size: 10px; line-height: 1.9; color: #465466; }
    .meta strong { color: #172b4d; }
    .summary { display: flex; flex-direction: row-reverse; gap: 8px; margin-bottom: 9px; }
    .summary span { border: 1px solid #aeb8c4; border-radius: 3px; padding: 4px 8px; background: #f4f6f8; color: #334155; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; direction: rtl; }
    th { background: #e5e8eb; color: #172b4d; border: 1px solid #6b7280; font-weight: 800; padding: 6px 4px; text-align: center; vertical-align: middle; }
    td { border: 1px solid #8b949e; padding: 5px 4px; min-height: 24px; vertical-align: middle; text-align: right; word-break: break-word; }
    tbody tr:nth-child(even) { background: #fafafa; }
    .col-doctor { width: 14%; } .col-category { width: 8%; } .col-specialty { width: 9%; } .col-address { width: 18%; }
    .col-pharmacy { width: 14%; } .col-shift { width: 7%; } .col-items { width: 18%; } .col-notes { width: 12%; }
    .empty { text-align: center; padding: 24px; border: 1px solid #8b949e; color: #657184; }
    .footer { margin-top: 8px; display: flex; justify-content: space-between; color: #657184; font-size: 9px; }
  </style>
</head>
<body>
  <main class="report">
    <header class="header">
      <div class="brand"><img src="data:image/svg+xml;utf8,${encodeURIComponent(logoSvg)}" alt="شعار" /><span>${escapeHtml(appName)}</span></div>
      <div class="title">تقرير الزيارات اليومية</div>
      <div class="meta"><div><strong>المندوب:</strong> ${escapeHtml(representativeNames)}</div><div><strong>التاريخ:</strong> ${escapeHtml(formatDateArabic(reportDate))}</div><div><strong>الرقم التسلسلي:</strong> ${escapeHtml(reportSerial)}</div></div>
    </header>
    <div class="summary"><span>عدد السجلات: ${rows.length}</span><span>اتجاه الطباعة: عرضي</span></div>
    ${rows.length ? `<table><thead><tr><th class="col-doctor">الطبيب</th><th class="col-category">التصنيف</th><th class="col-specialty">التخصص</th><th class="col-address">عنوان الطبيب</th><th class="col-pharmacy">أقرب صيدلية</th><th class="col-shift">الفترة</th><th class="col-items">الأصناف المزارة</th><th class="col-notes">ملاحظات الزيارة</th></tr></thead><tbody>${tableRows}</tbody></table>` : `<div class="empty">لا توجد زيارات في التاريخ أو الفلاتر المحددة.</div>`}
    <footer class="footer"><span>تم الإنشاء من ${escapeHtml(appName)}</span><span>رقم التقرير: ${escapeHtml(reportSerial)}</span></footer>
  </main>
</body>
</html>`;
}
