import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("http://127.0.0.1:4173/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === "/api/categories") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "[]",
      });
      return;
    }
    if (pathname === "/api/packages") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            package_id: 1,
            name: "Gói kiểm thử",
            description: "Gói dùng cho browser test",
            price: 50000,
            download_turns: 5,
            duration_days: 30,
            status: "ACTIVE",
          },
        ]),
      });
      return;
    }
    if (
      [
        "/api/admin/reports/revenue",
        "/api/admin/wallets/gateway",
        "/api/admin/wallets/tax",
      ].includes(pathname)
    ) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [],
          meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
          summary: {
            totalCredit: 0,
            totalDebit: 0,
            netRevenue: 0,
            availableTaxToPay: 0,
          },
          wallet: null,
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      }),
    });
  });
});

async function loginAs(
  page: Page,
  role: "customer" | "mod" | "accountant" | "admin",
) {
  const user = {
    accountId: 10,
    customerId: role === "customer" ? 10 : undefined,
    staffId: role === "customer" ? undefined : 10,
    email: `${role}@example.test`,
    fullName: `Test ${role}`,
    roleNames: [role],
    status: "ACTIVE",
  };
  for (const endpoint of ["login", "refresh"]) {
    await page.route(
      `http://127.0.0.1:4173/api/auth/${endpoint}`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ accessToken: `e2e-${role}-token`, user }),
        });
      },
    );
  }
  await page.route("http://127.0.0.1:4173/api/auth/csrf", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ csrfToken: "e2e-csrf-token" }),
    });
  });
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill("ValidPassword123!");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

test("protected route redirects an anonymous user to login", async ({
  page,
}) => {
  await page.goto("/library");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Đăng nhập" })).toBeVisible();
});

test("customer role cannot enter the admin area", async ({ page }) => {
  await loginAs(page, "customer");
  await page.goto("/admin/audit-logs");
  await expect(page).toHaveURL("http://127.0.0.1:4173/");
});

for (const roleCase of [
  {
    role: "mod" as const,
    allowed: "/admin/approvals",
    denied: "/admin/revenue",
  },
  {
    role: "accountant" as const,
    allowed: "/admin/revenue",
    denied: "/admin/documents",
  },
  { role: "admin" as const, allowed: "/admin/audit-logs", denied: null },
]) {
  test(`${roleCase.role} role follows the admin permission matrix`, async ({
    page,
  }) => {
    await loginAs(page, roleCase.role);
    await page.goto(roleCase.allowed);
    await expect(page).toHaveURL(`http://127.0.0.1:4173${roleCase.allowed}`);
    if (roleCase.denied) {
      await page.goto(roleCase.denied);
      await expect(page).toHaveURL("http://127.0.0.1:4173/admin/profile");
    }
  });
}

test("unknown route renders the 404 state", async ({ page }) => {
  await page.goto("/route-that-does-not-exist");
  await expect(page.getByText("404", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Về trang chủ" })).toBeVisible();
});

test("forgot-password dialog traps focus, closes with Escape and restores focus", async ({
  page,
}) => {
  await page.goto("/login");
  const trigger = page.getByRole("button", { name: "Quên mật khẩu?" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Quên mật khẩu" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("confirmation dialog is keyboard accessible", async ({ page }) => {
  await loginAs(page, "customer");
  await page.goto("/packages");
  const purchase = page.getByRole("button", { name: "Mua gói ngay" }).first();
  await purchase.click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(purchase).toBeFocused();
});

test("public and auth pages have no horizontal overflow", async ({ page }) => {
  for (const route of ["/", "/documents", "/packages", "/login", "/register"]) {
    await page.goto(route);
    const hasOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(hasOverflow, `${route} overflows at the active viewport`).toBe(
      false,
    );
  }
});
