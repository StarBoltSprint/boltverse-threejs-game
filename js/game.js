/**
 * BOLT ENGINE — Spiral-47 prototype
 * Sprint-as-Fundamental-Force 3D game
 * Powered by xAI & YOU
 *
 * Uses global THREE from three.min.js (no bundler / works with file://)
 */
(function () {
  "use strict";

  const statusEl = document.getElementById("load-status");
  if (typeof THREE === "undefined") {
    if (statusEl) {
      statusEl.textContent =
        "Failed to load Three.js. Make sure js/three.min.js is next to game.js (open the whole bolt-engine folder).";
      statusEl.style.color = "#f87171";
    }
    return;
  }
  if (statusEl) statusEl.textContent = "SYSTEMS ONLINE · READY";

  if (!window.BoltProcedural || !window.BoltProcedural.ProceduralSpawner) {
    if (statusEl) {
      statusEl.textContent = "Missing procedural.js — open the full bolt-engine folder.";
      statusEl.style.color = "#f87171";
    }
    return;
  }
  if (!window.BoltOpenWorld || !window.BoltOpenWorld.OpenWorld) {
    if (statusEl) {
      statusEl.textContent = "Missing openworld.js — open the full bolt-engine folder.";
      statusEl.style.color = "#f87171";
    }
    return;
  }
  if (!window.BoltGraphics) {
    if (statusEl) {
      statusEl.textContent = "Missing graphics.js — open the full bolt-engine folder.";
      statusEl.style.color = "#f87171";
    }
    return;
  }
  if (!window.BoltCitadel || !window.BoltCitadel.createCitadel) {
    if (statusEl) {
      statusEl.textContent = "Missing citadel.js — open the full bolt-engine folder.";
      statusEl.style.color = "#f87171";
    }
    return;
  }
  // Audio is optional — game still runs if audio.js missing
  // (named Sfx — avoid clashing with browser global `Audio`)
  const Sfx = window.BoltAudio || null;

  try {
  // ---------------------------------------------------------------------------
  // DOM
  // ---------------------------------------------------------------------------
  const canvas = document.getElementById("c");
  const boot = document.getElementById("boot");
  const hud = document.getElementById("hud");
  const pauseEl = document.getElementById("pause");
  const toastEl = document.getElementById("toast");
  const spawnStatsEl = document.getElementById("spawn-stats");
  const startBtn = document.getElementById("start-btn");
  const resumeBtn = document.getElementById("resume-btn");
  const bootFsBtn = document.getElementById("boot-fs-btn");
  const fsBtn = document.getElementById("fs-btn");
  const gateFlashEl = document.getElementById("gate-flash");
  const gateBannerEl = document.getElementById("gate-banner");
  const decreePanelEl = document.getElementById("decree-panel");
  const decreeListEl = document.getElementById("decree-list");
  const decreeCountEl = document.getElementById("decree-count");
  const decreeCloseBtn = document.getElementById("decree-close");
  const meaningfulMeterEl = document.querySelector(".meter.meaningful");
  const landmarkMarkersEl = document.getElementById("landmark-markers");
  const questPanelEl = document.getElementById("quest-panel");
  const questTitleEl = document.getElementById("quest-title");
  const questDescEl = document.getElementById("quest-desc");
  const questProgressEl = document.getElementById("quest-progress");
  const questBarEl = document.getElementById("quest-bar");
  const packFlashEl = document.getElementById("pack-flash");
  const packBannerEl = document.getElementById("pack-banner");
  const progressPanelEl = document.getElementById("progress-panel");
  const progressListEl = document.getElementById("progress-list");
  const progressCloseBtn = document.getElementById("progress-close");
  const pauseStatsEl = document.getElementById("pause-stats");
  const resonanceMeterEl = (function () {
    const bar = document.getElementById("bar-resonance");
    return bar && bar.closest ? bar.closest(".meter") : null;
  })();

  const ui = {
    barSprint: document.getElementById("bar-sprint"),
    barMomentum: document.getElementById("bar-momentum"),
    barIntention: document.getElementById("bar-intention"),
    barMeaningful: document.getElementById("bar-meaningful"),
    barCore: document.getElementById("bar-core"),
    barResonance: document.getElementById("bar-resonance"),
    valSpeed: document.getElementById("val-speed"),
    valMomentum: document.getElementById("val-momentum"),
    valIntention: document.getElementById("val-intention"),
    valMeaningful: document.getElementById("val-meaningful"),
    valCore: document.getElementById("val-core"),
    valCoreStage: document.getElementById("val-core-stage"),
    valResonance: document.getElementById("val-resonance"),
    meterCore: document.getElementById("meter-core"),
    scaleBadge: document.getElementById("scale-badge"),
    scaleBadgeName: document.getElementById("scale-badge-name"),
    scaleBadgeMeta: document.getElementById("scale-badge-meta"),
    planetNav: document.getElementById("planet-nav"),
    planetNavName: document.getElementById("planet-nav-name"),
    planetNavFill: document.getElementById("planet-nav-fill"),
    planetNavDist: document.getElementById("planet-nav-dist"),
    planetNavEta: document.getElementById("planet-nav-eta"),
    planetNavStatus: document.getElementById("planet-nav-status"),
  };

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------
  const keys = Object.create(null);
  let pointerLocked = false;
  let paused = false;
  let started = false;
  let yaw = 0; // camera orbit yaw (also WASD facing)
  // Third-person elevation: 0 = horizon · higher = more overhead (default behind-and-up)
  let pitch = 0.36;
  const PITCH_DEFAULT = 0.36;
  const PITCH_MIN = 0.12;
  const PITCH_MAX = 0.82;
  // Camera zoom: 1 = default · scroll / [ ] · lower = closer · higher = farther
  let camZoom = 1;
  let camZoomTarget = 1;
  const CAM_ZOOM_MIN = 0.55;
  const CAM_ZOOM_MAX = 2.4;

  // Mouse look — stable across high-DPI mice / Windows / multi-monitor spikes
  const LOOK_SENS = 0.00155;
  const LOOK_MAX_STEP = 48;
  const LOOK_MAX_FRAME = 90;
  let lookAccumX = 0;
  let lookAccumY = 0;
  let lookIgnoreEvents = 0;
  let lookDragging = false; // allow orbit without pointer lock (click-drag)

  function setCamZoom(z) {
    camZoomTarget = THREE.MathUtils.clamp(z, CAM_ZOOM_MIN, CAM_ZOOM_MAX);
  }

  function resetThirdPersonCam() {
    pitch = PITCH_DEFAULT;
    camZoom = 1;
    camZoomTarget = 1;
    lookAccumX = 0;
    lookAccumY = 0;
  }

  /** Apply queued mouse look once per frame */
  function applyLookInput() {
    let dx = lookAccumX;
    let dy = lookAccumY;
    lookAccumX = 0;
    lookAccumY = 0;
    if (!isFinite(dx)) dx = 0;
    if (!isFinite(dy)) dy = 0;
    dx = THREE.MathUtils.clamp(dx, -LOOK_MAX_FRAME, LOOK_MAX_FRAME);
    dy = THREE.MathUtils.clamp(dy, -LOOK_MAX_FRAME, LOOK_MAX_FRAME);
    if (dx === 0 && dy === 0) return;
    yaw -= dx * LOOK_SENS;
    // Mouse up → more horizon (lower elevation); mouse down → higher / more top-down
    pitch -= dy * LOOK_SENS;
    pitch = THREE.MathUtils.clamp(pitch, PITCH_MIN, PITCH_MAX);
    if (!isFinite(yaw)) yaw = 0;
    if (!isFinite(pitch)) pitch = PITCH_DEFAULT;
  }

  function tryPointerLock() {
    if (!canvas || paused) return;
    try {
      if (canvas.requestPointerLock) canvas.requestPointerLock();
    } catch (e) { /* ignore */ }
  }

  // ---------------------------------------------------------------------------
  // Fullscreen
  // ---------------------------------------------------------------------------
  function isFullscreen() {
    return !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.msFullscreenElement
    );
  }
  function syncFullscreenUI() {
    const on = isFullscreen();
    document.body.classList.toggle("is-fs", on);
    if (bootFsBtn) {
      bootFsBtn.classList.toggle("is-active", on);
      bootFsBtn.textContent = on ? "EXIT FULLSCREEN" : "FULLSCREEN";
    }
    if (fsBtn) {
      fsBtn.classList.toggle("is-active", on);
      fsBtn.title = on ? "Exit fullscreen (F)" : "Toggle fullscreen (F)";
      fsBtn.setAttribute("aria-label", on ? "Exit fullscreen" : "Fullscreen");
    }
  }
  function toggleFullscreen() {
    try {
      if (!isFullscreen()) {
        const el = document.documentElement;
        const req =
          el.requestFullscreen ||
          el.webkitRequestFullscreen ||
          el.msRequestFullscreen;
        if (req) {
          const p = req.call(el);
          if (p && p.catch) p.catch(function () {});
        }
      } else {
        const exit =
          document.exitFullscreen ||
          document.webkitExitFullscreen ||
          document.msExitFullscreen;
        if (exit) {
          const p = exit.call(document);
          if (p && p.catch) p.catch(function () {});
        }
      }
    } catch (errFs) {
      console.warn("fullscreen", errFs);
    }
  }
  document.addEventListener("fullscreenchange", syncFullscreenUI);
  document.addEventListener("webkitfullscreenchange", syncFullscreenUI);
  if (bootFsBtn) bootFsBtn.addEventListener("click", function (e) {
    e.preventDefault();
    toggleFullscreen();
  });
  if (fsBtn) fsBtn.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    toggleFullscreen();
  });
  syncFullscreenUI();

  window.addEventListener("keydown", (e) => {
    keys[e.code] = true;
    // Fullscreen (F) — works on boot screen and in-game
    if (e.code === "KeyF" && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Don't steal F when typing in a field (none now, but safe)
      const tag = (e.target && e.target.tagName) || "";
      if (tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        toggleFullscreen();
      }
    }
    if (e.code === "Escape" && started) togglePause();
    if (e.code === "KeyH" && started && !paused) howl();
    if (e.code === "KeyR" && started && !paused) recallToCitadel();
    if (e.code === "KeyL" && started) toggleDecreeLog();
    if (e.code === "KeyJ" && started) toggleQuestPanel();
    if (e.code === "KeyP" && started) toggleProgressPanel();
    if (e.code === "KeyM" && started) {
      if (Sfx && Sfx.toggleMute) {
        const m = Sfx.toggleMute();
        toast(m ? "AUDIO MUTED" : "AUDIO ON — Spiral-47 sings", 1600);
      }
    }
    // Zoom keys (work without pointer lock)
    if (started && !paused) {
      if (e.code === "BracketLeft" || e.code === "Minus") {
        setCamZoom(camZoomTarget * 1.12);
      }
      if (e.code === "BracketRight" || e.code === "Equal") {
        setCamZoom(camZoomTarget / 1.12);
      }
    }
  });
  window.addEventListener("keyup", (e) => { keys[e.code] = false; });

  document.addEventListener("pointerlockchange", () => {
    pointerLocked = document.pointerLockElement === canvas;
    // First events after lock often contain huge spikes on some GPUs/drivers
    if (pointerLocked) {
      lookIgnoreEvents = 3;
      lookAccumX = 0;
      lookAccumY = 0;
      lookDragging = false;
    } else {
      lookAccumX = 0;
      lookAccumY = 0;
    }
  });

  // Orbit: pointer lock OR click-and-drag on the canvas (works even if lock fails)
  canvas.addEventListener("mousedown", function (e) {
    if (!started || paused) return;
    if (e.button === 0 || e.button === 2) {
      lookDragging = true;
      tryPointerLock();
    }
  });
  window.addEventListener("mouseup", function () {
    lookDragging = false;
  });
  canvas.addEventListener("contextmenu", function (e) {
    if (started) e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (paused || !started) return;
    // Need lock or active drag to orbit (cam always follows Bolt either way)
    if (!pointerLocked && !lookDragging) return;
    if (lookIgnoreEvents > 0) {
      lookIgnoreEvents--;
      return;
    }
    let mx = e.movementX;
    let my = e.movementY;
    if (!isFinite(mx)) mx = 0;
    if (!isFinite(my)) my = 0;
    if (Math.abs(mx) > 400 || Math.abs(my) > 400) return;
    mx = THREE.MathUtils.clamp(mx, -LOOK_MAX_STEP, LOOK_MAX_STEP);
    my = THREE.MathUtils.clamp(my, -LOOK_MAX_STEP, LOOK_MAX_STEP);
    lookAccumX += mx;
    lookAccumY += my;
  });

  // Scroll wheel zoom — clamp trackpad mega-deltas so zoom doesn't explode
  window.addEventListener(
    "wheel",
    (e) => {
      if (!started || paused) return;
      e.preventDefault();
      let dy = e.deltaY;
      if (!isFinite(dy)) return;
      // Normalize line/page modes roughly to pixels
      if (e.deltaMode === 1) dy *= 16;
      if (e.deltaMode === 2) dy *= 40;
      dy = THREE.MathUtils.clamp(dy, -120, 120);
      const steps = Math.max(1, Math.min(4, Math.round(Math.abs(dy) / 40)));
      const factor = dy > 0 ? 1.08 : 1 / 1.08;
      let z = camZoomTarget;
      for (let i = 0; i < steps; i++) z *= factor;
      setCamZoom(z);
    },
    { passive: false }
  );

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function damp(current, target, lambda, dt) {
    return THREE.MathUtils.damp(current, target, lambda, dt);
  }
  /** Shortest-path angle damp (fixes spin glitches when crossing ±PI) */
  function dampAngle(current, target, lambda, dt) {
    let diff = target - current;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return current + diff * (1 - Math.exp(-lambda * dt));
  }

  // Juice state (meshes created after player exists)
  const juice = {
    shake: 0,
    fovPunch: 0,
    baseFov: 58,
    ringPulse: 0,
    confettiT: 0,
  };

  function punchCam(shakeAmt, fovAmt) {
    juice.shake = Math.max(juice.shake, shakeAmt || 0.15);
    juice.fovPunch = Math.max(juice.fovPunch, fovAmt || 4);
  }

  function flashHudMeter(el) {
    if (!el) return;
    el.classList.remove("juice-flash");
    void el.offsetWidth;
    el.classList.add("juice-flash");
    setTimeout(function () {
      el.classList.remove("juice-flash");
    }, 600);
  }

  // ---------------------------------------------------------------------------
  // Renderer / scene — selectable graphics tiers (Low → Very High / MAX)
  // ---------------------------------------------------------------------------
  const GFX_STORAGE_KEY = "bolt_gfx_tier_v1";
  const GFX_TIERS = {
    low: {
      id: "low",
      label: "LOW",
      hint: "Low — best performance · lighter world",
      brand: "v2.4 · LOW",
      pixelRatio: 1,
      antialias: false,
      bloom: false,
      bloomStrength: 0.35,
      bloomDiv: 3,
      shadows: false,
      shadowMap: 512,
      groundSegs: 22,
      view: 1,
      dressMul: 0.4,
      hemi: 0.48,
      particles: false,
      particleOp: 0.35,
      particleSize: 1.0,
      exposure: 1.02,
    },
    medium: {
      id: "medium",
      label: "MED",
      hint: "Medium — balanced quality & performance",
      brand: "v2.4 · MED",
      pixelRatio: Math.min(window.devicePixelRatio || 1, 1.25),
      antialias: true,
      bloom: true,
      bloomStrength: 0.42,
      bloomDiv: 3,
      shadows: true,
      shadowMap: 1024,
      groundSegs: 32,
      view: 2,
      dressMul: 0.7,
      hemi: 0.5,
      particles: true,
      particleOp: 0.55,
      particleSize: 1.2,
      exposure: 1.05,
    },
    high: {
      id: "high",
      label: "HIGH",
      hint: "High — full detail · recommended",
      brand: "v2.4 · HIGH",
      pixelRatio: Math.min(window.devicePixelRatio || 1, 1.75),
      antialias: true,
      bloom: true,
      bloomStrength: 0.52,
      bloomDiv: 2,
      shadows: true,
      shadowMap: 1536,
      groundSegs: 40,
      view: 3,
      dressMul: 1.0,
      hemi: 0.52,
      particles: true,
      particleOp: 0.72,
      particleSize: 1.4,
      exposure: 1.08,
    },
    veryHigh: {
      id: "veryHigh",
      label: "MAX",
      hint: "MAX — highest fidelity · strong GPU recommended",
      brand: "v2.4 · MAX",
      pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      antialias: true,
      bloom: true,
      bloomStrength: 0.58,
      bloomDiv: 2,
      shadows: true,
      shadowMap: 2048,
      groundSegs: 44,
      view: 3,
      dressMul: 1.15,
      hemi: 0.52,
      particles: true,
      particleOp: 0.82,
      particleSize: 1.55,
      exposure: 1.08,
    },
  };

  function loadGfxTierId() {
    try {
      const t = localStorage.getItem(GFX_STORAGE_KEY);
      if (t && GFX_TIERS[t]) return t;
    } catch (e) { /* ignore */ }
    return "high";
  }

  let gfxTierId = loadGfxTierId();
  let GraphicsQuality = Object.assign({}, GFX_TIERS[gfxTierId]);

  function setGraphicsTier(tierId, opts) {
    opts = opts || {};
    if (!GFX_TIERS[tierId]) tierId = "high";
    gfxTierId = tierId;
    GraphicsQuality = Object.assign({}, GFX_TIERS[tierId]);
    try {
      localStorage.setItem(GFX_STORAGE_KEY, tierId);
    } catch (e) { /* ignore */ }
    applyGraphicsQuality({ rebuild: !!opts.rebuild });
    syncGfxTierUI();
    // Brand chips
    const brandChip = document.querySelector(".boot-chip-dim");
    if (brandChip) brandChip.textContent = GraphicsQuality.brand;
    const brandHud = document.querySelector(".brand span");
    if (brandHud) brandHud.textContent = GraphicsQuality.brand;
    if (opts.toast && typeof toast === "function") {
      toast("GRAPHICS · " + GraphicsQuality.label + " — " + GraphicsQuality.hint.replace(/^[^—]+—\s*/, ""), 2200);
    }
  }

  function syncGfxTierUI() {
    const rows = [
      document.getElementById("boot-gfx-tier"),
      document.getElementById("pause-gfx-tier"),
    ];
    rows.forEach(function (row) {
      if (!row) return;
      row.querySelectorAll(".gfx-tier-btn").forEach(function (btn) {
        btn.classList.toggle("is-active", btn.getAttribute("data-tier") === gfxTierId);
      });
    });
    const hints = [
      document.getElementById("boot-gfx-hint"),
      document.getElementById("pause-gfx-hint"),
    ];
    hints.forEach(function (el) {
      if (el) el.textContent = GraphicsQuality.hint;
    });
  }

  function wireGfxTierRow(rowId) {
    const row = document.getElementById(rowId);
    if (!row) return;
    row.addEventListener("click", function (e) {
      const btn = e.target && e.target.closest ? e.target.closest(".gfx-tier-btn") : null;
      if (!btn) return;
      const tier = btn.getAttribute("data-tier");
      if (!tier || tier === gfxTierId) return;
      setGraphicsTier(tier, {
        rebuild: started, // rebuild terrain density when already in world
        toast: started,
      });
    });
  }

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !!GraphicsQuality.antialias,
    powerPreference: "high-performance",
    // stencil off = less bandwidth; depth is enough for this game
    stencil: false,
  });
  renderer.setPixelRatio(GraphicsQuality.pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = GraphicsQuality.exposure != null ? GraphicsQuality.exposure : 1.08;
  renderer.shadowMap.enabled = !!GraphicsQuality.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // Auto-sort is fine; local clipping unused
  renderer.localClippingEnabled = false;
  // Only recompute shadows when something that casts moves (Bolt + few casters)
  renderer.shadowMap.autoUpdate = true;

  /** Apply current graphics tier to renderer / world / FX */
  function applyGraphicsQuality(opts) {
    opts = opts || {};
    const q = GraphicsQuality;
    renderer.setPixelRatio(q.pixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMappingExposure = q.exposure != null ? q.exposure : 1.08;
    renderer.shadowMap.enabled = !!q.shadows;
    if (sun && sun.shadow && sun.shadow.mapSize) {
      sun.shadow.mapSize.set(q.shadowMap || 1024, q.shadowMap || 1024);
      sun.castShadow = !!q.shadows;
      if (sun.shadow.map) {
        sun.shadow.map.dispose();
        sun.shadow.map = null;
      }
    }
    if (bloom) {
      if (bloom.setEnabled) bloom.setEnabled(!!q.bloom);
      if (bloom.setQuality) {
        bloom.setQuality({
          bloom: !!q.bloom,
          bloomDiv: q.bloomDiv,
          bloomStrength: q.bloomStrength,
        });
      }
      if (bloom.setStrength && q.bloomStrength != null) bloom.setStrength(q.bloomStrength);
      if (bloom.resize) bloom.resize(window.innerWidth, window.innerHeight);
    }
    if (openWorld && openWorld.setQuality) {
      openWorld.setQuality({
        view: q.view,
        groundSegs: q.groundSegs,
        dressMul: q.dressMul,
        rebuild: !!opts.rebuild,
      });
      if (opts.rebuild && player && openWorld.ensureAround) {
        openWorld.ensureAround(player.position.x, player.position.z, {
          vx: state && state.vel ? state.vel.x : 0,
          vz: state && state.vel ? state.vel.z : 0,
          lookYaw: typeof yaw === "number" ? yaw : 0,
        });
      } else if (opts.rebuild && openWorld.ensureAround) {
        openWorld.ensureAround(0, 0);
      }
    }
    if (lights && lights.hemi) lights.hemi.intensity = q.hemi;
    if (softParticles && softParticles.points) {
      softParticles.points.visible = q.particles !== false;
    }
    if (softParticles && softParticles.material) {
      softParticles.material.opacity = q.particleOp != null ? q.particleOp : 0.7;
      softParticles.material.size = q.particleSize != null ? q.particleSize : 1.4;
    }
    // Reactive sky still runs at all tiers (cheap vs particles/shadows); hide nebula soft sheets on Low
    if (reactiveSky && reactiveSky.group) {
      reactiveSky.group.traverse(function (o) {
        if (o.name === "SkyNebulae") o.visible = q.id !== "low";
        if (o.name === "SkyComets") o.visible = q.id !== "low";
      });
    }
    if (camera) {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    }
  }

  // Wire UI early (DOM already parsed — script at end of body)
  wireGfxTierRow("boot-gfx-tier");
  wireGfxTierRow("pause-gfx-tier");
  syncGfxTierUI();
  // Sync brand chips to saved tier on load
  (function syncBrandOnLoad() {
    const brandChip = document.querySelector(".boot-chip-dim");
    if (brandChip) brandChip.textContent = GraphicsQuality.brand;
    const brandHud = document.querySelector(".brand span");
    if (brandHud) brandHud.textContent = GraphicsQuality.brand;
  })();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x061428);
  scene.fog = new THREE.FogExp2(0x0a2848, 0.0032);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2500);
  const clock = new THREE.Clock();

  // Graphics polish: reactive sky (sprint/scale/biome) + haze, planets, bloom
  const reactiveSky = window.BoltGraphics.createReactiveSky
    ? window.BoltGraphics.createReactiveSky(scene)
    : null;
  const skyDome = reactiveSky
    ? reactiveSky.dome
    : window.BoltGraphics.createSkyDome(scene);
  const horizonHaze = window.BoltGraphics.createHorizonHaze
    ? window.BoltGraphics.createHorizonHaze(scene)
    : null;
  // Real spherical home world — high-detail sphere once flat ground fades
  const homePlanet = window.BoltGraphics.createHomePlanet
    ? window.BoltGraphics.createHomePlanet(scene, { radius: 980 })
    : null;
  // Other planets as beacons (Orbital faint → Solar/Cosmic clear)
  const distantPlanets = window.BoltGraphics.createDistantPlanets
    ? window.BoltGraphics.createDistantPlanets(scene)
    : null;
  const bloom = window.BoltGraphics.createSoftBloom(renderer, scene, camera);
  if (bloom.applyDomPolish) bloom.applyDomPolish(canvas);
  // Ambient dust / motes
  const softParticles = window.BoltGraphics.createParticleField(scene, 780);

  // Biome atmosphere — sky/fog/lights shift as you enter new regions
  const biomeAtmo = new window.BoltProcedural.BiomeAtmosphere();

  window.addEventListener("resize", () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(GraphicsQuality.pixelRatio);
    renderer.setSize(w, h);
    if (bloom && bloom.resize) bloom.resize(w, h);
  });

  // ---------------------------------------------------------------------------
  // Lighting & sky
  // ---------------------------------------------------------------------------
  // Rich lighting rig (hemisphere + sun + fill + rim)
  const lights = window.BoltGraphics.createLighting(scene);
  const ambient = lights.hemi || lights.ambient;
  const sun = lights.sun;
  const rim = lights.rim;
  renderer.toneMappingExposure = 1.02;

  const coreLight = new THREE.PointLight(0xfbbf24, 3.5, 90);
  coreLight.position.set(0, 14, 0);
  scene.add(coreLight);

  // Cosmic starfield — owned by reactive sky when present (avoid double field)
  let starField = null;
  let starFieldMat = null;
  let cosmicStars = null;
  if (reactiveSky && reactiveSky.stars) {
    cosmicStars = reactiveSky.stars;
    starField = cosmicStars.group || cosmicStars;
    starFieldMat = cosmicStars.material;
  } else if (window.BoltGraphics.createCosmicStarfield) {
    cosmicStars = window.BoltGraphics.createCosmicStarfield(scene);
    starField = cosmicStars.group || cosmicStars;
    starFieldMat = cosmicStars.material;
  } else {
    const count = 2200;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 220 + Math.random() * 900;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.65 + 30;
      pos[i * 3 + 2] = r * Math.cos(phi);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    starFieldMat = new THREE.PointsMaterial({
      color: 0xd0e4ff,
      size: 0.95,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });
    starField = new THREE.Points(geo, starFieldMat);
    starField.name = "StarField";
    scene.add(starField);
  }
  const baseBgColor = new THREE.Color(0x061428);
  const orbitalBgColor = new THREE.Color(0x010208);
  const baseFogColor = new THREE.Color(0x0a2848);
  const orbitalFogColor = new THREE.Color(0x02040c);
  const nebulae = [];

  // ---------------------------------------------------------------------------
  // World
  // ---------------------------------------------------------------------------
  const colliders = [];

  function addCollider(x, z, half, y, type) {
    colliders.push({
      minx: x - half,
      maxx: x + half,
      minz: z - half,
      maxz: z + half,
      y: y,
      type: type || "ground",
    });
  }

  // Infinite open world — chunked streaming terrain (no island walls)
  const openWorld = new window.BoltOpenWorld.OpenWorld(scene);
  // Apply selected tier (terrain density / view)
  try {
    applyGraphicsQuality();
  } catch (qErr) {
    console.warn("graphics quality", qErr);
  }
  openWorld.ensureAround(0, 18);
  // Soft landing pads near spawn (not world limits)
  addCollider(0, 0, 16, openWorld.heightAt(0, 0) + 1, "citadel");

  const platMat = new THREE.MeshStandardMaterial({
    color: 0x243b6b,
    roughness: 0.55,
    metalness: 0.35,
    emissive: 0x112244,
    emissiveIntensity: 0.4,
  });
  const platforms = [];

  function spawnPlatform(x, y, z, size) {
    size = size || 6;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, 1.2, size), platMat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(size + 0.2, 0.15, size + 0.2),
      new THREE.MeshBasicMaterial({ color: 0x3df0ff, transparent: true, opacity: 0.55 })
    );
    edge.position.set(x, y + 0.55, z);
    scene.add(edge);
    addCollider(x, z, size * 0.48, y + 0.6, "platform");
    platforms.push({ mesh: mesh, edge: edge, x: x, y: y, z: z });
  }

  // Sparse starter platforms near Home Citadel (open world continues forever beyond)
  [
    [25, 3, 22, 8], [-28, 4, 30, 7], [40, 5, -20, 9], [-35, 3.5, -28, 8],
    [0, 8, 45, 10], [55, 6, 40, 7], [-50, 5, 15, 8],
  ].forEach(function (p) {
    const h = openWorld.heightAt(p[0], p[2]);
    spawnPlatform(p[0], h + p[1], p[2], p[3]);
  });

  const boostPads = [];
  function spawnBoost(x, y, z) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x06b6d4,
      emissiveIntensity: 1.2,
      metalness: 0.6,
      roughness: 0.2,
    });
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.25, 24), mat);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.6, 0.08, 8, 40),
      new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.8 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, y + 0.2, z);
    scene.add(ring);
    boostPads.push({ mesh: mesh, ring: ring, x: x, y: y, z: z, cool: 0 });
  }
  [[18, 0, 12], [-22, 0, -10], [0, 8, 45]].forEach(function (b) {
    const h = openWorld.heightAt(b[0], b[2]);
    spawnBoost(b[0], h + 0.2 + b[1], b[2]);
  });

  // Thunderwolf Citadel — living home fortress (Star Core lives in the chamber)
  const citadel = window.BoltCitadel.createCitadel(scene, {
    heightAt: function (x, z) {
      return openWorld.heightAt(x, z);
    },
    coreStageIndex: 0,
    resonance: 0,
    decrees: 0,
  });
  // Register walkable floors
  if (citadel.colliders) {
    citadel.colliders.forEach(function (c) {
      addCollider(c.x, c.z, c.half, c.y, "citadel");
    });
  }
  // Aliases so existing Core stage / light code still works
  const starCoreGroup = citadel.coreRoot || new THREE.Group();
  const coreSphere = citadel.coreMain;
  const coreShell = citadel.coreShell;
  const coreAura = citadel.coreAura;
  // Move world core light into citadel intensity control
  if (citadel.coreLight) {
    coreLight.intensity = 0.4; // soft fill; chamber light is primary
    coreLight.position.set(0, citadel.getBaseY() + 14, -2);
  }

  // Procedural world content (paths, ruins, flora, details) lives in BoltProcedural

  const sparks = [];
  const sparkGeo = new THREE.OctahedronGeometry(0.55, 0);
  const sparkMat = new THREE.MeshStandardMaterial({
    color: 0x3df0ff,
    emissive: 0x22d3ee,
    emissiveIntensity: 2,
    metalness: 0.5,
    roughness: 0.1,
  });

  function spawnSpark(x, y, z) {
    const mesh = new THREE.Mesh(sparkGeo, sparkMat.clone());
    mesh.position.set(x, y, z);
    scene.add(mesh);
    sparks.push({ mesh: mesh, x: x, y: y, z: z, taken: false, phase: Math.random() * Math.PI * 2 });
  }

  function scatterSparks() {
    for (let i = 0; i < 48; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 8 + Math.random() * 85;
      spawnSpark(Math.cos(a) * r, 1.2 + Math.random() * 2, Math.sin(a) * r);
    }
    for (let i = 0; i < platforms.length; i++) {
      const p = platforms[i];
      spawnSpark(p.x + (Math.random() - 0.5) * 3, p.y + 2.2, p.z + (Math.random() - 0.5) * 3);
    }
  }
  scatterSparks();

  // ---------------------------------------------------------------------------
  // Player (Bolt)
  // ---------------------------------------------------------------------------
  const player = new THREE.Group();
  // Spawn at Citadel gates (south entrance) — face the fortress
  {
    const ent = citadel.getEntrance();
    player.position.set(ent.x, ent.y, ent.z);
    yaw = Math.PI; // look into Citadel (-Z)
  }

  /**
   * StarBoltSprint — pure white German Shepherd matching key art
   * (cyan lightning eyes/aura, no wings, Z-forward for yaw).
   */
  /**
   * StarBoltSprint mesh — GSD silhouette, cool white + slate saddle, cyan energy accents.
   * Polish tiers 1–7: silhouette, materials, structure, anim hooks, lights, sprint FX, rim.
   */
  function makeBoltMesh() {
    const g = new THREE.Group();
    g.name = "StarBoltSprint";
    g.scale.setScalar(1.95);

    const Gfx = window.BoltGraphics;
    const softMap =
      Gfx && Gfx.getSoftSpriteTexture ? Gfx.getSoftSpriteTexture() : null;
    const kit =
      Gfx && Gfx.makeBoltMaterials
        ? Gfx.makeBoltMaterials()
        : null;

    const fur = kit
      ? kit.fur
      : new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, emissive: 0xa0b0c8, emissiveIntensity: 0.04 });
    const furBright = kit ? kit.furBright : fur;
    const furShade = kit ? kit.furShade : fur;
    const furSaddle = kit ? kit.furSaddle : furShade;
    const energy = kit
      ? kit.energy
      : new THREE.MeshStandardMaterial({ color: 0x7dd3fc, emissive: 0x22d3ee, emissiveIntensity: 1.2 });
    const energyHot = kit ? kit.energyHot : energy;
    const energyPurple = kit
      ? kit.energyPurple
      : new THREE.MeshStandardMaterial({
          color: 0xd8b4fe,
          emissive: 0xa855f7,
          emissiveIntensity: 1.4,
        });
    const energySoft = kit
      ? kit.energySoft
      : new THREE.MeshBasicMaterial({
          color: 0x67e8f9,
          transparent: true,
          opacity: 0.12,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
        });
    const energySoftPurple = kit
      ? kit.energySoftPurple
      : new THREE.MeshBasicMaterial({
          color: 0xc084fc,
          transparent: true,
          opacity: 0.1,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
        });
    const energyVein = kit
      ? kit.energyVein
      : new THREE.MeshBasicMaterial({
          color: 0xa5f3fc,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
    const iris = kit ? kit.iris : energy;
    const pupil = kit
      ? kit.pupil
      : new THREE.MeshStandardMaterial({ color: 0x050a12, roughness: 0.5 });
    const noseMat = kit
      ? kit.noseMat
      : new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 });
    const padMat = kit
      ? kit.padMat
      : new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });
    const pinkEar = kit
      ? kit.pinkEar
      : new THREE.MeshStandardMaterial({ color: 0xffb6c8, roughness: 0.85 });

    // ---- BODY: lean athletic GSD ----
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 1.22, 12, 20), fur);
    torso.rotation.x = Math.PI / 2;
    torso.position.set(0, 1.08, 0.02);
    torso.scale.set(0.88, 1, 1.05);
    torso.castShadow = true; // main body casts; small parts skip for free GPU win
    g.add(torso);

    // Soft white volume on back (pure white GSD — no dark saddle patch)
    const saddle = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.95, 10, 16), fur);
    saddle.rotation.x = Math.PI / 2;
    saddle.position.set(0, 1.28, -0.04);
    saddle.scale.set(0.78, 1.05, 0.52);
    saddle.castShadow = true;
    g.add(saddle);
    const saddleHip = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 16), fur);
    saddleHip.position.set(0, 1.18, -0.48);
    saddleHip.scale.set(1.05, 0.75, 1.0);
    g.add(saddleHip);

    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 20), furBright);
    chest.position.set(0, 1.05, 0.55);
    chest.scale.set(1.05, 1.12, 1.18);
    chest.castShadow = true;
    g.add(chest);

    // Layered neck ruff (volume without blob)
    for (let i = 0; i < 4; i++) {
      const ruff = new THREE.Mesh(
        new THREE.SphereGeometry(0.42 - i * 0.05, 14, 14),
        i % 2 === 0 ? furBright : fur
      );
      ruff.position.set(0, 1.14 + i * 0.05, 0.58 + i * 0.08);
      ruff.scale.set(1.25 - i * 0.08, 0.72 + i * 0.04, 0.88);
      ruff.castShadow = i < 2;
      g.add(ruff);
    }

    const neck = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 14), furBright);
    neck.position.set(0, 1.36, 0.9);
    neck.scale.set(1.1, 0.95, 1.05);
    g.add(neck);

    const hip = new THREE.Mesh(new THREE.SphereGeometry(0.4, 18, 18), fur);
    hip.position.set(0, 1.0, -0.55);
    hip.scale.set(1.05, 0.95, 1.1);
    hip.castShadow = true;
    g.add(hip);

    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 14), furBright);
    belly.position.set(0, 0.78, 0.08);
    belly.scale.set(0.85, 0.62, 1.45);
    g.add(belly);

    // Soft fur shell (very light fluff — high opacity caused a “bubble” read)
    const shell = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.42, 1.05, 8, 12),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.9,
        metalness: 0,
        transparent: true,
        opacity: 0.06,
        depthWrite: false,
      })
    );
    shell.rotation.x = Math.PI / 2;
    shell.position.set(0, 1.12, 0.05);
    shell.scale.set(0.95, 1, 1.1);
    g.add(shell);

    // Body energy aura shell — cyan/purple, opacity driven by sprint score
    const energyShell = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.48, 1.15, 10, 16),
      energySoft.clone()
    );
    energyShell.material.opacity = 0;
    energyShell.rotation.x = Math.PI / 2;
    energyShell.position.set(0, 1.12, 0.02);
    energyShell.scale.set(1.02, 1.05, 1.12);
    energyShell.renderOrder = 2;
    g.add(energyShell);
    g.userData.energyShell = energyShell;

    // Spine energy vein (shoulder → hip → tail) — lightning path on white fur
    const veinMats = [];
    const spineVein = new THREE.Group();
    spineVein.position.set(0, 1.32, 0.35);
    const veinPts = [
      [0, 0, 0.35],
      [0, 0.02, 0.05],
      [0, 0.0, -0.35],
      [0, -0.05, -0.7],
      [0, -0.12, -1.0],
    ];
    for (let i = 0; i < veinPts.length - 1; i++) {
      const a = veinPts[i];
      const b = veinPts[i + 1];
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) || 0.2;
      const vm = energyVein.clone();
      veinMats.push(vm);
      const seg = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.035 + i * 0.008, len * 0.85, 4, 8),
        vm
      );
      seg.position.set(mid[0], mid[1], mid[2]);
      // aim along local Z of spine
      seg.rotation.x = Math.PI / 2 + Math.atan2(b[1] - a[1], b[2] - a[2]);
      spineVein.add(seg);
    }
    g.add(spineVein);
    g.userData.spineVein = spineVein;
    g.userData.veinMats = veinMats;

    // Shoulder energy blazes
    function makeShoulderBlaze(side) {
      const blaze = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 10, 10),
        energySoftPurple.clone()
      );
      blaze.material.opacity = 0;
      blaze.position.set(side * 0.32, 1.22, 0.35);
      blaze.scale.set(1.1, 0.7, 1.3);
      g.add(blaze);
      return blaze;
    }
    g.userData.shoulderBlaze = [makeShoulderBlaze(1), makeShoulderBlaze(-1)];

    // ---- HEAD: sharp GSD wedge + mask ----
    const head = new THREE.Group();
    head.position.set(0, 1.58, 1.12);
    g.add(head);
    g.userData.head = head;

    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 20), furBright);
    skull.scale.set(0.95, 0.92, 1.22);
    skull.castShadow = true;
    head.add(skull);

    // White face volume (no dark mask — pure white shepherd)
    const mask = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 16), furBright);
    mask.position.set(0, 0.04, 0.06);
    mask.scale.set(0.88, 0.75, 0.95);
    head.add(mask);

    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 14), furBright);
    crown.position.set(0, 0.18, -0.08);
    crown.scale.set(1.1, 0.65, 0.9);
    head.add(crown);

    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.07, 0.2), fur);
    brow.position.set(0, 0.14, 0.24);
    brow.rotation.x = 0.2;
    head.add(brow);

    const cheekL = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), furBright);
    cheekL.position.set(0.19, -0.04, 0.12);
    cheekL.scale.set(0.9, 0.85, 1.1);
    head.add(cheekL);
    const cheekR = cheekL.clone();
    cheekR.position.x = -0.19;
    head.add(cheekR);

    const snout = new THREE.Mesh(new THREE.CapsuleGeometry(0.115, 0.52, 10, 14), furBright);
    snout.rotation.x = Math.PI / 2;
    snout.position.set(0, -0.02, 0.5);
    snout.scale.set(0.95, 1, 0.85);
    head.add(snout);
    const snoutBridge = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 0.4), fur);
    snoutBridge.position.set(0, 0.07, 0.44);
    head.add(snoutBridge);

    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 14), noseMat);
    nose.position.set(0, 0.0, 0.76);
    nose.scale.set(1.25, 0.85, 0.95);
    head.add(nose);

    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.028, 0.07), furShade);
    mouth.position.set(0, -0.1, 0.65);
    head.add(mouth);

    // Jaw hint
    const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), furBright);
    jaw.position.set(0, -0.12, 0.35);
    jaw.scale.set(0.95, 0.55, 1.1);
    head.add(jaw);

    function makeEar(side) {
      const eg = new THREE.Group();
      const outer = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.78, 7), furBright);
      outer.position.set(side * 0.18, 0.62, -0.02);
      outer.rotation.z = side * 0.1;
      outer.rotation.x = -0.08;
      outer.scale.set(0.72, 1, 0.42);
      outer.castShadow = true;
      eg.add(outer);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.22, 6), furBright);
      tip.position.set(side * 0.18, 0.95, -0.04);
      tip.rotation.copy(outer.rotation);
      tip.scale.copy(outer.scale);
      eg.add(tip);
      const inner = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.48, 6), pinkEar);
      inner.position.set(side * 0.18, 0.55, 0.045);
      inner.rotation.copy(outer.rotation);
      inner.scale.set(0.65, 1, 0.38);
      eg.add(inner);
      const base = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 10), fur);
      base.position.set(side * 0.16, 0.28, 0.0);
      base.scale.set(1.05, 0.65, 0.85);
      eg.add(base);
      return eg;
    }
    const earL = makeEar(1);
    const earR = makeEar(-1);
    head.add(earL);
    head.add(earR);
    g.userData.ears = [earL, earR];

    function makeEye(side) {
      const eg = new THREE.Group();
      const socket = new THREE.Mesh(new THREE.SphereGeometry(0.078, 12, 12), fur);
      socket.scale.set(1.0, 0.95, 0.75);
      eg.add(socket);
      const ir = new THREE.Mesh(new THREE.SphereGeometry(0.052, 16, 16), iris);
      ir.position.set(0, 0.01, 0.045);
      eg.add(ir);
      const pup = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 12), pupil);
      pup.position.set(0, 0.012, 0.075);
      eg.add(pup);
      const glint = new THREE.Mesh(
        new THREE.SphereGeometry(0.011, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      glint.position.set(side * 0.014, 0.026, 0.085);
      eg.add(glint);
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), energySoft.clone());
      glow.material.opacity = 0.1;
      eg.add(glow);
      eg.position.set(side * 0.145, 0.1, 0.3);
      eg.userData.iris = ir;
      eg.userData.glow = glow;
      return eg;
    }
    const eyeL = makeEye(1);
    const eyeR = makeEye(-1);
    head.add(eyeL);
    head.add(eyeR);
    g.userData.eyes = [eyeL, eyeR];

    // ---- LEGS: longer, thigh/shin/ankle/paw ----
    const legData = [
      { x: 0.26, z: 0.45, front: true },
      { x: -0.26, z: 0.45, front: true },
      { x: 0.24, z: -0.48, front: false },
      { x: -0.24, z: -0.48, front: false },
    ];
    const legs = [];
    const pawGlows = [];
    legData.forEach(function (L) {
      const leg = new THREE.Group();
      const thigh = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.09, L.front ? 0.42 : 0.46, 8, 12),
        fur
      );
      thigh.position.y = 0.62;
      thigh.castShadow = true;
      leg.add(thigh);
      const shin = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.065, 0.4, 8, 12),
        furBright
      );
      shin.position.y = 0.24;
      leg.add(shin);
      const ankle = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 10), furShade);
      ankle.position.y = 0.08;
      leg.add(ankle);
      const paw = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), padMat);
      paw.position.set(0, 0.03, 0.04);
      paw.scale.set(1.25, 0.48, 1.5);
      leg.add(paw);
      // toe pads
      for (let t = 0; t < 3; t++) {
        const toe = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), padMat);
        toe.position.set((t - 1) * 0.05, 0.02, 0.1);
        toe.scale.set(1, 0.5, 1.1);
        leg.add(toe);
      }
      const pawGlow = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), energySoft.clone());
      pawGlow.material.opacity = 0.05;
      pawGlow.position.set(0, 0.04, 0.04);
      leg.add(pawGlow);
      pawGlows.push(pawGlow);
      leg.position.set(L.x, 0, L.z);
      leg.userData.front = L.front;
      g.add(leg);
      legs.push(leg);
    });
    g.userData.legs = legs;
    g.userData.pawGlows = pawGlows;

    // ---- TAIL: smooth uniform plume (no ring/bead fluff spheres) ----
    const tail = new THREE.Group();
    tail.position.set(0, 1.28, -0.82);
    const tSegs = [];
    let tParent = tail;
    // Long overlapping tapered capsules — continuous fur volume
    const segs = [
      { len: 0.4, r: 0.115 },
      { len: 0.36, r: 0.095 },
      { len: 0.32, r: 0.075 },
      { len: 0.26, r: 0.055 },
    ];
    segs.forEach(function (s, i) {
      const seg = new THREE.Group();
      // Slight vertical squash for a soft plume silhouette (not sausage rings)
      const mesh = new THREE.Mesh(
        new THREE.CapsuleGeometry(s.r, s.len, 8, 14),
        furBright
      );
      mesh.position.y = s.len * 0.5;
      mesh.scale.set(1.05, 1, 1.15);
      mesh.castShadow = true;
      seg.add(mesh);
      // Single soft tip only at the end — not per-segment balls
      if (i === segs.length - 1) {
        const tip = new THREE.Mesh(
          new THREE.SphereGeometry(s.r * 1.05, 12, 12),
          furBright
        );
        tip.position.y = s.len * 0.92;
        tip.scale.set(1.15, 0.95, 1.15);
        seg.add(tip);
      }
      if (i === 0) {
        seg.rotation.x = -1.08;
      } else {
        // Heavy overlap hides joints
        seg.position.y = segs[i - 1].len * 0.78;
        seg.rotation.x = -0.1;
      }
      tParent.add(seg);
      tParent = seg;
      tSegs.push(seg);
    });
    g.add(tail);
    g.userData.tail = tail;
    g.userData.tailSegs = tSegs;

    // Lightning core on chest — cyan heart of the hound
    const core = new THREE.Group();
    core.position.set(0, 1.12, 0.68);
    const coreGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), energyHot);
    core.add(coreGem);
    const coreRing = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.02, 6, 24), energy);
    coreRing.rotation.x = Math.PI / 2;
    core.add(coreRing);
    const coreRing2 = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.012, 6, 24), energyPurple);
    coreRing2.rotation.x = Math.PI / 2;
    coreRing2.rotation.z = 0.4;
    core.add(coreRing2);
    const coreGlow = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 12), energySoft.clone());
    coreGlow.material.opacity = 0.2;
    core.add(coreGlow);
    g.add(core);
    g.userData.core = core;

    // Energy collar — dual cyan/purple
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.03, 8, 40), energy);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, 1.28, 0.58);
    g.add(collar);
    g.userData.collar = collar;
    const collarOuter = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.016, 6, 36), energyPurple);
    collarOuter.rotation.x = Math.PI / 2;
    collarOuter.position.set(0, 1.28, 0.58);
    g.add(collarOuter);
    g.userData.collarOuter = collarOuter;

    g.userData.auraBody = null;
    // Store fur mats so sprint can drive emissive energy-in-fur
    g.userData.furMats = [fur, furBright, furShade, furSaddle].filter(Boolean);
    g.userData.energyMats = [energy, energyHot, energyPurple];

    // Orbiting lightning motes (cyan + purple mix)
    const auraCount = 48;
    const auraPos = new Float32Array(auraCount * 3);
    for (let i = 0; i < auraCount; i++) {
      const a = (i / auraCount) * Math.PI * 2;
      const r = 0.5 + Math.random() * 0.55;
      auraPos[i * 3] = Math.cos(a) * r * 0.95;
      auraPos[i * 3 + 1] = 0.45 + Math.random() * 1.25;
      auraPos[i * 3 + 2] = Math.sin(a) * r * 0.8;
    }
    const auraGeo = new THREE.BufferGeometry();
    auraGeo.setAttribute("position", new THREE.BufferAttribute(auraPos, 3));
    const auraPts = new THREE.Points(
      auraGeo,
      new THREE.PointsMaterial({
        map: softMap,
        color: 0x67e8f9,
        size: 0.16,
        transparent: true,
        opacity: 0.1,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      })
    );
    g.add(auraPts);
    g.userData.auraPts = auraPts;
    g.userData.auraBase = auraPos.slice(0);
    // Second purple mote cloud
    const auraPos2 = new Float32Array(auraCount * 3);
    for (let i = 0; i < auraCount; i++) {
      const a = (i / auraCount) * Math.PI * 2 + 0.4;
      const r = 0.6 + Math.random() * 0.5;
      auraPos2[i * 3] = Math.cos(a) * r * 0.85;
      auraPos2[i * 3 + 1] = 0.4 + Math.random() * 1.2;
      auraPos2[i * 3 + 2] = Math.sin(a) * r * 0.7;
    }
    const auraGeo2 = new THREE.BufferGeometry();
    auraGeo2.setAttribute("position", new THREE.BufferAttribute(auraPos2, 3));
    const auraPts2 = new THREE.Points(
      auraGeo2,
      new THREE.PointsMaterial({
        map: softMap,
        color: 0xc084fc,
        size: 0.14,
        transparent: true,
        opacity: 0.06,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      })
    );
    g.add(auraPts2);
    g.userData.auraPtsPurple = auraPts2;
    g.userData.auraBasePurple = auraPos2.slice(0);
    g.userData.wings = null;

    // Contact shadow
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1.0, 32),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
      })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.012;
    g.add(shadow);
    g.userData.shadow = shadow;

    const underGlow = new THREE.Mesh(
      new THREE.CircleGeometry(0.95, 32),
      new THREE.MeshBasicMaterial({
        color: 0x67e8f9,
        transparent: true,
        opacity: 0.04,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      })
    );
    underGlow.rotation.x = -Math.PI / 2;
    underGlow.position.y = 0.028;
    g.add(underGlow);
    g.userData.underGlow = underGlow;

    // No full-body rim sphere (caused a cyan "bubble" against the sky).
    // Separation comes from rim/key lights only.
    g.userData.rim = null;

    return g;
  }

  const boltMesh = makeBoltMesh();
  player.add(boltMesh);
  scene.add(player);

  // Hero lights: cyan core + purple resonance + soft white key for white fur
  const boltLight = new THREE.PointLight(0x22d3ee, 0.65, 14);
  boltLight.position.set(0, 1.45, 0.7);
  boltMesh.add(boltLight);
  const boltLight2 = new THREE.PointLight(0x67e8f9, 0.32, 10);
  boltLight2.position.set(0, 1.55, -0.35);
  boltMesh.add(boltLight2);
  // Purple resonance fill — off at rest so white fur stays pure white
  const boltLightPurple = new THREE.PointLight(0xa855f7, 0.0, 11);
  boltLightPurple.position.set(-0.35, 1.5, 0.2);
  boltMesh.add(boltLightPurple);
  // Warm key from above-front so white fur form reads
  const boltKey = new THREE.PointLight(0xfff8f0, 0.55, 12);
  boltKey.position.set(0.4, 2.1, 0.9);
  boltMesh.add(boltKey);

  // Lightning Core particle trail — ribbon + sparks + arcs + echoes
  // "The thunder that follows the lightning hound."
  const softSprite =
    (window.BoltGraphics && window.BoltGraphics.getSoftSpriteTexture &&
      window.BoltGraphics.getSoftSpriteTexture()) ||
    null;
  const lightningTrail =
    window.BoltTrail && window.BoltTrail.LightningTrail
      ? new window.BoltTrail.LightningTrail(scene, {
          heightAt: function (x, z) {
            return openWorld ? openWorld.heightAt(x, z) : 0;
          },
        })
      : null;

  // Dual energy ring aura — cyan + purple (sprint / resonance)
  const aura = new THREE.Mesh(
    new THREE.TorusGeometry(1.35, 0.08, 8, 56),
    new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  aura.rotation.x = Math.PI / 2;
  aura.position.y = 0.95;
  player.add(aura);
  const auraPurple = new THREE.Mesh(
    new THREE.TorusGeometry(1.55, 0.05, 6, 48),
    new THREE.MeshBasicMaterial({
      color: 0xa855f7,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  auraPurple.rotation.x = Math.PI / 2;
  auraPurple.position.y = 1.0;
  player.add(auraPurple);
  const auraDisc = new THREE.Mesh(
    new THREE.CircleGeometry(1.25, 40),
    new THREE.MeshBasicMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
  );
  auraDisc.rotation.x = -Math.PI / 2;
  auraDisc.position.y = 0.05;
  player.add(auraDisc);

  // ---- Juice: confetti + ceremony rings (after player exists) ----
  const confettiCount = 48;
  const confettiPos = new Float32Array(confettiCount * 3);
  const confettiVel = [];
  for (let ci = 0; ci < confettiCount; ci++) {
    confettiVel.push(new THREE.Vector3());
    confettiPos[ci * 3 + 1] = -999;
  }
  const confettiGeo = new THREE.BufferGeometry();
  confettiGeo.setAttribute("position", new THREE.BufferAttribute(confettiPos, 3));
  const confettiMat = new THREE.PointsMaterial({
    color: 0xfbbf24,
    size: 0.35,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  if (window.BoltGraphics && window.BoltGraphics.getSoftSpriteTexture) {
    confettiMat.map = window.BoltGraphics.getSoftSpriteTexture();
  }
  const confettiPts = new THREE.Points(confettiGeo, confettiMat);
  confettiPts.frustumCulled = false;
  scene.add(confettiPts);

  function burstConfetti(origin, colorHex) {
    confettiMat.color.setHex(colorHex != null ? colorHex : 0xfbbf24);
    confettiMat.opacity = 1;
    juice.confettiT = 1.25;
    for (let i = 0; i < confettiCount; i++) {
      confettiPos[i * 3] = origin.x + (Math.random() - 0.5) * 0.5;
      confettiPos[i * 3 + 1] = origin.y + 0.9 + Math.random() * 0.6;
      confettiPos[i * 3 + 2] = origin.z + (Math.random() - 0.5) * 0.5;
      confettiVel[i].set(
        (Math.random() - 0.5) * 14,
        6 + Math.random() * 10,
        (Math.random() - 0.5) * 14
      );
    }
    confettiGeo.attributes.position.needsUpdate = true;
  }

  function updateConfetti(dt) {
    if (juice.confettiT <= 0) {
      confettiMat.opacity = 0;
      return;
    }
    juice.confettiT = Math.max(0, juice.confettiT - dt);
    confettiMat.opacity = Math.min(1, juice.confettiT * 1.15);
    confettiMat.size = 0.22 + juice.confettiT * 0.28;
    for (let i = 0; i < confettiCount; i++) {
      confettiVel[i].y -= 18 * dt;
      confettiPos[i * 3] += confettiVel[i].x * dt;
      confettiPos[i * 3 + 1] += confettiVel[i].y * dt;
      confettiPos[i * 3 + 2] += confettiVel[i].z * dt;
    }
    confettiGeo.attributes.position.needsUpdate = true;
  }

  const juiceRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.6, 0.08, 8, 48),
    new THREE.MeshBasicMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  juiceRing.rotation.x = Math.PI / 2;
  juiceRing.position.y = 0.4;
  player.add(juiceRing);
  const juiceRing2 = new THREE.Mesh(
    new THREE.TorusGeometry(2.2, 0.05, 8, 40),
    new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  juiceRing2.rotation.x = Math.PI / 2;
  juiceRing2.position.y = 0.35;
  player.add(juiceRing2);

  // Expanding shockwave sphere for Core stage
  const coreShock = new THREE.Mesh(
    new THREE.SphereGeometry(1, 24, 16),
    new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      wireframe: true,
    })
  );
  coreShock.visible = false;
  player.add(coreShock);
  let coreShockT = 0;

  function pulseRing(colorHex, strength) {
    juice.ringPulse = Math.max(juice.ringPulse, strength != null ? strength : 1);
    if (colorHex != null) {
      juiceRing.material.color.setHex(colorHex);
      juiceRing2.material.color.setHex(colorHex === 0xfbbf24 ? 0x67e8f9 : 0xfbbf24);
    }
  }

  function burstCoreShock(colorHex) {
    coreShockT = 1;
    coreShock.visible = true;
    coreShock.scale.setScalar(0.3);
    coreShock.material.color.setHex(colorHex != null ? colorHex : 0xfbbf24);
    coreShock.material.opacity = 0.7;
  }

  function updateJuiceRings(dt) {
    if (juice.ringPulse > 0) {
      juice.ringPulse = Math.max(0, juice.ringPulse - dt * 1.1);
      const t = juice.ringPulse;
      const s = 1 + (1 - t) * 2.8;
      juiceRing.scale.setScalar(s);
      juiceRing2.scale.setScalar(s * 1.2);
      juiceRing.material.opacity = t * 0.8;
      juiceRing2.material.opacity = t * 0.5;
      juiceRing.rotation.z += dt * 3.2;
      juiceRing2.rotation.z -= dt * 2.4;
    } else {
      juiceRing.material.opacity = 0;
      juiceRing2.material.opacity = 0;
    }
    if (coreShockT > 0) {
      coreShockT = Math.max(0, coreShockT - dt * 1.3);
      coreShock.scale.setScalar(0.5 + (1 - coreShockT) * 8);
      coreShock.material.opacity = coreShockT * 0.65;
      coreShock.rotation.y += dt * 2;
      if (coreShockT <= 0) coreShock.visible = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Sprint systems
  // ---------------------------------------------------------------------------
  const state = {
    vel: new THREE.Vector3(),
    onGround: false,
    sprinting: false,
    momentum: 0,
    intention: 0,
    starCore: 0,
    resonance: 0,
    sparksCollected: 0,
    meaningfulScore: 0,
    howlT: 0,
    recallCooldown: 0,
    spawnBudget: 0,
    coreAwakened: false,
    scaleStage: "paw",
    transitionProgress: 0,
    scaleProps: null,
    prevScaleStage: "paw",
    ascentCommit: false, // true only after deliberate sprint-launch (leave ground by choice)
    currentPlanet: null, // { name, biome } when landed on a companion world
    planetLand: null, // active landing tween
    approachHint: null,
    planetNav: null, // HUD: { name, dist, progress, eta, status, landDist }
    gateOpen: false,
    gateCeremonyT: 0,
    decreesFound: 0,
    coreStageId: "spark",
    coreStageIndex: 0,
    wishX: 0,
    wishZ: 0,
    gateOpenTime: 0,
    nearestLandmark: null,
    towardLandmark: 0,
    howlCount: 0,
    ruinsLooted: 0,
    questsDone: 0,
    packEventT: 0,
    packEventKind: null,
    packCooldown: 0,
    highResonanceTime: 0,
    eventsThisRun: 0,
    playTime: 0,
    biomesSeen: Object.create(null),
  };

  // ---------------------------------------------------------------------------
  // Pack Memory — lifetime progression save
  // ---------------------------------------------------------------------------
  const SAVE_KEY = "bolt_progress_v1";
  const progress = {
    decrees: [],
    completedQuests: [],
    bestCoreStage: "spark",
    bestCoreIndex: 0,
    bestStarCore: 0,
    biomesVisited: {},
    stats: {
      howls: 0,
      ruins: 0,
      gateTime: 0,
      events: 0,
      playTime: 0,
      runs: 0,
      sparks: 0,
      decrees: 0,
    },
    lastSave: 0,
  };

  function loadProgress() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data) {
          if (Array.isArray(data.decrees)) progress.decrees = data.decrees;
          if (Array.isArray(data.completedQuests)) progress.completedQuests = data.completedQuests;
          if (data.bestCoreStage) progress.bestCoreStage = data.bestCoreStage;
          if (data.bestCoreIndex != null) progress.bestCoreIndex = data.bestCoreIndex;
          if (data.bestStarCore != null) progress.bestStarCore = data.bestStarCore;
          if (data.biomesVisited) progress.biomesVisited = data.biomesVisited;
          if (data.stats) {
            Object.keys(data.stats).forEach(function (k) {
              progress.stats[k] = data.stats[k] || 0;
            });
          }
          progress.lastSave = data.lastSave || 0;
        }
      } else {
        // Migrate legacy decree-only save
        const legacy = localStorage.getItem("bolt_decrees_v1");
        if (legacy) {
          const parsed = JSON.parse(legacy);
          if (parsed && Array.isArray(parsed.unlocked)) {
            progress.decrees = parsed.unlocked;
            progress.stats.decrees = parsed.unlocked.length;
          }
        }
      }
    } catch (err) { /* ignore */ }
  }

  function saveProgress() {
    try {
      // Sync decrees from session
      progress.decrees = decreeState.unlocked.map(function (d) {
        return {
          id: d.id,
          title: d.title,
          body: d.body,
          ruin: d.ruin,
          biomeName: d.biomeName,
          at: d.at,
        };
      });
      progress.stats.decrees = progress.decrees.length;
      progress.lastSave = Date.now();
      localStorage.setItem(SAVE_KEY, JSON.stringify(progress));
      // Keep legacy decree key in sync
      localStorage.setItem(
        "bolt_decrees_v1",
        JSON.stringify({ unlocked: progress.decrees })
      );
    } catch (err) { /* ignore */ }
  }

  function applyLegacyFromSave() {
    // Merge saved decrees into session
    if (progress.decrees && progress.decrees.length) {
      progress.decrees.forEach(function (d) {
        if (!decreeState.seenIds[d.id]) {
          decreeState.seenIds[d.id] = true;
          decreeState.unlocked.push(d);
        }
      });
      state.decreesFound = decreeState.unlocked.length;
      if (typeof renderDecreeLog === "function") renderDecreeLog();
    }
  }

  function noteBiomeVisit(biomeId) {
    if (!biomeId) return;
    if (!progress.biomesVisited[biomeId]) {
      progress.biomesVisited[biomeId] = true;
      state.biomesSeen[biomeId] = true;
      saveProgress();
    } else {
      state.biomesSeen[biomeId] = true;
    }
  }

  function updateProgressFromRun() {
    if (state.coreStageIndex > progress.bestCoreIndex) {
      progress.bestCoreIndex = state.coreStageIndex;
      progress.bestCoreStage = state.coreStageId;
    }
    if (state.starCore > progress.bestStarCore) {
      progress.bestStarCore = state.starCore;
    }
    // Merge quest completions into lifetime
    Object.keys(questState.completed).forEach(function (id) {
      if (progress.completedQuests.indexOf(id) < 0) {
        progress.completedQuests.push(id);
      }
    });
  }

  function renderProgressPanel() {
    if (!progressListEl) return;
    updateProgressFromRun();
    const s = progress.stats;
    const biomes = Object.keys(progress.biomesVisited || {}).length;
    const rows = [
      ["Best Core stage", (progress.bestCoreStage || "spark").toUpperCase()],
      ["Best Core charge", Math.round(progress.bestStarCore || 0) + "%"],
      ["Decrees found", (progress.decrees.length || 0) + " / " + totalDecreeCount()],
      ["Quests (lifetime)", (progress.completedQuests || []).length + " / " + QUEST_DEFS.length],
      [
        "Biomes known",
        biomes +
          " / " +
          (window.BoltProcedural && window.BoltProcedural.BIOME_COUNT
            ? window.BoltProcedural.BIOME_COUNT
            : 7),
      ],
      ["Pack events", String(s.events || 0)],
      ["Howls", String(s.howls || 0)],
      ["Ruins looted", String(s.ruins || 0)],
      ["Gate time", Math.round(s.gateTime || 0) + "s"],
      ["Play time", Math.round((s.playTime || 0) / 60) + "m"],
      ["Runs", String(s.runs || 0)],
      ["Sparks (all time)", String(s.sparks || 0)],
    ];
    progressListEl.innerHTML = rows
      .map(function (r, i) {
        const hi = i < 4 ? ' class="prog-highlight"' : "";
        return "<li" + hi + "><span>" + r[0] + "</span><span>" + r[1] + "</span></li>";
      })
      .join("");
  }

  function toggleProgressPanel() {
    if (!progressPanelEl) return;
    const open = progressPanelEl.classList.toggle("hidden");
    if (!progressPanelEl.classList.contains("hidden")) {
      renderProgressPanel();
      saveProgress();
    }
  }

  function updatePauseStats() {
    if (!pauseStatsEl) return;
    updateProgressFromRun();
    pauseStatsEl.innerHTML =
      "<strong>This run:</strong> Core " +
      (state.coreStageId || "spark").toUpperCase() +
      " · Quests " +
      (state.questsDone || 0) +
      " · Events " +
      (state.eventsThisRun || 0) +
      "<br/><strong>Pack memory:</strong> Best " +
      (progress.bestCoreStage || "spark").toUpperCase() +
      " · Decrees " +
      progress.decrees.length +
      " · Runs " +
      (progress.stats.runs || 0);
  }

  const GATE_THRESHOLD = 0.65;

  /**
   * Star Core stages — permanent-for-run progression that reshapes the Boltverse.
   * Distinct from Meaningful Gate (which opens/closes with this sprint).
   */
  const CORE_STAGES = [
    {
      id: "spark",
      name: "SPARK",
      min: 0,
      worldMul: 0,
      ruinBonus: 0,
      detailBonus: 0,
      fogBoost: 0,
      coreGlow: 1,
      boltGlow: 1,
      banner: null,
      lore: null,
    },
    {
      id: "kindled",
      name: "KINDLED",
      min: 25,
      worldMul: 0.1,
      ruinBonus: 0.08,
      detailBonus: 0.12,
      fogBoost: 0.0004,
      coreGlow: 1.25,
      boltGlow: 1.15,
      banner: "STAR CORE — KINDLED",
      lore: "The Core takes a breath. Paths grow bolder. Life thickens at the edge of sight.",
    },
    {
      id: "resonant",
      name: "RESONANT",
      min: 50,
      worldMul: 0.18,
      ruinBonus: 0.14,
      detailBonus: 0.22,
      fogBoost: 0.0007,
      coreGlow: 1.55,
      boltGlow: 1.35,
      banner: "STAR CORE — RESONANT",
      lore: "Resonance and Core sing together. Ruins lean toward you. The living cosmos multiplies.",
    },
    {
      id: "awakened",
      name: "AWAKENED",
      min: 75,
      worldMul: 0.26,
      ruinBonus: 0.2,
      detailBonus: 0.32,
      fogBoost: 0.001,
      coreGlow: 1.9,
      boltGlow: 1.55,
      banner: "STAR CORE — AWAKENED STAGE",
      lore: "Spiral-47 remembers your sprint. Detail rains. History steps into the open.",
    },
    {
      id: "throne",
      name: "THRONE",
      min: 100,
      worldMul: 0.35,
      ruinBonus: 0.28,
      detailBonus: 0.42,
      fogBoost: 0.0014,
      coreGlow: 2.4,
      boltGlow: 1.85,
      banner: "STAR CORE — THRONE AWAKENED",
      lore: "The Thunderwolf Throne answers. Star Core and Citadel sing as one covenant.",
    },
  ];

  function coreStageFromCharge(charge) {
    let stage = CORE_STAGES[0];
    for (let i = 0; i < CORE_STAGES.length; i++) {
      if (charge >= CORE_STAGES[i].min) stage = CORE_STAGES[i];
    }
    return stage;
  }
  const momentumBuf = new Array(20).fill(0);
  let momentumIdx = 0;
  const tmpV = new THREE.Vector3();
  const tmpV2 = new THREE.Vector3();
  let gateBannerTimer = null;
  let prevGateOpen = false;

  // ---------------------------------------------------------------------------
  // Spiral-47 Decree Library (ruin lore fragments)
  // ---------------------------------------------------------------------------
  const DECREE_LIBRARY = [
    { id: "mono_1", ruin: "monolith", title: "FIRST STANDING STONE",
      body: "Before paths had names, the Pack raised a stone to mark where Lightning first kissed the plain." },
    { id: "mono_2", ruin: "monolith", title: "ECHO OF THE THRONE",
      body: "The monolith hums the same note as the Thunderwolf Throne — a distant, patient call home." },
    { id: "mono_3", ruin: "monolith", title: "GATEKEEPER'S MARK",
      body: "Only a purposive sprint unlocks the script. Drift past, and the stone stays mute." },
    { id: "out_1", ruin: "outpost", title: "DERELICT WATCH",
      body: "Scouts once watched the horizon for Flux storms. Their vents still breathe Resonance." },
    { id: "out_2", ruin: "outpost", title: "PACK SUPPLY CACHE",
      body: "Star Core dust was rationed here. Whoever fled left the seals half-broken — for you." },
    { id: "out_3", ruin: "outpost", title: "LAST TRANSMISSION",
      body: "‘Hold the line until Bolt returns.’ The message is centuries cold. The hope is not." },
    { id: "tow_1", ruin: "tower", title: "SPIRE OF ASCENT",
      body: "Towers were ladders of intention — each floor a vow to run farther than fear." },
    { id: "tow_2", ruin: "tower", title: "COLLAPSED VOW",
      body: "This spire fell in a Resonance quake. The vow remains: rise, even broken." },
    { id: "tow_3", ruin: "tower", title: "BEACON PROTOCOL",
      body: "When Meaningful Gate opens, tower crystals re-align toward the Citadel Star Core." },
    { id: "arch_1", ruin: "arch", title: "THRESHOLD ARCH",
      body: "Pass under with momentum, and the cosmos treats you as invited — not lost." },
    { id: "arch_2", ruin: "arch", title: "PATH BLESSING",
      body: "PathGenerator still obeys these keystones. Trails prefer to end where arches wait." },
    { id: "arch_3", ruin: "arch", title: "TWO WORLDS DOOR",
      body: "One side is memory. The other is sprint. Bolt lives in the step between." },
    { id: "plat_1", ruin: "platform", title: "SKY DOCK",
      body: "Whisper fleets once moored here. Gravity is a suggestion; purpose is the rope." },
    { id: "plat_2", ruin: "platform", title: "ORBITAL RELIC",
      body: "A platform that refuses the ground — prototype of the scale-stage called Orbital." },
    { id: "plat_3", ruin: "platform", title: "STARFIELD PIER",
      body: "Stand still and the stars lean closer. Sprint, and they become a road." },
    { id: "temp_1", ruin: "temple", title: "TEMPLE OF THE CORE",
      body: "Here the Pack learned Star Core is not a battery — it is a covenant with motion." },
    { id: "temp_2", ruin: "temple", title: "ALTAR OF INTENTION",
      body: "Offer not gold, but a clean vector. The altar answers only purposed strides." },
    { id: "temp_3", ruin: "temple", title: "DECREE OF AWAKENING",
      body: "When Core reaches full song, the Citadel rings. You are writing that hour now." },
    { id: "wreck_1", ruin: "wreck", title: "EMBER WAR SCAR",
      body: "Flux fire ate this place. Scorch marks are maps of a battle no living Pack remembers." },
    { id: "wreck_2", ruin: "wreck", title: "BROKEN THUNDER",
      body: "A war-machine of Resonance cracked open. Its spark chose you instead of the dark." },
    { id: "wreck_3", ruin: "wreck", title: "VOID LESSON",
      body: "Ember Void keeps what it breaks. Recovering a fragment is an act of defiance." },
    // Biome-tinted universal decrees
    { id: "cry_1", ruin: "any", biome: "crystalNebula", title: "NEBULA WHISPER",
      body: "Crystal plains remember joy. Light here is not decoration — it is old Pack laughter." },
    { id: "emb_1", ruin: "any", biome: "emberVoid", title: "ASH COVENANT",
      body: "Even scorched ground answers a true sprint. Heat is only Resonance with teeth." },
    { id: "whi_1", ruin: "any", biome: "whisperStars", title: "SILENT CONSTELLATION",
      body: "In Whisper fields, footsteps write constellations no sky map will ever own." },
  ];

  const decreeState = {
    unlocked: [], // { id, title, body, ruin, biomeName, at }
    seenIds: Object.create(null),
  };

  // Load unified progress (includes decrees)
  loadProgress();
  applyLegacyFromSave();

  function saveDecrees() {
    saveProgress();
  }

  function totalDecreeCount() {
    return DECREE_LIBRARY.length;
  }

  function renderDecreeLog() {
    if (!decreeListEl || !decreeCountEl) return;
    decreeCountEl.textContent = decreeState.unlocked.length + " / " + totalDecreeCount();
    if (!decreeState.unlocked.length) {
      decreeListEl.innerHTML =
        '<li class="decree-empty">No decrees yet. Sprint with purpose. Touch ruins. Recover the past.</li>';
      return;
    }
    // Newest first
    const items = decreeState.unlocked.slice().reverse();
    decreeListEl.innerHTML = items
      .map(function (d, i) {
        const neu = i === 0 ? " new" : "";
        return (
          '<li class="decree-item' + neu + '">' +
          '<div class="d-title">' + d.title + "</div>" +
          '<div class="d-meta">' +
          (d.ruin || "ruin").toUpperCase() +
          " · " +
          (d.biomeName || "Boltverse") +
          "</div>" +
          '<div class="d-body">' + d.body + "</div>" +
          "</li>"
        );
      })
      .join("");
  }

  function toggleDecreeLog() {
    if (!decreePanelEl) return;
    decreePanelEl.classList.toggle("hidden");
    if (!decreePanelEl.classList.contains("hidden")) renderDecreeLog();
  }

  function pickDecree(ruinType, biomeId) {
    const pool = DECREE_LIBRARY.filter(function (d) {
      if (decreeState.seenIds[d.id]) return false;
      if (d.biome && d.biome !== biomeId) return false;
      if (d.ruin !== "any" && d.ruin !== ruinType) return false;
      return true;
    });
    // Fallback: any unseen for this ruin, then any unseen
    let list = pool;
    if (!list.length) {
      list = DECREE_LIBRARY.filter(function (d) {
        return !decreeState.seenIds[d.id] && (d.ruin === ruinType || d.ruin === "any");
      });
    }
    if (!list.length) {
      list = DECREE_LIBRARY.filter(function (d) { return !decreeState.seenIds[d.id]; });
    }
    if (!list.length) return null;
    return list[Math.floor(Math.random() * list.length)];
  }

  function unlockDecree(ruinType, biomeId, biomeName) {
    const def = pickDecree(ruinType, biomeId);
    if (!def) {
      toast("DECREE ARCHIVE FULL — all known fragments recovered", 2800);
      return null;
    }
    const entry = {
      id: def.id,
      title: def.title,
      body: def.body,
      ruin: ruinType,
      biomeName: biomeName || "Boltverse",
      at: Date.now(),
    };
    decreeState.seenIds[def.id] = true;
    decreeState.unlocked.push(entry);
    state.decreesFound = decreeState.unlocked.length;
    saveDecrees();
    renderDecreeLog();
    // Auto-show log briefly on first few finds
    if (decreePanelEl && decreeState.unlocked.length <= 3) {
      decreePanelEl.classList.remove("hidden");
    }
    return entry;
  }

  // ---------------------------------------------------------------------------
  // Intention destinations + landmark markers + mini-quests
  // ---------------------------------------------------------------------------
  const landmarkBeacons = new THREE.Group();
  landmarkBeacons.name = "LandmarkBeacons";
  scene.add(landmarkBeacons);
  const beaconPool = [];
  const BEACON_MAX = 14;

  function makeBeaconMesh(color) {
    const g = new THREE.Group();
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.35, 8, 8, 1, true),
      new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      })
    );
    beam.position.y = 4;
    g.add(beam);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.9, 0.06, 6, 20),
      new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.15;
    g.add(ring);
    const pip = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.35, 0),
      new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    pip.position.y = 8.2;
    g.add(pip);
    g.visible = false;
    g.userData.beam = beam;
    g.userData.ring = ring;
    g.userData.pip = pip;
    landmarkBeacons.add(g);
    return g;
  }

  for (let bi = 0; bi < BEACON_MAX; bi++) {
    beaconPool.push(makeBeaconMesh(0xfbbf24));
  }

  // Citadel beacon (always on at origin)
  const citadelBeacon = makeBeaconMesh(0xf472b6);
  citadelBeacon.visible = true;
  citadelBeacon.scale.setScalar(citadel.scale || 5);
  citadelBeacon.position.set(0, openWorld.heightAt(0, 0), 0);
  citadelBeacon.userData.fixed = true;

  const QUEST_DEFS = [
    {
      id: "open_gate",
      title: "OPEN THE GATE",
      desc: "Hold Meaningful Sprint ≥65% for 12 seconds. Let Spiral-47 answer.",
      target: 12,
      unit: "s",
      check: function (ctx) {
        return ctx.gateOpenTime;
      },
      reward: { core: 8, resonance: 0.08, flux: 0.5 },
    },
    {
      id: "claim_ruin",
      title: "TOUCH THE PAST",
      desc: "Sprint into a ruin and claim a Star Core fragment (gold crystal).",
      target: 1,
      unit: "",
      check: function (ctx) {
        return ctx.ruinsLooted;
      },
      reward: { core: 6, resonance: 0.1, flux: 0.4 },
    },
    {
      id: "kindled",
      title: "KINDLE THE CORE",
      desc: "Raise Star Core to KINDLED stage (25%).",
      target: 1,
      unit: "",
      check: function (ctx) {
        return ctx.coreStageIndex >= 1 ? 1 : 0;
      },
      reward: { core: 5, resonance: 0.06, flux: 0.35 },
    },
    {
      id: "howl_once",
      title: "SPEAK RESONANCE",
      desc: "Press H — howl and send a Flux pulse through the Boltverse.",
      target: 1,
      unit: "",
      check: function (ctx) {
        return Math.min(1, ctx.howlCount);
      },
      reward: { core: 4, resonance: 0.12, flux: 0.55 },
    },
    {
      id: "sprint_landmark",
      title: "RUN WITH PURPOSE",
      desc: "Sprint toward a gold landmark for 8s total (Intention destinations).",
      target: 8,
      unit: "s",
      check: function (ctx) {
        return ctx.towardLandmarkTime || 0;
      },
      reward: { core: 7, resonance: 0.07, flux: 0.4 },
    },
    {
      id: "monolith_decree",
      title: "MONOLITH MEMORY",
      desc: "Recover a Decree from a Monolith ruin (or any ruin if none).",
      target: 1,
      unit: "",
      check: function (ctx) {
        return ctx.decreesFound > 0 ? 1 : 0;
      },
      reward: { core: 10, resonance: 0.1, flux: 0.45 },
    },
    {
      id: "resonant_core",
      title: "RESONANT HEART",
      desc: "Reach Star Core RESONANT stage (50%).",
      target: 1,
      unit: "",
      check: function (ctx) {
        return ctx.coreStageIndex >= 2 ? 1 : 0;
      },
      reward: { core: 12, resonance: 0.12, flux: 0.5 },
    },
    {
      id: "gate_hold",
      title: "HOLD THE THREAD",
      desc: "Keep the Meaningful Gate open for 25s total this run.",
      target: 25,
      unit: "s",
      check: function (ctx) {
        return ctx.gateOpenTime;
      },
      reward: { core: 10, resonance: 0.1, flux: 0.6 },
    },
  ];

  const questState = {
    queue: QUEST_DEFS.map(function (q) { return q.id; }),
    active: null,
    completed: Object.create(null),
    towardLandmarkTime: 0,
    baseline: Object.create(null),
  };

  function getQuestDef(id) {
    for (let i = 0; i < QUEST_DEFS.length; i++) {
      if (QUEST_DEFS[i].id === id) return QUEST_DEFS[i];
    }
    return null;
  }

  function questCtx() {
    return {
      gateOpenTime: state.gateOpenTime,
      ruinsLooted: state.ruinsLooted,
      coreStageIndex: state.coreStageIndex,
      howlCount: state.howlCount,
      decreesFound: decreeState.unlocked.length,
      towardLandmarkTime: questState.towardLandmarkTime,
    };
  }

  function renderQuestUI() {
    if (!questPanelEl || !questState.active) return;
    const def = questState.active;
    const ctx = questCtx();
    const raw = def.check(ctx);
    const base = questState.baseline[def.id] || 0;
    const progress = Math.max(0, raw - base);
    const pct = Math.min(1, progress / def.target);
    if (questTitleEl) questTitleEl.textContent = def.title;
    if (questDescEl) questDescEl.textContent = def.desc;
    if (questProgressEl) {
      const show = def.unit === "s"
        ? Math.floor(progress) + "/" + def.target + "s"
        : Math.floor(progress) + "/" + def.target;
      questProgressEl.textContent = show;
    }
    if (questBarEl) questBarEl.style.width = pct * 100 + "%";
  }

  function startNextQuest() {
    while (questState.queue.length) {
      const id = questState.queue.shift();
      if (questState.completed[id]) continue;
      const def = getQuestDef(id);
      if (!def) continue;
      questState.active = def;
      const ctx = questCtx();
      // Baseline so progress counts from now (for cumulative timers)
      if (def.id === "open_gate" || def.id === "gate_hold") {
        questState.baseline[def.id] = state.gateOpenTime;
      } else if (def.id === "sprint_landmark") {
        questState.baseline[def.id] = questState.towardLandmarkTime;
      } else if (def.id === "claim_ruin") {
        questState.baseline[def.id] = state.ruinsLooted;
      } else if (def.id === "howl_once") {
        questState.baseline[def.id] = state.howlCount;
      } else if (def.id === "monolith_decree") {
        questState.baseline[def.id] = decreeState.unlocked.length;
      } else {
        questState.baseline[def.id] = 0;
      }
      // For stage checks, baseline 0 is fine
      if (questPanelEl) {
        questPanelEl.classList.remove("hidden", "complete");
      }
      renderQuestUI();
      toast("QUEST: " + def.title, 2800, "lore");
      return;
    }
    questState.active = null;
    if (questTitleEl) questTitleEl.textContent = "ALL QUESTS CLEAR";
    if (questDescEl) questDescEl.textContent = "Spiral-47 has no more Decrees for this run. Sprint free.";
    if (questProgressEl) questProgressEl.textContent = "✓";
    if (questBarEl) questBarEl.style.width = "100%";
    toast("All mini-quests complete — the cosmos is yours", 3500, "lore");
  }

  function completeQuest(def) {
    if (!def || questState.completed[def.id]) return;
    questState.completed[def.id] = true;
    state.questsDone++;
    if (progress.completedQuests.indexOf(def.id) < 0) {
      progress.completedQuests.push(def.id);
    }
    const r = def.reward || {};
    state.starCore = Math.min(100, state.starCore + (r.core || 0));
    state.resonance = Math.min(1, state.resonance + (r.resonance || 0));
    if (spawner && spawner.pulseFlux && r.flux) spawner.pulseFlux(r.flux);
    if (Sfx && Sfx.playDecree) Sfx.playDecree();
    saveProgress();
    punchCam(0.35, 7);
    pulseRing(0xfbbf24, 1.25);
    burstConfetti(player.position, 0xfbbf24);
    setTimeout(function () {
      burstConfetti(player.position, 0x67e8f9);
    }, 100);
    if (questPanelEl) {
      questPanelEl.classList.add("complete");
      questPanelEl.classList.add("juice-pop");
      setTimeout(function () {
        questPanelEl.classList.remove("juice-pop");
      }, 700);
    }
    toast("QUEST COMPLETE — " + def.title, 3000, "lore");
    setTimeout(function () {
      toast(
        "Reward: +" +
          (r.core || 0) +
          " Core · Resonance · Flux",
        2800,
        "lore"
      );
    }, 900);
    setTimeout(function () {
      if (questPanelEl) questPanelEl.classList.remove("complete");
      startNextQuest();
    }, 2200);
  }

  function updateQuestProgress() {
    if (!questState.active) return;
    const def = questState.active;
    const ctx = questCtx();
    const raw = def.check(ctx);
    const base = questState.baseline[def.id] || 0;
    const progress = Math.max(0, raw - base);
    renderQuestUI();
    if (progress >= def.target) completeQuest(def);
  }

  function toggleQuestPanel() {
    if (!questPanelEl) return;
    questPanelEl.classList.toggle("hidden");
  }

  // ---------------------------------------------------------------------------
  // Pack / Resonance world events
  // ---------------------------------------------------------------------------
  const PACK_EVENTS = {
    fluxStorm: {
      id: "fluxStorm",
      name: "FLUX STORM",
      banner: "PACK EVENT — FLUX STORM",
      lore: "Resonance tears the sky. Ember scars light. The generators roar.",
      duration: 12,
      flux: 1.2,
      core: 3,
      className: "storm",
      preferBiome: "emberVoid",
    },
    packCall: {
      id: "packCall",
      name: "PACK CALL",
      banner: "PACK EVENT — THE PACK ANSWERS",
      lore: "Distant howls thread the void. You are not alone on Spiral-47.",
      duration: 10,
      flux: 0.9,
      core: 2,
      className: "",
    },
    resonanceBloom: {
      id: "resonanceBloom",
      name: "RESONANCE BLOOM",
      banner: "PACK EVENT — RESONANCE BLOOM",
      lore: "Life and light swell. Flora, motes, and crystal fields multiply.",
      duration: 14,
      flux: 1.0,
      core: 4,
      className: "",
      preferBiome: "crystalNebula",
    },
    starfall: {
      id: "starfall",
      name: "STARFALL",
      banner: "PACK EVENT — STARFALL",
      lore: "Whisper stars lean close. Debris of dead suns becomes your road.",
      duration: 11,
      flux: 0.85,
      core: 3,
      className: "starfall",
      preferBiome: "whisperStars",
    },
  };

  let packBannerTimer = null;

  function showPackBanner(text, className) {
    if (!packBannerEl) return;
    packBannerEl.textContent = text;
    packBannerEl.className = "pack-banner show" + (className ? " " + className : "");
    clearTimeout(packBannerTimer);
    packBannerTimer = setTimeout(function () {
      packBannerEl.classList.remove("show");
      setTimeout(function () {
        packBannerEl.classList.add("hidden");
        packBannerEl.className = "pack-banner hidden";
      }, 400);
    }, 4200);
  }

  function pickPackEvent(biomeId, fromHowl) {
    if (fromHowl) return PACK_EVENTS.packCall;
    const pool = [];
    Object.keys(PACK_EVENTS).forEach(function (k) {
      const e = PACK_EVENTS[k];
      if (k === "packCall") return; // howl-only preferred
      let w = 1;
      if (e.preferBiome && e.preferBiome === biomeId) w = 3;
      for (let i = 0; i < w; i++) pool.push(e);
    });
    // Sometimes still pack call at high resonance
    if (state.resonance > 0.75 && Math.random() < 0.25) return PACK_EVENTS.packCall;
    return pool[Math.floor(Math.random() * pool.length)] || PACK_EVENTS.resonanceBloom;
  }

  function startPackEvent(kindOrNull, fromHowl) {
    if (state.packEventT > 0) return false;
    if (state.packCooldown > 0 && !fromHowl) return false;
    const biomeId =
      (spawner && spawner.currentBiome && spawner.currentBiome.id) || "crystalNebula";
    const ev = kindOrNull
      ? PACK_EVENTS[kindOrNull] || pickPackEvent(biomeId, fromHowl)
      : pickPackEvent(biomeId, fromHowl);
    if (!ev) return false;

    state.packEventT = ev.duration;
    state.packEventKind = ev.id;
    state.packCooldown = fromHowl ? 14 : 22;
    state.eventsThisRun = (state.eventsThisRun || 0) + 1;
    progress.stats.events = (progress.stats.events || 0) + 1;

    state.resonance = Math.min(1, state.resonance + 0.15);
    state.starCore = Math.min(100, state.starCore + (ev.core || 2));
    if (spawner && spawner.pulseFlux) spawner.pulseFlux(ev.flux || 1);

    if (packFlashEl) {
      packFlashEl.className = "pack-flash fire" + (ev.className ? " " + ev.className : "");
      void packFlashEl.offsetWidth;
      packFlashEl.classList.add("fire");
    }
    punchCam(0.55, 11);
    pulseRing(ev.id === "fluxStorm" ? 0xf97316 : 0xa855f7, 1.3);
    burstConfetti(
      player.position,
      ev.id === "fluxStorm" ? 0xf97316 : ev.id === "starfall" ? 0xa5b4fc : 0xa855f7
    );
    flashHudMeter(resonanceMeterEl);
    showPackBanner(ev.banner, ev.className);
    if (Sfx && Sfx.playPackEvent) Sfx.playPackEvent(ev.id);
    toast("PACK EVENT — " + ev.name, 2800, "lore");
    setTimeout(function () {
      toast(ev.lore, 4000, "lore");
    }, 1000);

    // Sky meteor shower for pack events (starfall = dense streak burst)
    if (reactiveSky && reactiveSky.spawnComet) {
      const shower = ev.id === "starfall" ? 8 : ev.id === "fluxStorm" ? 5 : 3;
      reactiveSky.spawnComet({
        count: shower,
        kind: ev.id === "starfall" ? "meteor" : "comet",
        burst: ev.id === "starfall" ? 2.2 : 1.1,
      });
    }

    // Visual burst light
    const col =
      ev.id === "fluxStorm" ? 0xf97316 : ev.id === "starfall" ? 0xa5b4fc : 0xa855f7;
    const flash = new THREE.PointLight(col, 16, 70);
    flash.position.copy(player.position);
    flash.position.y += 3;
    scene.add(flash);
    setTimeout(function () { scene.remove(flash); }, 600);

    if (softParticles && softParticles.material) {
      softParticles.material.opacity = Math.min(0.98, 0.85);
      softParticles.material.size = 2.2;
    }
    saveProgress();
    return true;
  }

  function updatePackEvents(dt) {
    if (state.packCooldown > 0) state.packCooldown = Math.max(0, state.packCooldown - dt);

    if (state.packEventT > 0) {
      state.packEventT = Math.max(0, state.packEventT - dt);
      // Sustain flux while event active
      if (spawner && spawner.pulseFlux && Math.random() < dt * 0.35) {
        spawner.pulseFlux(0.15);
      }
      if (state.packEventT <= 0) {
        state.packEventKind = null;
        toast("Pack event fades — Resonance settles", 2200);
        if (packFlashEl) packFlashEl.className = "pack-flash";
      }
    }

    // High resonance accumulation → random event
    if (state.resonance >= 0.7 && state.gateOpen) {
      state.highResonanceTime += dt;
    } else {
      state.highResonanceTime = Math.max(0, state.highResonanceTime - dt * 0.5);
    }

    // Auto-trigger when resonance held high
    if (
      state.packEventT <= 0 &&
      state.packCooldown <= 0 &&
      state.highResonanceTime > 8 &&
      state.resonance >= 0.72 &&
      Math.random() < dt * 0.12
    ) {
      startPackEvent(null, false);
      state.highResonanceTime = 0;
    }

    // Resonance meter hot style
    if (resonanceMeterEl) {
      resonanceMeterEl.classList.toggle(
        "resonance-hot",
        state.resonance >= 0.7 || state.packEventT > 0
      );
    }
  }

  const _proj = new THREE.Vector3();
  function updateLandmarkMarkers(dt) {
    const landmarks = spawner.getLandmarks
      ? spawner.getLandmarks(player.position)
      : [];
    // Citadel as fixed destination
    const citDist = Math.hypot(player.position.x, player.position.z);
    const all = landmarks.slice(0, 10);
    all.push({
      x: 0,
      y: openWorld.heightAt(0, 0) + 4,
      z: 0,
      kind: "citadel",
      type: "citadel",
      hasLoot: false,
      dist: citDist,
    });
    all.sort(function (a, b) { return a.dist - b.dist; });

    // 3D beacons on ruins (not every path — max pool)
    let bIdx = 0;
    let pathBeacons = 0;
    for (let i = 0; i < all.length && bIdx < beaconPool.length; i++) {
      const lm = all[i];
      if (lm.kind === "citadel") continue;
      // Ruins always beacon; paths only the 2 closest
      if (lm.kind === "path") {
        if (lm.dist > 50 || pathBeacons >= 2) continue;
        pathBeacons++;
      }
      const b = beaconPool[bIdx++];
      b.visible = true;
      const gy = openWorld.heightAt(lm.x, lm.z);
      b.position.set(lm.x, gy, lm.z);
      const col = lm.kind === "path" ? 0x67e8f9 : lm.hasLoot ? 0xfbbf24 : 0xe2e8f0;
      b.userData.beam.material.color.setHex(col);
      b.userData.ring.material.color.setHex(col);
      b.userData.pip.material.color.setHex(col);
      b.userData.pip.rotation.y += dt * 1.5;
      b.userData.ring.rotation.z += dt * 0.8;
      const pulse = 0.5 + Math.sin(performance.now() * 0.004 + i) * 0.2;
      b.userData.beam.material.opacity = 0.22 + pulse * 0.28;
      // Scale beam taller for mega ruins
      if (lm.kind === "ruin") {
        b.scale.setScalar(1.4 + Math.min(1.5, lm.dist * 0.01));
      } else {
        b.scale.setScalar(0.85);
      }
    }
    for (let j = bIdx; j < beaconPool.length; j++) {
      beaconPool[j].visible = false;
    }
    // Citadel beacon
    citadelBeacon.position.set(0, openWorld.heightAt(0, 0), 0);
    citadelBeacon.scale.setScalar((citadel.scale || 5) * 1.2);
    citadelBeacon.userData.pip.rotation.y += dt * 1.2;

    // Nearest non-citadel landmark for intention; prefer loot ruins
    let nearest = null;
    for (let i = 0; i < all.length; i++) {
      if (all[i].kind === "citadel" && all[i].dist < 15) continue;
      if (all[i].kind === "ruin") {
        nearest = all[i];
        break;
      }
    }
    if (!nearest) {
      for (let i = 0; i < all.length; i++) {
        if (all[i].kind !== "path" || all[i].dist < 50) {
          nearest = all[i];
          break;
        }
      }
    }
    state.nearestLandmark = nearest;

    // Screen-space markers
    if (landmarkMarkersEl) {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const margin = 36;
      let html = "";
      const show = all.slice(0, 6);
      for (let i = 0; i < show.length; i++) {
        const lm = show[i];
        if (lm.dist < 4 && lm.kind !== "citadel") continue;
        _proj.set(lm.x, lm.y + (lm.kind === "ruin" ? 4 : 2), lm.z);
        _proj.project(camera);
        let behind = _proj.z > 1;
        let sx = (_proj.x * 0.5 + 0.5) * w;
        let sy = (-_proj.y * 0.5 + 0.5) * h;
        let edge = false;
        if (behind || sx < margin || sx > w - margin || sy < margin || sy > h - margin) {
          edge = true;
          // Direction in camera space
          const dx = lm.x - camera.position.x;
          const dz = lm.z - camera.position.z;
          const camFwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
          // Use yaw-based screen dir
          const ang = Math.atan2(dx, dz) - yaw;
          const ex = Math.sin(ang);
          const ey = -Math.cos(ang);
          // Place on ellipse near edge
          const rx = w * 0.42;
          const ry = h * 0.38;
          sx = w * 0.5 + ex * rx;
          sy = h * 0.5 + ey * ry;
          sx = Math.max(margin, Math.min(w - margin, sx));
          sy = Math.max(margin, Math.min(h - margin, sy));
        }
        const label =
          lm.kind === "citadel"
            ? "HOME CITADEL"
            : lm.kind === "path"
            ? (lm.type || "PATH").toUpperCase()
            : (lm.type || "RUIN").toUpperCase() + (lm.hasLoot ? " ◆" : "");
        const cls =
          "lm-marker" +
          (lm.kind === "citadel" ? " lm-citadel" : lm.kind === "path" ? " lm-path" : "") +
          (edge ? " lm-edge" : "");
        html +=
          '<div class="' +
          cls +
          '" style="left:' +
          sx.toFixed(0) +
          "px;top:" +
          sy.toFixed(0) +
          'px"><div class="lm-pip"></div>' +
          label +
          '<div class="lm-dist">' +
          Math.round(lm.dist) +
          "m</div></div>";
      }
      landmarkMarkersEl.innerHTML = html;
    }
  }

  function groundHeightAt(x, z) {
    // Infinite open-world surface + climbable structure tops
    const py = player && player.position ? player.position.y : 0;
    let best = openWorld.heightAt(x, z);
    // Static pads / citadel / starter platforms — only if player can reach the top
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      if (x >= c.minx && x <= c.maxx && z >= c.minz && z <= c.maxz) {
        // Must be near the pad height (step up / drop onto) — never snap from deep below
        if (c.y > best && py + 2.8 >= c.y && py - 5.5 <= c.y + 0.5) {
          best = c.y;
        }
      }
    }
    // Procedural ruins / terrain walk tops (temples, platforms, boulder fields…)
    if (spawner && spawner.sampleWalkTop) {
      const top = spawner.sampleWalkTop(x, z, py);
      if (top != null && top > best) best = top;
    }
    // Orbital debris platforms (land-on wreckage)
    if (orbitalDebris && orbitalDebris.platformHeightAt) {
      const dy = orbitalDebris.platformHeightAt(x, player.position.y, z);
      if (dy != null && dy > best && py + 3 >= dy && py - 6 <= dy + 0.5) best = dy;
    }
    return best;
  }

  function toast(msg, ms, kind) {
    ms = ms || 2200;
    toastEl.textContent = msg;
    toastEl.classList.remove("lore", "gate-open-toast", "gate-close-toast");
    if (kind) toastEl.classList.add(kind);
    toastEl.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () {
      toastEl.classList.remove("show", "lore", "gate-open-toast", "gate-close-toast");
    }, ms);
  }

  function showGateBanner(text, closing) {
    if (!gateBannerEl) return;
    gateBannerEl.textContent = text;
    gateBannerEl.classList.toggle("closing", !!closing);
    gateBannerEl.classList.remove("hidden");
    gateBannerEl.classList.add("show");
    clearTimeout(gateBannerTimer);
    gateBannerTimer = setTimeout(function () {
      gateBannerEl.classList.remove("show");
      setTimeout(function () {
        gateBannerEl.classList.add("hidden");
      }, 400);
    }, closing ? 3200 : 4200);
  }

  function fireGateCeremony(opening) {
    state.gateCeremonyT = opening ? 1.6 : 0.9;
    if (gateFlashEl) {
      gateFlashEl.classList.remove("fire");
      // reflow
      void gateFlashEl.offsetWidth;
      gateFlashEl.classList.add("fire");
    }
    if (opening) {
      if (Sfx && Sfx.playGateOpen) Sfx.playGateOpen();
      punchCam(0.45, 10);
      pulseRing(0x67e8f9, 1.15);
      burstConfetti(player.position, 0x67e8f9);
      flashHudMeter(meaningfulMeterEl);
      // Visual + systems burst: cosmos answers purpose
      const flash = new THREE.PointLight(0x67e8f9, 14, 55);
      flash.position.copy(player.position);
      flash.position.y += 2;
      scene.add(flash);
      setTimeout(function () { scene.remove(flash); }, 500);
      if (spawner && spawner.pulseFlux) spawner.pulseFlux(1.0);
      state.resonance = Math.min(1, state.resonance + 0.12);
      state.starCore = Math.min(100, state.starCore + 1.5);
      if (aura) {
        aura.material.opacity = Math.max(aura.material.opacity, 0.55);
      }
      if (meaningfulMeterEl) meaningfulMeterEl.classList.add("gate-open");
      showGateBanner("MEANINGFUL GATE OPEN — SPIRAL-47 ANSWERS YOUR SPRINT");
      toast("THE COSMOS UNLOCKS — paths · flora · ruins · detail stream free", 4200, "gate-open-toast");
      if (reactiveSky && reactiveSky.spawnComet) {
        reactiveSky.spawnComet({ count: 4, kind: "comet", burst: 1.4 });
      }
      setTimeout(function () {
        toast("Lore: Intention is the key. Momentum is the seal. Sprint is the force.", 3800, "lore");
      }, 1600);
    } else {
      if (Sfx && Sfx.playGateClose) Sfx.playGateClose();
      punchCam(0.18, 3);
      pulseRing(0x94a3b8, 0.55);
      if (meaningfulMeterEl) meaningfulMeterEl.classList.remove("gate-open");
      showGateBanner("GATE CLOSING — hold intention, keep the thread", true);
      toast("THREAD FADES — Meaningful Sprint dropped below the Gate", 3000, "gate-close-toast");
    }
  }

  function updateMeaningfulGate(score) {
    const open = score >= GATE_THRESHOLD;
    state.gateOpen = open;
    if (open && !prevGateOpen) fireGateCeremony(true);
    else if (!open && prevGateOpen) fireGateCeremony(false);
    prevGateOpen = open;
    if (meaningfulMeterEl) {
      meaningfulMeterEl.classList.toggle("gate-open", open);
    }
    if (state.gateCeremonyT > 0) {
      state.gateCeremonyT = Math.max(0, state.gateCeremonyT - 0.016);
    }
  }

  function applyCoreStageVisuals(stage) {
    // Citadel Star Core beacon
    if (coreSphere && coreSphere.material) {
      coreSphere.material.emissiveIntensity = 1.4 * stage.coreGlow + state.starCore * 0.008;
    }
    if (citadel && citadel.coreLight) {
      citadel.coreLight.intensity = (3 + state.starCore * 0.05 + state.resonance * 2) * stage.coreGlow;
    }
    if (coreLight) {
      coreLight.intensity = (0.6 + state.starCore * 0.02) * stage.coreGlow;
    }
    if (coreShell && coreShell.material) {
      coreShell.material.opacity = Math.min(0.65, 0.25 * stage.coreGlow);
    }
    // Bolt Lightning Core collar / eyes read stronger as Core rises
    if (boltLight) {
      boltLight.userData.coreGlowMul = stage.boltGlow;
    }
    // Soft particles denser/brighter as Core stages rise
    if (softParticles && softParticles.material) {
      softParticles.material.opacity = Math.min(0.95, 0.55 + stage.worldMul * 0.9);
      softParticles.material.size = 1.2 + stage.worldMul * 1.4;
    } else if (softParticles && softParticles.points && softParticles.points.material) {
      softParticles.points.material.opacity = Math.min(0.95, 0.55 + stage.worldMul * 0.9);
      softParticles.points.material.size = 1.2 + stage.worldMul * 1.4;
    }
    // Slight fog clarity as Core brightens the cosmos
    if (scene.fog && scene.fog.density != null && stage.fogBoost) {
      // Don't fight openworld scale fog hard — gentle nudge only
      scene.fog.density = Math.max(0.0008, (scene.fog.density || 0.003) - stage.fogBoost * 0.15);
    }
    // HUD meter class
    if (ui.meterCore) {
      ui.meterCore.classList.remove(
        "stage-spark",
        "stage-kindled",
        "stage-resonant",
        "stage-awakened",
        "stage-citadel",
        "stage-throne"
      );
      ui.meterCore.classList.add("stage-" + stage.id);
    }
    // Grow the living Citadel with Core / Resonance / decrees
    if (citadel && citadel.setGrowth) {
      citadel.setGrowth(
        stage.id === "throne" ? 4 : CORE_STAGES.indexOf(stage),
        state.resonance,
        decreeState.unlocked.length,
        state.eventsThisRun || 0
      );
    }
    if (ui.valCoreStage) ui.valCoreStage.textContent = stage.name;
  }

  function fireCoreStageCeremony(stage, prevStage) {
    if (!stage || stage.id === "spark") return;
    if (Sfx && Sfx.playCoreStage) {
      Sfx.playCoreStage(CORE_STAGES.indexOf(stage));
    }
    punchCam(0.55 + stage.coreGlow * 0.08, 12 + stage.coreGlow * 2);
    pulseRing(0xfbbf24, 1.35);
    burstCoreShock(0xfbbf24);
    burstConfetti(player.position, 0xfbbf24);
    setTimeout(function () {
      burstConfetti(player.position.clone().add(new THREE.Vector3(0, 1, 0)), 0x67e8f9);
    }, 120);
    flashHudMeter(ui.meterCore);
    if (gateFlashEl) {
      gateFlashEl.classList.remove("fire", "core-fire");
      void gateFlashEl.offsetWidth;
      gateFlashEl.classList.add("fire", "core-fire");
    }
    const flash = new THREE.PointLight(0xfbbf24, 16 + stage.coreGlow * 6, 70);
    flash.position.copy(player.position);
    flash.position.y += 2.2;
    scene.add(flash);
    setTimeout(function () { scene.remove(flash); }, 650);
    // Second flash for punch
    const flash2 = new THREE.PointLight(0xffffff, 8, 40);
    flash2.position.copy(player.position);
    flash2.position.y += 1.5;
    scene.add(flash2);
    setTimeout(function () { scene.remove(flash2); }, 200);

    if (spawner && spawner.pulseFlux) spawner.pulseFlux(0.55 + stage.worldMul);
    state.resonance = Math.min(1, state.resonance + 0.08 + stage.worldMul * 0.15);

    if (gateBannerEl) {
      gateBannerEl.classList.add("core-stage");
      showGateBanner(stage.banner || ("STAR CORE — " + stage.name));
      setTimeout(function () {
        if (gateBannerEl) gateBannerEl.classList.remove("core-stage");
      }, 4500);
    }
    toast("STAR CORE STAGE · " + stage.name, 3200, "lore");
    if (stage.lore) {
      setTimeout(function () {
        toast(stage.lore, 4200, "lore");
      }, 1400);
    }
    applyCoreStageVisuals(stage);

    // Throne awakening — Citadel fully lit + orbital platforms
    if (stage.id === "throne" && !state.coreAwakened) {
      state.coreAwakened = true;
      if (coreSphere && coreSphere.material) coreSphere.material.emissiveIntensity = 3.5;
      if (citadel && citadel.coreLight) citadel.coreLight.intensity = 10;
      if (coreLight) coreLight.intensity = 3;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const px = Math.cos(a) * 55;
        const pz = Math.sin(a) * 55;
        spawnPlatform(px, openWorld.heightAt(px, pz) + 6 + (i % 3) * 2, pz, 8);
        spawnSpark(px, openWorld.heightAt(px, pz) + 10, pz);
      }
      toast("THUNDERWOLF CITADEL — THRONE FULLY AWAKENED ⚡🏰", 4200, "lore");
    }
  }

  function updateCoreStage() {
    const stage = coreStageFromCharge(state.starCore);
    const prevId = state.coreStageId;
    const prevIdx = state.coreStageIndex;
    state.coreStageId = stage.id;
    state.coreStageIndex = CORE_STAGES.indexOf(stage);
    // Continuous visual lerp toward current stage
    applyCoreStageVisuals(stage);
    if (stage.id !== prevId && state.coreStageIndex > prevIdx) {
      fireCoreStageCeremony(stage, CORE_STAGES[prevIdx]);
      updateProgressFromRun();
      saveProgress();
    }
    return stage;
  }

  /**
   * Resonance Recall — lightning return to Thunderwolf Citadel gates.
   * Cooldown shrinks as Resonance grows (lore: bond with the Throne).
   */
  function recallToCitadel() {
    if (!started || paused) return;
    if (state.recallCooldown > 0) {
      toast(
        "RECALL CHARGING — " + state.recallCooldown.toFixed(1) + "s (Resonance shortens wait)",
        1800
      );
      return;
    }
    const ent =
      citadel && citadel.getEntrance
        ? citadel.getEntrance()
        : new THREE.Vector3(0, openWorld.heightAt(0, 34) + 1.5, 34);
    // Already home?
    const homeR =
      citadel && citadel.getHomeRadius ? citadel.getHomeRadius() : 80;
    const distHome = Math.hypot(player.position.x - ent.x, player.position.z - ent.z);
    if (distHome < homeR * 0.35) {
      toast("Already at the Citadel gates — walk the path home 🏰", 2200, "lore");
      return;
    }

    // Cooldown: 18s base → ~6s at full Resonance
    const cd = THREE.MathUtils.lerp(18, 6, THREE.MathUtils.clamp(state.resonance, 0, 1));
    state.recallCooldown = cd;

    // Snap home — force surface mode + leave any companion world
    state.vel.set(0, 0, 0);
    state.ascentCommit = false;
    state.onGround = true;
    state.planetLand = null;
    state.approachHint = null;
    if (state.currentPlanet) {
      state.currentPlanet = null;
      if (window.BoltProcedural && window.BoltProcedural.setForceBiome) {
        window.BoltProcedural.setForceBiome(null);
      }
      if (openWorld.rebuildAll) openWorld.rebuildAll(ent.x, ent.z);
    }
    player.position.set(ent.x, ent.y + 0.3, ent.z);
    if (openWorld.transitionProgress != null) openWorld.transitionProgress = 0.08;
    // Face the gate / throne (look -Z toward citadel center)
    yaw = Math.PI; // looking toward -Z (into citadel)
    boltMesh.rotation.y = yaw;

    // Juice + audio
    if (Sfx && Sfx.playRecall) Sfx.playRecall();
    else if (Sfx && Sfx.playBoost) Sfx.playBoost();
    punchCam(0.4, 8);
    pulseRing(0x67e8f9, 1.2);
    burstConfetti(player.position, 0x67e8f9);
    if (typeof burstCoreShock === "function") burstCoreShock(0xa855f7);

    const flash = new THREE.PointLight(0xa855f7, 18, 50);
    flash.position.copy(player.position);
    flash.position.y += 2;
    scene.add(flash);
    setTimeout(function () {
      scene.remove(flash);
    }, 400);

    toast("RESONANCE RECALL — Lightning returns you to the Citadel ⚡🏰", 3200);
    setTimeout(function () {
      toast("Lore: The Thunderwolf Throne calls you home.", 3200, "lore");
    }, 1200);
  }

  function howl() {
    if (state.howlT > 0) return;
    state.howlT = 0.9;
    state.resonance = Math.min(1, state.resonance + 0.35);
    state.momentum = Math.min(1, state.momentum + 0.2);
    const dir = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    state.vel.addScaledVector(dir, 12 + state.momentum * 10);
    state.vel.y += 4;
    if (Sfx && Sfx.playHowl) Sfx.playHowl();
    state.howlCount = (state.howlCount || 0) + 1;
    progress.stats.howls = (progress.stats.howls || 0) + 1;
    punchCam(0.5, 9);
    pulseRing(0xa855f7, 1.2);
    burstConfetti(player.position, 0xa855f7);
    flashHudMeter(resonanceMeterEl);
    toast("RESONANCE HOWL — Flux answers the Pack", 2400);
    if (reactiveSky && reactiveSky.spawnComet) {
      reactiveSky.spawnComet({ count: 3, kind: "comet", burst: 1.0 });
    }
    setTimeout(function () {
      toast("Lore: Howl is not noise — it is a Resonance Decree spoken aloud.", 3200, "lore");
    }, 900);
    const flash = new THREE.PointLight(0xa855f7, 8, 40);
    flash.position.copy(player.position);
    flash.position.y += 1;
    scene.add(flash);
    setTimeout(function () { scene.remove(flash); }, 350);
    state.starCore = Math.min(100, state.starCore + 2 + state.momentum * 3);
    // Flux pulse + chance to summon Pack Call event
    if (spawner && spawner.pulseFlux) spawner.pulseFlux(0.75);
    else if (spawner) spawner.cooldown = 0;
    if (state.resonance > 0.45 || state.gateOpen) {
      // Howl can invoke Pack Call if cooldown allows
      if (state.packCooldown <= 4) {
        setTimeout(function () {
          startPackEvent("packCall", true);
        }, 400);
      }
    }
    saveProgress();
  }

  if (decreeCloseBtn) {
    decreeCloseBtn.addEventListener("click", function () {
      if (decreePanelEl) decreePanelEl.classList.add("hidden");
    });
  }
  if (progressCloseBtn) {
    progressCloseBtn.addEventListener("click", function () {
      if (progressPanelEl) progressPanelEl.classList.add("hidden");
    });
  }
  renderDecreeLog();

  // P1–P4 Procedural Spawner (paths, terrain, flora, ruins, details + pools/fade)
  const spawner = new window.BoltProcedural.ProceduralSpawner(scene, {
    onReveal: function (msg) { toast(msg, 1600); },
    heightAt: function (x, z) { return openWorld.heightAt(x, z); },
  });

  // Orbital Debris — interactive junk fields (orbit, land-on, shatter, assists)
  const orbitalDebris =
    window.BoltDebris && window.BoltDebris.OrbitalDebrisSystem
      ? new window.BoltDebris.OrbitalDebrisSystem(scene, {
          onToast: function (msg) {
            toast(msg, 1800, "lore");
          },
        })
      : null;

  // ---------------------------------------------------------------------------
  // Companion planet approach + smooth landing
  // ---------------------------------------------------------------------------
  function beginPlanetLand(planet) {
    if (state.planetLand) return;
    state.planetLand = {
      planet: planet,
      t: 0,
      duration: 1.55,
      from: player.position.clone(),
      // Surface point on the sphere facing outward
      to: (function () {
        const p = planet.position;
        const dir = new THREE.Vector3(
          player.position.x - p.x,
          player.position.y - p.y,
          player.position.z - p.z
        );
        if (dir.lengthSq() < 0.01) dir.set(0, 1, 0);
        dir.normalize();
        return p.clone().add(dir.multiplyScalar(planet.radius + 2.5));
      })(),
    };
    state.ascentCommit = true;
    state.vel.multiplyScalar(0.25);
    toast("LANDING — " + planet.name + "…", 1800, "lore");
    punchCam(0.25, 6);
    if (Sfx && Sfx.playPackEvent) {
      try { Sfx.playPackEvent("starfall"); } catch (e) { /* optional */ }
    }
  }

  function completePlanetLand(planet) {
    const biomeId =
      planet.biome ||
      (window.BoltProcedural.PLANET_BIOME_MAP &&
        window.BoltProcedural.PLANET_BIOME_MAP[planet.hue]) ||
      "crystalNebula";
    const biomeDef =
      window.BoltProcedural.BIOMES && window.BoltProcedural.BIOMES[biomeId];

    if (window.BoltProcedural.setForceBiome) {
      window.BoltProcedural.setForceBiome(biomeId);
    }

    // New world cell offset so terrain noise feels unique per planet
    const seed = (planet.index != null ? planet.index : 0) + 1;
    const wx = seed * 4800 + 120;
    const wz = seed * -3600 - 80;
    player.position.set(wx, 30, wz);
    state.vel.set(0, -4, 0);
    state.ascentCommit = false;
    state.onGround = false;
    state.planetLand = null;
    state.approachHint = null;
    state.planetNav = null;
    state.currentPlanet = {
      name: planet.name,
      biome: biomeId,
      short: (biomeDef && biomeDef.short) || planet.name,
    };
    if (orbitalDebris && orbitalDebris.clear) orbitalDebris.clear();

    // Drop scale back to surface so generators + gravity feel grounded
    if (openWorld) {
      openWorld.transitionProgress = 0.06;
      openWorld.scaleStage = "paw";
      if (openWorld.rebuildAll) openWorld.rebuildAll(wx, wz);
      else openWorld.ensureAround(wx, wz);
    }
    state.scaleStage = "paw";
    state.transitionProgress = 0.06;
    state.prevScaleStage = "paw";

    // Snap down onto surface next frames
    const gh = openWorld.heightAt(wx, wz);
    player.position.y = gh + 2.5;

    const bName = (biomeDef && biomeDef.name) || biomeId;
    toast("PLANETFALL — " + planet.name, 2600, "lore");
    setTimeout(function () {
      toast("NEW WORLD BIOME — " + bName, 3200, "lore");
    }, 900);
    punchCam(0.4, 10);
    pulseRing(planet.atmo || 0x67e8f9, 1.4);
    flashHudMeter(ui.meterCore);
    if (Sfx && Sfx.playGateOpen) {
      try { Sfx.playGateOpen(); } catch (e) { /* optional */ }
    }
  }

  function updatePlanetTravel(dt) {
    // Active smooth land tween onto the beacon sphere, then surface warp
    if (state.planetLand) {
      const L = state.planetLand;
      L.t += dt;
      const u = THREE.MathUtils.clamp(L.t / L.duration, 0, 1);
      // Ease-in-out cubic for smooth approach
      const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      player.position.lerpVectors(L.from, L.to, e);
      state.vel.set(0, 0, 0);
      state.onGround = false;
      state.ascentCommit = true;
      const remain = Math.max(0, L.duration - L.t);
      state.planetNav = {
        name: L.planet.name,
        dist: 0,
        landDist: 0,
        progress: u,
        eta: remain,
        status: "LANDING SEQUENCE",
        phase: "landing",
      };
      // Slight camera look at planet
      if (L.planet && L.planet.position) {
        const dx = L.planet.position.x - player.position.x;
        const dz = L.planet.position.z - player.position.z;
        if (Math.hypot(dx, dz) > 0.5) {
          yaw = dampAngle(yaw, Math.atan2(dx, dz), 4, dt);
        }
      }
      if (u >= 1) {
        completePlanetLand(L.planet);
      }
      return true; // skip normal air physics this frame
    }

    const st = state.scaleStage;
    if (
      !distantPlanets ||
      !distantPlanets.getNearest ||
      (st !== "orbital" && st !== "solar" && st !== "cosmic")
    ) {
      state.planetNav = null;
      return false;
    }

    const near = distantPlanets.getNearest(player.position);
    if (!near) {
      state.planetNav = null;
      return false;
    }

    // Detect range (HUD) vs pull range vs land range
    const detectR = near.radius + 2200; // show nav from far
    const approachR = near.radius + 520;
    const pullR = near.radius + 420;
    const landR = near.radius + 100;
    // Distance remaining until auto-land triggers
    const distToLand = Math.max(0, near.dist - landR);
    // Progress 0% far → 100% at land threshold
    const progress = THREE.MathUtils.clamp(
      1 - distToLand / Math.max(1, detectR - landR),
      0,
      1
    );
    // Closing speed toward planet (for ETA)
    const dx = near.position.x - player.position.x;
    const dy = near.position.y - player.position.y;
    const dz = near.position.z - player.position.z;
    const dist = Math.max(1, near.dist);
    const nx = dx / dist;
    const ny = dy / dist;
    const nz = dz / dist;
    const closing =
      state.vel.x * nx + state.vel.y * ny + state.vel.z * nz;
    let eta = Infinity;
    if (closing > 2) {
      eta = distToLand / closing;
    } else if (state.sprinting && progress > 0.05) {
      // Estimate if sprinting roughly toward it
      eta = distToLand / 28;
    }

    let phase = "far";
    let status = "Sprint toward the beacon to close distance";
    if (near.dist <= landR) {
      phase = "landing";
      status = "LANDING — hold on";
    } else if (near.dist <= pullR) {
      phase = "close";
      status =
        "IN PULL RANGE — keep sprinting · ~" +
        Math.max(1, Math.ceil(eta < 99 ? eta : distToLand / 30)) +
        "s to land";
    } else if (near.dist <= approachR) {
      phase = "approach";
      status =
        "APPROACHING — face world + Sprint · " +
        Math.round(distToLand) +
        "m to land zone";
    } else if (near.dist <= detectR) {
      phase = "detect";
      status =
        "TARGET LOCKED · close " +
        Math.round(distToLand) +
        "m more (Sprint at it)";
    } else {
      state.planetNav = null;
      return false;
    }

    state.planetNav = {
      name: near.name,
      dist: distToLand,
      landDist: landR,
      rawDist: near.dist,
      progress: progress,
      eta: eta,
      status: status,
      phase: phase,
    };

    if (near.dist > approachR) return false;

    if (state.approachHint !== near.name) {
      state.approachHint = near.name;
      toast(
        "TARGET " +
          near.name +
          " — " +
          Math.round(distToLand) +
          "m to land · keep sprinting",
        3200,
        "lore"
      );
    }

    // Soft gravity well + extra pull when facing the planet
    const lookDot =
      Math.sin(yaw) * nx * Math.cos(pitch) +
      Math.sin(pitch) * ny +
      Math.cos(yaw) * nz * Math.cos(pitch);
    const pull = THREE.MathUtils.clamp(1 - near.dist / pullR, 0, 1);
    const face = Math.max(0.25, lookDot);
    const str =
      (state.sprinting ? 36 : 18) * pull * pull * face +
      (near.dist < landR * 1.8 ? 22 * pull : 0);

    state.vel.x += nx * str * dt;
    state.vel.y += ny * str * dt * 0.85;
    state.vel.z += nz * str * dt;
    const sp = Math.hypot(state.vel.x, state.vel.y, state.vel.z);
    if (sp > 48) {
      state.vel.multiplyScalar(48 / sp);
    }

    if (near.dist < landR) {
      beginPlanetLand(near);
      return true;
    }
    return false;
  }

  function updatePlanetNavHud() {
    const el = ui.planetNav;
    if (!el) return;
    const nav = state.planetNav;
    if (!nav) {
      el.classList.add("hidden");
      el.classList.remove("landing", "close");
      return;
    }
    el.classList.remove("hidden");
    el.classList.toggle("landing", nav.phase === "landing");
    el.classList.toggle("close", nav.phase === "close" || nav.phase === "approach");

    if (ui.planetNavName) ui.planetNavName.textContent = nav.name || "—";
    if (ui.planetNavFill) {
      ui.planetNavFill.style.width =
        Math.round(THREE.MathUtils.clamp(nav.progress || 0, 0, 1) * 100) + "%";
    }
    if (ui.planetNavDist) {
      const d = nav.dist != null ? nav.dist : 0;
      ui.planetNavDist.textContent =
        d < 1 ? "LAND ZONE" : Math.round(d) + " m to land";
    }
    if (ui.planetNavEta) {
      if (nav.phase === "landing") {
        ui.planetNavEta.textContent =
          Math.max(0.1, nav.eta || 0).toFixed(1) + "s left";
      } else if (nav.eta != null && isFinite(nav.eta) && nav.eta < 120) {
        ui.planetNavEta.textContent = "~" + Math.max(1, Math.ceil(nav.eta)) + "s ETA";
      } else if (nav.dist != null) {
        // fallback time at sprint pace ~28 u/s
        const est = Math.ceil(nav.dist / 28);
        ui.planetNavEta.textContent =
          est > 90 ? "~" + Math.ceil(est / 60) + " min" : "~" + est + "s if sprinting";
      } else {
        ui.planetNavEta.textContent = "—";
      }
    }
    if (ui.planetNavStatus) {
      ui.planetNavStatus.textContent = nav.status || "";
    }
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------
  function updatePlayer(dt) {
    // Apply mouse look once per tick (stable on high-DPI / multi-event machines)
    applyLookInput();

    const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const right = new THREE.Vector3(Math.sin(yaw + Math.PI / 2), 0, Math.cos(yaw + Math.PI / 2));

    const wish = new THREE.Vector3();
    if (keys["KeyW"] || keys["ArrowUp"]) wish.add(forward);
    if (keys["KeyS"] || keys["ArrowDown"]) wish.sub(forward);
    if (keys["KeyD"] || keys["ArrowRight"]) wish.add(right);
    if (keys["KeyA"] || keys["ArrowLeft"]) wish.sub(right);
    if (wish.lengthSq() > 0) wish.normalize();

    state.sprinting = !!(keys["ShiftLeft"] || keys["ShiftRight"]);
    // Store wish for facing (so Bolt looks where you steer)
    state.wishX = wish.x;
    state.wishZ = wish.z;

    const baseAcc = state.sprinting ? 38 : 18;
    const momBonus = 1 + state.momentum * 1.4 + state.resonance * 0.5;
    const acc = baseAcc * momBonus;

    if (wish.lengthSq() > 0) {
      state.vel.x += wish.x * acc * dt;
      state.vel.z += wish.z * acc * dt;
    }

    const horiz = Math.hypot(state.vel.x, state.vel.z);
    const friction = state.onGround
      ? (state.sprinting ? 2.2 : 8.5)
      : (state.sprinting ? 0.6 : 1.4);
    if (horiz > 0.01) {
      const f = Math.max(0, 1 - friction * dt);
      state.vel.x *= f;
      state.vel.z *= f;
    } else {
      state.vel.x = 0;
      state.vel.z = 0;
    }

    const maxSpeed = (state.sprinting ? 28 : 12) * (1 + state.momentum * 0.85 + state.resonance * 0.4);
    const h2 = Math.hypot(state.vel.x, state.vel.z);
    if (h2 > maxSpeed) {
      const s = maxSpeed / h2;
      state.vel.x *= s;
      state.vel.z *= s;
    }

    if (keys["Space"] && state.onGround) {
      // Normal jump vs deliberate ASCENT (sprint + momentum) — player chooses to leave surface scale
      const breakAscent =
        state.sprinting && state.momentum > 0.5 && Math.hypot(state.vel.x, state.vel.z) > 14;
      const launch =
        9 +
        state.momentum * 6 +
        (state.sprinting ? 2 : 0) +
        (breakAscent ? 6 + state.momentum * 5 : 0);
      state.vel.y = launch;
      state.onGround = false;
      state.momentum = Math.min(1, state.momentum + 0.08);
      if (breakAscent) {
        state.ascentCommit = true; // unlock orbital+ path — keep sprinting to climb
        toast("ASCENT COMMIT — keep Shift to climb scales · land anytime to stay surface", 3200, "lore");
        punchCam(0.18, 3);
      } else {
        state.ascentCommit = false; // hop only — stays paw/planetary
      }
      if (Sfx && Sfx.playJump) Sfx.playJump();
    }

    // Scale-aware gravity — only softens after player CHOSE ascent (not auto-float)
    const scProps = state.scaleProps || openWorld.getScaleFactors();
    const gMul = scProps.gravity != null ? scProps.gravity : 1;
    const airF = scProps.airFriction != null ? scProps.airFriction : 1;
    const coreHold =
      (state.sprinting ? 0.15 : 0) +
      (state.coreStageIndex || 0) * 0.04 +
      state.momentum * 0.08;
    let gEff = gMul;
    if (state.planetLand) {
      gEff = 0; // cinematic land — no gravity fight
    } else if (state.ascentCommit && !state.onGround) {
      // Outrun gravity only on committed ascent
      gEff = Math.max(0.02, gMul * (1 - Math.min(0.55, coreHold * state.transitionProgress)));
      // Near a companion world: even softer so approach pull works
      if (
        distantPlanets &&
        distantPlanets.getNearest &&
        (state.scaleStage === "orbital" ||
          state.scaleStage === "solar" ||
          state.scaleStage === "cosmic")
      ) {
        const np = distantPlanets.getNearest(player.position);
        if (np && np.dist < np.radius + 400) {
          gEff *= 0.35;
        }
      }
    } else if (!state.onGround) {
      // Normal jump: full-ish gravity so you land (surface play)
      gEff = Math.max(0.85, gMul);
    }
    state.vel.y -= 22 * gEff * dt;

    // Air control only during committed ascent in low-g (sprint vectors, not free-fly)
    if (!state.onGround && state.ascentCommit && gEff < 0.55) {
      const wishAir = new THREE.Vector3();
      if (keys["KeyW"] || keys["ArrowUp"]) wishAir.add(forward);
      if (keys["KeyS"] || keys["ArrowDown"]) wishAir.sub(forward);
      if (keys["KeyD"] || keys["ArrowRight"]) wishAir.add(right);
      if (keys["KeyA"] || keys["ArrowLeft"]) wishAir.sub(right);
      if (wishAir.lengthSq() > 0) {
        wishAir.normalize();
        const airAcc = (state.sprinting ? 22 : 10) * (1.2 - gEff);
        state.vel.x += wishAir.x * airAcc * dt;
        state.vel.z += wishAir.z * airAcc * dt;
      }
      const af = Math.max(0, 1 - 0.4 * airF * dt);
      state.vel.x *= af;
      state.vel.z *= af;
      // Optional: hold Space while ascending to push higher (still not flight — burn momentum)
      if (keys["Space"] && state.sprinting && Math.hypot(state.vel.x, state.vel.z) > 16) {
        state.vel.y += 10 * dt;
        state.vel.y = Math.min(state.vel.y, 14);
        state.momentum = Math.max(0, state.momentum - dt * 0.08);
      }
    }

    // Companion planet approach / land (may take over motion this frame)
    const planetMotion = updatePlanetTravel(dt);
    if (!planetMotion) {
      player.position.x += state.vel.x * dt;
      player.position.y += state.vel.y * dt;
      player.position.z += state.vel.z * dt;
    }

    // Solid structure walls (ruins / rocks / landmarks) — horizontal impact
    if (!planetMotion && spawner && spawner.resolveWallCollision) {
      const wallHit = spawner.resolveWallCollision(player.position, 0.9, state.vel);
      if (wallHit && wallHit.impact > 10) {
        if (!updatePlayer._wallToastT || updatePlayer._wallToastT <= 0) {
          toast("IMPACT — " + String(wallHit.type || "STRUCTURE").toUpperCase() + " ⚡", 1100);
          updatePlayer._wallToastT = 1.4;
          punchCam(0.12 + Math.min(0.2, wallHit.impact * 0.01), 3);
        }
      }
    }
    if (updatePlayer._wallToastT > 0) {
      updatePlayer._wallToastT -= dt;
    }

    // Horizontal speed (needed early for debris / assists — do not use before this line)
    const speedNow = Math.hypot(state.vel.x, state.vel.z);

    // --- Orbital Debris: physics + player interaction ---
    if (orbitalDebris && !planetMotion) {
      const stScale = state.scaleStage || "paw";
      const inOrbit =
        stScale === "orbital" || stScale === "solar" || stScale === "cosmic";
      try {
        orbitalDebris.update(dt, player.position, {
          scaleStage: stScale,
          density: spawner.factors ? spawner.factors.density : state.meaningfulScore,
          resonance: state.resonance,
          yaw: yaw,
          biome:
            spawner.currentBiome ||
            (biomeAtmo && biomeAtmo._target && biomeAtmo._target.primary),
          speed: speedNow,
        });
      } catch (errDebris) {
        console.warn("debris update", errDebris);
      }
      if (inOrbit || orbitalDebris.count > 0) {
        let hit = { onDebris: false };
        try {
          hit = orbitalDebris.interact(player.position, state.vel, {
            speed: speedNow,
            resonance: state.resonance,
            sprinting: state.sprinting,
            dt: dt,
          });
        } catch (errHit) {
          console.warn("debris interact", errHit);
        }
        if (hit.onDebris && hit.platformY != null) {
          player.position.y = hit.platformY;
          if (state.vel.y < 0) state.vel.y = 0;
          state.onGround = true;
          // Don't clear ascentCommit — still in orbital play, just standing on wreckage
          if (!updatePlayer._debrisLandToast || updatePlayer._debrisLandToast < performance.now()) {
            toast("DEBRIS PLATFORM — " + (hit.hitName || "wreckage") + " 🛰️", 1600, "lore");
            updatePlayer._debrisLandToast = performance.now() + 4000;
          }
        }
        if (hit.assist) {
          state.momentum = Math.min(1, state.momentum + 0.08);
          punchCam(0.12, 3);
        }
        if (hit.shattered) {
          punchCam(0.22, 5);
          if (Sfx && Sfx.playSpark) Sfx.playSpark();
        }
        if (hit.loot) {
          state.starCore = Math.min(100, state.starCore + hit.loot.core);
          state.resonance = Math.min(1, state.resonance + hit.loot.resonance);
          toast(
            "ORBITAL RELIC — " +
              (hit.loot.name || "debris") +
              " · +" +
              hit.loot.core.toFixed(0) +
              "% Core",
            2200,
            "lore"
          );
          if (Sfx && Sfx.playLoot) Sfx.playLoot();
          punchCam(0.18, 4);
          flashHudMeter(ui.meterCore);
        }
        if (hit.push && speedNow > 12 && Math.random() < 0.08) {
          toast("IMPACT — momentum transfer ⚡", 1200);
        }
      }
    }

    // Stream infinite chunks under Bolt
    openWorld.ensureAround(player.position.x, player.position.z, {
      vx: state.vel.x,
      vz: state.vel.z,
      lookYaw: yaw,
    });

    // Biome atmosphere (fog / lights) — sky dome keeps nebula art
    biomeAtmo.update(
      player.position.x,
      player.position.z,
      state.resonance,
      dt,
      scene,
      { ambient: ambient, sun: sun, rim: rim, fill: lights.fill }
    );
    // Dim biome zenith as clear color (matches dome; not fixed cool-blue void)
    if (scene.background && scene.background.isColor) {
      scene.background.copy(biomeAtmo.sky).multiplyScalar(0.35);
    } else {
      scene.background = biomeAtmo.sky.clone().multiplyScalar(0.35);
    }

    // Soft particles follow Bolt + biome tint
    softParticles.follow(player.position.x, player.position.z);
    softParticles.setColor(biomeAtmo.rim);

    // Reactive sky follows camera (dome + nebulae + gate/lightning)
    if (skyDome && !reactiveSky) {
      skyDome.position.copy(camera.position);
    }
    // Horizon atmospheric haze
    if (horizonHaze && horizonHaze.update) {
      horizonHaze.update(
        player.position,
        state.scaleStage,
        (state.scaleProps && state.scaleProps.skyDark) || 0
      );
    }

    const gh = groundHeightAt(player.position.x, player.position.z);
    // Don't snap to flat ground while mid planet-land cinematic
    if (!state.planetLand) {
      const wasAir = !state.onGround;
      const fallSpeed = -state.vel.y;
      if (player.position.y <= gh + 0.08 && state.vel.y <= 0.15) {
        // Landed on ground or climbable platform / ruin top
        const impactY = fallSpeed;
        player.position.y = gh;
        state.vel.y = 0;
        if (wasAir && impactY > 9) {
          punchCam(0.1 + Math.min(0.25, impactY * 0.012), 2);
          if (impactY > 16 && (!updatePlayer._landToastT || updatePlayer._landToastT <= 0)) {
            toast("LANDING IMPACT ⚡", 900);
            updatePlayer._landToastT = 1.2;
          }
        }
        if (wasAir && state.ascentCommit && !state.currentPlanet) {
          toast("SURFACE RETURN — paw scale · sprint+jump again to ascend", 2400, "lore");
        } else if (wasAir && state.ascentCommit && state.currentPlanet) {
          toast(
            "TOUCHDOWN — " + (state.currentPlanet.short || state.currentPlanet.name),
            2200,
            "lore"
          );
        }
        state.onGround = true;
        state.ascentCommit = false; // landing = choose surface again
      } else if (player.position.y < gh - 100) {
        player.position.y = gh + 5;
        state.vel.y = 0;
        state.ascentCommit = false;
        toast("LIGHTNING CORE — STABILIZED");
      } else {
        state.onGround = false;
      }
      if (updatePlayer._landToastT > 0) updatePlayer._landToastT -= dt;
    }
    // NO radius walls — open world

    // Face where Bolt runs / steers (mesh is Z-forward; matches camera yaw)
    // note: h2 is speed magnitude (hypot), not squared
    const moveSpeed = h2;
    const moveYaw = Math.atan2(state.vel.x, state.vel.z);
    const wishLen = Math.hypot(state.wishX || 0, state.wishZ || 0);
    const wishYaw = wishLen > 0.01 ? Math.atan2(state.wishX, state.wishZ) : yaw;
    let targetYaw = yaw;
    if (state.sprinting && (moveSpeed > 0.8 || wishLen > 0.01)) {
      // Sprint: hard face into movement (or wish if still accelerating)
      targetYaw = moveSpeed > 1.2 ? moveYaw : wishYaw;
    } else if (moveSpeed > 1.5) {
      targetYaw = moveYaw;
    } else if (wishLen > 0.01) {
      targetYaw = wishYaw;
    } else {
      targetYaw = yaw; // idle: face camera look direction
    }
    const turnSpeed = state.sprinting ? 16 : moveSpeed > 2 ? 12 : 9;
    boltMesh.rotation.y = dampAngle(boltMesh.rotation.y, targetYaw, turnSpeed, dt);

    // Procedural life: gallop, head, ears, tail, core, rim (Bolt polish 4–7)
    const tAnim = performance.now() * 0.001;
    const run = moveSpeed > 3;
    const sprintMul = state.sprinting ? 1.9 : 1;
    const gaitSpeed = (run ? 14 : 3.5) * sprintMul;
    const bob = state.onGround
      ? Math.sin(tAnim * gaitSpeed) * (run ? 0.085 : 0.03)
      : Math.sin(tAnim * 4) * 0.02;
    boltMesh.position.y = bob;
    boltMesh.rotation.x = damp(
      boltMesh.rotation.x,
      run ? -0.08 - (state.sprinting ? 0.1 : 0) : 0,
      6,
      dt
    );
    let yawDiff = targetYaw - boltMesh.rotation.y;
    while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
    while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
    boltMesh.rotation.z = damp(
      boltMesh.rotation.z,
      THREE.MathUtils.clamp(-yawDiff * 0.5, -0.4, 0.4),
      8,
      dt
    );

    if (boltMesh.userData.head) {
      const headPitch =
        state.howlT > 0 ? -0.5 : run ? -0.06 : Math.sin(tAnim * 1.5) * 0.04;
      boltMesh.userData.head.rotation.x = damp(
        boltMesh.userData.head.rotation.x,
        headPitch,
        8,
        dt
      );
      boltMesh.userData.head.rotation.y = damp(
        boltMesh.userData.head.rotation.y,
        THREE.MathUtils.clamp(yawDiff * 0.4, -0.45, 0.45),
        7,
        dt
      );
      boltMesh.userData.head.rotation.z = Math.sin(tAnim * 2.2) * 0.02;
    }
    if (boltMesh.userData.ears) {
      boltMesh.userData.ears.forEach(function (ear, i) {
        const twitch =
          state.howlT > 0
            ? -0.18 + Math.sin(tAnim * 22 + i) * 0.08
            : Math.sin(tAnim * 5.5 + i * 1.7) * 0.07;
        ear.rotation.z = damp(ear.rotation.z, twitch, 10, dt);
        ear.rotation.x = state.howlT > 0 ? -0.12 : Math.sin(tAnim * 3 + i) * 0.03;
      });
    }
    const stageGlow = coreStageFromCharge(state.starCore).boltGlow || 1;
    if (boltMesh.userData.core) {
      const pulse =
        (1 + Math.sin(tAnim * 5.5) * 0.12 + (state.sprinting ? 0.18 : 0)) *
        (0.95 + stageGlow * 0.08);
      boltMesh.userData.core.scale.setScalar(pulse);
      boltMesh.userData.core.rotation.y += dt * (state.sprinting ? 3.2 : 1.1) * stageGlow;
      boltMesh.userData.core.traverse(function (c) {
        if (c.material && c.material.emissiveIntensity != null) {
          if (c.material.userData._baseEm == null) {
            c.material.userData._baseEm = c.material.emissiveIntensity;
          }
          c.material.emissiveIntensity =
            c.material.userData._baseEm * (0.85 + stageGlow * 0.2) +
            (state.sprinting ? 0.35 : 0) +
            state.resonance * 0.15;
        }
      });
    }
    if (boltMesh.userData.collar) {
      boltMesh.userData.collar.rotation.z += dt * (1.0 + stageGlow * 0.5);
      boltMesh.userData.collar.scale.setScalar(0.97 + (state.sprinting ? 0.06 : 0) + state.momentum * 0.04);
      if (boltMesh.userData.collar.material && boltMesh.userData.collar.material.emissiveIntensity != null) {
        boltMesh.userData.collar.material.emissiveIntensity =
          1.0 + (state.sprinting ? 0.45 : 0) + state.resonance * 0.3;
      }
    }
    if (boltMesh.userData.tail) {
      // Root sway only — keep plume continuous (no big per-joint opens)
      boltMesh.userData.tail.rotation.y =
        Math.sin(tAnim * (run ? 10 : 2.8)) * (run ? 0.38 : 0.16);
      boltMesh.userData.tail.rotation.z =
        0.12 + Math.sin(tAnim * 2.6) * 0.1 + (state.sprinting ? 0.06 : 0);
      boltMesh.userData.tail.rotation.x = run ? -0.08 : 0;
    }
    if (boltMesh.userData.tailSegs) {
      boltMesh.userData.tailSegs.forEach(function (seg, i) {
        // Subtle wave down the chain; base pose stays overlapping
        const baseX = i === 0 ? -1.08 : -0.1;
        seg.rotation.y = Math.sin(tAnim * (run ? 11 : 3.2) + i * 0.55) * (0.06 + i * 0.02);
        seg.rotation.x = baseX + Math.sin(tAnim * (run ? 9 : 2.5) + i * 0.4) * 0.04;
      });
    }
    // Diagonal gallop: FL+HR together, FR+HL together
    if (boltMesh.userData.legs && run && state.onGround) {
      const amp = state.sprinting ? 0.85 : 0.58;
      boltMesh.userData.legs.forEach(function (leg, i) {
        // 0 FR, 1 FL, 2 BR, 3 BL  — pair 0+3 and 1+2
        const pair = i === 0 || i === 3 ? 0 : 1;
        const phase = tAnim * gaitSpeed + pair * Math.PI;
        leg.rotation.x = Math.sin(phase) * amp;
        leg.position.y = Math.max(0, Math.sin(phase) * 0.04);
      });
    } else if (boltMesh.userData.legs) {
      boltMesh.userData.legs.forEach(function (leg) {
        leg.rotation.x = damp(leg.rotation.x, 0, 9, dt);
        leg.position.y = damp(leg.position.y, 0, 9, dt);
      });
    }
    // ---- Bolt energy power — lightning on white fur only when truly charged ----
    // Pure white at rest/idle · energy only from meaningful sprint / hard sprint / howl
    const boltPower = THREE.MathUtils.clamp(
      (state.meaningfulScore || 0) * 0.55 +
        (state.sprinting ? 0.22 : 0) +
        Math.min(0.12, moveSpeed / 70) +
        (state.momentum || 0) * 0.08 +
        (state.howlT > 0 ? 0.25 : 0) +
        (state.resonance || 0) * 0.06,
      0,
      1.15
    );
    // Higher threshold so casual momentum never dyes him pink/grey
    const boltPowerS = THREE.MathUtils.smoothstep(boltPower, 0.28, 1.05);

    // Stay PURE WHITE unless energy is actually on — never paint the coat grey/pink at rest
    if (boltMesh.userData.furMats) {
      boltMesh.userData.furMats.forEach(function (mat, mi) {
        if (!mat || mat.emissiveIntensity == null) return;
        if (mat.userData._baseFurEm == null) {
          mat.userData._baseFurEm = mat.emissiveIntensity;
        }
        const base = mat.userData._baseFurEm;
        // Always keep albedo pure white
        mat.color.copy(_furWhite);
        if (boltPowerS < 0.08) {
          mat.emissive.copy(_furWhite);
          mat.emissiveIntensity = base;
        } else {
          // Soft cyan energy wash only on high charge (not a full recolor)
          _furEmTmp.copy(_furWhite).lerp(_furCyan, Math.min(0.45, boltPowerS * 0.55));
          if (boltPowerS > 0.7 && state.resonance > 0.55) {
            _furEmTmp.lerp(_furPurple, (boltPowerS - 0.7) * 0.5);
          }
          mat.emissive.copy(_furEmTmp);
          mat.emissiveIntensity = base + boltPowerS * 0.06 + (state.sprinting ? 0.03 : 0);
        }
      });
    }

    // Spine / shoulder lightning veins
    if (boltMesh.userData.veinMats) {
      const veinOp = Math.max(0, (boltPowerS - 0.2) * 0.85 + (state.sprinting ? 0.15 : 0));
      boltMesh.userData.veinMats.forEach(function (vm, i) {
        if (!vm) return;
        vm.opacity = veinOp * (0.55 + 0.45 * Math.sin(tAnim * 8 + i * 1.2));
        // Cyan→purple along the spine
        if (i > 2) vm.color.setHex(0xc084fc);
        else vm.color.setHex(0x67e8f9);
      });
    }
    if (boltMesh.userData.shoulderBlaze) {
      boltMesh.userData.shoulderBlaze.forEach(function (bl, i) {
        if (!bl || !bl.material) return;
        bl.material.opacity =
          Math.max(0, (boltPowerS - 0.25) * 0.45) *
          (0.7 + 0.3 * Math.sin(tAnim * 6 + i));
        bl.scale.setScalar(0.9 + boltPowerS * 0.45 + Math.sin(tAnim * 5 + i) * 0.08);
      });
    }
    if (boltMesh.userData.energyShell && boltMesh.userData.energyShell.material) {
      boltMesh.userData.energyShell.material.opacity =
        Math.max(0, (boltPowerS - 0.35) * 0.22) + (state.howlT > 0 ? 0.08 : 0);
      // Tint shell purple at high resonance
      if (state.resonance > 0.45 || boltPowerS > 0.7) {
        boltMesh.userData.energyShell.material.color.setHex(0xc084fc);
      } else {
        boltMesh.userData.energyShell.material.color.setHex(0x67e8f9);
      }
    }
    if (boltMesh.userData.collarOuter && boltMesh.userData.collarOuter.material) {
      if (boltMesh.userData.collarOuter.material.emissiveIntensity != null) {
        boltMesh.userData.collarOuter.material.emissiveIntensity =
          0.8 + boltPowerS * 1.1 + state.resonance * 0.5;
      }
      boltMesh.userData.collarOuter.scale.setScalar(0.95 + boltPowerS * 0.12);
    }

    if (boltMesh.userData.pawGlows) {
      boltMesh.userData.pawGlows.forEach(function (pg) {
        if (pg.material) {
          pg.material.opacity =
            0.05 +
            boltPowerS * 0.35 +
            state.momentum * 0.1 +
            (state.sprinting ? 0.2 : 0) +
            (state.howlT > 0 ? 0.12 : 0);
          // Paw lightning: cyan, purple at high power
          pg.material.color.setHex(boltPowerS > 0.65 ? 0xc084fc : 0x67e8f9);
        }
      });
    }
    if (boltMesh.userData.underGlow) {
      boltMesh.userData.underGlow.material.opacity =
        0.04 + boltPowerS * 0.22 + state.momentum * 0.08 + (state.sprinting ? 0.12 : 0);
      boltMesh.userData.underGlow.material.color.setHex(
        boltPowerS > 0.6 ? 0xa855f7 : 0x67e8f9
      );
      // Stretch contact glow with speed
      const stretch = 1 + Math.min(1.2, moveSpeed * 0.02);
      boltMesh.userData.underGlow.scale.set(1 / stretch, 1, stretch);
    }
    if (boltMesh.userData.shadow) {
      const stretch = 1 + Math.min(1.0, moveSpeed * 0.018);
      boltMesh.userData.shadow.scale.set(1 / stretch, 1, stretch);
      boltMesh.userData.shadow.material.opacity = 0.38 + (state.sprinting ? 0.08 : 0);
    }
    // Cyan mote cloud
    if (boltMesh.userData.auraPts && boltMesh.userData.auraBase) {
      const pos = boltMesh.userData.auraPts.geometry.attributes.position.array;
      const base = boltMesh.userData.auraBase;
      const n = base.length / 3;
      const spin = state.sprinting ? 11 : 2.5 + boltPowerS * 4;
      for (let i = 0; i < n; i++) {
        const ph = tAnim * spin + i * 0.7;
        const expand = 1 + boltPowerS * 0.35;
        pos[i * 3] = base[i * 3] * expand + Math.sin(ph) * 0.06;
        pos[i * 3 + 1] = base[i * 3 + 1] + Math.cos(ph * 1.3) * 0.07;
        pos[i * 3 + 2] = base[i * 3 + 2] * expand + Math.sin(ph * 0.9) * 0.05;
      }
      boltMesh.userData.auraPts.geometry.attributes.position.needsUpdate = true;
      if (boltMesh.userData.auraPts.material) {
        boltMesh.userData.auraPts.material.opacity =
          0.04 + boltPowerS * 0.45 + (state.howlT > 0 ? 0.2 : 0);
        boltMesh.userData.auraPts.material.size =
          0.12 + boltPowerS * 0.22 + (state.sprinting ? 0.08 : 0);
      }
    }
    // Purple mote cloud
    if (boltMesh.userData.auraPtsPurple && boltMesh.userData.auraBasePurple) {
      const pos2 = boltMesh.userData.auraPtsPurple.geometry.attributes.position.array;
      const base2 = boltMesh.userData.auraBasePurple;
      const n2 = base2.length / 3;
      for (let i = 0; i < n2; i++) {
        const ph = tAnim * (state.sprinting ? 8 : 2) + i * 0.9;
        const expand = 1 + boltPowerS * 0.4;
        pos2[i * 3] = base2[i * 3] * expand + Math.cos(ph) * 0.05;
        pos2[i * 3 + 1] = base2[i * 3 + 1] + Math.sin(ph * 1.1) * 0.06;
        pos2[i * 3 + 2] = base2[i * 3 + 2] * expand + Math.cos(ph * 0.8) * 0.04;
      }
      boltMesh.userData.auraPtsPurple.geometry.attributes.position.needsUpdate = true;
      if (boltMesh.userData.auraPtsPurple.material) {
        boltMesh.userData.auraPtsPurple.material.opacity =
          Math.max(0, (boltPowerS - 0.25) * 0.4) + state.resonance * 0.15;
        boltMesh.userData.auraPtsPurple.material.size = 0.1 + boltPowerS * 0.2;
      }
    }
    if (boltMesh.userData.eyes) {
      boltMesh.userData.eyes.forEach(function (eg) {
        if (eg.userData.iris && eg.userData.iris.material) {
          eg.userData.iris.material.emissiveIntensity =
            1.25 +
            stageGlow * 0.3 +
            boltPowerS * 0.7 +
            state.resonance * 0.4 +
            (state.howlT > 0 ? 0.55 : 0);
          // Cosmic eyes: more purple at high resonance
          if (state.resonance > 0.55 || boltPowerS > 0.75) {
            eg.userData.iris.material.emissive.setHex(0xa855f7);
          } else {
            eg.userData.iris.material.emissive.setHex(0x22d3ee);
          }
        }
        if (eg.userData.glow && eg.userData.glow.material) {
          eg.userData.glow.material.opacity =
            0.08 + boltPowerS * 0.2 + state.resonance * 0.1 + (state.sprinting ? 0.08 : 0);
        }
      });
    }
    if (boltLight) {
      const coreGlow = boltLight.userData.coreGlowMul != null ? boltLight.userData.coreGlowMul : 1;
      boltLight.intensity =
        (0.5 +
          boltPowerS * 0.7 +
          state.momentum * 0.3 +
          (state.howlT > 0 ? 0.45 : 0) +
          (state.sprinting ? 0.35 : 0)) *
        coreGlow;
      boltLight.color.setHex(0x22d3ee);
    }
    if (typeof boltLight2 !== "undefined" && boltLight2) {
      boltLight2.intensity = 0.25 + boltPowerS * 0.4 + state.momentum * 0.2 + (state.sprinting ? 0.25 : 0);
      boltLight2.color.setHex(0x67e8f9);
    }
    if (typeof boltLightPurple !== "undefined" && boltLightPurple) {
      // Only light purple when energy is up — never wash white fur pink at idle
      boltLightPurple.intensity =
        boltPowerS * 0.65 +
        Math.max(0, state.resonance - 0.4) * 0.35 +
        (state.howlT > 0 ? 0.3 : 0);
    }
    if (typeof boltKey !== "undefined" && boltKey) {
      boltKey.intensity = 0.48 + (state.sprinting ? 0.18 : 0) + boltPowerS * 0.1;
    }

    for (let i = 0; i < boostPads.length; i++) {
      const b = boostPads[i];
      b.cool = Math.max(0, b.cool - dt);
      b.ring.rotation.z += dt * 2;
      const d = Math.hypot(player.position.x - b.x, player.position.z - b.z);
      if (d < 2.8 && Math.abs(player.position.y - b.y) < 2.5 && b.cool <= 0) {
        const dir = new THREE.Vector3(Math.sin(yaw), 0.35, Math.cos(yaw)).normalize();
        state.vel.addScaledVector(dir, 22 + state.momentum * 12);
        state.momentum = Math.min(1, state.momentum + 0.25);
        b.cool = 1.1;
        toast("BOLT DRIVE BOOST ⚡");
        if (Sfx && Sfx.playBoost) Sfx.playBoost();
      }
    }

    for (let i = 0; i < sparks.length; i++) {
      const s = sparks[i];
      if (s.taken) continue;
      s.phase += dt * 3;
      s.mesh.position.y = s.y + Math.sin(s.phase) * 0.35;
      s.mesh.rotation.y += dt * 2;
      s.mesh.rotation.x += dt;
      if (player.position.distanceTo(s.mesh.position) < 1.8) {
        s.taken = true;
        s.mesh.visible = false;
        state.sparksCollected++;
        state.starCore = Math.min(100, state.starCore + 2.5 + state.intention * 2);
        state.resonance = Math.min(1, state.resonance + 0.05);
        if (Sfx && Sfx.playSpark) Sfx.playSpark();
        progress.stats.sparks = (progress.stats.sparks || 0) + 1;
        if (state.sparksCollected % 5 === 0) {
          toast("SPARKS ×" + state.sparksCollected + " — STAR CORE FEEDS");
        }
      }
    }

    // RuinGenerator loot + Decree recovery
    if (spawner.claimRuinLoot) {
      const loot = spawner.claimRuinLoot(player.position);
      if (loot) {
        state.starCore = Math.min(100, state.starCore + loot.core);
        state.resonance = Math.min(1, state.resonance + loot.resonance);
        state.momentum = Math.min(1, state.momentum + loot.power * 0.35);
        state.ruinsLooted = (state.ruinsLooted || 0) + 1;
        progress.stats.ruins = (progress.stats.ruins || 0) + 1;
        if (Sfx && Sfx.playLoot) Sfx.playLoot();
        const labels = {
          monolith: "MONOLITH RELIC",
          outpost: "OUTPOST CACHE",
          tower: "TOWER FRAGMENT",
          arch: "ARCH RUNESTONE",
          platform: "SKY PLATFORM CORE",
          temple: "TEMPLE STAR CORE",
          wreck: "WRECK ARTIFACT",
        };
        toast(
          (labels[loot.type] || "RUIN RELIC") +
            " ⚡ +" +
            loot.core.toFixed(0) +
            " CORE",
          2200
        );
        const decree = unlockDecree(
          loot.type,
          loot.biomeId || (spawner.currentBiome && spawner.currentBiome.id),
          loot.biomeName || (spawner.currentBiome && spawner.currentBiome.name)
        );
        if (decree) {
          if (Sfx && Sfx.playDecree) {
            setTimeout(function () { Sfx.playDecree(); }, 200);
          }
          setTimeout(function () {
            toast("DECREE: " + decree.title, 3200, "lore");
          }, 700);
          setTimeout(function () {
            toast(decree.body, 4500, "lore");
          }, 2000);
        }
      }
    }

    const speed = Math.hypot(state.vel.x, state.vel.z);

    momentumBuf[momentumIdx] = speed;
    momentumIdx = (momentumIdx + 1) % momentumBuf.length;
    let avgMom = 0;
    for (let i = 0; i < momentumBuf.length; i++) avgMom += momentumBuf[i];
    avgMom /= momentumBuf.length;
    const targetMom = THREE.MathUtils.clamp(avgMom / 30, 0, 1) * (state.sprinting ? 1 : 0.55);
    state.momentum = damp(state.momentum, Math.max(state.momentum * 0.98, targetMom), 2.5, dt);

    // Landmarks first (ruins / paths / citadel) for Intention destinations
    updateLandmarkMarkers(dt);

    // Intention: sprint toward landmarks OR citadel OR committed exploration
    const moveDir = speed > 0.5
      ? tmpV.set(state.vel.x, 0, state.vel.z).normalize()
      : forward;
    const toCore = tmpV2.set(-player.position.x, 0, -player.position.z);
    if (Math.hypot(player.position.x, player.position.z) > 1e-3) toCore.normalize();
    else toCore.set(0, 0, 1);
    const alignCore = Math.max(0, moveDir.dot(toCore));
    const towardCore = alignCore * (state.sprinting ? 1 : 0.5) * THREE.MathUtils.clamp(speed / 18, 0, 1);

    let towardLm = 0;
    const lm = state.nearestLandmark;
    if (lm && lm.dist > 3) {
      const toLm = new THREE.Vector3(lm.x - player.position.x, 0, lm.z - player.position.z);
      if (toLm.lengthSq() > 1e-4) {
        toLm.normalize();
        const alignLm = Math.max(0, moveDir.dot(toLm));
        towardLm =
          alignLm *
          (state.sprinting ? 1.15 : 0.55) *
          THREE.MathUtils.clamp(speed / 16, 0, 1) *
          (lm.kind === "ruin" ? 1.2 : lm.kind === "citadel" ? 0.9 : 0.75);
        // Accumulate purposeful sprint time toward landmarks (quest)
        if (state.sprinting && alignLm > 0.55 && speed > 8) {
          questState.towardLandmarkTime += dt;
        }
      }
    }
    state.towardLandmark = towardLm;

    const sustain = state.sprinting && speed > 10 ? 0.4 : 0;
    const explore = state.sprinting && speed > 12 ? 0.4 : 0;
    const intentionTarget = THREE.MathUtils.clamp(
      Math.max(towardLm, towardCore * 0.85, explore + sustain * 0.5),
      0,
      1
    );
    state.intention = damp(state.intention, intentionTarget, 3.2, dt);

    // Bonus Star Core when running with purpose toward a landmark
    if (state.sprinting && speed > 8) {
      const purposeBonus = 1 + towardLm * 0.85;
      const charge =
        (0.8 + state.intention * 2.2 + state.momentum * 1.5 + state.resonance * 1.2) *
        purposeBonus *
        dt;
      state.starCore = Math.min(100, state.starCore + charge);
    }

    // Gate open time for quests + lifetime
    if (state.gateOpen) {
      state.gateOpenTime += dt;
      progress.stats.gateTime = (progress.stats.gateTime || 0) + dt;
    }

    // Track biome visits for Pack Memory
    if (spawner && spawner.currentBiome) {
      noteBiomeVisit(spawner.currentBiome.id);
    }

    state.playTime = (state.playTime || 0) + dt;
    progress.stats.playTime = (progress.stats.playTime || 0) + dt;

    if (state.howlT > 0) state.howlT -= dt;
    if (state.recallCooldown > 0) state.recallCooldown = Math.max(0, state.recallCooldown - dt);
    const resTarget = THREE.MathUtils.clamp(
      state.momentum * 0.5 + (state.sprinting ? 0.2 : 0) + state.intention * 0.2,
      0,
      1
    );
    if (state.howlT <= 0) {
      state.resonance = damp(state.resonance, resTarget, 1.2, dt);
    }

    // Star Core stage (world multipliers + ceremony on rise)
    const coreStage = updateCoreStage();

    // Seamless scale shift FIRST (feeds spawner + physics feel)
    const surfaceY = openWorld.heightAt(player.position.x, player.position.z);
    const scaleInfo = openWorld.updateScale(speed, player.position.y, camera, scene, {
      momentum: state.momentum,
      sprinting: state.sprinting,
      coreBoost: (state.coreStageIndex || 0) / 4 + state.starCore / 200,
      dt: dt,
      surfaceY: surfaceY,
      onGround: state.onGround,
      ascentCommit: state.ascentCommit,
    });
    state.scaleStage = scaleInfo.stage;
    state.transitionProgress = scaleInfo.progress;
    state.scaleProps = scaleInfo.props;
    if (state.prevScaleStage !== state.scaleStage) {
      const labels = {
        paw: "PAW SCALE — surface detail returns",
        planetary: "PLANETARY SCALE — the world opens wide",
        orbital: "ORBITAL SCALE — the cosmos paints older works in the sky",
        solar: "SOLAR SCALE — planets become beacons",
        cosmic: "COSMIC SCALE — the Boltverse zooms to match you",
      };
      toast(labels[state.scaleStage] || ("SCALE · " + state.scaleStage.toUpperCase()), 2800, "lore");
      if (state.transitionProgress > 0.35) punchCam(0.2, 3);
      if (ui.scaleBadge) {
        ui.scaleBadge.classList.remove("flash");
        void ui.scaleBadge.offsetWidth;
        ui.scaleBadge.classList.add("flash");
      }
      if (state.scaleStage === "orbital" && Sfx && Sfx.playPackEvent) {
        try { Sfx.playPackEvent("starfall"); } catch (e) { /* optional */ }
      }
      state.prevScaleStage = state.scaleStage;
    }

    // Visual orbital cues: blacker sky, brighter stars, larger sky dome
    updateOrbitalAtmosphere(scaleInfo);

    // Procedural Spawning — Gate + Core + SCALE-aware generators
    state.meaningfulScore = spawner.update(dt, {
      speed: speed,
      momentum: state.momentum,
      intention: state.intention,
      velocity: state.vel,
      sprinting: state.sprinting,
      resonance: state.resonance,
      coreWorldMul: coreStage.worldMul,
      coreRuinBonus: coreStage.ruinBonus,
      coreDetailBonus: coreStage.detailBonus,
      coreStageId: coreStage.id,
      scaleStage: state.scaleStage,
      transitionProgress: state.transitionProgress,
      scaleProps: state.scaleProps,
    }, player.position, yaw);

    // Meaningful Gate ceremony (open / close threshold)
    updateMeaningfulGate(state.meaningfulScore);

    // Mini-quests progress
    updateQuestProgress();

    // Pack / Resonance world events
    updatePackEvents(dt);

    // Autosave every ~20s
    if (!updatePlayer._saveAcc) updatePlayer._saveAcc = 0;
    updatePlayer._saveAcc += dt;
    if (updatePlayer._saveAcc > 20) {
      updatePlayer._saveAcc = 0;
      updateProgressFromRun();
      saveProgress();
    }

    // Continuous audio layers (sprint hum + gate ambient + orbital emptiness)
    if (Sfx && Sfx.update) {
      Sfx.update({
        speed: speed,
        meaningful: state.meaningfulScore,
        sprinting: state.sprinting,
        gateOpen: state.gateOpen,
        coreStageIndex: state.coreStageIndex || 0,
        scaleStage: state.scaleStage,
        transitionProgress: state.transitionProgress || 0,
      });
    }

    // Lightning Core trail (ribbon + particles + arcs + echoes)
    const trailStage = coreStageFromCharge(state.starCore);
    const stageTrail = trailStage.boltGlow || 1;
    if (lightningTrail) {
      lightningTrail.update(dt, player.position, {
        meaningful: state.meaningfulScore,
        momentum: state.momentum,
        resonance: state.resonance,
        speed: speed,
        sprinting: state.sprinting,
        scaleStage: state.scaleStage,
        coreGlow: stageTrail,
        gateOpen: state.gateOpen,
      });
    }

    // Dual ring aura — cyan + purple, scales with Meaningful Sprint + resonance
    const aPower = THREE.MathUtils.clamp(
      (state.meaningfulScore || 0) * 0.55 +
        (state.momentum || 0) * 0.25 +
        (state.sprinting ? 0.2 : 0) +
        state.resonance * 0.35 +
        (state.howlT > 0 ? 0.3 : 0) +
        stageTrail * 0.08 +
        (state.packEventT > 0 ? 0.15 : 0),
      0,
      1.2
    );
    const aOp = aPower * 0.55;
    aura.material.opacity = aOp;
    aura.scale.setScalar(
      1 + aPower * 0.55 + Math.sin(performance.now() * 0.008) * 0.08
    );
    aura.rotation.z = performance.now() * 0.0012;
    if (typeof auraPurple !== "undefined" && auraPurple) {
      auraPurple.material.opacity = Math.max(0, (aPower - 0.2) * 0.4) + state.resonance * 0.2;
      auraPurple.scale.setScalar(1 + aPower * 0.7);
      auraPurple.rotation.z = -performance.now() * 0.0009;
    }
    if (auraDisc) {
      auraDisc.material.opacity = aOp * 0.4;
      auraDisc.scale.setScalar(1 + aPower * 0.5);
      auraDisc.material.color.setHex(aPower > 0.65 ? 0xa855f7 : 0x67e8f9);
    }

    // Juice FX tick
    updateConfetti(dt);
    updateJuiceRings(dt);
    if (juice.shake > 0) juice.shake = Math.max(0, juice.shake - dt * 2.8);
    if (juice.fovPunch > 0) juice.fovPunch = Math.max(0, juice.fovPunch - dt * 14);

    // Living Citadel animation + Star Core chamber
    if (citadel && citadel.update) {
      citadel.update(performance.now() * 0.001, dt);
    }
    const csNow = coreStageFromCharge(state.starCore);
    if (coreSphere && coreSphere.material) {
      coreSphere.material.emissiveIntensity =
        (1.6 + state.starCore * 0.012) * (csNow.coreGlow || 1);
    }
    if (citadel && citadel.coreLight) {
      citadel.coreLight.intensity =
        (3.5 + state.starCore * 0.06 + state.resonance * 2.5) * (csNow.coreGlow || 1);
    }
    if (coreLight) {
      coreLight.intensity =
        (0.8 + state.starCore * 0.03 + state.resonance) * (csNow.coreGlow || 1);
    }
    // Cyan rim — subtle pulse with power, never a second sun
    rim.intensity = 0.45 + state.momentum * 0.55 + csNow.worldMul * 0.35 + (state.sprinting ? 0.25 : 0);

    // —— Third-person chase cam: always locked on Bolt ——
    // Sits behind + above, looks at Bolt's chest. Mouse orbits around him.
    const distToCit = Math.hypot(player.position.x, player.position.z);
    const nearCitadel = distToCit < (citadel.scale || 5) * 50;
    const scaleCam = (state.scaleProps && state.scaleProps.camMul) || 1;
    const citCam = nearCitadel && state.transitionProgress < 0.35 ? 1.35 : 1;
    if (!isFinite(camZoom)) camZoom = 1;
    if (!isFinite(camZoomTarget)) camZoomTarget = 1;
    camZoom = damp(camZoom, camZoomTarget, 10, dt);
    // Comfortable 3rd-person distance (not extreme top-down)
    const camDist = Math.max(
      4.2,
      (9.2 - state.momentum * 0.85) * scaleCam * citCam * camZoom
    );
    const elev = THREE.MathUtils.clamp(
      isFinite(pitch) ? pitch : PITCH_DEFAULT,
      PITCH_MIN,
      PITCH_MAX
    );
    pitch = elev;
    // Soft auto-align camera behind Bolt when sprinting (still orbitable)
    if (state.sprinting && moveSpeed > 4 && boltMesh) {
      const wantYaw = boltMesh.rotation.y;
      let dY = wantYaw - yaw;
      while (dY > Math.PI) dY -= Math.PI * 2;
      while (dY < -Math.PI) dY += Math.PI * 2;
      // Gentle pull toward behind-character when not hard-looking opposite
      if (Math.abs(dY) < 2.2) {
        yaw = dampAngle(yaw, wantYaw, 1.8, dt);
      }
    }
    const cosE = Math.cos(elev);
    const sinE = Math.sin(elev);
    // Position: behind Bolt along -forward, raised by elevation
    const backX = -Math.sin(yaw) * cosE;
    const backZ = -Math.cos(yaw) * cosE;
    const focusY = 1.25;
    const shake = juice.shake;
    const sx = shake > 0 ? (Math.random() - 0.5) * shake * 1.2 : 0;
    const sy = shake > 0 ? (Math.random() - 0.5) * shake * 0.9 : 0;
    const sz = shake > 0 ? (Math.random() - 0.5) * shake * 1.2 : 0;
    const camTarget = tmpV.set(
      player.position.x + backX * camDist + sx,
      player.position.y + focusY + sinE * camDist * 0.95 + 0.35 + sy,
      player.position.z + backZ * camDist + sz
    );
    if (
      !isFinite(camera.position.x) ||
      !isFinite(camera.position.y) ||
      !isFinite(camera.position.z)
    ) {
      camera.position.copy(camTarget);
    } else {
      // Snappy follow so Bolt stays framed
      camera.position.lerp(camTarget, 1 - Math.exp(-12 * dt));
    }
    // Always look at Bolt (locked on character — not free-look into sky)
    const lookAt = tmpV2.set(
      player.position.x + sx * 0.15,
      player.position.y + focusY + 0.15 + sy * 0.15,
      player.position.z + sz * 0.15
    );
    camera.lookAt(lookAt);
    // Sky locked to FINAL camera pos (avoids sphere-limb "bubble" if updated earlier)
    if (reactiveSky && reactiveSky.group) {
      reactiveSky.group.position.copy(camera.position);
    } else if (skyDome) {
      skyDome.position.copy(camera.position);
    }
    if (cosmicStars && cosmicStars.group) {
      cosmicStars.group.position.copy(camera.position);
    } else if (starField && starField.position) {
      starField.position.copy(camera.position);
    }
    // Mild FOV kick only — large speed*0.45 + momentum*8 felt like camera “flying”
    const targetFov =
      juice.baseFov +
      Math.min(6, speed * 0.18) +
      state.momentum * 3.5 +
      juice.fovPunch +
      (state.packEventT > 0 ? 1.5 : 0);
    camera.fov = damp(camera.fov, targetFov, 6, dt);
    camera.updateProjectionMatrix();

    ui.barSprint.style.width = THREE.MathUtils.clamp((speed / 40) * 100, 0, 100) + "%";
    ui.barMomentum.style.width = state.momentum * 100 + "%";
    ui.barIntention.style.width = state.intention * 100 + "%";
    if (ui.barMeaningful) {
      ui.barMeaningful.style.width = state.meaningfulScore * 100 + "%";
      // Gate color: below threshold dim, above bright
      ui.barMeaningful.style.opacity = state.meaningfulScore >= 0.65 ? "1" : "0.55";
    }
    ui.barCore.style.width = state.starCore + "%";
    ui.barResonance.style.width = state.resonance * 100 + "%";
    ui.valSpeed.textContent = speed.toFixed(1) + " u/s";
    ui.valMomentum.textContent = Math.round(state.momentum * 100) + "%";
    if (state.towardLandmark > 0.45 && state.nearestLandmark) {
      const t = state.nearestLandmark.type || state.nearestLandmark.kind || "MARK";
      ui.valIntention.textContent =
        "→ " + String(t).toUpperCase().slice(0, 10);
    } else {
      ui.valIntention.textContent =
        state.intention > 0.65 ? "PURPOSIVE" : state.intention > 0.3 ? "SEEKING" : "DRIFT";
    }
    if (ui.valMeaningful) {
      const gate = state.meaningfulScore >= GATE_THRESHOLD ? "OPEN" : "GATE";
      ui.valMeaningful.textContent = Math.round(state.meaningfulScore * 100) + "% " + gate;
    }
    ui.valCore.textContent = state.starCore.toFixed(0) + "%";
    if (ui.valCoreStage) {
      const cs = coreStageFromCharge(state.starCore);
      ui.valCoreStage.textContent = cs.name;
    }
    ui.valResonance.textContent = Math.round(state.resonance * 100) + "%";

    // Planet approach HUD (distance + ETA)
    updatePlanetNavHud();

    // Dedicated Scale Indicator (Surface → Planetary → Orbital…)
    if (ui.scaleBadge && ui.scaleBadgeName) {
      const st = state.scaleStage || "paw";
      const names = {
        paw: "PAW",
        planetary: "PLANETARY",
        orbital: "ORBITAL",
        solar: "SOLAR",
        cosmic: "COSMIC",
      };
      const metas = {
        paw: "surface · dense",
        planetary: "wide world · rich",
        orbital: "sky monuments · sparse",
        solar: "planets as beacons",
        cosmic: "Boltverse zoom",
      };
      ui.scaleBadgeName.textContent = names[st] || st.toUpperCase();
      if (ui.scaleBadgeMeta) {
        const alt = Math.max(0, player.position.y - openWorld.heightAt(player.position.x, player.position.z));
        let meta =
        (metas[st] || st) +
        " · alt " + Math.round(alt) +
        " · " + Math.round((state.transitionProgress || 0) * 100) + "%";
      if (state.currentPlanet) {
        meta =
          (state.currentPlanet.short || state.currentPlanet.name) +
          " · surface";
      }
      ui.scaleBadgeMeta.textContent = meta;
      }
      ui.scaleBadge.className =
        "scale-badge scale-" + st + (ui.scaleBadge.classList.contains("flash") ? " flash" : "");
    }

    if (spawnStatsEl) {
      const f = spawner.factors;
      const dist = Math.hypot(player.position.x, player.position.z);
      const bioName = (biomeAtmo && biomeAtmo.displayName) || f.biome || "BIOME";
      const pt = f.paths || {};
      const tt = f.terrain || {};
      const vt = f.vegetation || {};
      const rt = f.ruins || {};
      const pathSum = (pt.energy || 0) + (pt.branch || 0) + (pt.shortcut || 0) + (pt.hidden || 0);
      const terrSum =
        (tt.boulders || 0) + (tt.ridge || 0) + (tt.crater || 0) + (tt.cliff || 0) +
        (tt.floater || 0) + (tt.landmark || 0) + (tt.canyon || 0);
      const landmarkN = (tt.landmark || 0) + (tt.canyon || 0);
      const vegSum =
        (vt.stalk || 0) + (vt.flower || 0) + (vt.bush || 0) + (vt.vine || 0) +
        (vt.cluster || 0) + (vt.floater || 0) + (vt.canopy || 0) +
        (vt.tree || 0) + (vt.megaTree || 0) + (vt.spire || 0) +
        (vt.forest || 0);
      const forestN = vt.forest || 0;
      const ruinSum =
        (rt.monolith || 0) + (rt.outpost || 0) + (rt.tower || 0) + (rt.arch || 0) +
        (rt.platform || 0) + (rt.temple || 0) + (rt.wreck || 0);
      const dt = f.details || {};
      const detSum =
        (dt.crystals || 0) + (dt.vent || 0) + (dt.shaft || 0) + (dt.motes || 0) +
        (dt.debris || 0) + (dt.scorch || 0) + (dt.residue || 0) + (dt.footprints || 0);
      const orbitTag = (state.scaleStage === "orbital" || state.scaleStage === "solar" || state.scaleStage === "cosmic")
        ? " · 🌌 ORBIT"
        : "";
      let debrisTag = "";
      if (orbitalDebris && orbitalDebris.count > 0) {
        const ds = orbitalDebris.getStats();
        debrisTag =
          " · debris " +
          ds.active +
          (ds.broken ? " 💥" + ds.broken : "") +
          (ds.assists ? " ⚡" + ds.assists : "");
      }
      const bandTag = f.sceneBand
        ? " · " + String(f.sceneBand).toUpperCase()
        : "";
      const forestTag = forestN > 0 ? " · forests " + forestN : "";
      const landTag = landmarkN > 0 ? " · landmarks " + landmarkN : "";
      const sceneTag = f.scenes > 0 ? " · scenes " + f.scenes : "";
      spawnStatsEl.textContent =
        "◈ " + bioName +
        " · " + (state.scaleStage || "paw").toUpperCase() +
        " " + Math.round((state.transitionProgress || 0) * 100) + "%" +
        orbitTag +
        debrisTag +
        " · " + Math.round(dist) + "m" +
        " · paths " + pathSum +
        " · terrain " + terrSum +
        landTag +
        " · flora " + vegSum +
        forestTag +
        sceneTag +
        " · ruins " + ruinSum +
        " · detail " + detSum +
        " · dens " + Math.round(f.density * 100) + "%" +
        bandTag +
        " · core " + (state.coreStageId || "spark").toUpperCase() +
        (f.coreWorldMul > 0.01 ? " +" + Math.round(f.coreWorldMul * 100) + "%w" : "") +
        (f.flux > 0.05 ? " · FLUX" : "");
    }
  }

  /**
   * Orbital visual feedback — black sky, bright stars, spherical home planet,
   * thinner atmosphere. Progressive with scale (no hard cut).
   */
  function updateOrbitalAtmosphere(scaleInfo) {
    const props = (scaleInfo && scaleInfo.props) || state.scaleProps || {};
    const skyDark = props.skyDark != null ? props.skyDark : 0;
    const starBoost = props.starBoost != null ? props.starBoost : 1;
    const st = (scaleInfo && scaleInfo.stage) || state.scaleStage || "paw";
    const orbital = st === "orbital" || st === "solar" || st === "cosmic";

    // How high above the flat surface (drives planet reveal + curvature)
    const surfaceY = openWorld.heightAt(player.position.x, player.position.z);
    const heightAbove = Math.max(0, player.position.y - surfaceY);
    const altReveal = THREE.MathUtils.clamp((heightAbove - 8) / 55, 0, 1);
    // planetVis from scale props + altitude (must climb to see the sphere)
    let planetVis = props.planetVis != null ? props.planetVis : 0;
    if (state.ascentCommit || orbital) {
      planetVis = Math.max(planetVis, altReveal * (orbital ? 1 : 0.75));
    } else {
      planetVis = 0; // stay grounded — no planet peek on hops
    }
    // Only show sphere once you're high enough that flat ground is fading
    if (heightAbove < 12 && !orbital) planetVis *= 0.15;

    // Background + fog tint toward deep space
    if (scene.background && scene.background.isColor) {
      scene.background.copy(baseBgColor).lerp(orbitalBgColor, Math.max(skyDark, planetVis * 0.7));
    }
    if (scene.fog && scene.fog.color) {
      scene.fog.color.copy(baseFogColor).lerp(orbitalFogColor, Math.max(skyDark, planetVis * 0.65));
    }
    // Clearer view of planet limb — reduce fog density with altitude
    if (scene.fog && scene.fog.density != null && planetVis > 0.15) {
      const clearFog = THREE.MathUtils.lerp(scene.fog.density, 0.00025, planetVis * 0.35);
      scene.fog.density = Math.min(scene.fog.density, clearFog);
    }

    // Reactive sky (tiers 1–5) OR legacy starfield
    {
      const dark = Math.max(skyDark, planetVis * 0.8);
      const sb = Math.max(starBoost, 1 + dark * 1.4);
      const altN = THREE.MathUtils.clamp(heightAbove / 80, 0, 1);
      const coreAmt = THREE.MathUtils.clamp((state.starCore || 0) / 100, 0, 1);
      if (reactiveSky && reactiveSky.update) {
        const packDrive =
          state.packEventT > 0
            ? Math.min(1, state.packEventT * 0.15 + 0.45)
            : 0;
        reactiveSky.update({
          dt: 0.016,
          cameraPos: camera.position,
          playerPos: player.position,
          velocity: state.vel,
          sprint: !!state.sprinting,
          momentum: state.momentum || 0,
          speed: Math.hypot(state.vel.x, state.vel.z),
          scale: scaleInfo && scaleInfo.progress != null ? scaleInfo.progress : state.transitionProgress || 0,
          stage: st,
          skyDark: dark,
          starBoost: sb,
          resonance: state.resonance || 0,
          meaningful: state.meaningfulScore || 0,
          altitude: altN,
          planetVis: planetVis,
          biomeId: (biomeAtmo && biomeAtmo.currentId) || "crystalNebula",
          // Rim/ambient — saturated; never near-black sky hex
          biomeTint: biomeAtmo && biomeAtmo.rim,
          howl: state.howlT > 0 ? Math.min(1, state.howlT * 2) : 0,
          core: coreAmt,
          pack: packDrive,
        });
      } else if (cosmicStars && cosmicStars.update) {
        cosmicStars.update(player.position, sb, 0.016, {
          sprint: state.sprinting ? 1 : state.momentum || 0,
          biomeId: biomeAtmo && biomeAtmo.currentId,
          scale: state.transitionProgress || 0,
          velocity: state.vel,
        });
      } else {
        if (starFieldMat) {
          const targetOp = THREE.MathUtils.clamp(0.55 + dark * 0.55 * starBoost * 0.5, 0.5, 1);
          const targetSize = 0.9 + dark * 1.4 * Math.min(starBoost, 2.2);
          starFieldMat.opacity = THREE.MathUtils.lerp(starFieldMat.opacity, targetOp, 0.08);
          starFieldMat.size = THREE.MathUtils.lerp(starFieldMat.size, targetSize, 0.08);
        }
        if (starField && starField.position && player) {
          starField.position.copy(player.position);
        }
      }
    }

    // HOME PLANET — detailed sphere under Bolt (the world you left)
    if (homePlanet && homePlanet.update) {
      homePlanet.update(player.position, surfaceY, planetVis, 0.016);
    }
    // COMPANION WORLDS — other planets as sky beacons (Solar+)
    if (distantPlanets && distantPlanets.update) {
      distantPlanets.update(
        player.position,
        st,
        scaleInfo && scaleInfo.progress != null ? scaleInfo.progress : state.transitionProgress,
        0.016
      );
    }

    // Legacy dome scale only if not using reactive sky
    if (skyDome && !reactiveSky) {
      const targetScale = orbital || planetVis > 0.4 ? 6.5 + skyDark * 2.5 : 1 + skyDark * 0.8;
      const s = skyDome.scale.x;
      const ns = THREE.MathUtils.lerp(s, targetScale, 0.06);
      skyDome.scale.setScalar(ns);
      if (player) skyDome.position.copy(player.position);
      if (skyDome.material && skyDome.material.color) {
        const dim = 1 - Math.max(skyDark, planetVis * 0.5) * 0.55;
        skyDome.material.color.setRGB(dim, dim, Math.min(1, dim * 1.05));
      }
    }

    // Flat ground fade is handled by openworld groundOp (→0 in orbit).
    // Home planet sphere is the curved world you left behind.

    // Balanced lights by scale (surface readable; orbit dark but not muddy)
    if (lights && lights.hemi) {
      lights.hemi.intensity = THREE.MathUtils.lerp(
        lights.hemi.intensity,
        orbital ? 0.3 : 0.48,
        0.05
      );
    }
    if (sun) {
      sun.intensity = THREE.MathUtils.lerp(sun.intensity, orbital ? 1.05 : 1.15, 0.05);
      // Key follows player for planet terminator + distant worlds
      if ((orbital || planetVis > 0.25) && player) {
        sun.position.set(
          player.position.x + 420,
          player.position.y + 680,
          player.position.z + 280
        );
      }
    }
    // Keep exposure restrained so hero + white materials stay readable
    if (orbital) {
      renderer.toneMappingExposure = THREE.MathUtils.lerp(
        renderer.toneMappingExposure,
        1.05,
        0.04
      );
    } else {
      renderer.toneMappingExposure = THREE.MathUtils.lerp(
        renderer.toneMappingExposure,
        1.02,
        0.04
      );
    }
    // Cinematic grade by scale (vignette + sat; bloom stays selective)
    if (bloom && bloom.setGrade) {
      if (orbital) {
        bloom.setGrade({
          vignette: 0.32,
          saturation: 1.05,
          contrast: 1.08,
          bloomStrength: 0.58,
        });
      } else if (st === "planetary") {
        bloom.setGrade({
          vignette: 0.36,
          saturation: 1.1,
          contrast: 1.06,
          bloomStrength: 0.5,
        });
      } else {
        bloom.setGrade({
          vignette: 0.4,
          saturation: 1.08,
          contrast: 1.05,
          bloomStrength: 0.48,
        });
      }
    }
  }

  function animateWorld(t) {
    for (let i = 0; i < nebulae.length; i++) nebulae[i].rotation.z = t * 0.02;
    for (let i = 0; i < boostPads.length; i++) {
      const b = boostPads[i];
      b.mesh.material.emissiveIntensity = 0.9 + Math.sin(t * 4 + b.x) * 0.4;
    }
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------
  function togglePause() {
    paused = !paused;
    pauseEl.classList.toggle("hidden", !paused);
    if (paused) {
      if (document.exitPointerLock) document.exitPointerLock();
      lookDragging = false;
      updatePauseStats();
      updateProgressFromRun();
      saveProgress();
    } else {
      tryPointerLock();
      clock.getDelta();
    }
  }

  function startGame() {
    boot.classList.add("hidden");
    hud.classList.remove("hidden");
    started = true;
    paused = false;
    resetThirdPersonCam();
    // Align camera behind spawn facing
    if (boltMesh) yaw = boltMesh.rotation.y;
    tryPointerLock();
    // Retry lock once — some browsers need a second gesture frame
    setTimeout(tryPointerLock, 120);
    progress.stats.runs = (progress.stats.runs || 0) + 1;
    // Legacy of the Pack: remembered Core stage soft-starts Resonance
    if (progress.bestCoreIndex >= 2) {
      state.resonance = Math.max(state.resonance, 0.12);
    }
    if (progress.bestCoreIndex >= 3) {
      state.starCore = Math.max(state.starCore, 5);
    }
    saveProgress();

    // Unlock Web Audio on user gesture
    if (Sfx && Sfx.start) {
      Sfx.start().then(function () {
        toast("STARBOLTSPRINT — WHITE SHEPHERD ONLINE ⚡🐺", 2800);
      }).catch(function () {
        toast("STARBOLTSPRINT — WHITE SHEPHERD ONLINE ⚡🐺", 2800);
      });
    } else {
      toast("STARBOLTSPRINT — WHITE SHEPHERD ONLINE ⚡🐺", 2800);
    }
    if (progress.bestCoreIndex > 0) {
      setTimeout(function () {
        toast(
          "Pack Memory: best stage " +
            (progress.bestCoreStage || "spark").toUpperCase() +
            " · " +
            progress.decrees.length +
            " decrees kept",
          3800,
          "lore"
        );
      }, 1500);
    }
    setTimeout(function () {
      startNextQuest();
    }, 1200);
    setTimeout(function () {
      toast("You stand at the Thunderwolf Citadel gates. Explore the halls.", 4000, "lore");
    }, 4200);
    setTimeout(function () {
      toast("Press R anytime to Resonance Recall home (cooldown).", 3800, "lore");
    }, 7800);
    clock.start();
  }

  startBtn.addEventListener("click", startGame);
  resumeBtn.addEventListener("click", function () {
    if (paused) togglePause();
  });
  canvas.addEventListener("click", function () {
    if (started && !paused) tryPointerLock();
  });

  // Pause GPU work when the tab is hidden (same visuals when you return)
  let pageVisible = typeof document !== "undefined" ? !document.hidden : true;
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", function () {
      pageVisible = !document.hidden;
      if (pageVisible && clock && clock.getDelta) {
        // Drop huge dt after AFK so physics doesn't explode
        clock.getDelta();
      }
    });
  }

  // Reused temps — avoid GC spikes in the Bolt energy loop
  const _furCyan = new THREE.Color(0xcff9ff);
  const _furPurple = new THREE.Color(0xe9d5ff);
  const _furWhite = new THREE.Color(0xffffff);
  const _furEmTmp = new THREE.Color();

  function frame() {
    requestAnimationFrame(frame);
    // Free GPU: do not render or simulate while the tab is in the background
    if (!pageVisible) return;

    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    if (started && !paused) {
      try {
        updatePlayer(dt);
      } catch (errFrame) {
        console.error("updatePlayer", errFrame);
        // Emergency camera: stay on Bolt so the game remains playable
        if (player && camera) {
          camera.position.set(
            player.position.x - Math.sin(yaw) * 10,
            player.position.y + 5,
            player.position.z - Math.cos(yaw) * 10
          );
          camera.lookAt(
            player.position.x,
            player.position.y + 1.2,
            player.position.z
          );
        }
      }
    } else if (!started) {
      camera.position.set(Math.sin(t * 0.15) * 35, 18, Math.cos(t * 0.15) * 35);
      camera.lookAt(0, 8, 0);
      if (starCoreGroup) starCoreGroup.rotation.y = t * 0.3;
    }

    // Boot orbit only needs light work; in-game skip nebula spin when paused
    if (!paused) animateWorld(t);

    // Selective energy bloom (cyan trails/eyes) — not full-screen white wash
    if (bloom && bloom.render) {
      bloom.render();
    } else {
      renderer.render(scene, camera);
    }
  }

  frame();
  console.log(
    "%cBOLT ENGINE v2.4 · MAX — fixed high graphics + free GPU opts (no quality loss)",
    "color:#34d399;font-weight:bold"
  );
  } catch (err) {
    console.error(err);
    if (statusEl) {
      statusEl.textContent = "Game error: " + (err && err.message ? err.message : String(err));
      statusEl.style.color = "#f87171";
    }
    alert("BOLT ENGINE error:\n" + (err && err.message ? err.message : String(err)));
  }
})();
