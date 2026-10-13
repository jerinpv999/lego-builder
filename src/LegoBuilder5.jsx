import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { getThumb, peekThumb } from "./thumbs";
import { planAnimation, playPreview, recordGif, recordVideo, downloadBlob } from "./animation";
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

const groupOf = {};
GROUPS.forEach((g) => g.keys.forEach((k) => (groupOf[k] = g.title)));

function Thumb({ k, color }) {
  const [src, setSrc] = useState(() => peekThumb(k, color));
  useEffect(() => {
    const hit = peekThumb(k, color);
    if (hit) return setSrc(hit);
    const id = setTimeout(() => setSrc(getThumb(k, color)), 0); // staggered so the panel stays responsive
    return () => clearTimeout(id);
  }, [k, color]);
  return <span className="th">{src && <img src={src} alt="" />}</span>;
}

const CSS = `
.lb{display:flex;flex-direction:column;height:100vh;min-height:520px;background:#0F1A33;color:#E8EEF8;font-family:'Trebuchet MS','Segoe UI',sans-serif;font-size:14px}
.lb *{box-sizing:border-box}
.lb button{font:inherit;color:inherit;cursor:pointer}
.lb button:disabled{opacity:.4;cursor:default}
.lb button:focus-visible,.lb input:focus-visible{outline:3px solid #fff;outline-offset:2px}
.lb.busy .tb,.lb.busy .side{pointer-events:none;opacity:.5}
.tb{display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;padding:8px 12px;background:#14213D;border-bottom:1px solid #2A3C63}
.brand{font-size:18px}
.grp{display:flex;align-items:center;gap:6px}
.seg{display:flex;align-items:center;border:2px solid #33466b;border-radius:8px;overflow:hidden}
.btn{padding:6px 12px;border-radius:6px;border:2px solid #33466b;background:transparent;font-weight:700}
.seg .btn{border:0;border-radius:0}
.btn:hover:not(:disabled){background:#22365e}
.btn.on{background:#FFD23F;border-color:#FFD23F;color:#14213D}
.btn.accent{border-color:#FFD23F}
.btn.sm{padding:3px 8px}
.lbl{color:#A9B8D4;font-size:12px}
.body{display:flex;flex:1;min-height:0}
.side{width:304px;flex-shrink:0;display:flex;flex-direction:column;background:#14213D;border-right:1px solid #2A3C63;min-height:0}
.sec{padding:10px 12px 4px}
.h{font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#A9B8D4;margin-bottom:6px}
.swatches{display:flex;flex-wrap:wrap;gap:8px}
.sw{width:30px;height:30px;border-radius:50%;border:3px solid transparent;box-shadow:inset 0 0 0 1px rgba(255,255,255,.35)}
.sw.on{border-color:#FFD23F}
.search{width:100%;padding:8px 10px;border-radius:8px;border:2px solid #33466b;background:#0F1A33;color:inherit;font:inherit}
.cats{display:flex;gap:6px;overflow-x:auto;padding:8px 12px;flex-shrink:0}
.chip{flex-shrink:0;white-space:nowrap;padding:4px 10px;border-radius:999px;border:2px solid #33466b;background:transparent;font-size:13px}
.chip.on{background:#FFD23F;border-color:#FFD23F;color:#14213D;font-weight:700}
.grid{flex:1;min-height:0;overflow-y:auto;padding:4px 12px 12px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;align-content:start}
.card{display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px 4px;border-radius:8px;border:2px solid #2A3C63;background:#1B2B4D}
.card:hover{border-color:#5B74A6}
.card.on{border-color:#FFD23F;background:#26396A}
.th{display:block;width:64px;height:64px}
.th img{display:block;width:100%;height:100%}
.nm{font-size:12px;text-align:center;line-height:1.2}
.empty{grid-column:1/-1;color:#A9B8D4;padding:16px 4px}
.stage{position:relative;flex:1;min-width:0}
.canvas{position:absolute;inset:0}
.status{position:absolute;left:12px;right:12px;bottom:12px;display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;padding:8px 12px;border-radius:10px;background:rgba(20,33,61,.92);pointer-events:none}
.status .dot{width:14px;height:14px;border-radius:50%;border:2px solid #fff}
.status .hint{margin-left:auto;color:#A9B8D4}
.drawer{position:absolute;top:12px;right:12px;width:290px;max-height:calc(100% - 90px);overflow-y:auto;padding:12px;border-radius:12px;background:#14213D;border:1px solid #33466b;box-shadow:0 8px 24px rgba(0,0,0,.35)}
.row{display:flex;gap:8px;margin-bottom:10px}
.row .btn{flex:1}
.shot{display:flex;align-items:center;gap:6px;margin-bottom:6px}
.shot span{flex:1}
.note{font-size:12px;color:#A9B8D4;margin:4px 0 0}
.toast{position:absolute;top:12px;left:50%;transform:translateX(-50%);max-width:80%;padding:8px 14px;border-radius:8px;background:#14213D;border:1px solid #FFD23F}
.bar{height:8px;background:#33466b;border-radius:4px;overflow:hidden}
.bar>div{height:100%;background:#FFD23F}
@media (max-width:760px){.body{flex-direction:column-reverse}.side{width:auto;height:44%;border-right:0;border-top:1px solid #2A3C63}.hint{display:none}.grid{grid-template-columns:repeat(4,1fr)}}
`;

/* ---------- component ---------- */
export default function LegoBuilder() {
  const mountRef = useRef(null);
  const three = useRef({});
  const live = useRef({});
  const [init] = useState(loadSaved); // restored from the browser autosave, if any
  const idCounter = useRef(init ? init.pieces.length : 0);
  const fileRef = useRef(null);
  const [note, setNote] = useState("");
  const [anim, setAnim] = useState("build"); // pieces: "build" or "finished"
  const [camMode, setCamMode] = useState("orbit"); // camera: "orbit" or "angles"
  const [shots, setShots] = useState([]); // saved camera angles: { theta, phi, radius }
  const [busy, setBusy] = useState(""); // "" | "gif" | "video" | "preview"
  const [progress, setProgress] = useState(0);
  const cancelRef = useRef({ v: false });
  const [cat, setCat] = useState(GROUPS[0].title); // piece category shown in the picker
  const [query, setQuery] = useState(""); // piece search text
  const [animOpen, setAnimOpen] = useState(false); // animation panel

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
      if (e.target.closest && e.target.closest("input,select,textarea")) return; // don't hijack typing
      const k = e.key.toLowerCase();
      if (k === "r") setRot((r) => (r + 1) % 4);
      else if (k === "b") setMode("build");
      else if (k === "x") setMode("remove");
      else if ((e.ctrlKey || e.metaKey) && k === "z") {
        e.preventDefault();
        setBricks((p) => p.slice(0, -1));
      }
    };
    dom.addEventListener("pointerdown", onDown);
    dom.addEventListener("pointermove", onMove);
    dom.addEventListener("pointerup", onUp);
    dom.addEventListener("pointerleave", onLeave);
    dom.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);

    let raf;
    const loop = () => {
      if (!three.current.recording) renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    loop();

    three.current = { scene, camera, renderer, brickGroup, base, sun, orbit, updateCamera, ghost: null, hover: null };

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
      g.userData.pid = b.id;
      g.userData.baseY = b.y * BH;
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

  useEffect(() => {
    if (!note) return;
    const id = setTimeout(() => setNote(""), 4000);
    return () => clearTimeout(id);
  }, [note]);

  /* camera angles */
  const VIEWS = { Front: { theta: 0, phi: 1.15 }, Side: { theta: Math.PI / 2, phi: 1.15 }, Top: { theta: 0, phi: 0.2 }, Iso: { theta: 0.8, phi: 0.95 } };
  const setView = (v) => {
    const t = three.current;
    Object.assign(t.orbit, v);
    t.updateCamera();
  };
  const addShot = () => setShots((p) => (p.length < 8 ? [...p, { ...three.current.orbit }] : p));

  /* preview the animation, or record it and download it */
  const exportAnimation = async (kind) => {
    const t = three.current;
    if (!bricks.length) return setNote("Place some pieces first.");
    if (camMode === "angles" && !shots.length) return setNote("Add at least one camera angle first.");
    const cancel = { v: false };
    cancelRef.current = cancel;
    const saved = { ...t.orbit };
    const order = new Map([...bricks].sort((a, b) => a.id - b.id).map((b, i) => [b.id, i]));
    const plan = planAnimation(bricks.length, anim, camMode, shots);
    const env = { ...t, startTheta: saved.theta, startPhi: saved.phi, startRadius: saved.radius };
    t.recording = true;
    t.renderer.domElement.style.pointerEvents = "none";
    setBusy(kind);
    setProgress(0);
    try {
      const run = { gif: recordGif, video: recordVideo, preview: playPreview }[kind];
      const out = await run(env, plan, order, setProgress, () => cancel.v);
      if (kind === "preview") setNote("");
      else if (out) {
        downloadBlob(out.blob, "lego-animation." + out.ext);
        setNote("Saved lego-animation." + out.ext);
      } else setNote("Export cancelled");
    } catch (err) {
      setNote("Couldn't export: " + err.message);
    } finally {
      Object.assign(t.orbit, saved);
      t.updateCamera();
      t.brickGroup.children.forEach((g) => {
        g.visible = true;
        g.position.y = g.userData.baseY;
      });
      t.renderer.domElement.style.pointerEvents = "";
      t.recording = false;
      setBusy("");
    }
  };

  /* ---------- UI ---------- */
  const q = query.trim().toLowerCase();
  const keys = q
    ? Object.keys(TYPES).filter((k) => (TYPES[k].name + " " + groupOf[k]).toLowerCase().includes(q))
    : GROUPS.find((g) => g.title === cat).keys;
  const colorName = (COLORS.find((c) => c.hex === color) || {}).name;
  const plan = planAnimation(bricks.length, anim, camMode, shots);
  const undo = () => setBricks((p) => p.slice(0, -1));
  const clearAll = () => {
    if (window.confirm("Remove all pieces?")) setBricks([]);
  };
  const on = (cond) => " btn" + (cond ? " on" : "");

  return (
    <div className={"lb" + (busy ? " busy" : "")}>
      <style>{CSS}</style>

      <header className="tb">
        <strong className="brand">Brick Builder</strong>

        <div className="seg" role="group" aria-label="Mode">
          <button className={on(mode === "build").trim()} onClick={() => setMode("build")} title="Place pieces (B)">Build</button>
          <button className={on(mode === "remove").trim()} onClick={() => setMode("remove")} title="Remove pieces (X)">Remove</button>
        </div>

        <div className="grp">
          <button className="btn" onClick={() => setRot((r) => (r + 1) % 4)} title="Rotate the piece (R)">Rotate</button>
          <button className="btn" onClick={undo} disabled={!bricks.length} title="Undo (Ctrl+Z)">Undo</button>
          <button className="btn" onClick={clearAll} disabled={!bricks.length} title="Remove everything">Clear</button>
        </div>

        <div className="grp">
          <span className="lbl">View</span>
          <div className="seg" role="group" aria-label="Camera view">
            {Object.entries(VIEWS).map(([name, v]) => (
              <button key={name} className="btn" onClick={() => setView(v)}>{name}</button>
            ))}
          </div>
        </div>

        <div className="grp">
          <span className="lbl">Baseplate</span>
          <button className="btn sm" onClick={() => resizePlate(-STEP)} disabled={!fits(-STEP)} aria-label="Shrink baseplate">−</button>
          <span>{N}×{N}</span>
          <button className="btn sm" onClick={() => resizePlate(STEP)} disabled={!fits(STEP)} aria-label="Expand baseplate">+</button>
        </div>

        <div className="grp">
          <button className="btn" onClick={saveJson} title="Download your build as a JSON file">Save</button>
          <button className="btn" onClick={() => fileRef.current.click()} title="Open a saved JSON file">Load</button>
          <input ref={fileRef} type="file" accept=".json,application/json" onChange={loadJson} style={{ display: "none" }} />
        </div>

        <button className={"btn accent" + (animOpen ? " on" : "")} style={{ marginLeft: "auto" }} onClick={() => setAnimOpen((o) => !o)} aria-expanded={animOpen}>
          Animate
        </button>
      </header>

      <div className="body">
        <aside className="side">
          <div className="sec">
            <div className="h">Color · {colorName}</div>
            <div className="swatches">
              {COLORS.map((c) => (
                <button
                  key={c.hex}
                  className={"sw" + (color === c.hex ? " on" : "")}
                  style={{ background: c.hex }}
                  aria-label={c.name}
                  aria-pressed={color === c.hex}
                  title={c.name}
                  onClick={() => { setColor(c.hex); setMode("build"); }}
                />
              ))}
            </div>
          </div>

          <div className="sec">
            <div className="h">Pieces</div>
            <input className="search" type="search" placeholder="Search, e.g. window, boat, sofa" aria-label="Search pieces" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>

          {!q && (
            <div className="cats" role="tablist" aria-label="Piece categories">
              {GROUPS.map((g) => (
                <button key={g.title} role="tab" aria-selected={cat === g.title} className={"chip" + (cat === g.title ? " on" : "")} onClick={() => setCat(g.title)}>
                  {g.title}
                </button>
              ))}
            </div>
          )}

          <div className="grid">
            {keys.length === 0 && <div className="empty">No pieces match “{query}”.</div>}
            {keys.map((k) => {
              const t = TYPES[k];
              return (
                <button
                  key={k}
                  className={"card" + (typeKey === k ? " on" : "")}
                  aria-pressed={typeKey === k}
                  title={`${t.name} · ${t.w}×${t.d} studs${t.top ? "" : " · nothing can be stacked on it"}`}
                  onClick={() => { setTypeKey(k); setMode("build"); }}
                >
                  <Thumb k={k} color={color} />
                  <span className="nm">{t.name}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <main className="stage">
          <div ref={mountRef} className="canvas" style={{ cursor: mode === "remove" ? "crosshair" : "pointer" }} />

          <div className="status">
            {mode === "build" ? (
              <>
                <span className="dot" style={{ background: color }} />
                <strong>{type.name}</strong>
                <span>{w}×{d} studs · turned {rot * 90}°</span>
              </>
            ) : (
              <strong>Remove mode: click a piece to delete it</strong>
            )}
            <span>{bricks.length} piece{bricks.length === 1 ? "" : "s"}</span>
            <span className="hint">Click to place · Drag to orbit · Scroll to zoom · R rotate · B build · X remove</span>
          </div>

          {note && <div className="toast" role="status">{note}</div>}

          {animOpen && (
            <div className="drawer" role="dialog" aria-label="Animation video">
              <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
                <strong>Animation video</strong>
                <button className="btn sm" style={{ flex: "none" }} onClick={() => setAnimOpen(false)} disabled={!!busy}>Close</button>
              </div>

              <div className="h">Pieces</div>
              <div className="row">
                <button className={on(anim === "build").trim()} onClick={() => setAnim("build")} disabled={!!busy}>Build-up</button>
                <button className={on(anim === "finished").trim()} onClick={() => setAnim("finished")} disabled={!!busy}>Finished</button>
              </div>

              <div className="h">Camera</div>
              <div className="row">
                <button className={on(camMode === "orbit").trim()} onClick={() => setCamMode("orbit")} disabled={!!busy}>Orbit</button>
                <button className={on(camMode === "angles").trim()} onClick={() => setCamMode("angles")} disabled={!!busy}>My angles</button>
              </div>

              {camMode === "angles" && (
                <div style={{ marginBottom: 10 }}>
                  {shots.map((sh, i) => (
                    <div className="shot" key={i}>
                      <span>Angle {i + 1}</span>
                      <button className="btn sm" onClick={() => setView(sh)} disabled={!!busy}>Go</button>
                      <button className="btn sm" aria-label={"Remove angle " + (i + 1)} onClick={() => setShots((p) => p.filter((_, j) => j !== i))} disabled={!!busy}>×</button>
                    </div>
                  ))}
                  <button className="btn" style={{ width: "100%" }} onClick={addShot} disabled={!!busy || shots.length >= 8}>+ Save current view</button>
                  <p className="note">Rotate and zoom to a view, then save it. The video flies through the angles in order.</p>
                </div>
              )}

              {busy ? (
                <div>
                  <div className="bar"><div style={{ width: Math.round(progress * 100) + "%" }} /></div>
                  <p className="note">{{ gif: "Encoding GIF", video: "Recording video", preview: "Previewing" }[busy]}… {Math.round(progress * 100)}%</p>
                  <button className="btn" style={{ width: "100%", marginTop: 8 }} onClick={() => (cancelRef.current.v = true)}>Cancel</button>
                </div>
              ) : (
                <>
                  <div className="row" style={{ marginBottom: 4 }}>
                    <button className="btn" onClick={() => exportAnimation("preview")}>Preview</button>
                    <button className="btn" onClick={() => exportAnimation("gif")}>GIF</button>
                    <button className="btn" onClick={() => exportAnimation("video")}>Video</button>
                  </div>
                  <p className="note">About {Math.round(plan.total)} seconds. Preview plays on screen without saving.</p>
                </>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
