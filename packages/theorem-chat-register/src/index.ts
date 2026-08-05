// SOURCING: none. SPEC-THEOREM-CHAT-REGISTER-1.0 package barrel.
export { REGISTER_IMPL, type TheoremChatRegisterImpl } from './register-impl.js';
export {
  createChatSessionController,
  type ChatMessage,
  type ChatSessionController,
  type ChatSessionSnapshot,
} from './session.js';
export type { ChatTransport } from './transport.js';
export { createHttpStreamTransport, type HttpStreamTransportOptions } from './http-stream-transport.js';
export { TheoremChatRegister, type TheoremChatRegisterProps } from './TheoremChatRegister.tsx';
export { renderTheoremChatWebviewHtml } from './webview-html.js';
