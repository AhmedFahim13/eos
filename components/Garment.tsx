"use client";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { BY_ID, FABRICS, SLOT_OFFSET } from "@/lib/garments";
import { makePatternTexture } from "@/lib/pattern";
import { useEos } from "@/lib/store";

// Stylized 3D garment (deploy-safe: no external texture files). Fabric character
// comes from roughness/sheen; prints from a generated CanvasTexture.
export function Garment({ id, renderOrder = 0 }: { id: string; renderOrder?: number }) {
  const g = BY_ID[id];
  const color = useEos((s) => s.colorOf(id));
  const pattern = useEos((s) => s.patternOf(id));
  const fabricId = useEos((s) => s.fabricOf(id));
  const fab = FABRICS[fabricId];

  const geo = useMemo(() => {
    if (!g) return null;
    const off = SLOT_OFFSET[g.slot];
    const pts = g.profile.map(([r, y]) => new THREE.Vector2(r + off, y)).sort((a, b) => a.y - b.y);
    return new THREE.LatheGeometry(pts, 128);
  }, [g]);

  const printMap = useMemo(
    () => (pattern.type === "solid" ? null : makePatternTexture(pattern.type, color, pattern.color, pattern.scale)),
    [pattern.type, pattern.color, pattern.scale, color]
  );
  useEffect(() => () => printMap?.dispose(), [printMap]);
  useEffect(() => () => geo?.dispose(), [geo]);

  if (!g || !geo) return null;
  const solid = pattern.type === "solid";

  return (
    <mesh geometry={geo} castShadow receiveShadow renderOrder={renderOrder}>
      <meshPhysicalMaterial
        map={solid ? null : printMap}
        color={solid ? color : "#ffffff"}
        roughness={fab.roughness}
        metalness={fab.metalness}
        sheen={fab.sheen}
        sheenRoughness={0.5}
        sheenColor="#ffffff"
        transparent={fab.opacity < 1}
        opacity={fab.opacity}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
