import * as THREE from "three";

/* Units: 1 = one stud. A brick is BH tall; stud height SH, radius SR.
   Every piece is built in a local frame with its origin at the min corner of
   its footprint (w along x, d along z) and its "front" facing +z. */
export const BH = 1.2;
export const SH = 0.2;
export const SR = 0.3;
export const studGeo = new THREE.CylinderGeometry(SR, SR, SH, 20);

/* ---------- caches so rebuilding the scene never leaks ---------- */
const geos = new Map();
const G = (C, ...a) => {
  let m = geos.get(C);
  if (!m) geos.set(C, (m = new Map()));
  const k = a.join();
  if (!m.has(k)) m.set(k, new C(...a));
  return m.get(k);
};
const mats = {};
const mat = (c, o = {}) =>
  (mats[c + JSON.stringify(o)] ||= new THREE.MeshStandardMaterial({ color: c, roughness: 0.4, ...o }));
const glass = () => mat("#8CC8E8", { transparent: true, opacity: 0.45, roughness: 0.1 });
const shade = (hex, f) => "#" + new THREE.Color(hex).multiplyScalar(f).getHexString();

/* ---------- tiny mesh helpers (x, y, z are the part's CENTER) ---------- */
function add(g, geo, m, x, y, z) {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  g.add(o);
  return o;
}
const B = (g, w, h, d, m, x, y, z) => add(g, G(THREE.BoxGeometry, w, h, d), m, x, y, z);
const Cyl = (g, rt, rb, h, m, x, y, z) => add(g, G(THREE.CylinderGeometry, rt, rb, h, 20), m, x, y, z);
const Sph = (g, r, m, x, y, z) => add(g, G(THREE.SphereGeometry, r, 14, 10), m, x, y, z);
function studs(g, w, d, y, m) {
  for (let x = 0; x < w; x++)
    for (let z = 0; z < d; z++) add(g, studGeo, m, x + 0.5, y + SH / 2, z + 0.5);
}

/* ---------- catalog ---------- */
export const TYPES = {};
const reg = (key, name, w, d, h, top, build) => (TYPES[key] = { key, name, w, d, h, top, build });
// w, d = footprint in studs, h = height in brick layers, top = can other pieces stack on it?

// Plain bricks
[[1, 1], [1, 2], [1, 3], [1, 4], [2, 2], [2, 3], [2, 4]].forEach(([w, d]) =>
  reg(`b${w}x${d}`, `${w}×${d}`, w, d, 1, true, (c) => {
    const g = new THREE.Group();
    const m = mat(c);
    B(g, w - 0.04, BH, d - 0.04, m, w / 2, BH / 2, d / 2);
    studs(g, w, d, BH, m);
    return g;
  })
);

// Flat bricks: same size as a brick but with a smooth top (no studs)
[[1, 1], [1, 2], [1, 3], [1, 4], [2, 2], [2, 3], [2, 4]].forEach(([w, d]) =>
  reg(`f${w}x${d}`, `Flat ${w}×${d}`, w, d, 1, true, (c) => {
    const g = new THREE.Group();
    B(g, w - 0.04, BH, d - 0.04, mat(c), w / 2, BH / 2, d / 2);
    return g;
  })
);
// Tiles: a quarter-brick thick, smooth top. Good for floors, roads and paths.
[[1, 2], [2, 2], [2, 4], [4, 4], [4, 8]].forEach(([w, d]) =>
  reg(`t${w}x${d}`, `Tile ${w}×${d}`, w, d, 0.25, true, (c) => {
    const g = new THREE.Group();
    B(g, w - 0.04, BH * 0.25 - 0.01, d - 0.04, mat(c), w / 2, (BH * 0.25 - 0.01) / 2, d / 2);
    return g;
  })
);

// Window: frame in the chosen color, glass pane in the middle
reg("window", "Window", 2, 1, 2, true, (c) => {
  const g = new THREE.Group();
  const m = mat(c);
  B(g, 0.25, 2.4, 0.96, m, 0.125, 1.2, 0.5);
  B(g, 0.25, 2.4, 0.96, m, 1.875, 1.2, 0.5);
  B(g, 2, 0.3, 0.96, m, 1, 0.15, 0.5); // sill
  B(g, 2, 0.3, 0.96, m, 1, 2.25, 0.5); // lintel
  B(g, 0.1, 1.8, 0.2, m, 1, 1.2, 0.5); // mullions
  B(g, 1.5, 0.1, 0.2, m, 1, 1.2, 0.5);
  B(g, 1.5, 1.8, 0.06, glass(), 1, 1.2, 0.5);
  studs(g, 2, 1, 2.4, m);
  return g;
});

// Door: darker frame, leaf in the chosen color, gold handles on both sides
reg("door", "Door", 2, 1, 3, true, (c) => {
  const g = new THREE.Group();
  const frame = mat(shade(c, 0.6));
  B(g, 0.25, 3.6, 0.96, frame, 0.125, 1.8, 0.5);
  B(g, 0.25, 3.6, 0.96, frame, 1.875, 1.8, 0.5);
  B(g, 2, 0.3, 0.96, frame, 1, 3.45, 0.5);
  B(g, 1.5, 3.3, 0.5, mat(c), 1, 1.65, 0.5);
  const gold = mat("#E3B23C", { metalness: 0.5 });
  Sph(g, 0.09, gold, 1.45, 1.6, 0.78);
  Sph(g, 0.09, gold, 1.45, 1.6, 0.22);
  studs(g, 2, 1, 3.6, frame);
  return g;
});

// Flower pot: terracotta pot, plant, flower in the chosen color
reg("pot", "Pot", 1, 1, 1, false, (c) => {
  const g = new THREE.Group();
  const green = mat("#2E7D32");
  Cyl(g, 0.44, 0.32, 0.9, mat("#B5532F"), 0.5, 0.45, 0.5);
  Cyl(g, 0.47, 0.47, 0.12, mat("#B5532F"), 0.5, 0.86, 0.5);
  Cyl(g, 0.38, 0.38, 0.02, mat("#3B2A1D"), 0.5, 0.93, 0.5);
  Cyl(g, 0.04, 0.04, 0.7, green, 0.5, 1.3, 0.5);
  Sph(g, 0.2, green, 0.28, 1.2, 0.5);
  Sph(g, 0.2, green, 0.72, 1.3, 0.5);
  Sph(g, 0.17, mat(c), 0.5, 1.75, 0.5);
  return g;
});

// Roof slopes: low edge at the front (z = 0), high edge at the back. Pair two
// facing opposite directions (rotate one twice) to make a peaked roof.
const roofGeos = {};
const roofGeo = (len) => {
  if (!roofGeos[len]) {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(2, 0);
    s.lineTo(2, BH);
    s.lineTo(0, 0);
    roofGeos[len] = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false });
  }
  return roofGeos[len];
};
[2, 4].forEach((len) =>
  reg(`roof${len}`, `Roof ${len}×2`, len, 2, 1, false, (c) => {
    const g = new THREE.Group();
    const mesh = add(g, roofGeo(len), mat(shade(c, 0.9)), len, 0, 0);
    mesh.rotation.y = -Math.PI / 2; // profile x -> world z, extrusion -> world x
    return g;
  })
);

// People: shirt in the chosen color; the worker wears an orange hard hat
const person = (hardHat) => (c) => {
  const g = new THREE.Group();
  const skin = mat("#F2CD37");
  const shirt = mat(c);
  const pants = mat("#2F4B7C");
  const dark = mat("#111111");
  B(g, 0.34, 1, 0.46, pants, 0.33, 0.5, 0.5); // legs
  B(g, 0.34, 1, 0.46, pants, 0.67, 0.5, 0.5);
  B(g, 0.64, 1.1, 0.46, shirt, 0.5, 1.55, 0.5); // torso
  B(g, 0.18, 1, 0.28, shirt, 0.09, 1.5, 0.5); // arms
  B(g, 0.18, 1, 0.28, shirt, 0.91, 1.5, 0.5);
  B(g, 0.18, 0.2, 0.26, skin, 0.09, 0.9, 0.5); // hands
  B(g, 0.18, 0.2, 0.26, skin, 0.91, 0.9, 0.5);
  Cyl(g, 0.3, 0.3, 0.5, skin, 0.5, 2.35, 0.5); // head
  Sph(g, 0.04, dark, 0.4, 2.4, 0.79); // face
  Sph(g, 0.04, dark, 0.6, 2.4, 0.79);
  B(g, 0.2, 0.04, 0.02, dark, 0.5, 2.25, 0.8);
  if (hardHat) {
    const hat = mat("#FE8A18");
    add(g, G(THREE.SphereGeometry, 0.34, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), hat, 0.5, 2.55, 0.5);
    B(g, 0.5, 0.05, 0.2, hat, 0.5, 2.57, 0.84);
  } else {
    const hair = mat("#4A2F1B");
    Cyl(g, 0.32, 0.32, 0.16, hair, 0.5, 2.58, 0.5);
    B(g, 0.6, 0.45, 0.1, hair, 0.5, 2.4, 0.24);
  }
  return g;
};
reg("person", "Person", 1, 1, 3, false, person(false));
reg("worker", "Worker", 1, 1, 3, false, person(true));

// Car: 2 wide, 4 long, front (headlights) toward +z
reg("car", "Car", 2, 4, 2, false, (c) => {
  const g = new THREE.Group();
  const body = mat(c);
  const tyre = mat("#1B1B1B");
  const tint = mat("#2C4A5E", { roughness: 0.15 });
  for (const x of [0.14, 1.86])
    for (const z of [0.85, 3.15]) {
      const wheel = Cyl(g, 0.42, 0.42, 0.28, tyre, x, 0.42, z);
      wheel.rotation.z = Math.PI / 2;
    }
  B(g, 1.7, 0.65, 3.8, body, 1, 0.625, 2); // chassis
  B(g, 1.5, 0.7, 1.7, body, 1, 1.3, 1.55); // cabin
  B(g, 1.52, 0.4, 1.3, tint, 1, 1.3, 1.55); // side windows
  B(g, 1.3, 0.4, 1.72, tint, 1, 1.3, 1.55); // windshield + rear window
  B(g, 1.5, 0.08, 1.7, body, 1, 1.69, 1.55); // roof
  const lamp = mat("#FFF3B0", { emissive: "#FFF3B0", emissiveIntensity: 0.3 });
  const tail = mat("#D01012");
  B(g, 0.3, 0.18, 0.06, lamp, 0.45, 0.7, 3.9);
  B(g, 0.3, 0.18, 0.06, lamp, 1.55, 0.7, 3.9);
  B(g, 0.3, 0.18, 0.06, tail, 0.45, 0.7, 0.1);
  B(g, 0.3, 0.18, 0.06, tail, 1.55, 0.7, 0.1);
  return g;
});

/* ---------- more roofs ---------- */
const prismGeo = (key, pts, len) => {
  const k = key + len;
  if (!roofGeos[k]) {
    const s = new THREE.Shape();
    pts.forEach(([u, v], i) => (i ? s.lineTo(u, v) : s.moveTo(u, v)));
    roofGeos[k] = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false });
  }
  return roofGeos[k];
};
const Cone = (g, r, h, seg, m, x, y, z) => add(g, G(THREE.ConeGeometry, r, h, seg), m, x, y, z);
const Ico = (g, r, m, x, y, z, sx = 1, sy = 1, sz = 1, ry = 0) => {
  const o = add(g, G(THREE.IcosahedronGeometry, r, 0), m, x, y, z);
  o.scale.set(sx, sy, sz);
  o.rotation.y = ry;
  return o;
};

// Gable: ridge runs along x, slopes fall away toward front and back
[2, 4].forEach((len) =>
  reg(`gable${len}`, `Gable ${len}×4`, len, 4, 2, false, (c) => {
    const g = new THREE.Group();
    const o = add(g, prismGeo("g", [[0, 0], [4, 0], [2, 1.8]], len), mat(shade(c, 0.9)), len, 0, 0);
    o.rotation.y = -Math.PI / 2;
    return g;
  })
);
// Hip: four-sided pyramid
[2, 4].forEach((n) =>
  reg(`hip${n}`, `Hip ${n}×${n}`, n, n, n === 2 ? 1 : 2, false, (c) => {
    const g = new THREE.Group();
    const o = Cone(g, n * 0.693, n * 0.45, 4, mat(shade(c, 0.9)), n / 2, (n * 0.45) / 2, n / 2);
    o.rotation.y = Math.PI / 4;
    return g;
  })
);
reg("spire", "Spire", 2, 2, 2, false, (c) => {
  const g = new THREE.Group();
  Cone(g, 1, 1.9, 20, mat(shade(c, 0.9)), 1, 0.95, 1);
  return g;
});
reg("dome", "Dome", 2, 2, 1, false, (c) => {
  const g = new THREE.Group();
  add(g, G(THREE.SphereGeometry, 0.97, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(shade(c, 0.9)), 1, 0, 1);
  return g;
});

/* ---------- trees ---------- */
const bark = mat("#6B4426");
const leafA = mat("#2E7D32");
const leafB = mat("#3FA34D");

reg("pine", "Pine tree", 2, 2, 3, false, () => {
  const g = new THREE.Group();
  const pine = mat("#1F5F34");
  Cyl(g, 0.12, 0.16, 0.9, bark, 1, 0.45, 1);
  Cone(g, 0.9, 1.5, 8, pine, 1, 1.45, 1);
  Cone(g, 0.7, 1.3, 8, pine, 1, 2.15, 1);
  Cone(g, 0.5, 1.1, 8, pine, 1, 2.75, 1);
  return g;
});
reg("oak", "Round tree", 2, 2, 3, false, () => {
  const g = new THREE.Group();
  Cyl(g, 0.18, 0.25, 1.5, bark, 1, 0.75, 1);
  Sph(g, 0.95, leafA, 1, 2.4, 1);
  Sph(g, 0.6, leafB, 0.5, 2.0, 1.15);
  Sph(g, 0.65, leafB, 1.5, 2.1, 0.8);
  Sph(g, 0.55, leafA, 1.05, 3.0, 0.85);
  return g;
});
reg("palm", "Palm tree", 2, 2, 4, false, () => {
  const g = new THREE.Group();
  const trunk = mat("#8B6B43");
  for (let i = 0; i < 5; i++) Cyl(g, 0.1, 0.13, 0.85, trunk, 1 + i * 0.04, 0.42 + i * 0.82, 1);
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3;
    const f = Sph(g, 0.5, leafB, 1.16 + Math.cos(a) * 0.42, 4.1, 1 + Math.sin(a) * 0.42);
    f.scale.set(1, 0.12, 0.5);
    f.rotation.order = "YZX";
    f.rotation.set(0, -a, -0.4);
  }
  Sph(g, 0.1, bark, 1.1, 3.95, 0.9);
  Sph(g, 0.1, bark, 1.25, 3.95, 1.1);
  return g;
});

/* ---------- plants and stones ---------- */
reg("bush", "Bush", 1, 1, 1, false, () => {
  const g = new THREE.Group();
  Sph(g, 0.3, leafA, 0.3, 0.3, 0.55);
  Sph(g, 0.3, leafA, 0.72, 0.3, 0.45);
  Sph(g, 0.3, leafB, 0.5, 0.62, 0.5);
  return g;
});
reg("flowers", "Flower bed", 1, 1, 1, false, (c) => {
  const g = new THREE.Group();
  B(g, 0.92, 0.14, 0.92, mat("#4A3222"), 0.5, 0.07, 0.5);
  [[0.25, 0.25], [0.7, 0.3], [0.4, 0.62], [0.75, 0.72], [0.2, 0.75]].forEach(([x, z], i) => {
    Cyl(g, 0.025, 0.025, 0.45, leafA, x, 0.37, z);
    Sph(g, 0.11, i % 2 ? mat(c) : mat("#FFD23F"), x, 0.65, z);
  });
  return g;
});
reg("sunflower", "Sunflower", 1, 1, 2, false, () => {
  const g = new THREE.Group();
  Cyl(g, 0.05, 0.06, 1.6, leafA, 0.5, 0.8, 0.5);
  const l = Sph(g, 0.15, leafB, 0.3, 0.7, 0.5);
  l.scale.set(1.4, 0.25, 0.8);
  const petals = Cyl(g, 0.3, 0.3, 0.08, mat("#F2CD37"), 0.5, 1.7, 0.55);
  petals.rotation.x = Math.PI / 2;
  const mid = Cyl(g, 0.16, 0.16, 0.1, mat("#5A3A1E"), 0.5, 1.7, 0.58);
  mid.rotation.x = Math.PI / 2;
  return g;
});
reg("cactus", "Cactus", 1, 1, 2, false, (c) => {
  const g = new THREE.Group();
  const cg = mat("#3F8F4F");
  Cyl(g, 0.2, 0.22, 1.3, cg, 0.5, 0.65, 0.5);
  [[-1, 0.7, 0.9], [1, 0.55, 0.75]].forEach(([s, yh, yv]) => {
    const arm = Cyl(g, 0.09, 0.09, 0.3, cg, 0.5 + s * 0.2, yh, 0.5);
    arm.rotation.z = Math.PI / 2;
    Cyl(g, 0.09, 0.09, 0.4, cg, 0.5 + s * 0.33, yv, 0.5);
  });
  Sph(g, 0.1, mat(c), 0.5, 1.33, 0.5);
  return g;
});
reg("grass", "Grass", 1, 1, 1, false, () => {
  const g = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4;
    const r = 0.1 + (i % 3) * 0.12;
    const h = 0.5 + (i % 3) * 0.15;
    const b = Cone(g, 0.045, h, 5, i % 2 ? leafA : leafB, 0.5 + Math.cos(a) * r, h / 2, 0.5 + Math.sin(a) * r);
    b.rotation.set(Math.sin(a) * 0.2, 0, Math.cos(a) * 0.2);
  }
  return g;
});
reg("hedge", "Hedge", 1, 2, 1, false, () => {
  const g = new THREE.Group();
  B(g, 0.92, 0.9, 1.92, mat("#2E6B34"), 0.5, 0.45, 1);
  [0.5, 1.5].forEach((z) => Sph(g, 0.46, leafA, 0.5, 0.9, z).scale.set(1, 0.6, 1));
  return g;
});
const rock = mat("#8A8D91", { flatShading: true, roughness: 0.95 });
const rock2 = mat("#74777B", { flatShading: true, roughness: 0.95 });
reg("stone", "Stone", 1, 1, 1, false, () => {
  const g = new THREE.Group();
  Ico(g, 0.42, rock, 0.5, 0.3, 0.5, 1, 0.75, 0.9, 0.6);
  Ico(g, 0.2, rock2, 0.82, 0.12, 0.25, 1, 0.7, 1, 1.1);
  return g;
});
reg("boulder", "Boulder", 2, 2, 2, false, () => {
  const g = new THREE.Group();
  Ico(g, 0.95, rock, 1, 0.75, 1, 1, 0.85, 0.95, 0.4);
  Ico(g, 0.55, rock2, 1.55, 0.4, 1.45, 1, 0.8, 1, 1.2);
  Ico(g, 0.4, rock, 0.45, 0.3, 1.5, 1, 0.7, 1, 0.2);
  return g;
});

/* ---------- bus: 2 wide, 6 long, front toward +z ---------- */
reg("bus", "Bus", 2, 6, 2, false, (c) => {
  const g = new THREE.Group();
  const trim = mat("#F4F4F4");
  const tint = mat("#2C4A5E", { roughness: 0.15 });
  for (const x of [0.14, 1.86])
    for (const z of [1.2, 4.8]) {
      const w = Cyl(g, 0.42, 0.42, 0.28, mat("#1B1B1B"), x, 0.42, z);
      w.rotation.z = Math.PI / 2;
    }
  B(g, 1.8, 1.5, 5.8, mat(c), 1, 1.1, 3);
  B(g, 1.84, 0.12, 5.82, trim, 1, 0.7, 3); // stripe
  for (let i = 0; i < 5; i++) B(g, 1.84, 0.55, 0.75, tint, 1, 1.45, 1 + i * 0.95); // side windows
  B(g, 1.5, 0.6, 0.06, tint, 1, 1.4, 5.92); // windshield
  B(g, 1.2, 0.4, 0.06, tint, 1, 1.4, 0.08); // rear window
  B(g, 1.9, 0.08, 5.9, trim, 1, 1.89, 3); // roof
  const lamp = mat("#FFF3B0", { emissive: "#FFF3B0", emissiveIntensity: 0.3 });
  const tail = mat("#D01012");
  [0.4, 1.6].forEach((x) => {
    B(g, 0.3, 0.18, 0.06, lamp, x, 0.65, 5.93);
    B(g, 0.3, 0.18, 0.06, tail, x, 0.65, 0.07);
  });
  return g;
});

/* ---------- helpers for the transport / home / kitchen sets ---------- */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const steel = mat("#B8BCC4", { metalness: 0.6, roughness: 0.35 });
const black = mat("#1B1B1B");
const white = mat("#F4F4F4");
const tintGlass = mat("#2C4A5E", { roughness: 0.15 });
const lampMat = mat("#FFF3B0", { emissive: "#FFF3B0", emissiveIntensity: 0.3 });

// A cylinder between two points: frames, forks, spouts, handles
function tube(g, a, b, r, m) {
  const p = V(...a);
  const q = V(...b);
  const dir = q.clone().sub(p);
  const o = add(g, G(THREE.CylinderGeometry, r, r, 1, 8), m, (p.x + q.x) / 2, (p.y + q.y) / 2, (p.z + q.z) / 2);
  o.scale.y = dir.length();
  o.quaternion.setFromUnitVectors(V(0, 1, 0), dir.normalize());
  return o;
}
// Wheel with its axle along x
function wheel(g, x, y, z, r, w = 0.25) {
  Cyl(g, r, r, w, black, x, y, z).rotation.z = Math.PI / 2;
  Cyl(g, r * 0.45, r * 0.45, w + 0.02, steel, x, y, z).rotation.z = Math.PI / 2;
}
// Pointed-bow hull seen from above, extruded upward
const hullGeos = {};
function hull(g, w, d, bow, height, m) {
  const k = [w, d, bow, height].join();
  if (!hullGeos[k]) {
    const pts = [[0.05, 0.1], [w - 0.05, 0.1], [w - 0.05, d - bow], [w / 2, d - 0.02], [0.05, d - bow]];
    const s = new THREE.Shape();
    pts.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z)));
    hullGeos[k] = new THREE.ExtrudeGeometry(s, { depth: height, bevelEnabled: false });
  }
  add(g, hullGeos[k], m, 0, 0, 0).rotation.x = -Math.PI / 2;
}

/* ---------- railway (plate-height pieces: h = 0.25 of a brick) ---------- */
const straightTrack = (len) => () => {
  const g = new THREE.Group();
  B(g, 2, 0.1, len - 0.04, mat("#7B7B7B"), 1, 0.05, len / 2);
  for (let z = 0.25; z < len; z += 0.5) B(g, 1.8, 0.08, 0.22, mat("#6B4426"), 1, 0.14, z);
  [0.4, 1.6].forEach((x) => B(g, 0.1, 0.12, len - 0.04, steel, x, 0.24, len / 2));
  return g;
};
reg("track2", "Track 2×2", 2, 2, 0.25, true, straightTrack(2));
reg("track4", "Track 2×4", 2, 4, 0.25, true, straightTrack(4));
// Quarter curve: enters at the z = 0 edge heading +z, leaves at the x = 4 edge heading +x
reg("curve", "Track curve", 4, 4, 0.25, true, () => {
  const g = new THREE.Group();
  const R = 3;
  const n = 14;
  for (let i = 0; i < n; i++) {
    const t = Math.PI - ((i + 0.5) * (Math.PI / 2)) / n;
    const yaw = Math.atan2(Math.cos(t), Math.sin(t));
    B(g, 0.22, 0.08, 1.8, mat("#6B4426"), 4 + R * Math.cos(t), 0.14, R * Math.sin(t)).rotation.y = yaw;
    [R - 0.6, R + 0.6].forEach((r) =>
      (B(g, r * (Math.PI / 2 / n) * 1.06, 0.12, 0.1, steel, 4 + r * Math.cos(t), 0.24, r * Math.sin(t)).rotation.y = yaw)
    );
  }
  return g;
});

/* ---------- trains: 2 wide, 6 long, front toward +z ---------- */
const trainWheels = (g, zs) => zs.forEach((z) => [0.15, 1.85].forEach((x) => wheel(g, x, 0.4, z, 0.4, 0.2)));
reg("loco", "Locomotive", 2, 6, 2, false, (c) => {
  const g = new THREE.Group();
  B(g, 1.7, 0.35, 5.8, black, 1, 0.55, 3); // chassis
  trainWheels(g, [1.0, 2.3, 3.6]);
  B(g, 1.7, 1.7, 1.6, mat(c), 1, 1.25, 0.9); // cab
  B(g, 1.74, 0.5, 0.8, tintGlass, 1, 1.6, 0.9);
  B(g, 1.9, 0.1, 1.9, black, 1, 2.15, 0.9);
  Cyl(g, 0.62, 0.62, 3.4, mat(shade(c, 0.8)), 1, 1.15, 3.4).rotation.x = Math.PI / 2; // boiler
  Cyl(g, 0.65, 0.65, 0.3, black, 1, 1.15, 5.0).rotation.x = Math.PI / 2;
  Cyl(g, 0.2, 0.15, 0.6, black, 1, 1.95, 4.7); // chimney
  Sph(g, 0.25, steel, 1, 1.8, 3.2);
  Sph(g, 0.14, lampMat, 1, 1.15, 5.2);
  B(g, 1.2, 0.3, 0.3, black, 1, 0.45, 5.7); // cow-catcher
  return g;
});
reg("coach", "Train coach", 2, 6, 2, false, (c) => {
  const g = new THREE.Group();
  B(g, 1.7, 0.3, 5.8, black, 1, 0.55, 3);
  trainWheels(g, [1.0, 5.0]);
  B(g, 1.9, 1.5, 5.8, mat(c), 1, 1.35, 3);
  for (let i = 0; i < 5; i++) B(g, 1.94, 0.55, 0.75, tintGlass, 1, 1.6, 0.95 + i * 1.02);
  B(g, 1.96, 0.1, 5.9, white, 1, 2.15, 3);
  B(g, 0.2, 0.2, 0.3, black, 1, 0.55, 0.05);
  B(g, 0.2, 0.2, 0.3, black, 1, 0.55, 5.95);
  return g;
});
reg("wagon", "Cargo wagon", 2, 6, 2, false, (c) => {
  const g = new THREE.Group();
  B(g, 1.7, 0.3, 5.8, black, 1, 0.55, 3);
  trainWheels(g, [1.0, 5.0]);
  const m = mat(c);
  B(g, 1.9, 0.15, 5.8, m, 1, 0.78, 3); // floor
  [0.1, 1.9].forEach((x) => B(g, 0.1, 0.8, 5.8, m, x, 1.2, 3));
  [0.1, 5.9].forEach((z) => B(g, 1.9, 0.8, 0.1, m, 1, 1.2, z));
  const coal = mat("#2A2A2A", { flatShading: true });
  [[0.6, 1.5], [1.4, 2.4], [0.7, 3.6], [1.3, 4.6]].forEach(([x, z]) => Ico(g, 0.5, coal, x, 1.1, z, 1, 0.6, 1, x * z));
  return g;
});

/* ---------- water (plate height; boats and ships can sit on top) ---------- */
const waterBody = (w, d, river) => () => {
  const g = new THREE.Group();
  const sand = mat("#D8C27A");
  const wat = mat("#3C9BD6", { transparent: true, opacity: 0.85, roughness: 0.1 });
  const t = 0.2;
  B(g, w - 0.04, 0.2, d - 0.04, sand, w / 2, 0.1, d / 2);
  B(g, w - 2 * t, 0.08, river ? d - 0.04 : d - 2 * t, wat, w / 2, 0.24, d / 2);
  [t / 2, w - t / 2].forEach((x) => B(g, t, 0.1, d - 0.04, sand, x, 0.25, d / 2));
  if (!river) [t / 2, d - t / 2].forEach((z) => B(g, w - 0.04, 0.1, t, sand, w / 2, 0.25, z));
  return g;
};
reg("pond", "Pond 2×2", 2, 2, 0.25, true, waterBody(2, 2));
reg("river", "River 2×4", 2, 4, 0.25, true, waterBody(2, 4, true));
reg("lake", "Lake 4×4", 4, 4, 0.25, true, waterBody(4, 4));
reg("sea", "Sea 8×8", 8, 8, 0.25, true, waterBody(8, 8));

/* ---------- boats and ship (bow toward +z) ---------- */
reg("motorboat", "Motor boat", 2, 4, 1, false, (c) => {
  const g = new THREE.Group();
  hull(g, 2, 4, 1.2, 0.5, mat(c));
  B(g, 1.2, 0.2, 0.5, white, 1, 0.6, 1.4);
  B(g, 1.2, 0.45, 0.05, tintGlass, 1, 0.85, 2.2);
  B(g, 0.3, 0.7, 0.25, black, 1, 0.45, 0.1);
  return g;
});
reg("sailboat", "Sailboat", 2, 4, 3, false, (c) => {
  const g = new THREE.Group();
  hull(g, 2, 4, 1.3, 0.45, mat(c));
  tube(g, [1, 0.4, 1.4], [1, 3.4, 1.4], 0.05, mat("#6B4426"));
  tube(g, [1, 0.8, 1.5], [1, 0.8, 3.3], 0.03, mat("#6B4426")); // boom
  add(g, prismGeo("sail", [[1.5, 0.85], [1.5, 3.3], [3.4, 0.85]], 0.04), white, 1.02, 0, 0).rotation.y = -Math.PI / 2;
  return g;
});
reg("ship", "Cargo ship", 4, 10, 3, false, (c) => {
  const g = new THREE.Group();
  hull(g, 4, 10, 2.6, 0.9, mat(c));
  B(g, 2.8, 1.1, 2.4, white, 2, 1.45, 2.2); // cabin
  B(g, 2.84, 0.35, 2.0, tintGlass, 2, 1.7, 2.2);
  B(g, 2.4, 0.7, 1.4, white, 2, 2.35, 2.7); // bridge
  B(g, 2.44, 0.3, 1.0, tintGlass, 2, 2.45, 2.8);
  Cyl(g, 0.35, 0.35, 0.9, mat("#D01012"), 2, 2.45, 1.3); // funnel
  Cyl(g, 0.36, 0.36, 0.2, black, 2, 2.85, 1.3);
  const cols = ["#0055BF", "#F2CD37", "#237841", "#FE8A18"];
  [[1.25, 4.8], [2.75, 4.8], [1.25, 6.4], [2.75, 6.4]].forEach(([x, z], i) => {
    B(g, 1.3, 0.7, 1.5, mat(cols[i]), x, 1.25, z);
    if (i % 3 === 0) B(g, 1.3, 0.7, 1.5, mat(cols[(i + 2) % 4]), x, 1.95, z);
  });
  tube(g, [2, 0.9, 9.0], [2, 2.3, 9.0], 0.05, black);
  return g;
});

/* ---------- two-wheelers (front toward +z) ---------- */
reg("bicycle", "Bicycle", 1, 4, 2, false, (c) => {
  const g = new THREE.Group();
  const frame = mat(c);
  [0.8, 3.2].forEach((z) => {
    add(g, G(THREE.TorusGeometry, 0.62, 0.06, 8, 24), black, 0.5, 0.7, z).rotation.y = Math.PI / 2;
    Cyl(g, 0.06, 0.06, 0.12, steel, 0.5, 0.7, z).rotation.z = Math.PI / 2;
  });
  const R = [0.5, 0.7, 0.8], F = [0.5, 0.7, 3.2], Bb = [0.5, 0.5, 1.7], S = [0.5, 1.45, 1.5], H = [0.5, 1.45, 2.8];
  [[R, Bb], [Bb, S], [S, R], [S, H], [Bb, H], [H, F]].forEach(([a, b]) => tube(g, a, b, 0.04, frame));
  tube(g, H, [0.5, 1.75, 2.85], 0.035, steel);
  B(g, 0.55, 0.05, 0.05, black, 0.5, 1.75, 2.85); // handlebar
  B(g, 0.14, 0.06, 0.34, black, 0.5, 1.5, 1.4); // saddle
  B(g, 0.3, 0.04, 0.1, black, 0.5, 0.5, 1.7);
  return g;
});
reg("kick", "Kick scooter", 1, 3, 2, false, (c) => {
  const g = new THREE.Group();
  B(g, 0.4, 0.1, 1.8, mat(c), 0.5, 0.32, 1.1);
  wheel(g, 0.5, 0.3, 0.2, 0.3, 0.14);
  wheel(g, 0.5, 0.3, 2.7, 0.3, 0.14);
  tube(g, [0.5, 0.3, 2.7], [0.5, 2.2, 2.4], 0.045, steel);
  B(g, 0.75, 0.07, 0.07, black, 0.5, 2.2, 2.4);
  return g;
});
reg("scooter", "Scooter", 1, 4, 2, false, (c) => {
  const g = new THREE.Group();
  const body = mat(c);
  wheel(g, 0.5, 0.35, 0.6, 0.35, 0.2);
  wheel(g, 0.5, 0.35, 3.45, 0.35, 0.2);
  B(g, 0.75, 0.8, 1.2, body, 0.5, 0.8, 0.95); // rear body
  B(g, 0.6, 0.12, 1.0, black, 0.5, 1.26, 0.95); // seat
  B(g, 0.65, 0.15, 1.5, body, 0.5, 0.5, 2.2); // floorboard
  B(g, 0.7, 0.9, 0.12, body, 0.5, 1.0, 2.95); // leg shield
  tube(g, [0.5, 1.5, 2.85], [0.5, 0.35, 3.45], 0.04, steel);
  B(g, 0.8, 0.06, 0.06, black, 0.5, 1.6, 2.8);
  Sph(g, 0.12, lampMat, 0.5, 1.4, 3.0);
  return g;
});
reg("motorbike", "Motorbike", 1, 4, 2, false, (c) => {
  const g = new THREE.Group();
  wheel(g, 0.5, 0.5, 0.6, 0.5, 0.22);
  wheel(g, 0.5, 0.5, 3.4, 0.5, 0.22);
  B(g, 0.4, 0.4, 1.0, mat(c), 0.5, 1.2, 1.9); // tank
  B(g, 0.45, 0.5, 0.7, mat("#444"), 0.5, 0.7, 1.7); // engine
  B(g, 0.4, 0.12, 1.0, black, 0.5, 1.1, 1.0); // seat
  tube(g, [0.5, 1.35, 2.9], [0.5, 0.5, 3.4], 0.05, steel);
  tube(g, [0.5, 0.6, 1.5], [0.5, 0.5, 0.6], 0.05, steel);
  tube(g, [0.65, 0.4, 1.6], [0.65, 0.45, 0.3], 0.07, steel); // exhaust
  B(g, 0.8, 0.06, 0.06, black, 0.5, 1.5, 2.95);
  Sph(g, 0.14, lampMat, 0.5, 1.3, 3.15);
  B(g, 0.2, 0.1, 0.05, mat("#D01012"), 0.5, 1.1, 0.45);
  return g;
});

/* ---------- home: bulb, TV, fridge, oven ---------- */
reg("bulb", "Light bulb", 1, 1, 2, false, (c) => {
  const g = new THREE.Group();
  const glassM = mat(c, { emissive: c, emissiveIntensity: 0.7, transparent: true, opacity: 0.85, roughness: 0.1 });
  Cyl(g, 0.2, 0.2, 0.45, steel, 0.5, 0.225, 0.5);
  [0.12, 0.28].forEach((y) => Cyl(g, 0.21, 0.21, 0.05, black, 0.5, y, 0.5));
  Cyl(g, 0.22, 0.3, 0.3, glassM, 0.5, 0.6, 0.5);
  Sph(g, 0.4, glassM, 0.5, 0.95, 0.5);
  tube(g, [0.45, 0.6, 0.5], [0.45, 0.9, 0.5], 0.015, black);
  tube(g, [0.55, 0.6, 0.5], [0.55, 0.9, 0.5], 0.015, black);
  B(g, 0.12, 0.02, 0.02, black, 0.5, 0.9, 0.5);
  return g;
});
reg("tv", "TV", 3, 1, 2, false, (c) => {
  const g = new THREE.Group();
  const screen = mat("#4FB3E8", { emissive: "#4FB3E8", emissiveIntensity: 0.45, roughness: 0.2 });
  B(g, 1.2, 0.08, 0.6, black, 1.5, 0.04, 0.5);
  B(g, 0.2, 0.4, 0.12, black, 1.5, 0.28, 0.5);
  B(g, 2.8, 1.5, 0.12, black, 1.5, 1.2, 0.5);
  B(g, 2.6, 1.3, 0.02, screen, 1.5, 1.2, 0.57);
  B(g, 2.8, 0.1, 0.13, mat(c), 1.5, 0.55, 0.5);
  return g;
});
reg("fridge", "Fridge", 2, 2, 3, true, (c) => {
  const g = new THREE.Group();
  B(g, 1.8, 3.58, 1.7, mat(c), 1, 1.79, 1);
  B(g, 1.82, 0.04, 0.03, black, 1, 2.4, 1.86); // freezer seam
  B(g, 0.07, 0.8, 0.1, steel, 1.55, 2.9, 1.9);
  B(g, 0.07, 1.0, 0.1, steel, 1.55, 1.5, 1.9);
  return g;
});
reg("oven", "Oven", 2, 2, 2, true, (c) => {
  const g = new THREE.Group();
  const glow = mat("#2B1A10", { emissive: "#FF6A00", emissiveIntensity: 0.25 });
  B(g, 1.84, 2.38, 1.7, mat(c), 1, 1.19, 1);
  B(g, 1.84, 0.06, 1.7, black, 1, 2.41, 1);
  [[0.55, 0.55], [1.45, 0.55], [0.55, 1.45], [1.45, 1.45]].forEach(([x, z]) => {
    Cyl(g, 0.28, 0.28, 0.03, mat("#222"), x, 2.46, z);
    Cyl(g, 0.1, 0.1, 0.04, steel, x, 2.47, z);
  });
  B(g, 1.3, 0.9, 0.06, glow, 1, 1.0, 1.87); // oven window
  B(g, 1.4, 0.07, 0.1, steel, 1, 1.75, 1.93);
  B(g, 1.84, 0.35, 0.05, black, 1, 2.1, 1.86);
  [0.4, 0.8, 1.2, 1.6].forEach((x) => (Cyl(g, 0.07, 0.07, 0.08, steel, x, 2.1, 1.92).rotation.x = Math.PI / 2));
  return g;
});

/* ---------- cooking utensils (each 1×1) ---------- */
reg("pan", "Frying pan", 1, 1, 1, false, (c) => {
  const g = new THREE.Group();
  Cyl(g, 0.38, 0.3, 0.2, mat("#3A3D42", { metalness: 0.4 }), 0.38, 0.1, 0.5);
  Cyl(g, 0.33, 0.33, 0.02, mat("#1E1F22"), 0.38, 0.2, 0.5);
  B(g, 0.4, 0.06, 0.1, mat(c), 0.85, 0.16, 0.5);
  return g;
});
reg("cookpot", "Cooking pot", 1, 1, 1, false, (c) => {
  const g = new THREE.Group();
  Cyl(g, 0.4, 0.4, 0.5, steel, 0.5, 0.25, 0.5);
  Cyl(g, 0.42, 0.42, 0.05, steel, 0.5, 0.53, 0.5); // lid
  Sph(g, 0.07, mat(c), 0.5, 0.6, 0.5);
  [0.06, 0.94].forEach((x) => B(g, 0.14, 0.06, 0.1, mat(c), x, 0.4, 0.5));
  return g;
});
reg("kettle", "Kettle", 1, 1, 1, false, (c) => {
  const g = new THREE.Group();
  Cyl(g, 0.3, 0.38, 0.55, mat(c, { metalness: 0.3 }), 0.5, 0.3, 0.5);
  Cyl(g, 0.2, 0.3, 0.1, steel, 0.5, 0.62, 0.5);
  tube(g, [0.72, 0.4, 0.5], [0.93, 0.65, 0.5], 0.04, steel); // spout
  add(g, G(THREE.TorusGeometry, 0.2, 0.03, 8, 16, Math.PI), black, 0.5, 0.62, 0.5);
  return g;
});
reg("utensils", "Utensils", 1, 1, 1, false, (c) => {
  const g = new THREE.Group();
  Cyl(g, 0.28, 0.25, 0.5, mat(c), 0.5, 0.25, 0.5);
  tube(g, [0.4, 0.3, 0.5], [0.3, 1.15, 0.5], 0.03, steel); // spoon
  Sph(g, 0.1, steel, 0.3, 1.2, 0.5).scale.set(1, 1.3, 0.4);
  tube(g, [0.5, 0.3, 0.45], [0.62, 1.1, 0.45], 0.03, steel); // ladle
  Sph(g, 0.13, steel, 0.62, 1.15, 0.45).scale.set(1, 0.6, 1);
  tube(g, [0.58, 0.3, 0.58], [0.7, 1.0, 0.6], 0.03, black); // spatula
  B(g, 0.16, 0.22, 0.03, black, 0.7, 1.1, 0.6);
  return g;
});

/* ---------- wooden logs ---------- */
const barkMat = mat("#6B4426");
const woodLight = mat("#D9B382");
const woodRing = mat("#B88A55");
// A log lying along z, starting at z. k stretches its height (cabin logs are slightly oval).
function logZ(g, r, len, x, y, z, k = 1) {
  const put = (o) => {
    o.rotation.x = Math.PI / 2;
    o.scale.z = k;
  };
  put(Cyl(g, r, r, len, barkMat, x, y, z + len / 2));
  for (const zz of [z - 0.006, z + len + 0.006]) {
    put(Cyl(g, r * 0.96, r * 0.96, 0.02, woodLight, x, y, zz)); // cut end
    put(Cyl(g, r * 0.5, r * 0.5, 0.024, woodRing, x, y, zz)); // growth ring
  }
}
// Log-cabin logs: stud-topped so other pieces can be built on them
[2, 4].forEach((len) =>
  reg(`log${len}`, `Log 1×${len}`, 1, len, 1, true, () => {
    const g = new THREE.Group();
    logZ(g, 0.48, len - 0.1, 0.5, 0.575, 0.05, 1.2);
    for (let z = 0; z < len; z++) add(g, studGeo, barkMat, 0.5, 1.15 + SH / 2, z + 0.5);
    return g;
  })
);
reg("logpile", "Log pile", 2, 4, 2, false, () => {
  const g = new THREE.Group();
  [[0.34, 0.33], [1.0, 0.33], [1.66, 0.33], [0.67, 0.9], [1.33, 0.9], [1.0, 1.47]].forEach(([x, y], i) =>
    logZ(g, 0.33, 3.7 + (i % 3) * 0.1, x, y, 0.05 + (i % 2) * 0.1)
  );
  return g;
});
reg("firewood", "Firewood", 2, 2, 1, false, () => {
  const g = new THREE.Group();
  [[4, 0.34, 0.21], [3, 0.56, 0.59], [2, 0.78, 0.97]].forEach(([n, x0, y]) => {
    for (let i = 0; i < n; i++) logZ(g, 0.21, 1.75 + (i % 2) * 0.15, x0 + i * 0.44, y, 0.05);
  });
  return g;
});
reg("stump", "Tree stump", 1, 1, 1, false, () => {
  const g = new THREE.Group();
  Cyl(g, 0.36, 0.44, 0.6, barkMat, 0.5, 0.3, 0.5);
  Cyl(g, 0.36, 0.36, 0.02, woodLight, 0.5, 0.61, 0.5);
  Cyl(g, 0.2, 0.2, 0.024, woodRing, 0.5, 0.612, 0.5);
  Cyl(g, 0.08, 0.08, 0.028, woodLight, 0.5, 0.614, 0.5);
  [0.4, 2.5, 4.4].forEach((a) => (B(g, 0.28, 0.12, 0.12, barkMat, 0.5 + Math.cos(a) * 0.4, 0.06, 0.5 + Math.sin(a) * 0.4).rotation.y = -a));
  return g;
});

/* ---------- furniture (front toward +z; upholstery takes your chosen color) ---------- */
const wood = mat("#A8743C");
const legsAt = (g, w, d, h, t, m, inset = 0.15) =>
  [inset, w - inset].forEach((x) => [inset, d - inset].forEach((z) => B(g, t, h, t, m, x, h / 2, z)));

reg("stool", "Stool", 1, 1, 1, true, (c) => {
  const g = new THREE.Group();
  Cyl(g, 0.42, 0.42, 0.14, mat(c), 0.5, 1.13, 0.5);
  legsAt(g, 1, 1, 1.06, 0.1, wood, 0.25);
  return g;
});
reg("chair", "Chair", 1, 1, 2, false, (c) => {
  const g = new THREE.Group();
  legsAt(g, 1, 1, 0.7, 0.1, wood, 0.15);
  B(g, 0.8, 0.1, 0.8, mat(c), 0.5, 0.75, 0.5);
  B(g, 0.8, 0.75, 0.08, mat(c), 0.5, 1.2, 0.14);
  return g;
});
reg("armchair", "Armchair", 2, 2, 2, false, (c) => {
  const g = new THREE.Group();
  const m = mat(c);
  legsAt(g, 2, 2, 0.15, 0.12, wood, 0.15);
  B(g, 1.9, 0.6, 1.8, m, 1, 0.45, 1);
  B(g, 1.2, 0.25, 1.3, mat(shade(c, 1.15)), 1, 0.88, 1.2);
  B(g, 1.9, 1.1, 0.5, m, 1, 1.15, 0.4);
  [0.2, 1.8].forEach((x) => B(g, 0.35, 0.75, 1.5, m, x, 0.95, 1.15));
  return g;
});
reg("sofa", "Sofa 4×2", 4, 2, 2, false, (c) => {
  const g = new THREE.Group();
  const m = mat(c);
  legsAt(g, 4, 2, 0.15, 0.12, wood, 0.15);
  B(g, 3.9, 0.6, 1.8, m, 2, 0.45, 1);
  B(g, 3.9, 1.1, 0.5, m, 2, 1.15, 0.4);
  [0.2, 3.8].forEach((x) => B(g, 0.4, 0.8, 1.55, m, x, 0.95, 1.12));
  [1.2, 2.8].forEach((x) => B(g, 1.5, 0.25, 1.3, mat(shade(c, 1.15)), x, 0.88, 1.2));
  return g;
});
const table = (w, d) => () => {
  const g = new THREE.Group();
  B(g, w - 0.04, 0.15, d - 0.04, wood, w / 2, 1.125, d / 2);
  legsAt(g, w, d, 1.05, 0.16, mat("#6B4426"), 0.18);
  return g;
};
reg("table2", "Table 2×2", 2, 2, 1, true, table(2, 2));
reg("table4", "Table 4×2", 4, 2, 1, true, table(4, 2));
reg("dresser", "Dresser", 3, 2, 2, true, (c) => {
  const g = new THREE.Group();
  B(g, 2.9, 2.38, 1.8, wood, 1.5, 1.19, 1);
  [0.55, 1.15, 1.75].forEach((y) =>
    [0.55, 1.5, 2.45].forEach((x) => {
      B(g, 0.85, 0.5, 0.04, mat(c), x, y, 1.91);
      Sph(g, 0.05, steel, x, y, 1.96);
    })
  );
  return g;
});
reg("wardrobe", "Wardrobe", 3, 2, 3, true, (c) => {
  const g = new THREE.Group();
  B(g, 2.9, 3.58, 1.8, wood, 1.5, 1.79, 1);
  [0.8, 2.2].forEach((x) => B(g, 1.35, 3.3, 0.04, mat(c), x, 1.8, 1.91));
  [1.4, 1.6].forEach((x) => B(g, 0.05, 0.6, 0.06, steel, x, 1.8, 1.95));
  return g;
});
reg("bookshelf", "Bookshelf", 3, 1, 3, true, (c) => {
  const g = new THREE.Group();
  const cols = ["#D01012", "#0055BF", "#F2CD37", "#237841", "#FE8A18", c];
  [0.05, 2.95].forEach((x) => B(g, 0.1, 3.58, 0.9, wood, x, 1.79, 0.5));
  B(g, 2.9, 3.58, 0.05, wood, 1.5, 1.79, 0.08);
  [0.05, 1.2, 2.4, 3.53].forEach((y) => B(g, 2.9, 0.1, 0.9, wood, 1.5, y, 0.5));
  [0.1, 1.25, 2.45].forEach((base, row) => {
    let x = 0.15;
    for (let i = 0; x < 2.75; i++) {
      const bw = 0.14 + ((i * 7 + row) % 3) * 0.05;
      const bh = 0.6 + ((i * 5 + row) % 4) * 0.1;
      B(g, bw - 0.01, bh, 0.5, mat(cols[(i + row) % cols.length]), x + bw / 2, base + bh / 2, 0.5);
      x += bw;
    }
  });
  return g;
});
reg("bed", "Bed 3×5", 3, 5, 2, false, (c) => {
  const g = new THREE.Group();
  B(g, 2.9, 0.5, 4.9, wood, 1.5, 0.45, 2.5);
  B(g, 2.7, 0.35, 4.5, white, 1.5, 0.88, 2.55); // mattress
  B(g, 2.72, 0.15, 3.1, mat(c), 1.5, 1.1, 3.3); // blanket
  [0.85, 2.15].forEach((x) => B(g, 1.1, 0.2, 0.7, white, x, 1.15, 0.7)); // pillows
  B(g, 2.9, 1.3, 0.15, wood, 1.5, 1.0, 0.1); // headboard
  B(g, 2.9, 0.6, 0.12, wood, 1.5, 0.75, 4.9); // footboard
  return g;
});
reg("floorlamp", "Floor lamp", 1, 1, 3, false, (c) => {
  const g = new THREE.Group();
  const shadeM = mat(c, { emissive: c, emissiveIntensity: 0.5, transparent: true, opacity: 0.9 });
  Cyl(g, 0.3, 0.3, 0.06, black, 0.5, 0.03, 0.5);
  Cyl(g, 0.03, 0.03, 2.6, steel, 0.5, 1.35, 0.5);
  Cyl(g, 0.22, 0.38, 0.6, shadeM, 0.5, 2.9, 0.5);
  return g;
});

/* ---------- bathroom, gas stove, washer, sink, AC, open door and window ---------- */
const porcelain = mat("#F4F4F4", { roughness: 0.25 });
const waterMat = mat("#7EC8E8", { transparent: true, opacity: 0.7, roughness: 0.1 });
const brass = mat("#E3B23C", { metalness: 0.5 });
const lit = (c) => mat(c, { emissive: c, emissiveIntensity: 0.8 });
const flat = (o) => ((o.rotation.x = Math.PI / 2), o); // turn a cylinder so its axis points along z
const ring = (g, r, t, m, x, y, z) => add(g, G(THREE.TorusGeometry, r, t, 8, 28), m, x, y, z); // faces +z

// Toilet: tank at the back, bowl at the front (+z)
reg("toilet", "Toilet", 1, 2, 2, false, () => {
  const g = new THREE.Group();
  Cyl(g, 0.26, 0.3, 0.3, porcelain, 0.5, 0.15, 1.2);
  Cyl(g, 0.4, 0.3, 0.6, porcelain, 0.5, 0.55, 1.25).scale.z = 1.3;
  Cyl(g, 0.42, 0.42, 0.07, mat("#E6E6E6"), 0.5, 0.88, 1.25).scale.z = 1.3; // seat
  Cyl(g, 0.28, 0.28, 0.075, waterMat, 0.5, 0.885, 1.28).scale.z = 1.3;
  B(g, 0.8, 0.95, 0.4, porcelain, 0.5, 1.2, 0.3); // tank
  B(g, 0.86, 0.07, 0.46, porcelain, 0.5, 1.72, 0.3);
  Cyl(g, 0.07, 0.07, 0.05, steel, 0.5, 1.77, 0.3); // flush button
  return g;
});
reg("bathtub", "Bathtub", 2, 4, 2, false, () => {
  const g = new THREE.Group();
  [0.1, 1.9].forEach((x) => B(g, 0.2, 1, 3.9, porcelain, x, 0.6, 2));
  [0.1, 3.9].forEach((z) => B(g, 1.7, 1, 0.2, porcelain, 1, 0.6, z));
  B(g, 1.7, 0.2, 3.5, porcelain, 1, 0.2, 2);
  B(g, 1.64, 0.05, 3.44, waterMat, 1, 0.78, 2);
  [[0.2, 0.2], [1.8, 0.2], [0.2, 3.8], [1.8, 3.8]].forEach(([x, z]) => Cyl(g, 0.1, 0.1, 0.1, steel, x, 0.05, z));
  tube(g, [1, 1.1, 0.3], [1, 1.5, 0.3], 0.04, steel); // faucet
  tube(g, [1, 1.5, 0.3], [1, 1.4, 0.75], 0.04, steel);
  [0.7, 1.3].forEach((x) => Sph(g, 0.07, steel, x, 1.2, 0.15));
  return g;
});
reg("shower", "Shower", 2, 2, 3, false, () => {
  const g = new THREE.Group();
  const tile = mat("#BFE3F2");
  B(g, 1.9, 0.15, 1.9, porcelain, 1, 0.075, 1); // tray
  Cyl(g, 0.1, 0.1, 0.02, steel, 1, 0.16, 1);
  B(g, 1.9, 2.9, 0.05, tile, 1, 1.55, 0.05); // back and left walls
  B(g, 0.05, 2.9, 1.9, tile, 0.05, 1.55, 1);
  B(g, 1.9, 2.9, 0.04, glass(), 1, 1.55, 1.95); // glass front and right
  B(g, 0.04, 2.9, 1.9, glass(), 1.95, 1.55, 1);
  B(g, 0.06, 2.95, 0.06, steel, 1.95, 1.55, 1.95);
  tube(g, [0.35, 0.3, 0.12], [0.35, 2.6, 0.12], 0.03, steel);
  tube(g, [0.35, 2.6, 0.12], [0.35, 2.6, 0.6], 0.03, steel);
  Cyl(g, 0.07, 0.24, 0.1, steel, 0.35, 2.55, 0.6); // shower head
  Sph(g, 0.07, steel, 0.35, 1.4, 0.1);
  return g;
});
reg("basin", "Wash basin", 1, 1, 2, false, () => {
  const g = new THREE.Group();
  Cyl(g, 0.16, 0.2, 0.85, porcelain, 0.5, 0.425, 0.5); // pedestal
  Cyl(g, 0.46, 0.28, 0.3, porcelain, 0.5, 1.0, 0.5);
  Cyl(g, 0.36, 0.36, 0.02, mat("#CFE8F2"), 0.5, 1.16, 0.5);
  B(g, 0.9, 0.3, 0.1, porcelain, 0.5, 1.3, 0.1);
  Cyl(g, 0.03, 0.03, 0.3, steel, 0.5, 1.45, 0.2);
  tube(g, [0.5, 1.6, 0.2], [0.5, 1.5, 0.45], 0.03, steel);
  [0.3, 0.7].forEach((x) => Sph(g, 0.05, steel, x, 1.22, 0.2));
  return g;
});
reg("towels", "Towel rack", 2, 1, 2, false, (c) => {
  const g = new THREE.Group();
  [0.1, 1.9].forEach((x) => {
    tube(g, [x, 0, 0.5], [x, 1.75, 0.5], 0.03, steel);
    B(g, 0.25, 0.05, 0.7, steel, x, 0.025, 0.5);
  });
  tube(g, [0.1, 1.7, 0.5], [1.9, 1.7, 0.5], 0.03, steel);
  tube(g, [0.1, 1.1, 0.5], [1.9, 1.1, 0.5], 0.03, steel);
  B(g, 0.9, 1.1, 0.12, mat(c), 0.65, 1.15, 0.5); // towels
  B(g, 0.7, 0.8, 0.12, white, 1.5, 1.3, 0.5);
  return g;
});
reg("mirror", "Standing mirror", 2, 1, 3, false, () => {
  const g = new THREE.Group();
  B(g, 1.9, 3.5, 0.1, wood, 1, 1.85, 0.5);
  B(g, 1.7, 3.3, 0.04, mat("#CFE8F2", { metalness: 0.9, roughness: 0.05 }), 1, 1.85, 0.55);
  [0.2, 1.8].forEach((x) => B(g, 0.15, 0.1, 0.8, wood, x, 0.05, 0.5));
  return g;
});

// Gas stove: four burners with cast-iron grates and blue flames, oven below
reg("gasstove", "Gas stove", 2, 2, 2, true, (c) => {
  const g = new THREE.Group();
  const flame = lit("#4DA3FF");
  B(g, 1.84, 2.38, 1.7, mat(c), 1, 1.19, 1);
  B(g, 1.84, 0.05, 1.7, black, 1, 2.405, 1);
  [[0.55, 0.55], [1.45, 0.55], [0.55, 1.45], [1.45, 1.45]].forEach(([x, z], i) => {
    Cyl(g, 0.24, 0.24, 0.05, black, x, 2.45, z);
    Cyl(g, 0.12, 0.12, 0.06, steel, x, 2.46, z);
    if (i % 3 === 0) flat(add(g, G(THREE.TorusGeometry, 0.18, 0.025, 6, 18), flame, x, 2.5, z)).rotation.x = Math.PI / 2;
    B(g, 0.7, 0.05, 0.06, black, x, 2.56, z); // grate
    B(g, 0.06, 0.05, 0.7, black, x, 2.56, z);
  });
  B(g, 1.3, 0.9, 0.06, mat("#2B2B2B"), 1, 1.0, 1.87);
  B(g, 1.4, 0.07, 0.1, steel, 1, 1.75, 1.93);
  B(g, 1.84, 0.35, 0.05, black, 1, 2.1, 1.86);
  [0.4, 0.8, 1.2, 1.6].forEach((x) => (Cyl(g, 0.07, 0.07, 0.08, steel, x, 2.1, 1.92).rotation.x = Math.PI / 2));
  return g;
});
reg("gascyl", "Gas cylinder", 1, 1, 2, false, (c) => {
  const g = new THREE.Group();
  const body = mat(c, { roughness: 0.4 });
  Cyl(g, 0.4, 0.4, 0.08, mat("#444"), 0.5, 0.04, 0.5);
  Cyl(g, 0.38, 0.38, 1.3, body, 0.5, 0.7, 0.5);
  add(g, G(THREE.SphereGeometry, 0.38, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), body, 0.5, 1.35, 0.5);
  Cyl(g, 0.1, 0.1, 0.2, steel, 0.5, 1.8, 0.5); // valve
  Cyl(g, 0.07, 0.07, 0.08, black, 0.5, 1.95, 0.5);
  add(g, G(THREE.TorusGeometry, 0.24, 0.025, 6, 16), steel, 0.5, 1.85, 0.5).rotation.x = Math.PI / 2; // guard ring
  return g;
});
reg("sink", "Wash sink", 3, 2, 1, false, (c) => {
  const g = new THREE.Group();
  B(g, 2.9, 1.05, 1.8, wood, 1.5, 0.525, 1);
  [0.8, 2.2].forEach((x) => B(g, 1.3, 0.85, 0.04, mat(c), x, 0.55, 1.91)); // cabinet doors
  [1.3, 1.7].forEach((x) => B(g, 0.05, 0.25, 0.05, steel, x, 0.85, 1.95));
  B(g, 2.94, 0.15, 1.84, mat("#CFCFD4"), 1.5, 1.125, 1); // counter
  B(g, 1.3, 0.03, 0.9, steel, 1, 1.205, 1.1); // basin
  B(g, 1.1, 0.035, 0.7, mat("#8C959F", { metalness: 0.5 }), 1, 1.21, 1.1);
  Cyl(g, 0.07, 0.07, 0.04, black, 1, 1.23, 1.1);
  for (let z = 0.6; z < 1.7; z += 0.2) B(g, 0.9, 0.02, 0.06, steel, 2.2, 1.205, z); // drainer
  tube(g, [1, 1.2, 0.35], [1, 1.75, 0.35], 0.04, steel);
  tube(g, [1, 1.75, 0.35], [1, 1.7, 0.8], 0.04, steel);
  [0.75, 1.25].forEach((x) => B(g, 0.1, 0.12, 0.1, steel, x, 1.25, 0.35));
  return g;
});

// Front-loading washing machine
reg("washer", "Washing machine", 2, 2, 2, true, (c) => {
  const g = new THREE.Group();
  B(g, 1.84, 2.38, 1.7, mat(c), 1, 1.19, 1);
  B(g, 1.84, 0.4, 0.05, black, 1, 2.1, 1.86);
  flat(Cyl(g, 0.62, 0.62, 0.12, steel, 1, 1.15, 1.9));
  flat(Cyl(g, 0.5, 0.5, 0.14, tintGlass, 1, 1.15, 1.92));
  Sph(g, 0.2, mat("#FE8A18"), 0.95, 1.1, 1.97).scale.set(1, 1, 0.4); // laundry
  flat(Cyl(g, 0.2, 0.2, 0.08, steel, 1.45, 2.1, 1.9));
  B(g, 0.5, 0.18, 0.03, lit("#38E07B"), 0.5, 2.1, 1.89); // display
  [0.85, 1.05].forEach((x) => B(g, 0.12, 0.1, 0.03, white, x, 2.1, 1.89));
  return g;
});

// Air conditioner: wall-mounted indoor unit (stack it on a wall) and outdoor unit
reg("ac", "Air conditioner", 3, 1, 1, false, () => {
  const g = new THREE.Group();
  B(g, 2.9, 0.95, 0.85, white, 1.5, 0.65, 0.5);
  B(g, 2.8, 0.02, 0.02, mat("#D5DADF"), 1.5, 0.55, 0.93);
  for (let i = 0; i < 8; i++) B(g, 0.2, 0.02, 0.5, mat("#C3C9CF"), 0.35 + i * 0.33, 1.13, 0.5); // top vents
  B(g, 2.6, 0.06, 0.5, mat("#CED4DA"), 1.5, 0.2, 0.8).rotation.x = 0.35; // louver
  B(g, 0.3, 0.1, 0.03, lit("#4DA3FF"), 2.5, 0.75, 0.93);
  return g;
});
reg("acout", "AC outdoor unit", 2, 1, 2, false, () => {
  const g = new THREE.Group();
  B(g, 1.9, 1.7, 0.9, mat("#E9ECEF"), 1, 0.95, 0.5);
  [0.3, 1.7].forEach((x) => B(g, 0.2, 0.1, 0.8, black, x, 0.05, 0.5));
  flat(Cyl(g, 0.72, 0.72, 0.04, mat("#555555"), 1, 0.95, 0.96));
  [0.2, 0.4, 0.6].forEach((r) => ring(g, r, 0.018, steel, 1, 0.95, 0.985));
  for (let k = 0; k < 4; k++) B(g, 1.4, 0.03, 0.03, steel, 1, 0.95, 0.985).rotation.z = (k * Math.PI) / 4;
  flat(Cyl(g, 0.08, 0.08, 0.06, steel, 1, 0.95, 0.99));
  B(g, 0.03, 1.3, 0.5, mat("#C3C9CF"), 1.93, 0.95, 0.5);
  return g;
});

// Door standing open (hinged on the left, swung toward the front)
reg("dooropen", "Open door", 2, 2, 3, true, (c) => {
  const g = new THREE.Group();
  const frame = mat(shade(c, 0.6));
  B(g, 0.25, 3.6, 0.96, frame, 0.125, 1.8, 0.5);
  B(g, 0.25, 3.6, 0.96, frame, 1.875, 1.8, 0.5);
  B(g, 2, 0.3, 0.96, frame, 1, 3.45, 0.5);
  B(g, 1.5, 0.05, 0.96, mat("#8A8D91"), 1, 0.025, 0.5); // threshold
  studs(g, 2, 1, 3.6, frame);
  const leaf = new THREE.Group();
  leaf.position.set(0.25, 0, 0.5);
  leaf.rotation.y = -1.05;
  g.add(leaf);
  B(leaf, 1.5, 3.3, 0.5, mat(c), 0.75, 1.65, 0);
  [0.28, -0.28].forEach((z) => Sph(leaf, 0.09, brass, 1.35, 1.6, z));
  return g;
});
// Window with both casement sashes swung open
reg("windowopen", "Open window", 2, 2, 2, true, (c) => {
  const g = new THREE.Group();
  const m = mat(c);
  B(g, 0.25, 2.4, 0.96, m, 0.125, 1.2, 0.5);
  B(g, 0.25, 2.4, 0.96, m, 1.875, 1.2, 0.5);
  B(g, 2, 0.3, 0.96, m, 1, 0.15, 0.5);
  B(g, 2, 0.3, 0.96, m, 1, 2.25, 0.5);
  studs(g, 2, 1, 2.4, m);
  [[0.25, -1.15, 1], [1.75, 1.15, -1]].forEach(([x, yaw, flip]) => {
    const sash = new THREE.Group();
    sash.position.set(x, 0, 0.5);
    sash.rotation.y = yaw;
    sash.scale.x = flip;
    g.add(sash);
    B(sash, 0.7, 1.7, 0.03, glass(), 0.375, 1.2, 0);
    [0.33, 2.07].forEach((y) => B(sash, 0.75, 0.06, 0.06, m, 0.375, y, 0));
    [0.03, 0.72].forEach((sx) => B(sash, 0.06, 1.8, 0.06, m, sx, 1.2, 0));
    Sph(sash, 0.05, brass, 0.65, 1.2, 0.05);
  });
  return g;
});

/* How the picker groups pieces */
export const GROUPS = [
  { title: "Bricks", keys: ["b1x1", "b1x2", "b1x3", "b1x4", "b2x2", "b2x3", "b2x4"] },
  { title: "Flat bricks (smooth top)", keys: ["f1x1", "f1x2", "f1x3", "f1x4", "f2x2", "f2x3", "f2x4"] },
  { title: "Flat tiles (thin)", keys: ["t1x2", "t2x2", "t2x4", "t4x4", "t4x8"] },
  { title: "Building parts", keys: ["window", "windowopen", "door", "dooropen"] },
  { title: "Roofs", keys: ["roof2", "roof4", "gable2", "gable4", "hip2", "hip4", "spire", "dome"] },
  { title: "Wooden logs", keys: ["log2", "log4", "logpile", "firewood", "stump"] },
  { title: "Trees", keys: ["pine", "oak", "palm"] },
  { title: "Plants and stones", keys: ["pot", "bush", "flowers", "sunflower", "cactus", "grass", "hedge", "stone", "boulder"] },
  { title: "People", keys: ["person", "worker"] },
  { title: "Road vehicles", keys: ["car", "bus"] },
  { title: "Two-wheelers", keys: ["bicycle", "kick", "scooter", "motorbike"] },
  { title: "Railway", keys: ["track2", "track4", "curve", "loco", "coach", "wagon"] },
  { title: "Water and boats", keys: ["pond", "river", "lake", "sea", "motorboat", "sailboat", "ship"] },
  { title: "Furniture", keys: ["stool", "chair", "armchair", "sofa", "table2", "table4", "dresser", "wardrobe", "bookshelf", "bed", "floorlamp"] },
  { title: "Bathroom", keys: ["toilet", "bathtub", "shower", "basin", "towels", "mirror"] },
  { title: "Home", keys: ["bulb", "tv", "fridge", "washer", "ac", "acout"] },
  { title: "Kitchen", keys: ["oven", "gasstove", "gascyl", "sink", "pan", "cookpot", "kettle", "utensils"] },
];

/* ---------- placement ---------- */
/* Rotate a piece 90 degrees at a time; the footprint swaps on odd turns and
   the result's origin stays at the min corner of the rotated footprint. */
export function buildPiece(type, color, id, rot = 0, ghostMat = null) {
  const inner = type.build(color);
  inner.position.set(-type.w / 2, 0, -type.d / 2);
  const pivot = new THREE.Group();
  pivot.add(inner);
  pivot.rotation.y = (rot * Math.PI) / 2;
  const [w, d] = rot % 2 ? [type.d, type.w] : [type.w, type.d];
  pivot.position.set(w / 2, 0, d / 2);
  const out = new THREE.Group();
  out.add(pivot);
  out.traverse((o) => {
    if (!o.isMesh) return;
    o.userData.id = id;
    if (ghostMat) {
      o.material = ghostMat;
      o.raycast = () => {};
    } else {
      o.castShadow = !o.material.transparent;
      o.receiveShadow = true;
    }
  });
  return out;
}

const overlaps = (p, x, z, w, d) => x < p.x + p.w && x + w > p.x && z < p.z + p.d && z + d > p.z;

/* Which layer would a piece land on, and is something un-stackable in the way? */
export function stackInfo(pieces, x, z, w, d) {
  let lvl = 0;
  for (const p of pieces) if (overlaps(p, x, z, w, d)) lvl = Math.max(lvl, p.y + p.h);
  const blocked = pieces.some((p) => overlaps(p, x, z, w, d) && p.y + p.h === lvl && !p.top);
  return { lvl, blocked };
}

/* After a removal, let anything left floating drop down. */
export function settle(pieces) {
  const out = [];
  [...pieces]
    .sort((a, b) => a.y - b.y)
    .forEach((p) => out.push({ ...p, y: stackInfo(out, p.x, p.z, p.w, p.d).lvl }));
  return out;
}
