import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.goto('https://reui.io/preview/base/app-shell-8?embed=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(4000);
const btn = page.getByRole('button', { name: 'Search' });
const box = await btn.boundingBox();
if (box) {
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(1200);
}
const after = await page.evaluate(() => {
  const dialogs = [...document.querySelectorAll('[role="dialog"]')];
  const visible = dialogs.filter((el) => el.offsetParent !== null || getComputedStyle(el).position === 'fixed');
  return {
    dialogs: dialogs.length,
    visible: visible.map((el) => el.innerText.slice(0, 700)),
    bodyEnd: document.body.innerText.slice(-400),
    lastEl: [...document.body.children].slice(-3).map((c) => c.tagName + ' ' + (c.className || '').toString().slice(0, 60)),
  };
});
console.log(JSON.stringify(after, null, 2).slice(0, 2500));
await browser.close();
