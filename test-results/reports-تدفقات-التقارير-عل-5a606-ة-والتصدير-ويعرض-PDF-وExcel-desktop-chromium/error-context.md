# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: reports.spec.ts >> تدفقات التقارير على الويب >> يفتح قائمة إجراءات الطباعة والتصدير ويعرض PDF وExcel
- Location: e2e/reports.spec.ts:51:7

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:8081/
Call log:
  - navigating to "http://127.0.0.1:8081/", waiting until "load"

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e6]:
    - heading "This site can’t be reached" [level=1] [ref=e7]
    - paragraph [ref=e8]:
      - strong [ref=e9]: 127.0.0.1
      - text: refused to connect.
    - generic [ref=e10]:
      - paragraph [ref=e11]: "Try:"
      - list [ref=e12]:
        - listitem [ref=e13]: Checking the connection
        - listitem [ref=e14]:
          - link "Checking the proxy and the firewall" [ref=e15] [cursor=pointer]:
            - /url: "#buttons"
    - generic [ref=e16]: ERR_CONNECTION_REFUSED
  - generic [ref=e17]:
    - button "Reload" [ref=e19] [cursor=pointer]
    - button "Details" [ref=e20] [cursor=pointer]
```

# Test source

```ts
  1  | import { expect, test, type Page } from "@playwright/test";
  2  | 
  3  | async function loginAsManager(page: Page) {
> 4  |   await page.goto("/");
     |              ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:8081/
  5  |   await page.evaluate(() => localStorage.removeItem("medical_visit_active_session"));
  6  |   await page.reload();
  7  |   await page.getByPlaceholder("أدخل كلمة المرور").fill("123");
  8  |   await page.getByRole("checkbox", { name: "تذكرني على هذا الجهاز" }).click();
  9  |   await page.getByRole("button", { name: "دخول إلى الحساب" }).click();
  10 |   await expect(page.getByText("مدير الزيارات الطبية")).toBeVisible({ timeout: 15_000 });
  11 | }
  12 | 
  13 | async function openReport(page: Page, route: string, title: string) {
  14 |   await loginAsManager(page);
  15 |   await page.goto(`/${route}`);
  16 |   await expect(page.getByText(title, { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  17 | }
  18 | 
  19 | test.describe("تدفقات التقارير على الويب", () => {
  20 |   test("يسجل المدير الدخول ثم يفتح مركز التقارير", async ({ page }) => {
  21 |     await loginAsManager(page);
  22 |     await page.goto("/reports");
  23 |     await expect(page.getByText("مركز التقارير")).toBeVisible({ timeout: 15_000 });
  24 |     await expect(page.getByRole("button", { name: "فتح تقرير طباعة" })).toBeVisible();
  25 |     await expect(page.getByRole("button", { name: "فتح تقرير تقويم" })).toBeVisible();
  26 |   });
  27 | 
  28 |   test("يفتح يومي شامل ويطبق بحث الطبيب وفلاتر المنطقة والتخصص", async ({ page }) => {
  29 |     await openReport(page, "report-search", "يومي شامل");
  30 |     await page.getByPlaceholder("بحث باسم الطبيب حسب الحروف").fill("طبيب");
  31 |     await expect(page.getByText(/طبيب|لا توجد نتائج مطابقة للفلاتر الحالية/).first()).toBeVisible();
  32 | 
  33 |     await page.getByRole("button", { name: "المنطقة" }).click();
  34 |     await expect(page.getByText("الشمالية").last()).toBeVisible();
  35 |     await page.getByText("الشمالية").last().click();
  36 | 
  37 |     await page.getByRole("button", { name: "التخصص" }).click();
  38 |     await expect(page.getByText(/كل التخصصات|التخصص/).last()).toBeVisible();
  39 |   });
  40 | 
  41 |   test("يفتح إجمالي المندوبين ويفرز الأعمدة ويبدل نمط العرض", async ({ page }) => {
  42 |     await openReport(page, "report-representatives", "للمندوبين متنوع");
  43 |     await expect(page.getByText("المندوب").last()).toBeVisible();
  44 |     await page.getByText("عدد الزيارات").last().click();
  45 |     await page.getByRole("button", { name: "نوع العرض" }).click();
  46 |     await expect(page.getByText("تحليلي").last()).toBeVisible();
  47 |     await page.getByText("تحليلي").last().click();
  48 |     await expect(page.getByText("النمط الحالي: تحليلي")).toBeVisible();
  49 |   });
  50 | 
  51 |   test("يفتح قائمة إجراءات الطباعة والتصدير ويعرض PDF وExcel", async ({ page }) => {
  52 |     await openReport(page, "report-print", "طباعة");
  53 |     await page.getByRole("button", { name: "إجراءات" }).click();
  54 |     await expect(page.getByText("إجراء التقرير")).toBeVisible();
  55 |     await expect(page.getByRole("button", { name: "تحميل PDF" })).toBeVisible();
  56 |     await expect(page.getByRole("button", { name: "تحميل Excel" })).toBeVisible();
  57 |     await expect(page.getByRole("button", { name: "إغلاق قائمة الإجراء" })).toBeVisible();
  58 |   });
  59 | 
  60 |   test("يفتح التقارير المتخصصة الأساسية", async ({ page }) => {
  61 |     await openReport(page, "report-daily-analysis", "تحليل يومي");
  62 |     await expect(page.getByText(/تحليل يومي/).first()).toBeVisible();
  63 |     await page.goto("/report-monthly");
  64 |     await expect(page.getByText("شهري حسب المندوب").first()).toBeVisible({ timeout: 15_000 });
  65 |     await page.goto("/report-total");
  66 |     await expect(page.getByText("إجمالي للمندوبين").first()).toBeVisible({ timeout: 15_000 });
  67 |     await page.goto("/report-calendar");
  68 |     await expect(page.getByText("تقويم الزيارات").first()).toBeVisible({ timeout: 15_000 });
  69 |   });
  70 | });
  71 | 
```