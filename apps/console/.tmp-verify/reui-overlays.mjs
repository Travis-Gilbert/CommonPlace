import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.goto('https://reui.io/preview/base/app-shell-8?embed=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(4000);
const dump = async (label) => {
  const text = await page.evaluate(() => {
    // newest visible portal-ish containers
    const all = [...document.querySelectorAll('[role="dialog"], [role="menu"], [data-slot="sheet-content"], [data-slot="dialog-content"], [data-slot="dropdown-menu-content"]')];
    return all.filter((el) => el.offsetParent !== null || el.getBoundingClientRect().width > 0).map((el) => el.innerText).join('\n===\n');
  });
  console.log(`--- ${label} ---\n${text.slice(0, 1200)}\n`);
};

// Command-K search
await page.keyboard.press('Control+KeyK');
await page.waitForTimeout(600);
await dump('CMD-K');
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

// Notifications bell
await page.getByRole("button", { name: "Notifications" }).click();
await page.waitForTimeout(600);
await dump('NOTIFICATIONS');
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

// Org switcher (Acme Inc)
await page.getByText('Acme Inc', { exact: true }).first().click();
await page.waitForTimeout(600);
await dump('ORG SWITCHER');
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

// Create dropdown
await page.getByRole('button', { name: 'Create' }).click();
await page.waitForTimeout(600);
await dump('CREATE');
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

// Rail tooltips: hover each rail button
const railBtns = await page.evaluate(() =>
  [...document.querySelectorAll('[data-slot="sidebar-menu-button"]')].map((b, i) => ({ i, label: b.getAttribute('aria-label') ?? b.querySelector('svg')?.getAttribute('lucide') })));
console.log('RAIL BUTTONS:', JSON.stringify(railBtns));
await browser.close();
