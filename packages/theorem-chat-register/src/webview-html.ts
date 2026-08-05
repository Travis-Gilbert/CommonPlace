// SOURCING: none. Studio webview host: stamped HTML shell shared with the
// React register's identity (theorem.chat). No OpenWork markup.
import { REGISTER_IMPL } from './register-impl.js';

/**
 * Minimal HTML document for VS Code / Studio webviews. The extension host owns
 * the ChatSessionController; the page posts prompt events and paints snapshots.
 */
export function renderTheoremChatWebviewHtml(options: {
  readonly nonce: string;
  readonly cspSource: string;
}): string {
  const { nonce, cspSource } = options;
  return `<!doctype html>
<html data-register-impl="${REGISTER_IMPL}">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <title>Theorem chat</title>
  <style>
    :root { color-scheme: light dark; font-family: var(--vscode-font-family, system-ui, sans-serif); }
    body { margin: 0; padding: 12px; display: flex; flex-direction: column; gap: 10px; height: 100vh; box-sizing: border-box; }
    #messages { flex: 1; overflow: auto; display: flex; flex-direction: column; gap: 8px; }
    .msg { max-width: 90%; padding: 8px 10px; border-radius: 8px; white-space: pre-wrap; }
    .user { align-self: flex-end; background: color-mix(in srgb, CanvasText 12%, transparent); }
    .assistant { align-self: flex-start; background: color-mix(in srgb, CanvasText 6%, transparent); }
    form { display: flex; gap: 8px; }
    input { flex: 1; padding: 8px; }
    #error { color: var(--vscode-errorForeground, crimson); margin: 0; font-size: 12px; }
  </style>
</head>
<body data-theorem-chat-register data-register-impl="${REGISTER_IMPL}">
  <strong>Theorem chat</strong>
  <p id="session" style="margin:0;opacity:.6;font-size:12px"></p>
  <div id="messages" data-theorem-chat-messages></div>
  <p id="error" role="alert" hidden></p>
  <form id="composer">
    <input id="draft" aria-label="Message" placeholder="Message Theorem…" />
    <button type="submit" id="send">Send</button>
  </form>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const messages = document.getElementById('messages');
    const sessionEl = document.getElementById('session');
    const errorEl = document.getElementById('error');
    const draft = document.getElementById('draft');
    const send = document.getElementById('send');
    document.getElementById('composer').addEventListener('submit', (event) => {
      event.preventDefault();
      const text = draft.value.trim();
      if (!text || send.disabled) return;
      draft.value = '';
      vscode.postMessage({ type: 'prompt', text });
    });
    window.addEventListener('message', (event) => {
      const data = event.data || {};
      if (data.type !== 'snapshot') return;
      const snap = data.snapshot || {};
      sessionEl.textContent = snap.sessionId ? ('session ' + snap.sessionId) : '';
      send.disabled = !!snap.running;
      if (snap.error) { errorEl.hidden = false; errorEl.textContent = snap.error; }
      else { errorEl.hidden = true; errorEl.textContent = ''; }
      messages.replaceChildren();
      for (const message of (snap.messages || [])) {
        const el = document.createElement('div');
        el.className = 'msg ' + message.role;
        el.dataset.role = message.role;
        el.textContent = message.text || (message.role === 'assistant' && snap.running ? '…' : '');
        messages.appendChild(el);
      }
      messages.scrollTop = messages.scrollHeight;
    });
    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
}
