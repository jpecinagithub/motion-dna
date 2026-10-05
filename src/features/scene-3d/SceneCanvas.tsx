/**
 * SceneCanvas — the shared R3F canvas for all 3D view modes.
 * Dark lab background, fog, subtle grid, orbit controls.
 * preserveDrawingBuffer:true is REQUIRED for PNG export.
 */
import type { ReactElement, ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { Grid, OrbitControls } from '@react-three/drei';
import { registerSceneCanvas } from '../../lib/canvas-registry';

export function SceneCanvas({
  children,
  onCanvasReady,
}: {
  children: ReactNode;
  onCanvasReady?: (c: HTMLCanvasElement) => void;
}): ReactElement {
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Canvas
        camera={{ position: [0, 1.4, 4.6], fov: 40 }}
        dpr={[1, 2]}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        onCreated={(state) => {
          registerSceneCanvas(state.gl.domElement);
          onCanvasReady?.(state.gl.domElement);
        }}
      >
        <color attach="background" args={['#05070d']} />
        <fog attach="fog" args={['#05070d', 8, 18]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[4, 6, 3]} intensity={1.2} />
        <OrbitControls makeDefault enableDamping />
        <Grid
          position={[0, -1.6, 0]}
          sectionColor="#16213a"
          cellColor="#0b1226"
          infiniteGrid
          fadeDistance={14}
        />
        {children}
      </Canvas>
    </div>
  );
}
