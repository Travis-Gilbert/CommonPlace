'use client';

/**
 * Minimal 3D model renderer for SceneHost.
 *
 * Expects the first SceneAtom to carry `metadata.gltf_url` — a public URL
 * pointing at a glTF / GLB asset. Loads via @react-three/drei's useGLTF
 * (which caches), wraps it in a Canvas with ambient + directional lighting
 * and OrbitControls.
 *
 * ponytail: single-atom only. Multi-atom scenes or skeleton animations
 * can be added when a real use-case surfaces.
 */

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import type { SceneRendererProps } from '../types';

export default function Model3dRenderer({ scenePackage }: SceneRendererProps) {
  const atom = scenePackage.atoms[0];
  const gltfUrl =
    typeof atom?.metadata?.gltf_url === 'string'
      ? atom.metadata.gltf_url
      : null;

  if (!gltfUrl) {
    return (
      <div className="cp-scene-host-placeholder">
        No glTF URL in atom metadata.gltf_url
      </div>
    );
  }

  return (
    <div className="cp-scene-host-canvas">
      <Canvas
        camera={{ position: [3, 2, 5], fov: 45 }}
        style={{ background: '#1a1a2e' }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 10, 5]} intensity={0.8} />
        <Suspense fallback={null}>
          <Model url={gltfUrl} />
        </Suspense>
        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
}

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
}
