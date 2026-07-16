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
      if (biomeId === "emberVoid") {
        base = ["#120805", "#1a0c08", "#2a120a", "#3b1810"];
        vein = "rgba(249,115,22,0.4)";
        speck = [200, 90, 40];
        crack = "rgba(80,30,10,0.55)";
        glow = "rgba(251,146,60,0.2)";
      } else if (biomeId === "whisperStars") {
        base = ["#05050e", "#080814", "#0e0e22", "#16162e"];
        vein = "rgba(165,180,252,0.3)";
        speck = [170, 180, 255];
        crack = "rgba(30,30,60,0.5)";
        glow = "rgba(129,140,248,0.18)";
      } else if (biomeId === "solarGold") {
        base = ["#120e06", "#1c1408", "#2a1c0a", "#3d2810"];
        vein = "rgba(251,191,36,0.38)";
        speck = [230, 190, 70];
        crack = "rgba(60,40,10,0.5)";
        glow = "rgba(252,211,77,0.2)";
      } else if (biomeId === "frostGlacier") {
        base = ["#060e18", "#0a1628", "#102038", "#1a3858"];
        vein = "rgba(125,211,252,0.35)";
        speck = [190, 230, 255];
        crack = "rgba(20,40,70,0.55)";
        glow = "rgba(186,230,253,0.22)";
      } else if (biomeId === "jadeCanopy") {
        base = ["#030e08", "#061a12", "#0a2a1a", "#0f3a24"];
        vein = "rgba(52,211,153,0.35)";
        speck = [90, 230, 170];
        crack = "rgba(10,40,25,0.5)";
        glow = "rgba(110,231,183,0.18)";
      } else if (biomeId === "rosePulse") {
        base = ["#10050c", "#1a0814", "#2a1020", "#3b1830"];
        vein = "rgba(244,114,182,0.35)";
        speck = [250, 130, 190];
        crack = "rgba(50,15,35,0.5)";
        glow = "rgba(249,168,212,0.2)";
      } else {
        base = ["#061018", "#0a1e32", "#0c2840", "#123550"];
        vein = "rgba(34,211,238,0.35)";
        speck = [100, 230, 245];
        crack = "rgba(15,40,60,0.5)";
        glow = "rgba(103,232,249,0.2)";
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

      // Energy veins (glowing)
      ctx.strokeStyle = vein;
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 35; i++) {
        let x = Math.random() * s;
        let y = Math.random() * s;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let j = 0; j < 6; j++) {
          x += (Math.random() - 0.5) * 50;
          y += (Math.random() - 0.5) * 50;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Soft grid panels (subtle)
      ctx.strokeStyle = vein;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 1;
      const step = s / 12;
      for (let i = 0; i <= 12; i++) {
        ctx.beginPath();
        ctx.moveTo(i * step + Math.sin(i * 1.7) * 6, 0);
        ctx.lineTo(i * step - Math.cos(i) * 6, s);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * step);
        ctx.lineTo(s, i * step + Math.sin(i * 1.3) * 8);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Micro pebbles / grit
      for (let i = 0; i < 12000; i++) {
        const x = Math.random() * s;
        const y = Math.random() * s;
        const a = 0.08 + Math.random() * 0.4;
        const sz = Math.random() > 0.92 ? 2 + Math.random() * 2 : 1;
        ctx.fillStyle = `rgba(${speck[0]},${speck[1]},${speck[2]},${a})`;
        ctx.fillRect(x, y, sz, sz);
      }

      // Darker pebble shadows
      for (let i = 0; i < 3000; i++) {
        ctx.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.15})`;
        ctx.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 2, 1 + Math.random());
      }

      // Biolum glow pools
      for (let i = 0; i < 55; i++) {
        const x = Math.random() * s;
        const y = Math.random() * s;
        const r = 10 + Math.random() * 50;
        const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, glow);
        grd.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Crystal / ember flecks
      for (let i = 0; i < 200; i++) {
        const x = Math.random() * s;
        const y = Math.random() * s;
        ctx.fillStyle = `rgba(${speck[0]},${speck[1]},${speck[2]},${0.35 + Math.random() * 0.5})`;
        ctx.beginPath();
        ctx.moveTo(x, y - 2);
        ctx.lineTo(x + 1.5, y);
        ctx.lineTo(x, y + 2);
        ctx.lineTo(x - 1.5, y);
        ctx.fill();
      }
    }, 1024);
  }

  /** Simple height-ish bump map for ground (shared noise look) */
  function makeGroundBump() {
    return canvasTex((ctx, s) => {
      ctx.fillStyle = "#808080";
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 8000; i++) {
        const v = 60 + Math.random() * 140;
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 3, 1 + Math.random() * 3);
      }
      for (let i = 0; i < 80; i++) {
        const x = Math.random() * s;
        const y = Math.random() * s;
        const r = 15 + Math.random() * 50;
        const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, "#b0b0b0");
        grd.addColorStop(1, "#707070");
        ctx.fillStyle = grd;
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }, 512);
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
  function createCosmicStarfield(scene) {
    const root = new THREE.Group();
    root.name = "CosmicStarfield";
    scene.add(root);

    const starTex = makeStarSpriteTexture();
    const layers = [];

    function addStarLayer(count, radiusMin, radiusMax, size, baseColor, opacity) {
      const pos = new Float32Array(count * 3);
      const col = new Float32Array(count * 3);
      const c = new THREE.Color(baseColor);
      for (let i = 0; i < count; i++) {
        const r = radiusMin + Math.random() * (radiusMax - radiusMin);
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        pos[i * 3 + 2] = r * Math.cos(phi);
        // Warm / cool / pure white mix
        const roll = Math.random();
        if (roll < 0.15) {
          col[i * 3] = 1.0; col[i * 3 + 1] = 0.75 + Math.random() * 0.15; col[i * 3 + 2] = 0.55;
        } else if (roll < 0.35) {
          col[i * 3] = 0.65; col[i * 3 + 1] = 0.8; col[i * 3 + 2] = 1.0;
        } else if (roll < 0.45) {
          col[i * 3] = 0.85; col[i * 3 + 1] = 0.7; col[i * 3 + 2] = 1.0; // violet
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
        sizeAttenuation: true,
        transparent: true,
        opacity: opacity,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending,
        vertexColors: true,
        fog: false,
      });
      const pts = new THREE.Points(geo, mat);
      pts.renderOrder = -50;
      root.add(pts);
      layers.push({ pts: pts, mat: mat, baseSize: size, baseOp: opacity, twinkle: Math.random() * 10 });
      return mat;
    }

    // Dense far field + medium sparkle + bright nearby jewels
    addStarLayer(4200, 400, 1600, 2.2, 0xdbeafe, 0.85);
    addStarLayer(1800, 350, 1200, 4.5, 0xf0f9ff, 0.9);
    addStarLayer(220, 300, 900, 11, 0xffffff, 0.95); // hero stars with flare

    // Soft nebula puffs (billboards as sprites via points with large size)
    const nebulaDefs = [
      { color: [100, 60, 200], n: 18, size: 180 },
      { color: [20, 140, 180], n: 14, size: 160 },
      { color: [180, 80, 40], n: 10, size: 140 },
      { color: [40, 200, 160], n: 8, size: 150 },
    ];
    const nebulaMats = [];
    for (let n = 0; n < nebulaDefs.length; n++) {
      const def = nebulaDefs[n];
      const tex = makeNebulaSpriteTexture(def.color[0], def.color[1], def.color[2]);
      const pos = new Float32Array(def.n * 3);
      for (let i = 0; i < def.n; i++) {
        const r = 600 + Math.random() * 1000;
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
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      });
      const pts = new THREE.Points(geo, mat);
      pts.renderOrder = -60;
      root.add(pts);
      nebulaMats.push(mat);
    }

    // Milky-way style soft band (elongated nebula points)
    {
      const bandN = 80;
      const pos = new Float32Array(bandN * 3);
      for (let i = 0; i < bandN; i++) {
        const t = (i / bandN) * Math.PI * 2;
        const r = 700 + Math.random() * 400;
        pos[i * 3] = Math.cos(t) * r + (Math.random() - 0.5) * 120;
        pos[i * 3 + 1] = (Math.random() - 0.5) * 80;
        pos[i * 3 + 2] = Math.sin(t) * r * 0.35 + (Math.random() - 0.5) * 80;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({
        map: makeNebulaSpriteTexture(180, 200, 255),
        size: 90,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      });
      root.add(new THREE.Points(geo, mat));
      nebulaMats.push(mat);
    }

    let boost = 1;

    function update(playerPos, starBoost, dt) {
      dt = dt != null ? dt : 0.016;
      boost = THREE.MathUtils.damp(boost, starBoost != null ? starBoost : 1, 2.0, dt);
      if (playerPos) root.position.copy(playerPos);
      const t = performance.now() * 0.001;
      for (let i = 0; i < layers.length; i++) {
        const L = layers[i];
        const tw = 0.85 + 0.15 * Math.sin(t * (1.2 + i * 0.4) + L.twinkle);
        L.mat.opacity = Math.min(1, L.baseOp * (0.55 + boost * 0.45) * tw);
        L.mat.size = L.baseSize * (0.7 + boost * 0.55) * (i === 2 ? tw : 1);
      }
      for (let i = 0; i < nebulaMats.length; i++) {
        nebulaMats[i].opacity = (0.1 + boost * 0.16) * (0.9 + 0.1 * Math.sin(t * 0.3 + i));
      }
      root.rotation.y += dt * 0.003;
    }

    // Primary material for external opacity/size tweaks (compat)
    const primaryMat = layers[0] ? layers[0].mat : null;

    return {
      group: root,
      material: primaryMat,
      layers: layers,
      update: update,
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

    return {
      enabled: enabled,
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
      resize: function (width, height) {
        const nw = Math.max(1, Math.floor(width / 2));
        const nh = Math.max(1, Math.floor(height / 2));
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
    const ambient = new THREE.HemisphereLight(0xd0dcf5, 0x14101f, 0.48);
    ambient.name = "HemiLight";
    scene.add(ambient);

    // Strong key (sun) — defines form on white fur
    const sun = new THREE.DirectionalLight(0xfff4e8, 1.15);
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
    map.repeat.set(8, 8);
    map.anisotropy = 8;
    const bump = getGroundBump();
    bump.repeat.set(10, 10);
    bump.anisotropy = 4;
    let em = 0x041018;
    let emI = 0.16;
    let rough = 0.88;
    let metal = 0.08;
    let col = 0xffffff;
    if (biomeId === "emberVoid") {
      em = 0x1a0800;
      emI = 0.18;
      rough = 0.94;
      metal = 0.06;
    } else if (biomeId === "whisperStars") {
      em = 0x080818;
      emI = 0.14;
      rough = 0.88;
      metal = 0.12;
    } else if (biomeId === "solarGold") {
      em = 0x1c1408;
      emI = 0.18;
      rough = 0.84;
      metal = 0.14;
    } else if (biomeId === "frostGlacier") {
      em = 0x0a1628;
      emI = 0.2;
      rough = 0.52;
      metal = 0.3;
      col = 0xe8f4ff;
    } else if (biomeId === "jadeCanopy") {
      em = 0x061a12;
      emI = 0.16;
      rough = 0.9;
    } else if (biomeId === "rosePulse") {
      em = 0x1a0814;
      emI = 0.18;
      rough = 0.86;
    } else {
      metal = 0.14;
      emI = 0.18;
    }
    return new THREE.MeshStandardMaterial({
      map: map,
      bumpMap: bump,
      bumpScale: 0.35,
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

  /** Soft white/cream fur with subtle strand noise */
  function makeFurTexture() {
    // Pure cool-white GSD fur (matches key art — no brown cast)
    return canvasTex((ctx, s) => {
      const g = ctx.createLinearGradient(0, 0, s, s);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.4, "#f8fbff");
      g.addColorStop(0.75, "#eef4fc");
      g.addColorStop(1, "#e4ecf8");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
      // Fine white strands
      for (let i = 0; i < 1400; i++) {
        const x = Math.random() * s;
        const y = Math.random() * s;
        const len = 6 + Math.random() * 22;
        ctx.strokeStyle = `rgba(255,255,255,${0.12 + Math.random() * 0.35})`;
        ctx.lineWidth = 0.5 + Math.random() * 1.2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (Math.random() - 0.5) * 3, y + len);
        ctx.stroke();
      }
      // Soft cool shadow pockets only (never warm/brown)
      for (let i = 0; i < 40; i++) {
        const x = Math.random() * s;
        const y = Math.random() * s;
        const r = 12 + Math.random() * 40;
        const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, "rgba(180,200,230,0.12)");
        rg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }, 512);
  }

  /** Darker GSD saddle / mask fur */
  function makeSaddleTexture() {
    return canvasTex((ctx, s) => {
      const g = ctx.createLinearGradient(0, 0, s, s);
      g.addColorStop(0, "#2a3348");
      g.addColorStop(0.5, "#1a2235");
      g.addColorStop(1, "#0f1522");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 500; i++) {
        const x = Math.random() * s;
        const y = Math.random() * s;
        ctx.strokeStyle = `rgba(90,110,150,${0.1 + Math.random() * 0.2})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 2, y + 8 + Math.random() * 12);
        ctx.stroke();
      }
      // Cyan energy flecks in the dark fur
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = `rgba(60,220,255,${0.08 + Math.random() * 0.2})`;
        ctx.fillRect(Math.random() * s, Math.random() * s, 2, 2);
      }
    }, 256);
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

  global.BoltGraphics = {
    getGroundTexture: getGroundTexture,
    getRockTexture: getRockTexture,
    getSkyTexture: getSkyTexture,
    getFurTexture: getFurTexture,
    getSaddleTexture: getSaddleTexture,
    getSoftSpriteTexture: getSoftSpriteTexture,
    getWingTexture: getWingTexture,
    createSkyDome: createSkyDome,
    createHomePlanet: createHomePlanet,
    createDistantPlanets: createDistantPlanets,
    createCosmicStarfield: createCosmicStarfield,
    createSoftBloom: createSoftBloom,
    createLighting: createLighting,
    createHorizonHaze: createHorizonHaze,
    createParticleField: createParticleField,
    makeGroundMaterial: makeGroundMaterial,
    makeRockMaterial: makeRockMaterial,
    styleBoltMesh: styleBoltMesh,
  };
})(typeof window !== "undefined" ? window : globalThis);
