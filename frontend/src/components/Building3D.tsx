"use client";
/**
 * Three.js scene (via react-three-fiber) for one parcel.
 *
 * Coordinate mapping (metres):
 *   local x (east)  -> three x
 *   local y (north) -> three -z   (three's z points toward the viewer)
 *   elevation       -> three y
 *
 * Every unit is a box built from its stored bounding volume, so what you see
 * is literally the volume the ownership record claims.
 */
import { useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html, Grid, Edges } from "@react-three/drei";
import * as THREE from "three";
import { LAYER_COLORS, USAGE_COLORS, type Building, type Layer, type Unit } from "@/lib/api";

type Props = {
  parcelLocal: number[][];
  buildings: Building[];
  layers: Layer[];
  selectedUlpin: string | null;
  conflictUlpins: Set<string>;
  explode: number; // 0..1 vertical gap between floors
  focusFloor: number | null; // floor_number to isolate, null = all
  onSelectUnit: (u: Unit) => void;
  onWarningClick?: (u: Unit) => void; // unit changed since registration -> jump to its version timeline
};

function ringToShape(ring: number[][]) {
  const s = new THREE.Shape();
  ring.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, -y) : s.lineTo(x, -y)));
  s.closePath();
  return s;
}

function GroundPolygon({ ring, color, opacity = 1, y = 0 }: { ring: number[][]; color: string; opacity?: number; y?: number }) {
  const shape = useMemo(() => ringToShape(ring), [ring]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]}>
      <shapeGeometry args={[shape]} />
      <meshStandardMaterial color={color} transparent={opacity < 1} opacity={opacity} side={THREE.DoubleSide} />
    </mesh>
  );
}

function UnitBox({
  unit, yOffset, selected, conflict, dimmed, onClick, onWarningClick,
}: { unit: Unit; yOffset: number; selected: boolean; conflict: boolean; dimmed: boolean; onClick: () => void; onWarningClick?: (u: Unit) => void }) {
  const [hover, setHover] = useState(false);
  const { min, max } = unit.volume;
  const gap = 0.12; // small visual gap so neighbouring boxes read as separate units
  const w = Math.max(max[0] - min[0] - gap, 0.1);
  const d = Math.max(max[1] - min[1] - gap, 0.1);
  const h = Math.max(max[2] - min[2] - gap, 0.1);
  const cx = (min[0] + max[0]) / 2;
  const cy = (min[1] + max[1]) / 2;
  const cz = (min[2] + max[2]) / 2 + yOffset;
  const base = USAGE_COLORS[unit.usage_type] ?? "#64748b";
  const color = conflict ? "#dc2626" : base;
  return (
    <mesh
      position={[cx, cz, -cy]}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { setHover(false); document.body.style.cursor = "auto"; }}
    >
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={dimmed ? 0.12 : conflict ? 0.85 : 0.75}
        emissive={selected ? "#22e8c8" : conflict ? "#dc2626" : hover ? color : "#000000"}
        emissiveIntensity={selected ? 0.55 : conflict ? 0.25 : hover ? 0.35 : 0}
      />
      <Edges color={selected ? "#22e8c8" : conflict ? "#fca5a5" : "#0a0e14"} threshold={15} lineWidth={selected ? 2 : 1} />
      {selected && <Edges color="#22e8c8" threshold={15} scale={1.03} />}
      {unit.flags && (unit.flags.changed_since_registration || unit.flags.has_open_dispute || unit.flags.has_pending_request) && !dimmed && (
        <Html distanceFactor={45} position={[w / 2 - 0.8, h / 2 + 0.4, d / 2 - 0.8]} center>
          <button
            title={unit.flags.has_unapproved_change ? "Changed WITHOUT owner approval — view history" : unit.flags.has_open_dispute ? "Dispute filed — view history" : unit.flags.has_pending_request ? "Change request pending" : "Changed since registration — view history"}
            onClick={(e) => { e.stopPropagation(); onWarningClick?.(unit); }}
            className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold ${unit.flags.has_unapproved_change || unit.flags.has_open_dispute ? "bg-red-600 text-white glow-danger animate-pulse-danger" : "bg-amber-400 text-slate-900 glow-warn"}`}
          >!</button>
        </Html>
      )}
      {(hover || selected) && !dimmed && (
        <Html distanceFactor={60} position={[0, h / 2 + 0.6, 0]} center style={{ pointerEvents: "none" }}>
          <div className="glass whitespace-nowrap rounded px-2 py-1 font-mono text-[11px]" style={{ color: "#22e8c8", textShadow: "0 0 8px rgba(34,232,200,0.5)" }}>
            {unit.label} · {unit.unit_ulpin}
          </div>
        </Html>
      )}
    </mesh>
  );
}

function LayerBox({ layer }: { layer: Layer }) {
  const shape = useMemo(() => ringToShape(layer.footprint_local), [layer.footprint_local]);
  const depth = layer.top_m - layer.bottom_m;
  const color = LAYER_COLORS[layer.layer_type] ?? "#475569";
  return (
    <group position={[0, layer.bottom_m, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <extrudeGeometry args={[shape, { depth, bevelEnabled: false }]} />
        <meshStandardMaterial color={color} transparent opacity={0.35} />
        <Edges color={color} />
      </mesh>
      <Html distanceFactor={80} position={[layer.footprint_local[0][0] + 6, depth + 0.5, -layer.footprint_local[0][1] - 2]} style={{ pointerEvents: "none" }}>
        <div className="whitespace-nowrap rounded px-2 py-0.5 font-mono text-[11px] font-medium text-white" style={{ background: color, boxShadow: `0 0 12px ${color}88` }}>
          {layer.name} · {layer.layer_ulpin.split("-").slice(4).join("-")}
        </div>
      </Html>
    </group>
  );
}

function Scene(p: Props) {
  const building = p.buildings[0];
  const floorGapPer = 1.8 * p.explode; // extra metres between floors when exploded
  const yOffsetFor = (floorNumber: number) => floorNumber * floorGapPer; // basements move down, floors move up

  const maxH = building ? building.num_floors * building.floor_height_m : 30;
  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[40, 80, 30]} intensity={1.3} castShadow />
      <directionalLight position={[-30, 20, -40]} intensity={0.5} color="#22e8c8" />
      <Grid args={[200, 200]} cellSize={5} sectionSize={25} fadeDistance={220} cellColor="#1a2a33" sectionColor="#1f5e58" position={[0, -0.02, 0]} />
      <GroundPolygon ring={p.parcelLocal} color="#123b36" y={0.01} />
      {building && <GroundPolygon ring={building.footprint_local} color="#1c2331" y={0.03} />}

      {building?.floors.map((f) => {
        const dimmed = p.focusFloor !== null && p.focusFloor !== f.floor_number;
        const yOff = yOffsetFor(f.floor_number);
        return (
          <group key={f.id}>
            {/* floor slab */}
            <mesh position={[0, f.base_elevation_m + yOff, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <shapeGeometry args={[ringToShape(building.footprint_local)]} />
              <meshStandardMaterial color={f.floor_number < 0 ? "#2a3446" : "#3b4a5e"} transparent opacity={dimmed ? 0.05 : 0.55} side={THREE.DoubleSide} />
            </mesh>
            {!dimmed && (
              <Html distanceFactor={70} position={[building.footprint_local[0][0] - 4, f.base_elevation_m + yOff + f.height_m / 2, -building.footprint_local[0][1]]} style={{ pointerEvents: "none" }}>
                <div className="glass whitespace-nowrap rounded px-1.5 py-0.5 font-mono text-[10px]" style={{ color: "#9fb0c3" }}>
                  {f.floor_number < 0 ? `B${-f.floor_number}` : f.floor_number === 0 ? "G" : `F${f.floor_number}`} · {f.floor_ulpin.split("-").slice(5, 7).join("-")}
                </div>
              </Html>
            )}
            {f.units.map((u) => (
              <UnitBox
                key={u.id}
                unit={u}
                yOffset={yOff}
                selected={p.selectedUlpin === u.unit_ulpin}
                conflict={p.conflictUlpins.has(u.unit_ulpin)}
                dimmed={dimmed}
                onClick={() => p.onSelectUnit(u)}
                onWarningClick={p.onWarningClick}
              />
            ))}
          </group>
        );
      })}

      {p.layers.map((l) => <LayerBox key={l.id} layer={l} />)}

      <OrbitControls makeDefault target={[0, maxH / 2.2, 0]} maxPolarAngle={Math.PI * 0.55} />
    </>
  );
}

export default function Building3D(props: Props) {
  const b = props.buildings[0];
  const maxH = b ? b.num_floors * b.floor_height_m : 30;
  return (
    <Canvas camera={{ position: [70 + maxH * 0.6, maxH * 0.9 + 20, 75 + maxH * 0.6], fov: 45, near: 0.1, far: 2000 }} shadows dpr={[1, 1.5]}>
      <color attach="background" args={["#0a0e14"]} />
      <fog attach="fog" args={["#0a0e14", 160, 420]} />
      <Scene {...props} />
    </Canvas>
  );
}
