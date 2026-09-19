"use client";
/**
 * CesiumJS globe. With a Cesium ion token (NEXT_PUBLIC_CESIUM_TOKEN) it loads real
 * world terrain + OSM Buildings as context; without one it falls back to plain
 * OpenStreetMap imagery on the ellipsoid so the demo still runs.
 *
 * Our own parcels/buildings are drawn as Cesium entities (one extruded polygon per
 * floor) at their real coordinates. Those entities — not the OSM context buildings —
 * are what clicks, ULPIN lookups and the builder's drawing tool attach to.
 */
import { useEffect, useRef, type MutableRefObject } from "react";
import { loadCesium } from "@/lib/loadCesium";
import { USAGE_COLORS, type GeoPolygon, type MarketFeature, type ParcelFeature, type ParcelModel } from "@/lib/api";

export type CesiumHandle = {
  flyToParcel: (parcelId: number) => void;
  getViewRectangle: () => [number, number, number, number] | null; // west, south, east, north (degrees)
};

export type CesiumStatus = { ready: boolean; token: boolean; terrain: boolean; osmBuildings: boolean; error?: string; note?: string };

type Props = {
  features: ParcelFeature[];
  models: Record<number, ParcelModel>;
  selectedId: number | null;
  onSelect: (parcelId: number, floorNumber: number | null) => void;
  drawing: boolean;
  onDrawComplete: (ring: number[][]) => void;
  candidates: GeoPolygon[];
  showOsmBuildings: boolean;
  onStatus: (s: CesiumStatus) => void;
  handleRef: MutableRefObject<CesiumHandle | null>; // next/dynamic does not forward refs, so we hand the handle over via a prop
  market?: MarketFeature[];                          // real projects, informational only
  onSelectMarket?: (m: MarketFeature) => void;
};

export default function CesiumMap(props: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const cesiumRef = useRef<any>(null);
  const osmRef = useRef<any>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const drawPoints = useRef<any[]>([]);
  const drawEntities = useRef<any[]>([]);
  const groundHeights = useRef<Record<number, number>>({}); // parcel id -> terrain height (m) at its centroid
  const flown = useRef(false); // camera flies to the parcels once, as soon as they are available

  // ---- create the viewer once ---------------------------------------------------
  useEffect(() => {
    let destroyed = false;
    let attempt = 0; // 0 = full, 1 = reduced effects, 2 = reduced effects without OSM Buildings, 3 = give up
    const start = async () => {
      let Cesium: any;
      try { Cesium = await loadCesium(); } catch (e: any) { propsRef.current.onStatus({ ready: false, token: false, terrain: false, osmBuildings: false, error: String(e.message ?? e) }); return; }
      if (destroyed || !containerRef.current) return;
      cesiumRef.current = Cesium;
      // trim: a key pasted into a hosting dashboard with a trailing line break is rejected by Cesium ion as INVALID_TOKEN
      const token = (process.env.NEXT_PUBLIC_CESIUM_TOKEN || "").trim().replace(/^["']|["']$/g, "");
      // Older Intel GPUs on Mesa (e.g. HD 2500/4000) fail to compile some of Cesium's WebGL 2 shaders
      // (the sun glow shader is the first to go). Detect them and start in the conservative mode.
      const renderer = (() => { try { const c = document.createElement("canvas"); const g: any = c.getContext("webgl2") || c.getContext("webgl"); const d = g?.getExtension("WEBGL_debug_renderer_info"); return d ? String(g.getParameter(d.UNMASKED_RENDERER_WEBGL)) : ""; } catch { return ""; } })();
      const fragileGpu = /mesa|intel\(r\) hd graphics [2-5]\d{3}|ivb|hsw|swiftshader/i.test(renderer);
      if (attempt === 0 && fragileGpu) attempt = 1;   // start with the decorative shaders off
      const status: CesiumStatus = { ready: false, token: !!token, terrain: false, osmBuildings: false };
      if (token) Cesium.Ion.defaultAccessToken = token;

      const opts: any = {
        // accept software / low-power WebGL (embedded previews, VMs) instead of refusing to start
        contextOptions: { webgl: { failIfMajorPerformanceCaveat: false, powerPreference: "default", alpha: false } },
        showRenderLoopErrors: false, // we handle scene.renderError ourselves (see below)
        msaaSamples: attempt >= 1 ? 1 : 4,
        animation: false, timeline: false, geocoder: false, homeButton: false, sceneModePicker: false,
        baseLayerPicker: false, navigationHelpButton: false, infoBox: false, selectionIndicator: false,
        fullscreenButton: false, shouldAnimate: false,
      };
      let terrain: any = null;
      if (token) {
        terrain = Cesium.Terrain.fromWorldTerrain();
        opts.terrain = terrain;
        status.terrain = true;
      } else {
        opts.baseLayer = new Cesium.ImageryLayer(new Cesium.OpenStreetMapImageryProvider({ url: "https://tile.openstreetmap.org/" }));
      }
      let viewer: any;
      try {
        viewer = new Cesium.Viewer(containerRef.current, opts);
      } catch (e: any) {
        if (containerRef.current) containerRef.current.innerHTML = "";   // drop Cesium's own pink error panel
        propsRef.current.onStatus({ ...status, error: `WebGL unavailable in this browser (${String(e?.message ?? e).split("\n")[0].slice(0, 120)})` });
        return;
      }
      viewerRef.current = viewer;
      (window as any).__tribhoomiViewer = viewer; // handy for debugging in the browser console
      if (attempt === 1) status.note = "reduced effects for this GPU";
      if (attempt >= 2) status.note = "reduced effects, context buildings off";
      if (attempt >= 1 || fragileGpu) {
        // drop the decorative shaders that fragile drivers choke on; the data is unaffected
        const sc = viewer.scene;
        if (sc.sun) sc.sun.show = false;
        if (sc.moon) sc.moon.show = false;
        if (sc.skyAtmosphere) sc.skyAtmosphere.show = false;
        if (sc.skyBox) sc.skyBox.show = false;
        sc.fog.enabled = false;
        sc.globe.showGroundAtmosphere = false;
        sc.globe.enableLighting = false;
        sc.postProcessStages.fxaa.enabled = false;
        sc.highDynamicRange = false;
        sc.logarithmicDepthBuffer = false;
      }

      // Some GPU drivers (e.g. older Intel/Mesa) fail to compile one of Cesium's shaders. Instead of
      // Cesium's "Rendering has stopped" panel, retry with progressively simpler settings.
      viewer.scene.renderError.addEventListener((_scene: any, err: any) => {
        const msg = String(err?.message ?? err).split("\n")[0].slice(0, 160);
        viewer.useDefaultRenderLoop = false;
        setTimeout(() => {
          try { viewer.destroy(); } catch {}
          viewerRef.current = null; osmRef.current = null;
          if (containerRef.current) containerRef.current.innerHTML = "";
          attempt = attempt + 1;
          if (attempt <= 2 && !destroyed) { setTimeout(start, 1500); return; }   // give the browser a moment after a context loss
          propsRef.current.onStatus({ ready: false, token: !!token, terrain: false, osmBuildings: false, error: `Your GPU driver rejected Cesium's shaders (${msg})` });
        }, 0);
      });
      if (terrain) {
        // viewer.terrainProvider stays the flat ellipsoid until world terrain has actually loaded;
        // sampling heights before that would bury our buildings ~200 m under the ground.
        await new Promise<void>((resolve) => {
          if (terrain.ready) return resolve();
          terrain.readyEvent.addEventListener(() => resolve());
          terrain.errorEvent.addEventListener((e: any) => { status.error = `Terrain failed: ${e?.message ?? e}`; status.terrain = false; resolve(); });
        });
        if (destroyed) return;
      }
      viewer.scene.globe.depthTestAgainstTerrain = true;
      viewer.scene.screenSpaceCameraController.enableCollisionDetection = true;
      (viewer.cesiumWidget.creditContainer as HTMLElement).style.fontSize = "9px";

      if (token && attempt <= 1) {
        try {
          const osm = await Cesium.createOsmBuildingsAsync({
            style: new Cesium.Cesium3DTileStyle({ color: "color('#cbd5e1', 0.55)" }),
          });
          if (destroyed) return;
          viewer.scene.primitives.add(osm);
          osm.show = propsRef.current.showOsmBuildings;
          osmRef.current = osm;
          status.osmBuildings = true;
        } catch (e: any) {
          status.error = `OSM Buildings failed: ${e?.message ?? e}`;
        }
      }

      // ---- click handling (select or draw) ----
      const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      const pickGround = (pos: any) => {
        const ray = viewer.camera.getPickRay(pos);
        return (ray && viewer.scene.globe.pick(ray, viewer.scene)) || viewer.camera.pickEllipsoid(pos, viewer.scene.globe.ellipsoid);
      };
      handler.setInputAction((click: any) => {
        const p = propsRef.current;
        if (p.drawing) {
          const cart = pickGround(click.position);
          if (!cart) return;
          drawPoints.current.push(cart);
          drawEntities.current.push(viewer.entities.add({
            position: cart, point: { pixelSize: 8, color: Cesium.Color.fromCssColorString("#f28c28"), outlineColor: Cesium.Color.WHITE, outlineWidth: 2, disableDepthTestDistance: Number.POSITIVE_INFINITY },
          }));
          if (drawPoints.current.length === 1) {
            drawEntities.current.push(viewer.entities.add({
              polygon: {
                hierarchy: new Cesium.CallbackProperty(() => new Cesium.PolygonHierarchy(drawPoints.current.slice()), false),
                material: Cesium.Color.fromCssColorString("#f28c28").withAlpha(0.35),
                classificationType: Cesium.ClassificationType.TERRAIN,
              },
              polyline: {
                positions: new Cesium.CallbackProperty(() => drawPoints.current.length > 1 ? [...drawPoints.current, drawPoints.current[0]] : drawPoints.current.slice(), false),
                width: 3, material: Cesium.Color.fromCssColorString("#ea580c"), clampToGround: true,
              },
            }));
          }
          return;
        }
        const picked = viewer.scene.pick(click.position);
        const ent = picked?.id;
        if (ent?.properties?.marketId) {
          const m = (p.market ?? []).find((x) => x.id === ent.properties.marketId.getValue());
          if (m) p.onSelectMarket?.(m);
          return;
        }
        if (ent?.properties?.parcelId) {
          const parcelId = ent.properties.parcelId.getValue();
          const fl = ent.properties.floorNumber ? ent.properties.floorNumber.getValue() : null;
          p.onSelect(parcelId, fl);
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

      const finish = () => {
        const p = propsRef.current;
        if (!p.drawing || drawPoints.current.length < 3) return;
        const ring = drawPoints.current.map((c) => {
          const g = Cesium.Cartographic.fromCartesian(c);
          return [Number(Cesium.Math.toDegrees(g.longitude).toFixed(7)), Number(Cesium.Math.toDegrees(g.latitude).toFixed(7))];
        });
        ring.push(ring[0]);
        clearDraw();
        p.onDrawComplete(ring);
      };
      handler.setInputAction(finish, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
      handler.setInputAction(finish, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

      status.ready = true;
      propsRef.current.onStatus(status);
      console.info(`[cesium] ready attempt=${attempt} features=${propsRef.current.features.length}`);
      groundHeights.current = {};
      flown.current = false;
      await redraw();
      if (propsRef.current.features.length) flyToAll();
    };
    start();

    const clearDraw = () => {
      const v = viewerRef.current;
      drawEntities.current.forEach((e) => v?.entities.remove(e));
      drawEntities.current = [];
      drawPoints.current = [];
    };

    return () => {
      destroyed = true;
      try { viewerRef.current?.destroy(); } catch {}
      viewerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- (re)draw our entities whenever data changes ---------------------------------
  const groundHeight = async (f: ParcelFeature): Promise<number> => {
    const Cesium = cesiumRef.current, viewer = viewerRef.current;
    if (groundHeights.current[f.id] !== undefined) return groundHeights.current[f.id];
    let h = 0;
    try {
      const tp = viewer.terrainProvider;
      if (tp && !(tp instanceof Cesium.EllipsoidTerrainProvider)) {
        const [c] = await Cesium.sampleTerrainMostDetailed(tp, [Cesium.Cartographic.fromDegrees(f.properties.centroid.lng, f.properties.centroid.lat)]);
        h = c?.height ?? 0;
      }
    } catch { h = 0; }
    groundHeights.current[f.id] = h;
    return h;
  };

  const redraw = async () => {
    const Cesium = cesiumRef.current, viewer = viewerRef.current;
    if (!Cesium || !viewer) return;
    const p = propsRef.current;
    // Absolute heights = terrain height at the parcel + floor elevation. Sampling once per parcel
    // is deterministic, unlike per-entity RELATIVE_TO_GROUND clamping which waits on tile loads.
    const heights: Record<number, number> = {};
    for (const f of p.features) heights[f.id] = await groundHeight(f);
    if (!viewerRef.current) return;
    // keep drawing sketch entities, drop everything else
    viewer.entities.values.slice().forEach((e: any) => { if (!drawEntities.current.includes(e)) viewer.entities.remove(e); });

    const landColor: Record<string, string> = { residential: "#2563eb", commercial: "#d97706", mixed: "#7c3aed" };
    for (const f of p.features) {
      const flat = f.geometry.coordinates[0].flat();
      const isSel = f.id === p.selectedId;
      viewer.entities.add({
        properties: { parcelId: f.id, kind: "parcel" },
        polygon: {
          hierarchy: Cesium.Cartesian3.fromDegreesArray(flat),
          material: Cesium.Color.fromCssColorString(landColor[f.properties.land_use] ?? "#334155").withAlpha(isSel ? 0.5 : 0.28),
          classificationType: Cesium.ClassificationType.TERRAIN,
        },
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray([...flat, flat[0], flat[1]]),
          width: isSel ? 5 : 2.5, material: Cesium.Color.fromCssColorString(landColor[f.properties.land_use] ?? "#334155"), clampToGround: true,
        },
      });

      const model = p.models[f.id];
      const b = model?.buildings[0];
      if (!b) continue;
      const fp = (b as any).footprint?.coordinates?.[0] as number[][] | undefined;
      if (!fp) continue;
      const fpFlat = fp.flat();
      const g = heights[f.id] ?? 0;
      let top = 0, flagged = 0;
      for (const fl of b.floors) {
        if (fl.floor_number < 0) continue;
        const usage = fl.units[0]?.usage_type ?? "residential";
        const bad = fl.units.filter((u) => u.flags?.has_unapproved_change || u.flags?.has_open_dispute).length;
        const pend = fl.units.filter((u) => u.flags?.has_pending_request).length;
        flagged += bad;
        const base = fl.base_elevation_m, h = fl.height_m;
        top = Math.max(top, base + h);
        const css = bad ? "#dc2626" : pend ? "#f59e0b" : USAGE_COLORS[usage] ?? "#64748b";
        viewer.entities.add({
          properties: { parcelId: f.id, floorNumber: fl.floor_number, floorUlpin: fl.floor_ulpin, kind: "floor" },
          polygon: {
            hierarchy: Cesium.Cartesian3.fromDegreesArray(fpFlat),
            height: g + base, extrudedHeight: g + base + h,
            material: Cesium.Color.fromCssColorString(css).withAlpha(isSel ? 1 : 0.9),
            outline: true, outlineColor: Cesium.Color.fromCssColorString(bad ? "#fca5a5" : pend ? "#fde68a" : isSel ? "#22e8c8" : "#0a0e14").withAlpha(0.9),
          },
        });
      }
      const c = f.properties.centroid;
      viewer.entities.add({
        properties: { parcelId: f.id, kind: "label" },
        position: Cesium.Cartesian3.fromDegrees(c.lng, c.lat, g + top + 6),
        label: {
          text: `${f.properties.name}\n${f.properties.ulpin_2d}${flagged ? `\n⚠ ${flagged} unit(s) flagged` : ""}`,
          font: "12px 'JetBrains Mono', monospace", fillColor: Cesium.Color.fromCssColorString(flagged ? "#fecaca" : "#22e8c8"), showBackground: true,
          backgroundColor: Cesium.Color.fromCssColorString(flagged ? "#3b0a0a" : "#0a0e14").withAlpha(0.9),
          backgroundPadding: new Cesium.Cartesian2(7, 5),
          disableDepthTestDistance: Number.POSITIVE_INFINITY, horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM, scaleByDistance: new Cesium.NearFarScalar(200, 1.1, 3000, 0.5),
        },
      });
    }
    for (const m of p.market ?? []) {
      const [lng, lat] = m.geometry.coordinates;
      viewer.entities.add({
        properties: { marketId: m.id, kind: "market" },
        position: Cesium.Cartesian3.fromDegrees(lng, lat, (heights[-1] ?? Object.values(heights)[0] ?? 0) + 2),
        point: { pixelSize: 9, color: Cesium.Color.fromCssColorString("#64748b"), outlineColor: Cesium.Color.fromCssColorString("#cbd5e1"), outlineWidth: 1.5, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: Number.POSITIVE_INFINITY },
        label: { text: m.properties.project_name, font: "11px system-ui", fillColor: Cesium.Color.fromCssColorString("#cbd5e1"), showBackground: true,
                 backgroundColor: Cesium.Color.fromCssColorString("#1f2937").withAlpha(0.85), backgroundPadding: new Cesium.Cartesian2(5, 3),
                 pixelOffset: new Cesium.Cartesian2(0, -14), verticalOrigin: Cesium.VerticalOrigin.BOTTOM, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                 disableDepthTestDistance: Number.POSITIVE_INFINITY, scaleByDistance: new Cesium.NearFarScalar(500, 1.0, 40000, 0.55) },
      });
    }
    p.candidates.forEach((g, i) => {
      const flat = g.coordinates[0].flat();
      viewer.entities.add({
        properties: { kind: "candidate", index: i },
        polygon: { hierarchy: Cesium.Cartesian3.fromDegreesArray(flat), material: Cesium.Color.fromCssColorString("#fde047").withAlpha(0.4), classificationType: Cesium.ClassificationType.TERRAIN },
        polyline: { positions: Cesium.Cartesian3.fromDegreesArray([...flat, flat[0], flat[1]]), width: 3, material: Cesium.Color.fromCssColorString("#facc15"), clampToGround: true },
        position: Cesium.Cartesian3.fromDegrees(g.coordinates[0][0][0], g.coordinates[0][0][1]),
        label: { text: `AI #${i + 1}`, font: "12px system-ui", fillColor: Cesium.Color.BLACK, showBackground: true, backgroundColor: Cesium.Color.fromCssColorString("#fde047"), heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: Number.POSITIVE_INFINITY },
      });
    });
  };

  const flyToAll = () => {
    const Cesium = cesiumRef.current, viewer = viewerRef.current;
    const p = propsRef.current;
    if (!Cesium || !viewer || !p.features.length) return;
    const lngs = p.features.flatMap((f) => f.geometry.coordinates[0].map((c) => c[0]));
    const lats = p.features.flatMap((f) => f.geometry.coordinates[0].map((c) => c[1]));
    const cx = (Math.min(...lngs) + Math.max(...lngs)) / 2, cy = (Math.min(...lats) + Math.max(...lats)) / 2;
    const g = Object.values(groundHeights.current)[0] ?? 0;
    // parcels may be kilometres apart (Greater Noida / Noida / Ghaziabad): raise the camera to fit them all
    const spanM = Math.max((Math.max(...lngs) - Math.min(...lngs)) * 97_500, (Math.max(...lats) - Math.min(...lats)) * 111_320);
    const alt = Math.max(420, spanM * 1.15);
    flown.current = true;
    console.info(`[cesium] flyTo ${cx.toFixed(4)},${cy.toFixed(4)} alt=${Math.round(g + alt)} m`);
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(cx, cy - alt * 0.0000065, g + alt),
      orientation: { heading: 0, pitch: Cesium.Math.toRadians(-38), roll: 0 }, duration: 2.5,
    });
  };

  useEffect(() => {
    (async () => { await redraw(); if (!flown.current && props.features.length && viewerRef.current) flyToAll(); })();
    /* eslint-disable-line react-hooks/exhaustive-deps */
  }, [props.features, props.models, props.selectedId, props.candidates, props.market]);
  useEffect(() => { if (osmRef.current) osmRef.current.show = props.showOsmBuildings; }, [props.showOsmBuildings]);
  useEffect(() => {
    // leaving draw mode discards an unfinished sketch
    if (!props.drawing && viewerRef.current) {
      drawEntities.current.forEach((e) => viewerRef.current.entities.remove(e));
      drawEntities.current = []; drawPoints.current = [];
    }
    if (viewerRef.current) viewerRef.current.scene.canvas.style.cursor = props.drawing ? "crosshair" : "default";
  }, [props.drawing]);

  useEffect(() => { props.handleRef.current = handle; return () => { props.handleRef.current = null; }; /* eslint-disable-line react-hooks/exhaustive-deps */ }, []);
  const handle: CesiumHandle = {
    flyToParcel: (parcelId: number) => {
      const Cesium = cesiumRef.current, viewer = viewerRef.current;
      const f = propsRef.current.features.find((x) => x.id === parcelId);
      if (!Cesium || !viewer || !f) return;
      const m = propsRef.current.models[parcelId]?.buildings[0];
      const top = (m ? m.num_floors * m.floor_height_m : 20) + (groundHeights.current[parcelId] ?? 0);
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(f.properties.centroid.lng, f.properties.centroid.lat - 0.0012, top + 120),
        orientation: { heading: 0, pitch: Cesium.Math.toRadians(-40), roll: 0 }, duration: 1.4,
      });
    },
    getViewRectangle: () => {
      const Cesium = cesiumRef.current, viewer = viewerRef.current;
      if (!Cesium || !viewer) return null;
      const r = viewer.camera.computeViewRectangle(viewer.scene.globe.ellipsoid);
      if (!r) return null;
      return [Cesium.Math.toDegrees(r.west), Cesium.Math.toDegrees(r.south), Cesium.Math.toDegrees(r.east), Cesium.Math.toDegrees(r.north)];
    },
  };

  return <div ref={containerRef} className="h-full w-full" />;
}
