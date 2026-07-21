import { expect, test } from "@playwright/test";

test.describe("SafeReturn public smoke", () => {
  test("landing page renders core CTAs", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /bỏ qua điều hướng/i })).toBeAttached();
    await expect(page.locator("body")).toContainText(/SafeReturn|thất lạc|Solana/i);
    // Primary navigation toward the app surface
    const browse = page.getByRole("link", { name: /duyệt|browse|đồ thất lạc|bounties/i }).first();
    if (await browse.count()) {
      await expect(browse).toBeVisible();
    }
  });

  test("login page is reachable", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("body")).toContainText(/đăng nhập|login|email|google|ví/i);
  });

  test("robots and sitemap are public", async ({ request }) => {
    const robots = await request.get("/robots.txt");
    expect(robots.ok()).toBeTruthy();
    const robotsBody = await robots.text();
    expect(robotsBody).toMatch(/Allow|Disallow|Sitemap/i);

    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.ok()).toBeTruthy();
    const xml = await sitemap.text();
    expect(xml).toContain("<urlset");
  });

  test("manifest is valid web app metadata", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest");
    expect(res.ok()).toBeTruthy();
    const json = (await res.json()) as { name?: string; start_url?: string };
    expect(json.name || json.start_url).toBeTruthy();
  });
});
