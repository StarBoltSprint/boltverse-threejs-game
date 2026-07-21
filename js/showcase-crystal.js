/**
 * STARBOLTSPRINT — Crystal Nebula lore showcase
 * Cinematic neon Three.js strip (Crayon/Tron-demo energy, Boltverse lore).
 * Offline · uses global THREE from three.min.js
 */
(function () {
  "use strict";

  if (typeof THREE === "undefined") {
    console.error("three.min.js missing");
    return;
  }

  const canvas = document.getElementById("c");
  const loreEl = document.getElementById("lore");
  const hudEl = document.getElementById("hud");
  const enterBtn = document.getElementById("enter-btn");
  const tickerEl = document.getElementById("ticker");
  const barSprint = document.getElementById("bar-sprint");
  const backLink = document.getElementById("back-link");

  // —— Lore lines (StarBoltSprint) ——
  const LORE = [
    "Sprint is a fundamental force.",
    "Bolt runs — the Crystal Nebula listens.",
    "Meaningful motion densifies the world.",
    "The path is not found. It is earned.",
    "Spiral-47 remembers every howl.",
    "Where momentum peaks, ruins wake.",
    "Cyan fire under paws. Purple sky above.",
    "You are not lost in the cosmos. You shape it.",
    "StarBoltSprint: purpose over pace.",
    "The pack is the protocol. The protocol is you.",
  ];
  let loreIdx = 0;
  let loreTimer = 0;

  // —— Renderer ——
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  if (renderer.shadowMap) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x12081f, 0.018);
  scene.background = new THREE.Color(0x080412);

  const camera = new THREE.PerspectiveCamera(
    55,
    window.innerWidth / window.innerHeight,
    0.1,
    400
  );

  // —— Lights (Tron / neon Crystal) ——
  const amb = new THREE.AmbientLight(0x3a2060, 0.35);
  scene.add(amb);
  const hemi = new THREE.HemisphereLight(0x8866cc, 0x0a0618, 0.55);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffd0ff, 0.85);
  sun.position.set(12, 28, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 80;
  sun.shadow.camera.left = sun.shadow.camera.bottom = -30;
  sun.shadow.camera.right = sun.shadow.camera.top = 30;
  scene.add(sun);

  const pathLight = new THREE.PointLight(0x3ef0ff, 2.2, 40, 1.6);
  pathLight.position.set(0, 3, 0);
  scene.add(pathLight);

  const rimLight = new THREE.PointLight(0xc44dff, 1.6, 50, 1.8);
  rimLight.position.set(-8, 6, -12);
  scene.add(rimLight);

  // —— Ground ——
  function makeGroundTex() {
    const s = 512;
    const c = document.createElement("canvas");
    c.width = c.height = s;
    const ctx = c.getContext("2d");
    const g = ctx.createLinearGradient(0, 0, s, s);
    g.addColorStop(0, "#0c0820");
    g.addColorStop(0.5, "#15102e");
    g.addColorStop(1, "#0a0618");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 4000; i++) {
      const x = Math.random() * s;
      const y = Math.random() * s;
      ctx.fillStyle = `rgba(${80 + Math.random() * 100},${40 + Math.random() * 80},${160},0.15)`;
      ctx.fillRect(x, y, 1 + Math.random() * 2, 1);
    }
    // subtle grid like Tron energy
    ctx.strokeStyle = "rgba(62,240,255,0.06)";
    ctx.lineWidth = 1;
    for (let i = 0; i < s; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, s);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(s, i);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(24, 24);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 220, 64, 64),
    new THREE.MeshStandardMaterial({
      map: makeGroundTex(),
      color: 0xffffff,
      roughness: 0.92,
      metalness: 0.08,
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  // gentle height noise
  {
    const pos = ground.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const h =
        Math.sin(x * 0.12) * Math.cos(y * 0.1) * 0.45 +
        Math.sin(x * 0.05 + y * 0.07) * 1.1;
      pos.setZ(i, h);
    }
    ground.geometry.computeVertexNormals();
  }
  scene.add(ground);

  // —— Energy path (clean ribbon, not broken native mesh) ——
  const pathGroup = new THREE.Group();
  scene.add(pathGroup);
  const pathPts = [];
  for (let i = 0; i <= 80; i++) {
    const t = i / 80;
    const z = -40 + t * 100;
    const x = Math.sin(t * Math.PI * 2.2) * 4.5 + Math.sin(t * 7.0) * 1.2;
    pathPts.push(new THREE.Vector3(x, 0.12, z));
  }
  const pathCurve = new THREE.CatmullRomCurve3(pathPts);
  const pathGeo = new THREE.TubeGeometry(pathCurve, 120, 1.15, 6, false);
  const pathMat = new THREE.MeshStandardMaterial({
    color: 0x1a6a88,
    emissive: 0x3ef0ff,
    emissiveIntensity: 0.85,
    roughness: 0.25,
    metalness: 0.55,
    transparent: true,
    opacity: 0.92,
  });
  const pathMesh = new THREE.Mesh(pathGeo, pathMat);
  pathMesh.receiveShadow = true;
  pathGroup.add(pathMesh);

  // path glow underlay
  const pathGlow = new THREE.Mesh(
    new THREE.TubeGeometry(pathCurve, 80, 2.4, 6, false),
    new THREE.MeshBasicMaterial({
      color: 0x3ef0ff,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
    })
  );
  pathGroup.add(pathGlow);

  // —— Crystal props ——
  const crystalMat = new THREE.MeshStandardMaterial({
    color: 0x6a3aad,
    emissive: 0xc44dff,
    emissiveIntensity: 0.35,
    roughness: 0.35,
    metalness: 0.4,
  });
  const crystalMat2 = new THREE.MeshStandardMaterial({
    color: 0x2a6a7a,
    emissive: 0x3ef0ff,
    emissiveIntensity: 0.4,
    roughness: 0.3,
    metalness: 0.45,
  });

  function crystalStalk(h, mat) {
    const g = new THREE.Group();
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.28, h, 6),
      mat
    );
    stem.position.y = h * 0.5;
    stem.castShadow = true;
    g.add(stem);
    const cap = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45 + Math.random() * 0.35, 0), mat);
    cap.position.y = h + 0.2;
    cap.castShadow = true;
    g.add(cap);
    return g;
  }

  const props = new THREE.Group();
  scene.add(props);
  for (let i = 0; i < 48; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const along = (i / 48) * 90 - 35;
    const x =
      pathCurve.getPoint((along + 40) / 100).x +
      side * (5.5 + Math.random() * 10);
    const z = along;
    const h = 2.2 + Math.random() * 6;
    const mat = Math.random() > 0.45 ? crystalMat : crystalMat2;
    const c = crystalStalk(h, mat);
    c.position.set(x, 0, z);
    c.rotation.y = Math.random() * Math.PI;
    c.scale.setScalar(0.7 + Math.random() * 0.8);
    props.add(c);
  }

  // tall monoliths
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 8 + Math.random() * 10, 0.8),
      crystalMat
    );
    const a = (i / 8) * Math.PI * 2;
    m.position.set(Math.cos(a) * 28, 5, Math.sin(a) * 28 - 5);
    m.rotation.y = a;
    m.castShadow = true;
    props.add(m);
  }

  // —— Bolt (stylized wolf / lightning dog) ——
  const bolt = new THREE.Group();
  const fur = new THREE.MeshStandardMaterial({
    color: 0xb8c4d4,
    emissive: 0x224466,
    emissiveIntensity: 0.15,
    roughness: 0.7,
    metalness: 0.1,
  });
  const glow = new THREE.MeshStandardMaterial({
    color: 0x3ef0ff,
    emissive: 0x3ef0ff,
    emissiveIntensity: 0.9,
    roughness: 0.3,
  });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.7, 4, 8), fur);
  body.rotation.z = Math.PI / 2;
  body.position.set(0, 0.55, 0);
  body.castShadow = true;
  bolt.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 10), fur);
  head.scale.set(1, 0.9, 1.15);
  head.position.set(0, 0.72, 0.55);
  head.castShadow = true;
  bolt.add(head);

  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.28, 6), fur);
  snout.rotation.x = -Math.PI / 2;
  snout.position.set(0, 0.62, 0.82);
  bolt.add(snout);

  const earL = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 4), fur);
  earL.position.set(-0.12, 0.98, 0.48);
  const earR = earL.clone();
  earR.position.x = 0.12;
  bolt.add(earL, earR);

  // legs
  for (const [lx, lz] of [
    [-0.22, 0.28],
    [0.22, 0.28],
    [-0.22, -0.28],
    [0.22, -0.28],
  ]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.45, 5), fur);
    leg.position.set(lx, 0.22, lz);
    leg.castShadow = true;
    bolt.add(leg);
  }

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.45, 5), fur);
  tail.rotation.x = Math.PI / 2.4;
  tail.position.set(0, 0.55, -0.55);
  bolt.add(tail);

  // lightning aura ring
  const aura = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.025, 8, 32),
    glow
  );
  aura.rotation.x = Math.PI / 2;
  aura.position.y = 0.15;
  bolt.add(aura);

  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), glow);
  eyeL.position.set(-0.1, 0.78, 0.72);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.1;
  bolt.add(eyeL, eyeR);

  scene.add(bolt);

  // —— Particles (motes) ——
  const moteCount = 180;
  const motePos = new Float32Array(moteCount * 3);
  for (let i = 0; i < moteCount; i++) {
    motePos[i * 3] = (Math.random() - 0.5) * 60;
    motePos[i * 3 + 1] = Math.random() * 14 + 0.5;
    motePos[i * 3 + 2] = (Math.random() - 0.5) * 80;
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute("position", new THREE.BufferAttribute(motePos, 3));
  const motes = new THREE.Points(
    moteGeo,
    new THREE.PointsMaterial({
      color: 0xaaddff,
      size: 0.12,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      sizeAttenuation: true,
    })
  );
  scene.add(motes);

  // —— Stars ——
  const starCount = 600;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const r = 80 + Math.random() * 40;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.random() * Math.PI * 0.45;
    starPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    starPos[i * 3 + 1] = 10 + r * Math.cos(ph) * 0.6;
    starPos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
  }
  const stars = new THREE.Points(
    new THREE.BufferGeometry().setAttribute(
      "position",
      new THREE.BufferAttribute(starPos, 3)
    ),
    new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, transparent: true, opacity: 0.85 })
  );
  scene.add(stars);

  // —— State ——
  let playing = false;
  let pathT = 0.12;
  let speed = 0;
  let sprint = 0;
  let yaw = 0;
  let pitch = 0.22;
  let autoPilot = true;
  const keys = {};
  let pointerLocked = false;

  const tmp = new THREE.Vector3();
  const look = new THREE.Vector3();

  function enter() {
    playing = true;
    loreEl.classList.add("hide");
    hudEl.classList.add("show");
    if (backLink) backLink.style.display = "block";
    canvas.requestPointerLock?.();
  }

  enterBtn.addEventListener("click", enter);
  document.addEventListener("keydown", (e) => {
    keys[e.code] = true;
    if (e.code === "Enter" && !playing) enter();
    if (e.code === "Escape") {
      if (document.pointerLockElement) document.exitPointerLock();
      else if (playing) {
        playing = false;
        loreEl.classList.remove("hide");
        hudEl.classList.remove("show");
      }
    }
    if (e.code === "KeyF") {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
      else document.exitFullscreen?.();
    }
    if (e.code === "KeyA" || e.code === "KeyD" || e.code === "KeyW" || e.code === "KeyS") {
      autoPilot = false;
    }
  });
  document.addEventListener("keyup", (e) => {
    keys[e.code] = false;
  });
  document.addEventListener("pointerlockchange", () => {
    pointerLocked = document.pointerLockElement === canvas;
  });
  document.addEventListener("mousemove", (e) => {
    if (!pointerLocked || !playing) return;
    yaw -= e.movementX * 0.0022;
    pitch = Math.max(-0.35, Math.min(0.55, pitch - e.movementY * 0.002));
  });
  canvas.addEventListener("click", () => {
    if (playing) canvas.requestPointerLock?.();
  });

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // —— Loop ——
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now * 0.001;

    // title idle orbit
    if (!playing) {
      pathT = (pathT + dt * 0.02) % 1;
      const p = pathCurve.getPointAt(pathT);
      const tan = pathCurve.getTangentAt(pathT).normalize();
      bolt.position.copy(p);
      bolt.position.y += 0.05 + Math.sin(t * 3) * 0.03;
      bolt.rotation.y = Math.atan2(tan.x, tan.z);
      aura.rotation.z = t * 2;
      camera.position.set(
        p.x + Math.sin(t * 0.25) * 8,
        4.5 + Math.sin(t * 0.4) * 0.5,
        p.z - 9
      );
      camera.lookAt(p.x, 1.2, p.z + 2);
      pathLight.position.set(p.x, 2.5, p.z);
      pathMat.emissiveIntensity = 0.7 + Math.sin(t * 2) * 0.2;
      renderer.render(scene, camera);
      return;
    }

    // movement along path + steer
    const wantSprint = keys.ShiftLeft || keys.ShiftRight;
    const base = wantSprint ? 0.22 : 0.1;
    let move = 0;
    if (autoPilot) move = 1;
    if (keys.KeyW) {
      move = 1;
      autoPilot = false;
    }
    if (keys.KeyS) {
      move = -0.4;
      autoPilot = false;
    }
    if (keys.KeyA) pathT -= dt * 0.04;
    if (keys.KeyD) pathT += dt * 0.04;

    sprint = THREE.MathUtils.lerp(sprint, wantSprint && move > 0 ? 1 : 0, 1 - Math.exp(-dt * 4));
    speed = THREE.MathUtils.lerp(speed, move * (base + sprint * 0.18), 1 - Math.exp(-dt * 6));
    pathT = (pathT + speed * dt + 1) % 1;

    const p = pathCurve.getPointAt(pathT);
    const tan = pathCurve.getTangentAt(pathT).normalize();
    bolt.position.lerp(tmp.set(p.x, 0.08 + Math.abs(Math.sin(t * 12 + sprint * 20)) * 0.06 * (0.4 + sprint), p.z), 0.35);
    const face = Math.atan2(tan.x, tan.z);
    bolt.rotation.y = THREE.MathUtils.lerp(bolt.rotation.y, face, 0.15);
    // gallop lean
    bolt.rotation.z = Math.sin(t * 10 + sprint * 15) * 0.08 * (0.3 + sprint);
    aura.rotation.z = t * (2 + sprint * 4);
    aura.scale.setScalar(1 + sprint * 0.35);

    // camera chase
    const back = new THREE.Vector3(-Math.sin(yaw || face), 0, -Math.cos(yaw || face));
    if (!pointerLocked) {
      yaw = THREE.MathUtils.lerp(yaw, face + Math.PI, 0.04);
    }
    const camDist = 6.5 - sprint * 0.8;
    const camH = 2.4 + pitch * 2;
    const camFwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    camera.position.lerp(
      look.set(
        bolt.position.x - camFwd.x * camDist,
        bolt.position.y + camH,
        bolt.position.z - camFwd.z * camDist
      ),
      1 - Math.exp(-dt * 5)
    );
    camera.lookAt(bolt.position.x, bolt.position.y + 0.9, bolt.position.z);

    pathLight.position.set(bolt.position.x, 2.8, bolt.position.z);
    pathLight.intensity = 1.8 + sprint * 1.4;
    pathMat.emissiveIntensity = 0.65 + sprint * 0.55 + Math.sin(t * 4) * 0.08;
    scene.fog.density = 0.016 - sprint * 0.004;

    // motes drift
    const arr = moteGeo.attributes.position.array;
    for (let i = 0; i < moteCount; i++) {
      arr[i * 3 + 1] += Math.sin(t + i) * dt * 0.15;
      if (arr[i * 3 + 1] > 16) arr[i * 3 + 1] = 0.5;
    }
    moteGeo.attributes.position.needsUpdate = true;

    // HUD
    if (barSprint) barSprint.style.width = `${Math.floor(sprint * 100)}%`;
    loreTimer += dt;
    if (loreTimer > 4.2) {
      loreTimer = 0;
      loreIdx = (loreIdx + 1) % LORE.length;
      if (tickerEl) {
        tickerEl.style.opacity = "0";
        setTimeout(() => {
          tickerEl.textContent = LORE[loreIdx];
          tickerEl.style.opacity = "1";
        }, 200);
      }
    }
    if (tickerEl) tickerEl.style.transition = "opacity 0.35s ease";

    // world pulse with sprint (lore: sprint shapes the world)
    props.traverse((o) => {
      if (o.isMesh && o.material && o.material.emissiveIntensity != null) {
        o.material.emissiveIntensity = 0.3 + sprint * 0.45 + Math.sin(t * 2 + o.id) * 0.05;
      }
    });

    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
})();
