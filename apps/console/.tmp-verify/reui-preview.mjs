import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const hits = [];
page.on('response', async (resp) => {
  const url = resp.url();
  if (resp.status() === 200 && (/json|registry|\/r\/|block/i.test(url)) && !/\.js|\.css|\.png|\.svg/.test(url)) {
    try {
      const t = await resp.text();
      hits.push({ url: url.slice(0, 140), len: t.length, head: t.slice(0, 300) });
    } catch {}
  }
});
await page.goto('https://reui.io/preview/base/app-shell-8?embed=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(4000);
console.log('HITS:');
for (const h of hits.slice(0, 10)) console.log(' ', h.url, `(${h.len}b)`, '\n   ', h.head.replace(/\n/g, ' ').slice(0, 250), '\n');
const body = await page.evaluate(() => document.body.innerText.slice(0, 400));
console.log('BODY TEXT:', JSON.stringify(body.slice(0, 300)));
await browser.close();
