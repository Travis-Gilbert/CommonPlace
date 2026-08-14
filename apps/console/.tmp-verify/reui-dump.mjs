import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.goto('https://reui.io/preview/base/app-shell-8?embed=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(4500);
const html = await page.evaluate(() => document.body.outerHTML);
writeFileSync('/tmp/appshell8-body.html', html);
const stats = await page.evaluate(() => {
  const els = [...document.querySelectorAll('*')];
  return {
    total: els.length,
    buttons: [...document.querySelectorAll('button')].length,
    inputs: [...document.querySelectorAll('input')].length,
    imgs: [...document.querySelectorAll('img')].length,
    text: document.body.innerText.length,
  };
});
console.log('SAVED', html.length, 'bytes', JSON.stringify(stats));
await browser.close();
