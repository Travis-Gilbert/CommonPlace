import { describe, expect, it } from 'vitest';
import {
  rewriteOpenworkChatHtml,
  rewriteOpenworkLocation,
} from './chat-openwork-proxy';

describe('rewriteOpenworkChatHtml', () => {
  it('prefixes root-absolute assets and stamps the register impl', () => {
    const html = `<!doctype html><html lang="en"><head>
<link rel="icon" href="/openwork-mark.svg" />
<script type="module" crossorigin src="/assets/app-abc.js"></script>
<link rel="stylesheet" href="/assets/index-abc.css">
</head><body></body></html>`;
    const out = rewriteOpenworkChatHtml(html);
    expect(out).toContain('data-register-impl="openwork.chat"');
    expect(out).toContain('href="/chat/openwork-mark.svg"');
    expect(out).toContain('src="/chat/assets/app-abc.js"');
    expect(out).toContain('href="/chat/assets/index-abc.css"');
    expect(out).not.toContain('src="/assets/');
  });

  it('does not double-prefix paths already under /chat', () => {
    const html = `<html data-register-impl="openwork.chat"><script src="/chat/assets/x.js"></script></html>`;
    expect(rewriteOpenworkChatHtml(html)).toContain('src="/chat/assets/x.js"');
    expect(rewriteOpenworkChatHtml(html)).not.toContain('src="/chat/chat/');
  });
});

describe('rewriteOpenworkLocation', () => {
  it('prefixes absolute redirects', () => {
    expect(rewriteOpenworkLocation('/')).toBe('/chat/');
    expect(rewriteOpenworkLocation('/settings')).toBe('/chat/settings');
    expect(rewriteOpenworkLocation('/chat/x')).toBe('/chat/x');
  });
});
