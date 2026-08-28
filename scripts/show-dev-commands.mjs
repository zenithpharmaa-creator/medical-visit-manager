console.log(`تشغيل خدمات التطوير بشكل مستقل:

النافذة الأولى:
  pnpm dev:server:standalone

النافذة الثانية:
  pnpm dev:metro:standalone

لتشغيل اختبارات Playwright بعد بدء Metro:
  pnpm e2e

يمكن تغيير عنوان المعاينة عبر:
  E2E_BASE_URL=http://127.0.0.1:8081 pnpm e2e
`);
