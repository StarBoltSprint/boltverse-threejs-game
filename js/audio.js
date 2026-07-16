/**
 * BOLT ENGINE — Procedural audio (Web Audio API)
 * No external files — works offline / file://
 * Sprint hum · Gate · Howl · Loot/Decree · Core stage · Boost/Spark
 */
(function (global) {
  "use strict";

  let ctx = null;
  let master = null;
  let muted = false;
  let started = false;

  // Continuous layers
  let humOsc = null;
  let humOsc2 = null;
  let humGain = null;
  let humFilter = null;
  let ambientOsc = null;
  let ambientGain = null;

  function ensure() {
    if (ctx) return ctx;
    const AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
    return ctx;
  }

  function resume() {
    ensure();
    if (!ctx) return Promise.resolve();
    if (ctx.state === "suspended") return ctx.resume();
    return Promise.resolve();
  }

  function now() {
    return ctx ? ctx.currentTime : 0;
  }

  function envGain(peak, attack, hold, release, startT) {
    const g = ctx.createGain();
    const t0 = startT != null ? startT : now();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), t0 + attack);
    g.gain.setValueAtTime(Math.max(0.0001, peak), t0 + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + release);
    g.connect(master);
    return g;
  }

  function tone(freq, type, peak, attack, hold, release, detune) {
    if (!ctx || muted) return;
    const t0 = now();
    const o = ctx.createOscillator();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, t0);
    if (detune) o.detune.setValueAtTime(detune, t0);
    const g = envGain(peak, attack, hold, release, t0);
    o.connect(g);
    o.start(t0);
    o.stop(t0 + attack + hold + release + 0.05);
  }

  function noiseBurst(peak, attack, hold, release, filterFreq, q) {
    if (!ctx || muted) return;
    const t0 = now();
    const len = Math.ceil(ctx.sampleRate * (attack + hold + release + 0.05));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = filterFreq || 800;
    f.Q.value = q != null ? q : 1.2;
    const g = envGain(peak, attack, hold, release, t0);
    src.connect(f);
    f.connect(g);
    src.start(t0);
  }

  // ---- Public one-shots ----
  function playGateOpen() {
    if (!ctx || muted) return;
    // Rising crystal swell
    tone(220, "sine", 0.12, 0.02, 0.05, 0.45);
    tone(330, "sine", 0.1, 0.04, 0.08, 0.5);
    tone(440, "triangle", 0.09, 0.06, 0.1, 0.55);
    tone(660, "sine", 0.07, 0.1, 0.12, 0.6);
    tone(880, "sine", 0.05, 0.15, 0.1, 0.7);
    noiseBurst(0.04, 0.01, 0.05, 0.4, 1200, 0.8);
  }

  function playGateClose() {
    if (!ctx || muted) return;
    tone(440, "sine", 0.08, 0.01, 0.05, 0.35);
    tone(330, "triangle", 0.07, 0.04, 0.06, 0.4);
    tone(220, "sine", 0.09, 0.08, 0.08, 0.55);
    tone(165, "sine", 0.06, 0.12, 0.1, 0.6);
  }

  function playHowl() {
    if (!ctx || muted) return;
    const t0 = now();
    // Dual howl sweep — Resonance voice
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    o1.type = "sawtooth";
    o2.type = "sine";
    o1.frequency.setValueAtTime(180, t0);
    o1.frequency.exponentialRampToValueAtTime(420, t0 + 0.35);
    o1.frequency.exponentialRampToValueAtTime(280, t0 + 0.85);
    o2.frequency.setValueAtTime(360, t0);
    o2.frequency.exponentialRampToValueAtTime(640, t0 + 0.4);
    o2.frequency.exponentialRampToValueAtTime(400, t0 + 0.9);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(900, t0);
    f.frequency.exponentialRampToValueAtTime(1800, t0 + 0.3);
    f.frequency.exponentialRampToValueAtTime(700, t0 + 0.9);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.14, t0 + 0.08);
    g.gain.exponentialRampToValueAtTime(0.1, t0 + 0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.05);
    o1.connect(f);
    o2.connect(f);
    f.connect(g);
    g.connect(master);
    o1.start(t0);
    o2.start(t0);
    o1.stop(t0 + 1.1);
    o2.stop(t0 + 1.1);
    noiseBurst(0.03, 0.02, 0.15, 0.5, 600, 0.6);
  }

  function playLoot() {
    if (!ctx || muted) return;
    // Gold sparkle
    tone(523.25, "sine", 0.1, 0.005, 0.04, 0.2);
    tone(659.25, "sine", 0.09, 0.02, 0.05, 0.25);
    tone(783.99, "triangle", 0.07, 0.04, 0.06, 0.3);
  }

  function playDecree() {
    if (!ctx || muted) return;
    // Soft temple chime
    tone(392, "sine", 0.09, 0.01, 0.08, 0.55);
    tone(494, "sine", 0.07, 0.05, 0.1, 0.65);
    tone(587, "triangle", 0.06, 0.1, 0.12, 0.75);
    tone(784, "sine", 0.04, 0.15, 0.15, 0.9);
  }

  function playCoreStage(stageIndex) {
    if (!ctx || muted) return;
    const base = 261.63 + (stageIndex || 0) * 40;
    tone(base, "sine", 0.1, 0.02, 0.1, 0.5);
    tone(base * 1.25, "triangle", 0.08, 0.06, 0.12, 0.55);
    tone(base * 1.5, "sine", 0.06, 0.12, 0.15, 0.7);
    tone(base * 2, "sine", 0.04, 0.18, 0.2, 0.85);
    noiseBurst(0.035, 0.01, 0.08, 0.5, 900 + stageIndex * 100, 1);
  }

  function playBoost() {
    if (!ctx || muted) return;
    const t0 = now();
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(90, t0);
    o.frequency.exponentialRampToValueAtTime(320, t0 + 0.18);
    const g = envGain(0.08, 0.01, 0.05, 0.2, t0);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 1400;
    o.connect(f);
    f.connect(g);
    o.start(t0);
    o.stop(t0 + 0.3);
    noiseBurst(0.05, 0.005, 0.04, 0.15, 2000, 0.5);
  }

  function playSpark() {
    if (!ctx || muted) return;
    tone(880 + Math.random() * 200, "sine", 0.06, 0.002, 0.02, 0.12);
    tone(1320 + Math.random() * 100, "triangle", 0.04, 0.01, 0.02, 0.1);
  }

  function playJump() {
    if (!ctx || muted) return;
    const t0 = now();
    const o = ctx.createOscillator();
    o.type = "square";
    o.frequency.setValueAtTime(140, t0);
    o.frequency.exponentialRampToValueAtTime(280, t0 + 0.12);
    const g = envGain(0.05, 0.005, 0.03, 0.1, t0);
    o.connect(g);
    o.start(t0);
    o.stop(t0 + 0.18);
  }

  function playStart() {
    if (!ctx || muted) return;
    tone(196, "sine", 0.08, 0.02, 0.1, 0.4);
    tone(247, "sine", 0.07, 0.08, 0.1, 0.45);
    tone(294, "triangle", 0.06, 0.14, 0.12, 0.5);
    tone(392, "sine", 0.05, 0.2, 0.15, 0.6);
  }

  /** Resonance Recall — lightning return home */
  function playRecall() {
    if (!ctx || muted) return;
    const t0 = now();
    // Rising whoosh + crystal snap
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(80, t0);
    o.frequency.exponentialRampToValueAtTime(900, t0 + 0.35);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(400, t0);
    f.frequency.exponentialRampToValueAtTime(2400, t0 + 0.3);
    const g = envGain(0.12, 0.02, 0.12, 0.35, t0);
    o.connect(f);
    f.connect(g);
    o.start(t0);
    o.stop(t0 + 0.55);
    tone(523, "sine", 0.08, 0.25, 0.05, 0.4);
    tone(784, "triangle", 0.06, 0.3, 0.08, 0.45);
    noiseBurst(0.06, 0.01, 0.08, 0.3, 1500, 0.7);
  }

  /** Pack / Resonance world events */
  function playPackEvent(kind) {
    if (!ctx || muted) return;
    kind = kind || "bloom";
    if (kind === "fluxStorm") {
      noiseBurst(0.08, 0.02, 0.25, 0.6, 400, 0.5);
      tone(80, "sawtooth", 0.1, 0.05, 0.2, 0.8);
      tone(120, "sawtooth", 0.07, 0.1, 0.25, 0.9);
      tone(55, "sine", 0.09, 0.02, 0.3, 1.0);
    } else if (kind === "packCall") {
      // Answer to howl — layered voices
      tone(220, "sine", 0.1, 0.05, 0.2, 0.7);
      tone(330, "triangle", 0.08, 0.1, 0.25, 0.8);
      tone(440, "sine", 0.06, 0.15, 0.3, 0.9);
      tone(165, "sine", 0.07, 0.08, 0.4, 1.0);
    } else if (kind === "starfall") {
      for (let i = 0; i < 5; i++) {
        const f = 600 + i * 120 + Math.random() * 80;
        const t0 = now() + i * 0.08;
        const o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.setValueAtTime(f, t0);
        o.frequency.exponentialRampToValueAtTime(f * 0.5, t0 + 0.35);
        const g = envGain(0.05, 0.01, 0.05, 0.3, t0);
        o.connect(g);
        o.start(t0);
        o.stop(t0 + 0.4);
      }
    } else {
      // resonanceBloom default
      tone(262, "sine", 0.09, 0.03, 0.15, 0.6);
      tone(330, "sine", 0.07, 0.08, 0.2, 0.7);
      tone(392, "triangle", 0.06, 0.12, 0.25, 0.85);
      tone(523, "sine", 0.05, 0.18, 0.2, 1.0);
      noiseBurst(0.04, 0.01, 0.1, 0.5, 1400, 0.7);
    }
  }

  // ---- Continuous sprint hum + ambient ----
  function ensureHum() {
    if (!ctx || humOsc) return;
    humFilter = ctx.createBiquadFilter();
    humFilter.type = "lowpass";
    humFilter.frequency.value = 400;
    humFilter.Q.value = 0.7;

    humGain = ctx.createGain();
    humGain.gain.value = 0.0001;

    humOsc = ctx.createOscillator();
    humOsc.type = "sawtooth";
    humOsc.frequency.value = 55;
    humOsc2 = ctx.createOscillator();
    humOsc2.type = "sine";
    humOsc2.frequency.value = 110;

    humOsc.connect(humFilter);
    humOsc2.connect(humFilter);
    humFilter.connect(humGain);
    humGain.connect(master);
    humOsc.start();
    humOsc2.start();

    ambientOsc = ctx.createOscillator();
    ambientOsc.type = "sine";
    ambientOsc.frequency.value = 80;
    ambientGain = ctx.createGain();
    ambientGain.gain.value = 0.0001;
    ambientOsc.connect(ambientGain);
    ambientGain.connect(master);
    ambientOsc.start();
  }

  /**
   * Update continuous layers from gameplay state
   * @param {{speed:number, meaningful:number, sprinting:boolean, gateOpen:boolean, coreStageIndex:number, scaleStage?:string, transitionProgress?:number}} p
   */
  function update(p) {
    if (!ctx || !started || muted) {
      if (humGain) humGain.gain.setTargetAtTime(0.0001, now(), 0.08);
      if (ambientGain) ambientGain.gain.setTargetAtTime(0.0001, now(), 0.12);
      return;
    }
    ensureHum();
    const t = now();
    const speed = p.speed || 0;
    const meaningful = p.meaningful || 0;
    const sprinting = !!p.sprinting;
    const gateOpen = !!p.gateOpen;
    const stage = p.coreStageIndex || 0;
    const scaleSt = p.scaleStage || "paw";
    const tp = p.transitionProgress != null ? p.transitionProgress : 0;
    const orbital =
      scaleSt === "orbital" || scaleSt === "solar" || scaleSt === "cosmic";
    // How "space empty" vs atmosphere — ramps with scale progress
    const spaceAmt = orbital
      ? 0.55 + Math.min(0.45, tp)
      : Math.max(0, (tp - 0.28) * 1.4);

    // Hum intensity: speed + meaningful + sprint; thinner in orbit
    const humTarget = muted
      ? 0.0001
      : Math.min(
          0.12,
          ((sprinting ? 0.035 : 0.008) +
            (speed / 40) * 0.05 +
            meaningful * 0.045 +
            (gateOpen ? 0.015 : 0)) *
            (1 - spaceAmt * 0.35)
        );
    humGain.gain.setTargetAtTime(Math.max(0.0001, humTarget), t, 0.08);

    // Surface: warm low hum. Orbit: higher, thinner energy drone
    const baseFreq =
      48 +
      speed * 1.8 +
      meaningful * 40 +
      stage * 6 +
      spaceAmt * 55;
    humOsc.frequency.setTargetAtTime(baseFreq, t, 0.1);
    humOsc2.frequency.setTargetAtTime(baseFreq * (orbital ? 2.4 : 2.01), t, 0.1);
    humFilter.frequency.setTargetAtTime(
      350 + speed * 18 + meaningful * 400 + spaceAmt * 900,
      t,
      0.12
    );

    // Soft ambient pad — Gate open, or low orbital emptiness hum
    let ambTarget = 0.0001;
    if (!muted) {
      if (gateOpen) ambTarget = 0.025 + meaningful * 0.02 + stage * 0.004;
      if (orbital) ambTarget = Math.max(ambTarget, 0.012 + spaceAmt * 0.018);
    }
    ambientGain.gain.setTargetAtTime(Math.max(0.0001, ambTarget), t, 0.25);
    ambientOsc.frequency.setTargetAtTime(
      (orbital ? 42 : 70) + stage * 8 + meaningful * 20 + spaceAmt * 30,
      t,
      0.2
    );
  }

  function setMuted(m) {
    muted = !!m;
    if (master && ctx) {
      master.gain.setTargetAtTime(muted ? 0.0001 : 0.55, now(), 0.05);
    }
  }

  function toggleMute() {
    setMuted(!muted);
    return muted;
  }

  function isMuted() {
    return muted;
  }

  function start() {
    started = true;
    return resume().then(function () {
      ensureHum();
      playStart();
    });
  }

  global.BoltAudio = {
    start: start,
    resume: resume,
    update: update,
    playGateOpen: playGateOpen,
    playGateClose: playGateClose,
    playHowl: playHowl,
    playLoot: playLoot,
    playDecree: playDecree,
    playCoreStage: playCoreStage,
    playBoost: playBoost,
    playSpark: playSpark,
    playJump: playJump,
    playStart: playStart,
    playRecall: playRecall,
    playPackEvent: playPackEvent,
    setMuted: setMuted,
    toggleMute: toggleMute,
    isMuted: isMuted,
  };
})(typeof window !== "undefined" ? window : globalThis);
