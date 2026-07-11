import type { ScenePackageV2 } from '@/lib/scene-package';

export interface SceneRendererProps {
  scenePackage: ScenePackageV2;
  validationReason?: string;
  expanded?: boolean;
}
