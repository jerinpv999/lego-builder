import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { MIN_N, MAX_N, serializeStructure, parseStructure, loadSaved, autosave } from "./structureIO";
import { BH, SH, studGeo, TYPES, GROUPS, buildPiece, stackInfo, settle } from "./legoPieces";

/* ---------- constants ---------- */
const DEFAULT_N = 20; // starting baseplate: N x N studs
const STEP = 4; // each expand/shrink adds or removes this many studs per side

const COLORS = [
  { name: "Red", hex: "#D01012" },
  { name: "Blue", hex: "#0055BF" },
  { name: "Yellow", hex: "#F2CD37" },
  { name: "Green", hex: "#237841" },
  { name: "Orange", hex: "#FE8A18" },
  { name: "Lime", hex: "#A6CA55" },
  { name: "White", hex: "#F4F4F4" },
  { name: "Black", hex: "#1B2A34" },
];

/* ---------- component ---------- */
export default function LegoBuilder() {
  const mountRef = useRef(null);
  const three = useRef({});
  const live = useRef({});
  const [init] = useState(loadSaved); // restored from the browser autosave, if any
  const idCounter = useRef(init ? init.pieces.length : 0);
  const fileRef = useRef(null);
  const [note, setNote] = useState("");

  const [N, setN] = useState(init ? init.N : DEFAULT_N);
  const [bricks, setBricks] = useState(init ? init.pieces : []);
  const [color, setColor] = useState(COLORS[0].hex);
  const [typeKey, setTypeKey] = useState("b2x4");
  const [rot, setRot] = useState(0);
  const [mode, setMode] = useState("build");

  const type = TYPES[typeKey];
  const [w, d] = rot % 2 ? [type.d, type.w] : [type.w, type.d];
  live.current = { N, bricks, color, type, rot, w, d, mode };

  /* scene setup (once) */
  useEffect(() => {
    const el = mountRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#CFE3F0");

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight("#ffffff", "#8aa1b4", 0.8));
    const sun = new THREE.DirectionalLight("#ffffff", 0.9);
    sun.position.set(14, 26, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 70 });
    scene.add(sun);

    /* baseplate lives in a group; it is rebuilt whenever N changes */
    const base = new THREE.Group();
    scene.add(base);

    const brickGroup = new THREE.Group();
    scene.add(brickGroup);

    /* orbit camera (hand-rolled so no extra imports are needed) */
    const orbit = { theta: 0.8, phi: 0.95, radius: 30 };
    const updateCamera = () => {
      const { theta, phi, radius } = orbit;
      camera.position.set(
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.cos(theta)
      );
      camera.lookAt(0, 1.5, 0);
    };
    updateCamera();

    const resize = () => {
      const r = el.getBoundingClientRect();
      renderer.setSize(r.width, r.height);
      camera.aspect = r.width / r.height;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    /* picking */
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const pick = (e) => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      return ray.intersectObjects([base, brickGroup], true)[0] || null;
    };

    const updateHover = (e) => {
      const { N, bricks, w, d, mode } = live.current;
      const ghost = three.current.ghost;
      const hit = pick(e);
      if (!hit || mode !== "build") {
        three.current.hover = null;
        if (ghost) ghost.visible = false;
        return;
      }
      const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
      const p = hit.point.clone().addScaledVector(n, 0.1);
      const x = Math.min(Math.max(Math.round(p.x + N / 2 - w / 2), 0), N - w);
      const z = Math.min(Math.max(Math.round(p.z + N / 2 - d / 2), 0), N - d);
      const { lvl: y, blocked } = stackInfo(bricks, x, z, w, d);
      three.current.hover = { x, z, y, ok: !blocked };
      if (ghost) {
        ghost.position.set(x - N / 2, y * BH, z - N / 2);
        ghost.visible = true;
        three.current.ghostMat.color.set(blocked ? "#FF4D4D" : live.current.color);
      }
    };

    let down = null;
    const dom = renderer.domElement;
    dom.style.touchAction = "none";
    const onDown = (e) => {
      down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false };
      dom.setPointerCapture(e.pointerId);
    };
    const onMove = (e) => {
      if (down) {
        if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) down.moved = true;
        if (down.moved) {
          orbit.theta -= (e.clientX - down.lx) * 0.008;
          orbit.phi = Math.min(1.5, Math.max(0.2, orbit.phi - (e.clientY - down.ly) * 0.008));
          updateCamera();
        }
        down.lx = e.clientX;
        down.ly = e.clientY;
        if (down.moved && three.current.ghost) three.current.ghost.visible = false;
        return;
      }
      updateHover(e);
    };
    const onUp = (e) => {
      const wasClick = down && !down.moved;
      down = null;
      if (!wasClick) return;
      const { mode, color, type, rot, w, d } = live.current;
      if (mode === "remove") {
        const hit = pick(e);
        const id = hit && hit.object.userData.id;
        if (id) setBricks((prev) => settle(prev.filter((b) => b.id !== id)));
      } else {
        updateHover(e);
        const h = three.current.hover;
        if (h && h.ok)
          setBricks((prev) => {
            const { lvl, blocked } = stackInfo(prev, h.x, h.z, w, d);
            if (blocked) return prev;
            return [
              ...prev,
              { id: ++idCounter.current, type: type.key, rot, x: h.x, z: h.z, y: lvl, w, d, h: type.h, top: type.top, color },
            ];
          });
      }
    };
    const onLeave = () => {
      if (three.current.ghost) three.current.ghost.visible = false;
    };
    const onWheel = (e) => {
      e.preventDefault();
      orbit.radius = Math.min(40 + live.current.N * 1.5, Math.max(10, orbit.radius + e.deltaY * 0.02));
      updateCamera();
    };
    const onKey = (e) => {
      if (e.key.toLowerCase() === "r") setRot((r) => (r + 1) % 4);
    };
    dom.addEventListener("pointerdown", onDown);
    dom.addEventListener("pointermove", onMove);
    dom.addEventListener("pointerup", onUp);
    dom.addEventListener("pointerleave", onLeave);
    dom.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);

    let raf;
    const loop = () => {
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    loop();

    three.current = { scene, brickGroup, base, sun, orbit, updateCamera, ghost: null, hover: null };

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("keydown", onKey);
      dom.removeEventListener("pointerdown", onDown);
      dom.removeEventListener("pointermove", onMove);
      dom.removeEventListener("pointerup", onUp);
      dom.removeEventListener("pointerleave", onLeave);
      dom.removeEventListener("wheel", onWheel);
      renderer.dispose();
      el.removeChild(dom);
    };
  }, []);

  /* rebuild placed bricks when state changes */
  useEffect(() => {
    const { brickGroup } = three.current;
    if (!brickGroup) return;
    brickGroup.clear();
    for (const b of bricks) {
      const g = buildPiece(TYPES[b.type], b.color, b.id, b.rot);
      g.position.set(b.x - N / 2, b.y * BH, b.z - N / 2);
      brickGroup.add(g);
    }
  }, [bricks, N]);

  /* rebuild baseplate (and fit lights + camera) when its size changes */
  useEffect(() => {
    const t = three.current;
    if (!t.base) return;
    t.base.children.forEach((c) => c.geometry && c.geometry.dispose());
    t.base.clear();
    const mat = new THREE.MeshStandardMaterial({ color: "#3C8D4E", roughness: 0.6 });
    const plate = new THREE.Mesh(new THREE.BoxGeometry(N, 0.4, N), mat);
    plate.position.y = -0.2;
    plate.receiveShadow = true;
    const studs = new THREE.InstancedMesh(studGeo, mat, N * N);
    const tmp = new THREE.Object3D();
    let i = 0;
    for (let x = 0; x < N; x++)
      for (let z = 0; z < N; z++) {
        tmp.position.set(x - N / 2 + 0.5, 0.2 + SH / 2, z - N / 2 + 0.5);
        tmp.updateMatrix();
        studs.setMatrixAt(i++, tmp.matrix);
      }
    studs.raycast = () => {};
    studs.receiveShadow = true;
    t.base.add(plate, studs);

    const half = N / 2 + 2;
    Object.assign(t.sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half, far: 40 + N * 2 });
    t.sun.shadow.camera.updateProjectionMatrix();
    t.sun.position.set(N * 0.7, N * 1.3, N * 0.5);
    t.orbit.radius = Math.max(t.orbit.radius, N * 1.5);
    t.updateCamera();
  }, [N]);

  /* grow or shrink the plate, keeping existing bricks centered */
  const shift = (delta) => (b) => ({ ...b, x: b.x + delta / 2, z: b.z + delta / 2 });
  const fits = (delta) => {
    const nn = N + delta;
    if (nn < MIN_N || nn > MAX_N) return false;
    return bricks.map(shift(delta)).every((b) => b.x >= 0 && b.z >= 0 && b.x + b.w <= nn && b.z + b.d <= nn);
  };
  const resizePlate = (delta) => {
    if (!fits(delta)) return;
    setN(N + delta);
    setBricks((p) => p.map(shift(delta)));
  };

  /* rebuild ghost preview when the selection changes */
  useEffect(() => {
    const t = three.current;
    if (!t.scene) return;
    if (t.ghost) t.scene.remove(t.ghost);
    if (t.ghostMat) t.ghostMat.dispose();
    t.ghostMat = new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.55 });
    const g = buildPiece(type, color, 0, rot, t.ghostMat);
    g.visible = false;
    t.scene.add(g);
    t.ghost = g;
  }, [typeKey, rot, color, mode]);

  /* keep the creation in the browser so a refresh doesn't lose it */
  useEffect(() => autosave(N, bricks), [N, bricks]);

  const saveJson = () => {
    const blob = new Blob([serializeStructure(N, bricks)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lego-structure.json";
    a.click();
    URL.revokeObjectURL(url);
    setNote(`Saved ${bricks.length} piece${bricks.length === 1 ? "" : "s"} to lego-structure.json`);
  };
  const loadJson = async (e) => {
    const file = e.target.files[0];
    e.target.value = ""; // lets the same file be chosen again
    if (!file) return;
    try {
      const { N: n, pieces } = parseStructure(await file.text());
      idCounter.current = pieces.length;
      setN(n);
      setBricks(pieces);
      setNote(`Loaded ${pieces.length} piece${pieces.length === 1 ? "" : "s"}`);
    } catch (err) {
      setNote("Couldn't load: " + err.message);
    }
  };

  /* ---------- UI ---------- */
  const btn = (active) => ({
    padding: "8px 12px",
    borderRadius: 6,
    border: "2px solid " + (active ? "#FFD23F" : "#33466b"),
    background: active ? "#FFD23F" : "transparent",
    color: active ? "#14213D" : "#E8EEF8",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  });

  return (
    <div style={{ display: "flex", height: "100vh", minHeight: 520, fontFamily: "'Trebuchet MS', 'Segoe UI', sans-serif" }}>
      <style>{`.lb button:focus-visible{outline:3px solid #fff;outline-offset:2px}`}</style>
      <aside className="lb" style={{ width: 232, background: "#14213D", color: "#E8EEF8", padding: 16, display: "flex", flexDirection: "column", gap: 18, overflowY: "auto" }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Brick Builder</h1>

        <div style={{ display: "flex", gap: 8 }}>
          <button style={btn(mode === "build")} onClick={() => setMode("build")}>Build</button>
          <button style={btn(mode === "remove")} onClick={() => setMode("remove")}>Remove</button>
        </div>

        {GROUPS.map((grp) => (
          <section key={grp.title}>
            <div style={{ fontSize: 14, marginBottom: 8 }}>{grp.title}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {grp.keys.map((k) => (
                <button key={k} style={btn(typeKey === k)} onClick={() => { setTypeKey(k); setMode("build"); }}>
                  {TYPES[k].name}
                </button>
              ))}
            </div>
          </section>
        ))}
        <button style={{ ...btn(false), width: "100%" }} onClick={() => setRot((r) => (r + 1) % 4)}>
          Rotate (R)
        </button>

        <section>
          <div style={{ fontSize: 14, marginBottom: 8 }}>Color</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {COLORS.map((c) => (
              <button
                key={c.hex}
                aria-label={c.name}
                title={c.name}
                onClick={() => { setColor(c.hex); setMode("build"); }}
                style={{ height: 36, borderRadius: 6, background: c.hex, cursor: "pointer", border: color === c.hex ? "3px solid #FFD23F" : "3px solid transparent" }}
              />
            ))}
          </div>
        </section>

        <section>
          <div style={{ fontSize: 14, marginBottom: 8 }}>Baseplate: {N}×{N} studs</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ ...btn(false), flex: 1, opacity: fits(STEP) ? 1 : 0.4 }} onClick={() => resizePlate(STEP)} disabled={!fits(STEP)}>Expand</button>
            <button style={{ ...btn(false), flex: 1, opacity: fits(-STEP) ? 1 : 0.4 }} onClick={() => resizePlate(-STEP)} disabled={!fits(-STEP)}>Shrink</button>
          </div>
        </section>

        <section>
          <div style={{ fontSize: 14, marginBottom: 8 }}>Save / load</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ ...btn(false), flex: 1 }} onClick={saveJson}>Save JSON</button>
            <button style={{ ...btn(false), flex: 1 }} onClick={() => fileRef.current.click()}>Load JSON</button>
          </div>
          <input ref={fileRef} type="file" accept=".json,application/json" onChange={loadJson} style={{ display: "none" }} />
          <div role="status" style={{ fontSize: 12, marginTop: 6, color: "#A9B8D4", minHeight: 16 }}>{note}</div>
        </section>

        <section style={{ display: "flex", gap: 8 }}>
          <button style={btn(false)} onClick={() => setBricks((p) => p.slice(0, -1))} disabled={!bricks.length}>Undo</button>
          <button style={btn(false)} onClick={() => setBricks([])} disabled={!bricks.length}>Clear</button>
        </section>

        <p style={{ fontSize: 13, lineHeight: 1.5, margin: "auto 0 0", color: "#A9B8D4" }}>
          Click to place a brick. Drag to orbit, scroll to zoom. {bricks.length} piece{bricks.length === 1 ? "" : "s"} placed. Your build is also autosaved in this browser.
        </p>
      </aside>
      <div ref={mountRef} style={{ flex: 1, minWidth: 0, cursor: mode === "remove" ? "crosshair" : "pointer" }} />
    </div>
  );
}
