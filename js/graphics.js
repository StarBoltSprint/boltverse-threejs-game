/**
 * BOLT ENGINE — Graphics polish pack
 * Procedural textures · sky dome · lighting · soft bloom · material helpers
 */
(function (global) {
  "use strict";
  const THREE = global.THREE;
  if (!THREE) return;

  // ---------------------------------------------------------------------------
  // Canvas procedural textures (no external images required)
  // ---------------------------------------------------------------------------
  function canvasTex(draw, size) {
    size = size || 512;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    draw(ctx, size);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function noise(ctx, size, alpha, color) {
    const img = ctx.createImageData(size, size);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = Math.random() * 255;
      d[i] = color[0];
      d[i + 1] = color[1];
      d[i + 2] = color[2];
      d[i + 3] = Math.floor(n * alpha);
    }
    ctx.putImageData(img, 0, 0);
  }

  /** Rich tileable ground — multi-layer microdetail for close camera */
  function makeGroundTexture(biomeId) {
    return canvasTex((ctx, s) => {
      let base, vein, speck, crack, glow;
      // Midtones lifted so grit/veins read under night lighting (not pure navy void)
      if (biomeId === "emberVoid") {
        base = ["#1a0c08", "#2a1410", "#3d1c12", "#5a2a18"];
        vein = "rgba(249,115,22,0.48)";
        speck = [220, 110, 55];
        crack = "rgba(90,35,12,0.6)";
        glow = "rgba(251,146,60,0.28)";
      } else if (biomeId === "whisperStars") {
        base = ["#0a0a18", "#12122a", "#1c1c3a", "#2a2a52"];
        vein = "rgba(165,180,252,0.4)";
        speck = [185, 195, 255];
        crack = "rgba(40,40,80,0.55)";
        glow = "rgba(129,140,248,0.24)";
      } else if (biomeId === "solarGold") {
        base = ["#1a1408", "#2a1e0c", "#3d2a12", "#5a3c18"];
        vein = "rgba(251,191,36,0.45)";
        speck = [240, 200, 80];
        crack = "rgba(70,45,12,0.55)";
        glow = "rgba(252,211,77,0.26)";
      } else if (biomeId === "frostGlacier") {
        base = ["#0a1624", "#122840", "#1a3a58", "#2a5580"];
        vein = "rgba(125,211,252,0.42)";
        speck = [200, 235, 255];
        crack = "rgba(25,50,85,0.6)";
        glow = "rgba(186,230,253,0.28)";
      } else if (biomeId === "jadeCanopy") {
        base = ["#061a10", "#0c2e1c", "#14402a", "#1e5a3a"];
        vein = "rgba(52,211,153,0.42)";
        speck = [100, 235, 180];
        crack = "rgba(12,50,30,0.55)";
        glow = "rgba(110,231,183,0.24)";
      } else if (biomeId === "rosePulse") {
        base = ["#180810", "#28141c", "#3a1c2c", "#552840"];
        vein = "rgba(244,114,182,0.42)";
        speck = [255, 140, 200];
        crack = "rgba(60,20,40,0.55)";
        glow = "rgba(249,168,212,0.26)";
      } else {
        // crystalNebula — teal slate dirt, not flat navy
        base = ["#0a1c2e", "#123048", "#1a4260", "#285878"];
        vein = "rgba(34,211,238,0.45)";
        speck = [120, 235, 250];
        crack = "rgba(18,50,75,0.55)";
        glow = "rgba(103,232,249,0.26)";
      }

      // Base multi-stop fill
      const g = ctx.createLinearGradient(0, 0, s, s);
      g.addColorStop(0, base[0]);
      g.addColorStop(0.35, base[1]);
      g.addColorStop(0.7, base[2]);
      g.addColorStop(1, base[3]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);

      // Large terrain mottling (continents of dirt)
      for (let i = 0; i < 90; i++) {
        const x = Math.random() * s;
        const y = Math.random() * s;
        const r = 20 + Math.random() * 90;
        const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, base[2]);
        grd.addColorStop(0.6, base[1]);
        grd.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grd;
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Fine crack network
      ctx.strokeStyle = crack;
      ctx.lineWidth = 1;
      for (let i = 0; i < 70; i++) {
        let x = Math.random() * s;
        let y = Math.random() * s;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let j = 0; j < 5; j++) {
          x += (Math.random() - 0.5) * 40;
          y += (Math.random() - 0.5) * 40;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Energy veins (organic only — no regular grid; grid read as wire mesh in-game)
      ctx.strokeStyle = vein;
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 48; i++) {
        let x = Math.random() * s;
        let y = Math.random() * s;
        ctx.globalAlpha = 0.45 + Math.random() * 0.4;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let j = 0; j < 7; j++) {
          x += (Math.random() - 0.5) * 55;
          y += (Math.random() - 0.5) * 55;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Micro pebbles / grit (higher contrast for night camera)
      for (let i = 0; i < 16000; i++) {
        const x = Math.random() * s;
        const y = Math.random() * s;
        const a = 0.12 + Math.random() * 0.5;
        const sz = Math.random() > 0.9 ? 2 + Math.random() * 2.5 : 1;
        ctx.fillStyle = `rgba(${speck[0]},${speck[1]},${speck[2]},${a})`;
        ctx.fillRect(x, y, sz, sz);
      }

      // Darker pebble shadows / cracks
      for (let i = 0; i < 4500; i++) {
        ctx.fillStyle = `rgba(0,0,0,${0.08 + Math.random() * 0.22})`;
        ctx.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 2.5, 1 + Math.random() * 1.5);
      }

      // Lighter dust patches so midtones survive dark lighting
      for (let i = 0; i < 40; i++) {
        const x = Math.random() * s;
        const y = Math.random() * s;
        const r = 18 + Math.random() * 55;
        const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, `rgba(${Math.min(255, speck[0] + 40)},${Math.min(255, speck[1] + 40)},${Math.min(255, speck[2] + 40)},0.18)`);
        grd.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Biolum glow pools (vein-local, not full-plane emissive)
      for (let i = 0; i < 70; i++) {
        const x = Math.random() * s;
        const y = Math.random() * s;
        const r = 8 + Math.random() * 42;
        const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, glow);
        grd.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Crystal / ember flecks
      for (let i = 0; i < 280; i++) {
        const x = Math.random() * s;
        const y = Math.random() * s;
        ctx.fillStyle = `rgba(${speck[0]},${speck[1]},${speck[2]},${0.4 + Math.random() * 0.55})`;
        ctx.beginPath();
        ctx.moveTo(x, y - 2.5);
        ctx.lineTo(x + 1.8, y);
        ctx.lineTo(x, y + 2.5);
        ctx.lineTo(x - 1.8, y);
        ctx.fill();
      }
    }, 1024);
  }

  /** Multi-scale height bump for grit + soft undulation */
  function makeGroundBump() {
    const tex = canvasTex((ctx, s) => {
      ctx.fillStyle = "#808080";
      ctx.fillRect(0, 0, s, s);
      // Broad hills
      for (let i = 0; i < 120; i++) {
        const x = Math.random() * s;
        const y = Math.random() * s;
        const r = 20 + Math.random() * 70;
        const v = 70 + Math.floor(Math.random() * 100);
        const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, `rgb(${v},${v},${v})`);
        grd.addColorStop(1, "rgb(128,128,128)");
        ctx.fillStyle = grd;
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      // Fine grit
      for (let i = 0; i < 14000; i++) {
        const v = 50 + Math.random() * 160;
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 2.5, 1 + Math.random() * 2);
      }
      // Ridge strokes
      ctx.strokeStyle = "rgba(200,200,200,0.35)";
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 90; i++) {
        let x = Math.random() * s;
        let y = Math.random() * s;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let j = 0; j < 4; j++) {
          x += (Math.random() - 0.5) * 35;
          y += (Math.random() - 0.5) * 35;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }, 512);
    if (THREE.NoColorSpace) tex.colorSpace = THREE.NoColorSpace;
    else if (THREE.LinearSRGBColorSpace) tex.colorSpace = THREE.LinearSRGBColorSpace;
    return tex;
  }

  /**
   * Procedural tangent-space normal map (no external assets).
   * Built from multi-frequency height so lighting sculpts grit at paw camera.
   */
  function makeGroundNormal() {
    const size = 512;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    const h = new Float32Array(size * size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let v = 0;
        v += Math.sin(x * 0.055 + y * 0.04) * 0.45;
        v += Math.sin(x * 0.14 - y * 0.11) * 0.28;
        v += Math.sin(x * 0.33 + y * 0.29) * 0.14;
        v += Math.sin(x * 0.7 - y * 0.55) * 0.07;
        v += (Math.random() - 0.5) * 0.4;
        h[y * size + x] = v;
      }
    }
    const img = ctx.createImageData(size, size);
    const strength = 3.2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const xl = h[y * size + ((x - 1 + size) % size)];
        const xr = h[y * size + ((x + 1) % size)];
        const yu = h[((y - 1 + size) % size) * size + x];
        const yd = h[((y + 1) % size) * size + x];
        let nx = (xl - xr) * strength;
        let ny = (yu - yd) * strength;
        let nz = 1;
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        nx /= len;
        ny /= len;
        nz /= len;
        const i = (y * size + x) * 4;
        img.data[i] = (nx * 0.5 + 0.5) * 255;
        img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
        img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    if (THREE.NoColorSpace) tex.colorSpace = THREE.NoColorSpace;
    else if (THREE.LinearSRGBColorSpace) tex.colorSpace = THREE.LinearSRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  function makeRockTexture(biomeId) {
    return canvasTex((ctx, s) => {
      let c0, c1;
      if (biomeId === "emberVoid") {
        c0 = "#2a1810";
        c1 = "#4a3020";
      } else if (biomeId === "whisperStars") {
        c0 = "#1e2433";
        c1 = "#3a4458";
      } else {
        c0 = "#2a3548";
        c1 = "#4a5a70";
      }
      ctx.fillStyle = c0;
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 80; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? c1 : c0;
        ctx.beginPath();
        ctx.ellipse(
          Math.random() * s,
          Math.random() * s,
          10 + Math.random() * 40,
          8 + Math.random() * 30,
          Math.random() * 6,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
      for (let i = 0; i < 2000; i++) {
        const v = 20 + Math.random() * 40;
        ctx.fillStyle = `rgba(${v},${v},${v + 10},0.4)`;
        ctx.fillRect(Math.random() * s, Math.random() * s, 2, 2);
      }
    }, 256);
  }

  function makeSkyTexture() {
    return canvasTex((ctx, s) => {
      // Richer cosmic gradient (zenith → horizon)
      const g = ctx.createLinearGradient(0, 0, 0, s);
      g.addColorStop(0, "#010108");
      g.addColorStop(0.22, "#06041a");
      g.addColorStop(0.42, "#0c0a32");
      g.addColorStop(0.58, "#142048");
      g.addColorStop(0.72, "#1a1450");
      g.addColorStop(0.88, "#0e1838");
      g.addColorStop(1, "#040612");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);

      // Layered nebulae (violet / cyan / magenta)
      const palette = [
        [90, 40, 180],
        [20, 120, 170],
        [160, 50, 120],
        [40, 80, 200],
        [30, 160, 140],
      ];
      for (let i = 0; i < 42; i++) {
        const x = Math.random() * s;
        const y = Math.random() * s * 0.85;
        const r = 50 + Math.random() * 160;
        const col = palette[i % palette.length];
        const a = 0.05 + Math.random() * 0.12;
        const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${a})`);
        rg.addColorStop(0.55, `rgba(${col[0]},${col[1]},${col[2]},${a * 0.35})`);
        rg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * (0.45 + Math.random() * 0.5), Math.random() * 6, 0, Math.PI * 2);
        ctx.fill();
      }

      // Milky band
      for (let i = 0; i < 120; i++) {
        const t = i / 120;
        const x = t * s + (Math.random() - 0.5) * 40;
        const y = s * 0.42 + Math.sin(t * 8) * s * 0.06 + (Math.random() - 0.5) * 30;
        const r = 8 + Math.random() * 28;
        const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, `rgba(200,210,255,${0.04 + Math.random() * 0.06})`);
        rg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Dense starfield + bright jewels
      for (let i = 0; i < 2200; i++) {
        const bright = Math.random();
        const a = 0.25 + bright * 0.75;
        const sz = bright > 0.97 ? 2.5 : bright > 0.85 ? 1.5 : 1;
        const warm = Math.random();
        if (warm < 0.12) ctx.fillStyle = `rgba(255,220,180,${a})`;
        else if (warm < 0.22) ctx.fillStyle = `rgba(180,200,255,${a})`;
        else ctx.fillStyle = `rgba(230,238,255,${a})`;
        ctx.fillRect(Math.random() * s, Math.random() * s, sz, sz);
      }
      // Soft glow on brightest stars
      for (let i = 0; i < 40; i++) {
        const x = Math.random() * s;
        const y = Math.random() * s;
        const r = 3 + Math.random() * 6;
        const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, "rgba(220,235,255,0.55)");
        rg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }, 1536);
  }

  // Cache textures
  const cache = {
    ground: {},
    rock: {},
    sky: null,
    groundBump: null,
    groundNormal: null,
  };

  function getGroundTexture(biomeId) {
    biomeId = biomeId || "crystalNebula";
    if (!cache.ground[biomeId]) cache.ground[biomeId] = makeGroundTexture(biomeId);
    return cache.ground[biomeId];
  }

  function getGroundBump() {
    if (!cache.groundBump) cache.groundBump = makeGroundBump();
    return cache.groundBump;
  }

  function getGroundNormal() {
    if (!cache.groundNormal) cache.groundNormal = makeGroundNormal();
    return cache.groundNormal;
  }

  function getRockTexture(biomeId) {
    biomeId = biomeId || "crystalNebula";
    if (!cache.rock[biomeId]) cache.rock[biomeId] = makeRockTexture(biomeId);
    return cache.rock[biomeId];
  }

  function getSkyTexture() {
    if (!cache.sky) cache.sky = makeSkyTexture();
    return cache.sky;
  }

  // ---------------------------------------------------------------------------
  // Sky dome
  // ---------------------------------------------------------------------------
  function createSkyDome(scene) {
    const geo = new THREE.SphereGeometry(1200, 64, 48);
    const mat = new THREE.MeshBasicMaterial({
      map: getSkyTexture(),
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    const dome = new THREE.Mesh(geo, mat);
    dome.name = "SkyDome";
    dome.renderOrder = -100;
    scene.add(dome);
    return dome;
  }

  /**
   * Reactive sky (tiers 1–5): shader dome + parallax stars + nebulae +
   * gate halo + lightning veins. Driven by sprint / scale / biome / resonance.
   */
  function createReactiveSky(scene) {
    const root = new THREE.Group();
    root.name = "ReactiveSky";
    scene.add(root);

    // Punchy palettes — saturated horizon so biome identity reads at a glance
    const BIOME_SKY = {
      crystalNebula: { zenith: 0x020818, horizon: 0x0e5a9a, accent: 0x22d3ee, band: 0xd8b4fe },
      emberVoid: { zenith: 0x140402, horizon: 0xb02e0c, accent: 0xfb923c, band: 0xff4d6d },
      whisperStars: { zenith: 0x05041a, horizon: 0x3b1f8a, accent: 0xc4b5fd, band: 0xf5e1ff },
      solarGold: { zenith: 0x120a02, horizon: 0x9a5c10, accent: 0xfbbf24, band: 0xfff1b8 },
      frostGlacier: { zenith: 0x020a16, horizon: 0x0a5a8a, accent: 0x38bdf8, band: 0xe0f2fe },
      jadeCanopy: { zenith: 0x020e08, horizon: 0x0c5a38, accent: 0x34d399, band: 0x86efac },
      rosePulse: { zenith: 0x10040c, horizon: 0x6a1848, accent: 0xf472b6, band: 0xfbcfe8 },
    };
    const _skyZ = new THREE.Color();
    const _skyH = new THREE.Color();
    const _skyA = new THREE.Color();
    const _skyB = new THREE.Color();

    const uniforms = {
      uTime: { value: 0 },
      uSprint: { value: 0 },
      uScale: { value: 0 },
      uResonance: { value: 0 },
      uMeaningful: { value: 0 },
      uAltitude: { value: 0 },
      uSkyDark: { value: 0 },
      uGate: { value: 0 },
      uHowl: { value: 0 },
      uCore: { value: 0 },
      uZenith: { value: new THREE.Color(0x02061a) },
      uHorizon: { value: new THREE.Color(0x0a3a6e) },
      uAccent: { value: new THREE.Color(0x22d3ee) },
      uBand: { value: new THREE.Color(0xc084fc) },
      uVelDir: { value: new THREE.Vector2(0, 0) },
    };

    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthTest: false,
      depthWrite: false,
      fog: false,
      uniforms: uniforms,
      vertexShader: [
        "varying vec3 vDir;",
        "void main() {",
        "  vDir = normalize(position);",
        "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
        "}",
      ].join("\n"),
      fragmentShader: [
        "precision mediump float;",
        "varying vec3 vDir;",
        "uniform float uTime;",
        "uniform float uSprint;",
        "uniform float uScale;",
        "uniform float uResonance;",
        "uniform float uMeaningful;",
        "uniform float uAltitude;",
        "uniform float uSkyDark;",
        "uniform float uGate;",
        "uniform float uHowl;",
        "uniform float uCore;",
        "uniform vec3 uZenith;",
        "uniform vec3 uHorizon;",
        "uniform vec3 uAccent;",
        "uniform vec3 uBand;",
        "uniform vec2 uVelDir;",
        "float hash(vec2 p) {",
        "  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);",
        "}",
        "float noise(vec2 p) {",
        "  vec2 i = floor(p);",
        "  vec2 f = fract(p);",
        "  float a = hash(i);",
        "  float b = hash(i + vec2(1.0, 0.0));",
        "  float c = hash(i + vec2(0.0, 1.0));",
        "  float d = hash(i + vec2(1.0, 1.0));",
        "  vec2 u = f * f * (3.0 - 2.0 * f);",
        "  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;",
        "}",
        "float fbm(vec2 p) {",
        "  float v = 0.0; float a = 0.5;",
        "  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.07; a *= 0.5; }",
        "  return v;",
        "}",
        // Multi-scale seamless star field (no point-cloud sphere)
        "float stars(vec3 d, float dens, float t) {",
        "  float s = 0.0;",
        "  // Layer 1 dense field",
        "  vec2 p1 = d.xy * 110.0 + d.z * 80.0;",
        "  float h1 = hash(floor(p1));",
        "  float c1 = step(1.0 - 0.045 * dens, h1) * smoothstep(0.28, 0.0, length(fract(p1) - 0.5));",
        "  s += c1 * (0.55 + 0.45 * sin(t * (2.0 + h1 * 6.0) + h1 * 30.0));",
        "  // Layer 2 mid",
        "  vec2 p2 = d.xz * 70.0 + d.y * 55.0 + 17.0;",
        "  float h2 = hash(floor(p2));",
        "  float c2 = step(1.0 - 0.028 * dens, h2) * smoothstep(0.32, 0.0, length(fract(p2) - 0.5));",
        "  s += c2 * 1.15 * (0.6 + 0.4 * sin(t * 3.0 + h2 * 20.0));",
        "  // Layer 3 jewels",
        "  vec2 p3 = d.yz * 42.0 + d.x * 38.0 + 41.0;",
        "  float h3 = hash(floor(p3));",
        "  float c3 = step(1.0 - 0.012 * dens, h3) * smoothstep(0.4, 0.0, length(fract(p3) - 0.5));",
        "  s += c3 * 2.2;",
        "  // Soft glow around jewels",
        "  s += c3 * 0.65 * (1.0 - smoothstep(0.0, 0.55, length(fract(p3) - 0.5)));",
        "  return s;",
        "}",
        "void main() {",
        "  vec3 d = normalize(vDir);",
        "  float h = d.y;", // -1..1
        "  float ht = smoothstep(-0.25, 0.9, h * 0.5 + 0.5);",
        "  // Base gradient — horizon punchy, zenith deep",
        "  vec3 col = mix(uHorizon * 1.15, uZenith, ht);",
        "  col = mix(col, uZenith * 0.35, uSkyDark * 0.85 * ht);",
        "",
        "  // Velocity-stretched UVs (sprint warps the cosmos)",
        "  vec2 uv = d.xz * (1.6 + uScale * 0.4) + uVelDir * uSprint * 0.85;",
        "  float tSpin = uTime * (0.018 + uSprint * 0.04);",
        "  uv += vec2(tSpin, uTime * 0.012);",
        "",
        "  // Bold multi-scale nebulae",
        "  float nA = fbm(uv * 1.1 + 2.0);",
        "  float nB = fbm(uv * 2.4 - uTime * 0.03 + 9.0);",
        "  float nC = fbm(uv * 4.2 + uTime * 0.02 + 19.0);",
        "  float skyMask = smoothstep(-0.2, 0.55, h * 0.5 + 0.5);",
        "  float nebPow = 0.22 + uSprint * 0.38 + uScale * 0.28 + uResonance * 0.22 + uMeaningful * 0.18;",
        "  float neb1 = smoothstep(0.28, 0.82, nA) * nebPow;",
        "  float neb2 = smoothstep(0.35, 0.88, nB) * nebPow * 0.75;",
        "  float neb3 = smoothstep(0.4, 0.9, nC) * nebPow * 0.45;",
        "  col += uAccent * neb1 * 0.95 * skyMask;",
        "  col += uBand * neb2 * 0.85 * skyMask;",
        "  col += mix(uAccent, uBand, 0.5) * neb3 * 0.7 * skyMask;",
        "",
        "  // Dense cloud sheets (large structure)",
        "  float sheets = smoothstep(0.45, 0.95, fbm(d.xz * 0.9 + uTime * 0.01 + uVelDir * uSprint));",
        "  col += uBand * sheets * (0.12 + uSprint * 0.2 + uScale * 0.15) * skyMask;",
        "",
        "  // Aurora ribbons (resonance / sprint / gate)",
        "  float aurAmt = uResonance * 0.55 + uSprint * 0.35 + uGate * 0.4 + uScale * 0.2;",
        "  float ribbon = sin(d.x * 6.5 + d.z * 4.0 + uTime * (1.2 + uSprint * 2.0));",
        "  ribbon = pow(abs(ribbon), 3.5);",
        "  float aurY = exp(-pow(h - 0.25, 2.0) * 6.0);",
        "  col += mix(uAccent, uBand, 0.45) * ribbon * aurY * aurAmt * 0.85;",
        "  // Second ribbon offset",
        "  float ribbon2 = sin(d.x * 4.0 - d.z * 7.0 + uTime * 0.9 + 2.0);",
        "  ribbon2 = pow(abs(ribbon2), 4.0);",
        "  col += uAccent * ribbon2 * exp(-pow(h - 0.4, 2.0) * 8.0) * aurAmt * 0.45;",
        "",
        "  // Milky band",
        "  float band = exp(-pow(h, 2.0) * 5.5) * (0.14 + uScale * 0.28 + uSprint * 0.12);",
        "  band *= 0.4 + fbm(d.xz * 3.5 + uTime * 0.015);",
        "  col += mix(uAccent, uBand, 0.55) * band;",
        "",
        "  // Dense seamless stars (shader only — no point sphere)",
        "  float dens = 1.1 + uSkyDark * 0.9 + uScale * 0.7 + uAltitude * 0.4 + uSprint * 0.35 + uCore * 0.3;",
        "  float st = stars(d, dens, uTime);",
        "  col += vec3(0.92, 0.96, 1.0) * st * (0.75 + uSprint * 0.55 + uScale * 0.5);",
        "  col += uAccent * st * 0.22 * (0.5 + uCore);",
        "",
        "  // Bright jewels (constellation accents)",
        "  vec2 jp = d.xy * 28.0 + d.z * 22.0;",
        "  float jh = hash(floor(jp));",
        "  float jewel = step(0.992, jh) * smoothstep(0.45, 0.0, length(fract(jp) - 0.5));",
        "  float jglow = jewel * (1.0 - smoothstep(0.0, 0.7, length(fract(jp) - 0.5)));",
        "  col += mix(uAccent, vec3(1.0), 0.4) * (jewel * 2.4 + jglow * 1.2) * (1.0 + uSprint * 0.6 + uCore * 0.5);",
        "",
        "  // Meaningful gate — wide soft horizon bloom",
        "  float gate = exp(-pow(h - 0.05, 2.0) * 14.0) * uGate;",
        "  gate *= 0.35 + 0.2 * sin(uTime * 2.0);",
        "  col += uAccent * gate * 1.4;",
        "  col += uBand * gate * 0.35;",
        "",
        "  // Howl lightning veins across the dome",
        "  float vein = abs(sin(d.x * 14.0 + d.z * 11.0 + uTime * 8.0));",
        "  vein = pow(1.0 - vein, 10.0) * uHowl;",
        "  float vein2 = abs(sin(d.x * 9.0 - d.z * 16.0 + uTime * 6.0 + 1.5));",
        "  vein2 = pow(1.0 - vein2, 12.0) * uHowl;",
        "  col += uAccent * (vein + vein2) * (0.9 + uSprint * 0.6);",
        "",
        "  // Horizon energy wash — strong biome band so sky identity reads at rest",
        "  float edge = exp(-abs(h) * 3.2) * (0.22 + uSprint * 0.22 + uMeaningful * 0.16 + uScale * 0.1);",
        "  col += uAccent * edge;",
        "  col += uHorizon * exp(-abs(h + 0.05) * 5.0) * 0.35;",
        "",
        "  // Exposure: core + sprint make the cosmos open",
        "  col *= 0.95 + uCore * 0.28 + uSprint * 0.12 + uScale * 0.15;",
        "  // Orbital void deepens zenith without flattening horizon drama",
        "  col = mix(col, col * vec3(0.75, 0.8, 1.0), uSkyDark * 0.35 * ht);",
        "",
        "  // Soft filmic clamp",
        "  col = col / (1.0 + col * 0.35);",
        "  gl_FragColor = vec4(col, 1.0);",
        "}",
      ].join("\n"),
    });

    // Huge fixed-radius dome (must exceed camera.far so limb never enters FOV)
    const DOME_R = 4800;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(DOME_R, 32, 24), skyMat);
    dome.name = "ReactiveSkyDome";
    dome.renderOrder = -1000;
    dome.frustumCulled = false;
    root.add(dome);

    // Soft nebula billboard shells (tier 3)
    const nebulaGroup = new THREE.Group();
    nebulaGroup.name = "SkyNebulae";
    root.add(nebulaGroup);
    const nebulaMeshes = [];
    const nebulaColors = [
      [100, 60, 200],
      [20, 160, 200],
      [200, 90, 50],
      [60, 200, 160],
      [180, 80, 180],
    ];
    for (let i = 0; i < 5; i++) {
      const c = nebulaColors[i];
      const tex = makeNebulaSpriteTexture(c[0], c[1], c[2]);
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity: 0.18,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        fog: false,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(520, 340), mat);
      const a = (i / 5) * Math.PI * 2;
      const r = 900 + i * 90;
      mesh.position.set(Math.cos(a) * r, (i - 2) * 70, Math.sin(a) * r * 0.7);
      mesh.lookAt(0, 0, 0);
      mesh.renderOrder = -990;
      mesh.userData.baseOp = 0.14 + i * 0.03;
      mesh.userData.phase = i * 1.3;
      mesh.position.multiplyScalar(1.2);
      nebulaGroup.add(mesh);
      nebulaMeshes.push(mesh);
    }

    // Gate halo — shader handles gate; keep mesh subtle & depth-free
    const gateMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
      side: THREE.DoubleSide,
    });
    const gateHalo = new THREE.Mesh(
      new THREE.TorusGeometry(1100, 6, 6, 48),
      gateMat
    );
    gateHalo.rotation.x = Math.PI / 2;
    gateHalo.position.y = 20;
    gateHalo.renderOrder = -980;
    gateHalo.visible = false; // mesh ring read as a sphere edge; shader gate is enough
    root.add(gateHalo);

    // Lightning bolt flashes (tier 5)
    const flashGroup = new THREE.Group();
    flashGroup.name = "SkyLightning";
    root.add(flashGroup);
    const flashMats = [];
    for (let i = 0; i < 6; i++) {
      const m = new THREE.MeshBasicMaterial({
        color: 0x67e8f9,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      });
      const line = new THREE.Mesh(
        new THREE.CylinderGeometry(1.5, 0.4, 180 + Math.random() * 120, 4),
        m
      );
      line.position.set(
        (Math.random() - 0.5) * 600,
        200 + Math.random() * 200,
        (Math.random() - 0.5) * 600
      );
      line.rotation.z = (Math.random() - 0.5) * 0.8;
      line.rotation.x = (Math.random() - 0.5) * 0.5;
      flashGroup.add(line);
      flashMats.push({ mesh: line, mat: m, cool: Math.random() * 4 });
    }

    // Procedural comets / meteors — streak pool across the dome
    const cometGroup = new THREE.Group();
    cometGroup.name = "SkyComets";
    root.add(cometGroup);
    const COMET_POOL = 14;
    const comets = [];
    const _cometTail = new THREE.Vector3();
    const _cometUp = new THREE.Vector3(0, 1, 0);
    const _cometWhite = new THREE.Color(0xffffff);
    // Shared thin streak geo (stretched in local Y); origin at head, tail along +Y
    const cometGeo = new THREE.CylinderGeometry(0.6, 0.05, 1, 5, 1, true);
    cometGeo.translate(0, 0.5, 0);
    for (let i = 0; i < COMET_POOL; i++) {
      const bodyMat = new THREE.MeshBasicMaterial({
        color: 0xa5f3fc,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
        side: THREE.DoubleSide,
      });
      const headMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      });
      const body = new THREE.Mesh(cometGeo, bodyMat);
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(1, 6, 6),
        headMat
      );
      body.renderOrder = -970;
      head.renderOrder = -969;
      body.visible = false;
      head.visible = false;
      cometGroup.add(body);
      cometGroup.add(head);
      comets.push({
        body: body,
        head: head,
        bodyMat: bodyMat,
        headMat: headMat,
        active: false,
        life: 0,
        maxLife: 1,
        // Local offsets from camera/root (root follows camera)
        px: 0,
        py: 0,
        pz: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        len: 80,
        thick: 1.2,
        kind: "meteor", // meteor | comet
      });
    }
    let cometSpawnAcc = 0.4 + Math.random() * 1.2;
    let cometBurst = 0; // external burst timer (gate/pack)

    function activateComet(forceKind) {
      let slot = null;
      for (let i = 0; i < comets.length; i++) {
        if (!comets[i].active) {
          slot = comets[i];
          break;
        }
      }
      if (!slot) return false;

      const kind =
        forceKind ||
        (Math.random() < 0.22 ? "comet" : "meteor");
      // Spawn on a sky shell around the player (local space)
      const elev = 0.15 + Math.random() * 0.55; // up-hemisphere bias
      const az = Math.random() * Math.PI * 2;
      const r = 420 + Math.random() * 380;
      const cosE = Math.cos(elev * Math.PI * 0.5);
      slot.px = Math.cos(az) * r * cosE;
      slot.py = Math.sin(elev * Math.PI * 0.5) * r * 0.75 + 80;
      slot.pz = Math.sin(az) * r * cosE;

      // Flight direction: mostly lateral + slight downward arc
      const dirAz = az + Math.PI * 0.5 + (Math.random() - 0.5) * 0.9;
      const speed =
        kind === "comet"
          ? 90 + Math.random() * 70
          : 160 + Math.random() * 140;
      slot.vx = Math.cos(dirAz) * speed;
      slot.vz = Math.sin(dirAz) * speed;
      slot.vy = -speed * (0.12 + Math.random() * 0.28);

      slot.len = kind === "comet" ? 140 + Math.random() * 160 : 55 + Math.random() * 90;
      slot.thick = kind === "comet" ? 2.2 + Math.random() * 1.4 : 1.0 + Math.random() * 1.1;
      slot.maxLife = kind === "comet" ? 1.6 + Math.random() * 1.4 : 0.55 + Math.random() * 0.55;
      slot.life = slot.maxLife;
      slot.kind = kind;
      slot.active = true;
      slot.body.visible = true;
      slot.head.visible = true;
      slot.bodyMat.opacity = 0;
      slot.headMat.opacity = 0;
      return true;
    }

    function spawnComet(opts) {
      opts = opts || {};
      const n = opts.count != null ? opts.count : 1;
      let spawned = 0;
      for (let i = 0; i < n; i++) {
        if (activateComet(opts.kind)) spawned++;
      }
      if (opts.burst) cometBurst = Math.max(cometBurst, opts.burst);
      return spawned;
    }

    function updateComets(dt, drive) {
      drive = drive || {};
      // Spawn rate: ambient + sprint + gate + howl + pack + altitude
      const rate =
        0.08 +
        (drive.sprint || 0) * 0.55 +
        (drive.gate || 0) * 0.7 +
        (drive.howl || 0) * 1.2 +
        (drive.pack || 0) * 0.9 +
        (drive.scale || 0) * 0.25 +
        (drive.altitude || 0) * 0.2 +
        (cometBurst > 0 ? 1.8 : 0);
      cometBurst = Math.max(0, cometBurst - dt);
      cometSpawnAcc -= dt * rate;
      if (cometSpawnAcc <= 0) {
        activateComet(drive.preferKind || null);
        // Shorter gap when energetic
        cometSpawnAcc = (0.35 + Math.random() * 1.4) / Math.max(0.35, rate * 0.85);
        // Occasional double streak during gate/sprint
        if ((drive.gate || 0) > 0.4 && Math.random() < 0.35) activateComet("meteor");
        if ((drive.sprint || 0) > 0.7 && Math.random() < 0.2) activateComet("comet");
      }

      const accent = drive.accent;
      for (let i = 0; i < comets.length; i++) {
        const c = comets[i];
        if (!c.active) continue;
        c.life -= dt;
        if (c.life <= 0) {
          c.active = false;
          c.body.visible = false;
          c.head.visible = false;
          c.bodyMat.opacity = 0;
          c.headMat.opacity = 0;
          continue;
        }
        c.px += c.vx * dt;
        c.py += c.vy * dt;
        c.pz += c.vz * dt;
        // Fade in / out envelope
        const u = 1 - c.life / c.maxLife;
        let alpha = 1;
        if (u < 0.12) alpha = u / 0.12;
        else if (u > 0.7) alpha = (1 - u) / 0.3;
        alpha = Math.max(0, Math.min(1, alpha));
        const peak = c.kind === "comet" ? 0.85 : 0.95;
        c.bodyMat.opacity = alpha * peak * 0.75;
        c.headMat.opacity = alpha * peak;

        // Position head; stretch body along velocity (tail behind)
        c.head.position.set(c.px, c.py, c.pz);
        const spd = Math.sqrt(c.vx * c.vx + c.vy * c.vy + c.vz * c.vz) || 1;
        _cometTail.set(-c.vx / spd, -c.vy / spd, -c.vz / spd);
        // Body origin at head, extend toward tail (+Y)
        c.body.position.set(c.px, c.py, c.pz);
        c.body.scale.set(c.thick, c.len, c.thick);
        c.body.quaternion.setFromUnitVectors(_cometUp, _cometTail);

        // Color: meteors warm/white, comets accent/cyan
        if (c.kind === "comet" && accent && accent.isColor) {
          c.bodyMat.color.copy(accent);
          c.headMat.color.copy(accent).lerp(_cometWhite, 0.45);
        } else if (c.kind === "meteor") {
          c.bodyMat.color.setHex(0xffe7a8);
          c.headMat.color.setHex(0xfff7ed);
        } else {
          c.bodyMat.color.setHex(0x7dd3fc);
          c.headMat.color.setHex(0xe0f2fe);
        }
        const headR = c.kind === "comet" ? 3.2 : 2.0;
        c.head.scale.setScalar(headR * (0.85 + alpha * 0.35));
      }
    }

    // Point-star shells create a visible sphere limb vs the shader sky.
    // Prefer seamless shader stars; keep a tiny jewel layer only (optional).
    const stars = createCosmicStarfield(scene, { light: true });
    if (stars && stars.group) {
      // Hide dense layers — shader dome owns the seamless sky
      stars.group.visible = false;
    }

    // State smoothers
    const smooth = {
      sprint: 0,
      scale: 0,
      res: 0,
      mean: 0,
      alt: 0,
      dark: 0,
      gate: 0,
      howl: 0,
      core: 0,
    };

    function update(opts) {
      opts = opts || {};
      const dt = opts.dt != null ? opts.dt : 0.016;
      const t = performance.now() * 0.001;
      uniforms.uTime.value = t;

      const sprint = THREE.MathUtils.clamp(
        (opts.sprint ? 0.55 : 0) + (opts.momentum || 0) * 0.65 + Math.min(1, (opts.speed || 0) / 40) * 0.35,
        0,
        1
      );
      const scale = THREE.MathUtils.clamp(opts.scale != null ? opts.scale : 0, 0, 1);
      const res = THREE.MathUtils.clamp(opts.resonance || 0, 0, 1);
      const mean = THREE.MathUtils.clamp(opts.meaningful || 0, 0, 1);
      const alt = THREE.MathUtils.clamp(opts.altitude || 0, 0, 1);
      const dark = THREE.MathUtils.clamp(opts.skyDark || 0, 0, 1);
      const gate = mean >= 0.62 ? THREE.MathUtils.smoothstep(mean, 0.62, 0.95) : 0;
      const howl = THREE.MathUtils.clamp(opts.howl || 0, 0, 1);
      const core = THREE.MathUtils.clamp(opts.core || 0, 0, 1);

      // Snappier response so sprint/biome reads immediately
      smooth.sprint = THREE.MathUtils.damp(smooth.sprint, sprint, 3.5, dt);
      smooth.scale = THREE.MathUtils.damp(smooth.scale, scale, 2.4, dt);
      smooth.res = THREE.MathUtils.damp(smooth.res, res, 2.8, dt);
      smooth.mean = THREE.MathUtils.damp(smooth.mean, mean, 2.8, dt);
      smooth.alt = THREE.MathUtils.damp(smooth.alt, alt, 1.6, dt);
      smooth.dark = THREE.MathUtils.damp(smooth.dark, dark, 1.5, dt);
      smooth.gate = THREE.MathUtils.damp(smooth.gate, gate, 2.2, dt);
      smooth.howl = THREE.MathUtils.damp(smooth.howl, howl, 4.0, dt);
      smooth.core = THREE.MathUtils.damp(smooth.core, core, 1.4, dt);

      uniforms.uSprint.value = smooth.sprint;
      uniforms.uScale.value = smooth.scale;
      uniforms.uResonance.value = smooth.res;
      uniforms.uMeaningful.value = smooth.mean;
      uniforms.uAltitude.value = smooth.alt;
      uniforms.uSkyDark.value = smooth.dark;
      uniforms.uGate.value = smooth.gate;
      uniforms.uHowl.value = smooth.howl;
      uniforms.uCore.value = smooth.core;

      // Biome palette — snappy so horizon/accent recolor when you cross cells
      const bid = opts.biomeId || "crystalNebula";
      const pal = BIOME_SKY[bid] || BIOME_SKY.crystalNebula;
      const tSky = 1 - Math.exp(-dt * 4.5);
      const tAcc = 1 - Math.exp(-dt * 5.0);
      uniforms.uZenith.value.lerp(_skyZ.setHex(pal.zenith), tSky);
      uniforms.uHorizon.value.lerp(_skyH.setHex(pal.horizon), tSky);
      uniforms.uAccent.value.lerp(_skyA.setHex(pal.accent), tAcc);
      uniforms.uBand.value.lerp(_skyB.setHex(pal.band), tAcc);
      // Soft rim tint only (never dark sky hex — that crushed ember/gold horizons)
      if (opts.biomeTint && opts.biomeTint.isColor) {
        uniforms.uHorizon.value.lerp(opts.biomeTint, 0.06);
        uniforms.uAccent.value.lerp(opts.biomeTint, 0.04);
      }

      // Velocity stretch on sky
      if (opts.velocity) {
        const vx = opts.velocity.x || 0;
        const vz = opts.velocity.z || 0;
        const len = Math.hypot(vx, vz) || 1;
        uniforms.uVelDir.value.set(vx / len, vz / len);
      }

      // Lock sky to camera center every frame (must stay *inside* the sphere)
      const follow = opts.cameraPos || opts.playerPos;
      if (follow) {
        root.position.copy(follow);
      }
      // Never scale the dome — radius is fixed so the limb never appears as a bubble
      dome.scale.set(1, 1, 1);
      dome.rotation.y += dt * (0.004 + smooth.sprint * 0.012 + smooth.scale * 0.006);

      // Soft additive sheets reinforce shader (biome-tinted)
      for (let i = 0; i < nebulaMeshes.length; i++) {
        const m = nebulaMeshes[i];
        m.material.opacity =
          m.userData.baseOp *
          (0.55 + smooth.sprint * 0.7 + smooth.scale * 0.55 + smooth.res * 0.4 + smooth.dark * 0.35) *
          (0.85 + 0.15 * Math.sin(t * 0.4 + m.userData.phase));
        m.material.color.copy(uniforms.uAccent.value);
        m.rotation.z += dt * (0.02 + i * 0.005) * (1 + smooth.sprint);
      }

      // Gate mesh barely visible — shader gate is softer
      gateMat.opacity = smooth.gate * (0.08 + 0.05 * Math.sin(t * 1.8));
      gateHalo.rotation.z += dt * (0.05 + smooth.gate * 0.12);
      gateHalo.scale.setScalar(1 + smooth.sprint * 0.04);
      gateMat.color.copy(uniforms.uAccent.value);

      // Lightning flashes
      for (let i = 0; i < flashMats.length; i++) {
        const f = flashMats[i];
        f.cool -= dt;
        if (smooth.howl > 0.3 || (smooth.mean > 0.7 && Math.random() < 0.002 * (1 + smooth.sprint))) {
          if (f.cool <= 0) {
            f.mat.opacity = 0.55 + smooth.howl * 0.4;
            f.cool = 0.08 + Math.random() * 0.15;
            f.mesh.position.set(
              (Math.random() - 0.5) * 700,
              150 + Math.random() * 250,
              (Math.random() - 0.5) * 700
            );
            f.mat.color.copy(uniforms.uAccent.value);
          }
        }
        f.mat.opacity = Math.max(0, f.mat.opacity - dt * 4.5);
      }

      // Procedural comets / meteors (rate from sprint/gate/howl/pack; bursts via spawnComet)
      updateComets(dt, {
        sprint: smooth.sprint,
        gate: smooth.gate,
        howl: smooth.howl,
        pack: THREE.MathUtils.clamp(opts.pack || 0, 0, 1),
        scale: smooth.scale,
        altitude: smooth.alt,
        accent: uniforms.uAccent.value,
        preferKind: opts.cometKind || null,
      });

      // Stars
      const starBoost =
        (opts.starBoost != null ? opts.starBoost : 1) *
        (1 + smooth.sprint * 0.45 + smooth.dark * 0.8 + smooth.scale * 0.5);
      if (stars && stars.update) {
        stars.update(follow || new THREE.Vector3(), starBoost, dt, {
          sprint: smooth.sprint,
          biomeId: bid,
          accent: uniforms.uAccent.value,
          scale: smooth.scale,
          velocity: opts.velocity,
        });
      }
    }

    return {
      group: root,
      dome: dome,
      stars: stars,
      update: update,
      uniforms: uniforms,
      spawnComet: spawnComet,
    };
  }

  /**
   * High-detail Spiral-47 home world map (day albedo + night lights + bump).
   * Contrast is intentionally strong so continents read from orbit.
   */
  function makePlanetAlbedo(seed) {
    seed = seed || 47;
    function rnd() {
      seed = (seed * 16807 + 0) % 2147483647;
      return (seed & 0x7fffffff) / 2147483647;
    }
    function n2(x, y) {
      const s = Math.sin(x * 127.1 + y * 311.7 + seed * 0.01) * 43758.5453;
      return s - Math.floor(s);
    }
    function fbm(x, y, oct) {
      let v = 0, a = 0.5, f = 1;
      for (let i = 0; i < (oct || 5); i++) {
        v += a * n2(x * f, y * f);
        a *= 0.5;
        f *= 2.05;
      }
      return v;
    }
    return canvasTex((ctx, s) => {
      const img = ctx.createImageData(s, s);
      const d = img.data;
      for (let y = 0; y < s; y++) {
        for (let x = 0; x < s; x++) {
          const u = x / s;
          const v = y / s;
          // Latitude warp for organic continents (not just polar bands)
          const lat = (v - 0.5) * 2;
          const elev =
            fbm(u * 4.2 + 2.1, v * 3.8, 6) * 0.55 +
            fbm(u * 9 + 10, v * 8, 4) * 0.25 +
            fbm(u * 18, v * 16, 3) * 0.12 +
            Math.abs(lat) * 0.08;
          const i = (y * s + x) * 4;
          let r, g, b;
          if (elev < 0.38) {
            // Deep → shallow ocean
            const t = elev / 0.38;
            r = 4 + t * 12;
            g = 18 + t * 70;
            b = 48 + t * 90;
            // Shallows / reef glow
            if (elev > 0.32) {
              r += 20;
              g += 90;
              b += 60;
            }
          } else if (elev < 0.42) {
            // Beach / crystal shore
            const t = (elev - 0.38) / 0.04;
            r = 40 + t * 80;
            g = 110 + t * 40;
            b = 120 - t * 40;
          } else if (elev < 0.62) {
            // Lowlands — green / crystal plains / violet fields
            const bio = fbm(u * 6 + 3, v * 6, 3);
            if (bio < 0.35) {
              r = 18; g = 90 + elev * 40; b = 55; // verdant
            } else if (bio < 0.65) {
              r = 30; g = 70; b = 110 + elev * 50; // crystal teal
            } else {
              r = 70 + elev * 40; g = 40; b = 120; // whisper violet
            }
            // Speckle forests
            if (fbm(u * 40, v * 40, 2) > 0.62) {
              r *= 0.65; g *= 0.85; b *= 0.7;
            }
          } else if (elev < 0.78) {
            // Highlands / rock
            const t = (elev - 0.62) / 0.16;
            r = 70 + t * 50;
            g = 55 + t * 30;
            b = 48 + t * 20;
          } else if (Math.abs(lat) > 0.72 || elev > 0.88) {
            // Ice / polar
            const ice = 200 + fbm(u * 20, v * 20, 2) * 40;
            r = ice; g = ice + 8; b = ice + 18;
          } else {
            // Peaks / snow
            r = 180; g = 190; b = 205;
          }
          // Ember rifts on land
          if (elev > 0.45 && fbm(u * 22 + 5, v * 22, 3) > 0.78) {
            r = Math.min(255, r + 90);
            g = Math.max(20, g - 30);
            b = Math.max(10, b - 40);
          }
          d[i] = Math.min(255, r);
          d[i + 1] = Math.min(255, g);
          d[i + 2] = Math.min(255, b);
          d[i + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);

      // City / resonance lights (bright dots on land only — sampled again cheaply)
      for (let k = 0; k < 900; k++) {
        const x = rnd() * s;
        const y = rnd() * s;
        const elev = fbm(x / s * 4.2 + 2.1, y / s * 3.8, 4);
        if (elev < 0.42 || elev > 0.82) continue;
        const gold = rnd() > 0.45;
        ctx.fillStyle = gold
          ? `rgba(255,200,80,${0.35 + rnd() * 0.55})`
          : `rgba(100,230,255,${0.3 + rnd() * 0.5})`;
        const sz = rnd() > 0.92 ? 2.5 : 1 + rnd();
        ctx.fillRect(x, y, sz, sz);
      }

      // Soft equatorial glow band
      const band = ctx.createLinearGradient(0, s * 0.42, 0, s * 0.58);
      band.addColorStop(0, "rgba(61,240,255,0)");
      band.addColorStop(0.5, "rgba(61,240,255,0.08)");
      band.addColorStop(1, "rgba(61,240,255,0)");
      ctx.fillStyle = band;
      ctx.fillRect(0, 0, s, s);
    }, 1536);
  }

  function makePlanetEmissive() {
    return canvasTex((ctx, s) => {
      ctx.fillStyle = "#000010";
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 1400; i++) {
        const x = Math.random() * s;
        const y = Math.random() * s;
        // Prefer mid latitudes for "cities"
        if (y < s * 0.12 || y > s * 0.88) continue;
        const c =
          Math.random() > 0.4
            ? `rgba(255,${180 + Math.random() * 50},${40 + Math.random() * 40},${0.4 + Math.random() * 0.55})`
            : `rgba(80,220,255,${0.35 + Math.random() * 0.5})`;
        ctx.fillStyle = c;
        const sz = Math.random() > 0.95 ? 3 : 1 + Math.random() * 1.5;
        ctx.fillRect(x, y, sz, sz);
        if (Math.random() > 0.85) {
          ctx.fillStyle = `rgba(168,85,247,${0.3 + Math.random() * 0.4})`;
          ctx.fillRect(x + 2, y + 1, 1, 1);
        }
      }
      // Soft aurora near poles
      for (let i = 0; i < 40; i++) {
        const x = Math.random() * s;
        const y = Math.random() > 0.5 ? Math.random() * s * 0.15 : s * 0.85 + Math.random() * s * 0.15;
        const rg = ctx.createRadialGradient(x, y, 0, x, y, 20 + Math.random() * 40);
        rg.addColorStop(0, `rgba(100,255,200,${0.15 + Math.random() * 0.2})`);
        rg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(x, y, 50, 0, Math.PI * 2);
        ctx.fill();
      }
    }, 1024);
  }

  function makePlanetBump() {
    return canvasTex((ctx, s) => {
      const img = ctx.createImageData(s, s);
      const d = img.data;
      for (let y = 0; y < s; y++) {
        for (let x = 0; x < s; x++) {
          const n =
            Math.sin(x * 0.07 + y * 0.05) * 0.25 +
            Math.sin(x * 0.19 - y * 0.13) * 0.2 +
            Math.sin(x * 0.41 + y * 0.37) * 0.15 +
            Math.random() * 0.35;
          const v = Math.floor(80 + n * 140);
          const i = (y * s + x) * 4;
          d[i] = d[i + 1] = d[i + 2] = v;
          d[i + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
    }, 512);
  }

  function makeCloudTexture() {
    return canvasTex((ctx, s) => {
      ctx.clearRect(0, 0, s, s);
      // Large soft systems
      for (let i = 0; i < 55; i++) {
        const x = Math.random() * s;
        const y = Math.random() * s;
        const r = 30 + Math.random() * 90;
        const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, `rgba(255,255,255,${0.22 + Math.random() * 0.28})`);
        rg.addColorStop(0.55, `rgba(200,230,255,${0.08 + Math.random() * 0.12})`);
        rg.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * (0.45 + Math.random() * 0.4), Math.random() * 6, 0, Math.PI * 2);
        ctx.fill();
      }
      // Wisps
      for (let i = 0; i < 120; i++) {
        const x = Math.random() * s;
        const y = Math.random() * s;
        ctx.fillStyle = `rgba(230,245,255,${0.04 + Math.random() * 0.1})`;
        ctx.beginPath();
        ctx.ellipse(x, y, 8 + Math.random() * 30, 3 + Math.random() * 8, Math.random() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }, 1024);
  }

  function makeSmallPlanetTexture(hue) {
    // Rich distant-world albedo (continents, storms, poles, city glints)
    return canvasTex((ctx, s) => {
      let deep, mid, landA, landB, ice, glow;
      if (hue === "ember") {
        deep = "#120402"; mid = "#3b1208"; landA = "#9a3412"; landB = "#ea580c"; ice = "#fcd34d"; glow = "rgba(251,146,60,0.55)";
      } else if (hue === "violet") {
        deep = "#0a0418"; mid = "#2e1065"; landA = "#6d28d9"; landB = "#c084fc"; ice = "#e9d5ff"; glow = "rgba(192,132,252,0.5)";
      } else if (hue === "ice") {
        deep = "#020617"; mid = "#0c4a6e"; landA = "#0369a1"; landB = "#7dd3fc"; ice = "#f0f9ff"; glow = "rgba(186,230,253,0.55)";
      } else if (hue === "gold") {
        deep = "#1c1004"; mid = "#713f12"; landA = "#b45309"; landB = "#fbbf24"; ice = "#fef3c7"; glow = "rgba(251,191,36,0.55)";
      } else if (hue === "jade") {
        deep = "#022c22"; mid = "#064e3b"; landA = "#059669"; landB = "#6ee7b7"; ice = "#ecfdf5"; glow = "rgba(52,211,153,0.5)";
      } else {
        deep = "#02131c"; mid = "#0e4a5c"; landA = "#0e7490"; landB = "#67e8f9"; ice = "#ecfeff"; glow = "rgba(34,211,238,0.55)";
      }
      // Base ocean/atmosphere gradient
      const g = ctx.createLinearGradient(0, 0, 0, s);
      g.addColorStop(0, deep);
      g.addColorStop(0.5, mid);
      g.addColorStop(1, deep);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);

      // Soft latitudinal bands
      for (let y = 0; y < s; y += 3) {
        const a = 0.04 + Math.sin(y * 0.08) * 0.06;
        ctx.fillStyle = glow.replace(/[\d.]+\)$/, a + ")");
        ctx.fillRect(0, y, s, 3);
      }

      // Continent blobs
      for (let i = 0; i < 22; i++) {
        const cx = Math.random() * s;
        const cy = s * 0.15 + Math.random() * s * 0.7;
        for (let j = 0; j < 14; j++) {
          const ox = (Math.random() - 0.5) * 70;
          const oy = (Math.random() - 0.5) * 50;
          const r = 10 + Math.random() * 36;
          const rg = ctx.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, r);
          rg.addColorStop(0, Math.random() > 0.5 ? landB : landA);
          rg.addColorStop(0.7, landA);
          rg.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = rg;
          ctx.beginPath();
          ctx.arc(cx + ox, cy + oy, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Polar caps
      const pN = ctx.createRadialGradient(s * 0.5, 0, 0, s * 0.5, 0, s * 0.22);
      pN.addColorStop(0, ice);
      pN.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = pN;
      ctx.fillRect(0, 0, s, s * 0.3);
      const pS = ctx.createRadialGradient(s * 0.5, s, 0, s * 0.5, s, s * 0.22);
      pS.addColorStop(0, ice);
      pS.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = pS;
      ctx.fillRect(0, s * 0.7, s, s * 0.3);

      // Storm swirls
      for (let i = 0; i < 8; i++) {
        const x = Math.random() * s;
        const y = Math.random() * s;
        const r = 18 + Math.random() * 40;
        const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, glow);
        rg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Specular/city sparkles
      for (let i = 0; i < 500; i++) {
        ctx.fillStyle = `rgba(255,255,255,${0.08 + Math.random() * 0.35})`;
        ctx.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random(), 1 + Math.random());
      }
    }, 768);
  }

  /** Soft radial glow used for stars (no hard square points) */
  function makeStarSpriteTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.12, "rgba(255,255,255,0.95)");
    g.addColorStop(0.28, "rgba(200,230,255,0.45)");
    g.addColorStop(0.55, "rgba(140,180,255,0.12)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    // Cross flare for bright stars
    const flare = ctx.createLinearGradient(0, 64, 128, 64);
    flare.addColorStop(0, "rgba(255,255,255,0)");
    flare.addColorStop(0.5, "rgba(220,240,255,0.35)");
    flare.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = flare;
    ctx.fillRect(0, 62, 128, 4);
    const flareV = ctx.createLinearGradient(64, 0, 64, 128);
    flareV.addColorStop(0, "rgba(255,255,255,0)");
    flareV.addColorStop(0.5, "rgba(220,240,255,0.28)");
    flareV.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = flareV;
    ctx.fillRect(62, 0, 4, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function makeNebulaSpriteTexture(r, g, b) {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const ctx = c.getContext("2d");
    const grd = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0, `rgba(${r},${g},${b},0.55)`);
    grd.addColorStop(0.35, `rgba(${r},${g},${b},0.22)`);
    grd.addColorStop(0.7, `rgba(${Math.floor(r * 0.4)},${Math.floor(g * 0.3)},${Math.floor(b * 0.6)},0.06)`);
    grd.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /**
   * Beautiful multi-layer cosmic starfield — soft sprites, colors, nebulae, twinkle.
   * Replaces plain square point stars.
   */
  function createCosmicStarfield(scene, opts) {
    opts = opts || {};
    // light mode: thin outer shell only (no volume shell = no sky bubble)
    const light = opts.light !== false; // default light when used by reactive sky
    const root = new THREE.Group();
    root.name = "CosmicStarfield";
    scene.add(root);

    const starTex = makeStarSpriteTexture();
    const layers = [];
    const nebulaMats = [];
    const nebulaPts = [];

    function addStarLayer(count, radius, size, baseColor, opacity) {
      const pos = new Float32Array(count * 3);
      const col = new Float32Array(count * 3);
      const c = new THREE.Color(baseColor);
      for (let i = 0; i < count; i++) {
        // Thin shell at ~constant radius so stars wrap full sky with no "ball" limb
        const r = radius * (0.96 + Math.random() * 0.08);
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        pos[i * 3 + 2] = r * Math.cos(phi);
        const roll = Math.random();
        if (roll < 0.15) {
          col[i * 3] = 1.0; col[i * 3 + 1] = 0.75 + Math.random() * 0.15; col[i * 3 + 2] = 0.55;
        } else if (roll < 0.35) {
          col[i * 3] = 0.65; col[i * 3 + 1] = 0.8; col[i * 3 + 2] = 1.0;
        } else if (roll < 0.45) {
          col[i * 3] = 0.85; col[i * 3 + 1] = 0.7; col[i * 3 + 2] = 1.0;
        } else {
          const v = 0.85 + Math.random() * 0.15;
          col[i * 3] = c.r * v;
          col[i * 3 + 1] = c.g * v;
          col[i * 3 + 2] = c.b * v;
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
      const mat = new THREE.PointsMaterial({
        map: starTex,
        size: size,
        // false = constant screen size → seamless sky, no spherical limb
        sizeAttenuation: false,
        transparent: true,
        opacity: opacity,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true,
        fog: false,
      });
      const pts = new THREE.Points(geo, mat);
      pts.renderOrder = -950;
      pts.frustumCulled = false;
      root.add(pts);
      layers.push({ pts: pts, mat: mat, baseSize: size, baseOp: opacity, twinkle: Math.random() * 10 });
      return mat;
    }

    // Stars on outer shell (~dome radius) — seamless full-sky wrap
    const R = light ? 2050 : 2000;
    addStarLayer(light ? 1400 : 2200, R, light ? 1.8 : 2.0, 0xdbeafe, 0.75);
    addStarLayer(light ? 500 : 900, R * 0.98, light ? 2.8 : 3.2, 0xf0f9ff, 0.85);
    addStarLayer(light ? 80 : 140, R * 0.97, light ? 5.5 : 7, 0xffffff, 0.9);

    // Extra nebula points only in full mode (reactive sky has its own soft planes)
    if (!light) {
      const nebulaDefs = [
        { color: [100, 60, 200], n: 12, size: 160 },
        { color: [20, 140, 180], n: 10, size: 140 },
        { color: [180, 80, 40], n: 8, size: 120 },
      ];
      for (let n = 0; n < nebulaDefs.length; n++) {
        const def = nebulaDefs[n];
        const tex = makeNebulaSpriteTexture(def.color[0], def.color[1], def.color[2]);
        const pos = new Float32Array(def.n * 3);
        for (let i = 0; i < def.n; i++) {
          const r = R * (0.85 + Math.random() * 0.12);
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(2 * Math.random() - 1);
          pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
          pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.7;
          pos[i * 3 + 2] = r * Math.cos(phi);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        const mat = new THREE.PointsMaterial({
          map: tex,
          size: def.size,
          sizeAttenuation: false,
          transparent: true,
          opacity: 0.16,
          depthWrite: false,
          depthTest: false,
          blending: THREE.AdditiveBlending,
          fog: false,
        });
        const pts = new THREE.Points(geo, mat);
        pts.renderOrder = -940;
        pts.frustumCulled = false;
        root.add(pts);
        nebulaMats.push(mat);
        nebulaPts.push(pts);
      }
    }

    let boost = 1;
    let sprintS = 0;

    function update(playerPos, starBoost, dt, extra) {
      dt = dt != null ? dt : 0.016;
      extra = extra || {};
      boost = THREE.MathUtils.damp(boost, starBoost != null ? starBoost : 1, 2.0, dt);
      sprintS = THREE.MathUtils.damp(sprintS, extra.sprint || 0, 2.5, dt);
      if (playerPos) root.position.copy(playerPos);
      const t = performance.now() * 0.001;
      for (let i = 0; i < layers.length; i++) {
        const L = layers[i];
        const tw = 0.88 + 0.12 * Math.sin(t * (1.1 + i * 0.35 + sprintS * 1.5) + L.twinkle);
        const opMul = 0.55 + boost * 0.4 + sprintS * 0.15;
        L.mat.opacity = Math.min(1, L.baseOp * opMul * tw);
        // sizeAttenuation false → size is px; modest sprint sparkle only
        L.mat.size = L.baseSize * (0.9 + boost * 0.15 + sprintS * 0.1) * (i === 2 ? tw : 1);
        L.pts.rotation.y += dt * (0.0015 + i * 0.001) * (1 + sprintS * 1.2);
        if (i === 2 && extra.accent && extra.accent.isColor) {
          L.mat.color.lerp(extra.accent, 0.06);
        }
      }
      for (let i = 0; i < nebulaMats.length; i++) {
        nebulaMats[i].opacity =
          (0.06 + boost * 0.12 + sprintS * 0.06) *
          (0.88 + 0.12 * Math.sin(t * 0.3 + i));
      }
      root.rotation.y += dt * (0.002 + sprintS * 0.008);
    }

    function setQuality(q) {
      const mul = q && q.starMul != null ? q.starMul : 1;
      if (layers[0]) layers[0].pts.visible = mul > 0.45;
      if (layers[1]) layers[1].pts.visible = mul > 0.25;
      if (layers[2]) layers[2].pts.visible = mul > 0.1;
      for (let i = 0; i < layers.length; i++) {
        if (!layers[i].pts.visible) continue;
        layers[i].mat.size = layers[i].baseSize * (0.75 + mul * 0.35);
        layers[i].mat.opacity = layers[i].baseOp * (0.5 + mul * 0.5);
      }
      for (let i = 0; i < nebulaPts.length; i++) {
        nebulaPts[i].visible = mul > 0.5;
      }
    }

    // Primary material for external opacity/size tweaks (compat)
    const primaryMat = layers[0] ? layers[0].mat : null;

    return {
      group: root,
      material: primaryMat,
      layers: layers,
      update: update,
      setQuality: setQuality,
      // compat with old starField position copy
      get position() {
        return root.position;
      },
    };
  }

  /**
   * Home planet of Spiral-47 — detailed sphere once Bolt leaves the surface.
   * High-poly body, albedo + night lights + clouds + multi-shell atmosphere.
   */
  function createHomePlanet(scene, opts) {
    opts = opts || {};
    const R = opts.radius != null ? opts.radius : 900;
    const group = new THREE.Group();
    group.name = "HomePlanet";
    group.visible = false;

    const albedo = makePlanetAlbedo(47);
    const emissiveMap = makePlanetEmissive();
    const bump = makePlanetBump();
    const cloudsMap = makeCloudTexture();

    // Opaque-looking body (no transparency wash) — toggle visible instead of opacity when possible
    const bodyMat = new THREE.MeshStandardMaterial({
      map: albedo,
      bumpMap: bump,
      bumpScale: R * 0.004,
      emissiveMap: emissiveMap,
      emissive: new THREE.Color(0xffcc66),
      emissiveIntensity: 0.55,
      roughness: 0.72,
      metalness: 0.12,
      transparent: true,
      opacity: 0,
      fog: false,
    });
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(R, 128, 96),
      bodyMat
    );
    body.receiveShadow = true;
    body.castShadow = false;
    group.add(body);

    // Inner atmosphere (limb) — FrontSide soft
    const atmoInnerMat = new THREE.MeshBasicMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0,
      side: THREE.FrontSide,
      depthWrite: false,
      fog: false,
      blending: THREE.AdditiveBlending,
    });
    const atmoInner = new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.012, 64, 48),
      atmoInnerMat
    );
    group.add(atmoInner);

    // Outer atmosphere shell — classic blue rim (BackSide)
    const atmoMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      blending: THREE.AdditiveBlending,
    });
    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.065, 64, 48),
      atmoMat
    );
    group.add(atmosphere);

    // Outer glow halo (larger, softer)
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x818cf8,
      transparent: true,
      opacity: 0,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      blending: THREE.AdditiveBlending,
    });
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.12, 48, 32),
      haloMat
    );
    group.add(halo);

    // Cloud layer — semi-transparent so continents stay visible
    const cloudMat = new THREE.MeshStandardMaterial({
      map: cloudsMap,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
      roughness: 1,
      metalness: 0,
      emissive: new THREE.Color(0xa5f3fc),
      emissiveIntensity: 0.08,
    });
    const clouds = new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.022, 96, 64),
      cloudMat
    );
    group.add(clouds);

    // Dedicated light so the planet always has a clear day side + specular
    const planetSun = new THREE.DirectionalLight(0xfff4e0, 0);
    planetSun.position.set(R * 1.4, R * 0.6, R * 0.9);
    group.add(planetSun);
    const planetFill = new THREE.DirectionalLight(0x6080ff, 0);
    planetFill.position.set(-R * 0.8, -R * 0.2, -R * 0.5);
    group.add(planetFill);

    group.userData.radius = R;
    group.userData.vis = 0;

    scene.add(group);

    function update(playerPos, surfaceY, planetVis, dt) {
      dt = dt != null ? dt : 0.016;
      const targetVis = THREE.MathUtils.clamp(planetVis != null ? planetVis : 0, 0, 1);
      group.userData.vis = THREE.MathUtils.damp(group.userData.vis, targetVis, 1.8, dt);
      const v = group.userData.vis;

      if (v < 0.02) {
        group.visible = false;
        planetSun.intensity = 0;
        planetFill.intensity = 0;
        return;
      }
      group.visible = true;

      const sy = surfaceY != null ? surfaceY : 0;
      const px = playerPos ? playerPos.x : 0;
      const pz = playerPos ? playerPos.z : 0;
      // Center under player so surface skin sits at ground level
      group.position.set(px, sy - R, pz);

      // Slow majestic spin + cloud wind
      body.rotation.y += dt * 0.008;
      clouds.rotation.y += dt * 0.014;
      clouds.rotation.z = Math.sin(performance.now() * 0.00006) * 0.03;
      atmoInner.rotation.y = body.rotation.y * 0.5;

      // Full solid body once visible (no washed-out transparent sphere)
      bodyMat.opacity = Math.min(1, v * 1.15);
      cloudMat.opacity = v * 0.38; // keep continents readable
      atmoInnerMat.opacity = v * 0.12;
      atmoMat.opacity = v * 0.38;
      haloMat.opacity = v * 0.14;
      bodyMat.emissiveIntensity = 0.35 + v * 0.45;
      planetSun.intensity = 1.4 * v;
      planetFill.intensity = 0.35 * v;

      // Aim sun from slightly above player view for strong terminator
      if (playerPos) {
        planetSun.position.set(
          px + R * 1.2,
          sy + R * 0.9,
          pz + R * 0.7
        );
        planetSun.target.position.copy(group.position);
        if (!planetSun.target.parent) group.add(planetSun.target);
      }
    }

    return {
      group: group,
      body: body,
      atmosphere: atmosphere,
      clouds: clouds,
      radius: R,
      update: update,
    };
  }

  /**
   * Distant companion worlds — glowing beacons from Orbital / Solar / Cosmic.
   * Bigger, lit, ringed, with corona so they never read as black blobs.
   */
  function createDistantPlanets(scene, opts) {
    opts = opts || {};
    const group = new THREE.Group();
    group.name = "DistantPlanets";
    group.visible = false;
    scene.add(group);

    // Shared key light so planets always have a day side
    const key = new THREE.DirectionalLight(0xfff5e6, 0);
    key.position.set(800, 500, 400);
    group.add(key);
    const fill = new THREE.HemisphereLight(0xa5b4fc, 0x1e1b4b, 0);
    group.add(fill);

    const defs = [
      { name: "EMBER-9", hue: "ember", biome: "emberVoid", r: 72, dist: 1600, elev: 220, phase: 0.0, speed: 0.04, atmo: 0xfb923c, ring: true, moon: true },
      { name: "VIOLET REACH", hue: "violet", biome: "whisperStars", r: 95, dist: 2100, elev: -160, phase: 1.1, speed: 0.028, atmo: 0xc084fc, ring: true, moon: false },
      { name: "GLACIER-3", hue: "ice", biome: "frostGlacier", r: 58, dist: 1400, elev: 380, phase: 2.2, speed: 0.05, atmo: 0x93c5fd, ring: false, moon: true },
      { name: "SOLARIS", hue: "gold", biome: "solarGold", r: 130, dist: 2600, elev: 100, phase: 3.4, speed: 0.016, atmo: 0xfbbf24, ring: true, moon: true },
      { name: "JADE WARD", hue: "jade", biome: "jadeCanopy", r: 68, dist: 1850, elev: -300, phase: 4.5, speed: 0.035, atmo: 0x34d399, ring: false, moon: false },
      { name: "CYAN DEEP", hue: "crystal", biome: "crystalNebula", r: 82, dist: 2300, elev: 240, phase: 5.4, speed: 0.022, atmo: 0x22d3ee, ring: true, moon: true },
      { name: "ROSE PULSAR", hue: "rose", biome: "rosePulse", r: 50, dist: 1200, elev: 60, phase: 0.7, speed: 0.06, atmo: 0xf472b6, ring: false, moon: false },
    ];

    const coronaTex = makeStarSpriteTexture();
    const planets = [];

    for (let i = 0; i < defs.length; i++) {
      const d = defs[i];
      const g = new THREE.Group();
      g.name = d.name;

      const mat = new THREE.MeshStandardMaterial({
        map: makeSmallPlanetTexture(d.hue),
        roughness: 0.55,
        metalness: 0.22,
        emissive: new THREE.Color(d.atmo),
        emissiveIntensity: 0.45,
        fog: false,
      });
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(d.r, 64, 48),
        mat
      );
      g.add(mesh);

      // Inner atmosphere haze
      const atmoIn = new THREE.Mesh(
        new THREE.SphereGeometry(d.r * 1.04, 40, 28),
        new THREE.MeshBasicMaterial({
          color: d.atmo,
          transparent: true,
          opacity: 0.18,
          side: THREE.FrontSide,
          depthWrite: false,
          fog: false,
          blending: THREE.AdditiveBlending,
        })
      );
      g.add(atmoIn);

      // Outer limb glow
      const atmo = new THREE.Mesh(
        new THREE.SphereGeometry(d.r * 1.14, 40, 28),
        new THREE.MeshBasicMaterial({
          color: d.atmo,
          transparent: true,
          opacity: 0.4,
          side: THREE.BackSide,
          depthWrite: false,
          fog: false,
          blending: THREE.AdditiveBlending,
        })
      );
      g.add(atmo);

      // Soft corona halo (reads from far away)
      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(d.r * 1.45, 28, 20),
        new THREE.MeshBasicMaterial({
          color: d.atmo,
          transparent: true,
          opacity: 0.12,
          depthWrite: false,
          fog: false,
          blending: THREE.AdditiveBlending,
        })
      );
      g.add(glow);

      // Sprite flare behind planet for beacon pop
      const flare = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: coronaTex,
          color: d.atmo,
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          fog: false,
        })
      );
      flare.scale.set(d.r * 4.5, d.r * 4.5, 1);
      g.add(flare);

      // Rings (most worlds)
      if (d.ring) {
        const ringMat = new THREE.MeshBasicMaterial({
          color: d.atmo,
          transparent: true,
          opacity: 0.55,
          side: THREE.DoubleSide,
          depthWrite: false,
          fog: false,
        });
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(d.r * 1.35, d.r * 2.05, 64),
          ringMat
        );
        ring.rotation.x = Math.PI / 2.35 + (i % 2) * 0.15;
        ring.rotation.z = (i * 0.3);
        g.add(ring);
        // Thin bright ring edge
        const ring2 = new THREE.Mesh(
          new THREE.RingGeometry(d.r * 1.55, d.r * 1.7, 64),
          new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.35,
            side: THREE.DoubleSide,
            depthWrite: false,
            fog: false,
            blending: THREE.AdditiveBlending,
          })
        );
        ring2.rotation.copy(ring.rotation);
        g.add(ring2);
      }

      // Small moon
      if (d.moon) {
        const moon = new THREE.Mesh(
          new THREE.SphereGeometry(d.r * 0.18, 16, 12),
          new THREE.MeshStandardMaterial({
            color: 0xc8d0e0,
            emissive: new THREE.Color(d.atmo),
            emissiveIntensity: 0.15,
            roughness: 0.9,
            fog: false,
          })
        );
        moon.position.set(d.r * 2.4, d.r * 0.3, 0);
        g.add(moon);
        g.userData.moon = moon;
      }

      // Local point light so planet glows into the void
      const pl = new THREE.PointLight(d.atmo, 0.8, d.r * 12);
      pl.position.set(d.r * 0.5, d.r * 0.3, d.r * 0.5);
      g.add(pl);

      group.add(g);
      planets.push({
        group: g,
        mesh: mesh,
        mat: mat,
        flare: flare,
        def: d,
        angle: d.phase,
        light: pl,
      });
    }

    let vis = 0;

    function update(playerPos, scaleStage, transitionProgress, dt) {
      dt = dt != null ? dt : 0.016;
      const st = scaleStage || "paw";
      let target = 0;
      if (st === "orbital") target = 0.45 + (transitionProgress || 0) * 0.25;
      else if (st === "solar") target = 0.95;
      else if (st === "cosmic") target = 1.0;
      else target = 0;

      vis = THREE.MathUtils.damp(vis, target, 1.5, dt);
      if (vis < 0.03) {
        group.visible = false;
        key.intensity = 0;
        fill.intensity = 0;
        return;
      }
      group.visible = true;
      key.intensity = 1.6 * vis;
      fill.intensity = 0.55 * vis;

      const px = playerPos ? playerPos.x : 0;
      const py = playerPos ? playerPos.y : 0;
      const pz = playerPos ? playerPos.z : 0;
      const t = performance.now() * 0.001;

      for (let i = 0; i < planets.length; i++) {
        const p = planets[i];
        const d = p.def;
        p.angle += dt * d.speed * 0.12;
        const x = px + Math.cos(p.angle) * d.dist;
        const z = pz + Math.sin(p.angle) * d.dist * 0.82;
        const y = py + d.elev + Math.sin(p.angle * 0.7 + t * 0.1) * 50;
        p.group.position.set(x, y, z);
        p.mesh.rotation.y += dt * 0.08;
        if (p.group.userData.moon) {
          const m = p.group.userData.moon;
          const ma = t * 0.4 + i;
          m.position.set(
            Math.cos(ma) * d.r * 2.4,
            d.r * 0.25,
            Math.sin(ma) * d.r * 2.4
          );
        }
        // Solar/cosmic: planets as clear beacons
        const sc = (st === "cosmic" ? 1.15 : 1.0) * (0.9 + vis * 0.25);
        p.group.scale.setScalar(sc);
        p.mat.emissiveIntensity = 0.35 + vis * 0.55 + 0.08 * Math.sin(t * 2 + i);
        if (p.flare && p.flare.material) {
          p.flare.material.opacity = (0.35 + vis * 0.4) * (0.85 + 0.15 * Math.sin(t * 3 + i));
        }
        if (p.light) p.light.intensity = 0.5 + vis * 1.2;
        // Cache world center for landing / approach
        p.worldPos = p.group.position;
        p.worldRadius = d.r * sc;
      }
    }

    /**
     * Nearest companion planet to a world position.
     * @returns {{ name, biome, hue, atmo, dist, radius, position, def }|null}
     */
    function getNearest(playerPos) {
      if (!playerPos || vis < 0.08) return null;
      let best = null;
      let bestD = Infinity;
      for (let i = 0; i < planets.length; i++) {
        const p = planets[i];
        const pos = p.group.position;
        const dx = pos.x - playerPos.x;
        const dy = pos.y - playerPos.y;
        const dz = pos.z - playerPos.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < bestD) {
          bestD = dist;
          const sc = p.group.scale.x || 1;
          best = {
            name: p.def.name,
            biome: p.def.biome,
            hue: p.def.hue,
            atmo: p.def.atmo,
            dist: dist,
            radius: p.def.r * sc,
            position: pos.clone ? pos.clone() : new THREE.Vector3(pos.x, pos.y, pos.z),
            def: p.def,
            index: i,
          };
        }
      }
      return best;
    }

    return {
      group: group,
      planets: planets,
      update: update,
      getNearest: getNearest,
      getVisibility: function () {
        return vis;
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Selective energy bloom (threshold + dual-axis blur, no EffectComposer)
  // Only very bright cyan/energy pixels bloom — white fur stays readable.
  // ---------------------------------------------------------------------------
  function createSoftBloom(renderer, scene, camera) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const rw = Math.max(1, Math.floor(w / 2));
    const rh = Math.max(1, Math.floor(h / 2));

    const params = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
    };
    const rtBright = new THREE.WebGLRenderTarget(rw, rh, params);
    const rtBlurH = new THREE.WebGLRenderTarget(rw, rh, params);
    const rtBlurV = new THREE.WebGLRenderTarget(rw, rh, params);

    const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quadGeo = new THREE.PlaneGeometry(2, 2);

    // Extract only high-luma energy (not soft white)
    const brightMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        threshold: { value: 0.72 },
        knee: { value: 0.18 },
      },
      vertexShader:
        "varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }",
      fragmentShader: [
        "uniform sampler2D tDiffuse;",
        "uniform float threshold;",
        "uniform float knee;",
        "varying vec2 vUv;",
        "void main(){",
        "  vec4 c = texture2D(tDiffuse, vUv);",
        "  float luma = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));",
        "  // Prefer cyan/energy over flat white (boost blue-green)",
        "  float energy = max(0.0, c.b * 0.55 + c.g * 0.35 - c.r * 0.25);",
        "  float soft = smoothstep(threshold, threshold + knee, luma + energy * 0.65);",
        "  // Kill pure white blowouts (fur)",
        "  float white = smoothstep(0.92, 1.0, min(min(c.r, c.g), c.b));",
        "  soft *= (1.0 - white * 0.85);",
        "  gl_FragColor = vec4(c.rgb * soft, 1.0);",
        "}",
      ].join("\n"),
      depthTest: false,
      depthWrite: false,
    });

    const blurMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        direction: { value: new THREE.Vector2(1, 0) },
        resolution: { value: new THREE.Vector2(rw, rh) },
      },
      vertexShader:
        "varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }",
      fragmentShader: [
        "uniform sampler2D tDiffuse;",
        "uniform vec2 direction;",
        "uniform vec2 resolution;",
        "varying vec2 vUv;",
        "void main(){",
        "  vec2 off = direction / resolution;",
        "  vec4 sum = texture2D(tDiffuse, vUv) * 0.227027;",
        "  sum += texture2D(tDiffuse, vUv + off * 1.384615) * 0.316216;",
        "  sum += texture2D(tDiffuse, vUv - off * 1.384615) * 0.316216;",
        "  sum += texture2D(tDiffuse, vUv + off * 3.230769) * 0.070270;",
        "  sum += texture2D(tDiffuse, vUv - off * 3.230769) * 0.070270;",
        "  gl_FragColor = sum;",
        "}",
      ].join("\n"),
      depthTest: false,
      depthWrite: false,
    });

    const compositeMat = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: null },
        tBloom: { value: null },
        bloomStrength: { value: 0.48 },
        vignette: { value: 0.38 },
        saturation: { value: 1.08 },
        contrast: { value: 1.06 },
        liftShadows: { value: 0.03 },
        cyanLift: { value: 0.04 },
        time: { value: 0 },
      },
      vertexShader:
        "varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }",
      fragmentShader: [
        "uniform sampler2D tScene;",
        "uniform sampler2D tBloom;",
        "uniform float bloomStrength;",
        "uniform float vignette;",
        "uniform float saturation;",
        "uniform float contrast;",
        "uniform float liftShadows;",
        "uniform float cyanLift;",
        "uniform float time;",
        "varying vec2 vUv;",
        "void main(){",
        "  vec3 col = texture2D(tScene, vUv).rgb;",
        "  vec3 bloomC = texture2D(tBloom, vUv).rgb;",
        "  col += bloomC * bloomStrength;",
        "  // Soft S-curve contrast (cinematic, not crushed)",
        "  col = (col - 0.5) * contrast + 0.5;",
        "  // Lift deep shadows slightly so space isn't pure black mud",
        "  col += liftShadows * (1.0 - col);",
        "  // Subtle cool mid-tone lift (Boltverse cyan)",
        "  float mid = smoothstep(0.15, 0.65, dot(col, vec3(0.299,0.587,0.114)));",
        "  col.b += cyanLift * mid * 0.55;",
        "  col.g += cyanLift * mid * 0.25;",
        "  // Saturation",
        "  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));",
        "  col = mix(vec3(luma), col, saturation);",
        "  // Vignette — focus on hero / horizon",
        "  vec2 vc = vUv - 0.5;",
        "  float vig = 1.0 - dot(vc, vc) * vignette * 1.65;",
        "  col *= clamp(vig, 0.55, 1.0);",
        "  // Tiny film grain (stable, subtle)",
        "  float grain = fract(sin(dot(vUv * time, vec2(12.9898,78.233))) * 43758.5453);",
        "  col += (grain - 0.5) * 0.012;",
        "  gl_FragColor = vec4(clamp(col, 0.0, 1.2), 1.0);",
        "}",
      ].join("\n"),
      depthTest: false,
      depthWrite: false,
    });

    const rtScene = new THREE.WebGLRenderTarget(
      Math.max(1, w),
      Math.max(1, h),
      params
    );

    const passQuad = new THREE.Mesh(quadGeo, brightMat);
    const passScene = new THREE.Scene();
    passScene.add(passQuad);

    let enabled = true;
    let strength = 0.52;

    function runPass(mat, target) {
      passQuad.material = mat;
      renderer.setRenderTarget(target);
      renderer.render(passScene, quadCam);
    }

    let bloomDiv = 2; // half-res by default

    return {
      enabled: enabled,
      setEnabled: function (v) {
        enabled = !!v;
      },
      setStrength: function (s) {
        strength = s;
        compositeMat.uniforms.bloomStrength.value = s;
      },
      setGrade: function (opts) {
        opts = opts || {};
        if (opts.vignette != null) compositeMat.uniforms.vignette.value = opts.vignette;
        if (opts.saturation != null) compositeMat.uniforms.saturation.value = opts.saturation;
        if (opts.contrast != null) compositeMat.uniforms.contrast.value = opts.contrast;
        if (opts.bloomStrength != null) {
          strength = opts.bloomStrength;
          compositeMat.uniforms.bloomStrength.value = strength;
        }
      },
      setQuality: function (q) {
        if (!q) return;
        if (q.bloom === false) enabled = false;
        else if (q.bloom === true) enabled = true;
        if (q.bloomStrength != null) {
          strength = q.bloomStrength;
          compositeMat.uniforms.bloomStrength.value = strength;
        }
        if (q.bloomDiv != null) bloomDiv = Math.max(1, q.bloomDiv | 0);
      },
      resize: function (width, height) {
        const nw = Math.max(1, Math.floor(width / bloomDiv));
        const nh = Math.max(1, Math.floor(height / bloomDiv));
        rtBright.setSize(nw, nh);
        rtBlurH.setSize(nw, nh);
        rtBlurV.setSize(nw, nh);
        rtScene.setSize(Math.max(1, width), Math.max(1, height));
        blurMat.uniforms.resolution.value.set(nw, nh);
      },
      /**
       * Soft cinematic polish — grade lives in the composite shader now
       */
      applyDomPolish: function (canvas) {
        canvas.style.filter = "none";
      },
      render: function () {
        if (!enabled) {
          renderer.setRenderTarget(null);
          renderer.render(scene, camera);
          return;
        }
        compositeMat.uniforms.time.value = performance.now() * 0.001;

        // 1) Full scene → RT
        renderer.setRenderTarget(rtScene);
        renderer.render(scene, camera);

        // 2) Bright / energy extract (rejects pure white fur)
        brightMat.uniforms.tDiffuse.value = rtScene.texture;
        runPass(brightMat, rtBright);

        // 3) Blur H
        blurMat.uniforms.tDiffuse.value = rtBright.texture;
        blurMat.uniforms.direction.value.set(1, 0);
        runPass(blurMat, rtBlurH);

        // 4) Blur V
        blurMat.uniforms.tDiffuse.value = rtBlurH.texture;
        blurMat.uniforms.direction.value.set(0, 1);
        runPass(blurMat, rtBlurV);

        // 5) Composite + grade + vignette → screen
        compositeMat.uniforms.tScene.value = rtScene.texture;
        compositeMat.uniforms.tBloom.value = rtBlurV.texture;
        compositeMat.uniforms.bloomStrength.value = strength;
        runPass(compositeMat, null);
      },
      dispose: function () {
        rtBright.dispose();
        rtBlurH.dispose();
        rtBlurV.dispose();
        rtScene.dispose();
        quadGeo.dispose();
        brightMat.dispose();
        blurMat.dispose();
        compositeMat.dispose();
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Balanced lighting: clear key, soft fill, subtle cyan rim
  // ---------------------------------------------------------------------------
  function createLighting(scene) {
    // Cool sky / dark ground — readable silhouettes + soft AO feel
    const ambient = new THREE.HemisphereLight(0xd8e4ff, 0x12101c, 0.55);
    ambient.name = "HemiLight";
    scene.add(ambient);

    // Strong key (sun) — defines form on white fur
    const sun = new THREE.DirectionalLight(0xfff6ec, 1.28);
    sun.position.set(55, 110, 35);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 450;
    sun.shadow.camera.left = -140;
    sun.shadow.camera.right = 140;
    sun.shadow.camera.top = 140;
    sun.shadow.camera.bottom = -140;
    sun.shadow.bias = -0.0002;
    sun.shadow.normalBias = 0.025;
    sun.shadow.radius = 2.5; // soft PCF when supported
    sun.name = "SunLight";
    scene.add(sun);

    // Soft cool fill from opposite side
    const fill = new THREE.DirectionalLight(0xa8bfff, 0.32);
    fill.position.set(-50, 40, -30);
    fill.name = "FillLight";
    scene.add(fill);

    // Subtle cyan rim — energy feel
    const rim = new THREE.PointLight(0x5eead4, 0.55, 200);
    rim.position.set(0, 28, 0);
    rim.name = "RimLight";
    scene.add(rim);

    // Back rim for separation from sky
    const back = new THREE.DirectionalLight(0xb4c0ff, 0.22);
    back.position.set(0, 25, -90);
    back.name = "BackRim";
    scene.add(back);

    return {
      ambient: ambient,
      sun: sun,
      fill: fill,
      rim: rim,
      hemi: ambient,
      back: back,
    };
  }

  /**
   * Horizon haze band — soft atmospheric layer between ground and sky.
   * Follows player; opacity rises near surface, fades in deep space.
   */
  function createHorizonHaze(scene) {
    const geo = new THREE.SphereGeometry(400, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.42);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x3d6a9a,
      transparent: true,
      opacity: 0.14,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      blending: THREE.AdditiveBlending,
    });
    const haze = new THREE.Mesh(geo, mat);
    haze.name = "HorizonHaze";
    haze.renderOrder = -90;
    scene.add(haze);
    return {
      mesh: haze,
      material: mat,
      update: function (playerPos, scaleStage, skyDark) {
        if (playerPos) {
          haze.position.x = playerPos.x;
          haze.position.y = playerPos.y - 40;
          haze.position.z = playerPos.z;
        }
        const orbital =
          scaleStage === "orbital" ||
          scaleStage === "solar" ||
          scaleStage === "cosmic";
        // Stronger haze on surface, thin blue limb glow in orbit
        let op = orbital ? 0.06 + (skyDark || 0) * 0.04 : 0.16;
        if (scaleStage === "planetary") op = 0.12;
        mat.opacity = op;
        mat.color.setHex(orbital ? 0x4ecbff : 0x3d6a9a);
        const sc = orbital ? 3.5 : 1.0;
        haze.scale.setScalar(sc);
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Soft particle field (sprites)
  // ---------------------------------------------------------------------------
  function createParticleField(scene, count) {
    count = count || 600;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext("2d");
    const grd = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.3, "rgba(180,220,255,0.6)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(canvas);

    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 220;
      pos[i * 3 + 1] = Math.random() * 50 + 1;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 220;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      map: tex,
      color: 0xaaddff,
      size: 1.4,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    const pts = new THREE.Points(geo, mat);
    pts.name = "SoftParticles";
    scene.add(pts);
    return {
      points: pts,
      material: mat,
      follow: function (x, z) {
        pts.position.x = x;
        pts.position.z = z;
      },
      setColor: function (c) {
        mat.color.copy(c);
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Ground material factory for open world chunks
  // ---------------------------------------------------------------------------
  function makeGroundMaterial(biomeId) {
    const map = getGroundTexture(biomeId);
    // Larger readable patches (was 8–10 — too fine / noise soup at paw cam)
    map.repeat.set(5, 5);
    map.anisotropy = 8;
    const bump = getGroundBump();
    bump.repeat.set(6, 6);
    bump.anisotropy = 8;
    const normal = getGroundNormal();
    normal.repeat.set(6, 6);
    normal.anisotropy = 8;
    let em = 0x041018;
    let emI = 0.08;
    let rough = 0.9;
    let metal = 0.06;
    let col = 0xffffff;
    let nScale = 0.9;
    if (biomeId === "emberVoid") {
      em = 0x1a0800;
      emI = 0.1;
      rough = 0.95;
      metal = 0.05;
      nScale = 1.05;
    } else if (biomeId === "whisperStars") {
      em = 0x080818;
      emI = 0.07;
      rough = 0.9;
      metal = 0.1;
      nScale = 0.75;
    } else if (biomeId === "solarGold") {
      em = 0x1c1408;
      emI = 0.1;
      rough = 0.86;
      metal = 0.12;
      nScale = 0.95;
    } else if (biomeId === "frostGlacier") {
      em = 0x0a1628;
      emI = 0.11;
      rough = 0.48;
      metal = 0.28;
      col = 0xe8f4ff;
      nScale = 1.15;
    } else if (biomeId === "jadeCanopy") {
      em = 0x061a12;
      emI = 0.08;
      rough = 0.92;
      nScale = 0.85;
    } else if (biomeId === "rosePulse") {
      em = 0x1a0814;
      emI = 0.09;
      rough = 0.88;
      nScale = 0.9;
    } else {
      metal = 0.1;
      emI = 0.09;
      nScale = 0.95;
    }
    return new THREE.MeshStandardMaterial({
      map: map,
      bumpMap: bump,
      bumpScale: 0.65,
      normalMap: normal,
      normalScale: new THREE.Vector2(nScale, nScale),
      color: col,
      roughness: rough,
      metalness: metal,
      emissive: em,
      emissiveIntensity: emI,
      flatShading: false,
    });
  }

  function makeRockMaterial(biomeId) {
    const map = getRockTexture(biomeId);
    if (map.anisotropy != null) map.anisotropy = 8;
    return new THREE.MeshStandardMaterial({
      map: map,
      color: 0xd8dce4,
      roughness: biomeId === "emberVoid" ? 0.96 : biomeId === "frostGlacier" ? 0.5 : 0.88,
      metalness: biomeId === "frostGlacier" ? 0.25 : 0.14,
      flatShading: true,
      emissive: biomeId === "emberVoid" ? 0x100500 : 0x050810,
      emissiveIntensity: biomeId === "emberVoid" ? 0.15 : 0.06,
    });
  }

  /** Pure white shepherd fur — only soft white-on-white strand detail (no grey/blue wash) */
  function makeFurTexture() {
    return canvasTex((ctx, s) => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, s, s);
      // Soft warm-white gradient for volume (still reads pure white)
      const g = ctx.createRadialGradient(s * 0.4, s * 0.35, 0, s * 0.5, s * 0.5, s * 0.75);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.55, "rgba(255,252,248,0.35)");
      g.addColorStop(1, "rgba(248,250,255,0.2)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
      // Fine white hair strands only
      for (let i = 0; i < 2800; i++) {
        const x = Math.random() * s;
        const y = Math.random() * s;
        const len = 4 + Math.random() * 20;
        const a = 0.08 + Math.random() * 0.22;
        ctx.strokeStyle = `rgba(255,255,255,${a})`;
        ctx.lineWidth = 0.4 + Math.random() * 1.1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (Math.random() - 0.5) * 2.5, y + len);
        ctx.stroke();
      }
      // Extremely soft pure-white shade pockets (no blue/grey pigment)
      for (let i = 0; i < 40; i++) {
        const x = Math.random() * s;
        const y = Math.random() * s;
        const r = 12 + Math.random() * 40;
        const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, "rgba(240,242,248,0.12)");
        rg.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }, 512);
  }

  /** White-on-white subtle marking texture (white GSD — no charcoal saddle) */
  function makeSaddleTexture() {
    return canvasTex((ctx, s) => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, s, s);
      // Barely-there cream strands — still pure white shepherd
      for (let i = 0; i < 1200; i++) {
        const x = Math.random() * s;
        const y = Math.random() * s;
        ctx.strokeStyle = `rgba(255,255,255,${0.1 + Math.random() * 0.25})`;
        ctx.lineWidth = 0.5 + Math.random();
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 1.5, y + 6 + Math.random() * 12);
        ctx.stroke();
      }
      for (let i = 0; i < 25; i++) {
        const x = Math.random() * s;
        const y = Math.random() * s;
        const r = 15 + Math.random() * 35;
        const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, "rgba(250,250,252,0.15)");
        rg.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }, 512);
  }

  /** Micro-fur normal for soft light catch on body */
  function makeFurNormal() {
    const size = 256;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    const h = new Float32Array(size * size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        h[y * size + x] =
          Math.sin(x * 0.4 + y * 0.15) * 0.3 +
          Math.sin(x * 0.9) * 0.15 +
          (Math.random() - 0.5) * 0.55;
      }
    }
    const img = ctx.createImageData(size, size);
    const str = 2.2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const xl = h[y * size + ((x - 1 + size) % size)];
        const xr = h[y * size + ((x + 1) % size)];
        const yu = h[((y - 1 + size) % size) * size + x];
        const yd = h[((y + 1) % size) * size + x];
        let nx = (xl - xr) * str;
        let ny = (yu - yd) * str;
        let nz = 1;
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        const i = (y * size + x) * 4;
        img.data[i] = ((nx / len) * 0.5 + 0.5) * 255;
        img.data[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
        img.data[i + 2] = ((nz / len) * 0.5 + 0.5) * 255;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    if (THREE.NoColorSpace) tex.colorSpace = THREE.NoColorSpace;
    return tex;
  }

  /**
   * Bolt material kit — pure white German Shepherd + cyan/purple lightning energy.
   * Fur stays readable white; energy emissive is driven by sprint score at runtime.
   */
  function makeBoltMaterials() {
    const furMap = getFurTexture();
    furMap.repeat.set(2.2, 2.2);
    const saddleMap = getSaddleTexture();
    saddleMap.repeat.set(1.4, 1.4);
    const nrm = makeFurNormal();
    nrm.repeat.set(3.2, 3.2);
    // PURE WHITE German Shepherd — no grey, no charcoal, no blue wash
    const fur = new THREE.MeshStandardMaterial({
      map: furMap,
      normalMap: nrm,
      normalScale: new THREE.Vector2(0.38, 0.38),
      color: 0xffffff,
      roughness: 0.58,
      metalness: 0.01,
      emissive: 0xffffff,
      emissiveIntensity: 0.02,
    });
    const furBright = new THREE.MeshStandardMaterial({
      map: furMap,
      normalMap: nrm,
      normalScale: new THREE.Vector2(0.28, 0.28),
      color: 0xffffff,
      roughness: 0.48,
      metalness: 0.01,
      emissive: 0xffffff,
      emissiveIntensity: 0.03,
    });
    // Soft shadow still pure white (slightly lower lit, not pigmented)
    const furShade = new THREE.MeshStandardMaterial({
      map: furMap,
      color: 0xf7f8fc,
      roughness: 0.68,
      metalness: 0.01,
      emissive: 0xffffff,
      emissiveIntensity: 0.015,
    });
    // Markings = pure white too (white GSD has no dark saddle)
    const furSaddle = new THREE.MeshStandardMaterial({
      map: saddleMap,
      color: 0xffffff,
      roughness: 0.6,
      metalness: 0.01,
      emissive: 0xffffff,
      emissiveIntensity: 0.02,
    });
    // Cyan lightning
    const energy = new THREE.MeshStandardMaterial({
      color: 0x7dd3fc,
      emissive: 0x22d3ee,
      emissiveIntensity: 1.35,
      roughness: 0.22,
      metalness: 0.55,
    });
    const energyHot = new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      emissive: 0x67e8f9,
      emissiveIntensity: 1.85,
      roughness: 0.15,
      metalness: 0.5,
    });
    // Purple resonance lightning
    const energyPurple = new THREE.MeshStandardMaterial({
      color: 0xd8b4fe,
      emissive: 0xa855f7,
      emissiveIntensity: 1.4,
      roughness: 0.22,
      metalness: 0.5,
    });
    const energySoft = new THREE.MeshBasicMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const energySoftPurple = new THREE.MeshBasicMaterial({
      color: 0xc084fc,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    // Body energy veins (spine / shoulders) — additive, score-driven opacity
    const energyVein = new THREE.MeshBasicMaterial({
      color: 0xa5f3fc,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const iris = new THREE.MeshStandardMaterial({
      color: 0xc4f0ff,
      emissive: 0x22d3ee,
      emissiveIntensity: 1.55,
      roughness: 0.14,
      metalness: 0.4,
    });
    const pupil = new THREE.MeshStandardMaterial({
      color: 0x050a12,
      roughness: 0.45,
      metalness: 0.1,
    });
    const noseMat = new THREE.MeshStandardMaterial({
      color: 0x1a1f2e,
      roughness: 0.28,
      metalness: 0.35,
    });
    const padMat = new THREE.MeshStandardMaterial({
      color: 0x2a3344,
      roughness: 0.88,
      metalness: 0.05,
      emissive: 0x0a1828,
      emissiveIntensity: 0.05,
    });
    const pinkEar = new THREE.MeshStandardMaterial({
      color: 0xffc4d4,
      roughness: 0.8,
      metalness: 0,
      emissive: 0x401028,
      emissiveIntensity: 0.05,
    });
    return {
      fur: fur,
      furBright: furBright,
      furShade: furShade,
      furSaddle: furSaddle,
      energy: energy,
      energyHot: energyHot,
      energyPurple: energyPurple,
      energySoft: energySoft,
      energySoftPurple: energySoftPurple,
      energyVein: energyVein,
      iris: iris,
      pupil: pupil,
      noseMat: noseMat,
      padMat: padMat,
      pinkEar: pinkEar,
    };
  }

  /** Soft additive sprite for trails / wing sparks */
  function makeSoftSpriteTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const ctx = c.getContext("2d");
    const rg = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    rg.addColorStop(0, "rgba(255,255,255,1)");
    rg.addColorStop(0.2, "rgba(160,240,255,0.85)");
    rg.addColorStop(0.55, "rgba(60,180,255,0.3)");
    rg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /** Energy wing membrane (feather streaks + glow) */
  function makeWingTexture() {
    return canvasTex((ctx, s) => {
      ctx.clearRect(0, 0, s, s);
      // Soft body of wing
      const rg = ctx.createRadialGradient(s * 0.2, s * 0.5, 0, s * 0.45, s * 0.5, s * 0.7);
      rg.addColorStop(0, "rgba(200,255,255,0.95)");
      rg.addColorStop(0.35, "rgba(60,230,255,0.7)");
      rg.addColorStop(0.7, "rgba(80,100,255,0.25)");
      rg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.moveTo(s * 0.05, s * 0.5);
      ctx.quadraticCurveTo(s * 0.4, s * 0.05, s * 0.95, s * 0.25);
      ctx.quadraticCurveTo(s * 0.7, s * 0.5, s * 0.95, s * 0.75);
      ctx.quadraticCurveTo(s * 0.4, s * 0.95, s * 0.05, s * 0.5);
      ctx.fill();
      // Lightning vein lines
      ctx.strokeStyle = "rgba(255,255,255,0.75)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const y0 = s * (0.2 + i * 0.08);
        ctx.beginPath();
        ctx.moveTo(s * 0.12, s * 0.5);
        ctx.lineTo(s * (0.35 + Math.random() * 0.1), y0 + (Math.random() - 0.5) * 20);
        ctx.lineTo(s * (0.7 + Math.random() * 0.2), y0 + (Math.random() - 0.5) * 30);
        ctx.stroke();
      }
      // Hot core streaks
      ctx.strokeStyle = "rgba(255,255,180,0.55)";
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(s * 0.1, s * 0.5);
        ctx.lineTo(s * 0.55, s * (0.25 + i * 0.12));
        ctx.stroke();
      }
    }, 256);
  }

  let _furTex = null;
  let _saddleTex = null;
  let _softSprite = null;
  let _wingTex = null;

  function getFurTexture() {
    if (!_furTex) _furTex = makeFurTexture();
    return _furTex;
  }
  function getSaddleTexture() {
    if (!_saddleTex) _saddleTex = makeSaddleTexture();
    return _saddleTex;
  }
  function getSoftSpriteTexture() {
    if (!_softSprite) _softSprite = makeSoftSpriteTexture();
    return _softSprite;
  }
  function getWingTexture() {
    if (!_wingTex) _wingTex = makeWingTexture();
    return _wingTex;
  }

  // Better Bolt materials
  function styleBoltMesh(group) {
    if (!group) return;
    group.traverse((c) => {
      if (!c.isMesh || !c.material) return;
      const m = c.material;
      if (m.color && m.color.getHex() === 0xf0f4ff) {
        m.color.setHex(0xf5f7ff);
        m.roughness = 0.55;
        m.metalness = 0.05;
        m.emissive = new THREE.Color(0x223344);
        m.emissiveIntensity = 0.12;
      }
      if (m.emissive && m.color && m.color.getHex() === 0x3df0ff) {
        m.emissiveIntensity = 1.4;
        m.emissive.setHex(0x22d3ee);
      }
    });
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.9, 24),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    group.add(shadow);
  }

  // ---------------------------------------------------------------------------
  // Tree bark / foliage / ruin stone (vegetation + ruin polish A–C)
  // ---------------------------------------------------------------------------
  const cachePlant = { bark: {}, foliage: {}, ruinStone: {} };

  function makeBarkTexture(biomeId) {
    return canvasTex((ctx, s) => {
      let c0, c1, vein;
      if (biomeId === "emberVoid") {
        c0 = "#1a0c06"; c1 = "#3b1c0a"; vein = "rgba(120,50,20,0.45)";
      } else if (biomeId === "whisperStars") {
        c0 = "#12101c"; c1 = "#2a2540"; vein = "rgba(100,90,160,0.4)";
      } else if (biomeId === "frostGlacier") {
        c0 = "#0e1824"; c1 = "#2a3e55"; vein = "rgba(140,180,210,0.35)";
      } else if (biomeId === "jadeCanopy") {
        c0 = "#0a1810"; c1 = "#1a3020"; vein = "rgba(40,100,70,0.4)";
      } else if (biomeId === "crystalNebula") {
        c0 = "#1a0e28"; c1 = "#2e1a48"; vein = "rgba(90,50,140,0.4)";
      } else {
        c0 = "#1a120c"; c1 = "#3a2818"; vein = "rgba(80,50,30,0.4)";
      }
      const g = ctx.createLinearGradient(0, 0, s * 0.3, s);
      g.addColorStop(0, c0);
      g.addColorStop(1, c1);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
      // Vertical bark grooves
      for (let i = 0; i < 55; i++) {
        const x = Math.random() * s;
        ctx.strokeStyle = vein;
        ctx.lineWidth = 1 + Math.random() * 2.5;
        ctx.globalAlpha = 0.35 + Math.random() * 0.45;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        let px = x;
        for (let y = 0; y < s; y += 8) {
          px += (Math.random() - 0.5) * 4;
          ctx.lineTo(px, y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // Knots / scars
      for (let i = 0; i < 25; i++) {
        const x = Math.random() * s;
        const y = Math.random() * s;
        const r = 4 + Math.random() * 14;
        const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, c1);
        rg.addColorStop(0.6, c0);
        rg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      // Moss flecks
      for (let i = 0; i < 200; i++) {
        ctx.fillStyle = `rgba(60,140,90,${0.08 + Math.random() * 0.2})`;
        ctx.fillRect(Math.random() * s, Math.random() * s, 2, 3 + Math.random() * 4);
      }
    }, 512);
  }

  function makeFoliageTexture(biomeId) {
    return canvasTex((ctx, s) => {
      let base, speck, glow;
      if (biomeId === "emberVoid") {
        base = ["#3b1008", "#7c2d12", "#c2410c"]; speck = [251, 146, 60]; glow = "rgba(249,115,22,0.35)";
      } else if (biomeId === "whisperStars") {
        base = ["#1e1b4b", "#4c1d95", "#7c3aed"]; speck = [196, 181, 253]; glow = "rgba(167,139,250,0.3)";
      } else if (biomeId === "jadeCanopy") {
        base = ["#064e3b", "#059669", "#34d399"]; speck = [110, 231, 183]; glow = "rgba(52,211,153,0.3)";
      } else if (biomeId === "frostGlacier") {
        base = ["#0c4a6e", "#0369a1", "#7dd3fc"]; speck = [186, 230, 253]; glow = "rgba(125,211,252,0.3)";
      } else if (biomeId === "rosePulse") {
        base = ["#4a044e", "#9d174d", "#f472b6"]; speck = [251, 207, 232]; glow = "rgba(244,114,182,0.3)";
      } else {
        base = ["#2e1065", "#6d28d9", "#a78bfa"]; speck = [196, 181, 253]; glow = "rgba(167,139,250,0.28)";
      }
      const g = ctx.createRadialGradient(s * 0.4, s * 0.4, 0, s * 0.5, s * 0.5, s * 0.7);
      g.addColorStop(0, base[2]);
      g.addColorStop(0.45, base[1]);
      g.addColorStop(1, base[0]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
      // Leaf mottling
      for (let i = 0; i < 120; i++) {
        const x = Math.random() * s;
        const y = Math.random() * s;
        const r = 8 + Math.random() * 40;
        const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, base[Math.floor(Math.random() * 3)]);
        rg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // Speckles / pores
      for (let i = 0; i < 4000; i++) {
        ctx.fillStyle = `rgba(${speck[0]},${speck[1]},${speck[2]},${0.08 + Math.random() * 0.35})`;
        ctx.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 2, 1 + Math.random() * 2);
      }
      // Soft biolum pools (not full-plane neon)
      for (let i = 0; i < 30; i++) {
        const x = Math.random() * s;
        const y = Math.random() * s;
        const r = 10 + Math.random() * 35;
        const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, glow);
        rg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }, 512);
  }

  function makeRuinStoneTexture(biomeId) {
    return canvasTex((ctx, s) => {
      let c0, c1, mortar, crack;
      if (biomeId === "emberVoid") {
        c0 = "#1c100c"; c1 = "#3a2418"; mortar = "rgba(20,10,6,0.7)"; crack = "rgba(80,30,10,0.5)";
      } else if (biomeId === "whisperStars") {
        c0 = "#12121f"; c1 = "#2a2a42"; mortar = "rgba(10,10,20,0.65)"; crack = "rgba(80,80,140,0.4)";
      } else if (biomeId === "frostGlacier") {
        c0 = "#0e1824"; c1 = "#2a4058"; mortar = "rgba(8,14,24,0.65)"; crack = "rgba(100,160,200,0.35)";
      } else {
        c0 = "#141c28"; c1 = "#2e3e52"; mortar = "rgba(8,12,18,0.7)"; crack = "rgba(60,90,120,0.45)";
      }
      ctx.fillStyle = c0;
      ctx.fillRect(0, 0, s, s);
      // Block grid with irregular mortar
      const bs = s / 6;
      for (let gy = 0; gy < 7; gy++) {
        for (let gx = 0; gx < 7; gx++) {
          const ox = gx * bs + (gy % 2) * bs * 0.35 + (Math.random() - 0.5) * 4;
          const oy = gy * bs + (Math.random() - 0.5) * 3;
          const w = bs * (0.85 + Math.random() * 0.2);
          const h = bs * (0.8 + Math.random() * 0.25);
          const shade = 40 + Math.floor(Math.random() * 50);
          ctx.fillStyle = `rgb(${shade + 20},${shade + 28},${shade + 40})`;
          if (biomeId === "emberVoid") ctx.fillStyle = `rgb(${shade + 30},${shade + 18},${shade + 10})`;
          ctx.globalAlpha = 0.55 + Math.random() * 0.35;
          ctx.fillRect(ox, oy, w, h);
          ctx.globalAlpha = 1;
          ctx.strokeStyle = mortar;
          ctx.lineWidth = 2;
          ctx.strokeRect(ox, oy, w, h);
        }
      }
      // Cracks
      ctx.strokeStyle = crack;
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 40; i++) {
        let x = Math.random() * s;
        let y = Math.random() * s;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let j = 0; j < 4; j++) {
          x += (Math.random() - 0.5) * 30;
          y += (Math.random() - 0.5) * 30;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      // Lichen / dust
      for (let i = 0; i < 800; i++) {
        ctx.fillStyle = `rgba(120,140,100,${0.04 + Math.random() * 0.12})`;
        ctx.fillRect(Math.random() * s, Math.random() * s, 2, 2);
      }
    }, 512);
  }

  function getBarkTexture(biomeId) {
    biomeId = biomeId || "crystalNebula";
    if (!cachePlant.bark[biomeId]) cachePlant.bark[biomeId] = makeBarkTexture(biomeId);
    return cachePlant.bark[biomeId];
  }
  function getFoliageTexture(biomeId) {
    biomeId = biomeId || "crystalNebula";
    if (!cachePlant.foliage[biomeId]) cachePlant.foliage[biomeId] = makeFoliageTexture(biomeId);
    return cachePlant.foliage[biomeId];
  }
  function getRuinStoneTexture(biomeId) {
    biomeId = biomeId || "crystalNebula";
    if (!cachePlant.ruinStone[biomeId]) cachePlant.ruinStone[biomeId] = makeRuinStoneTexture(biomeId);
    return cachePlant.ruinStone[biomeId];
  }

  const matCachePlant = { bark: {}, foliage: {}, ruinStone: {} };

  function makeBarkMaterial(biomeId) {
    biomeId = biomeId || "crystalNebula";
    if (matCachePlant.bark[biomeId]) return matCachePlant.bark[biomeId];
    const map = getBarkTexture(biomeId);
    map.repeat.set(2, 3);
    const mat = new THREE.MeshStandardMaterial({
      map: map,
      color: 0xffffff,
      roughness: 0.92,
      metalness: 0.05,
      emissive: biomeId === "crystalNebula" ? 0x1a0a30 : 0x050308,
      emissiveIntensity: 0.06,
    });
    mat.userData.shared = true;
    matCachePlant.bark[biomeId] = mat;
    return mat;
  }

  function makeFoliageMaterial(biomeId, plantCol, plantEm) {
    biomeId = biomeId || "crystalNebula";
    // Cache by biome only (plant tint baked into texture per biome)
    if (matCachePlant.foliage[biomeId]) return matCachePlant.foliage[biomeId];
    const map = getFoliageTexture(biomeId);
    map.repeat.set(2, 2);
    // Soft form: low emissive so lobes sculpt under light (not neon balloons)
    const mat = new THREE.MeshStandardMaterial({
      map: map,
      color: plantCol != null ? plantCol : 0xa78bfa,
      roughness: 0.72,
      metalness: biomeId === "crystalNebula" ? 0.18 : 0.06,
      emissive: plantEm != null ? plantEm : 0x4c1d95,
      emissiveIntensity: 0.22,
      transparent: true,
      opacity: 0.94,
      side: THREE.DoubleSide,
    });
    mat.userData.shared = true;
    matCachePlant.foliage[biomeId] = mat;
    return mat;
  }

  function makeRuinStoneMaterial(biomeId) {
    biomeId = biomeId || "crystalNebula";
    if (matCachePlant.ruinStone[biomeId]) return matCachePlant.ruinStone[biomeId];
    const map = getRuinStoneTexture(biomeId);
    map.repeat.set(2, 2);
    const mat = new THREE.MeshStandardMaterial({
      map: map,
      color: 0xd0d6e0,
      roughness: biomeId === "emberVoid" ? 0.94 : biomeId === "whisperStars" ? 0.8 : 0.72,
      metalness: biomeId === "crystalNebula" ? 0.22 : 0.12,
      emissive: biomeId === "whisperStars" ? 0x12102a : 0x050810,
      emissiveIntensity: biomeId === "whisperStars" ? 0.1 : 0.05,
      flatShading: biomeId === "emberVoid",
    });
    mat.userData.shared = true;
    matCachePlant.ruinStone[biomeId] = mat;
    return mat;
  }

  global.BoltGraphics = {
    getGroundTexture: getGroundTexture,
    getRockTexture: getRockTexture,
    getSkyTexture: getSkyTexture,
    getFurTexture: getFurTexture,
    getSaddleTexture: getSaddleTexture,
    getSoftSpriteTexture: getSoftSpriteTexture,
    getWingTexture: getWingTexture,
    createSkyDome: createSkyDome,
    createReactiveSky: createReactiveSky,
    createHomePlanet: createHomePlanet,
    createDistantPlanets: createDistantPlanets,
    createCosmicStarfield: createCosmicStarfield,
    createSoftBloom: createSoftBloom,
    createLighting: createLighting,
    createHorizonHaze: createHorizonHaze,
    createParticleField: createParticleField,
    makeGroundMaterial: makeGroundMaterial,
    makeRockMaterial: makeRockMaterial,
    makeBarkMaterial: makeBarkMaterial,
    makeFoliageMaterial: makeFoliageMaterial,
    makeRuinStoneMaterial: makeRuinStoneMaterial,
    makeBoltMaterials: makeBoltMaterials,
    styleBoltMesh: styleBoltMesh,
  };
})(typeof window !== "undefined" ? window : globalThis);
