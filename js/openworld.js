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
  const VIEW = 3;         // chunks radius around player (7x7 grid)
  const MAX_CHUNKS = 64;

  /** Scale definitions (lore order) */
  const SCALE_STAGES = [
    {
      id: "paw",
      name: "PAW",
      min: 0,
      fog: 0.0044,
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
      fog: 0.0024,
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

  function hash2(x, z) {
    const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
    return s - Math.floor(s);
  }
  function fbm(x, z) {
    let v = 0, a = 0.5, f = 1;
    for (let i = 0; i < 4; i++) {
      const s = Math.sin(x * f * 12.9898 + z * f * 78.233) * 43758.5453;
      v += a * (s - Math.floor(s));
      a *= 0.5;
      f *= 2.1;
    }
    return v;
  }

  /** Surface height at world XZ — biome heightMul changes terrain feel */
  function surfaceHeight(x, z) {
    let mul = 1;
    if (global.BoltProcedural && global.BoltProcedural.sampleBiome) {
      const b = global.BoltProcedural.sampleBiome(x, z, 0);
      mul = b.primary.heightMul != null ? b.primary.heightMul : 1;
    }
    const n = fbm(x * 0.018, z * 0.018);
    const n2 = fbm(x * 0.05 + 20, z * 0.05);
    // Ember = harsher ridges; Whisper = flatter; Crystal = smooth hills
    return (n * 2.2 + n2 * 1.4) * mul;
  }

  class OpenWorld {
    constructor(scene) {
      this.scene = scene;
      this.chunks = new Map(); // "cx,cz" -> { group, cx, cz }
      this.group = new THREE.Group();
      this.group.name = "OpenWorld";
      scene.add(this.group);

      this.groundMat = new THREE.MeshStandardMaterial({
        color: 0x152238,
        roughness: 0.9,
        metalness: 0.12,
        emissive: 0x0a1528,
        emissiveIntensity: 0.2,
        flatShading: false,
      });
      // Soft overlay only (almost invisible) — not a harsh wire cage
      this.gridMat = new THREE.MeshBasicMaterial({
        color: 0x3df0ff,
        transparent: true,
        opacity: 0.025,
        wireframe: true,
        depthWrite: false,
      });

      // Legacy mini-marker removed — real Thunderwolf Citadel lives in citadel.js
      this.citadel = null;

      this.scaleStage = "paw";
      this.transitionProgress = 0; // 0..1 smooth scale driver
      this.scaleProps = lerpStageProps(0);
      this._lastCx = null;
      this._lastCz = null;
    }

    _key(cx, cz) {
      return cx + "," + cz;
    }

    _buildChunk(cx, cz) {
      const g = new THREE.Group();
      g.userData.cx = cx;
      g.userData.cz = cz;

      const ox = cx * CHUNK;
      const oz = cz * CHUNK;
      // Higher mesh density — smoother hills + more silhouette detail
      const segs = 40;
      const geo = new THREE.PlaneGeometry(CHUNK, CHUNK, segs, segs);
      geo.rotateX(-Math.PI / 2);

      const pos = geo.attributes.position;
      const colors = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        const lx = pos.getX(i);
        const lz = pos.getZ(i);
        const wx = ox + CHUNK * 0.5 + lx;
        const wz = oz + CHUNK * 0.5 + lz;
        // Macro height + micro noise for ground texture feel
        let h = surfaceHeight(wx, wz);
        h += (hash2(wx * 0.4, wz * 0.4) - 0.5) * 0.35;
        h += (hash2(wx * 1.1 + 3, wz * 1.1) - 0.5) * 0.12;
        pos.setY(i, h);
        // Soft vertex tint variation (not flat color plate)
        const n = hash2(wx * 0.08, wz * 0.08);
        const tint = 0.88 + n * 0.2;
        colors[i * 3] = tint;
        colors[i * 3 + 1] = tint;
        colors[i * 3 + 2] = 0.92 + n * 0.12;
      }
      pos.needsUpdate = true;
      geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      geo.computeVertexNormals();

      // Textured biome ground
      let biomeId = "crystalNebula";
      let gridCol = 0x3df0ff;
      if (global.BoltProcedural && global.BoltProcedural.sampleBiome) {
        const b = global.BoltProcedural.sampleBiome(ox + CHUNK * 0.5, oz + CHUNK * 0.5);
        biomeId = b.primary.id;
        gridCol = b.primary.color;
      }

      let mat;
      if (global.BoltGraphics && global.BoltGraphics.makeGroundMaterial) {
        mat = global.BoltGraphics.makeGroundMaterial(biomeId);
        mat.vertexColors = true;
      } else {
        mat = this.groundMat.clone();
        mat.vertexColors = true;
        if (global.BoltProcedural && global.BoltProcedural.BIOMES) {
          const bm = global.BoltProcedural.BIOMES[biomeId];
          if (bm) {
            mat.color.setHex(bm.ground);
            mat.emissive.setHex(bm.groundEmissive);
            mat.emissiveIntensity = 0.35;
          }
        }
      }

      const mesh = new THREE.Mesh(geo, mat);
      mesh.receiveShadow = true;
      mesh.castShadow = false;
      g.add(mesh);

      // Ultra-soft biome tint grid
      const gm = this.gridMat.clone();
      gm.color.setHex(gridCol);
      gm.opacity = 0.012;
      const wire = new THREE.Mesh(geo.clone(), gm);
      wire.position.y = 0.03;
      g.add(wire);

      // Richer static ground dressing (pebbles, crystals, patches)
      const seed = hash2(cx * 12.3, cz * 45.7);
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
      const accent =
        (global.BoltProcedural &&
          global.BoltProcedural.BIOMES &&
          global.BoltProcedural.BIOMES[biomeId] &&
          global.BoltProcedural.BIOMES[biomeId].color) ||
        0x67e8f9;

      // More props: 8–16 per chunk
      const props = 8 + Math.floor(seed * 10);
      for (let i = 0; i < props; i++) {
        const px = (hash2(cx + i * 1.7, cz + i) - 0.5) * CHUNK * 0.9;
        const pz = (hash2(cz + i * 2.3, cx + i * 0.5) - 0.5) * CHUNK * 0.9;
        const wx = ox + CHUNK * 0.5 + px;
        const wz = oz + CHUNK * 0.5 + pz;
        const hy = surfaceHeight(wx, wz);
        const roll = hash2(i * 3.1 + cx, cz * 2.2 + i);

        if (roll < 0.12 && i < 2) {
          // Landing platform
          const plat = new THREE.Mesh(
            new THREE.BoxGeometry(5 + seed * 5, 0.7, 5 + seed * 3),
            new THREE.MeshStandardMaterial({
              color: 0x1e3a5f,
              metalness: 0.45,
              roughness: 0.45,
              emissive: accent,
              emissiveIntensity: 0.1,
            })
          );
          plat.position.set(px, hy + 0.35, pz);
          plat.receiveShadow = true;
          plat.castShadow = true;
          g.add(plat);
        } else if (roll < 0.45) {
          // Rock / boulder
          const rock = new THREE.Mesh(
            new THREE.DodecahedronGeometry(0.35 + roll * 1.4, 0),
            rockMat
          );
          rock.position.set(px, hy + 0.25 + roll * 0.3, pz);
          rock.scale.set(1, 0.5 + roll * 0.9, 1);
          rock.rotation.set(roll * 2, roll * 4, roll);
          rock.castShadow = true;
          rock.receiveShadow = true;
          g.add(rock);
        } else if (roll < 0.7) {
          // Crystal shard patch
          for (let k = 0; k < 2 + Math.floor(roll * 3); k++) {
            const cryst = new THREE.Mesh(
              new THREE.ConeGeometry(0.08 + roll * 0.12, 0.35 + roll * 0.5, 5),
              new THREE.MeshStandardMaterial({
                color: accent,
                emissive: accent,
                emissiveIntensity: 0.55,
                metalness: 0.4,
                roughness: 0.25,
                transparent: true,
                opacity: 0.9,
              })
            );
            cryst.position.set(
              px + (hash2(k, i) - 0.5) * 1.2,
              hy + 0.15,
              pz + (hash2(i, k + 2) - 0.5) * 1.2
            );
            cryst.rotation.z = (hash2(k + 1, i) - 0.5) * 0.5;
            cryst.castShadow = true;
            g.add(cryst);
          }
        } else if (roll < 0.88) {
          // Grass / moss tuft (low poly)
          const tuft = new THREE.Mesh(
            new THREE.ConeGeometry(0.2 + roll * 0.15, 0.35 + roll * 0.4, 5),
            new THREE.MeshStandardMaterial({
              color: biomeId === "emberVoid" ? 0x7c2d12 : biomeId === "jadeCanopy" ? 0x059669 : 0x4c1d95,
              emissive: biomeId === "emberVoid" ? 0xea580c : accent,
              emissiveIntensity: 0.25,
              roughness: 0.8,
              flatShading: true,
            })
          );
          tuft.position.set(px, hy + 0.15, pz);
          tuft.scale.set(1.2, 1, 1.2);
          g.add(tuft);
        } else {
          // Small energy mote on ground
          const mote = new THREE.Mesh(
            new THREE.SphereGeometry(0.12 + roll * 0.1, 8, 8),
            new THREE.MeshStandardMaterial({
              color: accent,
              emissive: accent,
              emissiveIntensity: 0.9,
              roughness: 0.2,
              transparent: true,
              opacity: 0.75,
            })
          );
          mote.position.set(px, hy + 0.2, pz);
          g.add(mote);
        }
      }

      g.position.set(ox + CHUNK * 0.5, 0, oz + CHUNK * 0.5);
      return g;
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

    ensureAround(wx, wz) {
      const cx = Math.floor(wx / CHUNK);
      const cz = Math.floor(wz / CHUNK);
      if (cx === this._lastCx && cz === this._lastCz) {
        // still prune distant occasionally
      }
      this._lastCx = cx;
      this._lastCz = cz;

      const needed = new Set();
      for (let dz = -VIEW; dz <= VIEW; dz++) {
        for (let dx = -VIEW; dx <= VIEW; dx++) {
          const k = this._key(cx + dx, cz + dz);
          needed.add(k);
          if (!this.chunks.has(k)) {
            const ch = this._buildChunk(cx + dx, cz + dz);
            this.group.add(ch);
            this.chunks.set(k, { group: ch, cx: cx + dx, cz: cz + dz });
          }
        }
      }

      // Unload far chunks
      const toRemove = [];
      this.chunks.forEach((val, k) => {
        if (!needed.has(k)) toRemove.push(k);
      });
      // Keep memory bounded
      if (this.chunks.size > MAX_CHUNKS) {
        toRemove.sort((a, b) => {
          const A = this.chunks.get(a);
          const B = this.chunks.get(b);
          const da = Math.abs(A.cx - cx) + Math.abs(A.cz - cz);
          const db = Math.abs(B.cx - cx) + Math.abs(B.cz - cz);
          return db - da;
        });
      }
      for (let i = 0; i < toRemove.length; i++) {
        const k = toRemove[i];
        const ch = this.chunks.get(k);
        if (!ch) continue;
        if (needed.has(k) && this.chunks.size <= MAX_CHUNKS) continue;
        this.group.remove(ch.group);
        ch.group.traverse((o) => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) {
            if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
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

    heightAt(x, z) {
      return surfaceHeight(x, z);
    }

    getScaleFactors() {
      return this.scaleProps || lerpStageProps(this.transitionProgress || 0);
    }
  }

  global.BoltOpenWorld = {
    OpenWorld: OpenWorld,
    surfaceHeight: surfaceHeight,
    CHUNK: CHUNK,
    SCALE_STAGES: SCALE_STAGES,
    lerpStageProps: lerpStageProps,
    lerpStagePropsSurface: lerpStagePropsSurface,
  };
})(typeof window !== "undefined" ? window : globalThis);
