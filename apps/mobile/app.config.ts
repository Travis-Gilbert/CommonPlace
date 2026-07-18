import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const staticConfig = config as ExpoConfig;
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim();
  const existingExtra = staticConfig.extra ?? {};
  const existingEas = existingExtra.eas && typeof existingExtra.eas === 'object'
    ? existingExtra.eas as Record<string, unknown>
    : {};

  return {
    ...staticConfig,
    extra: {
      ...existingExtra,
      ...(projectId ? { eas: { ...existingEas, projectId } } : {}),
    },
  };
};
