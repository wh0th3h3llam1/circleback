"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, Line, OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { BrainGraph } from "@/lib/contracts";
import { hash01 } from "./ui";

export const TYPE_COLOR: Record<string, string> = {
  Person: "#1F4A40",
  Company: "#C9A24A",
  Organization: "#C9A24A",
  Role: "#E9772E",
  Opportunity: "#E9772E",
  Job: "#E9772E",
  Event: "#8A9A4B",
  Skill: "#8fae9f",
  Topic: "#8fae9f",
  Technology: "#8fae9f",
};
export const typeColor = (t?: string) => (t && TYPE_COLOR[t]) || "#9aa8a1";

// Each entity type owns a longitude band so Persons, Companies, Roles and Events cluster on the globe.
const BAND: Record<string, number> = { Person: 0, Company: 1, Organization: 1, Role: 2, Opportunity: 2, Job: 2, Event: 3, Skill: 4, Topic: 4, Technology: 4 };
const R = 6;

export interface BrainGlobeProps {
  graph: BrainGraph;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  reduceMotion: boolean;
}

export default function BrainGlobe(props: BrainGlobeProps) {
  return (
    <Canvas
      camera={{ position: [6, 6, 18], fov: 45, near: 0.1, far: 200 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      onPointerMissed={() => props.onSelect(null)}
      style={{ position: "absolute", inset: 0 }}
      aria-label="3D view of your Cognee brain"
    >
      <ambientLight intensity={0.85} />
      <directionalLight position={[6, 10, 8]} intensity={0.9} />
      <directionalLight position={[-8, -4, -6]} intensity={0.25} />
      <Scene {...props} />
    </Canvas>
  );
}

function Scene({ graph, selectedId, onSelect, reduceMotion }: BrainGlobeProps) {
  const [hover, setHover] = useState<string | null>(null);

  const { pos, degree } = useMemo(() => {
    const deg = new Map<string, number>();
    for (const e of graph.edges) {
      deg.set(e.source, (deg.get(e.source) || 0) + 1);
      deg.set(e.target, (deg.get(e.target) || 0) + 1);
    }
    const bands = new Map<number, string[]>();
    for (const n of graph.nodes) {
      const b = BAND[n.entityType || ""] ?? 5;
      if (!bands.has(b)) bands.set(b, []);
      bands.get(b)!.push(n.id);
    }
    const p = new Map<string, THREE.Vector3>();
    const bandCount = 6;
    for (const [b, ids] of bands) {
      const lon0 = (b / bandCount) * Math.PI * 2;
      ids.forEach((id, i) => {
        const t = ids.length === 1 ? 0.5 : i / (ids.length - 1);
        const lat = (t - 0.5) * 2.4 + (hash01(id, 1) - 0.5) * 0.25;
        const lon = lon0 + (hash01(id, 2) - 0.5) * ((Math.PI * 2) / bandCount) * 0.85;
        const r = R + (hash01(id, 3) - 0.5) * 0.6;
        p.set(id, new THREE.Vector3(r * Math.cos(lat) * Math.cos(lon), r * Math.sin(lat), -r * Math.cos(lat) * Math.sin(lon)));
      });
    }
    return { pos: p, degree: deg };
  }, [graph]);

  const neighbors = useMemo(() => {
    const s = new Set<string>();
    if (!selectedId) return s;
    s.add(selectedId);
    for (const e of graph.edges) {
      if (e.source === selectedId) s.add(e.target);
      if (e.target === selectedId) s.add(e.source);
    }
    return s;
  }, [graph.edges, selectedId]);

  const guides = useMemo(
    () =>
      [0, 0.5, -0.5].map((lat) =>
        Array.from({ length: 97 }, (_, i) => {
          const lon = (i / 96) * Math.PI * 2;
          return new THREE.Vector3(R * Math.cos(lat) * Math.cos(lon), R * Math.sin(lat), -R * Math.cos(lat) * Math.sin(lon));
        }),
      ),
    [],
  );

  const hot = hover ?? selectedId;
  const focus = selectedId ? pos.get(selectedId) ?? null : null;

  return (
    <>
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={7} maxDistance={34} enablePan={false} autoRotate={!reduceMotion && !selectedId} autoRotateSpeed={0.3} />
      <CameraRig target={focus} reduceMotion={reduceMotion} />
      <mesh>
        <sphereGeometry args={[R - 0.1, 64, 48]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.14} depthWrite={false} />
      </mesh>
      {guides.map((pts, i) => (
        <Line key={i} points={pts} color="#8aa196" transparent opacity={0.3} lineWidth={1} />
      ))}

      {graph.edges.map((e, i) => {
        const a = pos.get(e.source);
        const b = pos.get(e.target);
        if (!a || !b) return null;
        const lit = !!hot && (e.source === hot || e.target === hot);
        const dimmed = !!selectedId && !lit;
        const mid = a.clone().add(b).multiplyScalar(0.5);
        return (
          <group key={i}>
            <Line points={[a, b]} color={lit ? "#E9772E" : "#6f8a7f"} transparent opacity={lit ? 0.85 : dimmed ? 0.05 : 0.22} lineWidth={lit ? 1.6 : 1} />
            {lit && (
              <Html position={mid} center zIndexRange={[25, 0]} style={{ pointerEvents: "none" }}>
                <span className="chip !text-[10.5px] !py-1 !px-2" style={{ color: "var(--orange)" }}>
                  {e.label.replace(/_/g, " ")}
                </span>
              </Html>
            )}
          </group>
        );
      })}

      {graph.nodes.map((n) => {
        const p = pos.get(n.id)!;
        const d = degree.get(n.id) || 0;
        const size = Math.min(0.55, 0.16 + Math.sqrt(d) * 0.07);
        const isSel = n.id === selectedId;
        const isHover = n.id === hover;
        const dim = !!selectedId && !neighbors.has(n.id);
        const color = typeColor(n.entityType);
        const showLabel = isSel || isHover || (selectedId ? neighbors.has(n.id) : n.name.toLowerCase() === "me" || d >= 6);
        return (
          <group key={n.id} position={p}>
            <mesh
              scale={isSel || isHover ? 1.45 : 1}
              onPointerOver={(e) => {
                e.stopPropagation();
                setHover(n.id);
                document.body.style.cursor = "pointer";
              }}
              onPointerOut={() => {
                setHover(null);
                document.body.style.cursor = "";
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(n.id);
              }}
            >
              <sphereGeometry args={[n.name.toLowerCase() === "me" ? 0.55 : size, 24, 18]} />
              <meshStandardMaterial color={n.name.toLowerCase() === "me" ? "#1F4A40" : color} roughness={0.5} transparent opacity={dim ? 0.18 : 1} emissive={isSel ? "#E9772E" : "#000"} emissiveIntensity={isSel ? 0.35 : 0} />
            </mesh>
            {showLabel && (
              <Html position={[0, size + 0.4, 0]} center zIndexRange={[30, 0]} style={{ pointerEvents: "none" }}>
                <span className="chip" style={isSel ? { background: "var(--orange)", color: "#fff", borderColor: "transparent" } : dim ? { opacity: 0.5 } : undefined}>
                  {n.name}
                </span>
              </Html>
            )}
          </group>
        );
      })}
    </>
  );
}

function CameraRig({ target, reduceMotion }: { target: THREE.Vector3 | null; reduceMotion: boolean }) {
  const { camera, controls } = useThree();
  const dest = useRef<THREE.Vector3 | null>(null);
  const tx = target?.x ?? 0;
  const ty = target?.y ?? 0;
  const tz = target?.z ?? 0;
  const has = !!target;
  useEffect(() => {
    if (!has) return;
    const dir = new THREE.Vector3(tx, ty, tz).normalize();
    if (dir.lengthSq() < 1e-6) return;
    const narrow = typeof window !== "undefined" && window.innerWidth / window.innerHeight < 0.8;
    dest.current = dir.multiplyScalar(narrow ? 26 : 17).add(new THREE.Vector3(0, 2, 0));
    if (reduceMotion) {
      camera.position.copy(dest.current);
      dest.current = null;
    }
  }, [has, tx, ty, tz, camera, reduceMotion]);
  useFrame(() => {
    if (!dest.current) return;
    camera.position.lerp(dest.current, 0.06);
    camera.lookAt(0, 0, 0);
    (controls as unknown as { update?: () => void } | null)?.update?.();
    if (camera.position.distanceTo(dest.current) < 0.05) dest.current = null;
  });
  return null;
}
