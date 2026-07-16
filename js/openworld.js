/**
 * BOLT ENGINE — Infinite Open World streaming
 * Chunked ground that follows Bolt. No hard walls.
 *
 * Seamless Scale Shifting:
 *   paw → planetary → orbital → solar → cosmic
 * Driven by transitionProgress (speed + momentum + altitude).
 * Bolt does NOT fly — he outruns gravity via sprint momentum + Lightning Core.
 */
(function (global) {
  "use strict";
  const THREE = global.THREE;
  if (!THREE) return;

  const CHUNK = 80;       // world units per chunk
  let VIEW = 2;           // chunks radius — start modest (quality raises this)
  let GROUND_SEGS = 28;   // heightfield density
  let DRESS_MUL = 0.55;   // ground dressing density
  let MAX_CHUNKS = 40;    // hard live chunk cap (was 80 — too heavy)
  /** Max new chunks built per ensureAround call (spreads hitch across frames) */
  let MAX_BUILDS_PER_TICK = 2;
  /** Ahead streaming length beyond VIEW (0 = no extra wedge on Low) */
  let AHEAD_EXTRA = 1;
  /** GPU vertex displacement for ground. Off on Low/Med for FPS. */
  let GPU_HEIGHT = false;
  let GPU_OCTAVES = 3; // 2–5

  /** Scale definitions (lore order) */
  const SCALE_STAGES = [
    {
      id: "paw",
      name: "PAW",
      min: 0,
      fog: 0.0032,
      far: 550,
      camMul: 1,
      gravity: 1,
      airFriction: 1,
      detailMul: 1.4,
      vegMul: 1.55,
      terrainMul: 1.1,
      ruinMul: 1.15,
      pathMul: 1.5,
      densityMul: 1.25,
      predictMul: 1,
      groundOp: 1,
      skyDark: 0,
      starBoost: 1,
      planetVis: 0,
    },
    {
      id: "planetary",
      name: "PLANETARY",
      min: 0.22,
      fog: 0.0018,
      far: 1400,
      camMul: 1.35,
      gravity: 0.72,
      airFriction: 0.75,
      // Surface stays rich — dense flora + paths
      detailMul: 1.25,
      vegMul: 1.45,
      terrainMul: 1.3,
      ruinMul: 1.25,
      pathMul: 1.4,
      densityMul: 1.2,
      predictMul: 1.4,
      groundOp: 0.92,
      skyDark: 0.12,
      starBoost: 1.15,
      planetVis: 0.08,
    },
    {
      id: "orbital",
      name: "ORBITAL",
      min: 0.34,
      fog: 0.0004,
      far: 5200,
      camMul: 2.15,
      gravity: 0.14,
      airFriction: 0.22,
      // Orbital: sparse micro, epic Ruin + Path (sky monuments)
      detailMul: 0.28,
      vegMul: 0.0,
      terrainMul: 0.45,
      ruinMul: 1.65,
      pathMul: 1.55,
      densityMul: 0.48,
      predictMul: 3.2,
      groundOp: 0.06,
      skyDark: 0.85,
      starBoost: 1.8,
      planetVis: 1.0,
    },
    {
      id: "solar",
      name: "SOLAR",
      min: 0.62,
      fog: 0.00035,
      far: 7000,
      camMul: 2.5,
      gravity: 0.08,
      airFriction: 0.18,
      detailMul: 0.08,
      vegMul: 0.0,
      terrainMul: 0.22,
      ruinMul: 1.1,
      pathMul: 1.15,
      densityMul: 0.3,
      predictMul: 3.8,
      groundOp: 0.03,
      skyDark: 0.95,
      starBoost: 2.2,
      planetVis: 1.0,
    },
    {
      id: "cosmic",
      name: "COSMIC",
      min: 0.8,
      fog: 0.0002,
      far: 14000,
      camMul: 3.2,
      gravity: 0.03,
      airFriction: 0.1,
      detailMul: 0.04,
      vegMul: 0,
      terrainMul: 0.1,
      ruinMul: 0.9,
      pathMul: 1.0,
      densityMul: 0.2,
      predictMul: 5.0,
      groundOp: 0.02,
      skyDark: 1.0,
      starBoost: 2.6,
      planetVis: 0.85,
    },
  ];

  function stageFromProgress(p) {
    let s = SCALE_STAGES[0];
    for (let i = 0; i < SCALE_STAGES.length; i++) {
      if (p >= SCALE_STAGES[i].min) s = SCALE_STAGES[i];
    }
    return s;
  }

  function lerpKeys(a, b, u) {
    function L(k) {
      return THREE.MathUtils.lerp(a[k], b[k], u);
    }
    return {
      id: u > 0.55 && b.id !== a.id ? b.id : a.id,
      name: u > 0.55 && b.id !== a.id ? b.name : a.name,
      blend: u,
      from: a.id,
      to: b.id,
      fog: L("fog"),
      far: L("far"),
      camMul: L("camMul"),
      gravity: L("gravity"),
      airFriction: L("airFriction"),
      detailMul: L("detailMul"),
      vegMul: L("vegMul"),
      terrainMul: L("terrainMul"),
      ruinMul: L("ruinMul"),
      pathMul: L("pathMul"),
      densityMul: L("densityMul"),
      predictMul: L("predictMul"),
      groundOp: L("groundOp"),
      skyDark: L("skyDark"),
      starBoost: L("starBoost"),
      planetVis: L("planetVis"),
    };
  }

  function lerpStageProps(p) {
    // Blend between current and next stage for smooth LOD
    let i = 0;
    for (let k = 0; k < SCALE_STAGES.length; k++) {
      if (p >= SCALE_STAGES[k].min) i = k;
    }
    const a = SCALE_STAGES[i];
    const b = SCALE_STAGES[Math.min(i + 1, SCALE_STAGES.length - 1)];
    const t0 = a.min;
    const t1 = i + 1 < SCALE_STAGES.length ? b.min : 1;
    const u = t1 > t0 ? THREE.MathUtils.clamp((p - t0) / (t1 - t0), 0, 1) : 0;
    return lerpKeys(a, b, u);
  }

  /**
   * Surface-only blend: paw ↔ planetary.
   * Never blends toward orbital (that was crushing veg/detail at progress ~0.38).
   */
  function lerpStagePropsSurface(p) {
    const a = SCALE_STAGES[0]; // paw
    const b = SCALE_STAGES[1]; // planetary
    // Map 0..GROUND_CAP onto 0..1 between paw and planetary only
    const GROUND_CAP = 0.34;
    const u = THREE.MathUtils.clamp(p / GROUND_CAP, 0, 1);
    const props = lerpKeys(a, b, u);
    // Surface ALWAYS dense — flora + path corridor
    props.detailMul = Math.max(1.25, props.detailMul);
    props.vegMul = Math.max(1.45, props.vegMul);
    props.densityMul = Math.max(1.18, props.densityMul);
    props.terrainMul = Math.max(1.05, props.terrainMul);
    props.ruinMul = Math.max(1.1, props.ruinMul);
    props.pathMul = Math.max(1.4, props.pathMul);
    props.groundOp = Math.max(0.9, props.groundOp);
    // Gravity stays surface-like
    props.gravity = Math.max(0.9, props.gravity);
    props.airFriction = Math.max(0.85, props.airFriction);
    props.skyDark = Math.min(0.1, props.skyDark || 0);
    props.starBoost = Math.min(1.15, props.starBoost || 1);
    props.planetVis = 0; // never show planet while surface-locked
    return props;
  }

  /** Fast 0..1 seed for dressing / random (not terrain lattice) */
  function hash2(x, z) {
    const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
    return s - Math.floor(s);
  }

  /**
   * Lattice hash → 0..1 — same formula as GLSL (sin/fract) so CPU heightAt ≈ GPU mesh.
   */
  function latticeHash(ix, iz) {
    const s = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453123;
    return s - Math.floor(s);
  }

  /** Biome → GPU uniform id (must match GLSL boltHeightProfile) */
  const BIOME_GPU_ID = {
    crystalNebula: 0,
    emberVoid: 1,
    whisperStars: 2,
    frostGlacier: 3,
    jadeCanopy: 4,
    solarGold: 5,
    rosePulse: 6,
  };

  /**
   * GLSL noise + terrain height — mirrors JS valueNoise / fbm / ridge / domainWarp / profiles.
   * Fixed loop counts for WebGL; uBoltOctaves scales how many octaves contribute.
   */
  const GLSL_TERRAIN_NOISE = [
    "uniform float uBoltSprint;",
    "uniform float uBoltHeightMul;",
    "uniform float uBoltBiome;",
    "uniform float uBoltOctaves;",
    "float boltHash(float ix, float iz) {",
    "  return fract(sin(ix * 127.1 + iz * 311.7) * 43758.5453123);",
    "}",
    "float boltValueNoise(vec2 p) {",
    "  vec2 i = floor(p);",
    "  vec2 f = fract(p);",
    "  float u = f.x * f.x * f.x * (f.x * (f.x * 6.0 - 15.0) + 10.0);",
    "  float v = f.y * f.y * f.y * (f.y * (f.y * 6.0 - 15.0) + 10.0);",
    "  float a = boltHash(i.x, i.y);",
    "  float b = boltHash(i.x + 1.0, i.y);",
    "  float c = boltHash(i.x, i.y + 1.0);",
    "  float d = boltHash(i.x + 1.0, i.y + 1.0);",
    "  return mix(mix(a, b, u), mix(c, d, u), v);",
    "}",
    "float boltFbm(vec2 p, float maxOct) {",
    "  float val = 0.0;",
    "  float amp = 1.0;",
    "  float freq = 1.0;",
    "  float mx = 0.0;",
    "  for (int i = 0; i < 5; i++) {",
    "    float fi = float(i);",
    "    float w = step(fi, maxOct - 0.5);",
    "    val += w * amp * boltValueNoise(p * freq);",
    "    mx += w * amp;",
    "    amp *= 0.5;",
    "    freq *= 2.03;",
    "  }",
    "  return mx > 0.0 ? val / mx : 0.0;",
    "}",
    "float boltRidge(vec2 p, float maxOct) {",
    "  float val = 0.0;",
    "  float amp = 1.0;",
    "  float freq = 1.0;",
    "  float mx = 0.0;",
    "  float weight = 1.0;",
    "  for (int i = 0; i < 5; i++) {",
    "    float fi = float(i);",
    "    float w = step(fi, maxOct - 0.5);",
    "    float n = boltValueNoise(p * freq);",
    "    n = 1.0 - abs(n * 2.0 - 1.0);",
    "    n *= n;",
    "    n *= weight;",
    "    weight = clamp(n * 1.85, 0.0, 1.0);",
    "    val += w * n * amp;",
    "    mx += w * amp;",
    "    amp *= 0.5;",
    "    freq *= 2.07;",
    "  }",
    "  return mx > 0.0 ? val / mx : 0.0;",
    "}",
    "vec2 boltDomainWarp(vec2 p, float strength) {",
    "  float o = min(uBoltOctaves, 4.0);",
    "  float w1 = boltFbm(p * 0.009 + vec2(3.1, 1.7), o) - 0.5;",
    "  float w2 = boltFbm(p * 0.009 + vec2(19.4, 7.2), o) - 0.5;",
    "  vec2 p1 = p + vec2(w1, w2) * strength * 2.0;",
    "  float w3 = boltFbm(p1 * 0.014 + vec2(41.0, 9.0), min(o, 3.0)) - 0.5;",
    "  float w4 = boltFbm(p1 * 0.014 + vec2(8.0, 33.0), min(o, 3.0)) - 0.5;",
    "  return p + vec2(w1, w2) * strength * 2.0 + vec2(w3, w4) * strength * 0.65;",
    "}",
    "float boltHeightProfile(float biome, vec2 p, float macro, float mid, float micro, float detailMul) {",
    "  if (biome < 0.5) {", // crystalNebula + domain warp
    "    vec2 w = boltDomainWarp(p, 16.0);",
    "    float cMacro = boltFbm(w * 0.0072, uBoltOctaves);",
    "    float cMid = boltFbm(w * 0.024 + vec2(17.0, 0.0), min(uBoltOctaves, 4.0));",
    "    float cMicro = boltFbm(w * 0.078 + vec2(41.0, 0.0), min(uBoltOctaves, 3.0));",
    "    float cRidge = boltRidge(w * 0.012, min(uBoltOctaves, 4.0));",
    "    return cMacro * 3.35 + cMid * 1.9 + cMicro * 0.55 * detailMul + cRidge * 1.05;",
    "  } else if (biome < 1.5) {", // ember
    "    return boltRidge(p * 0.018, uBoltOctaves) * 5.2 + mid * 1.9 + micro * 0.45 * detailMul;",
    "  } else if (biome < 2.5) {", // whisper
    "    return macro * 1.35 + mid * 0.75 + micro * 0.28 * detailMul;",
    "  } else if (biome < 3.5) {", // frost
    "    return macro * 4.2 + pow(max(0.01, mid), 1.35) * 2.8 + micro * 0.55 * detailMul;",
    "  } else if (biome < 4.5) {", // jade
    "    return macro * 3.0 + mid * 1.75 + micro * 0.5 * detailMul;",
    "  } else if (biome < 5.5) {", // solar
    "    return sin(macro * 3.14159265 * 2.0) * 1.35 + mid * 2.4 + micro * 0.4 * detailMul;",
    "  }",
    "  return macro * 2.9 + mid * 1.7 + micro * 0.48 * detailMul;", // rose
    "}",
    "float boltTerrainHeight(vec2 worldXZ) {",
    "  float score = clamp(uBoltSprint, 0.0, 1.25);",
    "  float ampMul = 1.0 + score * 0.2;",
    "  float detailMul = 1.0 + score * 0.42;",
    "  float macro = boltFbm(worldXZ * 0.0075, uBoltOctaves);",
    "  float mid = boltFbm(worldXZ * 0.026 + vec2(17.0, 0.0), min(uBoltOctaves, 4.0));",
    "  float micro = boltFbm(worldXZ * 0.085 + vec2(41.0, 0.0), min(uBoltOctaves, 3.0));",
    "  float h = boltHeightProfile(uBoltBiome, worldXZ, macro, mid, micro, detailMul);",
    "  // Match JS: hash2(x*0.55, z*0.55)",
    "  float grit = (fract(sin(worldXZ.x * 0.55 * 127.1 + worldXZ.y * 0.55 * 311.7) * 43758.5453123) - 0.5)",
    "             * (0.22 + score * 0.12);",
    "  return (h + grit) * uBoltHeightMul * ampMul;",
    "}",
  ].join("\n");

  /**
   * Inject GPU height displacement into a MeshStandardMaterial (keeps maps / PBR lighting).
   * Score is baked into uniforms at chunk build — does not morph under Bolt every frame.
   */
  function applyGpuTerrainMaterial(mat, opts) {
    opts = opts || {};
    const score = opts.score != null ? opts.score : 0;
    const biomeId = opts.biomeId || "crystalNebula";
    const biomeGpu = BIOME_GPU_ID[biomeId] != null ? BIOME_GPU_ID[biomeId] : 0;
    let heightMul = 1;
    if (
      global.BoltProcedural &&
      global.BoltProcedural.BIOMES &&
      global.BoltProcedural.BIOMES[biomeId] &&
      global.BoltProcedural.BIOMES[biomeId].heightMul != null
    ) {
      heightMul = global.BoltProcedural.BIOMES[biomeId].heightMul;
    }
    const octaves = opts.octaves != null ? opts.octaves : GPU_OCTAVES;

    const uSprint = { value: score };
    const uBiome = { value: biomeGpu };
    const uHMul = { value: heightMul };
    const uOct = { value: Math.max(2, Math.min(5, octaves)) };

    mat.userData.boltGpuTerrain = true;
    mat.userData.boltGpuUniforms = {
      uBoltSprint: uSprint,
      uBoltBiome: uBiome,
      uBoltHeightMul: uHMul,
      uBoltOctaves: uOct,
    };

    mat.onBeforeCompile = function (shader) {
      shader.uniforms.uBoltSprint = uSprint;
      shader.uniforms.uBoltBiome = uBiome;
      shader.uniforms.uBoltHeightMul = uHMul;
      shader.uniforms.uBoltOctaves = uOct;

      shader.vertexShader = shader.vertexShader.replace(
        "#include <common>",
        "#include <common>\n" + GLSL_TERRAIN_NOISE
      );

      // Displace after begin_vertex; recompute normals for lighting/shadows
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        [
          "#include <begin_vertex>",
          "vec4 boltWorld = modelMatrix * vec4(transformed, 1.0);",
          "vec2 boltWxz = boltWorld.xz;",
          "float boltH = boltTerrainHeight(boltWxz);",
          "transformed.y = boltH;",
        ].join("\n")
      );

      shader.vertexShader = shader.vertexShader.replace(
        "#include <defaultnormal_vertex>",
        [
          "{",
          "  float e = 0.85;",
          "  float hL = boltTerrainHeight(boltWxz + vec2(-e, 0.0));",
          "  float hR = boltTerrainHeight(boltWxz + vec2( e, 0.0));",
          "  float hD = boltTerrainHeight(boltWxz + vec2(0.0, -e));",
          "  float hU = boltTerrainHeight(boltWxz + vec2(0.0,  e));",
          "  objectNormal = normalize(vec3(hL - hR, 2.0 * e, hD - hU));",
          "}",
          "#include <defaultnormal_vertex>",
        ].join("\n")
      );

      mat.userData.shader = shader;
    };

    mat.customProgramCacheKey = function () {
      return "boltGpuTerrain_v1_o" + Math.floor(uOct.value);
    };
    mat.needsUpdate = true;
    return mat;
  }

  /** Quintic smoothstep — fewer grid artifacts than cubic (closer to Simplex feel) */
  function fade5(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  /**
   * Smooth interpolated value noise (CPU).
   * Continuous across the plane — used for terrain height, not GPU Simplex.
   */
  function valueNoise(x, z) {
    const x0 = Math.floor(x);
    const z0 = Math.floor(z);
    const fx = x - x0;
    const fz = z - z0;
    const u = fade5(fx);
    const v = fade5(fz);
    const a = latticeHash(x0, z0);
    const b = latticeHash(x0 + 1, z0);
    const c = latticeHash(x0, z0 + 1);
    const d = latticeHash(x0 + 1, z0 + 1);
    const ab = a + (b - a) * u;
    const cd = c + (d - c) * u;
    return ab + (cd - ab) * v;
  }

  /**
   * Fractal Brownian Motion — normalized ~0..1
   * lacunarity slightly ≠ 2 reduces lattice ringing.
   */
  function fbm(x, z, octaves, persistence, lacunarity) {
    octaves = octaves != null ? octaves : 5;
    persistence = persistence != null ? persistence : 0.5;
    lacunarity = lacunarity != null ? lacunarity : 2.03;
    let v = 0;
    let a = 1;
    let f = 1;
    let max = 0;
    for (let i = 0; i < octaves; i++) {
      v += a * valueNoise(x * f, z * f);
      max += a;
      a *= persistence;
      f *= lacunarity;
    }
    return max > 0 ? v / max : 0;
  }

  /** Ridged multifractal — sharp crests for ember / alpine (~0..1) */
  function ridgeFbm(x, z, octaves) {
    octaves = octaves != null ? octaves : 5;
    let v = 0;
    let a = 1;
    let f = 1;
    let max = 0;
    let weight = 1;
    for (let i = 0; i < octaves; i++) {
      let n = valueNoise(x * f, z * f);
      n = 1 - Math.abs(n * 2 - 1); // invert ridges
      n *= n; // sharpen
      n *= weight;
      weight = Math.min(1, Math.max(0, n * 1.85));
      v += n * a;
      max += a;
      a *= 0.5;
      f *= 2.07;
    }
    return max > 0 ? v / max : 0;
  }

  /**
   * Domain warping — organic twist for Crystal Nebula.
   * strength in world units of displacement.
   */
  function domainWarp(x, z, strength) {
    const s = strength != null ? strength : 18;
    const w1 = fbm(x * 0.009 + 3.1, z * 0.009 + 1.7, 4) - 0.5;
    const w2 = fbm(x * 0.009 + 19.4, z * 0.009 + 7.2, 4) - 0.5;
    // Second pass (cheap multi-warp) for twisted crystal ridges
    const x1 = x + w1 * s * 2;
    const z1 = z + w2 * s * 2;
    const w3 = fbm(x1 * 0.014 + 41, z1 * 0.014 + 9, 3) - 0.5;
    const w4 = fbm(x1 * 0.014 + 8, z1 * 0.014 + 33, 3) - 0.5;
    return {
      x: x + w1 * s * 2 + w3 * s * 0.65,
      z: z + w2 * s * 2 + w4 * s * 0.65,
    };
  }

  /** Quantize sprint score so neighboring chunks share similar bake bands (less seams) */
  function quantizeSprintScore(s) {
    const t = Math.max(0, Math.min(1.25, s || 0));
    return Math.round(t * 4) / 4; // 0, 0.25, 0.5, 0.75, 1, 1.25
  }

  /**
   * Raw height profile for one biome id (no heightMul) — used for soft blending.
   * layers: { macro, mid, micro, ampMul, detailMul }
   */
  function heightProfile(biomeId, x, z, layers) {
    const macro = layers.macro;
    const mid = layers.mid;
    const micro = layers.micro;
    const detailMul = layers.detailMul != null ? layers.detailMul : 1;

    if (biomeId === "emberVoid") {
      return (
        ridgeFbm(x * 0.018, z * 0.018, 5) * 5.2 +
        mid * 1.9 +
        micro * 0.45 * detailMul
      );
    }
    if (biomeId === "whisperStars") {
      return macro * 1.35 + mid * 0.75 + micro * 0.28 * detailMul;
    }
    if (biomeId === "frostGlacier") {
      return (
        macro * 4.2 +
        Math.pow(Math.max(0.01, mid), 1.35) * 2.8 +
        micro * 0.55 * detailMul
      );
    }
    if (biomeId === "jadeCanopy") {
      return macro * 3.0 + mid * 1.75 + micro * 0.5 * detailMul;
    }
    if (biomeId === "solarGold") {
      return Math.sin(macro * Math.PI * 2) * 1.35 + mid * 2.4 + micro * 0.4 * detailMul;
    }
    if (biomeId === "rosePulse") {
      return macro * 2.9 + mid * 1.7 + micro * 0.48 * detailMul;
    }
    // crystalNebula — domain-warped organic crystal ridges + soft hills
    const w = domainWarp(x, z, 16);
    const cMacro = fbm(w.x * 0.0072, w.z * 0.0072, 5);
    const cMid = fbm(w.x * 0.024 + 17, w.z * 0.024, 4);
    const cMicro = fbm(w.x * 0.078 + 41, w.z * 0.078, 3);
    const cRidge = ridgeFbm(w.x * 0.012, w.z * 0.012, 4);
    return cMacro * 3.35 + cMid * 1.9 + cMicro * 0.55 * detailMul + cRidge * 1.05;
  }

  /**
   * Surface height at world XZ — macro continents + biome silhouette.
   * @param {number} [sprintScore] 0..1+ baked score for amplitude/detail (new chunks only)
   */
  function surfaceHeight(x, z, sprintScore) {
    const score = Math.max(0, Math.min(1.25, sprintScore || 0));
    // Mild: high score → slightly taller + richer detail (does NOT rebuild old chunks)
    const ampMul = 1.0 + score * 0.2;
    const detailMul = 1.0 + score * 0.42;

    const macro = fbm(x * 0.0075, z * 0.0075, 5);
    const mid = fbm(x * 0.026 + 17, z * 0.026, 4);
    const micro = fbm(x * 0.085 + 41, z * 0.085, 3);
    const layers = {
      macro: macro,
      mid: mid,
      micro: micro,
      ampMul: ampMul,
      detailMul: detailMul,
    };

    let h = 0;
    let mul = 1;
    if (global.BoltProcedural && global.BoltProcedural.sampleBiome) {
      const b = global.BoltProcedural.sampleBiome(x, z, 0);
      const mix = b.mix;
      const biomes = global.BoltProcedural.BIOMES || {};
      if (mix) {
        let sumW = 0;
        let hAcc = 0;
        let mulAcc = 0;
        const ids = global.BoltProcedural.SURFACE_BIOME_IDS || Object.keys(mix);
        for (let i = 0; i < ids.length; i++) {
          const id = ids[i];
          const w = mix[id] || 0;
          if (w < 0.02) continue;
          hAcc += heightProfile(id, x, z, layers) * w;
          const def = biomes[id];
          mulAcc += (def && def.heightMul != null ? def.heightMul : 1) * w;
          sumW += w;
        }
        if (sumW > 1e-6) {
          h = hAcc / sumW;
          mul = mulAcc / sumW;
        } else {
          const id = (b.primary && b.primary.id) || "crystalNebula";
          h = heightProfile(id, x, z, layers);
          mul = b.primary && b.primary.heightMul != null ? b.primary.heightMul : 1;
        }
      } else {
        const id = (b.primary && b.primary.id) || "crystalNebula";
        h = heightProfile(id, x, z, layers);
        mul = b.primary && b.primary.heightMul != null ? b.primary.heightMul : 1;
      }
    } else {
      h = heightProfile("crystalNebula", x, z, layers);
    }
    // Micro grit on the heightfield itself (score adds a little roughness)
    h += (hash2(x * 0.55, z * 0.55) - 0.5) * (0.22 + score * 0.12);
    return h * mul * ampMul;
  }

  /**
   * Height for a single biome (matches GLSL boltTerrainHeight for that chunk's majority biome).
   * Used by heightAt when GPU displacement is on so feet track the mesh.
   */
  function surfaceHeightPrimary(x, z, sprintScore, biomeId) {
    const score = Math.max(0, Math.min(1.25, sprintScore || 0));
    const ampMul = 1.0 + score * 0.2;
    const detailMul = 1.0 + score * 0.42;
    const layers = {
      macro: fbm(x * 0.0075, z * 0.0075, 5),
      mid: fbm(x * 0.026 + 17, z * 0.026, 4),
      micro: fbm(x * 0.085 + 41, z * 0.085, 3),
      ampMul: ampMul,
      detailMul: detailMul,
    };
    const id = biomeId || "crystalNebula";
    let mul = 1;
    if (global.BoltProcedural && global.BoltProcedural.BIOMES && global.BoltProcedural.BIOMES[id]) {
      const def = global.BoltProcedural.BIOMES[id];
      if (def.heightMul != null) mul = def.heightMul;
    }
    let h = heightProfile(id, x, z, layers);
    h += (hash2(x * 0.55, z * 0.55) - 0.5) * (0.22 + score * 0.12);
    return h * mul * ampMul;
  }

  class OpenWorld {
    constructor(scene) {
      this.scene = scene;
      this.chunks = new Map(); // "cx,cz" -> { group, cx, cz }
      this.group = new THREE.Group();
      this.group.name = "OpenWorld";
      scene.add(this.group);

      this.groundMat = new THREE.MeshStandardMaterial({
        color: 0x1a3a55,
        roughness: 0.92,
        metalness: 0.08,
        emissive: 0x061018,
        emissiveIntensity: 0.08,
        flatShading: false,
      });
      // Wire grid removed (ground polish tier 1) — organic veins live in albedo only

      // Legacy mini-marker removed — real Thunderwolf Citadel lives in citadel.js
      this.citadel = null;

      this.scaleStage = "paw";
      this.transitionProgress = 0; // 0..1 smooth scale driver
      this.scaleProps = lerpStageProps(0);
      this._lastCx = null;
      this._lastCz = null;
      /** Quantized sprint score used only when baking NEW chunks */
      this._terrainScore = 0;
    }

    _key(cx, cz) {
      return cx + "," + cz;
    }

    _buildChunk(cx, cz, scoreBake) {
      const g = new THREE.Group();
      g.userData.cx = cx;
      g.userData.cz = cz;
      // Bake sprint score into this chunk only (never morph existing ground under Bolt)
      const score =
        scoreBake != null ? scoreBake : this._terrainScore != null ? this._terrainScore : 0;
      g.userData.scoreBake = score;

      const ox = cx * CHUNK;
      const oz = cz * CHUNK;
      // Heightfield density from quality controller
      const segs = GROUND_SEGS;
      const geo = new THREE.PlaneGeometry(CHUNK, CHUNK, segs, segs);
      geo.rotateX(-Math.PI / 2);

      const pos = geo.attributes.position;
      const colors = new Float32Array(pos.count * 3);
      const tmpCol = new THREE.Color();
      const mixColorFn =
        global.BoltProcedural && global.BoltProcedural.mixBiomeColor
          ? global.BoltProcedural.mixBiomeColor
          : null;
      let biomeVotes = Object.create(null);
      let sampleN = 0;

      const useGpu = GPU_HEIGHT;
      // Cache height + biome samples — surfaceHeight/sampleBiome are expensive per vertex
      const hCache = new Map();
      const bCache = new Map();
      const quant = segs <= 18 ? 6 : segs <= 28 ? 4 : 2.5;
      function qKey(wx, wz) {
        return Math.round(wx / quant) + ":" + Math.round(wz / quant);
      }
      function heightCached(wx, wz) {
        const k = qKey(wx, wz);
        let h = hCache.get(k);
        if (h == null) {
          h = surfaceHeight(wx, wz, score);
          hCache.set(k, h);
        }
        return h;
      }
      function biomeCached(wx, wz) {
        if (!global.BoltProcedural || !global.BoltProcedural.sampleBiome) return null;
        const k = qKey(wx, wz);
        let b = bCache.get(k);
        if (b === undefined) {
          b = global.BoltProcedural.sampleBiome(wx, wz, 0);
          bCache.set(k, b);
        }
        return b;
      }

      for (let i = 0; i < pos.count; i++) {
        const lx = pos.getX(i);
        const lz = pos.getZ(i);
        const wx = ox + CHUNK * 0.5 + lx;
        const wz = oz + CHUNK * 0.5 + lz;
        let h = heightCached(wx, wz);
        if (useGpu) {
          pos.setY(i, 0); // GPU vertex shader applies full height
        } else {
          pos.setY(i, h);
        }

        // Soft per-vertex biome color (organic transitions, not square cell cuts)
        let cr = 0.15;
        let cg = 0.22;
        let cb = 0.32;
        const b = biomeCached(wx, wz);
        if (b) {
          if (mixColorFn && b.mix) {
            mixColorFn(b.mix, "ground", tmpCol);
            cr = tmpCol.r;
            cg = tmpCol.g;
            cb = tmpCol.b;
          } else if (b.primary) {
            tmpCol.setHex(b.primary.ground || 0x0c2840);
            cr = tmpCol.r;
            cg = tmpCol.g;
            cb = tmpCol.b;
          }
          const pid = b.primary && b.primary.id;
          if (pid) {
            biomeVotes[pid] = (biomeVotes[pid] || 0) + 1;
            sampleN++;
          }
        }
        // Height / noise shade so valleys read darker without hard stripes
        const n = hash2(wx * 0.08, wz * 0.08);
        const shade = 0.78 + n * 0.28 + Math.min(0.14, h * 0.012);
        colors[i * 3] = Math.min(1.4, cr * shade * 3.2);
        colors[i * 3 + 1] = Math.min(1.4, cg * shade * 3.2);
        colors[i * 3 + 2] = Math.min(1.4, cb * shade * 3.2);
      }
      pos.needsUpdate = true;
      geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      if (!useGpu) {
        geo.computeVertexNormals();
      } else {
        // GPU displaces + rebuilds normals; expand bounds so frustum cull stays correct
        geo.computeBoundingBox();
        if (geo.boundingBox) {
          geo.boundingBox.min.y = -8;
          geo.boundingBox.max.y = 55;
        }
        geo.computeBoundingSphere();
        if (geo.boundingSphere) {
          geo.boundingSphere.radius = Math.max(geo.boundingSphere.radius, CHUNK * 0.85);
        }
      }

      // Chunk albedo map from majority biome (vertex colors blend the edges)
      let biomeId = "crystalNebula";
      let bestVote = 0;
      for (const id in biomeVotes) {
        if (biomeVotes[id] > bestVote) {
          bestVote = biomeVotes[id];
          biomeId = id;
        }
      }
      if (sampleN === 0 && global.BoltProcedural && global.BoltProcedural.sampleBiome) {
        const b = global.BoltProcedural.sampleBiome(ox + CHUNK * 0.5, oz + CHUNK * 0.5);
        biomeId = b.primary.id;
      }

      let mat;
      if (global.BoltGraphics && global.BoltGraphics.makeGroundMaterial) {
        mat = global.BoltGraphics.makeGroundMaterial(biomeId);
        // Clone so we can enable vertexColors without mutating cache
        mat = mat.clone();
        mat.vertexColors = true;
        // Neutral base so vertex biome mix reads through the map
        mat.color.setRGB(1.05, 1.05, 1.05);
      } else {
        mat = this.groundMat.clone();
        mat.vertexColors = true;
        if (global.BoltProcedural && global.BoltProcedural.BIOMES) {
          const bm = global.BoltProcedural.BIOMES[biomeId];
          if (bm) {
            mat.color.setHex(bm.ground);
            mat.emissive.setHex(bm.groundEmissive);
            mat.emissiveIntensity = 0.12;
          }
        }
      }

      // Option 4: GPU height displacement (value noise + fBm + ridged + crystal warp)
      if (useGpu) {
        applyGpuTerrainMaterial(mat, {
          score: score,
          biomeId: biomeId,
          octaves: GPU_OCTAVES,
        });
      }

      const mesh = new THREE.Mesh(geo, mat);
      mesh.receiveShadow = true;
      mesh.castShadow = false;
      mesh.name = "GroundChunk";
      mesh.frustumCulled = true;
      mesh.userData.gpuHeight = useGpu;
      mesh.userData.biomeId = biomeId;
      g.userData.gpuHeight = useGpu;
      g.userData.biomeId = biomeId;
      g.add(mesh);

      // --- Tier 4: dense ground dressing (instanced) + clear bubbles ---
      // Dressing uses CPU height (same noise) so props sit on the GPU surface
      this._dressChunk(g, cx, cz, ox, oz, biomeId, score);

      g.position.set(ox + CHUNK * 0.5, 0, oz + CHUNK * 0.5);
      // Static chunk: freeze matrices (same look, less CPU every frame)
      g.traverse(function (obj) {
        if (obj.isMesh || obj.isInstancedMesh || obj.isGroup) {
          obj.matrixAutoUpdate = false;
          obj.updateMatrix();
          if (obj.isInstancedMesh && obj.instanceMatrix) {
            obj.instanceMatrix.needsUpdate = true;
          }
        }
        // Dressing never needs to cast shadows (expensive, low visual gain)
        if (obj.isMesh && obj !== mesh) {
          obj.castShadow = false;
          obj.receiveShadow = obj.receiveShadow !== false ? obj.receiveShadow : false;
        }
      });
      g.matrixAutoUpdate = false;
      g.updateMatrix();
      g.updateMatrixWorld(true);
      return g;
    }

    /**
     * Dense surface dressing: pebbles, moss, crystals, dust plates, few boulders.
     * Clear bubble around world origin (citadel) and sparse random clearings.
     */
    _dressChunk(g, cx, cz, ox, oz, biomeId, scoreBake) {
      const seed = hash2(cx * 12.3, cz * 45.7);
      const score = scoreBake != null ? scoreBake : 0;
      // When GPU height is on, match majority-biome height so props sit on the mesh
      const heightFn = GPU_HEIGHT
        ? function (wx, wz) {
            return surfaceHeightPrimary(wx, wz, score, biomeId);
          }
        : function (wx, wz) {
            return surfaceHeight(wx, wz, score);
          };
      const accent =
        (global.BoltProcedural &&
          global.BoltProcedural.BIOMES &&
          global.BoltProcedural.BIOMES[biomeId] &&
          global.BoltProcedural.BIOMES[biomeId].color) ||
        0x67e8f9;

      let rockMat;
      if (global.BoltGraphics && global.BoltGraphics.makeRockMaterial) {
        rockMat = global.BoltGraphics.makeRockMaterial(biomeId);
      } else {
        rockMat = new THREE.MeshStandardMaterial({
          color: 0x3f4a5a,
          roughness: 0.95,
          flatShading: true,
        });
      }

      const tuftCol =
        biomeId === "emberVoid"
          ? 0x7c2d12
          : biomeId === "jadeCanopy"
            ? 0x059669
            : biomeId === "frostGlacier"
              ? 0x64748b
              : biomeId === "rosePulse"
                ? 0x9d174d
                : 0x4c1d95;
      const tuftEm =
        biomeId === "emberVoid" ? 0xea580c : accent;

      const pebbleMat = rockMat;
      const tuftMat = new THREE.MeshStandardMaterial({
        color: tuftCol,
        emissive: tuftEm,
        emissiveIntensity: 0.22,
        roughness: 0.85,
        flatShading: true,
      });
      const crystMat = new THREE.MeshStandardMaterial({
        color: accent,
        emissive: accent,
        emissiveIntensity: 0.5,
        metalness: 0.45,
        roughness: 0.22,
        transparent: true,
        opacity: 0.92,
      });
      const plateMat = new THREE.MeshStandardMaterial({
        color: biomeId === "emberVoid" ? 0x3b1a0e : 0x0e2a40,
        roughness: 0.95,
        metalness: 0.05,
        emissive: accent,
        emissiveIntensity: 0.06,
      });

      const pebbleGeo = new THREE.DodecahedronGeometry(0.28, 0);
      const tuftGeo = new THREE.ConeGeometry(0.18, 0.42, 5);
      const crystGeo = new THREE.ConeGeometry(0.1, 0.48, 5);
      const plateGeo = new THREE.CylinderGeometry(0.55, 0.7, 0.08, 7);

      // Counts scale with quality dressMul — Low can drop almost all props
      const dm = DRESS_MUL;
      if (dm < 0.12) {
        return; // ultra-light: bare ground only
      }
      const nPebble = Math.max(0, Math.floor((28 + seed * 16) * dm));
      const nTuft = Math.max(0, Math.floor((18 + hash2(cx + 1, cz) * 12) * dm));
      const nCryst = dm < 0.35 ? 0 : Math.max(0, Math.floor((12 + hash2(cz + 2, cx) * 10) * dm));
      const nPlate = dm < 0.4 ? 0 : Math.max(0, Math.floor((8 + hash2(cx * 3, cz * 5) * 6) * dm));
      const nBoulder =
        dm < 0.5 ? 0 : Math.max(0, Math.floor((2 + seed * 2) * Math.min(1, dm)));

      const dummy = new THREE.Object3D();
      const CLEAR_CITADEL = 22; // keep gate / throne plaza readable

      function inClear(wx, wz) {
        if (Math.hypot(wx, wz) < CLEAR_CITADEL) return true;
        // Deterministic soft clearings (open flats / subtle path feel)
        const cellX = Math.floor(wx / 16);
        const cellZ = Math.floor(wz / 16);
        const c = hash2(cellX * 1.7, cellZ * 2.3);
        if (c > 0.88) {
          const lx = wx - cellX * 16 - 8;
          const lz = wz - cellZ * 16 - 8;
          if (Math.hypot(lx, lz) < 2.6 + c * 2) return true;
        }
        return false;
      }

      function placeInstances(count, geo, mat, kind) {
        const mesh = new THREE.InstancedMesh(geo, mat, count);
        mesh.castShadow = false; // still skip dressing shadows (expensive, little visual gain)
        mesh.receiveShadow = true;
        mesh.name = "Dress_" + kind;
        mesh.frustumCulled = true;
        let written = 0;
        const kindSalt = kind.charCodeAt(0) * 0.13;
        for (let i = 0; i < count * 3 && written < count; i++) {
          const px = (hash2(cx + i * 1.71 + kindSalt, cz + i * 0.9) - 0.5) * CHUNK * 0.92;
          const pz = (hash2(cz + i * 2.31, cx + i * 0.55 + kindSalt) - 0.5) * CHUNK * 0.92;
          const wx = ox + CHUNK * 0.5 + px;
          const wz = oz + CHUNK * 0.5 + pz;
          if (inClear(wx, wz)) continue;
          const hy = heightFn(wx, wz);
          const roll = hash2(i * 3.1 + cx, cz * 2.2 + i + kindSalt);
          dummy.position.set(px, hy + 0.04, pz);
          if (kind === "pebble") {
            const s = 0.55 + roll * 1.6;
            dummy.scale.set(s, 0.4 + roll * 0.85, s * (0.8 + roll * 0.3));
            dummy.rotation.set(roll * 2.1, roll * 4.2, roll * 1.3);
            dummy.position.y = hy + 0.08 * s;
          } else if (kind === "tuft") {
            const s = 0.7 + roll * 1.1;
            dummy.scale.set(s * 1.15, s, s * 1.15);
            dummy.rotation.set(0, roll * 6.28, (roll - 0.5) * 0.25);
            dummy.position.y = hy + 0.12 * s;
          } else if (kind === "cryst") {
            const s = 0.65 + roll * 1.35;
            dummy.scale.set(s * 0.7, s * (0.9 + roll), s * 0.7);
            dummy.rotation.set((roll - 0.5) * 0.4, roll * 5, (roll - 0.5) * 0.35);
            dummy.position.y = hy + 0.1 * s;
          } else if (kind === "plate") {
            const s = 0.9 + roll * 1.8;
            dummy.scale.set(s, 1, s);
            dummy.rotation.set(0, roll * 6.28, 0);
            dummy.position.y = hy + 0.03;
          } else {
            dummy.scale.set(1, 1, 1);
            dummy.rotation.set(0, 0, 0);
          }
          dummy.updateMatrix();
          mesh.setMatrixAt(written, dummy.matrix);
          written++;
        }
        if (written <= 0) return;
        mesh.count = written;
        mesh.instanceMatrix.needsUpdate = true;
        g.add(mesh);
      }

      placeInstances(nPebble, pebbleGeo, pebbleMat, "pebble");
      placeInstances(nTuft, tuftGeo, tuftMat, "tuft");
      placeInstances(nCryst, crystGeo, crystMat, "cryst");
      placeInstances(nPlate, plateGeo, plateMat, "plate");

      // Larger unique boulders + rare platforms (not instanced — few)
      for (let i = 0; i < nBoulder; i++) {
        const px = (hash2(cx + i * 4.1, cz + 9) - 0.5) * CHUNK * 0.75;
        const pz = (hash2(cz + i * 3.3, cx + 7) - 0.5) * CHUNK * 0.75;
        const wx = ox + CHUNK * 0.5 + px;
        const wz = oz + CHUNK * 0.5 + pz;
        if (inClear(wx, wz)) continue;
        const hy = heightFn(wx, wz);
        const roll = hash2(i + cx * 2, cz);
        if (roll < 0.22 && i === 0) {
          const plat = new THREE.Mesh(
            new THREE.BoxGeometry(4 + seed * 4, 0.55, 4 + seed * 2.5),
            new THREE.MeshStandardMaterial({
              color: 0x1e3a5f,
              metalness: 0.4,
              roughness: 0.5,
              emissive: accent,
              emissiveIntensity: 0.08,
            })
          );
          plat.position.set(px, hy + 0.28, pz);
          plat.receiveShadow = true;
          plat.castShadow = true;
          g.add(plat);
        } else {
          const rock = new THREE.Mesh(
            new THREE.DodecahedronGeometry(0.55 + roll * 1.5, 0),
            rockMat
          );
          rock.position.set(px, hy + 0.3 + roll * 0.25, pz);
          rock.scale.set(1.1, 0.55 + roll * 0.85, 1.1);
          rock.rotation.set(roll * 2, roll * 4, roll);
          rock.castShadow = true;
          rock.receiveShadow = true;
          g.add(rock);
        }
      }
    }

    /** Wipe and rebuild all chunks (used when landing on a new planet biome) */
    rebuildAll(wx, wz) {
      const self = this;
      this.chunks.forEach(function (ch) {
        if (!ch || !ch.group) return;
        self.group.remove(ch.group);
        ch.group.traverse(function (o) {
          if (o.geometry) o.geometry.dispose();
          if (o.material) {
            if (Array.isArray(o.material)) o.material.forEach(function (m) { m.dispose(); });
            else o.material.dispose();
          }
        });
      });
      this.chunks.clear();
      this._lastCx = null;
      this._lastCz = null;
      this.ensureAround(wx != null ? wx : 0, wz != null ? wz : 0);
    }

    /**
     * Stream chunks under Bolt + extra slices along velocity / look
     * so the path ahead always has ground (no empty horizon).
     * @param {number} wx
     * @param {number} wz
     * @param {{ vx?: number, vz?: number, lookYaw?: number, sprintScore?: number }} [opts]
     */
    ensureAround(wx, wz, opts) {
      opts = opts || {};
      const cx = Math.floor(wx / CHUNK);
      const cz = Math.floor(wz / CHUNK);

      // Sprint score only affects NEW chunks (baked once at build time)
      if (opts.sprintScore != null) {
        this._terrainScore = quantizeSprintScore(opts.sprintScore);
      }
      const scoreBake = this._terrainScore || 0;

      // Prefer motion direction; fall back to look yaw
      let fdx = 0;
      let fdz = 0;
      const sp = Math.hypot(opts.vx || 0, opts.vz || 0);
      if (sp > 0.8) {
        fdx = (opts.vx || 0) / sp;
        fdz = (opts.vz || 0) / sp;
      } else if (opts.lookYaw != null && isFinite(opts.lookYaw)) {
        fdx = Math.sin(opts.lookYaw);
        fdz = Math.cos(opts.lookYaw);
      }

      // Spread chunk mesh builds across frames (main hitch source when sprinting)
      let buildsLeft = MAX_BUILDS_PER_TICK;
      const pending = [];

      const needed = new Set();
      function need(ix, iz) {
        const k = this._key(ix, iz);
        needed.add(k);
        if (!this.chunks.has(k)) {
          pending.push({ ix: ix, iz: iz, k: k });
        }
      }
      const self = this;
      const add = function (ix, iz) {
        need.call(self, ix, iz);
      };

      // Base radius from quality tier (Low may use view=1)
      const view = Math.max(1, VIEW);
      for (let dz = -view; dz <= view; dz++) {
        for (let dx = -view; dx <= view; dx++) {
          add(cx + dx, cz + dz);
        }
      }

      // Directional extension: lighter on Low (AHEAD_EXTRA can be 0)
      if ((fdx !== 0 || fdz !== 0) && AHEAD_EXTRA > 0) {
        const ahead = view + AHEAD_EXTRA;
        for (let step = 1; step <= ahead; step++) {
          const bx = Math.round(fdx * step);
          const bz = Math.round(fdz * step);
          add(cx + bx, cz + bz);
          const px = -bz;
          const pz = bx;
          if (step <= view && AHEAD_EXTRA >= 1) {
            add(cx + bx + Math.round(px * 0.5), cz + bz + Math.round(pz * 0.5));
            add(cx + bx - Math.round(px * 0.5), cz + bz - Math.round(pz * 0.5));
          }
          if (step <= view && AHEAD_EXTRA >= 2) {
            add(cx + bx + px, cz + bz + pz);
            add(cx + bx - px, cz + bz - pz);
          }
        }
      }

      // Build nearest pending chunks first (under feet, then ahead)
      if (pending.length) {
        pending.sort(function (a, b) {
          const da = Math.abs(a.ix - cx) + Math.abs(a.iz - cz);
          const db = Math.abs(b.ix - cx) + Math.abs(b.iz - cz);
          // Prefer ahead of motion
          const aa = fdx || fdz ? (a.ix - cx) * fdx + (a.iz - cz) * fdz : 0;
          const ab = fdx || fdz ? (b.ix - cx) * fdx + (b.iz - cz) * fdz : 0;
          return da - db || ab - aa;
        });
        for (let pi = 0; pi < pending.length && buildsLeft > 0; pi++) {
          const p = pending[pi];
          if (this.chunks.has(p.k)) continue;
          const ch = this._buildChunk(p.ix, p.iz, scoreBake);
          this.group.add(ch);
          this.chunks.set(p.k, {
            group: ch,
            cx: p.ix,
            cz: p.iz,
            scoreBake: scoreBake,
            biomeId: ch.userData && ch.userData.biomeId,
            gpuHeight: !!(ch.userData && ch.userData.gpuHeight),
          });
          buildsLeft--;
        }
      }

      this._lastCx = cx;
      this._lastCz = cz;

      // Unload chunks not needed; keep ahead ones preferred
      const toRemove = [];
      this.chunks.forEach(function (val, k) {
        if (!needed.has(k)) toRemove.push(k);
      });
      if (this.chunks.size > MAX_CHUNKS) {
        toRemove.sort(function (a, b) {
          const A = self.chunks.get(a);
          const B = self.chunks.get(b);
          // Score: farther from player + behind motion = unload first
          function score(C) {
            const dx = C.cx - cx;
            const dz = C.cz - cz;
            const dist = Math.abs(dx) + Math.abs(dz);
            const behind = fdx || fdz ? -(dx * fdx + dz * fdz) : 0;
            return dist + behind * 2;
          }
          return score(B) - score(A);
        });
      }
      for (let i = 0; i < toRemove.length; i++) {
        const k = toRemove[i];
        const ch = this.chunks.get(k);
        if (!ch) continue;
        if (needed.has(k) && this.chunks.size <= MAX_CHUNKS) continue;
        // Never unload if still required
        if (needed.has(k)) continue;
        this.group.remove(ch.group);
        ch.group.traverse(function (o) {
          if (o.geometry) o.geometry.dispose();
          if (o.material) {
            if (Array.isArray(o.material)) o.material.forEach(function (m) { m.dispose(); });
            else o.material.dispose();
          }
        });
        this.chunks.delete(k);
      }
    }

    /**
     * Seamless scale shift — transitionProgress from speed, momentum, altitude.
     * Smooth damp + progressive fog/camera/ground opacity (no hard cuts).
     *
     * @returns {{ stage, progress, props }}
     */
    updateScale(speed, altitude, camera, scene, opts) {
      opts = opts || {};
      const momentum = opts.momentum != null ? opts.momentum : 0;
      const sprinting = !!opts.sprinting;
      const coreBoost = opts.coreBoost != null ? opts.coreBoost : 0; // Lightning Core helps hold scale
      const dt = opts.dt != null ? opts.dt : 0.016;
      const surfaceY = opts.surfaceY != null ? opts.surfaceY : 0;
      const onGround = !!opts.onGround;
      // Player chose to leave the ground (sprint-launch) — required for orbital+
      const ascentCommit = !!opts.ascentCommit;
      const heightAbove = Math.max(0, altitude - surfaceY);

      // Raw drivers (lore: speed + height + purpose/momentum)
      const speedF = THREE.MathUtils.clamp(speed / 42, 0, 1.15);
      const altF = THREE.MathUtils.clamp(heightAbove / 95, 0, 1);
      const momF = THREE.MathUtils.clamp(momentum, 0, 1);
      const coreF = THREE.MathUtils.clamp(coreBoost, 0, 1) * 0.12;

      // Surface mode never enters orbital prop blend (cap below orbital min 0.42)
      const GROUND_CAP = 0.34;
      const surfaceMode = onGround || !ascentCommit;

      let raw;
      if (surfaceMode) {
        // SURFACE — stay grounded forever if you want; max planetary feel
        const groundSpeed = speedF * 0.5 + momF * 0.22 + (sprinting ? 0.06 : 0);
        const hopAlt = !onGround && !ascentCommit ? altF * 0.1 : 0;
        raw = Math.min(groundSpeed + hopAlt, GROUND_CAP);
      } else {
        // ASCENT COMMIT — climb scales by sustained sprint + height (not flight)
        // Designed to hit Orbital in ~30s–2min of committed sprint-launch
        raw =
          speedF * 0.42 +
          altF * 0.52 +
          momF * 0.14 +
          coreF;
        if (heightAbove > 8) raw += 0.1;
        if (heightAbove > 18) raw += 0.12;
        if (heightAbove > 32) raw += 0.14;
        if (heightAbove > 55) raw += 0.1;
        if (sprinting && momentum > 0.45) raw += 0.06;
        if (!sprinting) raw *= 0.55;
        raw = THREE.MathUtils.clamp(raw, 0, 1);
      }

      const rising = raw > this.transitionProgress;
      const lambda = surfaceMode
        ? rising
          ? 1.4
          : 2.0
        : rising
        ? 1.45
        : 0.55;
      this.transitionProgress = THREE.MathUtils.damp(
        this.transitionProgress,
        raw,
        lambda,
        dt
      );
      if (surfaceMode && this.transitionProgress > GROUND_CAP) {
        this.transitionProgress = THREE.MathUtils.damp(
          this.transitionProgress,
          GROUND_CAP,
          4.0,
          dt
        );
      }

      // CRITICAL: surface uses paw↔planetary props only (never orbital mul that kills flora)
      const props = surfaceMode
        ? lerpStagePropsSurface(this.transitionProgress)
        : lerpStageProps(this.transitionProgress);
      this.scaleProps = props;
      this.scaleStage = props.id;

      // Fog + camera far — progressive
      if (scene.fog && scene.fog.density != null) {
        scene.fog.density = THREE.MathUtils.damp(
          scene.fog.density,
          props.fog,
          2.2,
          dt
        );
      }
      if (camera) {
        const targetFar = props.far;
        camera.far = THREE.MathUtils.damp(camera.far || 600, targetFar, 2.0, dt);
        camera.updateProjectionMatrix();
      }

      // Ground / grid LOD opacity — fade flat world as orbital planet sphere takes over
      const gOp = props.groundOp;
      this.group.traverse(function (o) {
        if (!o.isMesh || !o.material) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(function (m) {
          if (!m) return;
          if (m.wireframe && m.opacity != null) {
            m.opacity = 0.025 * gOp;
            return;
          }
          // Solid ground / props — fade out so spherical planet can be seen
          if (m.opacity != null || gOp < 0.95) {
            if (m.userData._baseOp == null) {
              m.userData._baseOp = m.opacity != null && m.opacity > 0 ? m.opacity : 1;
            }
            m.transparent = true;
            m.opacity = m.userData._baseOp * gOp;
            m.depthWrite = gOp > 0.2;
          }
        });
      });

      return {
        stage: this.scaleStage,
        progress: this.transitionProgress,
        props: props,
      };
    }

    /**
     * Adaptive quality — chunk radius / mesh segs / dressing.
     * Same art style; only density & range change.
     */
    setQuality(q) {
      if (!q) return;
      if (q.view != null) VIEW = Math.max(1, Math.min(4, q.view | 0));
      if (q.groundSegs != null) GROUND_SEGS = Math.max(12, Math.min(48, q.groundSegs | 0));
      if (q.dressMul != null) DRESS_MUL = Math.max(0.05, Math.min(1.4, q.dressMul));
      if (q.gpuHeight != null) GPU_HEIGHT = !!q.gpuHeight;
      if (q.gpuOctaves != null) GPU_OCTAVES = Math.max(2, Math.min(5, q.gpuOctaves | 0));
      if (q.maxChunks != null) MAX_CHUNKS = Math.max(12, Math.min(80, q.maxChunks | 0));
      if (q.maxBuilds != null) MAX_BUILDS_PER_TICK = Math.max(1, Math.min(6, q.maxBuilds | 0));
      if (q.aheadExtra != null) AHEAD_EXTRA = Math.max(0, Math.min(3, q.aheadExtra | 0));
      if (q.rebuild) this.rebuildStreaming();
    }

    /** Drop all chunks so next ensureAround rebuilds at current segs/dress */
    rebuildStreaming() {
      if (!this.chunks) return;
      this.chunks.forEach((ch) => {
        if (!ch || !ch.group) return;
        this.group.remove(ch.group);
        ch.group.traverse(function (o) {
          if (o.geometry) o.geometry.dispose();
          // materials often shared/cached — do not dispose maps
        });
      });
      this.chunks.clear();
      this._lastCx = null;
      this._lastCz = null;
    }

    /**
     * Ground height matching the chunk under (x,z).
     * GPU chunks: primary-biome formula (same as GLSL) + baked score.
     * CPU chunks: full biome blend + baked score.
     */
    heightAt(x, z) {
      const cx = Math.floor(x / CHUNK);
      const cz = Math.floor(z / CHUNK);
      const ch = this.chunks.get(this._key(cx, cz));
      let score = this._terrainScore || 0;
      let biomeId = null;
      let useGpu = GPU_HEIGHT;
      if (ch) {
        if (ch.scoreBake != null) score = ch.scoreBake;
        else if (ch.group && ch.group.userData && ch.group.userData.scoreBake != null) {
          score = ch.group.userData.scoreBake;
        }
        biomeId = ch.biomeId || (ch.group && ch.group.userData && ch.group.userData.biomeId);
        if (ch.gpuHeight != null) useGpu = ch.gpuHeight;
        else if (ch.group && ch.group.userData && ch.group.userData.gpuHeight != null) {
          useGpu = ch.group.userData.gpuHeight;
        }
      }
      if (useGpu && biomeId) {
        return surfaceHeightPrimary(x, z, score, biomeId);
      }
      return surfaceHeight(x, z, score);
    }

    getScaleFactors() {
      return this.scaleProps || lerpStageProps(this.transitionProgress || 0);
    }
  }

  global.BoltOpenWorld = {
    OpenWorld: OpenWorld,
    surfaceHeight: surfaceHeight,
    surfaceHeightPrimary: surfaceHeightPrimary,
    valueNoise: valueNoise,
    fbm: fbm,
    ridgeFbm: ridgeFbm,
    domainWarp: domainWarp,
    applyGpuTerrainMaterial: applyGpuTerrainMaterial,
    CHUNK: CHUNK,
    SCALE_STAGES: SCALE_STAGES,
    lerpStageProps: lerpStageProps,
    lerpStagePropsSurface: lerpStagePropsSurface,
    get gpuHeightEnabled() {
      return GPU_HEIGHT;
    },
    get gpuOctaves() {
      return GPU_OCTAVES;
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
