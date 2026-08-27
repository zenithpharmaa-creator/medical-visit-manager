from pathlib import Path

path = Path('/home/ubuntu/medical-visit-manager/components/report-variant-screen.tsx')
text = path.read_text()
old = '<View className="rounded-2xl border-2 border-[#B7CDE5] bg-[#F8FBFF] p-2"><SelectField title="سنة التقرير" value={String(reportYear)} options={Array.from({ length: 7 }, (_, index) => { const year = new Date().getFullYear() - 3 + index; return { value: String(year), label: String(year) }; })} onChange={(value) => triggerFilter(setReportYear, Number(value))} /></View>'
new = '<View className="rounded-2xl border-2 border-[#B7CDE5] bg-[#F8FBFF] p-2"><View className="flex-row-reverse gap-2"><View className="flex-1"><SelectField title="السنة الأساسية" value={String(reportYear)} options={Array.from({ length: 7 }, (_, index) => { const year = new Date().getFullYear() - 3 + index; return { value: String(year), label: String(year) }; })} onChange={(value) => triggerFilter(setReportYear, Number(value))} /></View><View className="flex-1"><SelectField title="عام المقارنة" value={String(comparisonYear)} options={Array.from({ length: 7 }, (_, index) => { const year = new Date().getFullYear() - 3 + index; return { value: String(year), label: String(year) }; })} onChange={(value) => triggerFilter(setComparisonYear, Number(value))} /></View></View></View>'
if old not in text:
    raise SystemExit('year filter block not found')
path.write_text(text.replace(old, new, 1))
