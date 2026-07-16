/**
 * BOLT ENGINE — ProceduralSpawner & Specialized Generators
 * Creative engine room of the Boltverse.
 *
 * P1 Meaningful Sprint Score · P2 Trajectory Predictor
 * P3 Specialized Generators (Path / Terrain / Vegetation / Ruin / Detail)
 * P4 Pools · Fade · Coherence · Biome weights · Score scaling
 *
 * The cosmos anticipates your path — not random noise at full power.
 */
(function (global) {
  "use strict";

  const THREE = global.THREE;
  if (!THREE) {
    console.error("procedural.js needs THREE loaded first");
    return;
  }

  const SPAWN_THRESHOLD = 0.65;
  const FADE_IN_SEC = 0.85;
  const FADE_OUT_SEC = 2.5;
  const MAX_ACTIVE = 120;
  const WORLD_R = 1e9; // open world — no practical edge
  const LOOKAHEAD_MIN = 2.4; // seconds — generate farther ahead
  const LOOKAHEAD_MAX = 6.5;

  /**
   * Golden rules: never on Bolt, never block the path, spawn ahead on flanks.
   * Paths may sit closer (they ARE the run lane).
   */
  const CLEAR = {
    player: 36, // hard bubble — Bolt always readable
    corridorHalf: 14, // clean highway half-width (meters)
    corridorAhead: 100,
    corridorBehind: 18,
    detailMin: 36,
    detailClear: 34,
    detailMax: 70,
    vegMin: 42,
    vegClear: 40,
    vegBigMin: 52,
    vegBigClear: 50,
    forestMin: 64,
    forestClear: 60,
    forestMax: 110,
    terrainMin: 48,
    terrainClear: 46,
    terrainMax: 95,
    landmarkPlayer: 58,
    ruinNestPlayer: 52,
    ruinDistantMin: 110,
    ruinDistantClear: 100,
    // Fade-out if anything drifts into view bubble
    killTerrain: 38,
    killLandmark: 48,
    killForest: 42,
    killRuin: 40,
    killDetail: 30,
    killVeg: 34,
  };

  /** Per-frame / live caps — high score ≠ spam everything */
  const SPAWN_BUDGET = {
    pathCap: 4,
    terrainCap: 6,
    landmarkCap: 2,
    // Small flora can be rich; big structures stay rare
    vegCap: 36, // stalks / flowers / bushes / clusters / vines / floaters
    bigVegCap: 5, // single trees / spires / canopy (not full forests)
    forestCap: 3, // full forest systems — keep low
    ruinCap: 3,
    detailCap: 14,
    // max successful spawns of each type per update tick
    pathPerTick: 2,
    terrainPerTick: 1,
    vegPerTick: 4, // mostly small plants fill these slots
    ruinPerTick: 1,
    detailPerTick: 1,
  };

  // ---------------------------------------------------------------------------
  // Rich spawn modes — density bands → scene kits
  // Low: sparse · Medium: groves · High: multi-layer forests · Very high: massive systems
  // ---------------------------------------------------------------------------
  const DENSITY_BANDS = {
    sparse: { id: "sparse", min: 0, max: 0.28 },
    medium: { id: "medium", min: 0.28, max: 0.55 },
    high: { id: "high", min: 0.55, max: 0.82 },
    veryHigh: { id: "veryHigh", min: 0.82, max: 99 },
  };

  function densityBand(density) {
    const d = density || 0;
    if (d < DENSITY_BANDS.medium.min) return DENSITY_BANDS.sparse;
    if (d < DENSITY_BANDS.high.min) return DENSITY_BANDS.medium;
    if (d < DENSITY_BANDS.veryHigh.min) return DENSITY_BANDS.high;
    return DENSITY_BANDS.veryHigh;
  }

  /**
   * Scene kit for vegetation (and later terrain/path cooperation).
   * preferForest → spawn coherent multi-layer forest systems instead of single plants.
   */
  function sceneKit(density, biomeId) {
    const band = densityBand(density);
    const d = THREE.MathUtils.clamp(density || 0, 0, 1.6);
    const bid = biomeId || "crystalNebula";

    // Biome density personality
    let vegBias = 1;
    let sparseBias = 1;
    if (bid === "jadeCanopy" || bid === "crystalNebula") vegBias = 1.25;
    else if (bid === "rosePulse") vegBias = 1.15;
    else if (bid === "emberVoid") vegBias = 0.95;
    else if (bid === "whisperStars") {
      vegBias = 0.72;
      sparseBias = 1.45;
    } else if (bid === "frostGlacier") {
      vegBias = 0.65;
      sparseBias = 1.35;
    } else if (bid === "solarGold") vegBias = 0.9;

    // Terrain / path co-authorship knobs (all bands; scale up with density)
    let terrainBias = 1;
    if (bid === "emberVoid" || bid === "frostGlacier") terrainBias = 1.3;
    else if (bid === "whisperStars") terrainBias = 0.85;
    else if (bid === "jadeCanopy") terrainBias = 0.75;

    const kit = {
      band: band.id,
      biomeId: bid,
      preferForest: false,
      forestChance: 0,
      forestRadius: 8,
      groundCount: 0,
      midCount: 0,
      canopyCount: 0,
      megaChance: 0,
      corridor: 2.8, // clear strip through forest (sprint path feel)
      lifeMul: 1,
      scaleMul: 1,
      vegWeightMul: vegBias,
      // Path through scenes
      pathThroughForest: false,
      pathLengthMul: 1,
      pathWidthMul: 1,
      // Terrain landmarks / canyon flanks
      preferLandmark: false,
      landmarkChance: 0,
      canyonChance: 0,
      landmarkScale: 1,
      terrainBias: terrainBias,
      // Ruins nested in forest footprints (temple at grove edge)
      preferGroveRuin: false,
      groveRuinChance: 0,
      groveTempleChance: 0,
    };

    if (band.id === "sparse") {
      kit.preferForest = false;
      kit.forestChance = 0;
      kit.groundCount = Math.floor(2 * vegBias);
      kit.midCount = 0;
      kit.canopyCount = 0;
      kit.lifeMul = 0.9;
      kit.pathThroughForest = false;
      kit.preferLandmark = false;
      kit.preferGroveRuin = false;
      kit.corridor = 5.5;
    } else if (band.id === "medium") {
      // Small groves — mini multi-layer, not full forest yet
      kit.preferForest = d > 0.42 && Math.random() < 0.28 * vegBias;
      kit.forestChance = 0.32 * vegBias;
      kit.forestRadius = (6 + d * 5) * sparseBias;
      kit.groundCount = Math.floor((3 + d * 4) * vegBias);
      kit.midCount = Math.floor((2 + d * 3) * vegBias);
      kit.canopyCount = Math.floor((1 + d * 1.5) * vegBias);
      kit.megaChance = 0.015;
      kit.corridor = 6.5; // wide clear strip through grove
      kit.lifeMul = 1.05;
      kit.scaleMul = 0.92;
      kit.pathThroughForest = true;
      kit.pathLengthMul = 1.12;
      kit.pathWidthMul = 1.08;
      kit.preferLandmark = d > 0.48;
      kit.landmarkChance = 0.22 * terrainBias;
      kit.canyonChance = 0.08 * terrainBias;
      kit.landmarkScale = 0.95 + d * 0.25;
      kit.preferGroveRuin = d > 0.45;
      kit.groveRuinChance = 0.32;
      kit.groveTempleChance = 0.14;
    } else if (band.id === "high") {
      // Full forest systems on flanks — fewer plants, wider lane
      kit.preferForest = true;
      kit.forestChance = 0.55 * vegBias;
      kit.forestRadius = (12 + d * 9) * Math.min(1.25, sparseBias);
      kit.groundCount = Math.floor((6 + d * 8) * vegBias);
      kit.midCount = Math.floor((4 + d * 6) * vegBias);
      kit.canopyCount = Math.floor((3 + d * 5) * vegBias);
      kit.megaChance = 0.08 * vegBias;
      kit.corridor = 8.5; // highway through the chaos
      kit.lifeMul = 1.35;
      kit.scaleMul = 1.0;
      kit.pathThroughForest = true;
      kit.pathLengthMul = 1.45;
      kit.pathWidthMul = 1.18;
      kit.preferLandmark = true;
      kit.landmarkChance = 0.42 * terrainBias;
      kit.canyonChance = 0.22 * terrainBias;
      kit.landmarkScale = 1.15 + d * 0.4;
      kit.preferGroveRuin = true;
      kit.groveRuinChance = 0.55;
      kit.groveTempleChance = 0.35;
    } else {
      // Very high — impressive flanks, not a wall of rocks on Bolt
      kit.preferForest = true;
      kit.forestChance = 0.68 * vegBias;
      kit.forestRadius = (16 + d * 12) * Math.min(1.3, sparseBias);
      kit.groundCount = Math.floor((8 + d * 10) * vegBias);
      kit.midCount = Math.floor((6 + d * 8) * vegBias);
      kit.canopyCount = Math.floor((4 + d * 7) * vegBias);
      kit.megaChance = 0.16 * vegBias;
      kit.corridor = 10.5; // widest clear lane at top speed
      kit.lifeMul = 1.55;
      kit.scaleMul = 1.06;
      kit.pathThroughForest = true;
      kit.pathLengthMul = 1.75;
      kit.pathWidthMul = 1.25;
      kit.preferLandmark = true;
      kit.landmarkChance = 0.5 * terrainBias;
      kit.canyonChance = 0.35 * terrainBias;
      kit.landmarkScale = 1.35 + d * 0.5;
      kit.preferGroveRuin = true;
      kit.groveRuinChance = 0.65;
      kit.groveTempleChance = 0.48;
    }

    // Hard caps for performance + readability (one entity = whole forest)
    kit.groundCount = Math.min(kit.groundCount, 14);
    kit.midCount = Math.min(kit.midCount, 12);
    kit.canopyCount = Math.min(kit.canopyCount, 10);
    return kit;
  }

  // ---------------------------------------------------------------------------
  // Lightweight noise (hash-based value noise + fbm) — no external lib
  // ---------------------------------------------------------------------------
  function hash2(x, z) {
    const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
    return s - Math.floor(s);
  }
  function noise2(x, z) {
    const xi = Math.floor(x);
    const zi = Math.floor(z);
    const xf = x - xi;
    const zf = z - zi;
    const u = xf * xf * (3 - 2 * xf);
    const v = zf * zf * (3 - 2 * zf);
    const a = hash2(xi, zi);
    const b = hash2(xi + 1, zi);
    const c = hash2(xi, zi + 1);
    const d = hash2(xi + 1, zi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, z, oct) {
    let a = 0.5;
    let f = 1;
    let v = 0;
    for (let i = 0; i < (oct || 4); i++) {
      v += a * noise2(x * f, z * f);
      a *= 0.5;
      f *= 2.05;
    }
    return v;
  }

  /**
   * Biome domain-warp strength for forests (Quilez-style organic density).
   * Higher = more flowing thickets / clearings.
   */
  function forestWarpStrength(biomeId) {
    switch (biomeId) {
      case "emberVoid":
        return 3.2; // sharper, more aggressive thickets
      case "whisperStars":
        return 6.2; // soft dreamy flow
      case "jadeCanopy":
        return 5.4;
      case "frostGlacier":
        return 3.6;
      case "solarGold":
        return 4.4;
      case "rosePulse":
        return 5.0;
      case "crystalNebula":
      default:
        return 5.5; // elegant flowing crystal groves
    }
  }

  /**
   * Domain-warped forest density field at world XZ.
   * Returns 0..1 — high = thick grove, low = clearing.
   * Double warp (Inigo Quilez style) so forests feel grown, not circular blobs.
   *
   * @param {number} worldX
   * @param {number} worldZ
   * @param {string} [biomeId]
   * @param {number} [sprintScore] 0..1+ meaningful density / score
   */
  function forestDensity(worldX, worldZ, biomeId, sprintScore) {
    const score = Math.max(0, Math.min(1.4, sprintScore || 0));
    const baseWarp = forestWarpStrength(biomeId || "crystalNebula");
    // Stronger warp at high sprint → more organic dramatic shapes
    const strength = baseWarp * (0.75 + score * 0.65);

    // Forest-scale coords (large coherent regions)
    const px = worldX * 0.008;
    const pz = worldZ * 0.008;
    const oct = score > 0.75 ? 4 : 3;

    // First domain warp
    const q1 = fbm(px, pz, oct);
    const q2 = fbm(px + 5.2, pz + 1.3, oct);

    // Second domain warp
    const r1 = fbm(px + strength * q1 + 1.7, pz + strength * q2 + 9.2, oct);
    const r2 = fbm(px + strength * q1 + 8.3, pz + strength * q2 + 2.8, oct);

    // Final density evaluation
    let d = fbm(px + strength * r1, pz + strength * r2, Math.min(5, oct + 1));

    // Soft remap → usable forest range (clearings + thickets)
    // fbm ~0..1; push mid-tones into readable density
    d = THREE.MathUtils.smoothstep(-0.02, 0.72, d);

    // Biome personality on the field
    if (biomeId === "emberVoid") {
      // denser thickets, fewer open clearings
      d = THREE.MathUtils.smoothstep(0.05, 0.78, d * 1.08);
    } else if (biomeId === "whisperStars") {
      // more open / dreamy gaps
      d *= 0.88;
    } else if (biomeId === "jadeCanopy") {
      d = Math.min(1, d * 1.06);
    }

    // Mild score lift so high dens fills slightly more (still leaves clearings)
    d = Math.min(1, d * (0.92 + score * 0.12));
    return d;
  }

  /**
   * Peak forest density near a point (samples center + flanks) — for spawn decisions.
   */
  function forestDensityNear(worldX, worldZ, biomeId, sprintScore, yaw) {
    const d0 = forestDensity(worldX, worldZ, biomeId, sprintScore);
    const fx = Math.sin(yaw || 0);
    const fz = Math.cos(yaw || 0);
    const rx = Math.cos(yaw || 0);
    const rz = -Math.sin(yaw || 0);
    // Sample side-forward pockets (where forests actually spawn)
    const d1 = forestDensity(
      worldX + fx * 18 + rx * 28,
      worldZ + fz * 18 + rz * 28,
      biomeId,
      sprintScore
    );
    const d2 = forestDensity(
      worldX + fx * 18 - rx * 28,
      worldZ + fz * 18 - rz * 28,
      biomeId,
      sprintScore
    );
    const d3 = forestDensity(
      worldX + fx * 40 + rx * 22,
      worldZ + fz * 40 + rz * 22,
      biomeId,
      sprintScore
    );
    return Math.max(d0, d1, d2, d3);
  }

  // ---------------------------------------------------------------------------
  // Biome system (weights auto-normalize to 100%)
  // ---------------------------------------------------------------------------
  /**
   * Biomes = large cosmic regions (look + generator behavior + atmosphere).
   * CELL size makes regions feel like distinct "countries" of the cosmos.
   */
  const BIOME_CELL = 260; // world units — cross biomes more often while sprinting

  const BIOMES = {
    crystalNebula: {
      id: "crystalNebula",
      name: "Crystal Nebula Plains",
      short: "CRYSTAL NEBULA",
      // ethereal cyan/violet
      color: 0x67e8f9,
      emissive: 0x22d3ee,
      ground: 0x0c2840,
      groundEmissive: 0x0a3a55,
      rock: 0x6b7c99,
      plant: 0xa78bfa,
      plantEmissive: 0x7c3aed,
      path: 0x67e8f9,
      ruin: 0x94a3b8,
      sky: 0x041830,
      fog: 0x0c3860,
      ambient: 0x5eead4,
      sun: 0xa5f3fc,
      rim: 0x22d3ee,
      fogDensity: 0.0038,
      heightMul: 0.85, // smoother plains
      weights: {
        path: 0.18,
        terrain: 0.14,
        vegetation: 0.30,
        ruin: 0.12,
        detail: 0.26,
      },
    },
    emberVoid: {
      id: "emberVoid",
      name: "Ember Void",
      short: "EMBER VOID",
      color: 0xf97316,
      emissive: 0xea580c,
      ground: 0x1a0c08,
      groundEmissive: 0x3b1208,
      rock: 0x3f2a22,
      plant: 0xfb923c,
      plantEmissive: 0xc2410c,
      path: 0xfbbf24,
      ruin: 0x78716c,
      sky: 0x1a0804,
      fog: 0x3a1408,
      ambient: 0xfb923c,
      sun: 0xfed7aa,
      rim: 0xef4444,
      fogDensity: 0.0048,
      heightMul: 1.55, // harsher ridges
      weights: {
        path: 0.10,
        terrain: 0.42,
        vegetation: 0.14,
        ruin: 0.18,
        detail: 0.16,
      },
    },
    whisperStars: {
      id: "whisperStars",
      name: "Whispering Starfields",
      short: "WHISPER STARS",
      color: 0xe0e7ff,
      emissive: 0xa5b4fc,
      ground: 0x0a0a18,
      groundEmissive: 0x141428,
      rock: 0x334155,
      plant: 0xc4b5fd,
      plantEmissive: 0x8b5cf6,
      path: 0xa5b4fc,
      ruin: 0xcbd5e1,
      sky: 0x08061a,
      fog: 0x14102e,
      ambient: 0xa5b4fc,
      sun: 0xe0e7ff,
      rim: 0xc4b5fd,
      fogDensity: 0.0026,
      heightMul: 0.55, // sparse flat dark fields
      weights: {
        path: 0.12,
        terrain: 0.12,
        vegetation: 0.10,
        ruin: 0.22,
        detail: 0.44,
      },
    },
    // Worlds you can land on (companion planets)
    solarGold: {
      id: "solarGold",
      name: "Solaris Goldfields",
      short: "SOLARIS",
      color: 0xfbbf24,
      emissive: 0xf59e0b,
      ground: 0x1c1408,
      groundEmissive: 0x3b2a0a,
      rock: 0x78716c,
      plant: 0xfde68a,
      plantEmissive: 0xfbbf24,
      path: 0xfcd34d,
      ruin: 0xd6d3d1,
      sky: 0x1e1206,
      fog: 0x3a2208,
      ambient: 0xfbbf24,
      sun: 0xfef3c7,
      rim: 0xf59e0b,
      fogDensity: 0.0035,
      heightMul: 0.95,
      weights: { path: 0.16, terrain: 0.22, vegetation: 0.18, ruin: 0.2, detail: 0.24 },
    },
    frostGlacier: {
      id: "frostGlacier",
      name: "Glacier-3 Ice Shelf",
      short: "GLACIER",
      color: 0x7dd3fc,
      emissive: 0x38bdf8,
      ground: 0x0a1628,
      groundEmissive: 0x123048,
      rock: 0x94a3b8,
      plant: 0xbae6fd,
      plantEmissive: 0x7dd3fc,
      path: 0xa5f3fc,
      ruin: 0xe2e8f0,
      sky: 0x061420,
      fog: 0x0c2840,
      ambient: 0x93c5fd,
      sun: 0xe0f2fe,
      rim: 0x38bdf8,
      fogDensity: 0.0028,
      heightMul: 1.35,
      weights: { path: 0.14, terrain: 0.35, vegetation: 0.08, ruin: 0.16, detail: 0.27 },
    },
    jadeCanopy: {
      id: "jadeCanopy",
      name: "Jade Ward Canopy",
      short: "JADE WARD",
      color: 0x34d399,
      emissive: 0x10b981,
      ground: 0x061a12,
      groundEmissive: 0x0a2e1c,
      rock: 0x3f5a4a,
      plant: 0x6ee7b7,
      plantEmissive: 0x34d399,
      path: 0x5eead4,
      ruin: 0x86efac,
      sky: 0x051a10,
      fog: 0x0c2e1c,
      ambient: 0x34d399,
      sun: 0xd1fae5,
      rim: 0x10b981,
      fogDensity: 0.004,
      heightMul: 1.15,
      weights: { path: 0.12, terrain: 0.18, vegetation: 0.38, ruin: 0.12, detail: 0.2 },
    },
    rosePulse: {
      id: "rosePulse",
      name: "Rose Pulsar Gardens",
      short: "ROSE PULSAR",
      color: 0xf472b6,
      emissive: 0xec4899,
      ground: 0x1a0814,
      groundEmissive: 0x3b1030,
      rock: 0x6b4a5a,
      plant: 0xf9a8d4,
      plantEmissive: 0xf472b6,
      path: 0xf0abfc,
      ruin: 0xe9d5ff,
      sky: 0x160810,
      fog: 0x2e0c1c,
      ambient: 0xf472b6,
      sun: 0xfce7f3,
      rim: 0xec4899,
      fogDensity: 0.0036,
      heightMul: 0.75,
      weights: { path: 0.15, terrain: 0.15, vegetation: 0.28, ruin: 0.18, detail: 0.24 },
    },
  };

  // All biomes wander the surface; planet landings still use PLANET_BIOME_MAP
  const SURFACE_BIOME_IDS = [
    "crystalNebula",
    "emberVoid",
    "whisperStars",
    "solarGold",
    "frostGlacier",
    "jadeCanopy",
    "rosePulse",
  ];
  const BIOME_LIST = SURFACE_BIOME_IDS.map(function (id) {
    return BIOMES[id];
  });
  const BIOME_COUNT = SURFACE_BIOME_IDS.length;

  /** Map companion-planet hue → biome id when Bolt lands */
  const PLANET_BIOME_MAP = {
    ember: "emberVoid",
    violet: "whisperStars",
    ice: "frostGlacier",
    gold: "solarGold",
    jade: "jadeCanopy",
    crystal: "crystalNebula",
    rose: "rosePulse",
  };

  /** When set (string biome id), entire surface uses that planet's biome */
  let forceBiomeId = null;
  function setForceBiome(id) {
    forceBiomeId = id && BIOMES[id] ? id : null;
  }
  function getForceBiome() {
    return forceBiomeId;
  }

  function emptyMix() {
    const m = Object.create(null);
    for (let i = 0; i < SURFACE_BIOME_IDS.length; i++) m[SURFACE_BIOME_IDS[i]] = 0;
    return m;
  }

  function cellBiomeId(cx, cz) {
    // Stable hash → weighted 7-biome layout (uneven for character)
    const h = hash2(cx * 1.7, cz * 2.3);
    if (h < 0.16) return "crystalNebula";
    if (h < 0.32) return "emberVoid";
    if (h < 0.46) return "whisperStars";
    if (h < 0.58) return "solarGold";
    if (h < 0.70) return "frostGlacier";
    if (h < 0.85) return "jadeCanopy";
    return "rosePulse";
  }

  /**
   * Domain-warp world XZ so biome regions are organic blobs, not grid squares.
   */
  function warpBiomeCoord(x, z) {
    const a = fbm(x * 0.0055, z * 0.0055, 3);
    const b = fbm(x * 0.0055 + 41.7, z * 0.0055 - 19.3, 3);
    const c = fbm(x * 0.011 + 7, z * 0.011 + 3, 2);
    const amp = BIOME_CELL * 0.72;
    return {
      x: x + (a - 0.5) * amp + (c - 0.5) * amp * 0.35,
      z: z + (b - 0.5) * amp + (c - 0.5) * amp * 0.28,
    };
  }

  /**
   * Large soft regions via warped distance-to-cell-centers (no hard square edges).
   * Returns mix weights, primary, and edge=0..1 how transitional the point is.
   * forceBiomeId locks the whole world to a landed planet's biome.
   */
  function sampleBiome(x, z, resonance) {
    // Landed on another world — full biome takeover
    if (forceBiomeId && BIOMES[forceBiomeId]) {
      const b = BIOMES[forceBiomeId];
      const mix = emptyMix();
      mix[forceBiomeId] = 1;
      return {
        primary: b,
        mix: mix,
        edge: 0,
        cell: { cx: 0, cz: 0 },
        forced: true,
      };
    }
    const res = resonance || 0;
    const wpt = warpBiomeCoord(x, z);
    const fx = wpt.x / BIOME_CELL;
    const fz = wpt.z / BIOME_CELL;
    const cx0 = Math.floor(fx);
    const cz0 = Math.floor(fz);

    const w = emptyMix();
    // Soft influence from 3×3 (and corners) — organic borders, not axis-aligned lines
    const influenceR = BIOME_CELL * 1.05;
    let top1 = 0;
    let top2 = 0;

    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const cx = cx0 + dx;
        const cz = cz0 + dz;
        const id = cellBiomeId(cx, cz);
        // Jittered cell centers → meandering frontier
        const jx = (hash2(cx * 2.1, cz * 3.7) - 0.5) * BIOME_CELL * 0.42;
        const jz = (hash2(cz * 4.3, cx * 1.9) - 0.5) * BIOME_CELL * 0.42;
        const ccx = (cx + 0.5) * BIOME_CELL + jx;
        const ccz = (cz + 0.5) * BIOME_CELL + jz;
        const d = Math.hypot(wpt.x - ccx, wpt.z - ccz);
        // Smooth falloff (quadratic) — wide transition belt
        let t = 1 - THREE.MathUtils.smoothstep(0, influenceR, d);
        t = t * t;
        // Extra noise freckles so the border isn't a smooth ellipse either
        const freckle = 0.85 + fbm(ccx * 0.01 + x * 0.004, ccz * 0.01 + z * 0.004, 2) * 0.3;
        t *= freckle;
        w[id] += t;
        if (t > top1) {
          top2 = top1;
          top1 = t;
        } else if (t > top2) {
          top2 = t;
        }
      }
    }

    // Resonance gently boosts Crystal Nebula (Pack joy → living light)
    w.crystalNebula += res * 0.08;

    // Gentle regional mottling (never enough to hard-swap alone)
    const n = fbm(x * 0.0035, z * 0.0035, 3);
    w.emberVoid += Math.max(0, (n - 0.58) * 0.06);
    w.whisperStars += Math.max(0, (0.42 - n) * 0.05);
    w.jadeCanopy += Math.max(0, (fbm(x * 0.0028 + 9, z * 0.0028, 2) - 0.58) * 0.05);
    w.rosePulse += Math.max(0, (fbm(x * 0.0028 - 4, z * 0.0028 + 2, 2) - 0.6) * 0.05);
    w.solarGold += Math.max(0, (fbm(x * 0.003 + 12, z * 0.003 - 8, 2) - 0.62) * 0.04);
    w.frostGlacier += Math.max(0, (fbm(x * 0.003 - 11, z * 0.003 + 5, 2) - 0.62) * 0.04);

    let sum = 0;
    for (let i = 0; i < SURFACE_BIOME_IDS.length; i++) sum += w[SURFACE_BIOME_IDS[i]];
    if (sum < 1e-6) sum = 1;
    for (let i = 0; i < SURFACE_BIOME_IDS.length; i++) {
      w[SURFACE_BIOME_IDS[i]] /= sum;
    }

    let primary = BIOMES.crystalNebula;
    let maxW = -1;
    let second = 0;
    for (let i = 0; i < SURFACE_BIOME_IDS.length; i++) {
      const id = SURFACE_BIOME_IDS[i];
      const ww = w[id];
      if (ww > maxW) {
        second = maxW;
        maxW = ww;
        primary = BIOMES[id];
      } else if (ww > second) {
        second = ww;
      }
    }
    // edge: 0 pure core · 1 strong multi-biome transition
    const edge = THREE.MathUtils.clamp(
      1 - (maxW - second) * 2.2,
      0,
      1
    );

    return {
      primary: primary,
      mix: w,
      edge: edge,
      cell: { cx: cx0, cz: cz0 },
    };
  }

  /**
   * Lerp a hex ground/plant color by mix weights (for vertex tints / atmosphere).
   * target: THREE.Color out
   */
  function mixBiomeColor(mix, channel, target) {
    channel = channel || "ground";
    if (!target) target = new THREE.Color();
    let r = 0;
    let g = 0;
    let b = 0;
    let s = 0;
    const tmp = new THREE.Color();
    for (let i = 0; i < SURFACE_BIOME_IDS.length; i++) {
      const id = SURFACE_BIOME_IDS[i];
      const wt = mix[id] || 0;
      if (wt < 0.01) continue;
      const def = BIOMES[id];
      const hex = def[channel] != null ? def[channel] : def.ground;
      tmp.setHex(hex);
      r += tmp.r * wt;
      g += tmp.g * wt;
      b += tmp.b * wt;
      s += wt;
    }
    if (s < 1e-6) {
      target.setHex(BIOMES.crystalNebula.ground);
    } else {
      target.setRGB(r / s, g / s, b / s);
    }
    return target;
  }

  /** Lerp atmosphere colors for smooth biome transitions */
  class BiomeAtmosphere {
    constructor() {
      this.sky = new THREE.Color(BIOMES.crystalNebula.sky);
      this.fog = new THREE.Color(BIOMES.crystalNebula.fog);
      this.ambient = new THREE.Color(BIOMES.crystalNebula.ambient);
      this.sun = new THREE.Color(BIOMES.crystalNebula.sun);
      this.rim = new THREE.Color(BIOMES.crystalNebula.rim);
      this.fogDensity = BIOMES.crystalNebula.fogDensity;
      this.currentId = "crystalNebula";
      this.displayName = BIOMES.crystalNebula.name;
      this._target = sampleBiome(0, 0, 0);
    }

    update(x, z, resonance, dt, scene, lights) {
      this._target = sampleBiome(x, z, resonance);
      const b = this._target.primary;
      const t = 1 - Math.exp(-3.2 * dt); // snappier biome atmo (sky/fog/lights)
      this.sky.lerp(new THREE.Color(b.sky), t);
      this.fog.lerp(new THREE.Color(b.fog), t);
      this.ambient.lerp(new THREE.Color(b.ambient), t);
      this.sun.lerp(new THREE.Color(b.sun), t);
      this.rim.lerp(new THREE.Color(b.rim), t);
      this.fogDensity = THREE.MathUtils.damp(this.fogDensity, b.fogDensity, 3.0, dt);
      this.currentId = b.id;
      this.displayName = b.name;

      if (scene) {
        if (scene.background && scene.background.isColor) scene.background.copy(this.sky);
        else scene.background = this.sky.clone();
        if (scene.fog) {
          scene.fog.color.copy(this.fog);
          if (scene.fog.density != null) scene.fog.density = this.fogDensity;
        }
      }
      if (lights) {
        if (lights.ambient) {
          lights.ambient.color.copy(this.ambient);
          if (lights.ambient.groundColor) {
            lights.ambient.groundColor.copy(this.fog);
          }
        }
        if (lights.sun) lights.sun.color.copy(this.sun);
        if (lights.rim) lights.rim.color.copy(this.rim);
        if (lights.fill) lights.fill.color.copy(this.ambient).multiplyScalar(0.6);
      }
      return this._target;
    }
  }

  // ---------------------------------------------------------------------------
  // P1 — Meaningful Sprint Score
  // ---------------------------------------------------------------------------
  class MeaningfulSprintScore {
    constructor() {
      this.score = 0;
      this.speedFactor = 0;
      this.momentumFactor = 0;
      this.intentionFactor = 0;
      this.trajectoryFactor = 0;
      this._dirHistory = [];
      this._histMax = 28;
    }

    update(p, dt) {
      this.speedFactor = THREE.MathUtils.clamp(p.speed / 26, 0, 1);
      this.momentumFactor = THREE.MathUtils.clamp(p.momentum || 0, 0, 1);
      this.intentionFactor = THREE.MathUtils.clamp(p.intention || 0, 0, 1);

      if (p.speed > 2 && p.velocity) {
        const d = new THREE.Vector3(p.velocity.x, 0, p.velocity.z);
        if (d.lengthSq() > 1e-6) {
          d.normalize();
          this._dirHistory.push(d);
          if (this._dirHistory.length > this._histMax) this._dirHistory.shift();
        }
      }
      let traj = 0.3;
      if (this._dirHistory.length >= 4) {
        const last = this._dirHistory[this._dirHistory.length - 1];
        let sum = 0;
        for (let i = 0; i < this._dirHistory.length; i++) {
          sum += Math.max(0, this._dirHistory[i].dot(last));
        }
        traj = sum / this._dirHistory.length;
      }
      this.trajectoryFactor = THREE.MathUtils.clamp(traj, 0, 1);

      const raw =
        this.speedFactor * 0.32 +
        this.momentumFactor * 0.22 +
        this.intentionFactor * 0.28 +
        this.trajectoryFactor * 0.18;

      const sprintMul = p.sprinting ? 1 : 0.52;
      const target = THREE.MathUtils.clamp(raw * sprintMul, 0, 1);
      const lambda = target > this.score ? 3.4 : 1.5;
      this.score = THREE.MathUtils.damp(this.score, target, lambda, dt);
      return this.score;
    }

    get active() {
      return this.score >= SPAWN_THRESHOLD;
    }

    /** 0..1 density once above gate */
    get density() {
      if (this.score < SPAWN_THRESHOLD) return 0;
      return THREE.MathUtils.clamp(
        (this.score - SPAWN_THRESHOLD) / (1 - SPAWN_THRESHOLD),
        0,
        1
      );
    }
  }

  // ---------------------------------------------------------------------------
  // P2 — Trajectory Predictor (2–5+ seconds ahead)
  // ---------------------------------------------------------------------------
  class TrajectoryPredictor {
    constructor() {
      this.predicted = new THREE.Vector3();
      this.horizonSec = LOOKAHEAD_MIN;
    }

    predict(pos, vel, momentum, predictMul) {
      const m = THREE.MathUtils.clamp(momentum || 0, 0, 1);
      const pm = predictMul != null ? predictMul : 1;
      // Higher momentum + cosmic scale → farther horizon (lore: 2–5+ sec, longer at scale)
      this.horizonSec =
        THREE.MathUtils.lerp(LOOKAHEAD_MIN, LOOKAHEAD_MAX, m) * Math.min(4.5, pm);
      const t = this.horizonSec;
      this.predicted.set(pos.x + vel.x * t, pos.y, pos.z + vel.z * t);
      return this.predicted;
    }
  }

  // ---------------------------------------------------------------------------
  // P4 — Pooled entity with fade in / graceful fade out
  // ---------------------------------------------------------------------------
  class SpawnedEntity {
    constructor(mesh, kind) {
      this.mesh = mesh;
      this.kind = kind;
      this.active = false;
      this.age = 0;
      this.life = 12;
      this.fade = 0;
      this.fadingOut = false;
      this.baseScale = 1;
      this.homeY = 0;
    }

    activate(pos, scale, life, rotY) {
      this.active = true;
      this.age = 0;
      this.life = life;
      this.fade = 0;
      this.fadingOut = false;
      this.baseScale = scale;
      this.homeY = pos.y;
      this.mesh.position.copy(pos);
      this.mesh.position.y = pos.y - 0.75;
      this.mesh.rotation.y = rotY != null ? rotY : Math.random() * Math.PI * 2;
      this.mesh.scale.setScalar(0.01);
      this.mesh.visible = true;
      this.mesh.traverse((c) => {
        if (c.material) {
          const mats = Array.isArray(c.material) ? c.material : [c.material];
          mats.forEach((m) => {
            m.transparent = true;
            m.opacity = 0;
            m.depthWrite = false;
          });
        }
      });
    }

    release() {
      this.active = false;
      this.mesh.visible = false;
      this.mesh.scale.setScalar(0.01);
    }
  }

  class ObjectPool {
    constructor(createFn, kind, size) {
      this.kind = kind;
      this.free = [];
      this.live = [];
      for (let i = 0; i < size; i++) {
        const mesh = createFn();
        mesh.visible = false;
        this.free.push(new SpawnedEntity(mesh, kind));
      }
    }

    acquire() {
      let e = this.free.pop();
      if (!e) {
        if (this.live.length === 0) return null;
        e = this.live.shift();
        e.release();
      }
      e._prevFade = null;
      if (e.mesh) {
        e.mesh.matrixAutoUpdate = true;
        e.mesh.userData._matFrozen = false;
      }
      this.live.push(e);
      return e;
    }

    update(dt, meaningfulActive, playerPos) {
      for (let i = this.live.length - 1; i >= 0; i--) {
        const e = this.live[i];
        e.age += dt;
        // Emergency clear: bubble + run-corridor solids (keep Bolt visible)
        if (
          playerPos &&
          (this.kind === "terrain" ||
            this.kind === "vegetation" ||
            this.kind === "ruin" ||
            this.kind === "detail") &&
          e.mesh &&
          e.mesh.position
        ) {
          const dx = e.mesh.position.x - playerPos.x;
          const dz = e.mesh.position.z - playerPos.z;
          const distSq = dx * dx + dz * dz;
          const ud = e.mesh.userData || {};
          let killR = CLEAR.killVeg;
          if (this.kind === "terrain") {
            killR = ud.landmark ? CLEAR.killLandmark : CLEAR.killTerrain;
          } else if (this.kind === "vegetation") {
            killR = ud.forest ? CLEAR.killForest : CLEAR.killVeg;
          } else if (this.kind === "ruin") {
            killR = CLEAR.killRuin;
          } else if (this.kind === "detail") {
            killR = CLEAR.killDetail;
          }
          let inKill = distSq < killR * killR;
          // Solids sitting in the highway fade even if slightly farther
          if (
            !inKill &&
            this.kind !== "detail" &&
            distSq < (killR * 1.65) * (killR * 1.65) &&
            this._owner &&
            typeof this._owner._lastYaw === "number"
          ) {
            const yaw = this._owner._lastYaw;
            const fx = Math.sin(yaw);
            const fz = Math.cos(yaw);
            const rx = Math.cos(yaw);
            const rz = -Math.sin(yaw);
            const along = dx * fx + dz * fz;
            const side = dx * rx + dz * rz;
            const hw =
              this.kind === "terrain" || this.kind === "ruin"
                ? CLEAR.corridorHalf + 2
                : CLEAR.corridorHalf;
            if (along > -CLEAR.corridorBehind && along < CLEAR.corridorAhead * 0.55 && Math.abs(side) < hw) {
              inKill = true;
            }
          }
          if (inKill) {
            e.fadingOut = true;
            e.fade = Math.min(e.fade, 0.1);
            // Fast dissolve when blocking vision / path
            e.fade = Math.max(0, e.fade - dt * 3.2);
          }
        }
        if ((!meaningfulActive || e.age > e.life) && !e.fadingOut) {
          e.fadingOut = true;
        }
        if (e.fadingOut) e.fade = Math.max(0, e.fade - dt / FADE_OUT_SEC);
        else e.fade = Math.min(1, e.fade + dt / FADE_IN_SEC);

        const f = e.fade;
        const isPath = e.mesh.userData && e.mesh.userData.isPathEntity;
        const isVeg = e.kind === "vegetation" || (e.mesh.userData && e.mesh.userData.kind === "vegetation");
        const fadeDirty =
          e._prevFade == null ||
          Math.abs(f - e._prevFade) > 0.002 ||
          e.fadingOut ||
          f < 0.99;
        e._prevFade = f;

        if (fadeDirty) {
          e.mesh.matrixAutoUpdate = true;
          if (isPath) {
            // Paths stay full scale — only opacity fades (otherwise tubes vanish)
            e.mesh.scale.setScalar(1);
            e.mesh.position.y = e.homeY;
          } else {
            e.mesh.scale.setScalar(Math.max(0.01, e.baseScale * (0.12 + 0.88 * f)));
            e.mesh.position.y = e.homeY - (1 - f) * 0.9;
          }
          // Opacity only while fading (full-visible entities skip full traverse)
          e.mesh.traverse((c) => {
            if (c.material) {
              const mats = Array.isArray(c.material) ? c.material : [c.material];
              mats.forEach((m) => {
                const base = m.userData.baseOpacity != null ? m.userData.baseOpacity : 1;
                m.opacity = f * base;
                m.depthWrite = !isPath && m.opacity > 0.92;
              });
            }
            // Small foliage/detail never cast shadows (looks the same, big GPU save)
            if (c.isMesh && (isVeg || e.kind === "detail")) {
              c.castShadow = false;
            }
          });
        } else if (!isVeg && e.kind !== "detail" && e.kind !== "ruin") {
          // Fully solid static prop: freeze world matrix
          if (!e.mesh.userData._matFrozen) {
            e.mesh.matrixAutoUpdate = false;
            e.mesh.updateMatrix();
            e.mesh.updateMatrixWorld(true);
            e.mesh.userData._matFrozen = true;
          }
        }

        // Gentle sway for vegetation (organic life) — only live plants
        if (isVeg && e.mesh.userData.swayParts && e.mesh.userData.swayParts.length) {
          e.mesh.matrixAutoUpdate = true;
          e.mesh.userData._matFrozen = false;
          e.mesh.userData.swayT = (e.mesh.userData.swayT || 0) + dt;
          const t = e.mesh.userData.swayT;
          e.mesh.userData.swayParts.forEach((part, pi) => {
            if (!part) return;
            const amt = part.userData.swayAmt || 0.04;
            const ph = (part.userData.swayPhase || pi) + t * 1.6;
            part.rotation.z = Math.sin(ph) * amt;
            part.rotation.x = Math.cos(ph * 0.7) * amt * 0.5;
          });
        }
        // Resonance pulse on ruin runes / loot gems (skip full traverse when solid)
        if (e.kind === "ruin" && e.mesh.userData.pulseParts && e.mesh.userData.pulseParts.length) {
          e.mesh.matrixAutoUpdate = true;
          e.mesh.userData._matFrozen = false;
          e.mesh.userData.pulseT = (e.mesh.userData.pulseT || 0) + dt;
          const pt = e.mesh.userData.pulseT;
          e.mesh.userData.pulseParts.forEach((part, pi) => {
            if (!part || !part.material) return;
            const mats = Array.isArray(part.material) ? part.material : [part.material];
            mats.forEach((m) => {
              if (m.emissiveIntensity != null) {
                const base = m.userData._pulseBase != null ? m.userData._pulseBase : m.emissiveIntensity;
                m.userData._pulseBase = base;
                m.emissiveIntensity = base * (0.85 + Math.sin(pt * 2.5 + pi) * 0.25);
              }
            });
            if (part.userData.isLoot) {
              part.rotation.y += dt * 1.2;
              part.position.y += Math.sin(pt * 3 + pi) * 0.002;
            }
          });
        }
        // DetailGenerator — float, spin, pulse, drifting motes
        if (e.kind === "detail") {
          e.mesh.matrixAutoUpdate = true;
          e.mesh.userData._matFrozen = false;
          const ud = e.mesh.userData;
          ud.animT = (ud.animT || 0) + dt;
          const t = ud.animT;
          if (ud.floatParts) {
            ud.floatParts.forEach((part, pi) => {
              if (!part) return;
              if (part.userData.baseY == null) part.userData.baseY = part.position.y;
              const baseY = part.userData.baseY;
              const spd = part.userData.floatSpeed || 0.5;
              part.position.y = baseY + Math.sin(t * spd * 2 + pi) * 0.12;
            });
          }
          if (ud.spinParts) {
            ud.spinParts.forEach((part, pi) => {
              if (!part) return;
              part.rotation.y += dt * (0.6 + pi * 0.1);
              part.rotation.x += dt * 0.2;
            });
          }
          if (ud.pulseParts) {
            ud.pulseParts.forEach((part, pi) => {
              if (!part || !part.material) return;
              const mats = Array.isArray(part.material) ? part.material : [part.material];
              mats.forEach((m) => {
                if (m.emissiveIntensity != null) {
                  const base = m.userData._pulseBase != null ? m.userData._pulseBase : m.emissiveIntensity;
                  m.userData._pulseBase = base;
                  m.emissiveIntensity = base * (0.8 + Math.sin(t * 3 + pi) * 0.3);
                }
              });
            });
          }
          if (ud.motePoints && ud.moteBase) {
            const attr = ud.motePoints.geometry.attributes.position;
            const base = ud.moteBase;
            for (let mi = 0; mi < attr.count; mi++) {
              const i3 = mi * 3;
              attr.array[i3] = base[i3] + Math.sin(t * 0.7 + mi * 0.3) * 0.15;
              attr.array[i3 + 1] = base[i3 + 1] + Math.sin(t * 1.1 + mi * 0.5) * 0.2;
              attr.array[i3 + 2] = base[i3 + 2] + Math.cos(t * 0.6 + mi * 0.4) * 0.15;
            }
            attr.needsUpdate = true;
          }
        }

        if (e.fadingOut && e.fade <= 0.001) {
          e.mesh.userData._matFrozen = false;
          e.mesh.matrixAutoUpdate = true;
          e._prevFade = null;
          e.release();
          this.live.splice(i, 1);
          this.free.push(e);
        }
      }
    }

    get activeCount() {
      return this.live.length;
    }
  }

  // ---------------------------------------------------------------------------
  // Materials helper
  // ---------------------------------------------------------------------------
  function mkMat(color, opts) {
    opts = opts || {};
    const m = new THREE.MeshStandardMaterial({
      color: color,
      emissive: opts.emissive != null ? opts.emissive : 0x000000,
      emissiveIntensity: opts.emissiveIntensity != null ? opts.emissiveIntensity : 0,
      roughness: opts.roughness != null ? opts.roughness : 0.65,
      metalness: opts.metalness != null ? opts.metalness : 0.25,
      transparent: true,
      opacity: 0,
      flatShading: !!opts.flat,
    });
    m.userData.baseOpacity = opts.opacity != null ? opts.opacity : 1;
    return m;
  }

  // ---------------------------------------------------------------------------
  // Specialized Generators — mesh factories (biome-tinted at spawn)
  // ---------------------------------------------------------------------------

  /**
   * PathGenerator — four path archetypes of the Boltverse:
   *  hidden | shortcut | branch | energy
   *
   * Builds spline-like polylines with noise routing, then TubeGeometry ribbons.
   * Complexity / visibility / style scale with density + biome.
   */
  const PATH_TYPES = {
    hidden: {
      id: "hidden",
      name: "Hidden Trail",
      width: 0.45,
      opacity: 0.55,
      segs: 12,
      length: 22,
      curve: 0.5,
      emissive: 0.9,
      glow: true,
    },
    shortcut: {
      id: "shortcut",
      name: "Shortcut",
      width: 0.55,
      opacity: 0.62,
      segs: 10,
      length: 26,
      curve: 0.1,
      emissive: 1.0,
      glow: true,
    },
    branch: {
      id: "branch",
      name: "Branching Route",
      width: 0.5,
      opacity: 0.6,
      segs: 11,
      length: 24,
      curve: 0.32,
      emissive: 0.95,
      glow: true,
      forks: true,
    },
    energy: {
      id: "energy",
      name: "Glowing Energy Path",
      width: 0.62,
      opacity: 0.68,
      segs: 12,
      length: 28,
      curve: 0.18,
      emissive: 1.15,
      glow: true,
      pulse: true,
    },
  };

  // Keep several glowing routes in play so Bolt always has a lane ahead
  const MAX_LIVE_PATHS = 8;

  /** Pick path archetype from density + biome */
  function pickPathType(density, biomeId, resonance) {
    const d = density || 0;
    const r = Math.random();
    // High score → more energy paths + branches
    if (d > 0.7 && r < 0.45 + (resonance || 0) * 0.15) return PATH_TYPES.energy;
    if (d > 0.55 && r < 0.55) return PATH_TYPES.branch;
    if (d > 0.35 && r < 0.5) return PATH_TYPES.shortcut;
    // Crystal favors energy; Ember favors jagged shortcuts; Whisper favors hidden
    if (biomeId === "whisperStars" && r < 0.55) return PATH_TYPES.hidden;
    if (biomeId === "emberVoid" && r < 0.4) return PATH_TYPES.shortcut;
    if (biomeId === "crystalNebula" && r < 0.35) return PATH_TYPES.energy;
    if (r < 0.3) return PATH_TYPES.hidden;
    if (r < 0.55) return PATH_TYPES.shortcut;
    if (r < 0.75) return PATH_TYPES.branch;
    return PATH_TYPES.energy;
  }

  /**
   * Sample points along a noise-warped route (spline-like)
   * @returns {THREE.Vector3[]}
   */
  /**
   * Sample points along a noise-warped route.
   * guide: { targetX, targetZ, stick, lengthMul, throughForest }
   *  — steers path through forest / canyon corridors when co-authoring scenes.
   */
  function generatePathPoints(start, yaw, typeDef, density, heightAt, seed, guide) {
    const pts = [];
    const g = guide || null;
    const lenMul = g && g.lengthMul != null ? g.lengthMul : 1;
    const segs =
      typeDef.segs +
      Math.floor(density * 8) +
      4 +
      (g && g.throughForest ? 6 : 0);
    const len = typeDef.length * (1.15 + density * 0.95) * lenMul;
    const step = len / segs;
    let x = start.x;
    let z = start.z;
    let dir = yaw;
    // Prefer mostly-forward paths so Bolt always has a lane to run into
    const curve = typeDef.curve * (typeDef.id === "hidden" ? 1.0 : 0.75);
    const stick = g && g.stick != null ? g.stick : typeDef.id === "shortcut" ? 0.55 : 0.35;

    // Precompute target bearing if routing through a scene footprint
    let targetYaw = yaw;
    if (g && g.targetX != null && g.targetZ != null) {
      targetYaw = Math.atan2(g.targetX - start.x, g.targetZ - start.z);
    }

    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const n = (noise2(seed + x * 0.05, seed + z * 0.05) - 0.5) * 2;
      const n2 = (noise2(seed + z * 0.08, seed + x * 0.07) - 0.5) * 2;
      if (i > 0) {
        // Pull toward forest/canyon center early, then exit along run heading
        const aim =
          g && g.throughForest
            ? t < 0.55
              ? THREE.MathUtils.lerp(yaw, targetYaw, 0.65)
              : THREE.MathUtils.lerp(targetYaw, yaw, (t - 0.55) / 0.45)
            : yaw;
        dir += n * curve * (g && g.throughForest ? 0.22 : 0.4);
        dir = THREE.MathUtils.lerp(dir, aim, stick);
        if (typeDef.id === "energy" && !(g && g.throughForest)) {
          dir = yaw + Math.sin(t * Math.PI * 1.2 + seed) * 0.35 * Math.max(0.2, curve);
        }
        // Through forest: gentle S only — stay in corridor
        if (g && g.throughForest) {
          dir += Math.sin(t * Math.PI * 1.6 + seed) * 0.08;
        }
        x += Math.sin(dir) * step;
        z += Math.cos(dir) * step;
      }
      // Subtle above ground — thin glowing guide, not a highway
      const y = heightAt(x, z) + 0.28 + Math.abs(n2) * 0.06;
      const lift = typeDef.id === "energy" ? 0.12 : 0.08;
      pts.push(new THREE.Vector3(x, y + lift, z));
    }
    return pts;
  }

  function buildTubeFromPoints(pts, radius, color, emissive, emissiveIntensity, opacity) {
    if (pts.length < 2) return null;
    const curve = new THREE.CatmullRomCurve3(pts);
    const tubular = Math.max(20, pts.length * 3);
    const geo = new THREE.TubeGeometry(curve, tubular, radius, 6, false);
    // Subtle glow — guide line, not a neon pipe
    const mat = new THREE.MeshStandardMaterial({
      color: color,
      emissive: emissive || color,
      emissiveIntensity: Math.min(0.85, (emissiveIntensity || 1) * 0.4),
      metalness: 0.2,
      roughness: 0.4,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    mat.userData.baseOpacity = Math.min(0.72, opacity * 0.85);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.userData.isPathTube = true;
    mesh.frustumCulled = false;
    return mesh;
  }

  /** Road deck under tube — clearly visible path surface */
  function buildDeckFromPoints(pts, width, color, opacity) {
    if (pts.length < 2) return null;
    const g = new THREE.Group();
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const mid = a.clone().add(b).multiplyScalar(0.5);
      const dir = b.clone().sub(a);
      const len = dir.length();
      if (len < 0.05) continue;
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.85, 0.08, len * 1.02),
        new THREE.MeshStandardMaterial({
          color: color,
          emissive: color,
          emissiveIntensity: 0.35,
          metalness: 0.25,
          roughness: 0.5,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        })
      );
      box.material.userData.baseOpacity = Math.min(0.55, opacity * 0.55);
      box.position.copy(mid);
      box.position.y += 0.04;
      box.lookAt(b);
      box.rotateX(Math.PI / 2);
      box.frustumCulled = false;
      g.add(box);
    }
    return g;
  }

  /** Empty path shell for pooling — rebuilt on each activate */
  function createPathMesh() {
    const g = new THREE.Group();
    g.userData.kind = "path";
    g.userData.pathType = "energy";
    g.userData.rebuild = null; // set by PathGenerator.layout
    return g;
  }

  /**
   * PathGenerator.layout — rebuilds a pooled group into a full path network
   */
  const PathGenerator = {
    layout: function (group, opts) {
      // Dispose old geometry
      while (group.children.length) {
        const c = group.children.pop();
        if (c.geometry) c.geometry.dispose();
        if (c.material) {
          if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose());
          else c.material.dispose();
        }
      }

      const typeDef = opts.typeDef || PATH_TYPES.energy;
      const biome = opts.biome;
      const density = opts.density || 0;
      const heightAt = opts.heightAt || function () { return 0; };
      const start = opts.start;
      const yaw = opts.yaw;
      const seed = opts.seed || Math.random() * 100;

      const col = biome.path || biome.color;
      const em = biome.emissive || col;

      // Main ribbon — subtle guide path (thin + soft glow); guide routes through forests
      const pathGuide = opts.guide || null;
      const mainPts = generatePathPoints(
        start,
        yaw,
        typeDef,
        Math.max(0.45, density),
        heightAt,
        seed,
        pathGuide
      );
      const widthMul = pathGuide && pathGuide.widthMul != null ? pathGuide.widthMul : 1;
      const radius =
        typeDef.width *
        (0.7 + density * 0.25) *
        (typeDef.id === "hidden" ? 0.65 : 0.85) *
        widthMul;

      function toLocal(meshOrGroup) {
        if (!meshOrGroup) return;
        if (meshOrGroup.isMesh && meshOrGroup.geometry) {
          const posAttr = meshOrGroup.geometry.attributes.position;
          for (let i = 0; i < posAttr.count; i++) {
            posAttr.setXYZ(
              i,
              posAttr.getX(i) - start.x,
              posAttr.getY(i) - start.y,
              posAttr.getZ(i) - start.z
            );
          }
          posAttr.needsUpdate = true;
          meshOrGroup.geometry.computeBoundingSphere();
          meshOrGroup.geometry.computeBoundingBox();
        }
        if (meshOrGroup.isGroup) {
          meshOrGroup.children.forEach((ch) => {
            if (ch.position) {
              ch.position.x -= start.x;
              ch.position.y -= start.y;
              ch.position.z -= start.z;
            }
          });
        }
      }

      // Deck + thin tube — subtle path, not a highway
      const deck = buildDeckFromPoints(mainPts, radius * 1.35, col, typeDef.opacity * 0.7);
      if (deck) {
        toLocal(deck);
        group.add(deck);
      }

      const main = buildTubeFromPoints(
        mainPts,
        radius * 0.75,
        col,
        em,
        typeDef.emissive * 0.7,
        typeDef.opacity * 0.75
      );
      if (main) {
        toLocal(main);
        group.add(main);
      }

      // Single soft glow (no outer mega-halo)
      if (typeDef.glow && mainPts.length >= 2) {
        const glow = buildTubeFromPoints(
          mainPts.map((p) => p.clone()),
          radius * 1.15,
          col,
          em,
          typeDef.emissive * 0.4,
          typeDef.opacity * 0.22
        );
        if (glow) {
          toLocal(glow);
          group.add(glow);
        }
      }

      // Sparse edge sparks only (not big lantern posts)
      if (mainPts.length >= 4 && density > 0.35) {
        const stepR = Math.max(2, Math.floor(mainPts.length / 8));
        for (let i = 1; i < mainPts.length - 1; i += stepR) {
          if (Math.random() > 0.55) continue;
          const a = mainPts[i];
          const b = mainPts[Math.min(i + 1, mainPts.length - 1)];
          const dx = b.x - a.x;
          const dz = b.z - a.z;
          const len = Math.hypot(dx, dz) || 1;
          const sx = (-dz / len) * (radius * 1.2);
          const sz = (dx / len) * (radius * 1.2);
          const side = Math.random() > 0.5 ? 1 : -1;
          const mote = new THREE.Mesh(
            new THREE.SphereGeometry(0.05, 6, 6),
            new THREE.MeshStandardMaterial({
              color: col,
              emissive: em,
              emissiveIntensity: 0.9,
              transparent: true,
              opacity: 0,
              depthWrite: false,
            })
          );
          mote.material.userData.baseOpacity = 0.55;
          mote.position.set(a.x + sx * side, a.y + 0.15, a.z + sz * side);
          group.add(mote);
          toLocal(mote);
        }
      }

      // Branching routes — fork from midpoint
      if (typeDef.forks && density > 0.45) {
        const mid = mainPts[Math.floor(mainPts.length * 0.45)];
        if (mid) {
          const forkYaw = yaw + (Math.random() > 0.5 ? 0.85 : -0.85);
          const forkDef = Object.assign({}, PATH_TYPES.shortcut, {
            length: typeDef.length * 0.55,
            segs: 6,
            curve: 0.4,
            opacity: typeDef.opacity * 0.85,
          });
          const forkPts = generatePathPoints(mid, forkYaw, forkDef, density * 0.8, heightAt, seed + 7);
          const forkDeck = buildDeckFromPoints(forkPts, radius * 2.4, col, typeDef.opacity * 0.9);
          if (forkDeck) {
            toLocal(forkDeck);
            group.add(forkDeck);
          }
          const fork = buildTubeFromPoints(
            forkPts,
            radius * 0.9,
            col,
            em,
            typeDef.emissive,
            typeDef.opacity * 0.95
          );
          if (fork) {
            toLocal(fork);
            group.add(fork);
          }

          // Single fork only (second fork was too busy)
        }
      }

      // Chevron markers for energy highways (Crystal Highway feel)
      if (typeDef.id === "energy" || typeDef.id === "shortcut") {
        const step = Math.max(2, Math.floor(mainPts.length / 5));
        for (let i = step; i < mainPts.length - 1; i += step) {
          const p = mainPts[i];
          const p2 = mainPts[i + 1] || p;
          const chev = new THREE.Mesh(
            new THREE.ConeGeometry(0.22, 0.45, 3),
            mkMat(col, { emissive: em, emissiveIntensity: 1.2, opacity: Math.min(1, typeDef.opacity + 0.1) })
          );
          chev.position.set(p.x - start.x, p.y - start.y + 0.15, p.z - start.z);
          chev.lookAt(p2.x - start.x, p2.y - start.y, p2.z - start.z);
          chev.rotateX(Math.PI / 2);
          group.add(chev);
        }
      }

      // Floating path lights for Whisper / energy
      if (typeDef.id === "energy" || typeDef.id === "hidden") {
        for (let i = 2; i < mainPts.length; i += 3) {
          const p = mainPts[i];
          const mote = new THREE.Mesh(
            new THREE.SphereGeometry(typeDef.id === "hidden" ? 0.12 : 0.2, 8, 8),
            mkMat(col, {
              emissive: em,
              emissiveIntensity: typeDef.id === "hidden" ? 0.6 : 1.4,
              opacity: typeDef.id === "hidden" ? 0.45 : 0.85,
            })
          );
          mote.position.set(p.x - start.x, p.y - start.y + 0.5, p.z - start.z);
          group.add(mote);
        }
      }

      group.userData.pathType = typeDef.id;
      group.userData.pathName = typeDef.name;
      group.userData.kind = "path";
    },
  };

  /**
   * TerrainFeatureGenerator — physical landscape of the Boltverse
   * Types: boulder cluster · ridge · crater · cliff · floating chunk
   * Biome styles: Crystal (smooth) · Ember (jagged/harsh) · Whisper (sparse/dramatic)
   */
  const TERRAIN_TYPES = {
    boulders: { id: "boulders", name: "Boulder Cluster" },
    ridge: { id: "ridge", name: "Ridge" },
    crater: { id: "crater", name: "Crater" },
    cliff: { id: "cliff", name: "Cliff Face" },
    floater: { id: "floater", name: "Floating Rock" },
    /** Large co-authored landmark — long ridge wall or canyon pair */
    landmark: { id: "landmark", name: "Landform Landmark" },
    canyon: { id: "canyon", name: "Canyon Corridor" },
  };

  function pickTerrainType(density, biomeId) {
    const r = Math.random();
    if (biomeId === "emberVoid") {
      if (r < 0.35) return TERRAIN_TYPES.boulders;
      if (r < 0.55) return TERRAIN_TYPES.ridge;
      if (r < 0.75) return TERRAIN_TYPES.crater;
      if (r < 0.9) return TERRAIN_TYPES.cliff;
      return TERRAIN_TYPES.floater;
    }
    if (biomeId === "whisperStars") {
      if (r < 0.25) return TERRAIN_TYPES.boulders;
      if (r < 0.4) return TERRAIN_TYPES.ridge;
      if (r < 0.55) return TERRAIN_TYPES.crater;
      if (r < 0.7) return TERRAIN_TYPES.cliff;
      return TERRAIN_TYPES.floater; // more dramatic floaters
    }
    if (biomeId === "frostGlacier") {
      if (r < 0.2) return TERRAIN_TYPES.boulders;
      if (r < 0.45) return TERRAIN_TYPES.ridge;
      if (r < 0.6) return TERRAIN_TYPES.crater;
      if (r < 0.9) return TERRAIN_TYPES.cliff;
      return TERRAIN_TYPES.floater;
    }
    if (biomeId === "solarGold") {
      if (r < 0.35) return TERRAIN_TYPES.boulders;
      if (r < 0.55) return TERRAIN_TYPES.ridge;
      if (r < 0.8) return TERRAIN_TYPES.crater;
      if (r < 0.92) return TERRAIN_TYPES.cliff;
      return TERRAIN_TYPES.floater;
    }
    if (biomeId === "jadeCanopy") {
      if (r < 0.45) return TERRAIN_TYPES.boulders;
      if (r < 0.7) return TERRAIN_TYPES.ridge;
      if (r < 0.82) return TERRAIN_TYPES.crater;
      if (r < 0.93) return TERRAIN_TYPES.cliff;
      return TERRAIN_TYPES.floater;
    }
    if (biomeId === "rosePulse") {
      if (r < 0.4) return TERRAIN_TYPES.boulders;
      if (r < 0.55) return TERRAIN_TYPES.ridge;
      if (r < 0.7) return TERRAIN_TYPES.crater;
      if (r < 0.85) return TERRAIN_TYPES.cliff;
      return TERRAIN_TYPES.floater;
    }
    // Crystal — gentler
    if (r < 0.4) return TERRAIN_TYPES.boulders;
    if (r < 0.6) return TERRAIN_TYPES.ridge;
    if (r < 0.78) return TERRAIN_TYPES.crater;
    if (r < 0.9) return TERRAIN_TYPES.cliff;
    return TERRAIN_TYPES.floater;
  }

  /** High-band pick: prefer landmarks / canyons over small props */
  function pickLandmarkType(density, biomeId, kit) {
    const d = density || 0;
    const canyonP = (kit && kit.canyonChance) || 0.35;
    if (Math.random() < canyonP) return TERRAIN_TYPES.canyon;
    if (biomeId === "emberVoid" || biomeId === "frostGlacier") {
      return Math.random() < 0.55 ? TERRAIN_TYPES.canyon : TERRAIN_TYPES.landmark;
    }
    if (biomeId === "whisperStars") {
      return Math.random() < 0.4 ? TERRAIN_TYPES.landmark : TERRAIN_TYPES.floater;
    }
    if (d > 0.75 && Math.random() < 0.35) return TERRAIN_TYPES.canyon;
    return TERRAIN_TYPES.landmark;
  }

  function createTerrainMesh() {
    const g = new THREE.Group();
    g.userData.kind = "terrain";
    return g;
  }

  const TerrainFeatureGenerator = {
    layout: function (group, opts) {
      while (group.children.length) {
        const c = group.children.pop();
        if (c.geometry) c.geometry.dispose();
        if (c.material) {
          if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose());
          else c.material.dispose();
        }
      }

      const biome = opts.biome;
      const density = opts.density || 0;
      const type = opts.typeDef || TERRAIN_TYPES.boulders;
      const seed = opts.seed || Math.random() * 100;
      const rockCol = biome.rock || 0x4a5568;
      const accent = biome.color || 0x67e8f9;
      const em = biome.emissive || accent;
      const jagged =
        biome.id === "emberVoid"
          ? 1.35
          : biome.id === "frostGlacier"
            ? 1.2
            : biome.id === "whisperStars"
              ? 0.9
              : biome.id === "jadeCanopy" || biome.id === "rosePulse"
                ? 0.7
                : 0.75;
      const scaleMul = 0.9 + density * 0.9;

      function rockMat(extraEm) {
        if (global.BoltGraphics && global.BoltGraphics.makeRockMaterial) {
          const m = global.BoltGraphics.makeRockMaterial(biome.id);
          m.transparent = true;
          m.opacity = 0;
          m.userData.baseOpacity = 1;
          if (extraEm) {
            m.emissive = new THREE.Color(em);
            m.emissiveIntensity = 0.35;
          }
          return m;
        }
        return mkMat(rockCol, {
          roughness: biome.id === "emberVoid" ? 0.98 : 0.88,
          metalness: biome.id === "crystalNebula" ? 0.2 : 0.08,
          flat: true,
          emissive: extraEm ? em : 0x000000,
          emissiveIntensity: extraEm ? 0.25 : 0,
        });
      }

      if (type.id === "boulders") {
        // Cluster of varied boulders (instantiation)
        const count = 3 + Math.floor(density * 5) + (biome.id === "emberVoid" ? 2 : 0);
        const spread = 2.2 + density * 2.5;
        for (let i = 0; i < count; i++) {
          const s = (0.6 + noise2(seed + i, seed) * 1.8) * scaleMul * jagged;
          const geo =
            biome.id === "emberVoid"
              ? new THREE.TetrahedronGeometry(s * 0.7, 0)
              : biome.id === "crystalNebula"
              ? new THREE.DodecahedronGeometry(s * 0.55, 0)
              : new THREE.IcosahedronGeometry(s * 0.5, 0);
          const rock = new THREE.Mesh(geo, rockMat(biome.id === "crystalNebula" && i === 0));
          const ang = (i / count) * Math.PI * 2 + seed;
          const rad = (0.3 + noise2(i * 2, seed) * 0.7) * spread;
          rock.position.set(Math.cos(ang) * rad, s * 0.28, Math.sin(ang) * rad);
          rock.scale.set(1, 0.5 + noise2(seed, i) * 0.9 * jagged, 1);
          rock.rotation.set(noise2(i, 1) * 2, noise2(i, 2) * 6, noise2(i, 3) * 2);
          rock.castShadow = true;
          rock.receiveShadow = true;
          group.add(rock);
          // Crystal embeds in Crystal biome
          if (biome.id === "crystalNebula" && Math.random() < 0.35) {
            const gem = new THREE.Mesh(
              new THREE.OctahedronGeometry(s * 0.18, 0),
              mkMat(accent, { emissive: em, emissiveIntensity: 1.1, metalness: 0.6, roughness: 0.2 })
            );
            gem.position.copy(rock.position);
            gem.position.y += s * 0.35;
            group.add(gem);
          }
        }
      } else if (type.id === "ridge") {
        // Linear ridge of rocks along yaw-ish axis
        const segs = 4 + Math.floor(density * 4);
        for (let i = 0; i < segs; i++) {
          const t = i / Math.max(1, segs - 1);
          const s = (1.0 + Math.sin(t * Math.PI) * 1.4 + density) * scaleMul * jagged;
          const rock = new THREE.Mesh(
            new THREE.BoxGeometry(s * 0.7, s * (0.8 + jagged * 0.5), s * 0.9),
            rockMat(false)
          );
          rock.position.set(
            (t - 0.5) * (6 + density * 4),
            s * 0.35,
            (noise2(seed + i, 0) - 0.5) * 1.2 * jagged
          );
          rock.rotation.y = (noise2(i, seed) - 0.5) * 0.5;
          rock.rotation.z = (noise2(seed, i) - 0.5) * 0.3 * jagged;
          rock.castShadow = true;
          rock.receiveShadow = true;
          group.add(rock);
        }
      } else if (type.id === "crater") {
        // Ring of rocks + depressed center marker
        const ringN = 6 + Math.floor(density * 4);
        const R = 2.2 + density * 2.5;
        for (let i = 0; i < ringN; i++) {
          const a = (i / ringN) * Math.PI * 2;
          const s = (0.5 + noise2(i, seed) * 0.9) * scaleMul;
          const rock = new THREE.Mesh(
            new THREE.DodecahedronGeometry(s * 0.5, 0),
            rockMat(biome.id === "emberVoid")
          );
          rock.position.set(Math.cos(a) * R, s * 0.2, Math.sin(a) * R);
          rock.scale.set(1, 0.45 + jagged * 0.3, 1);
          rock.castShadow = true;
          group.add(rock);
        }
        // Crater bowl (dark disk)
        const bowl = new THREE.Mesh(
          new THREE.CylinderGeometry(R * 0.75, R * 0.9, 0.35, 12),
          mkMat(
            biome.id === "emberVoid" ? 0x1a0805 : 0x0f172a,
            { roughness: 1, metalness: 0.05, emissive: biome.id === "emberVoid" ? 0x3b1208 : 0x000000, emissiveIntensity: 0.2 }
          )
        );
        bowl.position.y = 0.05;
        bowl.receiveShadow = true;
        group.add(bowl);
        if (biome.id === "emberVoid") {
          const lava = new THREE.Mesh(
            new THREE.CircleGeometry(R * 0.35, 12),
            mkMat(0xf97316, { emissive: 0xea580c, emissiveIntensity: 1.2, opacity: 0.9 })
          );
          lava.rotation.x = -Math.PI / 2;
          lava.position.y = 0.22;
          group.add(lava);
        }
      } else if (type.id === "cliff") {
        // Vertical cliff face slabs
        const h = (2.5 + density * 3.5) * scaleMul * jagged;
        const w = 3.5 + density * 2;
        const face = new THREE.Mesh(
          new THREE.BoxGeometry(w, h, 1.2 + jagged),
          rockMat(false)
        );
        face.position.set(0, h * 0.45, 0);
        face.rotation.y = (noise2(seed, 1) - 0.5) * 0.4;
        face.castShadow = true;
        face.receiveShadow = true;
        group.add(face);
        // Debris at base
        for (let i = 0; i < 3 + Math.floor(density * 2); i++) {
          const s = 0.4 + Math.random() * 0.7;
          const d = new THREE.Mesh(
            new THREE.TetrahedronGeometry(s * 0.6, 0),
            rockMat(false)
          );
          d.position.set((Math.random() - 0.5) * w, s * 0.25, 1.2 + Math.random());
          d.rotation.set(Math.random(), Math.random(), Math.random());
          d.castShadow = true;
          group.add(d);
        }
      } else if (type.id === "landmark" || type.id === "canyon") {
        // Large co-authored landform — long ridge wall(s) framing a run corridor
        const lmScale = (opts.landmarkScale != null ? opts.landmarkScale : 1) * scaleMul;
        const segs = 6 + Math.floor(density * 6) + (type.id === "canyon" ? 3 : 0);
        const span = (10 + density * 14) * lmScale; // length along path (local Z)
        const wallOff = type.id === "canyon"
          ? (3.2 + density * 1.8) * lmScale
          : (2.4 + density * 1.2) * lmScale;
        const walls = type.id === "canyon" ? 2 : 1;
        const sideSign0 = opts.sideSign != null ? opts.sideSign : 1;

        for (let w = 0; w < walls; w++) {
          const side = walls === 2 ? (w === 0 ? -1 : 1) : sideSign0;
          for (let i = 0; i < segs; i++) {
            const t = i / Math.max(1, segs - 1);
            const along = (t - 0.5) * span;
            // Taller mid-wall, lower ends — reads as a landform silhouette
            const hMul = 0.55 + Math.sin(t * Math.PI) * 0.75 + density * 0.35;
            const s = (1.1 + noise2(seed + i + w * 7, seed) * 1.4) * lmScale * jagged * hMul;
            const geo =
              biome.id === "emberVoid"
                ? new THREE.TetrahedronGeometry(s * 0.65, 0)
                : biome.id === "frostGlacier"
                  ? new THREE.BoxGeometry(s * 0.55, s * 1.4, s * 0.7)
                  : biome.id === "crystalNebula"
                    ? new THREE.DodecahedronGeometry(s * 0.5, 0)
                    : new THREE.BoxGeometry(s * 0.65, s * (1.0 + jagged * 0.4), s * 0.85);
            const rock = new THREE.Mesh(geo, rockMat(i % 4 === 0 && biome.id === "crystalNebula"));
            const jitter = (noise2(i * 1.3, seed + w) - 0.5) * 1.1 * lmScale;
            rock.position.set(
              side * (wallOff + jitter * 0.4),
              s * 0.32,
              along + jitter * 0.3
            );
            rock.scale.set(1, 0.7 + noise2(seed, i) * 0.6 * jagged, 1);
            rock.rotation.y = (noise2(i, seed) - 0.5) * 0.55;
            rock.rotation.z = side * (noise2(seed, i) - 0.5) * 0.25 * jagged;
            rock.castShadow = true;
            rock.receiveShadow = true;
            group.add(rock);
            // Ember: hot veins · Crystal: gem chips · Frost: ice sheen
            if (i % 3 === 0) {
              if (biome.id === "emberVoid") {
                const vein = new THREE.Mesh(
                  new THREE.BoxGeometry(0.08 * s, s * 0.7, 0.08 * s),
                  mkMat(0xf97316, { emissive: 0xea580c, emissiveIntensity: 1.1, opacity: 0.85 })
                );
                vein.position.copy(rock.position);
                vein.position.y += s * 0.2;
                group.add(vein);
              } else if (biome.id === "crystalNebula" || biome.id === "frostGlacier") {
                const gem = new THREE.Mesh(
                  new THREE.OctahedronGeometry(s * 0.14, 0),
                  mkMat(accent, { emissive: em, emissiveIntensity: 0.9, metalness: 0.5, roughness: 0.2 })
                );
                gem.position.copy(rock.position);
                gem.position.y += s * 0.4;
                group.add(gem);
              }
            }
          }
        }

        // Canyon floor glow strip (run invitation between walls)
        if (type.id === "canyon") {
          const stripLen = span * 0.95;
          const strip = new THREE.Mesh(
            new THREE.BoxGeometry(wallOff * 1.1, 0.06, stripLen),
            mkMat(accent, {
              emissive: em,
              emissiveIntensity: 0.55,
              opacity: 0.28,
              roughness: 0.4,
            })
          );
          strip.position.y = 0.04;
          group.add(strip);
          // End mouth rocks (gate feel)
          for (let e = 0; e < 2; e++) {
            const ez = (e === 0 ? -1 : 1) * span * 0.48;
            for (let s = -1; s <= 1; s += 2) {
              const mouth = new THREE.Mesh(
                new THREE.DodecahedronGeometry(0.7 * lmScale * jagged, 0),
                rockMat(false)
              );
              mouth.position.set(s * wallOff * 0.75, 0.4 * lmScale, ez);
              mouth.castShadow = true;
              group.add(mouth);
            }
          }
        } else {
          // Single landmark wall: boulder scatter on the open side of the corridor
          const nB = 3 + Math.floor(density * 3);
          for (let i = 0; i < nB; i++) {
            const bs = (0.45 + Math.random() * 0.7) * lmScale;
            const b = new THREE.Mesh(
              new THREE.IcosahedronGeometry(bs * 0.55, 0),
              rockMat(false)
            );
            b.position.set(
              -sideSign0 * (1.2 + Math.random() * 2.5) * lmScale,
              bs * 0.25,
              (Math.random() - 0.5) * span * 0.7
            );
            b.castShadow = true;
            group.add(b);
          }
        }
      } else {
        // Floating rock chunk (Whisper dramatic / Ember unstable)
        const s = (1.4 + density * 1.5) * scaleMul;
        const body = new THREE.Mesh(
          new THREE.DodecahedronGeometry(s * 0.65, 0),
          rockMat(biome.id === "whisperStars")
        );
        body.position.y = 1.2 + density * 1.5 + (biome.id === "whisperStars" ? 1.2 : 0.4);
        body.rotation.set(0.3, seed, 0.2);
        body.castShadow = true;
        group.add(body);
        // Underside glow for mystical / energy
        const glow = new THREE.Mesh(
          new THREE.SphereGeometry(s * 0.35, 10, 10),
          mkMat(accent, { emissive: em, emissiveIntensity: 0.9, opacity: 0.45 })
        );
        glow.position.copy(body.position);
        glow.position.y -= s * 0.4;
        group.add(glow);
      }

      group.userData.kind = "terrain";
      group.userData.terrainType = type.id;
      group.userData.landmark = type.id === "landmark" || type.id === "canyon";
      // Walk / wall collision for big landforms (local space; world-transformed at query)
      const walk = [];
      const walls = [];
      const lmScale = (opts.landmarkScale != null ? opts.landmarkScale : 1) * scaleMul;
      if (type.id === "landmark" || type.id === "canyon") {
        const span = (10 + density * 14) * lmScale;
        const wallOff = type.id === "canyon"
          ? (3.2 + density * 1.8) * lmScale
          : (2.4 + density * 1.2) * lmScale;
        const wallH = (2.2 + density * 2.5) * lmScale * jagged;
        if (type.id === "canyon") {
          // Floor strip between walls is walkable
          walk.push({ lx: 0, lz: 0, half: wallOff * 0.95, top: 0.35 });
          walls.push({ lx: -wallOff, lz: 0, half: 1.4 * lmScale, y0: 0, y1: wallH });
          walls.push({ lx: wallOff, lz: 0, half: 1.4 * lmScale, y0: 0, y1: wallH });
        } else {
          walls.push({ lx: wallOff * 0.5, lz: 0, halfX: 2.2 * lmScale, halfZ: span * 0.45, y0: 0, y1: wallH });
          walk.push({ lx: 0, lz: 0, half: wallOff * 0.7, top: 0.3 });
        }
      } else if (type.id === "boulders") {
        const spread = 2.2 + density * 2.5;
        walk.push({ lx: 0, lz: 0, half: spread * 0.55, top: 1.1 * scaleMul * jagged });
        walls.push({ lx: 0, lz: 0, half: spread * 0.5, y0: 0, y1: 2.2 * scaleMul * jagged });
      } else if (type.id === "ridge") {
        const span = 6 + density * 4;
        walls.push({ lx: 0, lz: 0, halfX: span * 0.55, halfZ: 1.4 * jagged, y0: 0, y1: 2.5 * scaleMul * jagged });
        walk.push({ lx: 0, lz: 0, half: span * 0.4, top: 1.4 * scaleMul * jagged });
      } else if (type.id === "cliff") {
        const h = (2.5 + density * 3.5) * scaleMul * jagged;
        const w = 3.5 + density * 2;
        walls.push({ lx: 0, lz: 0, halfX: w * 0.55, halfZ: 1.2, y0: 0, y1: h });
        walk.push({ lx: 0, lz: -0.4, half: w * 0.4, top: h * 0.92 });
      } else if (type.id === "crater") {
        const R = 2.2 + density * 2.5;
        walk.push({ lx: 0, lz: 0, half: R * 0.85, top: 0.4 });
        walls.push({ lx: 0, lz: 0, half: R * 0.95, y0: 0, y1: 1.2 * scaleMul });
      } else {
        // floaters — soft solid body only
        walls.push({ lx: 0, lz: 0, half: 1.2 * scaleMul, y0: 0.5, y1: 3 * scaleMul });
      }
      group.userData.walkColliders = walk;
      group.userData.wallColliders = walls;
    },
  };

  /**
   * VegetationGenerator — organic life of the Boltverse
   * Biomes: Crystal (ethereal glow) · Ember (spiky/fire) · Whisper (sparse/mystical)
   * Density scales with Meaningful Sprint Score; noise makes forests + clearings.
   */
  const VEG_TYPES = {
    stalk: { id: "stalk", name: "Glowing Stalk" },
    flower: { id: "flower", name: "Crystal Flower" },
    bush: { id: "bush", name: "Resilient Bush" },
    vine: { id: "vine", name: "Star Vine" },
    cluster: { id: "cluster", name: "Flora Cluster" },
    floater: { id: "floater", name: "Floating Seed" },
    canopy: { id: "canopy", name: "Alien Canopy" },
    tree: { id: "tree", name: "World Tree" },
    megaTree: { id: "megaTree", name: "Skywood Giant" },
    spire: { id: "spire", name: "Crystal Spire Tree" },
    /** Multi-layer forest system — entire grove in one pooled entity */
    forest: { id: "forest", name: "Living Forest" },
  };

  function pickVegType(density, biomeId, noiseVal, preferSmall) {
    const r = Math.random();
    const n = noiseVal != null ? noiseVal : r;
    // Big solo trees stay occasional — preferSmall forces ground flora
    if (!preferSmall && density > 0.4 && r < 0.06 + density * 0.05) {
      if (r < 0.02 + density * 0.02) return VEG_TYPES.megaTree;
      if (biomeId === "crystalNebula" || biomeId === "jadeCanopy") return VEG_TYPES.spire;
      return VEG_TYPES.tree;
    }
    if (biomeId === "emberVoid") {
      if (!preferSmall && density > 0.55 && r < 0.1) return VEG_TYPES.tree;
      if (r < 0.32) return VEG_TYPES.bush;
      if (r < 0.55) return VEG_TYPES.stalk;
      if (r < 0.75) return VEG_TYPES.cluster;
      if (r < 0.92) return VEG_TYPES.flower;
      return VEG_TYPES.spire;
    }
    if (biomeId === "whisperStars") {
      if (!preferSmall && density > 0.55 && r < 0.08) return VEG_TYPES.tree;
      if (r < 0.28) return VEG_TYPES.vine;
      if (r < 0.48) return VEG_TYPES.floater;
      if (r < 0.7) return VEG_TYPES.stalk;
      if (r < 0.86) return VEG_TYPES.flower;
      if (!preferSmall && r < 0.94) return VEG_TYPES.canopy;
      return VEG_TYPES.cluster;
    }
    if (biomeId === "jadeCanopy") {
      // Rich undergrowth; giants stay rare (forests handle drama)
      if (!preferSmall && r < 0.08) return VEG_TYPES.megaTree;
      if (!preferSmall && r < 0.18) return VEG_TYPES.tree;
      if (!preferSmall && r < 0.28) return VEG_TYPES.canopy;
      if (r < 0.45) return VEG_TYPES.bush;
      if (r < 0.65) return VEG_TYPES.cluster;
      if (r < 0.82) return VEG_TYPES.stalk;
      return VEG_TYPES.flower;
    }
    if (biomeId === "frostGlacier") {
      if (!preferSmall && r < 0.18) return VEG_TYPES.spire;
      if (r < 0.45) return VEG_TYPES.stalk;
      if (r < 0.65) return VEG_TYPES.floater;
      if (r < 0.85) return VEG_TYPES.cluster;
      return VEG_TYPES.flower;
    }
    if (biomeId === "solarGold") {
      if (r < 0.32) return VEG_TYPES.bush;
      if (r < 0.55) return VEG_TYPES.stalk;
      if (r < 0.75) return VEG_TYPES.flower;
      if (r < 0.9) return VEG_TYPES.cluster;
      return preferSmall ? VEG_TYPES.bush : VEG_TYPES.tree;
    }
    if (biomeId === "rosePulse") {
      if (r < 0.3) return VEG_TYPES.flower;
      if (r < 0.52) return VEG_TYPES.bush;
      if (r < 0.7) return VEG_TYPES.vine;
      if (r < 0.88) return VEG_TYPES.stalk;
      return preferSmall ? VEG_TYPES.cluster : VEG_TYPES.canopy;
    }
    // Crystal Nebula — rich small flora; occasional ethereal trees
    if (!preferSmall && density > 0.45 && n > 0.55 && r < 0.12) return VEG_TYPES.canopy;
    if (!preferSmall && r < 0.08) return VEG_TYPES.tree;
    if (!preferSmall && r < 0.14) return VEG_TYPES.spire;
    if (r < 0.32) return VEG_TYPES.stalk;
    if (r < 0.5) return VEG_TYPES.flower;
    if (r < 0.66) return VEG_TYPES.cluster;
    if (r < 0.8) return VEG_TYPES.vine;
    if (r < 0.92) return VEG_TYPES.bush;
    return VEG_TYPES.floater;
  }

  function createVegetationMesh() {
    const g = new THREE.Group();
    g.userData.kind = "vegetation";
    return g;
  }

  const VegetationGenerator = {
    layout: function (group, opts) {
      while (group.children.length) {
        const c = group.children.pop();
        if (c.geometry) c.geometry.dispose();
        if (c.material) {
          const mats = Array.isArray(c.material) ? c.material : [c.material];
          mats.forEach(function (m) {
            // Never dispose shared bark/foliage caches
            if (m && !m.userData.shared) m.dispose();
          });
        }
      }

      const biome = opts.biome;
      const density = opts.density || 0;
      const type = opts.typeDef || VEG_TYPES.stalk;
      const seed = opts.seed || Math.random() * 200;
      const plantCol = biome.plant || 0xa78bfa;
      const plantEm = biome.plantEmissive || 0x7c3aed;
      const accent = biome.color || 0x67e8f9;
      const em = biome.emissive || accent;
      const isEmber = biome.id === "emberVoid";
      const isWhisper = biome.id === "whisperStars";
      const isCrystal = biome.id === "crystalNebula";

      // Density → count & spread (forests at high sprint score)
      const countMul = 0.55 + density * 1.6 + (isCrystal ? 0.25 : 0) - (isWhisper ? 0.2 : 0);
      const swayParts = [];

      const biomeId = biome.id || "crystalNebula";
      // Shared textured mats (tier B) — fallback to flat mkMat
      let barkMatShared = null;
      let foliageMatShared = null;
      let foliageUnderShared = null;
      if (global.BoltGraphics && global.BoltGraphics.makeBarkMaterial) {
        barkMatShared = global.BoltGraphics.makeBarkMaterial(biomeId);
        barkMatShared.userData.shared = true;
        foliageMatShared = global.BoltGraphics.makeFoliageMaterial(biomeId, plantCol, plantEm);
        foliageMatShared.userData.shared = true;
        foliageUnderShared = foliageMatShared.clone();
        foliageUnderShared.userData.shared = true;
        foliageUnderShared.emissiveIntensity = 0.12;
        foliageUnderShared.opacity = 0.88;
        foliageUnderShared.color = foliageUnderShared.color.clone().multiplyScalar(0.55);
      }

      function plantMat(col, eCol, eInt, rough, opac) {
        // Cap emissive so plants sculpt under light (not neon balloons)
        const ei = Math.min(eInt != null ? eInt : 0.35, 0.55);
        return mkMat(col, {
          emissive: eCol,
          emissiveIntensity: ei,
          roughness: rough != null ? rough : 0.55,
          metalness: isCrystal ? 0.25 : 0.08,
          opacity: opac != null ? opac : 0.95,
          flat: isEmber,
        });
      }

      function barkMat() {
        if (barkMatShared) return barkMatShared;
        return plantMat(isEmber ? 0x3b1c0a : isCrystal ? 0x2e1065 : isWhisper ? 0x1e1b4b : 0x2d1b0e, plantEm, 0.12, 0.92);
      }

      function leafMat(under) {
        if (under && foliageUnderShared) return foliageUnderShared;
        if (!under && foliageMatShared) return foliageMatShared;
        return plantMat(plantCol, plantEm, under ? 0.15 : 0.28, 0.65);
      }

      function addSway(mesh, amount) {
        mesh.userData.swayAmt = amount || 0.04;
        mesh.userData.swayPhase = seed + mesh.id * 0.1 + Math.random() * 2;
        swayParts.push(mesh);
      }

      function placePlant(fn, cx, cz, scale) {
        const pg = new THREE.Group();
        fn(pg, scale);
        pg.position.set(cx, 0, cz);
        pg.rotation.y = noise2(cx + seed, cz) * Math.PI * 2;
        // Asymmetric lean (nature isn't radial-perfect)
        pg.rotation.z = (noise2(cz, seed) - 0.5) * 0.32;
        pg.rotation.x = (noise2(seed, cx) - 0.5) * 0.22;
        group.add(pg);
        return pg;
      }

      /** Root flare + 3–6 buried cones into ground */
      function addRoots(pg, s, trunkR) {
        const base = new THREE.Mesh(
          new THREE.CylinderGeometry(trunkR * 1.35, trunkR * 1.85, 0.22 * s, 8),
          barkMat()
        );
        base.position.y = 0.08 * s;
        base.castShadow = true;
        pg.add(base);
        const n = 3 + Math.floor(Math.random() * 4);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + seed * 0.3;
          const root = new THREE.Mesh(
            new THREE.ConeGeometry(0.08 * s + trunkR * 0.35, 0.55 * s + trunkR, 5),
            barkMat()
          );
          root.position.set(Math.cos(a) * trunkR * 1.1, 0.06 * s, Math.sin(a) * trunkR * 1.1);
          root.rotation.z = Math.cos(a) * 1.15;
          root.rotation.x = Math.sin(a) * 1.15;
          root.castShadow = true;
          pg.add(root);
        }
      }

      /** Tapered multi-segment trunk */
      function addTrunk(pg, s, trunkH, rBot, rTop, segs) {
        segs = segs || 3;
        let y = 0;
        for (let i = 0; i < segs; i++) {
          const t0 = i / segs;
          const t1 = (i + 1) / segs;
          const r0 = rBot + (rTop - rBot) * t0;
          const r1 = rBot + (rTop - rBot) * t1;
          const h = trunkH / segs;
          const seg = new THREE.Mesh(
            new THREE.CylinderGeometry(r1, r0, h, isWhisper ? 7 : 8),
            barkMat()
          );
          seg.position.y = y + h * 0.5;
          // Slight crook per segment
          seg.rotation.z = (noise2(seed + i, i) - 0.5) * 0.08;
          seg.rotation.x = (noise2(i, seed) - 0.5) * 0.06;
          seg.castShadow = true;
          pg.add(seg);
          y += h * 0.98;
        }
        return trunkH;
      }

      /** Small foliage lobe cluster */
      function addLeafCluster(pg, x, y, z, s, sway) {
        const n = 3 + Math.floor(Math.random() * 4);
        for (let i = 0; i < n; i++) {
          const r = (0.18 + Math.random() * 0.28) * s;
          const lobe = new THREE.Mesh(
            Math.random() > 0.45
              ? new THREE.IcosahedronGeometry(r, 0)
              : new THREE.SphereGeometry(r, 7, 6),
            leafMat(i === 0)
          );
          lobe.position.set(
            x + (Math.random() - 0.5) * 0.35 * s,
            y + (Math.random() - 0.5) * 0.28 * s,
            z + (Math.random() - 0.5) * 0.35 * s
          );
          lobe.scale.set(1.05 + Math.random() * 0.35, 0.65 + Math.random() * 0.35, 1.05 + Math.random() * 0.35);
          lobe.castShadow = true;
          pg.add(lobe);
          if (sway) addSway(lobe, sway);
        }
      }

      // --- plant builders ---
      function buildStalk(pg, s) {
        const h = (1.2 + density * 1.4) * s * (isWhisper ? 1.3 : 1);
        const stemCol = isEmber ? 0x4a1c0a : isWhisper ? 0x1e1b4b : 0x2e1065;
        const stem = new THREE.Mesh(
          new THREE.CylinderGeometry(0.03 * s, 0.06 * s, h, 6),
          plantMat(stemCol, plantEm, 0.35, 0.85)
        );
        stem.position.y = h * 0.5;
        stem.castShadow = true;
        pg.add(stem);
        addSway(stem, 0.05);
        // Biolum tip / bulb
        const bulb = new THREE.Mesh(
          isEmber
            ? new THREE.ConeGeometry(0.18 * s, 0.4 * s, 5)
            : new THREE.SphereGeometry(0.16 * s * (isCrystal ? 1.2 : 0.9), 10, 10),
          plantMat(plantCol, plantEm, isCrystal ? 1.4 : 1.0, 0.3)
        );
        bulb.position.y = h + 0.05;
        pg.add(bulb);
        // Soft glow shell
        const glow = new THREE.Mesh(
          new THREE.SphereGeometry(0.28 * s, 8, 8),
          plantMat(accent, em, 0.9, 0.2, 0.35)
        );
        glow.position.y = h;
        pg.add(glow);
        if (isCrystal && Math.random() < 0.5) {
          const petal = new THREE.Mesh(
            new THREE.ConeGeometry(0.12 * s, 0.35 * s, 5),
            plantMat(accent, em, 1.1, 0.25, 0.85)
          );
          petal.position.y = h + 0.15;
          petal.rotation.z = 0.6;
          pg.add(petal);
        }
      }

      function buildFlower(pg, s) {
        const stem = new THREE.Mesh(
          new THREE.CylinderGeometry(0.025 * s, 0.04 * s, 0.55 * s, 5),
          plantMat(isEmber ? 0x3f1a0a : 0x312e81, plantEm, 0.3, 0.9)
        );
        stem.position.y = 0.28 * s;
        pg.add(stem);
        const petals = isEmber ? 5 : isWhisper ? 4 : 6;
        for (let i = 0; i < petals; i++) {
          const a = (i / petals) * Math.PI * 2;
          const petal = new THREE.Mesh(
            isCrystal
              ? new THREE.OctahedronGeometry(0.14 * s, 0)
              : new THREE.SphereGeometry(0.12 * s, 6, 6),
            plantMat(plantCol, plantEm, 1.0 + density * 0.4, 0.35)
          );
          petal.position.set(Math.cos(a) * 0.16 * s, 0.55 * s, Math.sin(a) * 0.16 * s);
          petal.scale.set(1, isCrystal ? 1.4 : 0.6, 1);
          pg.add(petal);
        }
        const core = new THREE.Mesh(
          new THREE.SphereGeometry(0.08 * s, 8, 8),
          plantMat(accent, em, 1.5, 0.2)
        );
        core.position.y = 0.55 * s;
        pg.add(core);
        addSway(pg, 0.06);
      }

      function buildBush(pg, s) {
        const blobs = isEmber ? 4 + Math.floor(density * 2) : 3;
        for (let i = 0; i < blobs; i++) {
          const bs = (0.35 + noise2(seed + i, i) * 0.35) * s;
          const geo = isEmber
            ? new THREE.TetrahedronGeometry(bs, 0)
            : new THREE.IcosahedronGeometry(bs, 0);
          const b = new THREE.Mesh(
            geo,
            plantMat(
              isEmber && i === 0 ? 0x9a3412 : plantCol,
              plantEm,
              isEmber ? 0.55 : 0.7,
              isEmber ? 0.95 : 0.6
            )
          );
          b.position.set(
            (noise2(i, seed) - 0.5) * 0.5 * s,
            bs * 0.45,
            (noise2(seed, i + 3) - 0.5) * 0.5 * s
          );
          b.rotation.set(noise2(i, 1), noise2(i, 2), noise2(i, 3));
          b.castShadow = true;
          pg.add(b);
          if (isEmber && Math.random() < 0.5) {
            // Thorns
            const thorn = new THREE.Mesh(
              new THREE.ConeGeometry(0.04 * s, 0.25 * s, 4),
              plantMat(0x7c2d12, 0xea580c, 0.8, 0.5)
            );
            thorn.position.copy(b.position);
            thorn.position.y += bs * 0.4;
            thorn.rotation.z = (Math.random() - 0.5) * 1.2;
            pg.add(thorn);
          }
        }
      }

      function buildVine(pg, s) {
        const segs = 4 + Math.floor(density * 3);
        let y = 0;
        for (let i = 0; i < segs; i++) {
          const len = 0.35 * s;
          const v = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.035 * s, len, 4, 6),
            plantMat(plantCol, plantEm, isWhisper ? 1.1 : 0.75, 0.4, 0.9)
          );
          v.position.set(
            Math.sin(i * 0.7 + seed) * 0.15 * s,
            y + len * 0.5,
            Math.cos(i * 0.5) * 0.1 * s
          );
          v.rotation.z = Math.sin(i + seed) * 0.4;
          pg.add(v);
          // Leaf / star mote
          if (i % 2 === 0) {
            const leaf = new THREE.Mesh(
              new THREE.SphereGeometry(0.07 * s, 6, 6),
              plantMat(accent, em, 1.2, 0.25, 0.8)
            );
            leaf.position.copy(v.position);
            leaf.position.x += 0.1 * s;
            pg.add(leaf);
          }
          y += len * 0.85;
        }
        addSway(pg, 0.08);
      }

      function buildFloater(pg, s) {
        const n = 2 + Math.floor(density * 3);
        for (let i = 0; i < n; i++) {
          const seedOrb = new THREE.Mesh(
            new THREE.SphereGeometry(0.1 * s * (0.7 + Math.random() * 0.5), 10, 10),
            plantMat(plantCol, plantEm, 1.3, 0.2, 0.85)
          );
          seedOrb.position.set(
            (noise2(i, seed) - 0.5) * 1.2 * s,
            0.8 * s + i * 0.35 * s + noise2(seed, i) * 0.4,
            (noise2(seed + i, 2) - 0.5) * 1.2 * s
          );
          pg.add(seedOrb);
          const ring = new THREE.Mesh(
            new THREE.TorusGeometry(0.16 * s, 0.015 * s, 6, 14),
            plantMat(accent, em, 0.9, 0.3, 0.6)
          );
          ring.position.copy(seedOrb.position);
          ring.rotation.x = Math.PI / 2 + (Math.random() - 0.5);
          pg.add(ring);
          addSway(seedOrb, 0.1);
        }
      }

      /** Alien canopy — umbrella silhouette, multi-cluster top */
      function buildCanopy(pg, s) {
        const trunkH = (1.8 + density * 0.9) * s * (isWhisper ? 1.25 : 1);
        const rBot = 0.16 * s;
        addRoots(pg, s, rBot);
        addTrunk(pg, s, trunkH, rBot, 0.07 * s, 3);
        // Horizontal arms then cloudlets
        const arms = 5 + Math.floor(density * 2);
        for (let i = 0; i < arms; i++) {
          const a = (i / arms) * Math.PI * 2 + seed;
          const armLen = (0.7 + Math.random() * 0.45) * s;
          const arm = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.04 * s, armLen, 3, 5),
            barkMat()
          );
          arm.position.set(Math.cos(a) * 0.12 * s, trunkH * 0.92, Math.sin(a) * 0.12 * s);
          arm.rotation.z = Math.cos(a) * 1.25;
          arm.rotation.x = Math.sin(a) * 1.25;
          pg.add(arm);
          const tipX = Math.cos(a) * armLen * 0.85;
          const tipZ = Math.sin(a) * armLen * 0.85;
          addLeafCluster(pg, tipX, trunkH * 0.95 + Math.random() * 0.25 * s, tipZ, s * 0.85, 0.035);
        }
        // Central dome of small clusters (not one mega balloon)
        for (let i = 0; i < 8 + Math.floor(density * 4); i++) {
          const a = Math.random() * Math.PI * 2;
          const rr = Math.random() * 0.7 * s;
          addLeafCluster(
            pg,
            Math.cos(a) * rr,
            trunkH + 0.15 * s + Math.random() * 0.4 * s,
            Math.sin(a) * rr,
            s * (0.55 + Math.random() * 0.35),
            0.03
          );
        }
        // Soft under-glow only (low opacity)
        const under = new THREE.Mesh(
          new THREE.SphereGeometry(0.95 * s, 10, 8),
          plantMat(accent, em, 0.35, 0.25, 0.14)
        );
        under.position.y = trunkH * 0.95;
        under.scale.set(1.15, 0.45, 1.15);
        pg.add(under);
      }

      /**
       * Mid-size world tree — roots, segmented trunk, branches, multi-cluster canopy.
       * Biome silhouettes: Whisper tall thin · Ember scorched sparse · Crystal crystal fans · default umbrella.
       */
      function buildTree(pg, s) {
        const tall = isWhisper ? 1.35 : isEmber ? 0.9 : 1;
        const trunkH = (3.0 + density * 1.5) * s * tall;
        const rBot = (isWhisper ? 0.1 : 0.16) * s;
        const rTop = (isWhisper ? 0.05 : 0.08) * s;
        addRoots(pg, s, rBot);
        addTrunk(pg, s, trunkH, rBot, rTop, isWhisper ? 4 : 3);

        // Branch tier
        const nBranch = isEmber ? 3 + Math.floor(density) : isWhisper ? 5 + Math.floor(density * 2) : 5 + Math.floor(density * 3);
        for (let i = 0; i < nBranch; i++) {
          const a = (i / nBranch) * Math.PI * 2 + seed * 0.7 + (Math.random() - 0.5) * 0.4;
          const elev = trunkH * (0.45 + (i / nBranch) * 0.45);
          const armLen = (isEmber ? 0.55 : 0.85 + Math.random() * 0.5) * s;
          const arm = new THREE.Mesh(
            new THREE.CapsuleGeometry((isWhisper ? 0.035 : 0.05) * s, armLen, 3, 5),
            barkMat()
          );
          const lean = isEmber ? 0.55 : 0.95;
          arm.position.set(Math.cos(a) * rBot * 0.6, elev, Math.sin(a) * rBot * 0.6);
          arm.rotation.z = Math.cos(a) * lean;
          arm.rotation.x = Math.sin(a) * lean;
          arm.rotation.y = (Math.random() - 0.5) * 0.4;
          arm.castShadow = true;
          pg.add(arm);
          // Secondary twig
          if (!isEmber && Math.random() < 0.65) {
            const tw = new THREE.Mesh(
              new THREE.CapsuleGeometry(0.025 * s, armLen * 0.45, 3, 4),
              barkMat()
            );
            tw.position.set(
              Math.cos(a) * armLen * 0.55,
              elev + 0.15 * s,
              Math.sin(a) * armLen * 0.55
            );
            tw.rotation.z = Math.cos(a + 0.5) * 1.1;
            tw.rotation.x = Math.sin(a + 0.5) * 1.1;
            pg.add(tw);
          }
          const tipX = Math.cos(a) * armLen * 0.9;
          const tipZ = Math.sin(a) * armLen * 0.9;
          const tipY = elev + Math.sin(lean) * armLen * 0.35;
          if (isCrystal && Math.random() < 0.45) {
            // Crystal fan instead of soft leaf
            for (let k = 0; k < 3; k++) {
              const cryst = new THREE.Mesh(
                new THREE.ConeGeometry(0.1 * s, 0.45 * s, 5),
                plantMat(accent, em, 0.55, 0.22, 0.9)
              );
              cryst.position.set(tipX + (k - 1) * 0.12 * s, tipY + k * 0.1 * s, tipZ);
              cryst.rotation.z = (k - 1) * 0.35;
              cryst.castShadow = true;
              pg.add(cryst);
            }
          } else if (isEmber) {
            // Sparse scorched wisps
            addLeafCluster(pg, tipX, tipY, tipZ, s * 0.55, 0.02);
          } else {
            addLeafCluster(pg, tipX, tipY, tipZ, s * (0.75 + Math.random() * 0.35), 0.028);
            if (Math.random() < 0.5) {
              addLeafCluster(pg, tipX * 0.7, tipY + 0.2 * s, tipZ * 0.7, s * 0.5, 0.03);
            }
          }
        }

        // Apex fill clusters (cloudlets, not one sphere)
        const apexN = isEmber ? 4 : isWhisper ? 10 : 8 + Math.floor(density * 4);
        for (let i = 0; i < apexN; i++) {
          const a = Math.random() * Math.PI * 2;
          const rr = Math.random() * (isWhisper ? 0.55 : 0.85) * s;
          addLeafCluster(
            pg,
            Math.cos(a) * rr,
            trunkH * (0.9 + Math.random() * 0.2) + Math.random() * 0.35 * s,
            Math.sin(a) * rr,
            s * (0.45 + Math.random() * 0.4),
            0.025
          );
        }

        // Optional fruit / crystal tip glow (not full canopy emissive)
        if (density > 0.4 && Math.random() < 0.5) {
          for (let i = 0; i < 2 + Math.floor(density * 2); i++) {
            const fruit = new THREE.Mesh(
              new THREE.OctahedronGeometry(0.1 * s, 0),
              plantMat(isEmber ? 0xf97316 : 0xfbbf24, isEmber ? 0xea580c : 0xf59e0b, 0.7, 0.2)
            );
            fruit.position.set(
              (Math.random() - 0.5) * 1.2 * s,
              trunkH * 0.75 + Math.random() * 0.6 * s,
              (Math.random() - 0.5) * 1.2 * s
            );
            pg.add(fruit);
          }
        }
      }

      /** Landmark mega tree — full branch architecture + fruit + soft halo */
      function buildMegaTree(pg, s) {
        const trunkH = (5.8 + density * 2.8) * s * (isWhisper ? 1.2 : 1);
        const rBot = 0.42 * s;
        addRoots(pg, s * 1.15, rBot);
        addTrunk(pg, s, trunkH, rBot, 0.16 * s, 5);

        const nBranch = 7 + Math.floor(density * 3);
        for (let i = 0; i < nBranch; i++) {
          const a = (i / nBranch) * Math.PI * 2 + seed;
          const elev = trunkH * (0.4 + (i / nBranch) * 0.5);
          const armLen = (1.3 + Math.random() * 0.9) * s;
          const arm = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.07 * s, armLen, 4, 6),
            barkMat()
          );
          arm.position.set(Math.cos(a) * rBot * 0.5, elev, Math.sin(a) * rBot * 0.5);
          arm.rotation.z = Math.cos(a) * 1.05;
          arm.rotation.x = Math.sin(a) * 1.05;
          arm.castShadow = true;
          pg.add(arm);
          // Fork
          const fork = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.04 * s, armLen * 0.55, 3, 5),
            barkMat()
          );
          fork.position.set(
            Math.cos(a + 0.3) * armLen * 0.55,
            elev + 0.25 * s,
            Math.sin(a + 0.3) * armLen * 0.55
          );
          fork.rotation.z = Math.cos(a + 0.8) * 1.2;
          fork.rotation.x = Math.sin(a + 0.8) * 1.2;
          pg.add(fork);
          addLeafCluster(pg, Math.cos(a) * armLen * 0.95, elev + 0.3 * s, Math.sin(a) * armLen * 0.95, s * 1.1, 0.02);
          addLeafCluster(pg, Math.cos(a + 0.3) * armLen * 0.75, elev + 0.55 * s, Math.sin(a + 0.3) * armLen * 0.75, s * 0.85, 0.022);
        }

        // Crown cloudlets
        for (let i = 0; i < 16 + Math.floor(density * 6); i++) {
          const a = Math.random() * Math.PI * 2;
          const rr = Math.random() * 1.8 * s;
          addLeafCluster(
            pg,
            Math.cos(a) * rr,
            trunkH + Math.random() * 1.2 * s,
            Math.sin(a) * rr,
            s * (0.7 + Math.random() * 0.55),
            0.018
          );
        }

        // Resonance fruit
        for (let i = 0; i < 5; i++) {
          const fruit = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.16 * s, 0),
            plantMat(0xfbbf24, 0xf59e0b, 0.75, 0.2)
          );
          fruit.position.set(
            (Math.random() - 0.5) * 2.2 * s,
            trunkH * 0.65 + Math.random() * 1.2 * s,
            (Math.random() - 0.5) * 2.2 * s
          );
          pg.add(fruit);
        }
        // Thin halo (mega only)
        const halo = new THREE.Mesh(
          new THREE.SphereGeometry(2.6 * s, 12, 10),
          plantMat(accent, em, 0.28, 0.2, 0.1)
        );
        halo.position.y = trunkH + 0.5 * s;
        halo.scale.set(1.3, 0.55, 1.3);
        pg.add(halo);
      }

      /** Crystal / ice / ember spire — fan of shards on a thin trunk */
      function buildSpire(pg, s) {
        const h = (3.4 + density * 2.2) * s;
        addRoots(pg, s * 0.7, 0.12 * s);
        addTrunk(pg, s, h * 0.5, 0.14 * s, 0.05 * s, 2);
        const shards = 6 + Math.floor(density * 3);
        for (let i = 0; i < shards; i++) {
          const cryst = new THREE.Mesh(
            new THREE.ConeGeometry((0.28 - i * 0.02) * s, (0.9 + Math.random() * 0.5) * s, 5),
            plantMat(accent, em, 0.5 + i * 0.04, 0.18, 0.92)
          );
          const a = (i / shards) * Math.PI * 2 + seed;
          cryst.position.set(
            Math.cos(a) * 0.15 * s,
            h * 0.4 + i * 0.12 * s + Math.random() * 0.15 * s,
            Math.sin(a) * 0.15 * s
          );
          cryst.rotation.z = Math.cos(a) * 0.45;
          cryst.rotation.x = Math.sin(a) * 0.45;
          cryst.castShadow = true;
          pg.add(cryst);
        }
        const tip = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.26 * s, 0),
          plantMat(0xe0f2fe, em, 0.7, 0.15)
        );
        tip.position.y = h * 0.95;
        pg.add(tip);
        addSway(pg, 0.015);
      }

      function buildCluster(pg, s) {
        // Mini forest patch inside one entity
        const n = 3 + Math.floor(density * 5 * countMul);
        for (let i = 0; i < n; i++) {
          const sub = new THREE.Group();
          const st = noise2(seed + i * 1.7, i);
          const sc = (0.45 + st * 0.7) * s;
          if (st < 0.25) buildTree(sub, sc * 0.85);
          else if (st < 0.45) buildStalk(sub, sc);
          else if (st < 0.7) buildFlower(sub, sc);
          else buildBush(sub, sc * 0.9);
          sub.position.set(
            (noise2(i * 2, seed) - 0.5) * 3.2 * s,
            0,
            (noise2(seed, i * 3) - 0.5) * 3.2 * s
          );
          sub.rotation.y = st * 6;
          pg.add(sub);
        }
      }

      /**
       * Full multi-layer forest — domain-warped density (thickets / clearings),
       * local corridor stays clear (sprint path through the grove).
       */
      function buildForestSystem() {
        const kit = opts.sceneKit || sceneKit(density, biomeId);
        const R = kit.forestRadius || 14 + density * 12;
        const corridor = kit.corridor != null ? kit.corridor : 3.2;
        const worldX = opts.worldX != null ? opts.worldX : 0;
        const worldZ = opts.worldZ != null ? opts.worldZ : 0;
        const yaw = opts.yaw != null ? opts.yaw : 0;
        const cy = Math.cos(yaw);
        const sy = Math.sin(yaw);
        // Local corridor along +Z (spawner sets mesh.rotation.y = run yaw)
        const pathAng = (noise2(seed, seed * 0.3) - 0.5) * 0.18;
        const cPath = Math.cos(pathAng);
        const sPath = Math.sin(pathAng);

        function inCorridor(lx, lz) {
          const side = -sPath * lx + cPath * lz;
          return Math.abs(side) < corridor * (0.85 + noise2(lx, lz) * 0.25);
        }

        // Mesh local → world XZ (matches Three.js rotation.y = yaw)
        function localToWorld(lx, lz) {
          return {
            x: worldX + cy * lx + sy * lz,
            z: worldZ - sy * lx + cy * lz,
          };
        }

        function ringPos(i, salt, radMul) {
          const nA = noise2(seed + i * 0.41 + salt, seed * 0.17);
          const nR = noise2(i * 0.63 + salt, seed + 4);
          const ang = nA * Math.PI * 2;
          const rad = Math.sqrt(0.08 + nR * 0.92) * R * (radMul != null ? radMul : 1);
          return {
            x: Math.cos(ang) * rad,
            z: Math.sin(ang) * rad,
            nA: nA,
            nR: nR,
          };
        }

        /**
         * Sample candidate spots; keep only high domain-warped density + off path.
         * minDens: ground < mid < canopy < mega
         */
        function pickForestSpot(i, salt, radMul, minDens, allowCorridor) {
          for (let attempt = 0; attempt < 10; attempt++) {
            const p = ringPos(i * 13 + attempt * 3, salt + attempt * 0.37, radMul);
            if (!allowCorridor && inCorridor(p.x, p.z)) continue;
            if (allowCorridor && inCorridor(p.x, p.z) && p.nR < 0.8) continue;
            const w = localToWorld(p.x, p.z);
            const dens = forestDensity(w.x, w.z, biomeId, density);
            // Soft edge of grove footprint still respects density field
            const need = minDens + p.nR * 0.12;
            if (dens < need) continue;
            return {
              x: p.x,
              z: p.z,
              nA: p.nA,
              nR: p.nR,
              dens: dens,
            };
          }
          return null;
        }

        // --- Ground cover (low density threshold — fills thickets + soft edges) ---
        const nGround = kit.groundCount || 8;
        for (let i = 0; i < nGround; i++) {
          const p = pickForestSpot(i, 1.1, 1.05, 0.26, true);
          if (!p) continue;
          let sc = 0.4 + p.nA * 0.5 + density * 0.18 + p.dens * 0.35;
          let builder = buildFlower;
          if (isEmber) {
            builder = p.nA < 0.4 ? buildBush : p.nA < 0.7 ? buildStalk : buildFlower;
            sc *= 0.9;
          } else if (isWhisper) {
            builder = p.nA < 0.35 ? buildFloater : p.nA < 0.65 ? buildStalk : buildFlower;
            sc *= 0.85;
          } else if (biomeId === "frostGlacier") {
            builder = p.nA < 0.5 ? buildStalk : buildFlower;
            sc *= 0.75;
          } else if (biomeId === "rosePulse") {
            builder = p.nA < 0.55 ? buildFlower : buildBush;
          } else if (biomeId === "jadeCanopy") {
            builder = p.nA < 0.4 ? buildBush : p.nA < 0.75 ? buildFlower : buildStalk;
          } else if (biomeId === "solarGold") {
            builder = p.nA < 0.45 ? buildBush : buildFlower;
          } else {
            builder = p.nA < 0.35 ? buildFlower : p.nA < 0.7 ? buildStalk : buildBush;
          }
          placePlant(builder, p.x, p.z, sc);
        }

        // --- Mid layer — needs denser pockets ---
        const nMid = kit.midCount || 6;
        for (let i = 0; i < nMid; i++) {
          const p = pickForestSpot(i, 2.7, 0.95, 0.36, false);
          if (!p) continue;
          let sc = 0.5 + p.nR * 0.45 + density * 0.22 + p.dens * 0.3;
          let builder = buildBush;
          if (isEmber) {
            builder = p.nA < 0.55 ? buildBush : buildVine;
          } else if (isWhisper) {
            builder = p.nA < 0.4 ? buildVine : p.nA < 0.75 ? buildFloater : buildBush;
            sc *= 1.05;
          } else if (biomeId === "jadeCanopy") {
            builder = p.nA < 0.5 ? buildBush : buildVine;
            sc *= 1.1;
          } else if (biomeId === "rosePulse") {
            builder = p.nA < 0.45 ? buildVine : buildBush;
          } else if (biomeId === "frostGlacier") {
            builder = buildStalk;
            sc *= 0.8;
          } else if (isCrystal) {
            builder = p.nA < 0.35 ? buildVine : p.nA < 0.7 ? buildBush : buildCluster;
          } else {
            builder = p.nA < 0.5 ? buildBush : buildCluster;
          }
          placePlant(builder, p.x, p.z, sc);
        }

        // --- Canopy — only in high-density thickets ---
        const nCanopy = kit.canopyCount || 5;
        for (let i = 0; i < nCanopy; i++) {
          const p = pickForestSpot(i, 5.3, 0.88, 0.44, false);
          if (!p) continue;
          let sc = 0.7 + p.nR * 0.5 + density * 0.3 + p.dens * 0.4;
          let builder = buildTree;
          if (isEmber) {
            builder = p.nA < 0.55 ? buildTree : buildSpire;
            sc *= 0.92;
          } else if (isWhisper) {
            builder = p.nA < 0.4 ? buildCanopy : p.nA < 0.75 ? buildTree : buildFloater;
            sc *= 1.15;
          } else if (biomeId === "jadeCanopy") {
            builder = p.nA < 0.35 ? buildMegaTree : p.nA < 0.7 ? buildTree : buildCanopy;
            sc *= 1.2;
          } else if (biomeId === "frostGlacier") {
            builder = buildSpire;
            sc *= 1.05;
          } else if (biomeId === "solarGold") {
            builder = p.nA < 0.6 ? buildTree : buildCanopy;
          } else if (biomeId === "rosePulse") {
            builder = p.nA < 0.45 ? buildCanopy : buildTree;
          } else if (isCrystal) {
            builder = p.nA < 0.3 ? buildSpire : p.nA < 0.65 ? buildTree : buildCanopy;
            sc *= 1.08;
          }
          placePlant(builder, p.x, p.z, sc);
        }

        // --- Mega only in densest core ---
        if (Math.random() < (kit.megaChance || 0)) {
          const p = pickForestSpot(99, 9.1, 0.55, 0.55, false);
          if (p) {
            const megaBuilder =
              biomeId === "frostGlacier"
                ? buildSpire
                : biomeId === "whisperStars"
                  ? buildCanopy
                  : buildMegaTree;
            placePlant(megaBuilder, p.x * 0.85, p.z * 0.85, 1.1 + density * 0.3 + p.dens * 0.25);
          }
        }

        // --- Air layer: floaters in medium+ density volumes ---
        const airN = Math.floor((isWhisper ? 6 : isCrystal ? 5 : 3) + density * 4);
        for (let i = 0; i < airN; i++) {
          const p = pickForestSpot(i, 11.0, 0.7, 0.3, false);
          if (!p) continue;
          placePlant(buildFloater, p.x, p.z, 0.45 + p.dens * 0.35 + Math.random() * 0.2);
        }

        // Soft ground-glow discs along corridor (path invitation — always clear)
        if (density > 0.45) {
          const glows = 3 + Math.floor(density * 3);
          for (let i = 0; i < glows; i++) {
            const t = (i / glows - 0.5) * R * 1.4;
            const gx = sPath * t;
            const gz = cPath * t;
            const disc = new THREE.Mesh(
              new THREE.CircleGeometry(0.55 + density * 0.35, 10),
              plantMat(accent, em, 0.55, 0.2, 0.22)
            );
            disc.rotation.x = -Math.PI / 2;
            disc.position.set(gx, 0.04, gz);
            group.add(disc);
          }
        }

        // Resonance jewel only if center is actually a dense thicket
        if ((opts.resonance || 0) > 0.35 && density > 0.5) {
          const coreDens = forestDensity(worldX, worldZ, biomeId, density);
          if (coreDens > 0.4) {
            const jewel = new THREE.Mesh(
              new THREE.OctahedronGeometry(0.35 + density * 0.15, 0),
              plantMat(0xfbbf24, 0xf59e0b, 1.4, 0.15)
            );
            jewel.position.set(0, 0.6 + density * 0.4, 0);
            group.add(jewel);
          }
        }
      }

      // ----- Forest system path (high / very-high scene kits) -----
      if (type.id === "forest") {
        buildForestSystem();
        group.userData.kind = "vegetation";
        group.userData.vegType = "forest";
        group.userData.forest = true;
        group.userData.swayParts = swayParts;
        group.userData.swayT = 0;
        group.userData.sceneBand = (opts.sceneKit && opts.sceneKit.band) || densityBand(density).id;
        return;
      }

      // How many "instances" in this vegetation entity
      let instances = 1;
      const isBigTree =
        type.id === "tree" || type.id === "megaTree" || type.id === "spire" || type.id === "canopy";
      if (type.id === "cluster") instances = 1;
      else if (type.id === "megaTree") instances = 1;
      else if (type.id === "tree" || type.id === "spire") instances = 1 + (density > 0.7 ? 1 : 0);
      else if (type.id === "canopy") instances = 1 + (density > 0.6 ? 1 : 0);
      else instances = 2 + Math.floor(density * 6 * countMul) + (isWhisper ? 0 : 1);
      instances = Math.min(instances, isWhisper ? 7 : isBigTree ? 2 : 14);

      const spread =
        (type.id === "cluster"
          ? 0.3
          : type.id === "megaTree"
          ? 0.5
          : type.id === "tree" || type.id === "spire"
          ? 1.0 + density
          : 1.4 + density * 2.2) * (isWhisper ? 1.4 : 1);

      for (let i = 0; i < instances; i++) {
        // Noise-based ring placement → clusters + gaps
        const nA = noise2(seed + i * 0.37, seed * 0.1);
        const nR = noise2(i * 0.51, seed + 2);
        // Skip some spots for natural clearings
        if (nR < 0.18 && instances > 3 && type.id !== "cluster" && !isBigTree) continue;

        const ang = nA * Math.PI * 2;
        const rad = Math.sqrt(nR) * spread;
        const cx = Math.cos(ang) * rad;
        const cz = Math.sin(ang) * rad;
        let sc = 0.65 + noise2(i + seed, nA) * 0.7 + density * 0.35;
        if (type.id === "megaTree") sc *= 1.35 + density * 0.4;
        else if (type.id === "tree") sc *= 1.15 + density * 0.25;
        else if (type.id === "spire") sc *= 1.1 + density * 0.2;

        const builder =
          type.id === "stalk" ? buildStalk :
          type.id === "flower" ? buildFlower :
          type.id === "bush" ? buildBush :
          type.id === "vine" ? buildVine :
          type.id === "floater" ? buildFloater :
          type.id === "canopy" ? buildCanopy :
          type.id === "tree" ? buildTree :
          type.id === "megaTree" ? buildMegaTree :
          type.id === "spire" ? buildSpire :
          buildCluster;

        placePlant(builder, cx, cz, sc);
      }

      // High density rare “arch” of stalks (frames paths visually)
      if (density > 0.55 && isCrystal && Math.random() < 0.35) {
        for (let i = 0; i < 3; i++) {
          const arch = new THREE.Group();
          buildStalk(arch, 1.1 + i * 0.15);
          arch.position.set((i - 1) * 0.9, 0, 1.6);
          arch.rotation.z = (i - 1) * 0.35;
          group.add(arch);
        }
      }

      // Resonance-bright rare variant
      if (opts.resonance > 0.5 && Math.random() < 0.4) {
        const rare = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.22, 0),
          plantMat(0xfbbf24, 0xf59e0b, 1.6, 0.2)
        );
        rare.position.set(0, 0.5 + density, 0);
        group.add(rare);
      }

      group.userData.kind = "vegetation";
      group.userData.vegType = type.id;
      group.userData.swayParts = swayParts;
      group.userData.swayT = 0;
    },
  };

  /**
   * RuinGenerator — history & mystery of the Boltverse
   * Modular assembly: platforms, pillars, arches, walls, runes, Star Core fragments.
   * Biomes: Crystal (elegant) · Ember (war-torn) · Whisper (monolith / floating)
   * Complexity scales with Meaningful Sprint Score + Resonance.
   */
  const RUIN_TYPES = {
    monolith: { id: "monolith", name: "Monolith" },
    outpost: { id: "outpost", name: "Derelict Outpost" },
    tower: { id: "tower", name: "Broken Tower" },
    arch: { id: "arch", name: "Ancient Arch" },
    platform: { id: "platform", name: "Floating Platform" },
    temple: { id: "temple", name: "Temple Complex" },
    wreck: { id: "wreck", name: "Battle Wreck" },
  };

  function pickRuinType(density, biomeId, resonance) {
    const r = Math.random();
    const res = resonance || 0;
    // High score / resonance → larger story pieces
    if (density > 0.65 && res > 0.35 && r < 0.28) return RUIN_TYPES.temple;
    if (biomeId === "emberVoid") {
      if (r < 0.35) return RUIN_TYPES.wreck;
      if (r < 0.55) return RUIN_TYPES.tower;
      if (r < 0.75) return RUIN_TYPES.outpost;
      if (r < 0.9) return RUIN_TYPES.arch;
      return RUIN_TYPES.monolith;
    }
    if (biomeId === "whisperStars") {
      if (r < 0.3) return RUIN_TYPES.monolith;
      if (r < 0.55) return RUIN_TYPES.platform;
      if (r < 0.75) return RUIN_TYPES.arch;
      if (r < 0.9) return RUIN_TYPES.outpost;
      return RUIN_TYPES.tower;
    }
    // Crystal Nebula + other surface biomes
    if (r < 0.22) return RUIN_TYPES.arch;
    if (r < 0.42) return RUIN_TYPES.outpost;
    if (r < 0.58) return RUIN_TYPES.monolith;
    if (r < 0.72) return RUIN_TYPES.tower;
    if (r < 0.85) return RUIN_TYPES.platform;
    if (density > 0.5) return RUIN_TYPES.temple;
    return RUIN_TYPES.outpost;
  }

  /**
   * Ruins nested in a forest footprint — biome-flavored "grove complex" pieces.
   * High templeChance → Crystal Forest Ruin temples at the canopy edge.
   */
  function pickGroveRuinType(density, biomeId, resonance, kit) {
    const r = Math.random();
    const res = resonance || 0;
    const templeP =
      (kit && kit.groveTempleChance != null ? kit.groveTempleChance : 0.4) +
      res * 0.15 +
      Math.max(0, density - 0.5) * 0.2;

    if (r < templeP) return RUIN_TYPES.temple;

    if (biomeId === "crystalNebula") {
      if (r < 0.55) return RUIN_TYPES.arch;
      if (r < 0.75) return RUIN_TYPES.monolith;
      return RUIN_TYPES.tower;
    }
    if (biomeId === "emberVoid") {
      if (r < 0.5) return RUIN_TYPES.wreck;
      if (r < 0.75) return RUIN_TYPES.tower;
      return RUIN_TYPES.outpost;
    }
    if (biomeId === "whisperStars") {
      if (r < 0.5) return RUIN_TYPES.monolith;
      if (r < 0.75) return RUIN_TYPES.platform;
      return RUIN_TYPES.arch;
    }
    if (biomeId === "jadeCanopy") {
      if (r < 0.55) return RUIN_TYPES.outpost;
      if (r < 0.8) return RUIN_TYPES.arch;
      return RUIN_TYPES.temple;
    }
    if (biomeId === "frostGlacier") {
      if (r < 0.5) return RUIN_TYPES.monolith;
      if (r < 0.75) return RUIN_TYPES.tower;
      return RUIN_TYPES.arch;
    }
    if (biomeId === "solarGold") {
      if (r < 0.5) return RUIN_TYPES.outpost;
      if (r < 0.75) return RUIN_TYPES.arch;
      return RUIN_TYPES.temple;
    }
    if (biomeId === "rosePulse") {
      if (r < 0.5) return RUIN_TYPES.arch;
      if (r < 0.75) return RUIN_TYPES.outpost;
      return RUIN_TYPES.temple;
    }
    return pickRuinType(density, biomeId, resonance);
  }

  function createRuinMesh() {
    const g = new THREE.Group();
    g.userData.kind = "ruin";
    return g;
  }

  const RuinGenerator = {
    layout: function (group, opts) {
      while (group.children.length) {
        const c = group.children.pop();
        if (c.geometry) c.geometry.dispose();
        if (c.material) {
          const mats = Array.isArray(c.material) ? c.material : [c.material];
          mats.forEach(function (m) {
            if (m && !m.userData.shared) m.dispose();
          });
        }
      }

      const biome = opts.biome;
      const density = opts.density || 0;
      const resonance = opts.resonance || 0;
      const type = opts.typeDef || RUIN_TYPES.outpost;
      const seed = opts.seed || Math.random() * 200;
      const ruinCol = biome.ruin || 0x94a3b8;
      const accent = biome.color || 0x67e8f9;
      const em = biome.emissive || accent;
      const isEmber = biome.id === "emberVoid";
      const isWhisper = biome.id === "whisperStars";
      const isCrystal = biome.id === "crystalNebula";

      // Complexity: low = few pieces, high = multi-room presence
      const complexity = THREE.MathUtils.clamp(
        0.35 + density * 0.75 + resonance * 0.45,
        0.3,
        1.6
      );
      // MEGA footprint — ruins dwarf Bolt (dog ~2 units; ruins 8–25+)
      const S = 2.6 + density * 0.9 + (type.id === "temple" ? 1.1 : type.id === "monolith" ? 0.6 : 0);
      const pulseParts = [];
      let hasLoot = false;
      const biomeIdR = biome.id || "crystalNebula";

      // Tier C stone material (textured) + rune strips only
      let stoneShared = null;
      if (global.BoltGraphics && global.BoltGraphics.makeRuinStoneMaterial) {
        stoneShared = global.BoltGraphics.makeRuinStoneMaterial(biomeIdR);
        stoneShared.userData.shared = true;
      }

      function stoneMat(extraEm) {
        if (stoneShared && !extraEm) return stoneShared;
        if (stoneShared && extraEm) {
          const m = stoneShared.clone();
          m.emissive = new THREE.Color(em);
          m.emissiveIntensity = 0.22;
          return m;
        }
        return mkMat(ruinCol, {
          metalness: isCrystal ? 0.35 : isEmber ? 0.15 : 0.28,
          roughness: isEmber ? 0.92 : isWhisper ? 0.78 : 0.55,
          flat: isEmber,
          emissive: extraEm ? em : isWhisper ? 0x1e1b4b : 0x0f172a,
          emissiveIntensity: extraEm ? 0.28 : isWhisper ? 0.1 : 0.06,
        });
      }
      function runeMat() {
        // Thin bright strips — not full-wall neon
        return mkMat(accent, {
          emissive: em,
          emissiveIntensity: 0.55 + resonance * 0.4,
          metalness: 0.55,
          roughness: 0.28,
          opacity: 0.92,
        });
      }
      function goldMat() {
        return mkMat(0xfbbf24, {
          emissive: 0xf59e0b,
          emissiveIntensity: 0.85 + resonance * 0.4,
          metalness: 0.7,
          roughness: 0.18,
        });
      }

      // ----- Kit pieces (tier B) -----
      function addColumn(x, z, h, lean) {
        const thick = (0.48 + Math.random() * 0.2) * S * 0.42;
        // Base plinth
        const base = new THREE.Mesh(
          new THREE.BoxGeometry(thick * 1.45, 0.28 * S * 0.3, thick * 1.45),
          stoneMat(false)
        );
        base.position.set(x, 0.14 * S * 0.3, z);
        base.castShadow = true;
        base.receiveShadow = true;
        group.add(base);
        // Shaft
        const shaft = new THREE.Mesh(
          isWhisper
            ? new THREE.CylinderGeometry(thick * 0.42, thick * 0.5, h, 8)
            : new THREE.BoxGeometry(thick, h, thick * 0.92),
          stoneMat(isCrystal && Math.random() < 0.25)
        );
        shaft.position.set(x, h * 0.5 + 0.12, z);
        shaft.rotation.z = lean != null ? lean : (noise2(x + seed, z) - 0.5) * (isEmber ? 0.38 : 0.1);
        shaft.rotation.x = (noise2(z, seed) - 0.5) * (isEmber ? 0.22 : 0.07);
        shaft.castShadow = true;
        shaft.receiveShadow = true;
        group.add(shaft);
        // Capital
        const cap = new THREE.Mesh(
          new THREE.BoxGeometry(thick * 1.35, 0.22 * S * 0.3, thick * 1.35),
          stoneMat(false)
        );
        cap.position.set(x, h + 0.2, z);
        cap.rotation.copy(shaft.rotation);
        group.add(cap);
        // Rune strip (inset, not whole face)
        if (Math.random() < 0.55 + resonance * 0.2) {
          const strip = new THREE.Mesh(
            new THREE.BoxGeometry(thick * 0.35, h * 0.45, 0.06 * S * 0.3),
            runeMat()
          );
          strip.position.set(x, h * 0.55, z + thick * 0.52);
          group.add(strip);
          pulseParts.push(strip);
        }
        if (isCrystal && Math.random() < 0.35) {
          const gem = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.18 * S * 0.35, 0),
            mkMat(accent, { emissive: em, emissiveIntensity: 0.7, metalness: 0.6, roughness: 0.2 })
          );
          gem.position.set(x, h * 0.55, z + thick * 0.65);
          group.add(gem);
          pulseParts.push(gem);
        }
        return shaft;
      }

      function addPillar(x, z, h, lean) {
        return addColumn(x, z, h, lean);
      }

      /** Wall with optional doorway / window gap (two slabs) */
      function addWall(x, z, w, h, rotY, opts) {
        opts = opts || {};
        const thick = 0.42 * S * 0.32;
        const hasDoor = opts.door || Math.random() < 0.45;
        const hasWin = opts.window || (!hasDoor && Math.random() < 0.4);
        if (hasDoor && w > 2.5 * S * 0.3) {
          const gap = w * 0.28;
          const side = (w - gap) * 0.5;
          [-1, 1].forEach(function (sideSign) {
            const panel = new THREE.Mesh(
              new THREE.BoxGeometry(side, h, thick),
              stoneMat(false)
            );
            const ox = sideSign * (gap * 0.5 + side * 0.5);
            panel.position.set(x + Math.cos(rotY || 0) * ox, h * 0.5, z + Math.sin(rotY || 0) * ox);
            panel.rotation.y = rotY || 0;
            if (isEmber) panel.rotation.z = (Math.random() - 0.5) * 0.2;
            panel.castShadow = true;
            panel.receiveShadow = true;
            group.add(panel);
          });
          // Lintel
          const lintel = new THREE.Mesh(
            new THREE.BoxGeometry(gap + side * 0.3, h * 0.18, thick * 1.1),
            stoneMat(false)
          );
          lintel.position.set(x, h * 0.88, z);
          lintel.rotation.y = rotY || 0;
          group.add(lintel);
        } else {
          const wall = new THREE.Mesh(
            new THREE.BoxGeometry(w, h, thick),
            stoneMat(false)
          );
          wall.position.set(x, h * 0.5, z);
          wall.rotation.y = rotY || 0;
          if (isEmber) wall.rotation.z = (Math.random() - 0.5) * 0.22;
          // Broken top
          if (Math.random() < 0.5) wall.scale.y = 0.65 + Math.random() * 0.35;
          wall.castShadow = true;
          wall.receiveShadow = true;
          group.add(wall);
          if (hasWin) {
            const win = new THREE.Mesh(
              new THREE.BoxGeometry(w * 0.22, h * 0.2, thick * 1.2),
              mkMat(0x020617, { opacity: 0.15, roughness: 1 })
            );
            win.position.set(x, h * 0.55, z);
            win.rotation.y = rotY || 0;
            group.add(win);
          }
        }
        // Broken chunk debris
        if (isEmber || Math.random() < 0.4) {
          const chunk = new THREE.Mesh(
            new THREE.BoxGeometry(w * 0.2, h * 0.15, thick * 0.8),
            stoneMat(false)
          );
          chunk.position.set(x + (Math.random() - 0.5) * w * 0.4, h * 0.15, z + 0.5);
          chunk.rotation.set(Math.random(), Math.random(), Math.random());
          group.add(chunk);
        }
      }

      /** Segmented arch (curve of blocks + keystone rune) */
      function addArch(cx, cz, h, w) {
        addColumn(cx - w * 0.5, cz, h, 0.04);
        addColumn(cx + w * 0.5, cz, h, -0.04);
        const segs = 5 + Math.floor(complexity);
        for (let i = 0; i < segs; i++) {
          const t = i / (segs - 1);
          const ang = -Math.PI * 0.15 + t * Math.PI * 0.3;
          const bx = cx + Math.sin(ang) * w * 0.15;
          const by = h + Math.sin(t * Math.PI) * (0.9 + density * 0.4) * S * 0.28;
          const block = new THREE.Mesh(
            new THREE.BoxGeometry((w / segs) * 1.15, 0.4 * S * 0.32, 0.55 * S * 0.32),
            stoneMat(i === Math.floor(segs / 2) && isCrystal)
          );
          block.position.set(bx + (t - 0.5) * w, by, cz);
          block.rotation.z = (t - 0.5) * 0.5;
          if (isEmber && i > segs - 2) {
            block.rotation.z += 0.4;
            block.position.y -= 0.3;
          }
          block.castShadow = true;
          group.add(block);
        }
        const key = new THREE.Mesh(
          new THREE.BoxGeometry(0.55 * S * 0.32, 0.5 * S * 0.32, 0.5 * S * 0.32),
          runeMat()
        );
        key.position.set(cx, h + 0.85 * S * 0.28, cz);
        group.add(key);
        pulseParts.push(key);
      }

      function addStairs(x, z, steps, stepW, rotY) {
        steps = steps || 4;
        stepW = stepW || 2.2 * S * 0.35;
        for (let i = 0; i < steps; i++) {
          const st = new THREE.Mesh(
            new THREE.BoxGeometry(stepW, 0.28 * S * 0.28, 0.55 * S * 0.3),
            stoneMat(false)
          );
          const d = i * 0.5 * S * 0.3;
          st.position.set(
            x + Math.sin(rotY || 0) * d,
            0.14 * S * 0.28 + i * 0.26 * S * 0.28,
            z + Math.cos(rotY || 0) * d
          );
          st.rotation.y = rotY || 0;
          st.castShadow = true;
          st.receiveShadow = true;
          group.add(st);
        }
      }

      function addFloorSlabs(cx, cz, n, spread) {
        for (let i = 0; i < n; i++) {
          const slab = new THREE.Mesh(
            new THREE.BoxGeometry(
              (0.9 + Math.random() * 1.2) * S * 0.32,
              0.14 * S * 0.25,
              (0.7 + Math.random() * 1.0) * S * 0.32
            ),
            stoneMat(false)
          );
          slab.position.set(
            cx + (noise2(seed + i, i) - 0.5) * spread,
            0.06 + Math.random() * 0.04,
            cz + (noise2(i, seed) - 0.5) * spread
          );
          slab.rotation.y = Math.random() * 0.5;
          slab.rotation.z = (Math.random() - 0.5) * 0.08;
          slab.receiveShadow = true;
          group.add(slab);
        }
      }

      function addPlatform(y, size, float) {
        // Tiered slab platform (not plain cylinder only)
        const plat = new THREE.Mesh(
          new THREE.CylinderGeometry(size * 0.92, size, 0.5 * S * 0.28, isWhisper ? 6 : 8),
          stoneMat(false)
        );
        plat.position.y = y + 0.25;
        plat.castShadow = true;
        plat.receiveShadow = true;
        group.add(plat);
        addFloorSlabs(0, 0, 4 + Math.floor(complexity * 2), size * 0.85);
        if (float) {
          const ring = new THREE.Mesh(
            new THREE.TorusGeometry(size * 0.72, 0.08 * S * 0.28, 6, 28),
            runeMat()
          );
          ring.rotation.x = Math.PI / 2;
          ring.position.y = y - 0.3;
          group.add(ring);
          pulseParts.push(ring);
        }
        return plat;
      }

      function addRunePlate(x, y, z, rotY) {
        const rune = new THREE.Mesh(
          new THREE.BoxGeometry(1.8 * S * 0.35, 0.12 * S * 0.3, 0.95 * S * 0.35),
          runeMat()
        );
        rune.position.set(x, y, z);
        rune.rotation.y = rotY || 0;
        group.add(rune);
        pulseParts.push(rune);
        for (let i = 0; i < 3; i++) {
          const dot = new THREE.Mesh(
            new THREE.SphereGeometry(0.07 * S * 0.3, 6, 6),
            goldMat()
          );
          dot.position.set(x + (i - 1) * 0.4 * S * 0.3, y + 0.1, z);
          group.add(dot);
        }
      }

      function addStarCoreLoot(x, y, z) {
        const gem = new THREE.Mesh(
          new THREE.OctahedronGeometry((0.45 + density * 0.15) * S * 0.35, 0),
          goldMat()
        );
        gem.position.set(x, y, z);
        gem.userData.isLoot = true;
        group.add(gem);
        pulseParts.push(gem);
        const aura = new THREE.Mesh(
          new THREE.SphereGeometry(0.85 * S * 0.35, 10, 10),
          mkMat(accent, { emissive: em, emissiveIntensity: 0.8, opacity: 0.28, roughness: 0.2 })
        );
        aura.position.copy(gem.position);
        aura.userData.isLoot = true;
        group.add(aura);
        hasLoot = true;
        return gem;
      }

      function addRubble(count, spread) {
        for (let i = 0; i < count; i++) {
          const s = (0.45 + Math.random() * 0.9) * S * 0.35;
          const r = new THREE.Mesh(
            isEmber
              ? new THREE.TetrahedronGeometry(s * 0.7, 0)
              : new THREE.DodecahedronGeometry(s * 0.5, 0),
            stoneMat(false)
          );
          r.position.set(
            (noise2(seed + i, i) - 0.5) * spread,
            s * 0.2,
            (noise2(i, seed) - 0.5) * spread
          );
          r.rotation.set(Math.random() * 2, Math.random() * 2, Math.random() * 2);
          r.castShadow = true;
          group.add(r);
        }
      }

      function addEnergyVent(x, z) {
        const vent = new THREE.Mesh(
          new THREE.CylinderGeometry(0.55 * S * 0.3, 0.75 * S * 0.3, 0.4 * S * 0.3, 8),
          mkMat(0x334155, { metalness: 0.65, roughness: 0.35, emissive: em, emissiveIntensity: 0.3 })
        );
        vent.position.set(x, 0.22, z);
        group.add(vent);
        const plume = new THREE.Mesh(
          new THREE.SphereGeometry(0.65 * S * 0.3, 8, 8),
          mkMat(accent, { emissive: em, emissiveIntensity: 1.0, opacity: 0.4, roughness: 0.2 })
        );
        plume.position.set(x, 1.0 * S * 0.3, z);
        group.add(plume);
        pulseParts.push(plume);
      }

      // ----- BUILD BY TYPE (mega landmark scale — tier A silhouettes) -----
      if (type.id === "monolith") {
        const h = (8.0 + density * 5 + complexity * 2.5) * S * 0.55 * (isWhisper ? 1.3 : 1);
        // Plinth
        const plinth = new THREE.Mesh(
          new THREE.BoxGeometry(2.8 * S * 0.4, 0.55 * S * 0.3, 2.4 * S * 0.4),
          stoneMat(false)
        );
        plinth.position.y = 0.28 * S * 0.3;
        plinth.receiveShadow = true;
        group.add(plinth);
        const mono = new THREE.Mesh(
          new THREE.BoxGeometry(1.7 * S * 0.4, h, 1.15 * S * 0.4),
          stoneMat(true)
        );
        mono.position.y = h * 0.5 + 0.35;
        mono.rotation.y = noise2(seed, 1) * 0.35;
        if (isEmber) mono.rotation.z = 0.14;
        mono.castShadow = true;
        group.add(mono);
        // Carved face = thin rune strip, not full neon slab
        const face = new THREE.Mesh(
          new THREE.BoxGeometry(0.9 * S * 0.35, h * 0.42, 0.1 * S * 0.28),
          runeMat()
        );
        face.position.set(0, h * 0.55, 0.62 * S * 0.35);
        group.add(face);
        pulseParts.push(face);
        addStairs(0, 2.2 * S * 0.35, 4, 2.0 * S * 0.35, 0);
        addRunePlate(0, 0.2, 2.4 * S * 0.35, 0);
        addFloorSlabs(0, 0, 5, 4 * S * 0.35);
        if (density > 0.35 || resonance > 0.3) {
          // Altar bowl under loot
          const bowl = new THREE.Mesh(
            new THREE.CylinderGeometry(0.55 * S * 0.3, 0.7 * S * 0.3, 0.35 * S * 0.3, 8),
            stoneMat(false)
          );
          bowl.position.set(0, h * 0.12, 1.1 * S * 0.3);
          group.add(bowl);
          addStarCoreLoot(0, h * 0.82, 0.75 * S * 0.3);
        }
        addRubble(8 + Math.floor(complexity * 3), 7 * S * 0.35);
      } else if (type.id === "arch") {
        addPlatform(0, (4.2 + density * 1.5) * S * 0.35, false);
        addStairs(0, 3.2 * S * 0.35, 3, 2.4 * S * 0.35, 0);
        addArch(0, 0, (5.8 + density * 3) * S * 0.4, (4.4 + density * 1.2) * S * 0.35);
        if (complexity > 0.65) addArch(0, -3.8 * S * 0.35, (4.4 + density * 2) * S * 0.4, 3.4 * S * 0.35);
        // Side ruins — broken symmetry
        if (Math.random() < 0.7) addColumn(3.5 * S * 0.35, 1.2 * S * 0.35, 3.2 * S * 0.35, 0.25);
        addRunePlate(0, 0.7, 2.8 * S * 0.35, 0);
        if (Math.random() < 0.55 + density * 0.3) {
          const ped = new THREE.Mesh(
            new THREE.CylinderGeometry(0.5 * S * 0.3, 0.65 * S * 0.3, 0.5 * S * 0.3, 8),
            stoneMat(false)
          );
          ped.position.set(0, 0.4, 0);
          group.add(ped);
          addStarCoreLoot(0, 1.15 * S * 0.35, 0);
        }
        addRubble(10, 7.5 * S * 0.35);
        addFloorSlabs(0, 0, 6, 5 * S * 0.35);
        if (isCrystal) {
          for (let i = 0; i < 3; i++) {
            const c = new THREE.Mesh(
              new THREE.ConeGeometry(0.3 * S * 0.3, 1.8 * S * 0.35, 5),
              mkMat(accent, { emissive: em, emissiveIntensity: 0.65, metalness: 0.55, roughness: 0.22 })
            );
            c.position.set((i - 1) * 2.2 * S * 0.35, 0.9 * S * 0.3, 1.2);
            group.add(c);
          }
        }
      } else if (type.id === "outpost") {
        const baseSz = (5.8 + density * 2.5) * S * 0.35;
        addPlatform(0, baseSz * 0.5, false);
        addStairs(0, baseSz * 0.55, 4, 2.6 * S * 0.35, 0);
        const ph = (4.2 + density * 3.5 * complexity) * S * 0.4;
        const spread = 3.0 * S * 0.35;
        const corners = [[1, 1], [-1, 1], [1, -1], [-1, -0.85]];
        corners.forEach(function (c, i) {
          const broken = isEmber ? i > 1 : i === 3 && Math.random() < 0.5;
          addColumn(c[0] * spread, c[1] * spread * 0.85, broken ? ph * 0.4 : ph, broken ? 0.35 : 0);
        });
        addWall(0, spread * 0.95, 5.2 * S * 0.35 + density, (2.6 + density) * S * 0.4, 0, { door: true });
        // Missing wall side — open for sprint-through
        if (complexity > 0.55) addWall(-spread, 0, 4.2 * S * 0.35, 2.8 * S * 0.4, Math.PI / 2, { window: true });
        // Fallen roof beam
        const beam = new THREE.Mesh(
          new THREE.BoxGeometry(5.2 * S * 0.35, 0.38 * S * 0.28, 0.42 * S * 0.28),
          stoneMat(false)
        );
        beam.position.set(0.5, ph * 0.55, spread * 0.55);
        beam.rotation.z = -0.45;
        beam.rotation.y = 0.2;
        beam.castShadow = true;
        group.add(beam);
        addRunePlate(0, 0.65, -spread * 0.9, Math.PI);
        addEnergyVent(spread * 0.5, -spread * 0.35);
        if (density > 0.25 || resonance > 0.25) {
          const ped = new THREE.Mesh(
            new THREE.BoxGeometry(1.1 * S * 0.3, 0.45 * S * 0.3, 1.1 * S * 0.3),
            stoneMat(false)
          );
          ped.position.set(0, 0.35, 0);
          group.add(ped);
          addStarCoreLoot(0, 1.25 * S * 0.35, 0);
        }
        addRubble(12 + Math.floor(complexity * 3), 8.5 * S * 0.35);
        addFloorSlabs(0, 0, 7, 6 * S * 0.35);
      } else if (type.id === "tower") {
        // Octagonal / tapered stack with broken crown
        const levels = 3 + Math.floor(complexity * 2);
        let y = 0;
        for (let i = 0; i < levels; i++) {
          const s = (3.4 - i * 0.38) * S * 0.35;
          const h = (2.6 + density * 0.55) * S * 0.4;
          const seg = new THREE.Mesh(
            isWhisper
              ? new THREE.CylinderGeometry(s * 0.45, s * 0.55, h, 8)
              : new THREE.BoxGeometry(s, h, s),
            stoneMat(i === levels - 1 && isCrystal)
          );
          seg.position.y = y + h * 0.5;
          if (isEmber && i === levels - 1) {
            seg.rotation.z = 0.45;
            seg.position.x = 0.9;
          } else if (i === levels - 1 && Math.random() < 0.5) {
            seg.scale.y = 0.55; // snapped top
          }
          seg.castShadow = true;
          group.add(seg);
          // Ledge ring
          if (i < levels - 1) {
            const ledge = new THREE.Mesh(
              new THREE.BoxGeometry(s * 1.15, 0.18 * S * 0.28, s * 1.15),
              stoneMat(false)
            );
            ledge.position.y = y + h;
            group.add(ledge);
          }
          y += h * 0.92;
        }
        addStairs(2.5 * S * 0.35, 0, 5, 1.8 * S * 0.35, Math.PI / 2);
        addColumn(3.4 * S * 0.35, 1.2, (3.8 + density * 2) * S * 0.4, 0.35);
        addColumn(-2.8 * S * 0.35, -1.5, 2.2 * S * 0.35, -0.2);
        addRunePlate(0, 0.25, 3.2 * S * 0.35, 0);
        if (Math.random() < 0.6 + resonance * 0.3) addStarCoreLoot(0, y * 0.4, 0);
        addRubble(12, 7 * S * 0.35);
        addFloorSlabs(0, 0, 6, 5.5 * S * 0.35);
      } else if (type.id === "platform") {
        const floatY = (isWhisper ? 3.8 + density * 3 : 1.3 + density * 1.2) * S * 0.35;
        addPlatform(floatY, (4.2 + density * 1.8) * S * 0.35, true);
        const n = 4 + Math.floor(complexity * 2);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + seed;
          const ph = (2.0 + density * 1.4) * S * 0.4 * (i % 3 === 0 ? 0.55 : 1);
          addColumn(Math.cos(a) * 2.7 * S * 0.35, Math.sin(a) * 2.7 * S * 0.35, ph, (i % 2) * 0.15);
        }
        // Altar
        const altar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.9 * S * 0.3, 1.1 * S * 0.3, 0.7 * S * 0.3, 8),
          stoneMat(true)
        );
        altar.position.y = floatY + 0.65;
        group.add(altar);
        addRunePlate(0, floatY + 0.85, 0, 0);
        addStarCoreLoot(0, floatY + 1.35, 0);
        if (isWhisper) {
          for (let i = 0; i < 8; i++) {
            const star = new THREE.Mesh(
              new THREE.SphereGeometry(0.1 * S * 0.28, 6, 6),
              mkMat(0xe0e7ff, { emissive: 0xa5b4fc, emissiveIntensity: 0.85 })
            );
            const a = (i / 8) * Math.PI * 2;
            star.position.set(Math.cos(a) * 3.6 * S * 0.35, floatY + 1.8, Math.sin(a) * 3.6 * S * 0.35);
            group.add(star);
            pulseParts.push(star);
          }
        }
      } else if (type.id === "temple") {
        addPlatform(0, (7.8 + density * 2) * S * 0.35, false);
        addStairs(0, 6.5 * S * 0.35, 6, 3.5 * S * 0.35, 0);
        const cols = 8 + Math.floor(density * 2);
        for (let i = 0; i < cols; i++) {
          const a = (i / cols) * Math.PI * 2;
          const rad = (5.6 + density) * S * 0.35;
          // Broken symmetry — skip one column
          if (i === 3) continue;
          const broken = i === 6;
          addColumn(
            Math.cos(a) * rad,
            Math.sin(a) * rad,
            broken ? (3.0 + density) * S * 0.35 : (6.2 + density * 3 * complexity) * S * 0.4,
            broken ? 0.4 : 0
          );
        }
        addWall(0, 4.2 * S * 0.35, 6.8 * S * 0.35, (3.6 + density * 1.4) * S * 0.4, 0, { door: true });
        addWall(0, -4.2 * S * 0.35, 6.8 * S * 0.35, 2.8 * S * 0.4, 0, { window: true });
        addArch(0, 0, (6.8 + density * 2.5) * S * 0.4, 5.0 * S * 0.35);
        // Inner sanctum pedestal
        const altar = new THREE.Mesh(
          new THREE.CylinderGeometry(1.5 * S * 0.32, 1.85 * S * 0.32, 1.15 * S * 0.32, 8),
          stoneMat(true)
        );
        altar.position.y = 0.75 * S * 0.32;
        group.add(altar);
        const bowl = new THREE.Mesh(
          new THREE.CylinderGeometry(0.7 * S * 0.28, 0.9 * S * 0.28, 0.35 * S * 0.28, 10),
          runeMat()
        );
        bowl.position.y = 1.4 * S * 0.32;
        group.add(bowl);
        pulseParts.push(bowl);
        addStarCoreLoot(0, 1.95 * S * 0.35, 0);
        if (resonance > 0.45) addStarCoreLoot(3.2 * S * 0.35, 1.1 * S * 0.35, 2.0 * S * 0.35);
        addRunePlate(0, 0.35, 5.2 * S * 0.35, 0);
        addEnergyVent(-4.0 * S * 0.35, 0);
        addEnergyVent(4.0 * S * 0.35, 0);
        addRubble(14, 12 * S * 0.35);
        addFloorSlabs(0, 0, 10, 9 * S * 0.35);
        for (let i = 0; i < 4; i++) {
          const spire = new THREE.Mesh(
            new THREE.ConeGeometry(0.38 * S * 0.28, (2.6 + density * 1.4) * S * 0.32, 5),
            isEmber
              ? mkMat(0x7c2d12, { emissive: 0xea580c, emissiveIntensity: 0.45, roughness: 0.7 })
              : mkMat(accent, { emissive: em, emissiveIntensity: 0.65, metalness: 0.5, roughness: 0.22 })
          );
          spire.position.set((i - 1.5) * 2.5 * S * 0.32, 1.4 * S * 0.28, 6.2 * S * 0.32);
          group.add(spire);
        }
      } else if (type.id === "wreck") {
        addPlatform(0, 4.6 * S * 0.35, false);
        // Diagonal torn hull
        const fallen = new THREE.Mesh(
          new THREE.BoxGeometry(2.8 * S * 0.35, 2.0 * S * 0.32, 8.5 * S * 0.35),
          stoneMat(false)
        );
        fallen.position.set(1.3, 1.1 * S * 0.28, 0.4);
        fallen.rotation.z = 0.58;
        fallen.rotation.y = 0.35;
        fallen.castShadow = true;
        group.add(fallen);
        // Exposed plates
        for (let i = 0; i < 4; i++) {
          const plate = new THREE.Mesh(
            new THREE.BoxGeometry(1.4 * S * 0.3, 0.15 * S * 0.25, 2.2 * S * 0.3),
            stoneMat(false)
          );
          plate.position.set((Math.random() - 0.5) * 4, 0.4 + Math.random(), (Math.random() - 0.5) * 3);
          plate.rotation.set(Math.random() * 0.5, Math.random(), Math.random() * 0.8);
          group.add(plate);
        }
        addColumn(-3.2 * S * 0.35, 2.0 * S * 0.35, 5.2 * S * 0.4, 0.55);
        addColumn(3.6 * S * 0.35, -1.6 * S * 0.35, 2.2 * S * 0.4, -0.35);
        addWall(-0.5, -3.2 * S * 0.35, 6.8 * S * 0.35, 1.6 * S * 0.4, 0.15);
        for (let i = 0; i < 5; i++) {
          const scorch = new THREE.Mesh(
            new THREE.CircleGeometry((1.1 + Math.random()) * S * 0.32, 10),
            mkMat(0x1a0805, { emissive: 0x3b1208, emissiveIntensity: 0.35, roughness: 1, opacity: 0.85 })
          );
          scorch.rotation.x = -Math.PI / 2;
          scorch.position.set((Math.random() - 0.5) * 5.5, 0.05, (Math.random() - 0.5) * 5.5);
          group.add(scorch);
        }
        addEnergyVent(2.0 * S * 0.35, 1.2 * S * 0.35);
        if (Math.random() < 0.55 + density * 0.3) {
          const lava = new THREE.Mesh(
            new THREE.CircleGeometry(1.15 * S * 0.32, 10),
            mkMat(0xf97316, { emissive: 0xea580c, emissiveIntensity: 0.9, opacity: 0.88 })
          );
          lava.rotation.x = -Math.PI / 2;
          lava.position.set(-1.2, 0.07, 0.8);
          group.add(lava);
          pulseParts.push(lava);
        }
        // Exposed core recess
        const coreShell = new THREE.Mesh(
          new THREE.CylinderGeometry(0.85 * S * 0.28, 1.1 * S * 0.28, 0.6 * S * 0.28, 8),
          stoneMat(false)
        );
        coreShell.position.set(0, 0.4, 0);
        group.add(coreShell);
        if (density > 0.3 || resonance > 0.2) addStarCoreLoot(0, 1.35 * S * 0.35, 0);
        addRubble(14, 9.5 * S * 0.35);
        addFloorSlabs(0, 0, 8, 7 * S * 0.35);
      }

      // Overgrown flora / vines linking ruin to biome (tier A)
      if (density > 0.25 && Math.random() < 0.75) {
        const plantC = biome.plant || 0xa78bfa;
        const plantE = biome.plantEmissive || 0x7c3aed;
        const nMoss = isEmber ? 3 : 6 + Math.floor(density * 4);
        for (let i = 0; i < nMoss; i++) {
          const moss = new THREE.Mesh(
            isEmber
              ? new THREE.TetrahedronGeometry(0.28 * S * 0.28, 0)
              : new THREE.SphereGeometry(0.28 * S * 0.28, 6, 6),
            mkMat(isEmber ? 0x7c2d12 : plantC, {
              emissive: isEmber ? 0xea580c : plantE,
              emissiveIntensity: 0.28,
              roughness: 0.85,
              opacity: 0.88,
            })
          );
          moss.position.set(
            (Math.random() - 0.5) * 7 * S * 0.35,
            0.35 + Math.random() * 3.2,
            (Math.random() - 0.5) * 7 * S * 0.35
          );
          moss.scale.set(1 + Math.random(), 0.6 + Math.random() * 0.5, 1 + Math.random());
          group.add(moss);
        }
        // Hanging vine capsules
        if (!isEmber) {
          for (let i = 0; i < 3; i++) {
            const vine = new THREE.Mesh(
              new THREE.CapsuleGeometry(0.06 * S * 0.28, 1.2 * S * 0.32, 3, 5),
              mkMat(plantC, { emissive: plantE, emissiveIntensity: 0.2, roughness: 0.7, opacity: 0.9 })
            );
            vine.position.set((Math.random() - 0.5) * 4, 2.2 + Math.random(), (Math.random() - 0.5) * 3);
            vine.rotation.z = (Math.random() - 0.5) * 0.5;
            group.add(vine);
          }
        }
      }

      // Strong resonance → ambient glow shell (huge)
      if (resonance > 0.55) {
        const shell = new THREE.Mesh(
          new THREE.SphereGeometry((6 + density * 2) * S * 0.35, 12, 12),
          mkMat(accent, { emissive: em, emissiveIntensity: 0.5, opacity: 0.12, roughness: 0.2 })
        );
        shell.position.y = 3.5 * S * 0.35;
        group.add(shell);
        pulseParts.push(shell);
      }

      // Orbital megastructures — giant energy rings / resonance amplifiers
      if (opts.orbital) {
        const ringR = (7 + density * 4) * S * 0.45;
        const bigRing = new THREE.Mesh(
          new THREE.TorusGeometry(ringR, 0.22 * S * 0.4, 8, 48),
          runeMat()
        );
        bigRing.rotation.x = Math.PI / 2 + (Math.random() - 0.5) * 0.4;
        bigRing.rotation.z = (Math.random() - 0.5) * 0.5;
        bigRing.position.y = (2 + density * 2) * S * 0.35;
        group.add(bigRing);
        pulseParts.push(bigRing);
        if (Math.random() < 0.55) {
          const ring2 = new THREE.Mesh(
            new THREE.TorusGeometry(ringR * 0.65, 0.12 * S * 0.35, 6, 32),
            mkMat(accent, { emissive: em, emissiveIntensity: 1.1, opacity: 0.75, metalness: 0.5 })
          );
          ring2.rotation.y = Math.PI / 3;
          ring2.rotation.x = Math.PI / 4;
          ring2.position.y = bigRing.position.y + 1.2;
          group.add(ring2);
          pulseParts.push(ring2);
        }
        // Soft exterior aura so structure reads from far away
        const aura = new THREE.Mesh(
          new THREE.SphereGeometry(ringR * 1.15, 14, 14),
          mkMat(accent, { emissive: em, emissiveIntensity: 0.55, opacity: 0.1, roughness: 0.2 })
        );
        aura.position.y = bigRing.position.y;
        group.add(aura);
      }

      // Store footprint for loot radius
      group.userData.ruinRadius = 4.5 * S * 0.4;

      // Walkable tops + solid walls (world space filled on spawn)
      // Local colliders: half = XZ radius, top = local Y of stand surface
      const walk = [];
      const walls = [];
      const rr = 4.5 * S * 0.4;
      if (type.id === "platform") {
        const floatY = (isWhisper ? 3.8 + density * 3 : 1.3 + density * 1.2) * S * 0.35;
        const psz = (4.2 + density * 1.8) * S * 0.35;
        walk.push({ lx: 0, lz: 0, half: psz * 0.95, top: floatY + 0.5 * S * 0.28 });
        walls.push({ lx: 0, lz: 0, half: psz * 0.88, y0: floatY - 0.2, y1: floatY + 0.45 });
      } else if (type.id === "temple") {
        const psz = (7.8 + density * 2) * S * 0.35;
        walk.push({ lx: 0, lz: 0, half: psz * 0.92, top: 0.55 * S * 0.32 });
        walls.push({ lx: 0, lz: 4.2 * S * 0.35, half: psz * 0.55, y0: 0, y1: 3.5 * S * 0.4 });
        walls.push({ lx: 0, lz: -4.2 * S * 0.35, half: psz * 0.55, y0: 0, y1: 2.8 * S * 0.4 });
      } else if (type.id === "outpost" || type.id === "tower") {
        walk.push({ lx: 0, lz: 0, half: rr * 0.7, top: 1.2 * S * 0.35 });
        walls.push({ lx: 0, lz: 0, half: rr * 0.55, y0: 0, y1: 3.5 * S * 0.4 });
      } else if (type.id === "monolith") {
        walls.push({ lx: 0, lz: 0, half: 1.1 * S * 0.35, y0: 0, y1: 5 * S * 0.4 });
      } else if (type.id === "arch") {
        walk.push({ lx: 0, lz: 0, half: 2.2 * S * 0.35, top: 0.35 });
        walls.push({ lx: 2.2 * S * 0.35, lz: 0, half: 0.8 * S * 0.35, y0: 0, y1: 4 * S * 0.4 });
        walls.push({ lx: -2.2 * S * 0.35, lz: 0, half: 0.8 * S * 0.35, y0: 0, y1: 4 * S * 0.4 });
      } else if (type.id === "wreck") {
        walk.push({ lx: 0, lz: 0, half: rr * 0.85, top: 0.9 * S * 0.3 });
        walls.push({ lx: 0, lz: 0, half: rr * 0.7, y0: 0, y1: 2.2 * S * 0.35 });
      } else {
        walk.push({ lx: 0, lz: 0, half: rr * 0.75, top: 0.5 });
        walls.push({ lx: 0, lz: 0, half: rr * 0.5, y0: 0, y1: 2.5 * S * 0.35 });
      }
      group.userData.walkColliders = walk;
      group.userData.wallColliders = walls;

      group.userData.kind = "ruin";
      group.userData.ruinType = type.id;
      group.userData.hasLoot = hasLoot;
      group.userData.lootTaken = false;
      group.userData.lootPower = 0.08 + density * 0.12 + resonance * 0.1;
      group.userData.pulseParts = pulseParts;
      group.userData.pulseT = 0;
    },
  };

  /**
   * DetailGenerator — soul & magic of the Boltverse
   * Micro-details: crystals · vents · light shafts · motes · debris · story marks
   * High-frequency, particle-heavy, scales hard with sprint score + Resonance.
   */
  const DETAIL_TYPES = {
    crystals: { id: "crystals", name: "Crystal Cluster" },
    vent: { id: "vent", name: "Energy Vent" },
    shaft: { id: "shaft", name: "Light Shaft" },
    motes: { id: "motes", name: "Atmospheric Motes" },
    debris: { id: "debris", name: "Floating Debris" },
    scorch: { id: "scorch", name: "Flux Scorch" },
    residue: { id: "residue", name: "Energy Residue" },
    footprints: { id: "footprints", name: "Ancient Prints" },
  };

  function pickDetailType(density, biomeId, resonance) {
    const r = Math.random();
    if (biomeId === "emberVoid") {
      if (r < 0.28) return DETAIL_TYPES.vent;
      if (r < 0.48) return DETAIL_TYPES.scorch;
      if (r < 0.65) return DETAIL_TYPES.motes;
      if (r < 0.8) return DETAIL_TYPES.crystals;
      if (r < 0.9) return DETAIL_TYPES.debris;
      return DETAIL_TYPES.residue;
    }
    if (biomeId === "whisperStars") {
      if (r < 0.3) return DETAIL_TYPES.motes;
      if (r < 0.5) return DETAIL_TYPES.shaft;
      if (r < 0.68) return DETAIL_TYPES.debris;
      if (r < 0.82) return DETAIL_TYPES.crystals;
      if (r < 0.92) return DETAIL_TYPES.residue;
      return DETAIL_TYPES.footprints;
    }
    // Crystal Nebula
    if (r < 0.28) return DETAIL_TYPES.crystals;
    if (r < 0.48) return DETAIL_TYPES.motes;
    if (r < 0.65) return DETAIL_TYPES.shaft;
    if (r < 0.78) return DETAIL_TYPES.vent;
    if (r < 0.88) return DETAIL_TYPES.residue;
    if (density > 0.5 && r < 0.95) return DETAIL_TYPES.debris;
    return DETAIL_TYPES.footprints;
  }

  function createDetailMesh() {
    const g = new THREE.Group();
    g.userData.kind = "detail";
    return g;
  }

  function getDetailSprite() {
    if (global.BoltGraphics && global.BoltGraphics.getSoftSpriteTexture) {
      return global.BoltGraphics.getSoftSpriteTexture();
    }
    return null;
  }

  const DetailGenerator = {
    layout: function (group, opts) {
      while (group.children.length) {
        const c = group.children.pop();
        if (c.geometry) c.geometry.dispose();
        if (c.material) {
          if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose());
          else c.material.dispose();
        }
      }

      const biome = opts.biome;
      const density = opts.density || 0;
      const resonance = opts.resonance || 0;
      const type = opts.typeDef || DETAIL_TYPES.crystals;
      const seed = opts.seed || Math.random() * 200;
      const col = biome.color || 0x67e8f9;
      const em = biome.emissive || col;
      const plant = biome.plant || 0xa78bfa;
      const plantEm = biome.plantEmissive || 0x7c3aed;
      const isEmber = biome.id === "emberVoid";
      const isWhisper = biome.id === "whisperStars";
      const isCrystal = biome.id === "crystalNebula";

      const floatParts = [];
      const pulseParts = [];
      const spinParts = [];
      const moteBoost = 1 + density * 1.8 + resonance * 1.4;

      function glowMat(c, e, eInt, opac) {
        return mkMat(c, {
          emissive: e,
          emissiveIntensity: (eInt != null ? eInt : 1.1) * (1 + resonance * 0.5),
          metalness: 0.55,
          roughness: 0.2,
          opacity: opac != null ? opac : 0.95,
        });
      }

      function softMat(c, opac) {
        return mkMat(c, {
          emissive: c,
          emissiveIntensity: 0.9 + resonance * 0.6,
          metalness: 0.1,
          roughness: 0.4,
          opacity: opac != null ? opac : 0.45,
        });
      }

      // ----- CRYSTAL CLUSTER -----
      if (type.id === "crystals") {
        const n = 3 + Math.floor(density * 5 * moteBoost * 0.5) + (isCrystal ? 2 : 0);
        for (let i = 0; i < n; i++) {
          const h = 0.35 + noise2(seed + i, i) * 0.9 + density * 0.4;
          const geo = isEmber
            ? new THREE.TetrahedronGeometry(0.12 + Math.random() * 0.1, 0)
            : isWhisper
            ? new THREE.OctahedronGeometry(0.1 + Math.random() * 0.08, 0)
            : new THREE.ConeGeometry(0.08 + Math.random() * 0.1, h, 5);
          const c = new THREE.Mesh(
            geo,
            glowMat(isEmber ? 0xfb923c : col, isEmber ? 0xea580c : em, 1.2 + density * 0.4)
          );
          c.position.set(
            (noise2(i, seed) - 0.5) * 1.4,
            isEmber ? h * 0.35 : h * 0.5,
            (noise2(seed, i + 2) - 0.5) * 1.4
          );
          c.rotation.z = (noise2(i, 3) - 0.5) * 0.55;
          c.rotation.x = (noise2(4, i) - 0.5) * 0.3;
          c.castShadow = true;
          group.add(c);
          pulseParts.push(c);
          if (Math.random() < 0.35 + resonance * 0.3) {
            const shard = new THREE.Mesh(
              new THREE.OctahedronGeometry(0.06, 0),
              glowMat(plant, plantEm, 1.4, 0.85)
            );
            shard.position.copy(c.position);
            shard.position.y += h * 0.6;
            group.add(shard);
            floatParts.push(shard);
            spinParts.push(shard);
          }
        }
      }

      // ----- ENERGY VENT -----
      else if (type.id === "vent") {
        const vent = new THREE.Mesh(
          new THREE.CylinderGeometry(0.32, 0.42, 0.22, 10),
          mkMat(isEmber ? 0x3f2a22 : 0x334155, {
            metalness: 0.65,
            roughness: 0.35,
            emissive: em,
            emissiveIntensity: 0.35,
          })
        );
        vent.position.y = 0.12;
        group.add(vent);
        const plumeH = 0.8 + density * 1.2 + resonance * 0.6;
        const plume = new THREE.Mesh(
          new THREE.SphereGeometry(0.35 + density * 0.15, 10, 10),
          softMat(isEmber ? 0xf97316 : plant, 0.4)
        );
        plume.position.y = 0.45 + plumeH * 0.25;
        plume.scale.set(1, 1.4 + density, 1);
        group.add(plume);
        floatParts.push(plume);
        pulseParts.push(plume);
        // Rising orbs
        const orbs = 2 + Math.floor(density * 3);
        for (let i = 0; i < orbs; i++) {
          const o = new THREE.Mesh(
            new THREE.SphereGeometry(0.06 + Math.random() * 0.05, 8, 8),
            glowMat(col, em, 1.5, 0.8)
          );
          o.position.set((Math.random() - 0.5) * 0.3, 0.5 + i * 0.35, (Math.random() - 0.5) * 0.3);
          o.userData.floatSpeed = 0.4 + Math.random() * 0.5;
          o.userData.baseY = o.position.y;
          group.add(o);
          floatParts.push(o);
        }
      }

      // ----- LIGHT SHAFT -----
      else if (type.id === "shaft") {
        const h = 4 + density * 5 + resonance * 2;
        const shaft = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08, 0.55 + density * 0.3, h, 8, 1, true),
          softMat(isWhisper ? 0xc7d2fe : col, 0.22 + resonance * 0.15)
        );
        shaft.position.y = h * 0.5;
        group.add(shaft);
        pulseParts.push(shaft);
        const core = new THREE.Mesh(
          new THREE.CylinderGeometry(0.04, 0.12, h * 0.9, 6, 1, true),
          glowMat(0xffffff, em, 1.6, 0.55)
        );
        core.position.y = h * 0.45;
        group.add(core);
        // Ground caustic disc
        const disc = new THREE.Mesh(
          new THREE.CircleGeometry(0.7 + density * 0.5, 16),
          softMat(col, 0.35)
        );
        disc.rotation.x = -Math.PI / 2;
        disc.position.y = 0.04;
        group.add(disc);
        pulseParts.push(disc);
      }

      // ----- ATMOSPHERIC MOTES (particle field) -----
      else if (type.id === "motes") {
        const count = Math.floor(18 + density * 40 * moteBoost + resonance * 25);
        const pos = new Float32Array(count * 3);
        const spread = 2.5 + density * 3;
        const height = 1.5 + density * 3 + (isWhisper ? 2 : 0);
        for (let i = 0; i < count; i++) {
          pos[i * 3] = (hash2(seed + i, i) - 0.5) * spread * 2;
          pos[i * 3 + 1] = hash2(i, seed) * height + 0.2;
          pos[i * 3 + 2] = (hash2(i * 3, seed + 1) - 0.5) * spread * 2;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        const sprite = getDetailSprite();
        const mat = new THREE.PointsMaterial({
          map: sprite || null,
          color: isEmber ? 0xfb923c : isWhisper ? 0xc7d2fe : col,
          size: 0.18 + density * 0.12 + resonance * 0.1,
          transparent: true,
          opacity: 0.75 + resonance * 0.2,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          sizeAttenuation: true,
        });
        mat.userData.baseOpacity = mat.opacity;
        const pts = new THREE.Points(geo, mat);
        group.add(pts);
        group.userData.motePoints = pts;
        group.userData.moteBase = pos.slice(0);
        // Soft ground glow
        const glow = new THREE.Mesh(
          new THREE.CircleGeometry(1.2 + density, 16),
          softMat(col, 0.15)
        );
        glow.rotation.x = -Math.PI / 2;
        glow.position.y = 0.03;
        group.add(glow);
      }

      // ----- FLOATING DEBRIS -----
      else if (type.id === "debris") {
        const n = 3 + Math.floor(density * 5);
        for (let i = 0; i < n; i++) {
          const s = 0.08 + Math.random() * 0.18;
          const d = new THREE.Mesh(
            isEmber
              ? new THREE.TetrahedronGeometry(s, 0)
              : new THREE.DodecahedronGeometry(s, 0),
            mkMat(isEmber ? 0x78716c : biome.rock || 0x64748b, {
              metalness: 0.4,
              roughness: 0.7,
              emissive: em,
              emissiveIntensity: 0.15 + resonance * 0.2,
            })
          );
          d.position.set(
            (noise2(i, seed) - 0.5) * 2.5,
            0.6 + noise2(seed, i) * 1.8 + density,
            (noise2(seed + i, 2) - 0.5) * 2.5
          );
          d.userData.baseY = d.position.y;
          d.userData.floatSpeed = 0.3 + Math.random() * 0.4;
          group.add(d);
          floatParts.push(d);
          spinParts.push(d);
        }
        // Occasional glowing orb
        if (Math.random() < 0.5 + resonance * 0.3) {
          const orb = new THREE.Mesh(
            new THREE.SphereGeometry(0.12, 10, 10),
            glowMat(col, em, 1.5, 0.85)
          );
          orb.position.set(0, 1.2 + density, 0);
          orb.userData.baseY = orb.position.y;
          group.add(orb);
          floatParts.push(orb);
          pulseParts.push(orb);
        }
      }

      // ----- FLUX SCORCH (Ember storytelling) -----
      else if (type.id === "scorch") {
        const rings = 2 + Math.floor(density * 2);
        for (let i = 0; i < rings; i++) {
          const scorch = new THREE.Mesh(
            new THREE.CircleGeometry(0.5 + i * 0.35 + Math.random() * 0.3, 12),
            mkMat(0x1a0805, {
              emissive: 0x3b1208,
              emissiveIntensity: 0.35 + density * 0.2,
              roughness: 1,
              opacity: 0.7 - i * 0.15,
            })
          );
          scorch.rotation.x = -Math.PI / 2;
          scorch.position.set(
            (noise2(i, seed) - 0.5) * 1.2,
            0.03 + i * 0.005,
            (noise2(seed, i) - 0.5) * 1.2
          );
          group.add(scorch);
        }
        // Ember sparks
        for (let i = 0; i < 4 + Math.floor(density * 4); i++) {
          const spark = new THREE.Mesh(
            new THREE.SphereGeometry(0.04, 6, 6),
            glowMat(0xfbbf24, 0xea580c, 1.8, 0.9)
          );
          spark.position.set(
            (Math.random() - 0.5) * 1.5,
            0.2 + Math.random() * 1.2,
            (Math.random() - 0.5) * 1.5
          );
          spark.userData.baseY = spark.position.y;
          spark.userData.floatSpeed = 0.6 + Math.random();
          group.add(spark);
          floatParts.push(spark);
        }
      }

      // ----- ENERGY RESIDUE (runes / ripples) -----
      else if (type.id === "residue") {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.7 + density * 0.4, 0.04, 8, 28),
          glowMat(col, em, 1.0, 0.75)
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.08;
        group.add(ring);
        pulseParts.push(ring);
        spinParts.push(ring);
        // Rune pips
        const pips = 4 + Math.floor(density * 4);
        for (let i = 0; i < pips; i++) {
          const a = (i / pips) * Math.PI * 2;
          const pip = new THREE.Mesh(
            new THREE.BoxGeometry(0.12, 0.04, 0.08),
            glowMat(plant, plantEm, 1.2, 0.9)
          );
          pip.position.set(Math.cos(a) * 0.85, 0.1, Math.sin(a) * 0.85);
          group.add(pip);
          pulseParts.push(pip);
        }
        if (resonance > 0.4) {
          const wave = new THREE.Mesh(
            new THREE.TorusGeometry(1.2 + density * 0.5, 0.025, 6, 24),
            softMat(col, 0.3)
          );
          wave.rotation.x = Math.PI / 2;
          wave.position.y = 0.12;
          group.add(wave);
          pulseParts.push(wave);
        }
      }

      // ----- ANCIENT FOOTPRINTS / STORY MARKS -----
      else if (type.id === "footprints") {
        const steps = 3 + Math.floor(density * 3);
        for (let i = 0; i < steps; i++) {
          const print = new THREE.Mesh(
            new THREE.CircleGeometry(0.18 + Math.random() * 0.08, 8),
            mkMat(isEmber ? 0x2a1008 : 0x1e293b, {
              roughness: 1,
              metalness: 0.05,
              emissive: em,
              emissiveIntensity: 0.15 + resonance * 0.2,
              opacity: 0.55,
            })
          );
          print.rotation.x = -Math.PI / 2;
          print.scale.set(1, 1.4, 1);
          print.position.set(i * 0.55 - steps * 0.2, 0.025, Math.sin(i) * 0.15);
          group.add(print);
        }
        // Faint residual glow trail
        const trail = new THREE.Mesh(
          new THREE.PlaneGeometry(steps * 0.6, 0.25),
          softMat(col, 0.18)
        );
        trail.rotation.x = -Math.PI / 2;
        trail.position.set(steps * 0.15, 0.02, 0);
        group.add(trail);
      }

      // High density / resonance: always sprinkle extra motes
      if ((density > 0.55 || resonance > 0.5) && type.id !== "motes") {
        const extra = Math.floor(6 + density * 12 + resonance * 10);
        const pos = new Float32Array(extra * 3);
        for (let i = 0; i < extra; i++) {
          pos[i * 3] = (Math.random() - 0.5) * 3;
          pos[i * 3 + 1] = 0.3 + Math.random() * 2.5;
          pos[i * 3 + 2] = (Math.random() - 0.5) * 3;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        const sprite = getDetailSprite();
        const mat = new THREE.PointsMaterial({
          map: sprite || null,
          color: col,
          size: 0.14 + resonance * 0.08,
          transparent: true,
          opacity: 0.65,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          sizeAttenuation: true,
        });
        mat.userData.baseOpacity = 0.65;
        const pts = new THREE.Points(geo, mat);
        group.add(pts);
        group.userData.motePoints = pts;
        group.userData.moteBase = pos.slice(0);
      }

      group.userData.kind = "detail";
      group.userData.detailType = type.id;
      group.userData.floatParts = floatParts;
      group.userData.pulseParts = pulseParts;
      group.userData.spinParts = spinParts;
      group.userData.animT = 0;
    },
  };

  /** Strong biome palette on spawned content so regions feel different */
  function applyBiomeTint(root, biome) {
    root.traverse((c) => {
      if (!c.isMesh || !c.material) return;
      const mats = Array.isArray(c.material) ? c.material : [c.material];
      mats.forEach((m) => {
        if (!m.color) return;
        const isGold = m.color.r > 0.85 && m.color.g > 0.55 && m.color.b < 0.35;
        if (isGold) {
          // lore crystals stay gold
          return;
        }
        const kind = root.userData.kind;
        if (kind === "path") {
          m.color.setHex(biome.path);
          if (m.emissive) m.emissive.setHex(biome.emissive);
          m.emissiveIntensity = Math.max(m.emissiveIntensity, 0.7);
        } else if (kind === "terrain") {
          m.color.setHex(biome.rock);
          m.roughness = biome.id === "emberVoid" ? 0.98 : 0.85;
        } else if (kind === "vegetation") {
          m.color.setHex(biome.plant);
          if (m.emissive) m.emissive.setHex(biome.plantEmissive);
          m.emissiveIntensity = Math.max(m.emissiveIntensity, 0.4);
        } else if (kind === "ruin") {
          m.color.setHex(biome.ruin);
          if (m.emissiveIntensity > 0.15 && m.emissive) {
            m.emissive.setHex(biome.emissive);
          }
        } else if (kind === "detail") {
          m.color.setHex(biome.color);
          if (m.emissive) m.emissive.setHex(biome.emissive);
          m.emissiveIntensity = Math.max(m.emissiveIntensity, 0.9);
        } else if (m.emissiveIntensity > 0.15) {
          m.color.setHex(biome.color);
          if (m.emissive) m.emissive.setHex(biome.emissive);
        }
      });
    });
  }

  // ---------------------------------------------------------------------------
  // ProceduralSpawner — coordinator
  // ---------------------------------------------------------------------------
  class ProceduralSpawner {
    constructor(scene, options) {
      this.scene = scene;
      this.scoreSys = new MeaningfulSprintScore();
      this.predictor = new TrajectoryPredictor();
      this.cooldown = 0;
      this.toastFn = (options && options.onReveal) || function () {};
      this.heightAt = (options && options.heightAt) || function () { return 0; };
      this.currentBiome = BIOMES.crystalNebula;
      this.biomeMix = { crystalNebula: 0.65, emberVoid: 0.25, whisperStars: 0.1 };
      this.stats = { spawned: 0, active: 0 };
      this._recent = [];
      this._recentMax = 100;
      this._fluxBoost = 0; // temporary density amp (howl / resonance events)

      this.pools = {
        path: new ObjectPool(createPathMesh, "path", 12),
        terrain: new ObjectPool(createTerrainMesh, "terrain", 18),
        vegetation: new ObjectPool(createVegetationMesh, "vegetation", 48),
        ruin: new ObjectPool(createRuinMesh, "ruin", 10),
        detail: new ObjectPool(createDetailMesh, "detail", 28),
      };
      // So pools can emergency-clear corridor solids using run yaw
      Object.keys(this.pools).forEach((k) => {
        this.pools[k]._owner = this;
      });
      this._lastYaw = 0;
      this.pathTypeStats = { hidden: 0, shortcut: 0, branch: 0, energy: 0 };
      this.terrainTypeStats = {
        boulders: 0, ridge: 0, crater: 0, cliff: 0, floater: 0, landmark: 0, canyon: 0,
      };
      this.vegTypeStats = {
        stalk: 0, flower: 0, bush: 0, vine: 0, cluster: 0, floater: 0, canopy: 0,
        tree: 0, megaTree: 0, spire: 0, forest: 0,
      };
      this._forestToastT = 0;
      this._sceneBand = "sparse";
      // Shared scene footprints so path/terrain co-author with forests
      this._sceneFootprints = [];
      this._sceneFootMax = 14;
      this._coopToastT = 0;
      this.ruinTypeStats = {
        monolith: 0, outpost: 0, tower: 0, arch: 0, platform: 0, temple: 0, wreck: 0,
      };
      this.detailTypeStats = {
        crystals: 0, vent: 0, shaft: 0, motes: 0, debris: 0, scorch: 0, residue: 0, footprints: 0,
      };
      this.pathCooldown = 0;
      this.terrainCooldown = 0;
      this.vegCooldown = 0;
      this.forestCooldown = 0;
      this.ruinCooldown = 0;
      this.detailCooldown = 0;

      Object.keys(this.pools).forEach((k) => {
        this.pools[k].free.forEach((e) => scene.add(e.mesh));
      });
    }

    /** External: howl / flux can spike generation */
    pulseFlux(amount) {
      this._fluxBoost = Math.min(1.5, this._fluxBoost + (amount || 0.6));
      this.cooldown = 0;
    }

    /** Register a forest / canyon footprint for path+terrain co-authorship */
    _registerSceneFootprint(fp) {
      if (!fp) return;
      this._sceneFootprints.push({
        kind: fp.kind || "forest",
        x: fp.x,
        z: fp.z,
        radius: fp.radius || 16,
        yaw: fp.yaw || 0,
        corridor: fp.corridor != null ? fp.corridor : 3.4,
        band: fp.band || "high",
        biomeId: fp.biomeId || "crystalNebula",
        age: 0,
        maxAge: fp.maxAge != null ? fp.maxAge : 22,
        pathDone: false,
        terrainDone: 0,
        ruinDone: false,
      });
      while (this._sceneFootprints.length > this._sceneFootMax) {
        this._sceneFootprints.shift();
      }
    }

    _tickSceneFootprints(dt) {
      for (let i = this._sceneFootprints.length - 1; i >= 0; i--) {
        this._sceneFootprints[i].age += dt;
        if (this._sceneFootprints[i].age > this._sceneFootprints[i].maxAge) {
          this._sceneFootprints.splice(i, 1);
        }
      }
    }

    /** Nearest living footprint ahead of Bolt (prefer forests still needing path/terrain/ruin) */
    _findSceneAhead(origin, yaw, opts) {
      opts = opts || {};
      const fx = Math.sin(yaw);
      const fz = Math.cos(yaw);
      const maxDist = opts.maxDist != null ? opts.maxDist : 90;
      const needPath = !!opts.needPath;
      const needTerrain = !!opts.needTerrain;
      const needRuin = !!opts.needRuin;
      let best = null;
      let bestScore = -1e9;
      for (let i = 0; i < this._sceneFootprints.length; i++) {
        const s = this._sceneFootprints[i];
        if (needPath && s.pathDone) continue;
        if (needTerrain && s.terrainDone >= 2) continue;
        if (needRuin && s.ruinDone) continue;
        const dx = s.x - origin.x;
        const dz = s.z - origin.z;
        const dist = Math.hypot(dx, dz);
        // Prefer scenes well ahead of Bolt (not underfoot)
        if (dist > maxDist || dist < CLEAR.player * 0.9) continue;
        const ahead = dx * fx + dz * fz;
        if (ahead < 8) continue; // must be clearly forward
        const lateral = Math.abs(-dz * fx + dx * fz);
        const score = ahead * 1.4 - dist * 0.35 - lateral * 0.2 - s.age * 0.15;
        if (score > bestScore) {
          bestScore = score;
          best = s;
        }
      }
      return best;
    }

    _tooClose(x, z, minDist) {
      for (let i = 0; i < this._recent.length; i++) {
        const r = this._recent[i];
        const dx = r.x - x;
        const dz = r.z - z;
        if (dx * dx + dz * dz < minDist * minDist) return true;
      }
      return false;
    }

    _remember(x, z) {
      this._recent.push({ x: x, z: z, t: performance.now() });
      if (this._recent.length > this._recentMax) this._recent.shift();
    }

    /**
     * Keep a clear bubble around Bolt — content spawns AROUND him, never on him.
     * Surface feels dense but the run corridor stays open.
     */
    _tooCloseToPlayer(x, z, minDist) {
      const p = this._lastPlayerPos;
      if (!p || minDist <= 0) return false;
      const dx = x - p.x;
      const dz = z - p.z;
      return dx * dx + dz * dz < minDist * minDist;
    }

    /**
     * True if (x,z) sits in Bolt's run lane (forward corridor).
     * Rocks/forests/ruins must stay OUT of this so Bolt stays visible.
     */
    _inRunCorridor(x, z, yaw, halfWidth, maxAhead, maxBehind) {
      const p = this._lastPlayerPos;
      if (!p) return false;
      const hw = halfWidth != null ? halfWidth : CLEAR.corridorHalf;
      const ahead = maxAhead != null ? maxAhead : CLEAR.corridorAhead;
      const behind = maxBehind != null ? maxBehind : CLEAR.corridorBehind;
      const dx = x - p.x;
      const dz = z - p.z;
      const fx = Math.sin(yaw);
      const fz = Math.cos(yaw);
      const rx = Math.cos(yaw);
      const rz = -Math.sin(yaw);
      const along = dx * fx + dz * fz;
      const side = dx * rx + dz * rz;
      if (along < -behind || along > ahead) return false;
      return Math.abs(side) < hw;
    }

    /**
     * Count live landmark/canyon terrain (cap spam that buries Bolt).
     */
    _countLandmarks() {
      const pool = this.pools.terrain;
      if (!pool || !pool.live) return 0;
      let n = 0;
      for (let i = 0; i < pool.live.length; i++) {
        const e = pool.live[i];
        if (e && e.mesh && e.mesh.userData && e.mesh.userData.landmark) n++;
      }
      return n;
    }

    /**
     * Place a spawn around Bolt: mostly SIDE + SIDE-FORWARD, never on him.
     * Dead-ahead and underfoot are avoided so Bolt is never hidden.
     * @returns {{x,z}|null}
     */
    _placeAround(origin, yaw, opts) {
      opts = opts || {};
      const orbital = !!opts.orbital;
      const minR = opts.minR != null ? opts.minR : orbital ? 28 : CLEAR.player;
      const maxR = opts.maxR != null ? opts.maxR : orbital ? 90 : CLEAR.player + 30;
      const preferSide = opts.preferSide !== false;
      const fx = Math.sin(yaw);
      const fz = Math.cos(yaw);
      const rx = Math.cos(yaw);
      const rz = -Math.sin(yaw);
      const ox = origin.x;
      const oz = origin.z;
      const stackMin = opts.stackMin != null ? opts.stackMin : 4;
      // Hard personal bubble — never spawn inside this radius of Bolt
      const clearR =
        opts.clearR != null
          ? Math.max(opts.clearR, CLEAR.player * 0.85)
          : Math.max(minR, CLEAR.player);
      // Run lane half-width — block clutter on the path Bolt is sprinting
      const corridorHalf =
        opts.corridorHalf != null
          ? opts.corridorHalf
          : orbital
            ? 0
            : CLEAR.corridorHalf;
      const blockCorridor = opts.blockCorridor !== false && !orbital;

      const strictSides = opts.strictSides !== false && !orbital; // solids: pure flanks only
      for (let attempt = 0; attempt < 24; attempt++) {
        const r = minR + Math.random() * Math.max(0.5, maxR - minR);
        let ang;
        if (preferSide && !orbital) {
          const sideSign = Math.random() > 0.5 ? 1 : -1;
          if (strictSides || opts.solid) {
            // GOLDEN RULE: rocks/trees/ruins on SIDES of the path only
            // ~75–105° off heading (never on the highway)
            ang = sideSign * (Math.PI * 0.5 + (Math.random() - 0.5) * 0.28);
          } else {
            const mode = Math.random();
            if (mode < 0.65) {
              ang = sideSign * (Math.PI * 0.5 + (Math.random() - 0.5) * 0.35);
            } else {
              // side-forward only for light details
              ang = sideSign * (0.85 + Math.random() * 0.4);
            }
          }
        } else {
          // Orbital: wide ring, avoid exact underfoot
          ang = (Math.random() - 0.5) * Math.PI * 1.5;
          if (Math.abs(ang) < 0.25) ang = (ang >= 0 ? 1 : -1) * 0.4;
        }
        const localFwd = Math.cos(ang) * r;
        const localSide = Math.sin(ang) * r;
        let x = ox + fx * localFwd + rx * localSide;
        let z = oz + fz * localFwd + rz * localSide;
        const jit = opts.jitter != null ? opts.jitter : orbital ? 4 : 1.8;
        x += (Math.random() - 0.5) * jit;
        z += (Math.random() - 0.5) * jit;

        if (this._tooCloseToPlayer(x, z, clearR)) continue;
        if (
          blockCorridor &&
          this._inRunCorridor(
            x,
            z,
            yaw,
            corridorHalf,
            CLEAR.corridorAhead,
            CLEAR.corridorBehind
          )
        ) {
          continue;
        }
        if (this._tooClose(x, z, stackMin)) continue;
        return { x: x, z: z };
      }
      return null;
    }

    /**
     * Choose generator from biome weights + score scaling
     */
    _pickKind(biome, density) {
      const w = biome.weights;
      const st = this._scaleStage || "paw";
      const orbital = st === "orbital" || st === "solar" || st === "cosmic";
      // Surface: path + dense veg + ruins; Orbital: ruin + path
      let scale;
      if (orbital) {
        scale = {
          path: 1.35 + density * 0.5,
          terrain: 0.45 + density * 0.2,
          vegetation: 0,
          ruin: 1.5 + density * 0.55,
          detail: 0.25 + density * 0.15,
        };
      } else {
        scale = {
          path: w.path * (1.1 + density * 0.7),
          terrain: w.terrain * (0.85 + (1 - density) * 0.25),
          vegetation: w.vegetation * (1.35 + density * 1.1),
          ruin: w.ruin * (0.7 + density * 1.2),
          detail: w.detail * (0.75 + density * 1.0),
        };
      }
      let total = scale.path + scale.terrain + scale.vegetation + scale.ruin + scale.detail;
      let r = Math.random() * total;
      if ((r -= scale.path) < 0) return "path";
      if ((r -= scale.terrain) < 0) return "terrain";
      if ((r -= scale.vegetation) < 0) return "vegetation";
      if ((r -= scale.ruin) < 0) return "ruin";
      return "detail";
    }

    _spawnOne(kind, pred, yaw, density, biome, resonance) {
      if (this.stats.active >= MAX_ACTIVE) return false;
      const pool = this.pools[kind];
      if (!pool) return false;

      // ----- PATH GENERATOR -----
      if (kind === "path") {
        return this._spawnPath(pred, yaw, density, biome, resonance, pool, this._lastPlayerPos);
      }
      // ----- TERRAIN FEATURE GENERATOR -----
      if (kind === "terrain") {
        return this._spawnTerrain(pred, yaw, density, biome, resonance, pool, this._lastPlayerPos);
      }
      // ----- VEGETATION GENERATOR -----
      if (kind === "vegetation") {
        return this._spawnVegetation(pred, yaw, density, biome, resonance, pool, this._lastPlayerPos);
      }
      // ----- RUIN GENERATOR -----
      if (kind === "ruin") {
        return this._spawnRuin(pred, yaw, density, biome, resonance, pool, this._lastPlayerPos);
      }
      // ----- DETAIL GENERATOR -----
      if (kind === "detail") {
        return this._spawnDetail(pred, yaw, density, biome, resonance, pool, this._lastPlayerPos);
      }

      return false;
    }

    /**
     * DetailGenerator — micro atmosphere around predicted path
     * High frequency · particle-heavy · brighter with Resonance
     */
    _spawnDetail(pred, yaw, density, biome, resonance, pool, playerPos) {
      const st = this._scaleStage || "paw";
      const orbital = st === "orbital" || st === "solar" || st === "cosmic";
      // Cap details — high dens should feel spacious, not particle spam
      if (pool.activeCount >= (orbital ? 14 : SPAWN_BUDGET.detailCap)) return false;
      if (this.detailCooldown > 0 && density < (orbital ? 0.4 : 0.55)) return false;

      // Spawn AHEAD of Bolt (predicted), never centered on him
      const origin = pred || playerPos;
      // Small decorative only: sides ok, never solid-block the highway
      const placed = this._placeAround(origin, yaw, {
        orbital: orbital,
        minR: orbital ? 28 : CLEAR.detailMin,
        maxR: orbital ? 80 : CLEAR.detailMax + density * 8,
        preferSide: true,
        solid: false,
        strictSides: false,
        clearR: orbital ? 24 : CLEAR.detailClear,
        corridorHalf: orbital ? 0 : CLEAR.corridorHalf * 0.55, // thin glow on path edge ok
        blockCorridor: !orbital,
        stackMin: orbital ? 14 : 7,
        jitter: orbital ? 5 : 2.2,
      });
      if (!placed) return false;
      const x = placed.x;
      const z = placed.z;
      if (!orbital && this._tooCloseToPlayer(x, z, CLEAR.player)) return false;

      const surface = this.heightAt(x, z);
      const e = pool.acquire();
      if (!e) return false;

      // Orbital: glowing clouds / motes / shafts — not footprints
      let typeDef = pickDetailType(density, biome.id, resonance);
      if (orbital) {
        const roll = Math.random();
        if (roll < 0.4) typeDef = DETAIL_TYPES.motes || typeDef;
        else if (roll < 0.7) typeDef = DETAIL_TYPES.shaft || typeDef;
        else if (roll < 0.9) typeDef = DETAIL_TYPES.crystals || typeDef;
        else typeDef = DETAIL_TYPES.debris || typeDef;
      }
      if (this.detailTypeStats[typeDef.id] != null) this.detailTypeStats[typeDef.id]++;

      DetailGenerator.layout(e.mesh, {
        typeDef: typeDef,
        biome: biome,
        density: density * (orbital ? 1.2 : 1),
        resonance: resonance || 0,
        seed: Math.random() * 300,
        orbital: orbital,
      });

      const scale = orbital
        ? 2.8 + density * 1.8 + resonance * 0.6
        : 0.85 + density * 0.7 + resonance * 0.35;
      const life = 8 + density * 8 + resonance * 5 + Math.random() * 4 + (orbital ? 8 : 0);

      let y = surface;
      if (orbital) {
        const baseAlt = st === "cosmic" ? 48 : st === "solar" ? 36 : 24;
        y = Math.max(origin.y, surface) + baseAlt * 0.5 + Math.random() * 28;
      }

      e.active = true;
      e.age = 0;
      e.life = life;
      e.fade = orbital ? 0.5 : 0.35;
      e.fadingOut = false;
      e.baseScale = scale;
      e.homeY = y;
      e.mesh.position.set(x, y, z);
      e.mesh.rotation.y = Math.random() * Math.PI * 2;
      e.mesh.scale.setScalar(scale * (orbital ? 0.55 : 0.4));
      e.mesh.visible = true;
      e.mesh.traverse((c) => {
        if (c.material) {
          const mats = Array.isArray(c.material) ? c.material : [c.material];
          mats.forEach((m) => {
            m.transparent = true;
            const base = m.userData.baseOpacity != null ? m.userData.baseOpacity : 1;
            m.opacity = (orbital ? 0.5 : 0.35) * base;
            m.depthWrite = false;
          });
        }
      });
      e.mesh.userData.kind = "detail";
      e.mesh.userData.detailType = typeDef.id;

      this.detailCooldown = orbital
        ? THREE.MathUtils.lerp(1.1, 0.45, Math.min(1, density + resonance * 0.3))
        : THREE.MathUtils.lerp(0.28, 0.12, Math.min(1, density + resonance * 0.4));
      // At high speed, SLOW details further (less clutter in view)
      if (!orbital && density > 0.55) this.detailCooldown *= 1.35 + density * 0.4;

      this._remember(x, z);
      this.stats.spawned++;
      return true;
    }

    /**
     * RuinGenerator — ancient modular landmarks ahead of Bolt
     * coop: { forceGrove, preferTemple } — nest ruin in forest footprint (temple at grove edge)
     */
    _spawnRuin(pred, yaw, density, biome, resonance, pool, playerPos, coop) {
      coop = coop || null;
      if (pool.activeCount >= (SPAWN_BUDGET.ruinCap + 1)) return false;
      if (this.ruinCooldown > 0 && !(coop && coop.forceGrove)) return false;

      const st = this._scaleStage || "paw";
      const orbital =
        st === "orbital" || st === "solar" || st === "cosmic";

      // Ruins spawn far ahead on flanks
      const origin = pred || playerPos;
      const kit = sceneKit(density, biome.id);
      const scene =
        !orbital &&
        this._findSceneAhead(origin, yaw, {
          maxDist: 110,
          needRuin: !(coop && coop.forceGrove),
        });
      // Force: any forest ahead even if ruin already marked
      const sceneForce =
        !orbital &&
        coop &&
        coop.forceGrove &&
        this._findSceneAhead(origin, yaw, { maxDist: 110, needRuin: false });
      const useScene = sceneForce || scene;

      let x;
      let z;
      let nestGrove = false;

      // Nest ruin at forest edge — off run corridor, facing path into grove
      if (useScene && !orbital) {
        nestGrove = true;
        const sfx = Math.sin(useScene.yaw);
        const sfz = Math.cos(useScene.yaw);
        const srx = Math.cos(useScene.yaw);
        const srz = -Math.sin(useScene.yaw);
        // Prefer edge of canopy (slightly inside radius) on a flank of the corridor
        const side = Math.random() < 0.5 ? -1 : 1;
        const edgeR = useScene.radius * (0.55 + Math.random() * 0.28);
        const along = useScene.radius * (0.15 + Math.random() * 0.45); // toward far side of grove
        const sideOff = side * (useScene.corridor * 1.15 + 4 + Math.random() * 5);
        x = useScene.x + sfx * along + srx * sideOff;
        z = useScene.z + sfz * along + srz * sideOff;
        // Safety: not on Bolt, not in run lane
        if (
          this._tooCloseToPlayer(x, z, CLEAR.ruinNestPlayer) ||
          this._inRunCorridor(
            x,
            z,
            yaw,
            CLEAR.corridorHalf,
            CLEAR.corridorAhead,
            CLEAR.corridorBehind
          )
        ) {
          // Fall back to opposite flank
          x = useScene.x + sfx * along - srx * sideOff;
          z = useScene.z + sfz * along - srz * sideOff;
          if (
            this._tooCloseToPlayer(x, z, CLEAR.ruinNestPlayer) ||
            this._inRunCorridor(
              x,
              z,
              yaw,
              CLEAR.corridorHalf,
              CLEAR.corridorAhead,
              CLEAR.corridorBehind
            )
          ) {
            nestGrove = false;
          }
        }
      }

      if (!nestGrove) {
        // Distant flank ruins (default) — never hide Bolt
        const placed = this._placeAround(origin, yaw, {
          orbital: orbital,
          minR: orbital ? 120 : CLEAR.ruinDistantMin,
          maxR: orbital ? 300 : 200,
          preferSide: true,
          solid: true,
          strictSides: true,
          clearR: orbital ? 100 : CLEAR.ruinDistantClear,
          corridorHalf: orbital ? 0 : CLEAR.corridorHalf + 4,
          blockCorridor: !orbital,
          stackMin: orbital ? 95 : 80,
          jitter: orbital ? 10 : 5,
        });
        if (!placed) return false;
        x = placed.x;
        z = placed.z;
      }

      const surface = this.heightAt(x, z);
      if (!orbital) {
        const hN = this.heightAt(x + 4, z);
        const hE = this.heightAt(x, z + 4);
        if (Math.abs(hN - surface) > 2.8 || Math.abs(hE - surface) > 2.8) {
          if (nestGrove) {
            // Still place grove ruins on mild slopes
          } else {
            return false;
          }
        }
      }

      const e = pool.acquire();
      if (!e) return false;

      // Grove nest: temple complexes · Orbital: stations · else default pick
      let typeDef;
      if (nestGrove) {
        typeDef = pickGroveRuinType(density, biome.id, resonance, kit);
        if (coop && coop.preferTemple && Math.random() < 0.75) {
          typeDef = RUIN_TYPES.temple;
        }
      } else if (orbital) {
        const roll = Math.random();
        if (roll < 0.3) typeDef = RUIN_TYPES.platform;
        else if (roll < 0.5) typeDef = RUIN_TYPES.wreck;
        else if (roll < 0.7) typeDef = RUIN_TYPES.temple;
        else if (roll < 0.85) typeDef = RUIN_TYPES.tower;
        else typeDef = RUIN_TYPES.arch;
      } else {
        typeDef = pickRuinType(density, biome.id, resonance);
      }
      if (this.ruinTypeStats[typeDef.id] != null) this.ruinTypeStats[typeDef.id]++;

      // Slight density boost for grove temples so modular layout is richer
      const layoutDens = nestGrove
        ? Math.min(1.35, density * 1.15 + 0.15)
        : density;

      RuinGenerator.layout(e.mesh, {
        typeDef: typeDef,
        biome: biome,
        density: layoutDens,
        resonance: resonance || 0,
        seed: Math.random() * 200,
        orbital: orbital,
        groveNest: nestGrove,
      });

      let y = surface;
      if (orbital) {
        // Floating sky ruins — visible from orbit
        const baseAlt = st === "cosmic" ? 55 : st === "solar" ? 42 : 28;
        y = Math.max(origin.y, surface) + baseAlt + Math.random() * 35;
      } else if (typeDef.id === "platform" && biome.id === "whisperStars") {
        y = surface + 0.4;
      } else if (typeDef.id === "wreck" || Math.random() < 0.25) {
        y = surface - 0.2;
      }

      const scale =
        (orbital ? 3.6 : nestGrove ? 2.2 : 2.4) +
        density * (orbital ? 2.2 : nestGrove ? 1.15 : 1.4) +
        (typeDef.id === "temple" ? nestGrove ? 1.15 : 1.4 : 0) +
        (typeDef.id === "monolith" || typeDef.id === "tower" ? 0.8 : 0);
      const life =
        20 +
        density * 14 +
        resonance * 6 +
        (orbital ? 10 : 0) +
        (nestGrove ? 8 : 0);

      e.active = true;
      e.age = 0;
      e.life = life;
      e.fade = nestGrove ? 0.28 : 0.15;
      e.fadingOut = false;
      e.baseScale = scale;
      e.homeY = y;
      e.mesh.position.set(x, y, z);
      // Face toward forest center / run path so temple reads as grove landmark
      if (nestGrove && useScene) {
        e.mesh.rotation.y =
          Math.atan2(useScene.x - x, useScene.z - z) + (Math.random() - 0.5) * 0.35;
      } else {
        e.mesh.rotation.y = yaw + (Math.random() - 0.5) * 0.9;
      }
      if (orbital) e.mesh.rotation.z = (Math.random() - 0.5) * 0.35;
      e.mesh.scale.setScalar(scale * (nestGrove ? 0.32 : 0.25));
      e.mesh.visible = true;
      e.mesh.traverse((c) => {
        if (c.material) {
          const mats = Array.isArray(c.material) ? c.material : [c.material];
          mats.forEach((m) => {
            m.transparent = true;
            const base = m.userData.baseOpacity != null ? m.userData.baseOpacity : 1;
            m.opacity = (nestGrove ? 0.22 : 0.15) * base;
            m.depthWrite = false;
          });
        }
      });
      e.mesh.userData.kind = "ruin";
      e.mesh.userData.ruinType = typeDef.id;
      e.mesh.userData.groveNest = nestGrove;
      e.mesh.userData.sceneBand = useScene ? useScene.band : null;

      if (useScene && nestGrove) {
        useScene.ruinDone = true;
      }

      this.ruinCooldown = orbital
        ? THREE.MathUtils.lerp(1.4, 0.45, Math.min(1, density + resonance * 0.3))
        : nestGrove
          ? THREE.MathUtils.lerp(1.1, 0.45, Math.min(1, density)) + Math.random() * 0.25
          : THREE.MathUtils.lerp(1.6, 0.55, Math.min(1, density + resonance * 0.3)) +
            Math.random() * 0.35;
      if (resonance > 0.5) this.ruinCooldown *= 0.65;

      this._remember(x, z);
      this.stats.spawned++;
      return true;
    }

    /**
     * Active landmarks for Intention destinations (ruins, paths with energy)
     * Returns array of { x, y, z, kind, type, hasLoot, mesh, dist }
     */
    /**
     * Highest walkable structure top at (x,z) that the player can reach.
     * playerY used so elevated platforms don't snap you from far below.
     * Returns number or null.
     */
    sampleWalkTop(x, z, playerY) {
      let best = null;
      const py = playerY != null ? playerY : 1e9;
      const stepUp = 2.6;
      const dropOnto = 5.0;
      const kinds = ["ruin", "terrain"];
      for (let k = 0; k < kinds.length; k++) {
        const pool = this.pools[kinds[k]];
        if (!pool || !pool.live) continue;
        for (let i = 0; i < pool.live.length; i++) {
          const e = pool.live[i];
          if (!e || !e.active || !e.mesh || !e.mesh.visible) continue;
          if (e.fade < 0.45) continue;
          const mp = e.mesh.position;
          const dx = mp.x - x;
          const dz = mp.z - z;
          if (dx * dx + dz * dz > 55 * 55) continue;
          const sc = e.mesh.scale.x || 1;
          const ry = e.mesh.rotation.y || 0;
          const cy = Math.cos(ry);
          const sy = Math.sin(ry);
          const walks = e.mesh.userData.walkColliders;
          if (walks && walks.length) {
            for (let w = 0; w < walks.length; w++) {
              const c = walks[w];
              const lx = (c.lx || 0) * sc;
              const lz = (c.lz || 0) * sc;
              const wx = mp.x + lx * cy - lz * sy;
              const wz = mp.z + lx * sy + lz * cy;
              const half = (c.half != null ? c.half : 2) * sc;
              if (Math.abs(x - wx) > half || Math.abs(z - wz) > half) continue;
              const top = mp.y + (c.top != null ? c.top : 0.5) * sc;
              if (py + stepUp >= top && py - dropOnto <= top + 0.6) {
                if (best == null || top > best) best = top;
              }
            }
          } else {
            // Fallback AABB top
            if (!this._tmpBox) this._tmpBox = new THREE.Box3();
            this._tmpBox.setFromObject(e.mesh);
            const b = this._tmpBox;
            if (x < b.min.x || x > b.max.x || z < b.min.z || z > b.max.z) continue;
            const top = b.max.y;
            if (py + stepUp >= top && py - dropOnto <= top + 0.6) {
              if (best == null || top > best) best = top;
            }
          }
        }
      }
      return best;
    }

    /**
     * Push player out of solid structure walls. Mutates pos + returns impact info.
     * pos: {x,y,z}, vel: THREE.Vector3 optional
     */
    resolveWallCollision(pos, radius, vel) {
      radius = radius != null ? radius : 0.85;
      let hit = null;
      let impact = 0;
      const kinds = ["ruin", "terrain"];
      for (let k = 0; k < kinds.length; k++) {
        const pool = this.pools[kinds[k]];
        if (!pool || !pool.live) continue;
        for (let i = 0; i < pool.live.length; i++) {
          const e = pool.live[i];
          if (!e || !e.active || !e.mesh || !e.mesh.visible) continue;
          if (e.fade < 0.5) continue;
          const mp = e.mesh.position;
          const dx0 = mp.x - pos.x;
          const dz0 = mp.z - pos.z;
          if (dx0 * dx0 + dz0 * dz0 > 50 * 50) continue;
          const sc = e.mesh.scale.x || 1;
          const ry = e.mesh.rotation.y || 0;
          const cy = Math.cos(ry);
          const sy = Math.sin(ry);
          const walls = e.mesh.userData.wallColliders;
          if (!walls || !walls.length) continue;
          for (let w = 0; w < walls.length; w++) {
            const c = walls[w];
            const lx = (c.lx || 0) * sc;
            const lz = (c.lz || 0) * sc;
            const wx = mp.x + lx * cy - lz * sy;
            const wz = mp.z + lx * sy + lz * cy;
            const y0 = mp.y + (c.y0 != null ? c.y0 : 0) * sc;
            const y1 = mp.y + (c.y1 != null ? c.y1 : 2) * sc;
            // Standing on top: skip wall push (handled by walk top)
            if (pos.y >= y1 - 0.35) continue;
            if (pos.y + 1.4 < y0 || pos.y > y1) continue;
            const halfX = ((c.halfX != null ? c.halfX : c.half) || 1.2) * sc + radius;
            const halfZ = ((c.halfZ != null ? c.halfZ : c.half) || 1.2) * sc + radius;
            const dx = pos.x - wx;
            const dz = pos.z - wz;
            if (Math.abs(dx) > halfX || Math.abs(dz) > halfZ) continue;
            // Push out along smallest penetration axis
            const penX = halfX - Math.abs(dx);
            const penZ = halfZ - Math.abs(dz);
            let pushX = 0;
            let pushZ = 0;
            if (penX < penZ) {
              pushX = (dx >= 0 ? 1 : -1) * penX;
            } else {
              pushZ = (dz >= 0 ? 1 : -1) * penZ;
            }
            pos.x += pushX;
            pos.z += pushZ;
            if (vel) {
              // Kill velocity into the wall
              if (pushX !== 0) {
                if (pushX * vel.x < 0) {
                  impact = Math.max(impact, Math.abs(vel.x));
                  vel.x *= -0.15;
                }
              }
              if (pushZ !== 0) {
                if (pushZ * vel.z < 0) {
                  impact = Math.max(impact, Math.abs(vel.z));
                  vel.z *= -0.15;
                }
              }
            }
            hit = {
              kind: kinds[k],
              type:
                (e.mesh.userData.ruinType || e.mesh.userData.terrainType || "solid"),
              impact: impact,
            };
          }
        }
      }
      if (hit) hit.impact = impact;
      return hit;
    }

    getLandmarks(playerPos) {
      const list = [];
      const px = playerPos.x;
      const pz = playerPos.z;
      const ruinPool = this.pools.ruin;
      if (ruinPool) {
        for (let i = 0; i < ruinPool.live.length; i++) {
          const e = ruinPool.live[i];
          if (!e.active || !e.mesh.visible) continue;
          const p = e.mesh.position;
          const dist = Math.hypot(p.x - px, p.z - pz);
          list.push({
            x: p.x,
            y: p.y + 6 * (e.baseScale || 2),
            z: p.z,
            kind: "ruin",
            type: e.mesh.userData.ruinType || "ruin",
            hasLoot: !!(e.mesh.userData.hasLoot && !e.mesh.userData.lootTaken),
            mesh: e.mesh,
            dist: dist,
            entity: e,
          });
        }
      }
      const pathPool = this.pools.path;
      if (pathPool) {
        for (let i = 0; i < pathPool.live.length; i++) {
          const e = pathPool.live[i];
          if (!e.active || !e.mesh.visible) continue;
          const p = e.mesh.position;
          const dist = Math.hypot(p.x - px, p.z - pz);
          if (dist > 80) continue;
          list.push({
            x: p.x,
            y: p.y + 2,
            z: p.z,
            kind: "path",
            type: e.mesh.userData.pathType || "path",
            hasLoot: false,
            mesh: e.mesh,
            dist: dist,
            entity: e,
          });
        }
      }
      list.sort(function (a, b) { return a.dist - b.dist; });
      return list;
    }

    /**
     * Claim Star Core fragment / Resonance loot when Bolt runs through a ruin.
     * Returns { type, power, core, resonance } or null.
     */
    claimRuinLoot(playerPos) {
      const pool = this.pools.ruin;
      if (!pool) return null;
      for (let i = 0; i < pool.live.length; i++) {
        const e = pool.live[i];
        if (!e.active || !e.mesh.visible) continue;
        const ud = e.mesh.userData;
        if (!ud.hasLoot || ud.lootTaken) continue;
        const dx = e.mesh.position.x - playerPos.x;
        const dz = e.mesh.position.z - playerPos.z;
        const dist = Math.hypot(dx, dz);
        // Large footprint — claim from far edge of mega-ruin
        const claimR = (ud.ruinRadius || 5) * (e.baseScale || 2.5) * 0.85 + 4;
        if (dist > claimR) continue;

        ud.lootTaken = true;
        // Hide loot meshes
        e.mesh.traverse((c) => {
          if (c.userData && c.userData.isLoot) c.visible = false;
        });
        const power = ud.lootPower || 0.1;
        const biome = this.currentBiome || {};
        return {
          type: ud.ruinType || "ruin",
          power: power,
          core: 4 + power * 40,
          resonance: 0.06 + power * 0.5,
          biomeId: biome.id || "crystalNebula",
          biomeName: biome.name || biome.short || "Unknown Region",
        };
      }
      return null;
    }

    /**
     * VegetationGenerator — clusters + multi-layer forest systems (high density bands).
     * Avoids path center; flanks routes; density band drives scene kits.
     */
    _countVegKinds() {
      const pool = this.pools.vegetation;
      let forest = 0;
      let big = 0;
      let small = 0;
      if (!pool || !pool.live) return { forest: 0, big: 0, small: 0, total: 0 };
      for (let i = 0; i < pool.live.length; i++) {
        const ae = pool.live[i];
        if (!ae || !ae.active || !ae.mesh || !ae.mesh.userData) continue;
        const t = ae.mesh.userData.vegType;
        if (t === "forest") forest++;
        else if (t === "tree" || t === "megaTree" || t === "spire" || t === "canopy") big++;
        else small++;
      }
      return { forest: forest, big: big, small: small, total: forest + big + small };
    }

    _spawnVegetation(pred, yaw, density, biome, resonance, pool, playerPos) {
      // Vegetation doesn't make sense in orbit
      const st = this._scaleStage || "paw";
      if (st === "orbital" || st === "solar" || st === "cosmic") return false;
      if (pool.activeCount >= SPAWN_BUDGET.vegCap) return false;

      // Separate cooldowns: forests stay rare; small plants can spray more
      const forestCd = this.forestCooldown || 0;
      const smallCd = this.vegCooldown || 0;

      // Spawn around predicted position (ahead), not under Bolt
      const origin = pred || playerPos;
      const kit = sceneKit(density, biome.id);
      this._sceneBand = kit.band;
      const counts = this._countVegKinds();

      // Domain-warped forest field + light fbm freckle for micro decisions
      const noiseSample = fbm(origin.x * 0.04 + this.stats.spawned * 0.1, origin.z * 0.04, 3);
      const forestField = forestDensityNear(
        origin.x,
        origin.z,
        biome.id,
        density,
        yaw
      );
      // Sparse biomes / clearings skip more often (small plants less strict)
      const clearThresh =
        biome.id === "whisperStars"
          ? 0.42
          : biome.id === "frostGlacier"
            ? 0.38
            : biome.id === "emberVoid"
              ? 0.28
              : 0.22;
      // Domain-warp density needed to open a full forest system
      const forestDensMin =
        biome.id === "emberVoid" ? 0.3 : biome.id === "whisperStars" ? 0.36 : 0.32;

      // Full forests only when cooldown ready, under cap, and density field is a thicket
      const forestCap =
        kit.band === "veryHigh"
          ? SPAWN_BUDGET.forestCap
          : kit.band === "high"
            ? Math.max(2, SPAWN_BUDGET.forestCap - 1)
            : 2;
      const wantForest =
        forestCd <= 0 &&
        counts.forest < forestCap &&
        kit.preferForest &&
        Math.random() < kit.forestChance &&
        forestField >= forestDensMin &&
        noiseSample > clearThresh * 0.55;

      let typeDef;
      if (wantForest) {
        typeDef = VEG_TYPES.forest;
      } else {
        if (smallCd > 0) return false;
        // Prefer ground flora — big solo trees only if under bigVegCap
        const preferSmall =
          counts.big >= SPAWN_BUDGET.bigVegCap || Math.random() < 0.75;
        // Domain-warp clearings: fewer plants in open pockets
        if (forestField < 0.22 && density < 0.6 && Math.random() < 0.5) {
          this.vegCooldown = 0.06;
          return false;
        }
        if (noiseSample < clearThresh && density < 0.55 && Math.random() < 0.4) {
          this.vegCooldown = 0.06;
          return false;
        }
        typeDef = pickVegType(density, biome.id, noiseSample, preferSmall);
        // Enforce big solo cap
        const tid = typeDef.id;
        if (
          (tid === "tree" || tid === "megaTree" || tid === "spire" || tid === "canopy") &&
          counts.big >= SPAWN_BUDGET.bigVegCap
        ) {
          typeDef = pickVegType(density, biome.id, noiseSample, true);
        }
      }

      const isForestFinal = typeDef.id === "forest";
      const isBigSolo =
        typeDef.id === "tree" ||
        typeDef.id === "megaTree" ||
        typeDef.id === "spire" ||
        typeDef.id === "canopy";
      const isBig = isForestFinal || isBigSolo;

      // Forests / big trees stay far on pure flanks; small flora can line the road
      const forestR = kit.forestRadius || 16;
      const forestMinR = Math.max(
        CLEAR.forestMin,
        CLEAR.forestClear + forestR * 0.95
      );
      const smallMinR = Math.max(CLEAR.player + 2, 30);
      const placed = this._placeAround(origin, yaw, {
        orbital: false,
        minR: isForestFinal
          ? forestMinR
          : isBigSolo
            ? CLEAR.vegBigMin
            : smallMinR,
        maxR: isForestFinal
          ? Math.max(CLEAR.forestMax, forestMinR + 25) + density * 16
          : isBigSolo
            ? 75 + density * 12
            : 58 + density * 16,
        preferSide: true,
        solid: isBig, // big = pure 90° flanks; small plants may sit side-forward
        strictSides: isBig,
        clearR: isForestFinal
          ? forestMinR
          : isBigSolo
            ? CLEAR.vegBigClear
            : CLEAR.player,
        corridorHalf: isForestFinal
          ? CLEAR.corridorHalf + 6
          : isBigSolo
            ? CLEAR.corridorHalf + 3
            : CLEAR.corridorHalf * 0.85, // small plants hug path edges
        blockCorridor: true,
        stackMin: isForestFinal ? 34 + forestR * 0.35 : isBigSolo ? 22 : 4.5,
        jitter: isForestFinal ? 4 : isBigSolo ? 2.4 : 2.8,
      });
      if (!placed) return false;
      const corridorW = isForestFinal
        ? CLEAR.corridorHalf + 6
        : isBigSolo
          ? CLEAR.corridorHalf + 3
          : CLEAR.corridorHalf * 0.85;
      if (
        this._tooCloseToPlayer(placed.x, placed.z, CLEAR.player) ||
        this._inRunCorridor(
          placed.x,
          placed.z,
          yaw,
          corridorW,
          CLEAR.corridorAhead,
          CLEAR.corridorBehind
        )
      ) {
        return false;
      }
      const x = placed.x;
      const z = placed.z;

      // Forests only land on domain-warped thickets (not random flanks)
      if (isForestFinal) {
        const spotDens = forestDensity(x, z, biome.id, density);
        if (spotDens < forestDensMin) {
          // Open clearing / weak field — skip this forest (keep path + world clean)
          this.forestCooldown = 0.12;
          return false;
        }
      }

      const surface = this.heightAt(x, z);
      // Simple slope check — skip very steep (height delta nearby)
      const h2 = this.heightAt(x + 1.5, z + 1.5);
      if (Math.abs(h2 - surface) > (isForestFinal ? 3.4 : 2.8)) return false;

      const e = pool.acquire();
      if (!e) return false;

      if (this.vegTypeStats[typeDef.id] != null) this.vegTypeStats[typeDef.id]++;

      VegetationGenerator.layout(e.mesh, {
        typeDef: typeDef,
        biome: biome,
        density: density,
        resonance: resonance || 0,
        seed: noiseSample * 100 + Math.random() * 50,
        sceneKit: kit,
        worldX: x,
        worldZ: z,
        yaw: yaw,
      });

      let scale =
        (0.9 + density * 0.55 + (biome.id === "crystalNebula" ? 0.1 : 0)) *
        (kit.scaleMul || 1);
      if (typeDef.id === "forest") scale *= 1.0;
      else if (typeDef.id === "megaTree") scale *= 1.55;
      else if (typeDef.id === "tree") scale *= 1.3;
      else if (typeDef.id === "spire" || typeDef.id === "canopy") scale *= 1.2;
      const life =
        (11 + density * 12 + (resonance || 0) * 4 + Math.random() * 4) *
        (isForestFinal ? kit.lifeMul || 1.4 : 1);

      e.active = true;
      e.age = 0;
      e.life = life;
      e.fade = isForestFinal ? 0.4 : 0.25;
      e.fadingOut = false;
      e.baseScale = scale;
      e.homeY = surface;
      e.mesh.position.set(x, surface, z);
      // Forests align corridor to run yaw so paths can thread them
      e.mesh.rotation.y = isForestFinal ? yaw : Math.random() * Math.PI * 2;
      e.mesh.scale.setScalar(scale * (isForestFinal ? 0.42 : 0.35));
      e.mesh.visible = true;
      e.mesh.traverse((c) => {
        if (c.material) {
          const mats = Array.isArray(c.material) ? c.material : [c.material];
          mats.forEach((m) => {
            m.transparent = true;
            const base = m.userData.baseOpacity != null ? m.userData.baseOpacity : 1;
            m.opacity = 0.25 * base;
            m.depthWrite = false;
          });
        }
      });
      e.mesh.userData.kind = "vegetation";
      e.mesh.userData.vegType = typeDef.id;
      e.mesh.userData.forest = isForestFinal;
      e.mesh.userData.sceneBand = kit.band;

      // Forests: rare & slow; small plants: snappy (fill the world, not the screen with giants)
      if (isForestFinal) {
        this.forestCooldown =
          THREE.MathUtils.lerp(0.85, 0.45, Math.min(1, density)) + Math.random() * 0.2;
        if (density > 0.75) this.forestCooldown *= 1.15;
        // Don't stall small flora after a forest lands
        this.vegCooldown = Math.min(this.vegCooldown || 0, 0.06);
        if (this._forestToastT <= 0 && density >= 0.55) {
          const names = {
            crystalNebula: "CRYSTAL GROVE RISES",
            emberVoid: "EMBER FOREST IGNITES",
            whisperStars: "STARLIT GROVE WHISPERS",
            jadeCanopy: "JADE CANOPY UNFURLS",
            solarGold: "GOLDEN WOODLAND FORMS",
            frostGlacier: "ICE SPIRE GROVE FORMS",
            rosePulse: "ROSE GARDEN BLOOMS",
          };
          const label = names[biome.id] || "THE FOREST WAKES";
          this.toastFn(label + " — the biome answers your sprint");
          this._forestToastT = 14;
        }
        // Register footprint so path + terrain co-author this scene
        this._registerSceneFootprint({
          kind: "forest",
          x: x,
          z: z,
          radius: kit.forestRadius || 16,
          yaw: yaw,
          corridor: kit.corridor || 3.4,
          band: kit.band,
          biomeId: biome.id,
          maxAge: 18 + density * 10,
        });
        // Immediate co-op: path through + landmark flanks
        this._coopComposeScene(pred, yaw, density, biome, resonance || 0, playerPos);
      } else if (isBig) {
        // Solo trees / spires — moderate rate, still not spam
        this.vegCooldown =
          THREE.MathUtils.lerp(0.28, 0.14, Math.min(1, density)) + Math.random() * 0.06;
      } else {
        // Ground flora — plenty along the flanks
        this.vegCooldown =
          THREE.MathUtils.lerp(0.09, 0.03, Math.min(1, density)) + Math.random() * 0.02;
      }

      this._remember(x, z);
      this.stats.spawned++;
      return true;
    }

    /**
     * After a forest rises, compose path + terrain flanks + nested grove ruin (temple).
     */
    _coopComposeScene(pred, yaw, density, biome, resonance, playerPos) {
      const kit = sceneKit(density, biome.id);
      // Always open a path first — Bolt must keep a run lane
      const savedPathCd = this.pathCooldown;
      const savedTerrCd = this.terrainCooldown;
      const savedRuinCd = this.ruinCooldown;
      this.pathCooldown = 0;
      this.terrainCooldown = 0;
      this.ruinCooldown = 0;
      // Path through scene (or plain forward corridor)
      this._spawnPath(pred, yaw, density, biome, resonance, this.pools.path, playerPos, {
        forceThroughScene: !!kit.pathThroughForest,
        forceLane: true,
      });
      // One landmark max per compose — walls are flanks, never piles on Bolt
      if (
        kit.preferLandmark &&
        this._countLandmarks() < SPAWN_BUDGET.landmarkCap &&
        Math.random() < Math.min(0.35, kit.landmarkChance * 0.4)
      ) {
        this._spawnTerrain(pred, yaw, density, biome, resonance, this.pools.terrain, playerPos, {
          forceLandmark: true,
        });
      }
      // Nested grove ruin — temple / arch / monolith at forest edge (one only)
      let nestedRuin = false;
      if (
        kit.preferGroveRuin &&
        this.pools.ruin.activeCount < SPAWN_BUDGET.ruinCap &&
        Math.random() < (kit.groveRuinChance || 0.5) * 0.85
      ) {
        nestedRuin = this._spawnRuin(
          pred,
          yaw,
          density,
          biome,
          resonance,
          this.pools.ruin,
          playerPos,
          {
            forceGrove: true,
            preferTemple:
              Math.random() < (kit.groveTempleChance || 0.45) ||
              biome.id === "crystalNebula",
          }
        );
      }

      this.pathCooldown = Math.min(savedPathCd, 0.25);
      this.terrainCooldown = Math.max(0.7, Math.min(savedTerrCd, 0.95));
      this.ruinCooldown = Math.max(0.55, Math.min(savedRuinCd, 1.0));

      if (this._coopToastT <= 0 && density >= 0.55) {
        if (nestedRuin) {
          const labels = {
            crystalNebula: "CRYSTAL FOREST RUIN — temple in the grove 🏛️",
            emberVoid: "ASH GROVE WRECK — ruin in the firewood 🔥",
            whisperStars: "STARLIT SANCTUM — monolith in the grove ✨",
            jadeCanopy: "JADE SHRINE — ruin under the canopy 🌿",
            frostGlacier: "ICE SANCTUM — ruin in the spires ❄️",
            solarGold: "GOLDEN RELIC — ruin in the wood ☀️",
            rosePulse: "ROSE TEMPLE — ruin in the garden 🌸",
          };
          this.toastFn(
            labels[biome.id] || "GROVE RUIN NESTS — the forest keeps a secret 🏛️"
          );
        } else {
          this.toastFn("SCENE COMPOSES — path · forest · landform 🌌");
        }
        this._coopToastT = 16;
      }
    }

    /**
     * TerrainFeatureGenerator — solid landscape near / ahead of Bolt
     * coop: { forceLandmark, preferCanyon } — co-author with forest footprints
     */
    _spawnTerrain(pred, yaw, density, biome, resonance, pool, playerPos, coop) {
      coop = coop || null;
      const st = this._scaleStage || "paw";
      const orbital = st === "orbital" || st === "solar" || st === "cosmic";
      // Hard cap — rocks were burying Bolt at high dens
      if (pool.activeCount >= (orbital ? 10 : SPAWN_BUDGET.terrainCap)) return false;
      if (this.terrainCooldown > 0) return false;

      // Place around predicted future pos (ahead flanks)
      const origin = pred || playerPos;
      const kit = sceneKit(density, biome.id);
      const landmarkLive = this._countLandmarks();
      const landmarkCap =
        kit.band === "veryHigh"
          ? SPAWN_BUDGET.landmarkCap
          : kit.band === "high"
            ? SPAWN_BUDGET.landmarkCap
            : 1;
      const scene =
        !orbital &&
        this._findSceneAhead(origin, yaw, {
          maxDist: 95,
          needTerrain: true,
        });

      let x;
      let z;
      let sideSign = Math.random() < 0.5 ? -1 : 1;
      let isLandmark = false;

      // Co-author: place landmark on flank of nearest forest (far from Bolt)
      if (
        !orbital &&
        scene &&
        landmarkLive < landmarkCap &&
        (coop && coop.forceLandmark ||
          (kit.preferLandmark && Math.random() < kit.landmarkChance * 0.55))
      ) {
        isLandmark = true;
        const sfx = Math.sin(scene.yaw);
        const sfz = Math.cos(scene.yaw);
        const srx = Math.cos(scene.yaw);
        const srz = -Math.sin(scene.yaw);
        if (scene.terrainDone === 0) {
          sideSign = Math.random() < 0.5 ? -1 : 1;
          scene.sideSign = sideSign;
        } else {
          sideSign = -(scene.sideSign != null ? scene.sideSign : 1);
        }
        // Far wall offset so canyon never sits on Bolt
        const edge = scene.radius * 0.85 + scene.corridor * 1.8 + 10;
        const along = (Math.random() - 0.5) * scene.radius * 0.3;
        x = scene.x + srx * sideSign * edge + sfx * along;
        z = scene.z + srz * sideSign * edge + sfz * along;
        // Must be far from Bolt and outside run corridor
        if (
          this._tooCloseToPlayer(x, z, CLEAR.landmarkPlayer) ||
          this._inRunCorridor(
            x,
            z,
            yaw,
            CLEAR.corridorHalf + 2,
            CLEAR.corridorAhead,
            CLEAR.corridorBehind
          )
        ) {
          isLandmark = false;
        }
      }

      if (!isLandmark) {
        // Rocks/ridges on pure flanks — never in run corridor
        const placed = this._placeAround(origin, yaw, {
          orbital: orbital,
          minR: orbital ? 32 : CLEAR.terrainMin,
          maxR: orbital ? 90 : CLEAR.terrainMax + density * 10,
          preferSide: true,
          solid: true,
          strictSides: true,
          clearR: orbital ? 28 : CLEAR.terrainClear,
          corridorHalf: orbital ? 0 : CLEAR.corridorHalf + 4,
          blockCorridor: !orbital,
          stackMin: orbital ? 22 : 18,
          jitter: orbital ? 5 : 2.4,
        });
        if (!placed) return false;
        x = placed.x;
        z = placed.z;
        // Landmarks only if under cap and far enough
        if (
          !orbital &&
          landmarkLive < landmarkCap &&
          kit.preferLandmark &&
          Math.random() < kit.landmarkChance * 0.18
        ) {
          isLandmark = true;
        }
      }

      // Final safety: never place rock near Bolt or on highway
      if (!orbital && this._tooCloseToPlayer(x, z, CLEAR.player)) return false;
      if (
        !orbital &&
        this._inRunCorridor(
          x,
          z,
          yaw,
          CLEAR.corridorHalf + 3,
          CLEAR.corridorAhead,
          CLEAR.corridorBehind
        )
      ) {
        return false;
      }

      const surface = this.heightAt(x, z);

      const e = pool.acquire();
      if (!e) return false;

      // Orbital prefers floaters / boulders (asteroid debris), not cliffs
      let typeDef = pickTerrainType(density, biome.id);
      if (orbital) {
        const roll = Math.random();
        if (roll < 0.55) typeDef = TERRAIN_TYPES.floater;
        else if (roll < 0.85) typeDef = TERRAIN_TYPES.boulders;
        else typeDef = TERRAIN_TYPES.crater;
        isLandmark = false;
      } else if (isLandmark || (coop && coop.forceLandmark)) {
        typeDef = pickLandmarkType(density, biome.id, {
          canyonChance: coop && coop.preferCanyon ? 0.85 : kit.canyonChance,
        });
        isLandmark = true;
      }
      if (this.terrainTypeStats[typeDef.id] != null) this.terrainTypeStats[typeDef.id]++;

      TerrainFeatureGenerator.layout(e.mesh, {
        typeDef: typeDef,
        biome: biome,
        density: density * (orbital ? 1.25 : isLandmark ? 1.15 : 1),
        seed: Math.random() * 100,
        orbital: orbital,
        landmarkScale: kit.landmarkScale || 1,
        sideSign: sideSign,
      });

      let y = surface;
      if (orbital) {
        const baseAlt = st === "cosmic" ? 50 : st === "solar" ? 38 : 26;
        y = Math.max(origin.y, surface) + baseAlt * 0.55 + Math.random() * 30;
      }
      // Landmarks impressive but farther; small rocks stay modest so Bolt stays visible
      const scale = orbital
        ? 2.4 + density * 1.6
        : isLandmark
          ? 1.05 + density * 0.4
          : 0.75 + density * 0.22;
      const life =
        14 +
        density * 10 +
        resonance * 3 +
        (orbital ? 8 : 0) +
        (isLandmark ? 6 : 0);

      e.active = true;
      e.age = 0;
      e.life = life;
      e.fade = 0.35;
      e.fadingOut = false;
      e.baseScale = scale;
      e.homeY = y;
      e.mesh.position.set(x, y, z);
      // Landmarks align to scene / run yaw so walls frame the corridor
      e.mesh.rotation.y = isLandmark
        ? (scene ? scene.yaw : yaw) + (Math.random() - 0.5) * 0.12
        : yaw + (Math.random() - 0.5) * 0.8;
      if (orbital) {
        e.mesh.rotation.x = (Math.random() - 0.5) * 0.6;
        e.mesh.rotation.z = (Math.random() - 0.5) * 0.6;
      }
      e.mesh.scale.setScalar(scale * (orbital ? 0.55 : isLandmark ? 0.55 : 0.4));
      e.mesh.visible = true;
      e.mesh.traverse((c) => {
        if (c.material) {
          const mats = Array.isArray(c.material) ? c.material : [c.material];
          mats.forEach((m) => {
            m.transparent = true;
            const base = m.userData.baseOpacity != null ? m.userData.baseOpacity : 1;
            m.opacity = 0.35 * base;
            m.depthWrite = false;
          });
        }
      });
      e.mesh.userData.kind = "terrain";
      e.mesh.userData.terrainType = typeDef.id;
      e.mesh.userData.landmark = isLandmark;

      if (scene && isLandmark) {
        scene.terrainDone = (scene.terrainDone || 0) + 1;
      }

      this.terrainCooldown = orbital
        ? 1.0 + Math.random() * 0.55
        : isLandmark
          ? 1.15 + Math.random() * 0.5
          : 0.95 + Math.random() * 0.45;
      this._remember(x, z);
      this.stats.spawned++;
      return true;
    }

    /**
     * PathGenerator — starts ahead of Bolt; routes through forest scenes when available
     * coop: { forceThroughScene }
     */
    _spawnPath(pred, yaw, density, biome, resonance, pool, playerPos, coop) {
      coop = coop || null;
      if (pool.activeCount >= MAX_LIVE_PATHS) return false;
      if (this.pathCooldown > 0) return false;

      const st = this._scaleStage || "paw";
      const orbital =
        st === "orbital" || st === "solar" || st === "cosmic";

      const fx = Math.sin(yaw);
      const fz = Math.cos(yaw);
      const rx = Math.cos(yaw);
      const rz = -Math.sin(yaw);

      // Paths use player for start (lane under feet), pred for forest search
      const origin = playerPos || pred;
      const searchOrigin = pred || origin;
      const kit = sceneKit(density, biome.id);
      const scene =
        !orbital &&
        kit.pathThroughForest &&
        this._findSceneAhead(searchOrigin, yaw, {
          maxDist: 100,
          needPath: !(coop && coop.forceThroughScene),
        });
      // forceThroughScene: prefer any forest ahead even if path already done
      const sceneForce =
        !orbital &&
        coop &&
        coop.forceThroughScene &&
        this._findSceneAhead(searchOrigin, yaw, { maxDist: 100, needPath: false });

      const useScene = sceneForce || scene;
      let pathGuide = null;
      let x;
      let z;
      let pathYaw = yaw;

      if (useScene && !orbital) {
        // Start just before forest, aim through its center
        const sfx = Math.sin(useScene.yaw);
        const sfz = Math.cos(useScene.yaw);
        const approach = useScene.radius * 0.85 + 8;
        x = useScene.x - sfx * approach;
        z = useScene.z - sfz * approach;
        // Nudge start toward Bolt if forest is side-biased
        const blend = 0.35;
        x = x * (1 - blend) + (origin.x + fx * 12) * blend;
        z = z * (1 - blend) + (origin.z + fz * 12) * blend;
        pathYaw = useScene.yaw;
        pathGuide = {
          targetX: useScene.x + sfx * useScene.radius * 0.35,
          targetZ: useScene.z + sfz * useScene.radius * 0.35,
          throughForest: true,
          stick: 0.72,
          lengthMul: (kit.pathLengthMul || 1.4) * (1 + useScene.radius / 40),
          widthMul: kit.pathWidthMul || 1.15,
        };
      } else {
        // Path always starts IN FRONT of Bolt so he runs into a glowing corridor
        const minAhead = orbital ? 22 : 12;
        const maxAhead = orbital ? 75 : 26 + density * 14;
        const ahead = minAhead + Math.random() * (maxAhead - minAhead);
        // Tiny side offset only — path stays centered on run line
        const side = (Math.random() - 0.5) * (orbital ? 14 : 1.6);
        x = origin.x + fx * ahead + rx * side;
        z = origin.z + fz * ahead + rz * side;
        if (!orbital && density > 0.55) {
          pathGuide = {
            throughForest: false,
            stick: 0.5,
            lengthMul: kit.pathLengthMul || 1,
            widthMul: kit.pathWidthMul || 1,
          };
        }
      }

      // Paths may start relatively near — they ARE the lane (not clutter)
      if (this._tooCloseToPlayer(x, z, orbital ? 16 : 8)) return false;
      if (this._tooClose(x, z, orbital ? 14 : 7)) return false;

      const surface = this.heightAt(x, z);
      const orbitAlt =
        st === "cosmic" ? 52 : st === "solar" ? 40 : 24;
      // Match Bolt's altitude band so paths stay in frame while sprinting skyward
      const y = orbital
        ? Math.max(origin.y - 4, surface + 8) + orbitAlt * 0.35 + Math.random() * 14
        : surface + 0.5;

      const e = pool.acquire();
      if (!e) return false;

      // Prefer energy lanes — clear readable path for Bolt
      let typeDef = pickPathType(density, biome.id, resonance);
      const forceLane = !!(coop && (coop.forceLane || coop.forceThroughScene));
      if (orbital || forceLane || Math.random() < 0.7) typeDef = PATH_TYPES.energy;
      else if (Math.random() < 0.35) typeDef = PATH_TYPES.branch;
      else if (Math.random() < 0.45) typeDef = PATH_TYPES.shortcut;
      // Forest corridors / forced lanes: bright energy highway
      if ((useScene || forceLane) && !orbital) {
        typeDef = Object.assign({}, PATH_TYPES.energy, {
          length: (PATH_TYPES.energy.length || 28) * (1.5 + density * 0.55) * (kit.pathLengthMul || 1),
          segs: Math.min(30, (PATH_TYPES.energy.segs || 12) + 12),
          width: (PATH_TYPES.energy.width || 0.55) * 1.15,
          emissive: 1.25,
          opacity: 0.82,
          glow: true,
          pulse: true,
          curve: useScene ? 0.16 : 0.12,
        });
      } else if (!orbital) {
        typeDef = Object.assign({}, typeDef, {
          length: (typeDef.length || 28) * (1.2 + density * 0.4) * (kit.pathLengthMul || 1),
          segs: Math.min(24, (typeDef.segs || 12) + 5 + (density > 0.6 ? 4 : 0)),
          width: (typeDef.width || 0.55) * (kit.pathWidthMul || 1),
          emissive: (typeDef.emissive || 1.0) * 0.95,
          opacity: Math.min(0.78, (typeDef.opacity || 0.65) + 0.1),
          glow: true,
          pulse: true,
        });
      }
      // Orbital: long thin sky lanes
      if (orbital) {
        typeDef = Object.assign({}, typeDef, {
          length: (typeDef.length || 28) * 1.7,
          segs: Math.min(20, (typeDef.segs || 12) + 5),
          curve: Math.max(0.4, (typeDef.curve || 0.2) * 2.0),
          width: (typeDef.width || 0.55) * 1.0,
          emissive: (typeDef.emissive || 1.0) * 0.95,
        });
      }
      if (this.pathTypeStats[typeDef.id] != null) this.pathTypeStats[typeDef.id]++;

      const start = new THREE.Vector3(x, y, z);
      // Orbital paths: gentle arc altitude (planet-curve silhouette)
      const heightFn = orbital
        ? function (hx, hz) {
            const arc = Math.sin(hx * 0.028 + hz * 0.022) * 6 + Math.cos(hx * 0.015) * 3;
            return y + arc;
          }
        : this.heightAt.bind(this);

      PathGenerator.layout(e.mesh, {
        typeDef: typeDef,
        biome: biome,
        density: Math.max(0.5, density) * (orbital ? 1.45 : 1),
        heightAt: heightFn,
        start: start,
        yaw:
          pathYaw +
          (Math.random() - 0.5) * (orbital ? 0.55 : useScene ? 0.04 : 0.08),
        seed: Math.random() * 200,
        orbital: orbital,
        guide: pathGuide,
      });

      if (useScene) {
        useScene.pathDone = true;
      }

      const life = 14 + density * 6 + (orbital ? 12 : 0) + (useScene ? 5 : 0);
      e.active = true;
      e.age = 0;
      e.life = life;
      e.fade = 0.55; // appear quickly
      e.fadingOut = false;
      e.baseScale = 1;
      e.homeY = y;
      e.mesh.position.copy(start);
      e.mesh.rotation.set(0, 0, 0);
      e.mesh.scale.setScalar(1);
      e.mesh.visible = true;
      e.mesh.userData.throughForest = !!useScene;
      e.mesh.traverse((c) => {
        if (c.material) {
          const mats = Array.isArray(c.material) ? c.material : [c.material];
          mats.forEach((m) => {
            m.transparent = true;
            const base = m.userData.baseOpacity != null ? m.userData.baseOpacity : 1;
            // Subtle fade-in — soft guide, not neon blast
            m.opacity = 0.4 * base;
            m.depthWrite = false;
          });
        }
      });
      e.mesh.userData.pathType = typeDef.id;
      e.mesh.userData.isPathEntity = true;

      // Keep paths refreshing often so Bolt always has a lane
      this.pathCooldown = orbital
        ? 0.35 + Math.random() * 0.25
        : 0.22 + Math.random() * 0.14;
      this._remember(x, z);
      this.stats.spawned++;
      return true;
    }

    /**
     * Main loop hook
     */
    update(dt, packet, playerPos, yaw) {
      // Decay flux boost
      this._fluxBoost = Math.max(0, this._fluxBoost - dt * 0.35);
      this._forestToastT = Math.max(0, (this._forestToastT || 0) - dt);
      this._coopToastT = Math.max(0, (this._coopToastT || 0) - dt);
      this._tickSceneFootprints(dt);
      this._lastPlayerPos = playerPos;
      if (typeof yaw === "number") this._lastYaw = yaw;

      const score = this.scoreSys.update(packet, dt);
      // Scale factors from Seamless Scale Shifting
      const sc = packet.scaleProps || {};
      const predictMul = sc.predictMul != null ? sc.predictMul : 1;
      const pred = this.predictor.predict(
        playerPos,
        packet.velocity,
        packet.momentum,
        predictMul
      );

      // Biome at predicted position (world reveals ahead in local context)
      const bio = sampleBiome(pred.x, pred.z, packet.resonance || 0);
      this.currentBiome = bio.primary;
      this.biomeMix = bio.mix;

      const res = packet.resonance || 0;
      this._scaleStage = packet.scaleStage || sc.id || "paw";
      this._transitionProgress = packet.transitionProgress != null ? packet.transitionProgress : 0;
      const st = this._scaleStage;
      const orbital = st === "orbital" || st === "solar" || st === "cosmic";

      let active = 0;
      Object.keys(this.pools).forEach((k) => {
        this.pools[k].update(dt, this.scoreSys.active, playerPos);
        active += this.pools[k].activeCount;
      });
      this.stats.active = active;

      this.cooldown = Math.max(0, this.cooldown - dt);
      if (!this.scoreSys.active || this.cooldown > 0) return score;

      // Density + flux + resonance + Core + SCALE densityMul
      const coreMul = packet.coreWorldMul != null ? packet.coreWorldMul : 0;
      const coreRuin = packet.coreRuinBonus != null ? packet.coreRuinBonus : 0;
      const coreDetail = packet.coreDetailBonus != null ? packet.coreDetailBonus : 0;
      const tp = packet.transitionProgress != null ? packet.transitionProgress : 0;
      // Surface = anything not true orbital/solar/cosmic (ground stay-dense path)
      const surfaceScale = !orbital;
      // Surface density: keep rich but not rock-flooded
      let densScale = sc.densityMul != null ? sc.densityMul : 1;
      if (surfaceScale) densScale = Math.max(1.0, Math.min(1.2, densScale));
      let density = this.scoreSys.density;
      density = THREE.MathUtils.clamp(
        (density + this._fluxBoost * 0.35 + res * 0.12 + coreMul * 0.85) * densScale,
        0,
        surfaceScale ? 1.25 : 1.45
      );
      this._coreWorldMul = coreMul;

      // Per-generator scale multipliers (lore: small gens off at cosmic scale)
      let mPath = sc.pathMul != null ? sc.pathMul : 1;
      let mTerr = sc.terrainMul != null ? sc.terrainMul : 1;
      let mVeg = sc.vegMul != null ? sc.vegMul : 1;
      let mRuin = sc.ruinMul != null ? sc.ruinMul : 1;
      let mDet = sc.detailMul != null ? sc.detailMul : 1;
      // Surface floors — path always strong; high dens reduces rock/detail clutter
      // but vegetation (small flora) stays rich on the flanks
      if (surfaceScale) {
        mPath = Math.max(1.7, mPath); // always paint a corridor ahead
        mTerr = Math.min(mTerr, 0.7); // never amplify rock spam
        mRuin = Math.min(Math.max(0.85, mRuin), 1.05);
        const hi = THREE.MathUtils.smoothstep(density, 0.45, 1.1);
        mDet = Math.max(0.35, (mDet || 1) * (1.05 - hi * 0.55));
        // More plants at higher dens (small types); forests still self-capped
        mVeg = Math.max(1.15, Math.min(1.55, (mVeg || 1) * (1.2 + hi * 0.2)));
      }
      // Orbital: force veg off, boost ruin/path priority
      if (orbital) {
        mVeg = 0;
        mRuin = Math.max(1.35, mRuin);
        mPath = Math.max(1.25, mPath);
        mDet = Math.min(0.35, Math.max(0.12, mDet));
        mTerr = Math.min(0.55, Math.max(0.25, mTerr));
      }

      this.pathCooldown = Math.max(0, (this.pathCooldown || 0) - dt);
      this.terrainCooldown = Math.max(0, (this.terrainCooldown || 0) - dt);
      this.vegCooldown = Math.max(0, (this.vegCooldown || 0) - dt);
      this.forestCooldown = Math.max(0, (this.forestCooldown || 0) - dt);
      this.ruinCooldown = Math.max(0, (this.ruinCooldown || 0) - dt);
      this.detailCooldown = Math.max(0, (this.detailCooldown || 0) - dt);

      const n = 1 + Math.floor(density * 2.0 + this._fluxBoost * 1.0 + coreMul * 1.5);
      let any = false;
      const biome = this.currentBiome;
      const d = Math.min(1.15, density);

      // --- ORBITAL: Ruin + Path + debris fields (graveyard of empires) ---
      if (orbital) {
        // Energy paths through debris — safe glowing lanes
        if (mPath > 0.05) {
          const pathCap = st === "cosmic" ? 4 : 3;
          if (
            this.pools.path.activeCount < pathCap ||
            Math.random() < (0.78 + coreMul * 0.2) * mPath
          ) {
            if (this._spawnOne("path", pred, yaw, Math.min(1.25, d * mPath), biome, res)) any = true;
          }
          // Extra path when density high (routes through fields)
          if (density > 0.45 && Math.random() < 0.4 * mPath) {
            if (this._spawnOne("path", pred, yaw, d * mPath, biome, res)) any = true;
          }
        }
        // Ruins — derelict stations / wrecks as large debris landmarks
        if (mRuin > 0.08) {
          const ruinCap = 5 + Math.floor(coreRuin * 5);
          const ruinChance =
            (0.48 + density * 0.45 + res * 0.3 + coreRuin * 0.5) * mRuin;
          if (this.pools.ruin.activeCount < ruinCap || Math.random() < ruinChance) {
            if (this._spawnOne("ruin", pred, yaw, Math.min(1.3, d * mRuin), biome, res)) any = true;
          }
          if (Math.random() < (0.32 + coreRuin * 0.4) * mRuin) {
            if (this._spawnOne("ruin", pred, yaw, d, biome, res)) any = true;
          }
        }
        // Terrain debris clusters (rocks / floaters in fields)
        if (mTerr > 0.08) {
          const terrChance = (0.5 + density * 0.35) * Math.max(0.4, mTerr);
          if (this.pools.terrain.activeCount < 10 || Math.random() < terrChance) {
            if (this._spawnOne("terrain", pred, yaw, d * Math.max(0.5, mTerr), biome, res)) any = true;
          }
          if (density > 0.4 && Math.random() < 0.35) {
            if (this._spawnOne("terrain", pred, yaw, d * mTerr, biome, res)) any = true;
          }
        }
        // Large energy clouds only (low detail)
        if (mDet > 0.06 && Math.random() < (0.3 + density * 0.2 + res * 0.2) * mDet) {
          if (this._spawnOne("detail", pred, yaw, d * mDet, biome, res)) any = true;
        }
        // Extra weighted picks still respect orbital _pickKind (no veg)
        for (let i = 0; i < Math.min(n, 2); i++) {
          const kind = this._pickKind(biome, d);
          if (kind === "vegetation") continue;
          if (this._spawnOne(kind, pred, yaw, d, biome, res)) any = true;
        }
        this.cooldown = THREE.MathUtils.lerp(0.48, 0.22, Math.min(1, density));
      } else {
        // --- SURFACE GOLDEN PIPELINE ---
        // 1 Paths · 2 Terrain flanks · 3 Ruins far · 4 Veg flanks · 5 Sparse details
        // Never bury Bolt; high dens = better large pieces, fewer small clutter.
        const B = SPAWN_BUDGET;
        let tSpawned = 0;
        let vSpawned = 0;
        let rSpawned = 0;
        let dSpawned = 0;
        let pSpawned = 0;

        // 1. PATH first — always keep a readable highway
        if (mPath > 0.05) {
          if (this.pools.path.activeCount < 2) {
            this.pathCooldown = 0;
            if (
              this._spawnPath(
                pred,
                yaw,
                Math.min(1.35, d * mPath + 0.2),
                biome,
                res,
                this.pools.path,
                playerPos,
                { forceLane: true }
              )
            ) {
              any = true;
              pSpawned++;
            }
          }
          if (
            pSpawned < B.pathPerTick &&
            this.pools.path.activeCount < B.pathCap &&
            Math.random() < (0.75 + coreMul * 0.1) * mPath
          ) {
            if (this._spawnOne("path", pred, yaw, Math.min(1.3, d * mPath), biome, res)) {
              any = true;
              pSpawned++;
            }
          }
        }

        // 2. TERRAIN — max 1 per tick, hard live cap, pure flanks
        if (
          mTerr > 0.08 &&
          tSpawned < B.terrainPerTick &&
          this.pools.terrain.activeCount < B.terrainCap &&
          Math.random() < (0.22 + density * 0.12) * mTerr
        ) {
          if (this._spawnOne("terrain", pred, yaw, d * mTerr, biome, res)) {
            any = true;
            tSpawned++;
          }
        }

        // 3. RUINS — rare, far, prefer forest edge once
        if (
          mRuin > 0.08 &&
          rSpawned < B.ruinPerTick &&
          this.pools.ruin.activeCount < B.ruinCap
        ) {
          const openGrove = this._findSceneAhead(pred || playerPos, yaw, {
            maxDist: 110,
            needRuin: true,
          });
          if (openGrove && Math.random() < 0.35 + density * 0.15) {
            this.ruinCooldown = 0;
            if (
              this._spawnRuin(
                pred,
                yaw,
                Math.min(1.15, d * mRuin),
                biome,
                res,
                this.pools.ruin,
                playerPos,
                { forceGrove: true }
              )
            ) {
              any = true;
              rSpawned++;
            }
          }
          if (
            rSpawned < B.ruinPerTick &&
            Math.random() < (0.18 + density * 0.15 + res * 0.12 + coreRuin * 0.35) * mRuin
          ) {
            if (this._spawnOne("ruin", pred, yaw, Math.min(1.15, d * mRuin), biome, res)) {
              any = true;
              rSpawned++;
            }
          }
        }

        // 4. VEGETATION — rich small flora on flanks; forests/big trees self-capped
        if (mVeg > 0.05 && this.pools.vegetation.activeCount < B.vegCap) {
          const vegChance =
            (0.72 + density * 0.28 + (biome.weights.vegetation || 0.2) * 0.4 + coreMul * 0.15) * mVeg;
          for (let vi = 0; vi < B.vegPerTick; vi++) {
            if (vSpawned >= B.vegPerTick) break;
            if (this.pools.vegetation.activeCount >= B.vegCap) break;
            if (Math.random() < vegChance * (vi === 0 ? 1 : 0.75)) {
              if (this._spawnOne("vegetation", pred, yaw, d * mVeg, biome, res)) {
                any = true;
                vSpawned++;
              }
            }
          }
        }

        // 5. DETAILS last — sparsest at high dens (reduce clutter in view)
        if (
          mDet > 0.06 &&
          dSpawned < B.detailPerTick &&
          this.pools.detail.activeCount < B.detailCap
        ) {
          const detailChance =
            (0.35 + density * 0.12 + res * 0.15 + (biome.weights.detail || 0.2) * 0.25) *
            mDet *
            (1.0 - THREE.MathUtils.clamp(density - 0.5, 0, 0.5) * 0.7);
          if (Math.random() < detailChance) {
            if (this._spawnOne("detail", pred, yaw, d * mDet * 0.75, biome, res)) {
              any = true;
              dSpawned++;
            }
          }
        }

        // Optional single weighted pick — never terrain spam, prefer path/veg/detail
        if (Math.random() < 0.35 + density * 0.1) {
          const kind = this._pickKind(biome, d);
          if (kind === "path" && pSpawned < B.pathPerTick && this.pools.path.activeCount < B.pathCap) {
            if (this._spawnOne("path", pred, yaw, d, biome, res)) any = true;
          } else if (
            kind === "vegetation" &&
            vSpawned < B.vegPerTick &&
            this.pools.vegetation.activeCount < B.vegCap
          ) {
            if (this._spawnOne("vegetation", pred, yaw, d * mVeg, biome, res)) {
              any = true;
              vSpawned++;
            }
          } else if (
            kind === "detail" &&
            dSpawned < B.detailPerTick &&
            this.pools.detail.activeCount < B.detailCap &&
            density < 0.85
          ) {
            if (this._spawnOne("detail", pred, yaw, d * 0.7, biome, res)) any = true;
          }
          // terrain/ruin only via dedicated branches above
        }

        // Slightly slower ticks at high dens so world stays readable
        this.cooldown = THREE.MathUtils.lerp(0.22, 0.1, Math.min(1, density * 0.85));
      }

      if (any && Math.random() < 0.28 + density * 0.15) {
        const pt = this.pathTypeStats;
        const vt = this.vegTypeStats;
        const rt = this.ruinTypeStats;
        const dtStats = this.detailTypeStats;
        let pathHint = "";
        if (st === "cosmic" || st === "solar") pathHint = " · COSMIC HORIZON";
        else if (st === "orbital") {
          const oHints = [
            " · ORBITAL FIELD",
            " · DEBRIS FIELD",
            " · GRAVEYARD OF EMPIRES",
            " · DERELICT STATION",
            " · ORBITAL LANE",
            " · WRECK CLUSTER",
            " · ANCIENT RING",
          ];
          pathHint = oHints[Math.floor(Math.random() * oHints.length)];
        } else if ((rt.temple || 0) > 0 && Math.random() < 0.4) pathHint = " · ANCIENT TEMPLE";
        else if ((rt.monolith || 0) > 0 && Math.random() < 0.35) pathHint = " · MONOLITH";
        else if ((rt.wreck || 0) > 0 && Math.random() < 0.35) pathHint = " · BATTLE WRECK";
        else if ((dtStats.crystals || 0) > 5 && Math.random() < 0.4) pathHint = " · CRYSTAL FIELD";
        else if ((dtStats.motes || 0) > 4 && Math.random() < 0.35) pathHint = " · STAR MOTES";
        else if (pt.energy > pt.hidden && Math.random() < 0.4) pathHint = " · ENERGY PATH";
        else if ((vt.canopy || 0) > 0 && Math.random() < 0.3) pathHint = " · ALIEN CANOPY";
        this.toastFn("WORLD REVEALS — " + biome.short + pathHint + " 🌌");
      }

      return score;
    }

    get meaningfulScore() {
      return this.scoreSys.score;
    }

    get factors() {
      return {
        speed: this.scoreSys.speedFactor,
        momentum: this.scoreSys.momentumFactor,
        intention: this.scoreSys.intentionFactor,
        trajectory: this.scoreSys.trajectoryFactor,
        density: this.scoreSys.density,
        sceneBand: this._sceneBand || densityBand(this.scoreSys.density).id,
        scenes: this._sceneFootprints ? this._sceneFootprints.length : 0,
        active: this.stats.active,
        spawned: this.stats.spawned,
        biome: this.currentBiome.name,
        horizon: this.predictor.horizonSec,
        flux: this._fluxBoost,
        paths: Object.assign({}, this.pathTypeStats),
        terrain: Object.assign({}, this.terrainTypeStats),
        vegetation: Object.assign({}, this.vegTypeStats),
        ruins: Object.assign({}, this.ruinTypeStats),
        details: Object.assign({}, this.detailTypeStats),
        coreWorldMul: this._coreWorldMul || 0,
        scaleStage: this._scaleStage || "paw",
        transitionProgress: this._transitionProgress || 0,
      };
    }
  }

  global.BoltProcedural = {
    MeaningfulSprintScore: MeaningfulSprintScore,
    TrajectoryPredictor: TrajectoryPredictor,
    ProceduralSpawner: ProceduralSpawner,
    PathGenerator: PathGenerator,
    TerrainFeatureGenerator: TerrainFeatureGenerator,
    VegetationGenerator: VegetationGenerator,
    RuinGenerator: RuinGenerator,
    DetailGenerator: DetailGenerator,
    PATH_TYPES: PATH_TYPES,
    TERRAIN_TYPES: TERRAIN_TYPES,
    VEG_TYPES: VEG_TYPES,
    RUIN_TYPES: RUIN_TYPES,
    DETAIL_TYPES: DETAIL_TYPES,
    BiomeAtmosphere: BiomeAtmosphere,
    CLEAR: CLEAR,
    SPAWN_BUDGET: SPAWN_BUDGET,
    SPAWN_THRESHOLD: SPAWN_THRESHOLD,
    BIOME_CELL: BIOME_CELL,
    BIOMES: BIOMES,
    BIOME_LIST: BIOME_LIST,
    BIOME_COUNT: BIOME_COUNT,
    SURFACE_BIOME_IDS: SURFACE_BIOME_IDS,
    sampleBiome: sampleBiome,
    mixBiomeColor: mixBiomeColor,
    setForceBiome: setForceBiome,
    getForceBiome: getForceBiome,
    PLANET_BIOME_MAP: PLANET_BIOME_MAP,
    DENSITY_BANDS: DENSITY_BANDS,
    densityBand: densityBand,
    sceneKit: sceneKit,
    forestDensity: forestDensity,
    forestDensityNear: forestDensityNear,
    forestWarpStrength: forestWarpStrength,
    VEG_TYPES: VEG_TYPES,
  };
})(typeof window !== "undefined" ? window : globalThis);
