/* Chat: Theorem's realtime CommonPlace surface.

   A persistent Node bridge owns the ACP child process. The browser receives
   projected state snapshots for text, tool activity, and permission approval. */

import { TheoremAgentThread } from '@/components/agent/theorem-agent-thread';
import styles from './chat.module.css';

export default function ChatPage() {
  return (
    <div className={styles.wrap}>
      <div className={`${styles.bridge} ${styles.threadFrame}`}>
        <TheoremAgentThread />
      </div>
    </div>
  );
}
