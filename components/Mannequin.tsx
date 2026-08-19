"use client";
import { useMemo } from "react";
import * as THREE from "three";

// A neutral couture dress-form: soft torso (hip → neck) on a slender stand.
const FORM: [number, number][] = [
  [0.33, 0.9], [0.3, 1.05], [0.27, 1.2], [0.31, 1.45],
  [0.33, 1.6], [0.3, 1.72], [0.12, 1.9],
];

export function Mannequin() {
  const geo = useMemo(
    () => new THREE.LatheGeometry(FORM.map(([r, y]) => new THREE.Vector2(r, y)), 64),
    []
  );
  return (
    <group>
      <mesh geometry={geo} castShadow receiveShadow renderOrder={0}>
        <meshStandardMaterial color="#cfc6ba" roughness={0.9} metalness={0} side={THREE.DoubleSide} />
      </mesh>
      {/* stand */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 0.85, 24]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.4, 0.46, 0.08, 48]} />
        <meshStandardMaterial color="#141414" metalness={0.7} roughness={0.35} />
      </mesh>
    </group>
  );
}
