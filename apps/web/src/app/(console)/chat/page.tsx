/* Chat — Theorem's real-time CommonPlace surface.

   Theorem runs through the product ACP WebSocket so chat and coding share one
   transcript contract: streamed text, tool updates, reviewed file writes, and
   command approvals. AgentThreadView retains the JSON agent route as a startup
   fallback while a backend deployment is unavailable. */

import AgentThreadView from '@/components/commonplace/views/AgentThreadView';
import styles from './chat.module.css';

export default function ChatPage() {
  return (
    <div className={styles.wrap}>
      <div className={`${styles.bridge} ${styles.threadFrame}`}>
        <AgentThreadView agentId="theorem" agentMode="acp" />
      </div>
    </div>
  );
}
