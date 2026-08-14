import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.goto('https://reui.io/preview/base/app-shell-8?embed=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(4000);
const dump = async (label) => {
  await page.waitForTimeout(900);
  const text = await page.evaluate(() => {
    const all = [...document.querySelectorAll('[role="dialog"], [role="menu"], [role="listbox"], [data-slot="sheet-content"]')];
    return all.filter((el) => el.offsetParent !== null || el.getBoundingClientRect().height > 50)
      .map((el) => el.innerText).join('\n===SEP===\n');
  });
  console.log(`--- ${label} ---\n${text.slice(0, 1500)}\n`);
};

await page.keyboard.press('Control+KeyK');
await dump('CMD-K');
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
await page.getByText('Inventory', { exact: true }).first().click();
await dump('INVENTORY SWITCHER');
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
// rail hover tooltip
await page.hover('[data-slot="sidebar-menu-button"] >> nth=0');
await page.waitForTimeout(700);
const tooltip = await page.evaluate(() =>
  [...document.querySelectorAll('[data-slot="tooltip"], [role="tooltip"]')]
    .filter((el) => el.offsetParent !== null)
    .map((el) => el.innerText));
console.log('RAIL TOOLTIP:', JSON.stringify(tooltip));
await browser.close();
