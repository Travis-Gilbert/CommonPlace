import '@assistant-ui/react';

declare module '@assistant-ui/react' {
  namespace Assistant {
    interface Commands {
      theoremPermissionResponse: {
        type: 'permission-response';
        callId: string;
        decision: 'allow' | 'reject';
      };
    }
  }
}
