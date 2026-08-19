"use client";
import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer, OrbitControls, ContactShadows } from "@react-three/drei";
import {
  EffectComposer, Bloom, Vignette, BrightnessContrast, ToneMapping,
} from "@react-three/postprocessing";
import * as THREE from "three";
import { MOODS } from "@/lib/moods";
import { useEos } from "@/lib/store";
import { Figure } from "./Figure";
import { Loader } from "./Loader";

// Lerp the key light + background toward the active mood every frame.
function Rig() {
  const mood = useEos((s) => s.mood);
  const light = useRef<THREE.DirectionalLight>(null!);
  const amb = useRef<THREE.AmbientLight>(null!);
  const col = useRef(new THREE.Color());
  const pos = useRef(new THREE.Vector3());
  const bg = useRef(new THREE.Color());

  useFrame(({ scene }) => {
    const m = MOODS[mood];
    if (light.current) {
      light.current.intensity += (m.key.intensity - light.current.intensity) * 0.06;
      col.current.set(m.key.color);
      light.current.color.lerp(col.current, 0.06);
      pos.current.set(...m.key.position);
      light.current.position.lerp(pos.current, 0.06);
    }
    if (amb.current) amb.current.intensity += (m.ambient - amb.current.intensity) * 0.06;
    bg.current.set(m.bg);
    if (scene.background instanceof THREE.Color) scene.background.lerp(bg.current, 0.06);
    else scene.background = bg.current.clone();
  });

  const m = MOODS[mood];
  return (
    <>
      <ambientLight ref={amb} intensity={m.ambient} />
      <directionalLight
        ref={light}
        castShadow
        intensity={m.key.intensity}
        color={m.key.color}
        position={m.key.position}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0005}
      />
    </>
  );
}

// Procedural studio environment (in-scene light panels) — no CDN/HDRI fetch,
// re-bakes on mood change via the key. Gives soft reflections on satin.
function StudioEnv() {
  const mood = useEos((s) => s.mood);
  const m = MOODS[mood];
  return (
    <Environment key={mood} resolution={256}>
      <Lightformer
        form="rect"
        intensity={m.key.intensity * 1.6}
        color={m.key.color}
        position={[0, 3, 3]}
        scale={[8, 6, 1]}
      />
      <Lightformer
        form="rect"
        intensity={0.7 + m.ambient}
        color="#ffffff"
        position={[-5, 1.5, -1]}
        rotation={[0, Math.PI / 2, 0]}
        scale={[4, 6, 1]}
      />
      <Lightformer
        form="rect"
        intensity={0.5 + m.ambient}
        color="#ffffff"
        position={[5, 1.5, -1]}
        rotation={[0, -Math.PI / 2, 0]}
        scale={[4, 6, 1]}
      />
      <Lightformer
        form="ring"
        intensity={0.5 + m.post.bloom * 2}
        color={m.ui.accent}
        position={[0, 2, -5]}
        scale={2.5}
      />
    </Environment>
  );
}

function Post() {
  const mood = useEos((s) => s.mood);
  const m = MOODS[mood];
  return (
    <EffectComposer>
      <Bloom intensity={m.post.bloom} luminanceThreshold={0.65} mipmapBlur />
      <BrightnessContrast brightness={0} contrast={m.post.contrast} />
      <Vignette offset={0.22} darkness={m.post.vignette} />
      <ToneMapping />
    </EffectComposer>
  );
}

export function Scene() {
  const mood = useEos((s) => s.mood);
  const m = MOODS[mood];
  return (
    <Canvas
      shadows
      camera={{ position: [0, 0.4, 5], fov: 34 }}
      dpr={[1, 2]}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
    >
      <color attach="background" args={[m.bg]} />
      <Suspense fallback={<Loader />}>
        <Rig />
        <Figure />
        <ContactShadows position={[0, -1.02, 0]} opacity={0.55} scale={9} blur={2.6} far={4.5} />
        <StudioEnv />
        <Post />
      </Suspense>
      <OrbitControls
        enablePan={false}
        minDistance={3.2}
        maxDistance={7.5}
        maxPolarAngle={Math.PI / 1.95}
        target={[0, 0.2, 0]}
      />
    </Canvas>
  );
}
