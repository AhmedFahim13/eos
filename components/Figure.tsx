"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useEos } from "@/lib/store";
import { BY_ID } from "@/lib/garments";
import { Mannequin } from "./Mannequin";
import { Garment } from "./Garment";

// Render order per slot so layers composite cleanly.
const ORDER = { bottom: 1, top: 2, dress: 3, outer: 4 } as const;

export function Figure() {
  const group = useRef<THREE.Group>(null!);
  const equipped = useEos((s) => s.equipped);
  const reduce = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    []
  );

  useFrame((_, dt) => {
    if (group.current && !reduce) group.current.rotation.y += dt * 0.14;
  });

  // A dress hides top/bottom; otherwise show separates. Outer always layers on top.
  const ids: string[] = [];
  if (equipped.dress) ids.push(equipped.dress);
  else {
    if (equipped.bottom) ids.push(equipped.bottom);
    if (equipped.top) ids.push(equipped.top);
  }
  if (equipped.outer) ids.push(equipped.outer);

  return (
    <group ref={group} position={[0, -1.0, 0]}>
      <Mannequin />
      {ids.map((id) => (
        <Garment key={id} id={id} renderOrder={ORDER[BY_ID[id].slot]} />
      ))}
    </group>
  );
}
