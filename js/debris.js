/**
 * BOLT ENGINE — Orbital Debris
 * Interactive space junk: clusters, orbit physics, land-on platforms,
 * momentum transfer, shatter, gravity assists, Resonance pull.
 * Active at Orbital / Solar / Cosmic scales.
 */
(function (global) {
  "use strict";
  const THREE = global.THREE;
  if (!THREE) return;

  const MAX_PIECES = 48;
  const TYPES = {
    rock: { name: "Asteroid Fragment", mass: 1.2, hp: 1, breakable: true, platform: false, color: 0x6b7280 },
    station: { name: "Station Wreck", mass: 2.4, hp: 2, breakable: true, platform: true, color: 0x94a3b8 },
    hull: { name: "Ship Hull", mass: 1.8, hp: 1.5, breakable: true, platform: true, color: 0x64748b },
    core: { name: "Energy Core", mass: 0.6, hp: 0.8, breakable: true, platform: false, color: 0x67e8f9, loot: true },
    satellite: { name: "Dead Satellite", mass: 0.9, hp: 1, breakable: true, platform: false, color: 0xa5b4fc },
    megachunk: { name: "Megastructure Bone", mass: 3.5, hp: 3, breakable: false, platform: true, color: 0x78716c },
  };

  function pickType(density, resonance) {
    const r = Math.random();
    if (r < 0.12 + resonance * 0.08) return TYPES.core;
    if (r < 0.28) return TYPES.satellite;
    if (r < 0.48) return TYPES.hull;
    if (r < 0.68) return TYPES.station;
    if (r < 0.82 + density * 0.1) return TYPES.megachunk;
    return TYPES.rock;
  }

  function mkMat(col, em, emI) {
    return new THREE.MeshStandardMaterial({
      color: col,
      roughness: 0.72,
      metalness: 0.35,
      emissive: new THREE.Color(em || col),
      emissiveIntensity: emI != null ? emI : 0.15,
      flatShading: true,
    });
  }

  function buildPieceMesh(typeDef, scale, biome) {
    const g = new THREE.Group();
    const accent = (biome && biome.color) || typeDef.color;
    const em = (biome && biome.emissive) || accent;
    const mat = mkMat(typeDef.color, em, typeDef.loot ? 0.85 : 0.18);
    const s = scale;

    if (typeDef === TYPES.rock || typeDef === TYPES.megachunk) {
      const n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        const m = new THREE.Mesh(
          new THREE.DodecahedronGeometry((0.6 + Math.random() * 0.8) * s, 0),
          mat
        );
        m.position.set(
          (Math.random() - 0.5) * s * 1.2,
          (Math.random() - 0.5) * s * 0.6,
          (Math.random() - 0.5) * s * 1.2
        );
        m.rotation.set(Math.random() * 2, Math.random() * 2, Math.random() * 2);
        m.castShadow = true;
        g.add(m);
      }
    } else if (typeDef === TYPES.station || typeDef === TYPES.hull) {
      // Platform slab + broken walls
      const plat = new THREE.Mesh(
        new THREE.BoxGeometry(2.8 * s, 0.35 * s, 2.2 * s),
        mat
      );
      plat.position.y = 0;
      plat.castShadow = true;
      plat.receiveShadow = true;
      g.add(plat);
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(0.25 * s, 1.4 * s, 1.6 * s),
        mat
      );
      wall.position.set(-1.1 * s, 0.7 * s, 0);
      wall.rotation.z = (Math.random() - 0.5) * 0.4;
      g.add(wall);
      if (Math.random() > 0.4) {
        const beam = new THREE.Mesh(
          new THREE.BoxGeometry(2.2 * s, 0.2 * s, 0.2 * s),
          mkMat(accent, em, 0.5)
        );
        beam.position.set(0.2 * s, 1.1 * s, 0.4 * s);
        beam.rotation.z = -0.5;
        g.add(beam);
      }
    } else if (typeDef === TYPES.core) {
      const core = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.7 * s, 0),
        mkMat(0xfbbf24, 0xf59e0b, 1.2)
      );
      g.add(core);
      const shell = new THREE.Mesh(
        new THREE.SphereGeometry(1.1 * s, 12, 10),
        mkMat(accent, em, 0.35)
      );
      shell.material.transparent = true;
      shell.material.opacity = 0.35;
      shell.material.depthWrite = false;
      g.add(shell);
    } else {
      // satellite
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.9 * s, 0.7 * s, 1.4 * s),
        mat
      );
      g.add(body);
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(2.4 * s, 0.06 * s, 0.7 * s),
        mkMat(0x1e3a5f, accent, 0.4)
      );
      panel.position.y = 0.1 * s;
      g.add(panel);
    }

    // Soft glow for visibility
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(1.6 * s, 10, 8),
      new THREE.MeshBasicMaterial({
        color: accent,
        transparent: true,
        opacity: 0.08,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    g.add(glow);

    g.userData.kind = "debris";
    g.userData.debrisType = typeDef.name;
    return g;
  }

  class OrbitalDebrisSystem {
    constructor(scene, options) {
      this.scene = scene;
      this.group = new THREE.Group();
      this.group.name = "OrbitalDebris";
      scene.add(this.group);
      this.pieces = [];
      this.cooldown = 0;
      this.stats = { spawned: 0, broken: 0, assists: 0, platforms: 0 };
      this._toast = (options && options.onToast) || function () {};
      this._active = false;
      this._burst = []; // temporary shatter particles
    }

    clear() {
      for (let i = 0; i < this.pieces.length; i++) {
        this._disposePiece(this.pieces[i]);
      }
      this.pieces.length = 0;
      for (let i = 0; i < this._burst.length; i++) {
        this.group.remove(this._burst[i].mesh);
      }
      this._burst.length = 0;
      this._active = false;
    }

    _disposePiece(p) {
      if (!p || !p.mesh) return;
      this.group.remove(p.mesh);
      p.mesh.traverse(function (c) {
        if (c.geometry) c.geometry.dispose();
        if (c.material) {
          if (Array.isArray(c.material)) c.material.forEach(function (m) { m.dispose(); });
          else c.material.dispose();
        }
      });
    }

    /**
     * Spawn a debris field cluster ahead of Bolt (orbital scales only).
     */
    spawnField(playerPos, yaw, density, resonance, biome, scaleStage) {
      if (this.pieces.length >= MAX_PIECES) return false;
      density = density || 0.5;
      resonance = resonance || 0;
      const fx = Math.sin(yaw);
      const fz = Math.cos(yaw);
      const rx = Math.cos(yaw);
      const rz = -Math.sin(yaw);

      // Cluster center far ahead + to the side
      const ahead = 35 + Math.random() * 55 + density * 30;
      const side = (Math.random() - 0.5) * (40 + density * 25);
      const cx = playerPos.x + fx * ahead + rx * side;
      const cy = playerPos.y + (Math.random() - 0.3) * 28;
      const cz = playerPos.z + fz * ahead + rz * side;

      const count = 3 + Math.floor(density * 5 + Math.random() * 3);
      const fieldId = performance.now() + Math.random();
      let n = 0;
      for (let i = 0; i < count && this.pieces.length < MAX_PIECES; i++) {
        const typeDef = pickType(density, resonance);
        const scale =
          (typeDef === TYPES.megachunk ? 2.4 : typeDef === TYPES.station ? 1.8 : 1.0) *
          (0.7 + density * 0.8 + Math.random() * 0.5);
        const mesh = buildPieceMesh(typeDef, scale, biome);
        const ox = (Math.random() - 0.5) * 22;
        const oy = (Math.random() - 0.5) * 14;
        const oz = (Math.random() - 0.5) * 22;
        mesh.position.set(cx + ox, cy + oy, cz + oz);
        mesh.rotation.set(Math.random() * 2, Math.random() * 2, Math.random() * 2);
        mesh.scale.setScalar(0.01);
        this.group.add(mesh);

        // Orbital motion: slow tangent + spin
        const orbitSpeed = 2.5 + Math.random() * 4 + density * 2;
        const tangent = new THREE.Vector3(-fz, 0, fx)
          .normalize()
          .multiplyScalar(orbitSpeed * (Math.random() > 0.5 ? 1 : -1));
        tangent.y = (Math.random() - 0.5) * 1.2;

        const piece = {
          mesh: mesh,
          type: typeDef,
          scale: scale,
          radius: scale * (typeDef.platform ? 2.0 : 1.35),
          mass: typeDef.mass * scale,
          hp: typeDef.hp * scale,
          maxHp: typeDef.hp * scale,
          vel: tangent,
          spin: new THREE.Vector3(
            (Math.random() - 0.5) * 0.8,
            (Math.random() - 0.5) * 1.2,
            (Math.random() - 0.5) * 0.8
          ),
          life: 28 + density * 18 + Math.random() * 12,
          age: 0,
          fieldId: fieldId,
          platform: !!typeDef.platform,
          breakable: typeDef.breakable !== false,
          loot: !!typeDef.loot || (typeDef === TYPES.station && Math.random() < 0.35),
          lootTaken: false,
          fade: 0,
          homeY: cy + oy,
          // Gravity well: gentle pull toward local "orbit band" height
          orbitBandY: playerPos.y + (Math.random() - 0.5) * 8,
        };
        this.pieces.push(piece);
        this.stats.spawned++;
        n++;
      }
      if (n > 0 && Math.random() < 0.45) {
        this._toast("DEBRIS FIELD — " + n + " fragments · graveyard of empires 🌌");
      }
      return n > 0;
    }

    update(dt, playerPos, packet) {
      const st = (packet && packet.scaleStage) || "paw";
      const orbital = st === "orbital" || st === "solar" || st === "cosmic";
      const density = (packet && packet.density) != null ? packet.density : 0.4;
      const resonance = (packet && packet.resonance) || 0;
      const yaw = (packet && packet.yaw) != null ? packet.yaw : 0;
      const biome = (packet && packet.biome) || null;
      const speed = (packet && packet.speed) || 0;

      this._active = orbital;
      if (!orbital) {
        // Fade out all debris when leaving orbit
        for (let i = this.pieces.length - 1; i >= 0; i--) {
          this.pieces[i].life = Math.min(this.pieces[i].life, 0.8);
        }
      }

      this.cooldown = Math.max(0, this.cooldown - dt);

      // Spawn fields while in orbit + meaningful sprint-ish density
      if (orbital && this.cooldown <= 0 && this.pieces.length < MAX_PIECES - 4) {
        const chance = 0.35 + density * 0.45 + resonance * 0.15;
        if (Math.random() < chance * dt * 2.5 || this.pieces.length < 6) {
          this.spawnField(playerPos, yaw, density, resonance, biome, st);
          this.cooldown = THREE.MathUtils.lerp(2.8, 1.1, Math.min(1, density + resonance * 0.3));
        }
      }

      // Physics step
      const planetPull = orbital ? 1 : 0; // soft gravity well toward orbit band
      for (let i = this.pieces.length - 1; i >= 0; i--) {
        const p = this.pieces[i];
        p.age += dt;
        p.life -= dt;

        // Appear scale-in
        if (p.age < 0.6) {
          const u = p.age / 0.6;
          p.mesh.scale.setScalar(u * u);
        } else if (p.life < 1.2) {
          p.mesh.scale.setScalar(Math.max(0.01, p.life / 1.2));
        } else {
          p.mesh.scale.setScalar(1);
        }

        // Resonance pull toward Bolt
        if (resonance > 0.35 && orbital) {
          const dx = playerPos.x - p.mesh.position.x;
          const dy = playerPos.y - p.mesh.position.y;
          const dz = playerPos.z - p.mesh.position.z;
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.1;
          if (d < 80) {
            const f = (resonance - 0.3) * 4.5 * (1 / d);
            p.vel.x += (dx / d) * f * dt;
            p.vel.y += (dy / d) * f * dt * 0.7;
            p.vel.z += (dz / d) * f * dt;
          }
        }

        // Soft gravity well: keep pieces near orbital altitude band
        if (planetPull > 0) {
          const band = p.orbitBandY != null ? p.orbitBandY : playerPos.y;
          p.vel.y += (band - p.mesh.position.y) * 0.15 * dt;
          // Gentle orbit curl (not full sim) — tangential drift
          p.vel.x += -p.vel.z * 0.04 * dt;
          p.vel.z += p.vel.x * 0.04 * dt;
        }

        // Dampen excess speed
        const sp = Math.hypot(p.vel.x, p.vel.y, p.vel.z);
        if (sp > 14) {
          p.vel.multiplyScalar(14 / sp);
        }

        p.mesh.position.x += p.vel.x * dt;
        p.mesh.position.y += p.vel.y * dt;
        p.mesh.position.z += p.vel.z * dt;
        p.mesh.rotation.x += p.spin.x * dt;
        p.mesh.rotation.y += p.spin.y * dt;
        p.mesh.rotation.z += p.spin.z * dt;

        // Cull far / expired
        const dx = p.mesh.position.x - playerPos.x;
        const dy = p.mesh.position.y - playerPos.y;
        const dz = p.mesh.position.z - playerPos.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (p.life <= 0 || dist > 220) {
          this._disposePiece(p);
          this.pieces.splice(i, 1);
        }
      }

      // Shatter particles
      for (let i = this._burst.length - 1; i >= 0; i--) {
        const b = this._burst[i];
        b.t -= dt;
        b.mesh.position.addScaledVector(b.vel, dt);
        b.mesh.rotation.x += dt * 4;
        b.mesh.scale.multiplyScalar(0.96);
        if (b.t <= 0) {
          this.group.remove(b.mesh);
          if (b.mesh.geometry) b.mesh.geometry.dispose();
          this._burst.splice(i, 1);
        }
      }

      return this.pieces.length;
    }

    /**
     * Player interaction: platform land, bounce, shatter, gravity assist, loot.
     * Mutates playerVel (THREE.Vector3). Returns interaction info.
     */
    interact(playerPos, playerVel, opts) {
      opts = opts || {};
      const speed = opts.speed != null ? opts.speed : Math.hypot(playerVel.x, playerVel.y, playerVel.z);
      const resonance = opts.resonance || 0;
      const sprinting = !!opts.sprinting;
      const dt = opts.dt || 0.016;
      const result = {
        onDebris: false,
        platformY: null,
        push: false,
        shattered: false,
        assist: false,
        loot: null,
        hitName: null,
      };

      if (!this._active && this.pieces.length === 0) return result;

      const px = playerPos.x;
      const py = playerPos.y;
      const pz = playerPos.z;
      const playerR = 1.1;

      for (let i = this.pieces.length - 1; i >= 0; i--) {
        const p = this.pieces[i];
        const dx = px - p.mesh.position.x;
        const dy = py - p.mesh.position.y;
        const dz = pz - p.mesh.position.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const hitR = p.radius + playerR;

        // Gravity assist — skim near large mass at high speed
        if (
          !result.assist &&
          p.mass > 1.6 &&
          dist < p.radius + 6 &&
          dist > hitR * 0.9 &&
          speed > 18
        ) {
          // Tangential boost
          const tx = -dz;
          const tz = dx;
          const tl = Math.hypot(tx, tz) || 1;
          const boost = (2.5 + p.mass * 0.8) * (sprinting ? 1.35 : 1);
          playerVel.x += (tx / tl) * boost * dt * 8;
          playerVel.z += (tz / tl) * boost * dt * 8;
          playerVel.y += 1.2 * dt * 6;
          result.assist = true;
          result.hitName = p.type.name;
          this.stats.assists++;
          if (Math.random() < 0.12) {
            this._toast("GRAVITY ASSIST — " + p.type.name + " slingshot ⚡");
          }
        }

        if (dist > hitR) continue;

        // Overlap
        const nx = dx / (dist || 1);
        const ny = dy / (dist || 1);
        const nz = dz / (dist || 1);

        // Platform landing: on top of large debris while falling/slow vertical
        const topY = p.mesh.position.y + p.radius * 0.55;
        const onTop =
          p.platform &&
          py >= topY - 1.2 &&
          py <= topY + 2.2 &&
          Math.hypot(dx, dz) < p.radius * 0.85 &&
          playerVel.y <= 4;

        if (onTop) {
          result.onDebris = true;
          result.platformY = topY + 0.15;
          result.hitName = p.type.name;
          // Carry platform velocity
          playerVel.x = THREE.MathUtils.lerp(playerVel.x, p.vel.x, 0.15);
          playerVel.z = THREE.MathUtils.lerp(playerVel.z, p.vel.z, 0.15);
          if (playerVel.y < 0) playerVel.y = 0;
          this.stats.platforms++;
          continue;
        }

        // High-speed shatter
        if (p.breakable && speed > 22 + p.mass * 2) {
          p.hp -= (speed / 30) * (sprinting ? 1.4 : 1);
          if (p.hp <= 0) {
            result.shattered = true;
            result.hitName = p.type.name;
            this._shatter(p);
            if (p.loot && !p.lootTaken) {
              p.lootTaken = true;
              result.loot = {
                core: 3 + Math.random() * 8 + resonance * 6,
                resonance: 0.04 + Math.random() * 0.08,
                name: p.type.name,
              };
            }
            this._disposePiece(p);
            this.pieces.splice(i, 1);
            this.stats.broken++;
            // Kick player slightly
            playerVel.x += nx * 3;
            playerVel.y += Math.abs(ny) * 2 + 2;
            playerVel.z += nz * 3;
            continue;
          }
        }

        // Momentum transfer (elastic-ish bounce)
        const rel =
          (playerVel.x - p.vel.x) * nx +
          (playerVel.y - p.vel.y) * ny +
          (playerVel.z - p.vel.z) * nz;
        if (rel < 0) {
          const j = (-1.25 * rel) / (1 / 1.2 + 1 / p.mass);
          playerVel.x += (j / 1.2) * nx;
          playerVel.y += (j / 1.2) * ny * 0.7;
          playerVel.z += (j / 1.2) * nz;
          p.vel.x -= (j / p.mass) * nx;
          p.vel.y -= (j / p.mass) * ny * 0.7;
          p.vel.z -= (j / p.mass) * nz;
          result.push = true;
          result.hitName = p.type.name;
          // Separate
          const pen = hitR - dist;
          playerPos.x += nx * pen * 0.55;
          playerPos.y += ny * pen * 0.4;
          playerPos.z += nz * pen * 0.55;
        }

        // Collect loot cores on touch
        if (p.loot && !p.lootTaken && dist < hitR * 0.9) {
          p.lootTaken = true;
          result.loot = {
            core: 5 + Math.random() * 10 + resonance * 8,
            resonance: 0.06 + Math.random() * 0.1,
            name: p.type.name,
          };
          // Dim core visual
          p.mesh.traverse(function (c) {
            if (c.material && c.material.emissiveIntensity > 0.5) {
              c.material.emissiveIntensity = 0.1;
            }
          });
        }
      }

      return result;
    }

    _shatter(p) {
      const n = 5 + Math.floor(Math.random() * 5);
      for (let i = 0; i < n; i++) {
        const m = new THREE.Mesh(
          new THREE.TetrahedronGeometry(0.25 + Math.random() * 0.35, 0),
          mkMat(p.type.color, p.type.color, 0.4)
        );
        m.position.copy(p.mesh.position);
        const v = new THREE.Vector3(
          (Math.random() - 0.5) * 18,
          Math.random() * 10,
          (Math.random() - 0.5) * 18
        );
        this.group.add(m);
        this._burst.push({ mesh: m, vel: v, t: 0.7 + Math.random() * 0.5 });
      }
      this._toast("DEBRIS SHATTER — " + p.type.name + " breaks 💥");
    }

    /** Platform height under player if standing on debris */
    platformHeightAt(x, y, z) {
      let best = null;
      for (let i = 0; i < this.pieces.length; i++) {
        const p = this.pieces[i];
        if (!p.platform) continue;
        const dx = x - p.mesh.position.x;
        const dz = z - p.mesh.position.z;
        if (Math.hypot(dx, dz) > p.radius * 0.85) continue;
        const top = p.mesh.position.y + p.radius * 0.55 + 0.15;
        if (y >= top - 2.5 && y <= top + 3.5) {
          if (best == null || top > best) best = top;
        }
      }
      return best;
    }

    get count() {
      return this.pieces.length;
    }

    getStats() {
      return {
        active: this.pieces.length,
        spawned: this.stats.spawned,
        broken: this.stats.broken,
        assists: this.stats.assists,
      };
    }
  }

  global.BoltDebris = {
    OrbitalDebrisSystem: OrbitalDebrisSystem,
    TYPES: TYPES,
  };
})(typeof window !== "undefined" ? window : globalThis);
