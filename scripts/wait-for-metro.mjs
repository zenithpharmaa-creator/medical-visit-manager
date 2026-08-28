const baseUrl = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${process.env.EXPO_PORT ?? "8081"}`;
const timeoutMs = Number(process.env.METRO_READY_TIMEOUT_MS ?? 120_000);
const intervalMs = Number(process.env.METRO_READY_INTERVAL_MS ?? 1_000);
const deadline = Date.now() + timeoutMs;
let lastError = "لم تصل استجابة بعد";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

while (Date.now() < deadline) {
  try {
    const response = await fetch(baseUrl, { signal: AbortSignal.timeout(10_000) });
    const body = await response.text();
    const isUsable = response.ok && body.length > 100;
    if (isUsable) {
      console.log(`[metro-ready] ${baseUrl} استجاب HTTP ${response.status} وحجم الصفحة ${body.length} بايت`);
      process.exit(0);
    }
    lastError = `HTTP ${response.status}, body=${body.length} bytes`;
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
  }
  await sleep(intervalMs);
}

console.error(`[metro-ready] انتهت مهلة الانتظار (${timeoutMs}ms) لـ ${baseUrl}: ${lastError}`);
process.exit(1);
