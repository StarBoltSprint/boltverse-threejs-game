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
  const MAX_ACTIVE = 320;
  const WORLD_R = 1e9; // open world — no practical edge
  const LOOKAHEAD_MIN = 2.0; // seconds
  const LOOKAHEAD_MAX = 5.5;

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

  // ---------------------------------------------------------------------------
  // Biome system (weights auto-normalize to 100%)
  // ---------------------------------------------------------------------------
  /**
   * Biomes = large cosmic regions (look + generator behavior + atmosphere).
   * CELL size makes regions feel like distinct "countries" of the cosmos.
   */
  const BIOME_CELL = 320; // world units — clearly different environments while traveling

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
      sky: 0x061428,
      fog: 0x0a2848,
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
      sky: 0x120805,
      fog: 0x2a1008,
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
      sky: 0x04040f,
      fog: 0x0c0c22,
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
      sky: 0x1a1005,
      fog: 0x2a1a08,
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
      sky: 0x06101c,
      fog: 0x0c1a2e,
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
      sky: 0x04120e,
      fog: 0x0a2218,
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
      sky: 0x120810,
      fog: 0x220818,
      ambient: 0xf472b6,
      sun: 0xfce7f3,
      rim: 0xec4899,
      fogDensity: 0.0036,
      heightMul: 0.75,
      weights: { path: 0.15, terrain: 0.15, vegetation: 0.28, ruin: 0.18, detail: 0.24 },
    },
  };

  // Surface wandering biomes (cells) + full set for planet landings
  const BIOME_LIST = [BIOMES.crystalNebula, BIOMES.emberVoid, BIOMES.whisperStars];
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

  function cellBiomeId(cx, cz) {
    // Stable hash → 0,1,2
    const h = hash2(cx * 1.7, cz * 2.3);
    if (h < 0.38) return "crystalNebula";
    if (h < 0.70) return "emberVoid";
    return "whisperStars";
  }

  /**
   * Large cells + soft edge blend so regions feel distinct but not harsh cuts.
   * Resonance can slightly expand Crystal influence (joy → more ethereal cosmos).
   * forceBiomeId locks the whole world to a landed planet's biome.
   */
  function sampleBiome(x, z, resonance) {
    // Landed on another world — full biome takeover
    if (forceBiomeId && BIOMES[forceBiomeId]) {
      const b = BIOMES[forceBiomeId];
      const mix = { crystalNebula: 0, emberVoid: 0, whisperStars: 0 };
      mix[forceBiomeId] = 1;
      // ensure keys exist for mix consumers
      if (mix[forceBiomeId] == null) mix[forceBiomeId] = 1;
      return {
        primary: b,
        mix: mix,
        edge: 0,
        cell: { cx: 0, cz: 0 },
        forced: true,
      };
    }
    const res = resonance || 0;
    const fx = x / BIOME_CELL;
    const fz = z / BIOME_CELL;
    const cx = Math.floor(fx);
    const cz = Math.floor(fz);
    // Distance to cell center (0 center → 1 edge)
    const lx = fx - cx - 0.5;
    const lz = fz - cz - 0.5;
    const edge = Math.max(Math.abs(lx), Math.abs(lz)) * 2; // 0..1 toward edge
    const blend = THREE.MathUtils.smoothstep(0.55, 0.98, edge);

    const idMain = cellBiomeId(cx, cz);
    // Neighbor bias for blend zone
    const nx = lx > 0 ? cx + 1 : cx - 1;
    const nz = lz > 0 ? cz + 1 : cz - 1;
    const idNbX = cellBiomeId(nx, cz);
    const idNbZ = cellBiomeId(cx, nz);

    let w = { crystalNebula: 0, emberVoid: 0, whisperStars: 0 };
    w[idMain] += 1 - blend * 0.65;
    w[idNbX] += blend * 0.35 * Math.abs(lx) * 2;
    w[idNbZ] += blend * 0.35 * Math.abs(lz) * 2;

    // Resonance gently boosts Crystal Nebula (Pack joy → living light)
    w.crystalNebula += res * 0.12;

    // Soft noise variation so cells aren't perfect squares
    const n = fbm(x * 0.004, z * 0.004, 2);
    w.emberVoid += (n - 0.5) * 0.08;
    w.whisperStars += (0.5 - n) * 0.06;

    let sum = w.crystalNebula + w.emberVoid + w.whisperStars;
    if (sum < 1e-6) sum = 1;
    w.crystalNebula /= sum;
    w.emberVoid /= sum;
    w.whisperStars /= sum;

    let primary = BIOMES.crystalNebula;
    let maxW = w.crystalNebula;
    if (w.emberVoid > maxW) {
      primary = BIOMES.emberVoid;
      maxW = w.emberVoid;
    }
    if (w.whisperStars > maxW) primary = BIOMES.whisperStars;

    return {
      primary: primary,
      mix: w,
      edge: blend,
      cell: { cx: cx, cz: cz },
    };
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
      const t = 1 - Math.exp(-1.8 * dt); // smooth blend
      this.sky.lerp(new THREE.Color(b.sky), t);
      this.fog.lerp(new THREE.Color(b.fog), t);
      this.ambient.lerp(new THREE.Color(b.ambient), t);
      this.sun.lerp(new THREE.Color(b.sun), t);
      this.rim.lerp(new THREE.Color(b.rim), t);
      this.fogDensity = THREE.MathUtils.damp(this.fogDensity, b.fogDensity, 2.0, dt);
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
      this.live.push(e);
      return e;
    }

    update(dt, meaningfulActive) {
      for (let i = this.live.length - 1; i >= 0; i--) {
        const e = this.live[i];
        e.age += dt;
        if ((!meaningfulActive || e.age > e.life) && !e.fadingOut) {
          e.fadingOut = true;
        }
        if (e.fadingOut) e.fade = Math.max(0, e.fade - dt / FADE_OUT_SEC);
        else e.fade = Math.min(1, e.fade + dt / FADE_IN_SEC);

        const f = e.fade;
        const isPath = e.mesh.userData && e.mesh.userData.isPathEntity;
        const isVeg = e.kind === "vegetation" || (e.mesh.userData && e.mesh.userData.kind === "vegetation");
        if (isPath) {
          // Paths stay full scale — only opacity fades (otherwise tubes vanish)
          e.mesh.scale.setScalar(1);
          e.mesh.position.y = e.homeY;
        } else {
          e.mesh.scale.setScalar(Math.max(0.01, e.baseScale * (0.12 + 0.88 * f)));
          e.mesh.position.y = e.homeY - (1 - f) * 0.9;
        }
        // Gentle sway for vegetation (organic life)
        if (isVeg && e.mesh.userData.swayParts && e.mesh.userData.swayParts.length) {
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
        // Resonance pulse on ruin runes / loot gems
        if (e.kind === "ruin" && e.mesh.userData.pulseParts && e.mesh.userData.pulseParts.length) {
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
        e.mesh.traverse((c) => {
          if (c.material) {
            const mats = Array.isArray(c.material) ? c.material : [c.material];
            mats.forEach((m) => {
              const base = m.userData.baseOpacity != null ? m.userData.baseOpacity : 1;
              m.opacity = f * base;
              m.depthWrite = !isPath && m.opacity > 0.92;
            });
          }
        });

        if (e.fadingOut && e.fade <= 0.001) {
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
  function generatePathPoints(start, yaw, typeDef, density, heightAt, seed) {
    const pts = [];
    const segs = typeDef.segs + Math.floor(density * 8) + 4;
    const len = typeDef.length * (1.15 + density * 0.95);
    const step = len / segs;
    let x = start.x;
    let z = start.z;
    let dir = yaw;
    // Prefer mostly-forward paths so Bolt always has a lane to run into
    const curve = typeDef.curve * (typeDef.id === "hidden" ? 1.0 : 0.75);

    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const n = (noise2(seed + x * 0.05, seed + z * 0.05) - 0.5) * 2;
      const n2 = (noise2(seed + z * 0.08, seed + x * 0.07) - 0.5) * 2;
      if (i > 0) {
        dir += n * curve * 0.4;
        // Stay aimed with Bolt's heading (beautiful run corridor)
        dir = THREE.MathUtils.lerp(dir, yaw, typeDef.id === "shortcut" ? 0.55 : 0.35);
        if (typeDef.id === "energy") {
          dir = yaw + Math.sin(t * Math.PI * 1.2 + seed) * 0.35 * Math.max(0.2, curve);
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

      // Main ribbon — subtle guide path (thin + soft glow)
      const mainPts = generatePathPoints(start, yaw, typeDef, Math.max(0.45, density), heightAt, seed);
      const radius =
        typeDef.width *
        (0.7 + density * 0.25) *
        (typeDef.id === "hidden" ? 0.65 : 0.85);

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
    // Crystal — gentler
    if (r < 0.4) return TERRAIN_TYPES.boulders;
    if (r < 0.6) return TERRAIN_TYPES.ridge;
    if (r < 0.78) return TERRAIN_TYPES.crater;
    if (r < 0.9) return TERRAIN_TYPES.cliff;
    return TERRAIN_TYPES.floater;
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
      const jagged = biome.id === "emberVoid" ? 1.35 : biome.id === "whisperStars" ? 0.9 : 0.75;
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
  };

  function pickVegType(density, biomeId, noiseVal) {
    const r = Math.random();
    const n = noiseVal != null ? noiseVal : r;
    // Big trees: more common at higher density / in rich biomes
    if (density > 0.35 && r < 0.1 + density * 0.12) {
      if (r < 0.03 + density * 0.04) return VEG_TYPES.megaTree;
      if (biomeId === "crystalNebula" || biomeId === "jadeCanopy") return VEG_TYPES.spire;
      return VEG_TYPES.tree;
    }
    if (biomeId === "emberVoid") {
      if (density > 0.45 && r < 0.18) return VEG_TYPES.tree;
      if (r < 0.35) return VEG_TYPES.bush;
      if (r < 0.55) return VEG_TYPES.stalk;
      if (r < 0.75) return VEG_TYPES.cluster;
      if (r < 0.9) return VEG_TYPES.flower;
      return VEG_TYPES.spire;
    }
    if (biomeId === "whisperStars") {
      if (density > 0.5 && r < 0.15) return VEG_TYPES.tree;
      if (r < 0.25) return VEG_TYPES.vine;
      if (r < 0.45) return VEG_TYPES.floater;
      if (r < 0.65) return VEG_TYPES.stalk;
      if (r < 0.8) return VEG_TYPES.flower;
      if (r < 0.92) return VEG_TYPES.canopy;
      return VEG_TYPES.cluster;
    }
    if (biomeId === "jadeCanopy") {
      if (r < 0.2) return VEG_TYPES.megaTree;
      if (r < 0.45) return VEG_TYPES.tree;
      if (r < 0.65) return VEG_TYPES.canopy;
      if (r < 0.8) return VEG_TYPES.bush;
      return VEG_TYPES.cluster;
    }
    // Crystal Nebula — ethereal + trees
    if (density > 0.4 && n > 0.55 && r < 0.28) return VEG_TYPES.canopy;
    if (r < 0.18) return VEG_TYPES.tree;
    if (r < 0.28) return VEG_TYPES.spire;
    if (r < 0.42) return VEG_TYPES.stalk;
    if (r < 0.55) return VEG_TYPES.flower;
    if (r < 0.68) return VEG_TYPES.cluster;
    if (r < 0.8) return VEG_TYPES.vine;
    if (r < 0.9) return VEG_TYPES.bush;
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
          if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose());
          else c.material.dispose();
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

      function plantMat(col, eCol, eInt, rough, opac) {
        return mkMat(col, {
          emissive: eCol,
          emissiveIntensity: eInt != null ? eInt : 0.6,
          roughness: rough != null ? rough : 0.55,
          metalness: isCrystal ? 0.25 : 0.08,
          opacity: opac != null ? opac : 0.95,
          flat: isEmber,
        });
      }

      function addSway(mesh, amount) {
        mesh.userData.swayAmt = amount || 0.04;
        mesh.userData.swayPhase = seed + mesh.id * 0.1;
        swayParts.push(mesh);
      }

      function placePlant(fn, cx, cz, scale) {
        const pg = new THREE.Group();
        fn(pg, scale);
        pg.position.set(cx, 0, cz);
        pg.rotation.y = noise2(cx + seed, cz) * Math.PI * 2;
        // Lean
        pg.rotation.z = (noise2(cz, seed) - 0.5) * 0.25;
        pg.rotation.x = (noise2(seed, cx) - 0.5) * 0.18;
        group.add(pg);
        return pg;
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

      function buildCanopy(pg, s) {
        const trunkH = (1.6 + density) * s;
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08 * s, 0.14 * s, trunkH, 7),
          plantMat(isCrystal ? 0x4c1d95 : 0x3d2b1f, plantEm, 0.25, 0.9)
        );
        trunk.position.y = trunkH * 0.5;
        trunk.castShadow = true;
        pg.add(trunk);
        const layers = 2 + Math.floor(density * 2);
        for (let i = 0; i < layers; i++) {
          const crown = new THREE.Mesh(
            new THREE.IcosahedronGeometry((0.55 + i * 0.15) * s, 0),
            plantMat(plantCol, plantEm, 0.85 + density * 0.3, 0.45)
          );
          crown.position.y = trunkH * 0.75 + i * 0.4 * s;
          crown.scale.set(1.1 - i * 0.12, 0.65, 1.1 - i * 0.12);
          crown.castShadow = true;
          pg.add(crown);
          addSway(crown, 0.03);
        }
        const halo = new THREE.Mesh(
          new THREE.SphereGeometry(0.9 * s, 10, 10),
          plantMat(accent, em, 0.6, 0.2, 0.22)
        );
        halo.position.y = trunkH + 0.3 * s;
        pg.add(halo);
      }

      /** Beautiful mid-size world tree */
      function buildTree(pg, s) {
        const trunkH = (2.8 + density * 1.4) * s;
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.12 * s, 0.22 * s, trunkH, 8),
          plantMat(isEmber ? 0x3b1c0a : isCrystal ? 0x2e1065 : 0x2d1b0e, plantEm, 0.2, 0.92)
        );
        trunk.position.y = trunkH * 0.5;
        trunk.castShadow = true;
        pg.add(trunk);
        // Root flare
        const roots = new THREE.Mesh(
          new THREE.CylinderGeometry(0.28 * s, 0.38 * s, 0.25 * s, 8),
          plantMat(isEmber ? 0x3b1c0a : 0x2d1b0e, plantEm, 0.15, 0.95)
        );
        roots.position.y = 0.1 * s;
        pg.add(roots);
        // Layered canopy lobes
        const lobes = 4 + Math.floor(density * 3);
        for (let i = 0; i < lobes; i++) {
          const a = (i / lobes) * Math.PI * 2 + seed;
          const rr = (0.45 + Math.random() * 0.35) * s;
          const crown = new THREE.Mesh(
            new THREE.IcosahedronGeometry((0.7 + Math.random() * 0.35) * s, 0),
            plantMat(plantCol, plantEm, 0.7 + density * 0.4, 0.5)
          );
          crown.position.set(
            Math.cos(a) * rr,
            trunkH * 0.85 + (Math.random() - 0.3) * 0.5 * s,
            Math.sin(a) * rr
          );
          crown.scale.set(1.15, 0.75 + Math.random() * 0.3, 1.15);
          crown.castShadow = true;
          pg.add(crown);
          addSway(crown, 0.025);
        }
        // Apex crown
        const apex = new THREE.Mesh(
          new THREE.SphereGeometry(0.85 * s, 12, 10),
          plantMat(plantCol, plantEm, 0.95, 0.4)
        );
        apex.position.y = trunkH + 0.35 * s;
        apex.scale.set(1.2, 0.7, 1.2);
        apex.castShadow = true;
        pg.add(apex);
        // Soft biolum under-canopy
        const under = new THREE.Mesh(
          new THREE.SphereGeometry(1.1 * s, 12, 10),
          plantMat(accent, em, 0.55, 0.2, 0.18)
        );
        under.position.y = trunkH * 0.9;
        pg.add(under);
      }

      /** Huge landmark tree — sparse, beautiful */
      function buildMegaTree(pg, s) {
        const trunkH = (5.5 + density * 2.5) * s;
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.28 * s, 0.55 * s, trunkH, 10),
          plantMat(isCrystal ? 0x3b0764 : 0x1c1008, plantEm, 0.18, 0.95)
        );
        trunk.position.y = trunkH * 0.5;
        trunk.castShadow = true;
        pg.add(trunk);
        // Branch arms
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          const arm = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.08 * s, 1.4 * s, 4, 6),
            plantMat(isCrystal ? 0x4c1d95 : 0x2d1b0e, plantEm, 0.2, 0.9)
          );
          arm.position.set(
            Math.cos(a) * 0.35 * s,
            trunkH * (0.55 + i * 0.06),
            Math.sin(a) * 0.35 * s
          );
          arm.rotation.z = Math.cos(a) * 0.9;
          arm.rotation.x = Math.sin(a) * 0.9;
          pg.add(arm);
          const blob = new THREE.Mesh(
            new THREE.IcosahedronGeometry((1.1 + Math.random() * 0.4) * s, 0),
            plantMat(plantCol, plantEm, 0.9, 0.42)
          );
          blob.position.set(
            Math.cos(a) * 1.6 * s,
            trunkH * 0.75 + Math.sin(i) * 0.4 * s,
            Math.sin(a) * 1.6 * s
          );
          blob.scale.set(1.3, 0.7, 1.3);
          blob.castShadow = true;
          pg.add(blob);
          addSway(blob, 0.02);
        }
        // Giant crown cloud
        const mega = new THREE.Mesh(
          new THREE.SphereGeometry(2.2 * s, 14, 12),
          plantMat(plantCol, plantEm, 0.75, 0.4)
        );
        mega.position.y = trunkH + 0.6 * s;
        mega.scale.set(1.4, 0.65, 1.4);
        mega.castShadow = true;
        pg.add(mega);
        // Resonance fruit
        for (let i = 0; i < 4; i++) {
          const fruit = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.18 * s, 0),
            plantMat(0xfbbf24, 0xf59e0b, 1.4, 0.2)
          );
          fruit.position.set(
            (Math.random() - 0.5) * 2 * s,
            trunkH * 0.7 + Math.random() * s,
            (Math.random() - 0.5) * 2 * s
          );
          pg.add(fruit);
        }
        const halo = new THREE.Mesh(
          new THREE.SphereGeometry(2.8 * s, 14, 12),
          plantMat(accent, em, 0.45, 0.15, 0.12)
        );
        halo.position.y = trunkH + 0.4 * s;
        pg.add(halo);
      }

      /** Crystal / ice spire tree */
      function buildSpire(pg, s) {
        const h = (3.2 + density * 2) * s;
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.06 * s, 0.16 * s, h * 0.55, 6),
          plantMat(isEmber ? 0x7c2d12 : 0x334155, plantEm, 0.35, 0.5)
        );
        trunk.position.y = h * 0.28;
        trunk.castShadow = true;
        pg.add(trunk);
        for (let i = 0; i < 5; i++) {
          const cryst = new THREE.Mesh(
            new THREE.ConeGeometry((0.35 - i * 0.04) * s, (1.1 - i * 0.12) * s, 5),
            plantMat(accent, em, 1.1 + i * 0.1, 0.2)
          );
          cryst.position.set(
            (Math.random() - 0.5) * 0.4 * s,
            h * 0.45 + i * 0.35 * s,
            (Math.random() - 0.5) * 0.4 * s
          );
          cryst.rotation.z = (Math.random() - 0.5) * 0.35;
          cryst.rotation.x = (Math.random() - 0.5) * 0.25;
          cryst.castShadow = true;
          pg.add(cryst);
        }
        const tip = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.28 * s, 0),
          plantMat(0xe0f2fe, em, 1.6, 0.15)
        );
        tip.position.y = h * 0.95;
        pg.add(tip);
        addSway(pg, 0.02);
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
    // Crystal Nebula
    if (r < 0.22) return RUIN_TYPES.arch;
    if (r < 0.42) return RUIN_TYPES.outpost;
    if (r < 0.58) return RUIN_TYPES.monolith;
    if (r < 0.72) return RUIN_TYPES.tower;
    if (r < 0.85) return RUIN_TYPES.platform;
    if (density > 0.5) return RUIN_TYPES.temple;
    return RUIN_TYPES.outpost;
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
          if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose());
          else c.material.dispose();
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

      function stoneMat(extraEm) {
        return mkMat(ruinCol, {
          metalness: isCrystal ? 0.35 : isEmber ? 0.15 : 0.28,
          roughness: isEmber ? 0.92 : isWhisper ? 0.78 : 0.55,
          flat: isEmber,
          emissive: extraEm ? em : isWhisper ? 0x1e1b4b : 0x0f172a,
          emissiveIntensity: extraEm ? 0.35 : isWhisper ? 0.12 : 0.08,
        });
      }
      function runeMat() {
        return mkMat(accent, {
          emissive: em,
          emissiveIntensity: 0.85 + resonance * 0.6,
          metalness: 0.5,
          roughness: 0.3,
          opacity: 0.9,
        });
      }
      function goldMat() {
        return mkMat(0xfbbf24, {
          emissive: 0xf59e0b,
          emissiveIntensity: 1.3 + resonance * 0.5,
          metalness: 0.7,
          roughness: 0.18,
        });
      }

      function addPillar(x, z, h, lean) {
        const thick = (0.55 + Math.random() * 0.25) * S * 0.45;
        const p = new THREE.Mesh(
          new THREE.BoxGeometry(thick, h, thick * 0.95),
          stoneMat(isCrystal && Math.random() < 0.3)
        );
        p.position.set(x, h * 0.5, z);
        p.rotation.z = lean || (noise2(x + seed, z) - 0.5) * (isEmber ? 0.35 : 0.12);
        p.rotation.x = (noise2(z, seed) - 0.5) * (isEmber ? 0.2 : 0.08);
        p.castShadow = true;
        p.receiveShadow = true;
        group.add(p);
        if (isCrystal && Math.random() < 0.4) {
          const gem = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.22 * S * 0.4, 0),
            mkMat(accent, { emissive: em, emissiveIntensity: 1.1, metalness: 0.6, roughness: 0.2 })
          );
          gem.position.set(x, h * (0.4 + Math.random() * 0.4), z + thick * 0.6);
          group.add(gem);
          pulseParts.push(gem);
        }
        return p;
      }

      function addWall(x, z, w, h, rotY) {
        const wall = new THREE.Mesh(
          new THREE.BoxGeometry(w, h, 0.45 * S * 0.35),
          stoneMat(false)
        );
        wall.position.set(x, h * 0.5, z);
        wall.rotation.y = rotY || 0;
        if (isEmber) wall.rotation.z = (Math.random() - 0.5) * 0.25;
        wall.castShadow = true;
        wall.receiveShadow = true;
        group.add(wall);
        if (isEmber || Math.random() < 0.35) {
          const chunk = new THREE.Mesh(
            new THREE.BoxGeometry(w * 0.25, h * 0.2, 0.3 * S * 0.3),
            stoneMat(false)
          );
          chunk.position.set(x + (Math.random() - 0.5) * w * 0.3, h * 0.7, z + 0.35);
          chunk.rotation.set(Math.random(), Math.random(), Math.random());
          group.add(chunk);
        }
        return wall;
      }

      function addArch(cx, cz, h, w) {
        addPillar(cx - w * 0.5, cz, h, 0.05);
        addPillar(cx + w * 0.5, cz, h, -0.05);
        const beam = new THREE.Mesh(
          new THREE.BoxGeometry(w + 0.9 * S * 0.3, 0.45 * S * 0.35, 0.55 * S * 0.35),
          stoneMat(isCrystal)
        );
        beam.position.set(cx, h + 0.12, cz);
        beam.rotation.z = isEmber ? (Math.random() - 0.5) * 0.3 : 0;
        beam.castShadow = true;
        group.add(beam);
        const key = new THREE.Mesh(
          new THREE.BoxGeometry(0.7 * S * 0.35, 0.55 * S * 0.35, 0.6 * S * 0.35),
          runeMat()
        );
        key.position.set(cx, h + 0.15, cz);
        group.add(key);
        pulseParts.push(key);
      }

      function addPlatform(y, size, float) {
        const plat = new THREE.Mesh(
          new THREE.CylinderGeometry(size * 0.9, size, 0.55 * S * 0.3, isWhisper ? 6 : 8),
          stoneMat(false)
        );
        plat.position.y = y + 0.28;
        plat.castShadow = true;
        plat.receiveShadow = true;
        group.add(plat);
        if (float) {
          const ring = new THREE.Mesh(
            new THREE.TorusGeometry(size * 0.7, 0.1 * S * 0.3, 6, 24),
            runeMat()
          );
          ring.rotation.x = Math.PI / 2;
          ring.position.y = y - 0.35;
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

      // ----- BUILD BY TYPE (mega landmark scale) -----
      if (type.id === "monolith") {
        const h = (7.5 + density * 5 + complexity * 2.5) * S * 0.55 * (isWhisper ? 1.25 : 1);
        const mono = new THREE.Mesh(
          new THREE.BoxGeometry(1.6 * S * 0.4, h, 1.1 * S * 0.4),
          stoneMat(true)
        );
        mono.position.y = h * 0.5;
        mono.rotation.y = noise2(seed, 1) * 0.4;
        if (isEmber) mono.rotation.z = 0.12;
        mono.castShadow = true;
        group.add(mono);
        const face = new THREE.Mesh(
          new THREE.BoxGeometry(1.65 * S * 0.4, h * 0.5, 0.14 * S * 0.3),
          runeMat()
        );
        face.position.set(0, h * 0.55, 0.6 * S * 0.35);
        group.add(face);
        pulseParts.push(face);
        addRunePlate(0, 0.15, 1.8 * S * 0.35, 0);
        if (density > 0.35 || resonance > 0.3) addStarCoreLoot(0, h * 0.85, 0.8 * S * 0.3);
        addRubble(3 + Math.floor(complexity * 2), 5.5 * S * 0.35);
      } else if (type.id === "arch") {
        addPlatform(0, (4.0 + density * 1.5) * S * 0.35, false);
        addArch(0, 0, (5.5 + density * 3) * S * 0.4, (4.2 + density * 1.2) * S * 0.35);
        if (complexity > 0.7) addArch(0, -3.5 * S * 0.35, (4.2 + density * 2) * S * 0.4, 3.2 * S * 0.35);
        addRunePlate(0, 0.7, 2.8 * S * 0.35, 0);
        if (Math.random() < 0.55 + density * 0.3) addStarCoreLoot(0, 1.2 * S * 0.35, 0);
        addRubble(4, 6 * S * 0.35);
        if (isCrystal) {
          for (let i = 0; i < 2; i++) {
            const c = new THREE.Mesh(
              new THREE.ConeGeometry(0.35 * S * 0.3, 2.0 * S * 0.35, 5),
              mkMat(accent, { emissive: em, emissiveIntensity: 1.1, metalness: 0.6, roughness: 0.2 })
            );
            c.position.set((i - 0.5) * 3.5 * S * 0.35, 1.0 * S * 0.3, 0.8);
            group.add(c);
          }
        }
      } else if (type.id === "outpost") {
        const baseSz = (5.5 + density * 2.5) * S * 0.35;
        addPlatform(0, baseSz * 0.55, false);
        const ph = (4.0 + density * 3.5 * complexity) * S * 0.4;
        const spread = 2.8 * S * 0.35;
        const corners = [
          [1, 1],
          [-1, 1],
          [1, -1],
          [-1, -0.9],
        ];
        corners.forEach((c, i) => {
          const broken = isEmber && i > 1;
          addPillar(c[0] * spread, c[1] * spread * 0.85, broken ? ph * 0.45 : ph);
        });
        addWall(0, spread * 0.9, 5.0 * S * 0.35 + density, (2.4 + density) * S * 0.4, 0);
        if (complexity > 0.6) addWall(-spread, 0, 4.0 * S * 0.35, 2.6 * S * 0.4, Math.PI / 2);
        const beam = new THREE.Mesh(
          new THREE.BoxGeometry(5.0 * S * 0.35, 0.4 * S * 0.3, 0.45 * S * 0.3),
          stoneMat(false)
        );
        beam.position.set(0.4, ph * 0.7, spread * 0.8);
        beam.rotation.z = -0.35;
        group.add(beam);
        addRunePlate(0, 0.7, -spread * 0.85, Math.PI);
        addEnergyVent(spread * 0.5, -spread * 0.35);
        if (density > 0.25 || resonance > 0.25) addStarCoreLoot(0, 1.4 * S * 0.35, 0);
        addRubble(5 + Math.floor(complexity * 2), 7 * S * 0.35);
      } else if (type.id === "tower") {
        const levels = 3 + Math.floor(complexity * 2);
        let y = 0;
        for (let i = 0; i < levels; i++) {
          const s = (3.6 - i * 0.35) * S * 0.35;
          const h = (2.8 + density * 0.6) * S * 0.4;
          const seg = new THREE.Mesh(
            new THREE.BoxGeometry(s, h, s),
            stoneMat(i === levels - 1 && isCrystal)
          );
          seg.position.y = y + h * 0.5;
          if (isEmber && i === levels - 1) {
            seg.rotation.z = 0.4;
            seg.position.x = 0.8;
          }
          seg.castShadow = true;
          group.add(seg);
          y += h * 0.92;
        }
        addRubble(6, 5.5 * S * 0.35);
        addPillar(3.2 * S * 0.35, 1.0, (3.5 + density * 2) * S * 0.4, 0.4);
        addRunePlate(0, 0.2, 3.0 * S * 0.35, 0);
        if (Math.random() < 0.6 + resonance * 0.3) addStarCoreLoot(0, y * 0.45, 0);
      } else if (type.id === "platform") {
        const floatY = (isWhisper ? 3.5 + density * 3 : 1.2 + density * 1.2) * S * 0.35;
        addPlatform(floatY, (4.0 + density * 1.8) * S * 0.35, true);
        const n = 3 + Math.floor(complexity * 2);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + seed;
          const ph = (2.2 + density * 1.5) * S * 0.4;
          const px = Math.cos(a) * 2.6 * S * 0.35;
          const pz = Math.sin(a) * 2.6 * S * 0.35;
          const p = new THREE.Mesh(
            new THREE.BoxGeometry(0.55 * S * 0.35, ph, 0.55 * S * 0.35),
            stoneMat(isCrystal)
          );
          p.position.set(px, floatY + 0.4 + ph * 0.5, pz);
          p.castShadow = true;
          group.add(p);
        }
        addRunePlate(0, floatY + 0.7, 0, 0);
        addStarCoreLoot(0, floatY + 1.2, 0);
        if (isWhisper) {
          for (let i = 0; i < 6; i++) {
            const star = new THREE.Mesh(
              new THREE.SphereGeometry(0.12 * S * 0.3, 6, 6),
              mkMat(0xe0e7ff, { emissive: 0xa5b4fc, emissiveIntensity: 1.4 })
            );
            const a = (i / 6) * Math.PI * 2;
            star.position.set(Math.cos(a) * 3.5 * S * 0.35, floatY + 2.0, Math.sin(a) * 3.5 * S * 0.35);
            group.add(star);
            pulseParts.push(star);
          }
        }
      } else if (type.id === "temple") {
        addPlatform(0, (7.5 + density * 2) * S * 0.35, false);
        const cols = 8 + Math.floor(density * 2);
        for (let i = 0; i < cols; i++) {
          const a = (i / cols) * Math.PI * 2;
          const rad = (5.5 + density) * S * 0.35;
          addPillar(Math.cos(a) * rad, Math.sin(a) * rad, (6.0 + density * 3 * complexity) * S * 0.4);
        }
        addWall(0, 4.0 * S * 0.35, 6.5 * S * 0.35, (3.8 + density * 1.5) * S * 0.4, 0);
        addWall(0, -4.0 * S * 0.35, 6.5 * S * 0.35, 3.2 * S * 0.4, 0);
        addArch(0, 0, (6.5 + density * 2.5) * S * 0.4, 4.8 * S * 0.35);
        const altar = new THREE.Mesh(
          new THREE.CylinderGeometry(1.4 * S * 0.35, 1.7 * S * 0.35, 1.1 * S * 0.35, 8),
          stoneMat(true)
        );
        altar.position.y = 0.7 * S * 0.35;
        group.add(altar);
        addStarCoreLoot(0, 2.0 * S * 0.35, 0);
        if (resonance > 0.45) addStarCoreLoot(3.0 * S * 0.35, 1.2 * S * 0.35, 2.0 * S * 0.35);
        addRunePlate(0, 0.3, 5.0 * S * 0.35, 0);
        addRunePlate(0, 0.3, -5.0 * S * 0.35, Math.PI);
        addEnergyVent(-3.8 * S * 0.35, 0);
        addEnergyVent(3.8 * S * 0.35, 0);
        addRubble(8, 10 * S * 0.35);
        for (let i = 0; i < 4; i++) {
          const spire = new THREE.Mesh(
            new THREE.ConeGeometry(0.4 * S * 0.3, (2.8 + density * 1.5) * S * 0.35, 5),
            isEmber
              ? mkMat(0x7c2d12, { emissive: 0xea580c, emissiveIntensity: 0.7, roughness: 0.7 })
              : mkMat(accent, { emissive: em, emissiveIntensity: 1.2, metalness: 0.55, roughness: 0.2 })
          );
          spire.position.set((i - 1.5) * 2.4 * S * 0.35, 1.5 * S * 0.3, 6.0 * S * 0.35);
          group.add(spire);
        }
      } else if (type.id === "wreck") {
        addPlatform(0, 4.5 * S * 0.35, false);
        const fallen = new THREE.Mesh(
          new THREE.BoxGeometry(3.0 * S * 0.35, 2.2 * S * 0.35, 8.0 * S * 0.35),
          stoneMat(false)
        );
        fallen.position.set(1.2, 1.2 * S * 0.3, 0.5);
        fallen.rotation.z = 0.55;
        fallen.rotation.y = 0.3;
        fallen.castShadow = true;
        group.add(fallen);
        addPillar(-3.0 * S * 0.35, 2.0 * S * 0.35, 5.0 * S * 0.4, 0.5);
        addPillar(3.5 * S * 0.35, -1.5 * S * 0.35, 2.5 * S * 0.4, -0.3);
        addWall(-0.5, -3.0 * S * 0.35, 6.5 * S * 0.35, 1.8 * S * 0.4, 0.2);
        for (let i = 0; i < 4; i++) {
          const scorch = new THREE.Mesh(
            new THREE.CircleGeometry((1.2 + Math.random() * 0.9) * S * 0.35, 10),
            mkMat(0x1a0805, {
              emissive: 0x3b1208,
              emissiveIntensity: 0.4,
              roughness: 1,
              opacity: 0.85,
            })
          );
          scorch.rotation.x = -Math.PI / 2;
          scorch.position.set((Math.random() - 0.5) * 5, 0.06, (Math.random() - 0.5) * 5);
          group.add(scorch);
        }
        addEnergyVent(2.0 * S * 0.35, 1.2 * S * 0.35);
        if (Math.random() < 0.5 + density * 0.3) {
          const lava = new THREE.Mesh(
            new THREE.CircleGeometry(1.1 * S * 0.35, 10),
            mkMat(0xf97316, { emissive: 0xea580c, emissiveIntensity: 1.3, opacity: 0.9 })
          );
          lava.rotation.x = -Math.PI / 2;
          lava.position.set(-1.2, 0.08, 0.8);
          group.add(lava);
          pulseParts.push(lava);
        }
        addRunePlate(0, 0.6, 3.2 * S * 0.35, 0);
        if (density > 0.3 || resonance > 0.2) addStarCoreLoot(0, 1.6 * S * 0.35, 0);
        addRubble(8, 8 * S * 0.35);
      }

      // Overgrown flora on ruin
      if (!isEmber && density > 0.3 && Math.random() < 0.5) {
        for (let i = 0; i < 4; i++) {
          const moss = new THREE.Mesh(
            new THREE.SphereGeometry(0.3 * S * 0.3, 6, 6),
            mkMat(biome.plant || 0xa78bfa, {
              emissive: biome.plantEmissive || 0x7c3aed,
              emissiveIntensity: 0.5,
              roughness: 0.8,
              opacity: 0.85,
            })
          );
          moss.position.set(
            (Math.random() - 0.5) * 5 * S * 0.35,
            0.4 + Math.random() * 2.5,
            (Math.random() - 0.5) * 5 * S * 0.35
          );
          group.add(moss);
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
        path: new ObjectPool(createPathMesh, "path", 16),
        terrain: new ObjectPool(createTerrainMesh, "terrain", 40),
        vegetation: new ObjectPool(createVegetationMesh, "vegetation", 72),
        ruin: new ObjectPool(createRuinMesh, "ruin", 20),
        detail: new ObjectPool(createDetailMesh, "detail", 80),
      };
      this.pathTypeStats = { hidden: 0, shortcut: 0, branch: 0, energy: 0 };
      this.terrainTypeStats = { boulders: 0, ridge: 0, crater: 0, cliff: 0, floater: 0 };
      this.vegTypeStats = {
        stalk: 0, flower: 0, bush: 0, vine: 0, cluster: 0, floater: 0, canopy: 0,
        tree: 0, megaTree: 0, spire: 0,
      };
      this.ruinTypeStats = {
        monolith: 0, outpost: 0, tower: 0, arch: 0, platform: 0, temple: 0, wreck: 0,
      };
      this.detailTypeStats = {
        crystals: 0, vent: 0, shaft: 0, motes: 0, debris: 0, scorch: 0, residue: 0, footprints: 0,
      };
      this.pathCooldown = 0;
      this.terrainCooldown = 0;
      this.vegCooldown = 0;
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
     * Place a spawn around Bolt: mostly SIDE + SIDE-FORWARD, never on him.
     * Dead-ahead and underfoot are avoided so Bolt is never hidden.
     * @returns {{x,z}|null}
     */
    _placeAround(origin, yaw, opts) {
      opts = opts || {};
      const orbital = !!opts.orbital;
      const minR = opts.minR != null ? opts.minR : orbital ? 22 : 12;
      const maxR = opts.maxR != null ? opts.maxR : orbital ? 80 : 36;
      const preferSide = opts.preferSide !== false;
      const fx = Math.sin(yaw);
      const fz = Math.cos(yaw);
      const rx = Math.cos(yaw);
      const rz = -Math.sin(yaw);
      const ox = origin.x;
      const oz = origin.z;
      const stackMin = opts.stackMin != null ? opts.stackMin : 2.5;
      // Hard personal bubble — never spawn inside this radius of Bolt
      const clearR = opts.clearR != null ? opts.clearR : minR;

      for (let attempt = 0; attempt < 12; attempt++) {
        const r = minR + Math.random() * Math.max(0.5, maxR - minR);
        let ang;
        if (preferSide && !orbital) {
          // 70% pure flanks · 30% side-forward (diagonal) · almost never dead-ahead
          const mode = Math.random();
          const sideSign = Math.random() > 0.5 ? 1 : -1;
          if (mode < 0.45) {
            // pure left/right flank
            ang = sideSign * (Math.PI * 0.5 + (Math.random() - 0.5) * 0.55);
          } else if (mode < 0.85) {
            // side-forward diagonal (~30–60° off heading)
            ang = sideSign * (0.55 + Math.random() * 0.55);
          } else {
            // soft side-back (behind flanks) so world fills around Bolt
            ang = sideSign * (Math.PI * 0.55 + Math.random() * 0.5);
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
      // Surface allows denser micro decoration again
      if (pool.activeCount >= (orbital ? 18 : 56)) return false;
      if (this.detailCooldown > 0 && density < (orbital ? 0.4 : 0.55)) return false;

      const origin = playerPos || pred;
      // Around Bolt, never underfoot — clear bubble ~6m on surface
      const placed = this._placeAround(origin, yaw, {
        orbital: orbital,
        minR: orbital ? 22 : 11,
        maxR: orbital ? 70 : 32,
        preferSide: true,
        clearR: orbital ? 18 : 10,
        stackMin: orbital ? 12 : 2.8,
        jitter: orbital ? 5 : 2,
      });
      if (!placed) return false;
      const x = placed.x;
      const z = placed.z;

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
        : THREE.MathUtils.lerp(0.14, 0.04, Math.min(1, density + resonance * 0.4));
      if (!orbital && density > 0.5) this.detailCooldown *= 0.55;

      this._remember(x, z);
      this.stats.spawned++;
      return true;
    }

    /**
     * RuinGenerator — ancient modular landmarks ahead of Bolt
     * Flat ground preferred · path-adjacent · complexity ↑ with score + Resonance
     */
    _spawnRuin(pred, yaw, density, biome, resonance, pool, playerPos) {
      if (pool.activeCount >= 14) return false;
      if (this.ruinCooldown > 0) return false;

      const st = this._scaleStage || "paw";
      const orbital =
        st === "orbital" || st === "solar" || st === "cosmic";

      const origin = playerPos || pred;

      // Ruins far on flanks / side-forward — never hide Bolt
      const placed = this._placeAround(origin, yaw, {
        orbital: orbital,
        minR: orbital ? 120 : 85,
        maxR: orbital ? 300 : 180,
        preferSide: true,
        clearR: orbital ? 100 : 75,
        stackMin: orbital ? 95 : 80,
        jitter: orbital ? 10 : 5,
      });
      if (!placed) return false;
      const x = placed.x;
      const z = placed.z;

      const surface = this.heightAt(x, z);
      if (!orbital) {
        const hN = this.heightAt(x + 4, z);
        const hE = this.heightAt(x, z + 4);
        if (Math.abs(hN - surface) > 2.4 || Math.abs(hE - surface) > 2.4) return false;
      }

      const e = pool.acquire();
      if (!e) return false;

      // Orbital prefers stations / platforms / wrecks / temples
      let typeDef = pickRuinType(density, biome.id, resonance);
      if (orbital) {
        const roll = Math.random();
        if (roll < 0.3) typeDef = RUIN_TYPES.platform;
        else if (roll < 0.5) typeDef = RUIN_TYPES.wreck;
        else if (roll < 0.7) typeDef = RUIN_TYPES.temple;
        else if (roll < 0.85) typeDef = RUIN_TYPES.tower;
        else typeDef = RUIN_TYPES.arch;
      }
      if (this.ruinTypeStats[typeDef.id] != null) this.ruinTypeStats[typeDef.id]++;

      RuinGenerator.layout(e.mesh, {
        typeDef: typeDef,
        biome: biome,
        density: density,
        resonance: resonance || 0,
        seed: Math.random() * 200,
        orbital: orbital,
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
        (orbital ? 3.6 : 2.4) +
        density * (orbital ? 2.2 : 1.4) +
        (typeDef.id === "temple" ? 1.4 : 0) +
        (typeDef.id === "monolith" || typeDef.id === "tower" ? 0.8 : 0);
      const life = 20 + density * 14 + resonance * 6 + (orbital ? 10 : 0);

      e.active = true;
      e.age = 0;
      e.life = life;
      e.fade = 0.15;
      e.fadingOut = false;
      e.baseScale = scale;
      e.homeY = y;
      e.mesh.position.set(x, y, z);
      e.mesh.rotation.y = yaw + (Math.random() - 0.5) * 0.9;
      if (orbital) e.mesh.rotation.z = (Math.random() - 0.5) * 0.35;
      e.mesh.scale.setScalar(scale * 0.25);
      e.mesh.visible = true;
      e.mesh.traverse((c) => {
        if (c.material) {
          const mats = Array.isArray(c.material) ? c.material : [c.material];
          mats.forEach((m) => {
            m.transparent = true;
            const base = m.userData.baseOpacity != null ? m.userData.baseOpacity : 1;
            m.opacity = 0.15 * base;
            m.depthWrite = false;
          });
        }
      });
      e.mesh.userData.kind = "ruin";
      e.mesh.userData.ruinType = typeDef.id;

      this.ruinCooldown = orbital
        ? THREE.MathUtils.lerp(1.4, 0.45, Math.min(1, density + resonance * 0.3))
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
     * VegetationGenerator — organic clusters near run line (noise forests + clearings)
     * Avoids path center; flanks routes; density scales with sprint score.
     */
    _spawnVegetation(pred, yaw, density, biome, resonance, pool, playerPos) {
      // Vegetation doesn't make sense in orbit
      const st = this._scaleStage || "paw";
      if (st === "orbital" || st === "solar" || st === "cosmic") return false;
      if (pool.activeCount >= 56) return false;
      if (this.vegCooldown > 0) return false;

      const origin = playerPos || pred;

      // Noise field decides forest vs clearing
      const noiseSample = fbm(origin.x * 0.04 + this.stats.spawned * 0.1, origin.z * 0.04, 3);
      // Sparse biomes / clearings skip more often
      const clearThresh = biome.id === "whisperStars" ? 0.42 : biome.id === "emberVoid" ? 0.28 : 0.22;
      if (noiseSample < clearThresh && density < 0.7) {
        this.vegCooldown = 0.15;
        return false;
      }

      const typeDef = pickVegType(density, biome.id, noiseSample);
      const isBig =
        typeDef.id === "tree" ||
        typeDef.id === "megaTree" ||
        typeDef.id === "spire" ||
        typeDef.id === "canopy";

      // Flora on sides + side-forward only — clear sprint corridor
      const placed = this._placeAround(origin, yaw, {
        orbital: false,
        minR: isBig ? 22 : 12,
        maxR: isBig ? 55 + density * 14 : 36 + density * 10,
        preferSide: true,
        clearR: isBig ? 20 : 11,
        stackMin: isBig ? 16 : 4.2,
        jitter: 2.6,
      });
      if (!placed) return false;
      const x = placed.x;
      const z = placed.z;

      const surface = this.heightAt(x, z);
      // Simple slope check — skip very steep (height delta nearby)
      const h2 = this.heightAt(x + 1.5, z + 1.5);
      if (Math.abs(h2 - surface) > 2.8) return false;

      const e = pool.acquire();
      if (!e) return false;

      if (this.vegTypeStats[typeDef.id] != null) this.vegTypeStats[typeDef.id]++;

      VegetationGenerator.layout(e.mesh, {
        typeDef: typeDef,
        biome: biome,
        density: density,
        resonance: resonance || 0,
        seed: noiseSample * 100 + Math.random() * 50,
      });

      let scale = 0.9 + density * 0.55 + (biome.id === "crystalNebula" ? 0.1 : 0);
      if (typeDef.id === "megaTree") scale *= 1.55;
      else if (typeDef.id === "tree") scale *= 1.3;
      else if (typeDef.id === "spire" || typeDef.id === "canopy") scale *= 1.2;
      const life = 11 + density * 12 + resonance * 4 + Math.random() * 4;

      e.active = true;
      e.age = 0;
      e.life = life;
      e.fade = 0.25;
      e.fadingOut = false;
      e.baseScale = scale;
      e.homeY = surface;
      e.mesh.position.set(x, surface, z);
      e.mesh.rotation.y = Math.random() * Math.PI * 2;
      e.mesh.scale.setScalar(scale * 0.35);
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

      // Fast respawn — dense living world on flanks
      this.vegCooldown = THREE.MathUtils.lerp(0.2, 0.05, Math.min(1, density)) + Math.random() * 0.05;
      if (density > 0.35 && Math.random() < 0.55) {
        this.vegCooldown *= 0.4;
      }

      this._remember(x, z);
      this.stats.spawned++;
      return true;
    }

    /**
     * TerrainFeatureGenerator — solid landscape near / ahead of Bolt
     */
    _spawnTerrain(pred, yaw, density, biome, resonance, pool, playerPos) {
      const st = this._scaleStage || "paw";
      const orbital = st === "orbital" || st === "solar" || st === "cosmic";
      if (pool.activeCount >= (orbital ? 12 : 22)) return false;
      if (this.terrainCooldown > 0) return false;

      const origin = playerPos || pred;

      // Rocks/ridges on flanks — never under Bolt
      const placed = this._placeAround(origin, yaw, {
        orbital: orbital,
        minR: orbital ? 28 : 16,
        maxR: orbital ? 80 : 40,
        preferSide: true,
        clearR: orbital ? 24 : 14,
        stackMin: orbital ? 18 : 9,
        jitter: orbital ? 5 : 2.5,
      });
      if (!placed) return false;
      const x = placed.x;
      const z = placed.z;
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
      }
      if (this.terrainTypeStats[typeDef.id] != null) this.terrainTypeStats[typeDef.id]++;

      TerrainFeatureGenerator.layout(e.mesh, {
        typeDef: typeDef,
        biome: biome,
        density: density * (orbital ? 1.25 : 1),
        seed: Math.random() * 100,
        orbital: orbital,
      });

      let y = surface;
      if (orbital) {
        const baseAlt = st === "cosmic" ? 50 : st === "solar" ? 38 : 26;
        y = Math.max(origin.y, surface) + baseAlt * 0.55 + Math.random() * 30;
      }
      const scale = orbital
        ? 2.4 + density * 1.6
        : 1.0 + density * 0.35;
      const life = 14 + density * 10 + resonance * 3 + (orbital ? 8 : 0);

      e.active = true;
      e.age = 0;
      e.life = life;
      e.fade = 0.35;
      e.fadingOut = false;
      e.baseScale = scale;
      e.homeY = y;
      e.mesh.position.set(x, y, z);
      e.mesh.rotation.y = yaw + (Math.random() - 0.5) * 0.8;
      if (orbital) {
        e.mesh.rotation.x = (Math.random() - 0.5) * 0.6;
        e.mesh.rotation.z = (Math.random() - 0.5) * 0.6;
      }
      e.mesh.scale.setScalar(scale * (orbital ? 0.55 : 0.4));
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

      this.terrainCooldown = orbital
        ? 0.9 + Math.random() * 0.5
        : 0.45 + Math.random() * 0.35 - density * 0.15;
      this._remember(x, z);
      this.stats.spawned++;
      return true;
    }

    /**
     * PathGenerator — starts ahead of Bolt (never underfoot), in frame while sprinting
     */
    _spawnPath(pred, yaw, density, biome, resonance, pool, playerPos) {
      if (pool.activeCount >= MAX_LIVE_PATHS) return false;
      if (this.pathCooldown > 0) return false;

      const st = this._scaleStage || "paw";
      const orbital =
        st === "orbital" || st === "solar" || st === "cosmic";

      const fx = Math.sin(yaw);
      const fz = Math.cos(yaw);
      const rx = Math.cos(yaw);
      const rz = -Math.sin(yaw);

      const origin = playerPos || pred;
      // Path always starts IN FRONT of Bolt so he runs into a glowing corridor
      const minAhead = orbital ? 22 : 10;
      const maxAhead = orbital ? 75 : 22;
      const ahead = minAhead + Math.random() * (maxAhead - minAhead);
      // Tiny side offset only — path stays centered on run line
      const side = (Math.random() - 0.5) * (orbital ? 14 : 2.2);
      let x = origin.x + fx * ahead + rx * side;
      let z = origin.z + fz * ahead + rz * side;
      // Never start under Bolt's feet
      if (this._tooCloseToPlayer(x, z, orbital ? 18 : 8)) return false;
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

      // Subtle guide paths — energy preferred, keep thin
      let typeDef = pickPathType(density, biome.id, resonance);
      if (orbital || Math.random() < 0.55) typeDef = PATH_TYPES.energy;
      else if (Math.random() < 0.35) typeDef = PATH_TYPES.branch;
      else if (Math.random() < 0.45) typeDef = PATH_TYPES.shortcut;
      // Surface: longer but thin + soft (not highway)
      if (!orbital) {
        typeDef = Object.assign({}, typeDef, {
          length: (typeDef.length || 28) * (1.15 + density * 0.35),
          segs: Math.min(20, (typeDef.segs || 12) + 5),
          width: (typeDef.width || 0.55) * 0.9,
          emissive: (typeDef.emissive || 1.0) * 0.85,
          opacity: Math.min(0.7, (typeDef.opacity || 0.65)),
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
        yaw: yaw + (Math.random() - 0.5) * (orbital ? 0.55 : 0.08),
        seed: Math.random() * 200,
        orbital: orbital,
      });

      const life = 14 + density * 6 + (orbital ? 12 : 0);
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

      this.pathCooldown = orbital
        ? 0.35 + Math.random() * 0.25
        : 0.4 + Math.random() * 0.25;
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
      this._lastPlayerPos = playerPos;

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
        this.pools[k].update(dt, this.scoreSys.active);
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
      // Don't starve surface density — densScale only bites hard in true ascent
      let densScale = sc.densityMul != null ? sc.densityMul : 1;
      if (surfaceScale) densScale = Math.max(1.15, densScale);
      let density = this.scoreSys.density;
      density = THREE.MathUtils.clamp(
        (density + this._fluxBoost * 0.45 + res * 0.15 + coreMul) * densScale,
        0,
        surfaceScale ? 1.55 : 1.45
      );
      this._coreWorldMul = coreMul;

      // Per-generator scale multipliers (lore: small gens off at cosmic scale)
      let mPath = sc.pathMul != null ? sc.pathMul : 1;
      let mTerr = sc.terrainMul != null ? sc.terrainMul : 1;
      let mVeg = sc.vegMul != null ? sc.vegMul : 1;
      let mRuin = sc.ruinMul != null ? sc.ruinMul : 1;
      let mDet = sc.detailMul != null ? sc.detailMul : 1;
      // HARD floors on surface — dense living world around Bolt
      if (surfaceScale) {
        mVeg = Math.max(1.55, mVeg);
        mDet = Math.max(1.35, mDet);
        mTerr = Math.max(1.1, mTerr);
        mPath = Math.max(1.45, mPath); // always paint a corridor ahead
        mRuin = Math.max(1.15, mRuin);
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
        // --- SURFACE: dense flora + far ruins + glowing path always ahead ---
        // PATH first — beautiful corridor painted in front of Bolt every tick possible
        if (mPath > 0.05) {
          const pathCap = 4;
          if (this.pools.path.activeCount < 2) {
            // Force at least one path ahead when none live
            if (this._spawnOne("path", pred, yaw, Math.min(1.35, d * mPath + 0.2), biome, res)) any = true;
          }
          if (
            this.pools.path.activeCount < pathCap ||
            Math.random() < (0.85 + coreMul * 0.2) * mPath
          ) {
            if (this._spawnOne("path", pred, yaw, Math.min(1.35, d * mPath), biome, res)) any = true;
          }
          // Second lane / branch feel at high density
          if (density > 0.4 && Math.random() < 0.55 * mPath) {
            if (this._spawnOne("path", pred, yaw, d * mPath, biome, res)) any = true;
          }
        }
        // Terrain
        if (mTerr > 0.08 && (this.pools.terrain.activeCount < 16 * mTerr || Math.random() < (0.75 + density * 0.25) * mTerr)) {
          if (this._spawnOne("terrain", pred, yaw, d * mTerr, biome, res)) any = true;
        }
        // Vegetation — DENSE forest bands around Bolt (never on him)
        if (mVeg > 0.05) {
          const vegChance =
            (0.95 + density * 0.55 + (biome.weights.vegetation || 0.2) * 0.55 + coreMul * 0.35) * mVeg;
          const vegCap = Math.floor((28 + coreMul * 16) * mVeg);
          // Multiple flora spawns per tick for dense variety
          const vegBursts = 2 + Math.floor(density * 3 + coreMul * 2);
          for (let vi = 0; vi < vegBursts; vi++) {
            if (this.pools.vegetation.activeCount < vegCap || Math.random() < vegChance) {
              if (this._spawnOne("vegetation", pred, yaw, d * mVeg, biome, res)) any = true;
            }
          }
          if (density > 0.2 && Math.random() < 0.7 * mVeg) {
            if (this._spawnOne("vegetation", pred, yaw, d * mVeg, biome, res)) any = true;
          }
        }
        // Ruins — more of them, still far (clear bubble enforced in _spawnRuin)
        if (mRuin > 0.08) {
          const ruinCap = 5 + Math.floor(coreRuin * 5);
          const ruinChance =
            (0.38 + density * 0.4 + res * 0.3 + (biome.weights.ruin || 0.15) * 0.55 + coreRuin) * mRuin;
          if (this.pools.ruin.activeCount < ruinCap || Math.random() < ruinChance) {
            if (this._spawnOne("ruin", pred, yaw, Math.min(1.25, d * (0.95 + mRuin * 0.3)), biome, res)) any = true;
          }
          if (density > 0.45 && Math.random() < (0.4 + coreRuin * 0.45) * mRuin) {
            if (this._spawnOne("ruin", pred, yaw, d, biome, res)) any = true;
          }
        }
        // Details — RICH variety on flanks
        if (mDet > 0.06) {
          const detailChance =
            (0.95 + density * 0.5 + res * 0.4 + (biome.weights.detail || 0.2) * 0.55 + coreDetail) * mDet;
          const detCap = Math.floor((32 + coreDetail * 28) * Math.max(1, mDet));
          if (this.pools.detail.activeCount < detCap || Math.random() < detailChance) {
            if (this._spawnOne("detail", pred, yaw, d * mDet, biome, res)) any = true;
          }
          const bursts = 2 + Math.floor((density * 3 + res * 1.8 + coreDetail * 3.5) * mDet);
          for (let bi = 0; bi < bursts; bi++) {
            if (Math.random() < (0.8 + density * 0.35 + coreDetail * 0.45) * Math.min(1.5, mDet)) {
              if (this._spawnOne("detail", pred, yaw, d * mDet, biome, res)) any = true;
            }
          }
        }

        // Extra weighted random spawns for variety
        const extra = n + 3 + Math.floor(density * 2);
        for (let i = 0; i < extra; i++) {
          const kind = this._pickKind(biome, d);
          if (this._spawnOne(kind, pred, yaw, d, biome, res)) any = true;
        }

        this.cooldown = THREE.MathUtils.lerp(0.18, 0.06, Math.min(1, density));
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
    SPAWN_THRESHOLD: SPAWN_THRESHOLD,
    BIOME_CELL: BIOME_CELL,
    BIOMES: BIOMES,
    sampleBiome: sampleBiome,
    setForceBiome: setForceBiome,
    getForceBiome: getForceBiome,
    PLANET_BIOME_MAP: PLANET_BIOME_MAP,
  };
})(typeof window !== "undefined" ? window : globalThis);
