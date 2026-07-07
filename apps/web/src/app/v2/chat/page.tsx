/* Chat — the harness Chat surface (PT-022, harness-console → CommonPlace).
   Hosts the ported Omnibar (`components/island/Omnibar`): the 21st.dev ai-input
   wired to Theorem's agent + RustyWeb. Its modes ARE the "connected to agents"
   settings the user picks:
     - chat (ask)      -> the composed Theorem agent, over /api/theorem/agent
     - web (search)    -> RustyWeb external search, no agent
     - web + agents    -> search, then the agent over the evidence bundle
     - fractal         -> graph frontier + web expansion
   The Omnibar is styled in the legacy `--cp-*` namespace; rather than pull that
   cascade into the porcelain-only /v2 shell, `chat.module.css` BRIDGES those
   tokens onto porcelain values in a scoped wrapper, and inlines the omnibar's
   otherwise-fixed frame. Reuse of the tested component, in the shell's language. */

import Omnibar from '@/components/island/Omnibar';
import styles from './chat.module.css';

export default function ChatPage() {
  return (
    <>
      <header className="p-top">
        <div className="p-toph">
          <div className="p-kicker">Harness</div>
          <h1 className="p-h1">Chat</h1>
        </div>
      </header>

      <div className={styles.wrap}>
        <div className={styles.bridge}>
          <p className={styles.hint}>
            Ask Theorem, search the web, or both — pick a mode below.
          </p>
          <Omnibar frameClassName={styles.omniFrame} shellClassName={styles.omniShell} />
        </div>
      </div>
    </>
  );
}
