"use client";

import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
const MAX_LABELS = 12;

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
      dpr={[1, 1.5]}
      gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
      onPointerMissed={() => props.onSelect(null)}
      style={{ position: "absolute", inset: 0 }}
      aria-label="3D view of your Cognee brain"
    >
      <ambientLight intensity={0.9} />
      <directionalLight position={[6, 10, 8]} intensity={0.9} />
      <Scene {...props} />
    </Canvas>
  );
}

const tmpObj = new THREE.Object3D();
const tmpColor = new THREE.Color();
const DIM = new THREE.Color("#dfe5e1");

function Scene({ graph, selectedId, onSelect, reduceMotion }: BrainGlobeProps) {
  const [hover, setHover] = useState<number | null>(null);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const interacting = useRef(false);

  // Layout, degree and index maps: built once per graph.
  const layout = useMemo(() => {
    const deg = new Map<string, number>();
    for (const e of graph.edges) {
      deg.set(e.source, (deg.get(e.source) || 0) + 1);
      deg.set(e.target, (deg.get(e.target) || 0) + 1);
    }
    const bands = new Map<number, number[]>();
    graph.nodes.forEach((n, i) => {
      const b = BAND[n.entityType || ""] ?? 5;
      if (!bands.has(b)) bands.set(b, []);
      bands.get(b)!.push(i);
    });
    const pos: THREE.Vector3[] = new Array(graph.nodes.length);
    const bandCount = 6;
    for (const [b, idxs] of bands) {
      const lon0 = (b / bandCount) * Math.PI * 2;
      idxs.forEach((i, k) => {
        const id = graph.nodes[i].id;
        const t = idxs.length === 1 ? 0.5 : k / (idxs.length - 1);
        const lat = (t - 0.5) * 2.4 + (hash01(id, 1) - 0.5) * 0.25;
        const lon = lon0 + (hash01(id, 2) - 0.5) * ((Math.PI * 2) / bandCount) * 0.85;
        const r = R + (hash01(id, 3) - 0.5) * 0.6;
        pos[i] = new THREE.Vector3(r * Math.cos(lat) * Math.cos(lon), r * Math.sin(lat), -r * Math.cos(lat) * Math.sin(lon));
      });
    }
    const index = new Map(graph.nodes.map((n, i) => [n.id, i]));
    const size = graph.nodes.map((n) => (n.name.toLowerCase() === "me" ? 0.55 : Math.min(0.5, 0.12 + Math.sqrt(deg.get(n.id) || 0) * 0.06)));
    const baseColor = graph.nodes.map((n) => new THREE.Color(n.name.toLowerCase() === "me" ? "#1F4A40" : typeColor(n.entityType)));
    // Biggest hubs get a label when nothing is selected.
    const hubs = graph.nodes
      .map((n, i) => ({ i, d: deg.get(n.id) || 0 }))
      .sort((a, b) => b.d - a.d)
      .slice(0, 8)
      .map((x) => x.i);
    return { pos, index, size, baseColor, hubs, deg };
  }, [graph]);

  const selIdx = selectedId != null ? layout.index.get(selectedId) ?? null : null;
  const hotIdx = hover ?? selIdx;

  const neighbors = useMemo(() => {
    const s = new Set<number>();
    if (selIdx == null) return s;
    s.add(selIdx);
    const id = graph.nodes[selIdx].id;
    for (const e of graph.edges) {
      if (e.source === id) s.add(layout.index.get(e.target)!);
      if (e.target === id) s.add(layout.index.get(e.source)!);
    }
    s.delete(undefined as unknown as number);
    return s;
  }, [graph, selIdx, layout]);

  // All edges as ONE LineSegments geometry, built once per graph.
  const edgeGeom = useMemo(() => {
    const arr: number[] = [];
    for (const e of graph.edges) {
      const a = layout.index.get(e.source);
      const b = layout.index.get(e.target);
      if (a == null || b == null) continue;
      const pa = layout.pos[a];
      const pb = layout.pos[b];
      arr.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
    return g;
  }, [graph, layout]);

  // Only the edges touching the hovered/selected node, highlighted in orange (small, rebuilt on change).
  const hot = useMemo(() => {
    if (hotIdx == null) return null;
    const id = graph.nodes[hotIdx].id;
    const arr: number[] = [];
    const labels: { mid: THREE.Vector3; label: string }[] = [];
    for (const e of graph.edges) {
      if (e.source !== id && e.target !== id) continue;
      const a = layout.index.get(e.source);
      const b = layout.index.get(e.target);
      if (a == null || b == null) continue;
      const pa = layout.pos[a];
      const pb = layout.pos[b];
      arr.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z);
      if (labels.length < 6) labels.push({ mid: pa.clone().add(pb).multiplyScalar(0.5), label: e.label.replace(/_/g, " ") });
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
    return { g, labels };
  }, [graph, hotIdx, layout]);
  useEffect(() => () => hot?.g.dispose(), [hot]);
  useEffect(() => () => edgeGeom.dispose(), [edgeGeom]);

  // Instance matrices + colors: written only when the graph, selection or hover changes (never per frame).
  useLayoutEffect(() => {
    const m = meshRef.current;
    if (!m) return;
    const dimming = selIdx != null;
    for (let i = 0; i < graph.nodes.length; i++) {
      const big = i === selIdx || i === hover ? 1.45 : 1;
      tmpObj.position.copy(layout.pos[i]);
      tmpObj.scale.setScalar(layout.size[i] * big);
      tmpObj.updateMatrix();
      m.setMatrixAt(i, tmpObj.matrix);
      tmpColor.copy(layout.baseColor[i]);
      if (i === selIdx) tmpColor.set("#E9772E");
      else if (dimming && !neighbors.has(i)) tmpColor.lerp(DIM, 0.8);
      m.setColorAt(i, tmpColor);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [graph, layout, selIdx, hover, neighbors]);

  const labelIdx = useMemo(() => {
    const out: number[] = [];
    const push = (i: number | null | undefined) => {
      if (i != null && !out.includes(i) && out.length < MAX_LABELS) out.push(i);
    };
    push(selIdx);
    push(hover);
    if (selIdx != null) for (const i of neighbors) push(i);
    else layout.hubs.forEach(push);
    return out;
  }, [selIdx, hover, neighbors, layout]);

  const guides = useMemo(
    () =>
      [0, 0.5, -0.5].map((lat) => {
        const pts: number[] = [];
        for (let i = 0; i <= 96; i++) {
          const lon = (i / 96) * Math.PI * 2;
          pts.push(R * Math.cos(lat) * Math.cos(lon), R * Math.sin(lat), -R * Math.cos(lat) * Math.sin(lon));
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
        return g;
      }),
    [],
  );

  const sphereGeom = useMemo(() => new THREE.SphereGeometry(1, 12, 8), []);
  const focus = selIdx != null ? layout.pos[selIdx] : null;

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (e.instanceId == null || e.instanceId === hover) return;
    setHover(e.instanceId);
    document.body.style.cursor = "pointer";
  };

  return (
    <>
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={7}
        maxDistance={34}
        enablePan={false}
        autoRotate={!reduceMotion && selIdx == null}
        autoRotateSpeed={0.3}
        onStart={() => (interacting.current = true)}
        onEnd={() => (interacting.current = false)}
      />
      <CameraRig target={focus} reduceMotion={reduceMotion} />
      <mesh>
        <sphereGeometry args={[R - 0.1, 48, 32]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.14} depthWrite={false} />
      </mesh>
      {guides.map((g, i) => (
        <line key={i}>
          <primitive object={g} attach="geometry" />
          <lineBasicMaterial color="#8aa196" transparent opacity={0.3} />
        </line>
      ))}

      <lineSegments geometry={edgeGeom}>
        <lineBasicMaterial color="#6f8a7f" transparent opacity={selIdx != null ? 0.05 : 0.16} depthWrite={false} />
      </lineSegments>
      {hot && (
        <lineSegments geometry={hot.g}>
          <lineBasicMaterial color="#E9772E" transparent opacity={0.9} />
        </lineSegments>
      )}
      {hot?.labels.map((l, i) => (
        <Html key={i} position={l.mid} center zIndexRange={[25, 0]} style={{ pointerEvents: "none" }}>
          <span className="chip !text-[10.5px] !py-1 !px-2" style={{ color: "var(--orange)" }}>
            {l.label}
          </span>
        </Html>
      ))}

      <instancedMesh
        ref={meshRef}
        args={[sphereGeom, undefined, graph.nodes.length]}
        key={graph.nodes.length}
        onPointerMove={onMove}
        onPointerOut={() => {
          setHover(null);
          document.body.style.cursor = "";
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (e.instanceId != null) onSelect(graph.nodes[e.instanceId].id);
        }}
      >
        <meshStandardMaterial roughness={0.55} />
      </instancedMesh>

      {labelIdx.map((i) => {
        const n = graph.nodes[i];
        const isSel = i === selIdx;
        return (
          <Html key={n.id} position={[layout.pos[i].x, layout.pos[i].y + layout.size[i] + 0.35, layout.pos[i].z]} center zIndexRange={[30, 0]} style={{ pointerEvents: "none" }}>
            <span className="chip" style={isSel ? { background: "var(--orange)", color: "#fff", borderColor: "transparent" } : undefined}>
              {n.name}
            </span>
          </Html>
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
