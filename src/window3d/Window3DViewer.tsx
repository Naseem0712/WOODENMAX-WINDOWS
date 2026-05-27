import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import { Suspense, useMemo } from 'react';
import type { Window3DSceneSpec } from './configToScene';
import { buildSlidingPanels3D, slideOffsetMm, type SlidingPanel3D } from './slidingLayout3d';

const MM = 0.001;
const FRAME_DEPTH_M = 0.075;
const TRACK_BAND_MM = 14;
const Z_STEP = 0.004;

type Props = {
  spec: Window3DSceneSpec;
  slideOpen: number;
  casementOpenDeg: number;
};

function ProfileMaterial({ color }: { color: string }) {
  return <meshStandardMaterial color={color} metalness={0.35} roughness={0.45} />;
}

function GlassMaterial({ tint = '#bae6fd' }: { tint?: string }) {
  return (
    <meshPhysicalMaterial
      color={tint}
      transparent
      opacity={0.55}
      transmission={0.75}
      thickness={0.006}
      roughness={0.05}
      metalness={0.02}
    />
  );
}

function MeshMaterial() {
  return (
    <meshStandardMaterial color="#94a3b8" transparent opacity={0.65} metalness={0.1} roughness={0.85} />
  );
}

function FrameShell({
  spec,
  innerW,
  innerH,
}: {
  spec: Window3DSceneSpec;
  innerW: number;
  innerH: number;
}) {
  const f = spec.frameMm * MM;
  const d = FRAME_DEPTH_M;
  const hw = spec.widthM / 2;
  const hh = spec.heightM / 2;

  return (
    <group>
      <mesh position={[0, hh - f / 2, 0]}>
        <boxGeometry args={[spec.widthM, f, d]} />
        <ProfileMaterial color={spec.profileColor} />
      </mesh>
      <mesh position={[0, -hh + f / 2, 0]}>
        <boxGeometry args={[spec.widthM, f, d]} />
        <ProfileMaterial color={spec.profileColor} />
      </mesh>
      <mesh position={[-hw + f / 2, 0, 0]}>
        <boxGeometry args={[f, innerH, d]} />
        <ProfileMaterial color={spec.profileColor} />
      </mesh>
      <mesh position={[hw - f / 2, 0, 0]}>
        <boxGeometry args={[f, innerH, d]} />
        <ProfileMaterial color={spec.profileColor} />
      </mesh>
    </group>
  );
}

function TrackBands({ innerW, innerH }: { innerW: number; innerH: number }) {
  const band = TRACK_BAND_MM * MM;
  const hh = innerH / 2;
  return (
    <group>
      <mesh position={[0, hh - band / 2, 0.002]}>
        <boxGeometry args={[innerW, band, 0.012]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.5} roughness={0.35} />
      </mesh>
      <mesh position={[0, -hh + band / 2, 0.002]}>
        <boxGeometry args={[innerW, band, 0.012]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.5} roughness={0.35} />
      </mesh>
    </group>
  );
}

function ShutterPanel3D({
  panel,
  spec,
  innerW,
  innerH,
  innerWmm,
  slideOpen,
}: {
  panel: SlidingPanel3D;
  spec: Window3DSceneSpec;
  innerW: number;
  innerH: number;
  innerWmm: number;
  slideOpen: number;
}) {
  const dims = spec.windowConfig.series.dimensions;
  const profTop = Math.max(0.018, (Number(dims.shutterTop) || 40) * MM);
  const profSide = Math.max(0.012, (Number(dims.shutterInterlock) || 25) * MM * 0.9);

  const band = TRACK_BAND_MM * MM;
  const panelH = innerH - band * 2;
  const panelW = panel.widthMm * MM;

  const slideMm = slideOffsetMm(panel, innerWmm, slideOpen);
  const centerX = -innerW / 2 + (panel.xMm + panel.widthMm / 2) * MM + slideMm * MM;
  const z = panel.zLayer * Z_STEP;

  const glassW = Math.max(0.02, panelW - profSide * 2);
  const glassH = Math.max(0.02, panelH - profTop * 2);

  const handleOnRight =
    panel.handleX !== undefined && panel.handleX > 55;
  const handleXLocal = handleOnRight ? panelW / 2 - profSide * 1.2 : -panelW / 2 + profSide * 1.2;
  const handleYLocal = ((panel.handleY ?? 50) / 100 - 0.5) * panelH;

  return (
    <group position={[centerX, 0, z]}>
      <mesh>
        <boxGeometry args={[panelW, panelH, 0.028]} />
        <ProfileMaterial color={spec.profileColor} />
      </mesh>
      <mesh position={[0, 0, 0.016]}>
        <boxGeometry args={[glassW, glassH, 0.006]} />
        {panel.isMesh ? <MeshMaterial /> : <GlassMaterial />}
      </mesh>
      {panel.handleX !== undefined && (
        <mesh position={[handleXLocal, handleYLocal, 0.034]}>
          <boxGeometry args={[0.014, 0.09, 0.022]} />
          <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.3} />
        </mesh>
      )}
    </group>
  );
}

function SlidingAssembly({
  spec,
  innerW,
  innerH,
  slideOpen,
}: {
  spec: Window3DSceneSpec;
  innerW: number;
  innerH: number;
  slideOpen: number;
}) {
  const innerWmm = innerW / MM;
  const panels = useMemo(
    () => buildSlidingPanels3D(spec.windowConfig, innerWmm),
    [spec.windowConfig, innerWmm],
  );

  const sorted = useMemo(
    () => [...panels].sort((a, b) => a.zLayer - b.zLayer),
    [panels],
  );

  return (
    <group>
      <TrackBands innerW={innerW} innerH={innerH} />
      {sorted.map((p) => (
        <ShutterPanel3D
          key={p.id}
          panel={p}
          spec={spec}
          innerW={innerW}
          innerH={innerH}
          innerWmm={innerWmm}
          slideOpen={slideOpen}
        />
      ))}
    </group>
  );
}

function LouverBlades({
  spec,
  innerW,
  innerH,
}: {
  spec: Window3DSceneSpec;
  innerW: number;
  innerH: number;
}) {
  const pitch = Math.max(0.02, spec.louverBladePitchMm * MM);
  const vertical = spec.louverOrientation === 'vertical';
  const count = Math.floor((vertical ? innerH : innerW) / pitch);

  return (
    <group>
      {Array.from({ length: Math.min(count, 48) }, (_, i) => {
        const offset = -((vertical ? innerH : innerW) / 2) + pitch * (i + 0.5);
        return (
          <mesh
            key={i}
            position={vertical ? [0, offset, 0.01] : [offset, 0, 0.01]}
            rotation={vertical ? [0.35, 0, 0] : [0, 0.35, 0]}
          >
            <boxGeometry
              args={
                vertical
                  ? [innerW * 0.92, pitch * 0.35, 0.012]
                  : [pitch * 0.35, innerH * 0.92, 0.012]
              }
            />
            <ProfileMaterial color={spec.profileColor} />
          </mesh>
        );
      })}
    </group>
  );
}

function CasementPanel({
  spec,
  innerW,
  innerH,
  openDeg,
}: {
  spec: Window3DSceneSpec;
  innerW: number;
  innerH: number;
  openDeg: number;
}) {
  const rad = (openDeg * Math.PI) / 180;
  return (
    <group position={[-innerW / 2, 0, 0]} rotation={[0, rad, 0]}>
      <group position={[innerW / 2, 0, 0]}>
        <mesh>
          <boxGeometry args={[innerW * 0.94, innerH * 0.94, 0.024]} />
          <ProfileMaterial color={spec.profileColor} />
        </mesh>
        <mesh position={[0, 0, 0.013]}>
          <boxGeometry args={[innerW * 0.8, innerH * 0.8, 0.006]} />
          <GlassMaterial />
        </mesh>
      </group>
    </group>
  );
}

function GenericGlazing({ innerW, innerH }: { innerW: number; innerH: number }) {
  return (
    <mesh>
      <boxGeometry args={[innerW * 0.92, innerH * 0.92, 0.008]} />
      <GlassMaterial />
    </mesh>
  );
}

function WindowModel({ spec, slideOpen, casementOpenDeg }: Props) {
  const f = spec.frameMm * MM;
  const innerW = Math.max(0.05, spec.widthM - f * 2);
  const innerH = Math.max(0.05, spec.heightM - f * 2);

  return (
    <group>
      <FrameShell spec={spec} innerW={innerW} innerH={innerH} />
      {spec.kind === 'sliding' && (
        <SlidingAssembly spec={spec} innerW={innerW} innerH={innerH} slideOpen={slideOpen} />
      )}
      {spec.kind === 'louvers' && <LouverBlades spec={spec} innerW={innerW} innerH={innerH} />}
      {spec.kind === 'casement' && (
        <CasementPanel spec={spec} innerW={innerW} innerH={innerH} openDeg={casementOpenDeg} />
      )}
      {spec.kind === 'generic' && <GenericGlazing innerW={innerW} innerH={innerH} />}
    </group>
  );
}

function SceneContent(props: Props) {
  const camZ = Math.max(props.spec.widthM, props.spec.heightM) * 1.35;
  return (
    <>
      <ambientLight intensity={0.92} />
      <hemisphereLight args={['#f8fafc', '#94a3b8', 0.65]} />
      <directionalLight position={[5, 8, 6]} intensity={1.25} castShadow />
      <directionalLight position={[-4, 3, 4]} intensity={0.45} />
      <WindowModel {...props} />
      <ContactShadows
        position={[0, -props.spec.heightM / 2 - 0.04, 0]}
        opacity={0.22}
        scale={14}
        blur={2}
        color="#64748b"
      />
      <OrbitControls
        makeDefault
        enablePan
        minDistance={camZ * 0.35}
        maxDistance={camZ * 3}
        target={[0, 0, 0]}
      />
    </>
  );
}

export function Window3DViewer({ spec, slideOpen, casementOpenDeg }: Props) {
  const camZ = Math.max(spec.widthM, spec.heightM) * 1.35;
  return (
    <Canvas
      shadows
      camera={{ position: [0, 0.05, camZ], fov: 40, near: 0.01, far: 100 }}
      gl={{ antialias: true, alpha: false }}
      style={{ width: '100%', height: '100%', touchAction: 'none', background: '#e2e8f0' }}
    >
      <color attach="background" args={['#e2e8f0']} />
      <Suspense fallback={null}>
        <SceneContent spec={spec} slideOpen={slideOpen} casementOpenDeg={casementOpenDeg} />
      </Suspense>
    </Canvas>
  );
}
