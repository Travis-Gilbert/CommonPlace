import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const jsonResponses = [];
page.on('response', async (resp) => {
  const url = resp.url();
  if (/json|registry|block|api/i.test(url) && resp.status() === 200) {
    try { const t = await resp.text(); if (t.length < 200000) jsonResponses.push({ url, body: t.slice(0, 600) }); } catch {}
  }
});
await page.goto('https://reui.io/blocks/application/app-shell/app-shell-8', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
const dom = await page.evaluate(() => {
  const iframes = [...document.querySelectorAll('iframe')].map((f) => f.src);
  const codeBlocks = [...document.querySelectorAll('pre code, [class*="code"], [class*="Code"]')].slice(0, 5).map((el) => el.textContent?.slice(0, 200) ?? '');
  const buttons = [...document.querySelectorAll('button')].map((b) => b.textContent?.trim()).filter(Boolean).slice(0, 25);
  const hasPreview = !!document.querySelector('[class*="preview"], [class*="Preview"], iframe');
  return { iframes, codeBlocks, buttons, hasPreview };
});
console.log('DOM:', JSON.stringify(dom, null, 2));
console.log('JSON RESPONSES:', jsonResponses.length);
for (const r of jsonResponses.slice(0, 8)) console.log('URL:', r.url.slice(0, 120), '\n', r.body.slice(0, 300), '\n---');
await browser.close();
