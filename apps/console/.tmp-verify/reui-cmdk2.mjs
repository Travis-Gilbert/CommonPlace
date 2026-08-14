import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.goto('https://reui.io/preview/base/app-shell-8?embed=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(4000);
await page.getByRole('button', { name: 'Search' }).click();
await page.waitForTimeout(1000);
const out = await page.evaluate(() => {
  const all = [...document.querySelectorAll('body *')];
  // find elements that became visible (dialogs/popups) with an input
  const popups = [...document.querySelectorAll('[data-slot="dialog"], [data-slot="command"], [role="dialog"], [role="presentation"] [role="listbox"], [data-slot="popover"]')]
    .filter((el) => el.offsetParent !== null && el.innerText.trim().length > 0);
  return {
    popups: popups.map((el) => ({ slot: el.getAttribute('data-slot'), text: el.innerText.slice(0, 600), inputs: [...el.querySelectorAll('input')].map((i) => i.placeholder) })),
    bodyText: document.body.innerText.slice(0, 600),
  };
});
console.log(JSON.stringify(out, null, 2).slice(0, 3500));
await browser.close();
