import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.goto('https://reui.io/preview/base/app-shell-8?embed=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(4000);
await page.keyboard.press('Control+KeyK');
await page.waitForTimeout(1000);
const before = await page.evaluate(() => {
  const dialog = [...document.querySelectorAll('[role="dialog"]')].filter((el) => el.offsetParent !== null)[0];
  if (!dialog) return 'NO DIALOG';
  return {
    html: dialog.outerHTML.slice(0, 3000),
    inputs: [...dialog.querySelectorAll('input')].map((i) => ({ placeholder: i.placeholder, value: i.value })),
  };
});
console.log('DIALOG BEFORE:', JSON.stringify(before, null, 2).slice(0, 3500));
// type
const input = await page.evaluate(() => {
  const dialog = [...document.querySelectorAll('[role="dialog"]')].filter((el) => el.offsetParent !== null)[0];
  return dialog?.querySelector('input') ?? null;
});
if (input) {
  await input.focus();
  await page.keyboard.type('prod');
  await page.waitForTimeout(800);
  const after = await page.evaluate(() => {
    const dialog = [...document.querySelectorAll('[role="dialog"]')].filter((el) => el.offsetParent !== null)[0];
    return dialog?.innerText ?? '';
  });
  console.log('DIALOG AFTER TYPING "prod":', JSON.stringify(after.slice(0, 800)));
}
await browser.close();
