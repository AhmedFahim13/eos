"use client";
import { Html, useProgress } from "@react-three/drei";

export function Loader() {
  const { progress } = useProgress();
  return (
    <Html center>
      <span style={{ color: "#9a9a9a", fontSize: 12, letterSpacing: 3 }}>
        {Math.round(progress)}%
      </span>
    </Html>
  );
}
