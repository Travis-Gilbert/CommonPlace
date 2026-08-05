// SOURCING: none. SPEC-THEOREM-CHAT-REGISTER-1.0 package barrel.
export { REGISTER_IMPL, type TheoremChatRegisterImpl } from './register-impl';
export {
  createChatSessionController,
  type ChatMessage,
  type ChatSessionController,
  type ChatSessionSnapshot,
} from './session';
export type { ChatTransport } from './transport';
export { createHttpStreamTransport, type HttpStreamTransportOptions } from './http-stream-transport';
export { TheoremChatRegister, type TheoremChatRegisterProps } from './TheoremChatRegister';
export { renderTheoremChatWebviewHtml } from './webview-html';
