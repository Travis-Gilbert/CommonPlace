// SOURCING: @playwright/test. Interaction oracle for PET sentinel chips
// (SPEC-COMMONPLACE-COMMANDS-AND-SENTINELS-1.0 D4 / AC6). Fixture query is
// the named stand-in for live stream ingest; cooldown/digest unit_model lives
// in theorem-pet + rustyred-thg-programmable-graph.

import { expect, test } from "@playwright/test";

test.describe("pet sentinel chip", () => {
  test("fixture chip shows title, diff, receipt, and dismisses", async ({
    page,
  }) => {
    await page.goto("/pet.html?sentinelChip=1");
    const chip = page.locator("[data-sentinel-chip]");
    await expect(chip).toBeVisible({ timeout: 30_000 });
    await expect(chip).toContainText("Price watch");
    await expect(chip).toContainText("price 10.00 → 11.00");
    await expect(page.locator("[data-sentinel-receipt]")).toHaveAttribute(
      "href",
      /theorem:\/\/receipt\//,
    );
    await page.screenshot({
      path: "e2e/evidence/sentinel-chip/chip.png",
      fullPage: true,
    });
    await page.locator("[data-sentinel-dismiss]").click();
    await expect(chip).toHaveCount(0);
    await page.screenshot({
      path: "e2e/evidence/sentinel-chip/dismissed.png",
      fullPage: true,
    });
  });
});
