/**
 * BOLT ENGINE — Lightning Core Particle Trail
 * "The thunder that follows the lightning hound."
 *
 * Layers:
 *  1) Ribbon (glowing energy stream)
 *  2) Core sparks (hot white/cyan particles)
 *  3) Lightning arcs (branching segments)
 *  4) Afterglow echoes (memory in the void)
 *  5) Ground / space marks at high sprint score
 *
 * Driven by Meaningful Sprint Score + Momentum + Resonance + Scale.
 */
(function (global) {
  "use strict";
  const THREE = global.THREE;
  if (!THREE) return;

  const MAX_POINTS = 96;
  const MAX_SPARKS = 120;
  const MAX_ARCS = 28;
  const MAX_ECHOES = 16;
  const MAX_MARKS = 40;

  function softTex() {
    if (global.BoltGraphics && global.BoltGraphics.getSoftSpriteTexture) {
      return global.BoltGraphics.getSoftSpriteTexture();
    }
    return null;
  }

  /**
   * Compute visual params from sprint lore tables.
   */
  function calculateTrailParams(opts) {
    opts = opts || {};
    const score = THREE.MathUtils.clamp(opts.meaningful != null ? opts.meaningful : 0, 0, 1);
    const mom = THREE.MathUtils.clamp(opts.momentum != null ? opts.momentum : 0, 0, 1);
    const res = THREE.MathUtils.clamp(opts.resonance != null ? opts.resonance : 0, 0, 1);
    const speed = opts.speed != null ? opts.speed : 0;
    const sprinting = !!opts.sprinting;
    const stage = opts.scaleStage || "paw";
    const coreGlow = opts.coreGlow != null ? opts.coreGlow : 1;

    // Combined "how hard is the Core roaring"
    const power = THREE.MathUtils.clamp(
      score * 0.45 +
        mom * 0.25 +
        (sprinting ? 0.15 : 0) +
        THREE.MathUtils.clamp(speed / 36, 0, 0.25) +
        res * 0.15,
      0,
      1.15
    );

    // Scale length multiplier
    let lenMul = 1;
    let densMul = 1;
    let fadeMul = 1;
    if (stage === "planetary") {
      lenMul = 1.35;
      densMul = 0.95;
    } else if (stage === "orbital") {
      lenMul = 1.9;
      densMul = 0.55;
      fadeMul = 1.4;
    } else if (stage === "solar") {
      lenMul = 2.4;
      densMul = 0.4;
      fadeMul = 1.8;
    } else if (stage === "cosmic") {
      lenMul = 3.0;
      densMul = 0.32;
      fadeMul = 2.2;
    }

    // Color: cyan → purple → gold/white at very high
    const cCyan = new THREE.Color(0x22d3ee);
    const cPurple = new THREE.Color(0xa855f7);
    const cGold = new THREE.Color(0xfbbf24);
    const cWhite = new THREE.Color(0xf0f9ff);
    let color = cCyan.clone();
    if (power < 0.35) {
      color.lerp(cPurple, power / 0.35 * 0.25);
    } else if (power < 0.7) {
      color.copy(cCyan).lerp(cPurple, (power - 0.35) / 0.35);
    } else {
      color.copy(cPurple).lerp(cGold, (power - 0.7) / 0.35);
      if (power > 0.95) color.lerp(cWhite, (power - 0.95) / 0.2);
    }
    // Resonance tints more purple/violet
    if (res > 0.4) {
      color.lerp(cPurple, (res - 0.4) * 0.35);
    }

    return {
      power: power,
      score: score,
      width: THREE.MathUtils.lerp(0.12, 1.35, power) * (stage === "orbital" || stage === "solar" || stage === "cosmic" ? 1.25 : 1),
      length: Math.floor(
        THREE.MathUtils.lerp(18, MAX_POINTS, power) * lenMul
      ),
      particleRate: THREE.MathUtils.lerp(0, 1, power) * densMul,
      sparkSize: THREE.MathUtils.lerp(0.12, 0.55, power) * densMul + (sprinting ? 0.08 : 0),
      arcChance: THREE.MathUtils.lerp(0.02, 0.55, power) * densMul,
      lightningIntensity: THREE.MathUtils.lerp(0.15, 1.4, power * (0.6 + res * 0.4)) * coreGlow,
      opacity: THREE.MathUtils.lerp(0.08, 0.92, power),
      color: color,
      colorHex: color.getHex(),
      afterglow: power > 0.55,
      groundMark: power > 0.65 && (stage === "paw" || stage === "planetary"),
      pulse: res > 0.35 || power > 0.7,
      fadeMul: fadeMul,
      densMul: densMul,
      lenMul: lenMul,
    };
  }

  class LightningTrail {
    constructor(scene, opts) {
      opts = opts || {};
      this.scene = scene;
      this.heightAt = opts.heightAt || function () { return 0; };
      this.soft = softTex();

      // History of world positions
      this.history = [];
      this.maxHist = MAX_POINTS;

      // --- Ribbon (main trail strip) ---
      // Each segment = 2 verts (left/right), so maxHist segments
      this.ribbonMax = MAX_POINTS;
      const ribVerts = (this.ribbonMax + 1) * 2;
      this.ribPos = new Float32Array(ribVerts * 3);
      this.ribCol = new Float32Array(ribVerts * 4);
      this.ribGeo = new THREE.BufferGeometry();
      this.ribGeo.setAttribute("position", new THREE.BufferAttribute(this.ribPos, 3));
      this.ribGeo.setAttribute("color", new THREE.BufferAttribute(this.ribCol, 4));
      // Indices for triangle strip as triangles
      const indices = [];
      for (let i = 0; i < this.ribbonMax; i++) {
        const a = i * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      this.ribGeo.setIndex(indices);
      this.ribMat = new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 1,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        fog: false,
      });
      this.ribbon = new THREE.Mesh(this.ribGeo, this.ribMat);
      this.ribbon.frustumCulled = false;
      this.ribbon.renderOrder = 10;
      scene.add(this.ribbon);

      // --- Spark particles ---
      this.sparkPos = new Float32Array(MAX_SPARKS * 3);
      this.sparkVel = [];
      this.sparkLife = new Float32Array(MAX_SPARKS);
      for (let i = 0; i < MAX_SPARKS; i++) {
        this.sparkVel.push(new THREE.Vector3());
        this.sparkLife[i] = 0;
        this.sparkPos[i * 3 + 1] = -9999;
      }
      this.sparkGeo = new THREE.BufferGeometry();
      this.sparkGeo.setAttribute("position", new THREE.BufferAttribute(this.sparkPos, 3));
      this.sparkMat = new THREE.PointsMaterial({
        map: this.soft,
        color: 0x67e8f9,
        size: 0.35,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
        fog: false,
      });
      this.sparks = new THREE.Points(this.sparkGeo, this.sparkMat);
      this.sparks.frustumCulled = false;
      this.sparks.renderOrder = 11;
      scene.add(this.sparks);
      this.sparkCursor = 0;

      // --- Hot core points (sample history denser) ---
      this.corePos = new Float32Array(MAX_POINTS * 3);
      this.coreGeo = new THREE.BufferGeometry();
      this.coreGeo.setAttribute("position", new THREE.BufferAttribute(this.corePos, 3));
      this.coreMat = new THREE.PointsMaterial({
        map: this.soft,
        color: 0xffffff,
        size: 0.22,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
        fog: false,
      });
      this.corePts = new THREE.Points(this.coreGeo, this.coreMat);
      this.corePts.frustumCulled = false;
      scene.add(this.corePts);

      // --- Lightning arcs (line segments) ---
      this.arcPos = new Float32Array(MAX_ARCS * 2 * 3);
      this.arcLife = new Float32Array(MAX_ARCS);
      this.arcGeo = new THREE.BufferGeometry();
      this.arcGeo.setAttribute("position", new THREE.BufferAttribute(this.arcPos, 3));
      this.arcMat = new THREE.LineBasicMaterial({
        color: 0xa5f3fc,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      });
      this.arcs = new THREE.LineSegments(this.arcGeo, this.arcMat);
      this.arcs.frustumCulled = false;
      scene.add(this.arcs);
      this.arcCursor = 0;

      // --- Afterglow echoes (fading ghost ribbons as points) ---
      this.echoes = [];
      for (let e = 0; e < MAX_ECHOES; e++) {
        this.echoes.push({
          points: [],
          life: 0,
          maxLife: 1.4,
          color: 0x67e8f9,
        });
      }
      this.echoPos = new Float32Array(MAX_ECHOES * 12 * 3);
      this.echoGeo = new THREE.BufferGeometry();
      this.echoGeo.setAttribute("position", new THREE.BufferAttribute(this.echoPos, 3));
      this.echoMat = new THREE.PointsMaterial({
        map: this.soft,
        color: 0xa855f7,
        size: 0.4,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
        fog: false,
      });
      this.echoPts = new THREE.Points(this.echoGeo, this.echoMat);
      this.echoPts.frustumCulled = false;
      scene.add(this.echoPts);
      this.echoTimer = 0;

      // --- Ground / void marks ---
      this.markPos = new Float32Array(MAX_MARKS * 3);
      this.markLife = new Float32Array(MAX_MARKS);
      for (let i = 0; i < MAX_MARKS; i++) {
        this.markLife[i] = 0;
        this.markPos[i * 3 + 1] = -9999;
      }
      this.markGeo = new THREE.BufferGeometry();
      this.markGeo.setAttribute("position", new THREE.BufferAttribute(this.markPos, 3));
      this.markMat = new THREE.PointsMaterial({
        map: this.soft,
        color: 0x22d3ee,
        size: 0.9,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
        fog: false,
      });
      this.marks = new THREE.Points(this.markGeo, this.markMat);
      this.marks.frustumCulled = false;
      scene.add(this.marks);
      this.markCursor = 0;
      this.markTimer = 0;

      this._tmp = new THREE.Vector3();
      this._side = new THREE.Vector3();
      this._up = new THREE.Vector3(0, 1, 0);
      this._params = calculateTrailParams({});
      this._t = 0;
    }

    /**
     * Main update — call every frame after player moves.
     */
    update(dt, playerPos, opts) {
      this._t += dt;
      const p = calculateTrailParams(opts);
      this._params = p;

      // Sample point slightly behind/above Bolt's chest
      const sample = this._tmp.set(
        playerPos.x,
        playerPos.y + 0.75,
        playerPos.z
      );

      // Only grow history when moving or sprinting with power
      const moving = (opts.speed || 0) > 1.2 || opts.sprinting;
      if (moving || p.power > 0.15) {
        // Don't stack identical points
        const last = this.history[0];
        if (!last || last.distanceToSquared(sample) > 0.04) {
          this.history.unshift(sample.clone());
        }
      }
      const targetLen = Math.max(4, Math.min(this.maxHist, p.length));
      while (this.history.length > targetLen) this.history.pop();

      this._updateRibbon(p);
      this._updateCorePoints(p);
      this._updateSparks(dt, p, sample, opts);
      this._updateArcs(dt, p);
      this._updateEchoes(dt, p);
      this._updateMarks(dt, p, sample, opts);
    }

    _updateRibbon(p) {
      const n = this.history.length;
      if (n < 2 || p.power < 0.05) {
        this.ribbon.visible = false;
        return;
      }
      this.ribbon.visible = true;
      const halfW = p.width * 0.5;
      const pulse =
        p.pulse ? 1 + Math.sin(this._t * 8) * 0.08 * p.power : 1;

      for (let i = 0; i <= this.ribbonMax; i++) {
        const hi = Math.min(i, n - 1);
        const pos = this.history[hi] || this.history[n - 1];
        // Side vector from trail direction
        let dx = 0;
        let dz = 1;
        if (hi < n - 1) {
          const next = this.history[hi + 1];
          dx = pos.x - next.x;
          dz = pos.z - next.z;
          const len = Math.hypot(dx, dz) || 1;
          dx /= len;
          dz /= len;
        } else if (hi > 0) {
          const prev = this.history[hi - 1];
          dx = prev.x - pos.x;
          dz = prev.z - pos.z;
          const len = Math.hypot(dx, dz) || 1;
          dx /= len;
          dz /= len;
        }
        // Perpendicular in XZ
        const sx = -dz;
        const sz = dx;
        const t = i / Math.max(1, targetLenSafe(this, n, p));
        const fade = Math.pow(1 - t, 1.15) * p.opacity * pulse;
        const w = halfW * (1 - t * 0.55) * pulse;

        const iL = i * 2;
        const iR = i * 2 + 1;
        this.ribPos[iL * 3] = pos.x + sx * w;
        this.ribPos[iL * 3 + 1] = pos.y;
        this.ribPos[iL * 3 + 2] = pos.z + sz * w;
        this.ribPos[iR * 3] = pos.x - sx * w;
        this.ribPos[iR * 3 + 1] = pos.y;
        this.ribPos[iR * 3 + 2] = pos.z - sz * w;

        const c = p.color;
        // Fade alpha along trail; gold-shift near head at high power
        for (let k = 0; k < 2; k++) {
          const vi = (i * 2 + k) * 4;
          this.ribCol[vi] = c.r;
          this.ribCol[vi + 1] = c.g;
          this.ribCol[vi + 2] = c.b;
          this.ribCol[vi + 3] = fade * (k === 0 ? 0.95 : 0.85);
        }
      }
      // Degenerate unused ribbon points
      if (n <= this.ribbonMax) {
        const last = this.history[n - 1];
        for (let i = n; i <= this.ribbonMax; i++) {
          const iL = i * 2;
          const iR = i * 2 + 1;
          this.ribPos[iL * 3] = last.x;
          this.ribPos[iL * 3 + 1] = last.y;
          this.ribPos[iL * 3 + 2] = last.z;
          this.ribPos[iR * 3] = last.x;
          this.ribPos[iR * 3 + 1] = last.y;
          this.ribPos[iR * 3 + 2] = last.z;
          for (let k = 0; k < 2; k++) {
            const vi = (i * 2 + k) * 4;
            this.ribCol[vi + 3] = 0;
          }
        }
      }
      this.ribGeo.attributes.position.needsUpdate = true;
      this.ribGeo.attributes.color.needsUpdate = true;
      this.ribGeo.computeBoundingSphere();
    }

    _updateCorePoints(p) {
      const n = this.history.length;
      for (let i = 0; i < MAX_POINTS; i++) {
        if (i < n && p.power > 0.08) {
          const pos = this.history[i];
          const t = i / Math.max(1, n);
          this.corePos[i * 3] = pos.x;
          this.corePos[i * 3 + 1] = pos.y + Math.sin(i * 2.1 + this._t * 6) * 0.04;
          this.corePos[i * 3 + 2] = pos.z;
        } else {
          this.corePos[i * 3 + 1] = -9999;
        }
      }
      this.coreGeo.attributes.position.needsUpdate = true;
      this.coreMat.color.copy(p.color).lerp(new THREE.Color(0xffffff), 0.45);
      this.coreMat.opacity = THREE.MathUtils.clamp(p.opacity * 0.75, 0.05, 0.9);
      this.coreMat.size = p.sparkSize * 0.55 + 0.08;
      this.corePts.visible = p.power > 0.08;
    }

    _updateSparks(dt, p, sample, opts) {
      // Spawn
      const rate = p.particleRate * (opts.sprinting ? 1.4 : 0.7);
      if (p.power > 0.12 && Math.random() < rate * 0.85) {
        const idx = this.sparkCursor % MAX_SPARKS;
        this.sparkCursor++;
        // Spawn near recent history (tail)
        const hi = Math.min(
          this.history.length - 1,
          Math.floor(Math.random() * Math.min(12, this.history.length))
        );
        const origin = this.history[hi] || sample;
        this.sparkPos[idx * 3] = origin.x + (Math.random() - 0.5) * p.width;
        this.sparkPos[idx * 3 + 1] = origin.y + (Math.random() - 0.5) * 0.4;
        this.sparkPos[idx * 3 + 2] = origin.z + (Math.random() - 0.5) * p.width;
        this.sparkVel[idx].set(
          (Math.random() - 0.5) * 4,
          (Math.random() - 0.3) * 5,
          (Math.random() - 0.5) * 4
        );
        this.sparkLife[idx] = 0.25 + Math.random() * 0.45 * p.power;
      }
      // Integrate
      for (let i = 0; i < MAX_SPARKS; i++) {
        if (this.sparkLife[i] <= 0) {
          this.sparkPos[i * 3 + 1] = -9999;
          continue;
        }
        this.sparkLife[i] -= dt;
        this.sparkPos[i * 3] += this.sparkVel[i].x * dt;
        this.sparkPos[i * 3 + 1] += this.sparkVel[i].y * dt;
        this.sparkPos[i * 3 + 2] += this.sparkVel[i].z * dt;
        this.sparkVel[i].y -= 2 * dt;
      }
      this.sparkGeo.attributes.position.needsUpdate = true;
      this.sparkMat.color.copy(p.color);
      this.sparkMat.size = p.sparkSize;
      this.sparkMat.opacity = THREE.MathUtils.clamp(0.3 + p.power * 0.6, 0.15, 0.95);
    }

    _updateArcs(dt, p) {
      // Spawn branching lightning off the trail
      if (
        this.history.length > 4 &&
        p.power > 0.25 &&
        Math.random() < p.arcChance * 0.4
      ) {
        const hi = 1 + Math.floor(Math.random() * Math.min(20, this.history.length - 2));
        const a = this.history[hi];
        const b = this.history[Math.min(hi + 1, this.history.length - 1)];
        const midX = (a.x + b.x) * 0.5;
        const midY = (a.y + b.y) * 0.5;
        const midZ = (a.z + b.z) * 0.5;
        // Branch perpendicular
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const len = Math.hypot(dx, dz) || 1;
        const sx = -dz / len;
        const sz = dx / len;
        const branch = (0.4 + Math.random() * 1.2) * p.lightningIntensity * p.width;
        const side = Math.random() > 0.5 ? 1 : -1;
        const idx = this.arcCursor % MAX_ARCS;
        this.arcCursor++;
        const base = idx * 6;
        this.arcPos[base] = a.x;
        this.arcPos[base + 1] = a.y;
        this.arcPos[base + 2] = a.z;
        // Jagged mid then tip
        this.arcPos[base + 3] = midX + sx * branch * side + (Math.random() - 0.5) * 0.3;
        this.arcPos[base + 4] = midY + (Math.random() - 0.3) * 0.8;
        this.arcPos[base + 5] = midZ + sz * branch * side + (Math.random() - 0.5) * 0.3;
        this.arcLife[idx] = 0.08 + Math.random() * 0.12 * p.power;
      }
      let any = false;
      for (let i = 0; i < MAX_ARCS; i++) {
        if (this.arcLife[i] > 0) {
          this.arcLife[i] -= dt;
          any = true;
          if (this.arcLife[i] <= 0) {
            // Hide segment
            const base = i * 6;
            this.arcPos[base + 1] = -9999;
            this.arcPos[base + 4] = -9999;
          }
        }
      }
      this.arcGeo.attributes.position.needsUpdate = true;
      this.arcMat.color.copy(p.color).lerp(new THREE.Color(0xffffff), 0.3);
      this.arcMat.opacity = THREE.MathUtils.clamp(p.lightningIntensity * 0.55, 0.1, 0.9);
      this.arcs.visible = any || p.power > 0.3;
    }

    _updateEchoes(dt, p) {
      this.echoTimer -= dt;
      // Drop a Resonance echo at high power
      if (p.afterglow && p.power > 0.6 && this.echoTimer <= 0 && this.history.length > 8) {
        this.echoTimer = THREE.MathUtils.lerp(0.55, 0.22, p.power);
        // Find free echo slot
        let slot = null;
        for (let i = 0; i < MAX_ECHOES; i++) {
          if (this.echoes[i].life <= 0) {
            slot = this.echoes[i];
            break;
          }
        }
        if (slot) {
          slot.life = slot.maxLife * p.fadeMul * (0.7 + p.power * 0.5);
          slot.points = [];
          const step = Math.max(1, Math.floor(this.history.length / 12));
          for (let i = 0; i < this.history.length; i += step) {
            slot.points.push(this.history[i].clone());
            if (slot.points.length >= 12) break;
          }
          slot.color = p.colorHex;
        }
      }
      // Write all echoes into buffer
      let wi = 0;
      let maxOp = 0;
      for (let e = 0; e < MAX_ECHOES; e++) {
        const echo = this.echoes[e];
        if (echo.life <= 0) continue;
        echo.life -= dt;
        const u = Math.max(0, echo.life / (echo.maxLife * p.fadeMul || 1));
        maxOp = Math.max(maxOp, u * 0.45 * p.power);
        for (let j = 0; j < echo.points.length && wi < MAX_ECHOES * 12; j++) {
          const pt = echo.points[j];
          this.echoPos[wi * 3] = pt.x;
          this.echoPos[wi * 3 + 1] = pt.y + Math.sin(this._t * 3 + j) * 0.05;
          this.echoPos[wi * 3 + 2] = pt.z;
          wi++;
        }
      }
      while (wi < MAX_ECHOES * 12) {
        this.echoPos[wi * 3 + 1] = -9999;
        wi++;
      }
      this.echoGeo.attributes.position.needsUpdate = true;
      this.echoMat.color.setHex(p.colorHex);
      this.echoMat.opacity = maxOp;
      this.echoMat.size = 0.25 + p.power * 0.35;
      this.echoPts.visible = maxOp > 0.02;
    }

    _updateMarks(dt, p, sample, opts) {
      this.markTimer -= dt;
      if (p.groundMark && this.markTimer <= 0 && (opts.speed || 0) > 10) {
        this.markTimer = 0.08;
        const idx = this.markCursor % MAX_MARKS;
        this.markCursor++;
        const gx = sample.x + (Math.random() - 0.5) * 0.6;
        const gz = sample.z + (Math.random() - 0.5) * 0.6;
        const gy = this.heightAt(gx, gz) + 0.08;
        this.markPos[idx * 3] = gx;
        this.markPos[idx * 3 + 1] = gy;
        this.markPos[idx * 3 + 2] = gz;
        this.markLife[idx] = 0.6 + p.power * 0.9;
      }
      // Orbital: void marks float at trail height instead of ground
      if (
        !p.groundMark &&
        p.power > 0.7 &&
        this.markTimer <= 0 &&
        (opts.scaleStage === "orbital" ||
          opts.scaleStage === "solar" ||
          opts.scaleStage === "cosmic")
      ) {
        this.markTimer = 0.12;
        const idx = this.markCursor % MAX_MARKS;
        this.markCursor++;
        const hi = Math.min(5, this.history.length - 1);
        const origin = this.history[hi] || sample;
        this.markPos[idx * 3] = origin.x;
        this.markPos[idx * 3 + 1] = origin.y;
        this.markPos[idx * 3 + 2] = origin.z;
        this.markLife[idx] = 1.0 + p.power * 1.5 * p.fadeMul;
      }

      let maxOp = 0;
      for (let i = 0; i < MAX_MARKS; i++) {
        if (this.markLife[i] > 0) {
          this.markLife[i] -= dt;
          maxOp = Math.max(maxOp, this.markLife[i]);
          if (this.markLife[i] <= 0) this.markPos[i * 3 + 1] = -9999;
        }
      }
      this.markGeo.attributes.position.needsUpdate = true;
      this.markMat.color.copy(p.color);
      this.markMat.opacity = THREE.MathUtils.clamp(maxOp * 0.4, 0, 0.65);
      this.markMat.size = 0.5 + p.power * 0.7;
      this.marks.visible = maxOp > 0.05;
    }

    getParams() {
      return this._params;
    }
  }

  function targetLenSafe(self, n, p) {
    return Math.max(1, Math.min(n - 1, p.length || n));
  }

  global.BoltTrail = {
    LightningTrail: LightningTrail,
    calculateTrailParams: calculateTrailParams,
  };
})(typeof window !== "undefined" ? window : globalThis);
