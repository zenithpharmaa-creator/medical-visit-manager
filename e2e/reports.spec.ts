import { expect, test, type Page } from "@playwright/test";

async function loginAsManager(page: Page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("medical_visit_active_session"));
  await page.reload();
  await page.getByPlaceholder("أدخل كلمة المرور").fill("123");
  await page.getByRole("checkbox", { name: "تذكرني على هذا الجهاز" }).click();
  await page.getByRole("button", { name: "دخول إلى الحساب" }).click();
  await expect(page.getByText("مدير الزيارات الطبية")).toBeVisible({ timeout: 15_000 });
}

async function openReport(page: Page, route: string, title: string) {
  await loginAsManager(page);
  await page.goto(`/${route}`);
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible({ timeout: 15_000 });
}

test.describe("تدفقات التقارير على الويب", () => {
  test("يسجل المدير الدخول ثم يفتح مركز التقارير", async ({ page }) => {
    await loginAsManager(page);
    await page.goto("/reports");
    await expect(page.getByText("مركز التقارير")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "فتح تقرير طباعة" })).toBeVisible();
    await expect(page.getByRole("button", { name: "فتح تقرير تقويم" })).toBeVisible();
  });

  test("يفتح يومي شامل ويطبق بحث الطبيب وفلاتر المنطقة والتخصص", async ({ page }) => {
    await openReport(page, "report-search", "يومي شامل");
    await page.getByPlaceholder("بحث باسم الطبيب حسب الحروف").fill("طبيب");
    await expect(page.getByText(/طبيب|لا توجد نتائج مطابقة للفلاتر الحالية/).first()).toBeVisible();

    await page.getByRole("button", { name: "المنطقة" }).click();
    await expect(page.getByText("الشمالية").last()).toBeVisible();
    await page.getByText("الشمالية").last().click();

    await page.getByRole("button", { name: "التخصص" }).click();
    await expect(page.getByText(/كل التخصصات|التخصص/).last()).toBeVisible();
  });

  test("يفتح إجمالي المندوبين ويفرز الأعمدة ويبدل نمط العرض", async ({ page }) => {
    await openReport(page, "report-representatives", "للمندوبين متنوع");
    await expect(page.getByText("المندوب").last()).toBeVisible();
    await page.getByText("عدد الزيارات").last().click();
    await page.getByRole("button", { name: "نوع العرض" }).click();
    await expect(page.getByText("تحليلي").last()).toBeVisible();
    await page.getByText("تحليلي").last().click();
    await expect(page.getByText("النمط الحالي: تحليلي")).toBeVisible();
  });

  test("يفتح قائمة إجراءات الطباعة والتصدير ويعرض PDF وExcel", async ({ page }) => {
    await openReport(page, "report-print", "طباعة");
    await page.getByRole("button", { name: "إجراءات" }).click();
    await expect(page.getByText("إجراء التقرير")).toBeVisible();
    await expect(page.getByRole("button", { name: "تحميل PDF" })).toBeVisible();
    await expect(page.getByRole("button", { name: "تحميل Excel" })).toBeVisible();
    await expect(page.getByRole("button", { name: "إغلاق قائمة الإجراء" })).toBeVisible();
  });

  test("يفتح التقارير المتخصصة الأساسية", async ({ page }) => {
    await openReport(page, "report-daily-analysis", "تحليل يومي");
    await expect(page.getByText(/تحليل يومي/).first()).toBeVisible();
    await page.goto("/report-monthly");
    await expect(page.getByText("شهري حسب المندوب").first()).toBeVisible({ timeout: 15_000 });
    await page.goto("/report-total");
    await expect(page.getByText("إجمالي للمندوبين").first()).toBeVisible({ timeout: 15_000 });
    await page.goto("/report-calendar");
    await expect(page.getByText("تقويم الزيارات").first()).toBeVisible({ timeout: 15_000 });
  });
});
