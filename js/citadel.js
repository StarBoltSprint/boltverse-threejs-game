/**
 * BOLT ENGINE — Thunderwolf Citadel
 * Living home fortress of the Boltverse.
 * Base rooms: Throne · Star Core · Resonance Hall · Quarters · Training · Vault · Observation
 * Grows with Core stage / Resonance / Pack Memory.
 */
(function (global) {
  "use strict";
  const THREE = global.THREE;
  if (!THREE) return;

  function mat(color, opts) {
    opts = opts || {};
    return new THREE.MeshStandardMaterial({
      color: color,
      emissive: opts.emissive != null ? opts.emissive : 0x000000,
      emissiveIntensity: opts.emissiveIntensity != null ? opts.emissiveIntensity : 0,
      metalness: opts.metalness != null ? opts.metalness : 0.45,
      roughness: opts.roughness != null ? opts.roughness : 0.4,
      transparent: !!opts.opacity && opts.opacity < 1,
      opacity: opts.opacity != null ? opts.opacity : 1,
      flatShading: !!opts.flat,
      side: opts.side || THREE.FrontSide,
    });
  }

  function glowMat(color, em, eInt, opac) {
    return new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: opac != null ? opac : 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }

  /**
   * Build the Prime Citadel at world origin-ish.
   * @param {THREE.Scene} scene
   * @param {object} opts { heightAt, coreStageIndex, decrees, events }
   */
  function createCitadel(scene, opts) {
    opts = opts || {};
    const heightAt = opts.heightAt || function () { return 0; };
    const baseY = heightAt(0, 0);
    // MEGA scale — Citadel must dwarf Bolt (dog ~2u) as a cosmic fortress
    const S = opts.scale != null ? opts.scale : 5.5;
    const root = new THREE.Group();
    root.name = "ThunderwolfCitadel";
    root.position.set(0, baseY, 0);
    root.scale.setScalar(S);
    root.userData.kind = "citadel";
    root.userData.scale = S;
    root.userData.rooms = {};
    root.userData.growthParts = [];
    root.userData.lights = [];
    root.userData.animParts = [];

    // Materials
    const stone = mat(0x3b4a6b, { metalness: 0.35, roughness: 0.55, emissive: 0x1e293b, emissiveIntensity: 0.15 });
    const stoneDark = mat(0x1e293b, { metalness: 0.4, roughness: 0.5, emissive: 0x0f172a, emissiveIntensity: 0.1 });
    const stoneLite = mat(0x64748b, { metalness: 0.5, roughness: 0.35, emissive: 0x334155, emissiveIntensity: 0.2 });
    const cyan = mat(0x67e8f9, { emissive: 0x22d3ee, emissiveIntensity: 1.2, metalness: 0.7, roughness: 0.2 });
    const gold = mat(0xfbbf24, { emissive: 0xf59e0b, emissiveIntensity: 1.4, metalness: 0.65, roughness: 0.2 });
    const violet = mat(0xa855f7, { emissive: 0x7c3aed, emissiveIntensity: 1.1, metalness: 0.55, roughness: 0.25 });
    const pink = mat(0xf472b6, { emissive: 0xdb2777, emissiveIntensity: 0.9, metalness: 0.4, roughness: 0.3 });

    function add(mesh, parent) {
      (parent || root).add(mesh);
      if (mesh.castShadow !== false) mesh.castShadow = true;
      mesh.receiveShadow = true;
      return mesh;
    }

    function floorDisk(r, y, material, segs) {
      const f = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r * 1.02, 0.6, segs || 32),
        material
      );
      f.position.y = y;
      return add(f);
    }

    // =====================================================================
    // FOUNDATION & OUTER RING
    // =====================================================================
    floorDisk(28, 0.3, stoneDark, 48);
    floorDisk(22, 0.55, stone, 40);
    // Outer ring walkway
    const outerRing = new THREE.Mesh(
      new THREE.TorusGeometry(24, 1.2, 10, 64),
      stoneLite
    );
    outerRing.rotation.x = Math.PI / 2;
    outerRing.position.y = 0.9;
    add(outerRing);

    // Energy ring around fortress
    const energyRing = new THREE.Mesh(
      new THREE.TorusGeometry(26, 0.15, 8, 64),
      glowMat(0x67e8f9, null, null, 0.45)
    );
    energyRing.rotation.x = Math.PI / 2;
    energyRing.position.y = 1.2;
    add(energyRing);
    root.userData.animParts.push({ mesh: energyRing, spin: 0.08 });

    // Gate pillars (south entrance — toward spawn z+)
    for (let s = -1; s <= 1; s += 2) {
      const pillar = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 14, 2.2),
        stone
      );
      pillar.position.set(s * 6, 7.2, 22);
      add(pillar);
      const cap = new THREE.Mesh(new THREE.OctahedronGeometry(1.4, 0), cyan);
      cap.position.set(s * 6, 14.5, 22);
      add(cap);
      root.userData.animParts.push({ mesh: cap, spin: 0.4 * s });
    }
    // Gate arch beam
    const arch = new THREE.Mesh(new THREE.BoxGeometry(14, 1.5, 2), stoneLite);
    arch.position.set(0, 13.5, 22);
    add(arch);
    const archGlow = new THREE.Mesh(
      new THREE.BoxGeometry(12, 0.4, 0.5),
      glowMat(0xa855f7, null, null, 0.7)
    );
    archGlow.position.set(0, 13.5, 23.2);
    add(archGlow);

    // Welcome path from spawn
    const path = new THREE.Mesh(
      new THREE.BoxGeometry(5, 0.25, 18),
      mat(0x334155, { metalness: 0.5, roughness: 0.4, emissive: 0x22d3ee, emissiveIntensity: 0.25 })
    );
    path.position.set(0, 0.65, 30);
    add(path);
    for (let i = 0; i < 5; i++) {
      const rune = new THREE.Mesh(
        new THREE.CircleGeometry(0.6, 12),
        glowMat(0x67e8f9, null, null, 0.5)
      );
      rune.rotation.x = -Math.PI / 2;
      rune.position.set(0, 0.8, 24 + i * 3);
      add(rune);
    }

    // =====================================================================
    // OUTER SPIRES (base 4 + growth extras)
    // =====================================================================
    const spirePositions = [
      [18, 18], [-18, 18], [18, -18], [-18, -18],
      [0, 26], [0, -26], [26, 0], [-26, 0], // growth
    ];
    spirePositions.forEach(function (p, i) {
      const g = new THREE.Group();
      g.position.set(p[0], 0, p[1]);
      const h = 12 + (i % 3) * 4;
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(1.1, 1.8, h, 8),
        i < 4 ? stone : stoneDark
      );
      body.position.y = h * 0.5;
      g.add(body);
      const tip = new THREE.Mesh(
        new THREE.ConeGeometry(1.3, 4, 8),
        i % 2 === 0 ? cyan : violet
      );
      tip.position.y = h + 1.5;
      g.add(tip);
      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.7, 12, 12),
        glowMat(i % 2 === 0 ? 0x67e8f9 : 0xa855f7, null, null, 0.65)
      );
      orb.position.y = h + 4;
      g.add(orb);
      root.userData.animParts.push({ mesh: orb, bob: 0.3 + i * 0.1, phase: i });
      if (i >= 4) {
        g.visible = false;
        g.userData.growthMinStage = 1 + ((i - 4) % 3); // unlock at kindled+
        root.userData.growthParts.push(g);
      }
      add(g);
    });

    // =====================================================================
    // RESONANCE HALL (main entrance plaza)
    // =====================================================================
    const hall = new THREE.Group();
    hall.name = "ResonanceHall";
    hall.position.set(0, 0, 10);
    // Floor
    const hallFloor = new THREE.Mesh(
      new THREE.CylinderGeometry(10, 10.5, 0.5, 24),
      stone
    );
    hallFloor.position.y = 1.0;
    hall.add(hallFloor);
    // Columns
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const col = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.7, 8, 8),
        stoneLite
      );
      col.position.set(Math.cos(a) * 8, 5, Math.sin(a) * 8);
      hall.add(col);
      const crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.55, 0),
        violet
      );
      crystal.position.set(Math.cos(a) * 8, 9.5, Math.sin(a) * 8);
      hall.add(crystal);
      root.userData.animParts.push({ mesh: crystal, spin: 0.6, phase: i });
    }
    // Floating Resonance crystals center
    for (let i = 0; i < 5; i++) {
      const c = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.4 + i * 0.08, 0),
        i % 2 ? cyan : violet
      );
      c.position.set(
        Math.sin(i * 1.7) * 2,
        3 + i * 0.8,
        Math.cos(i * 1.3) * 2
      );
      hall.add(c);
      root.userData.animParts.push({ mesh: c, bob: 0.4, spin: 0.8, phase: i * 1.2 });
    }
    // Ring display
    const resRing = new THREE.Mesh(
      new THREE.TorusGeometry(5, 0.12, 8, 40),
      glowMat(0xa855f7, null, null, 0.6)
    );
    resRing.rotation.x = Math.PI / 2;
    resRing.position.y = 2.2;
    hall.add(resRing);
    root.userData.animParts.push({ mesh: resRing, spin: 0.25 });
    add(hall);
    root.userData.rooms.resonanceHall = hall;

    // =====================================================================
    // THUNDERWOLF THRONE ROOM (center raised)
    // =====================================================================
    const throneRoom = new THREE.Group();
    throneRoom.name = "ThroneRoom";
    throneRoom.position.set(0, 0, -2);
    // Raised dais
    const dais = new THREE.Mesh(
      new THREE.CylinderGeometry(8, 9, 2.5, 24),
      stone
    );
    dais.position.y = 2.0;
    throneRoom.add(dais);
    const dais2 = new THREE.Mesh(
      new THREE.CylinderGeometry(5.5, 6, 1.5, 20),
      stoneLite
    );
    dais2.position.y = 3.5;
    throneRoom.add(dais2);

    // Throne seat
    const seat = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.2, 2.8), stoneDark);
    seat.position.set(0, 4.6, -1);
    throneRoom.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(3.4, 5.5, 0.8), stoneDark);
    back.position.set(0, 7.2, -2.2);
    throneRoom.add(back);
    // Throne wolf ears / lightning finials
    for (let s = -1; s <= 1; s += 2) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2.8, 6), gold);
      ear.position.set(s * 1.4, 10.5, -2.2);
      ear.rotation.z = s * 0.25;
      throneRoom.add(ear);
    }
    // Throne energy
    const throneGlow = new THREE.Mesh(
      new THREE.SphereGeometry(2.2, 16, 16),
      glowMat(0xfbbf24, null, null, 0.25)
    );
    throneGlow.position.set(0, 6.5, -1.2);
    throneRoom.add(throneGlow);
    root.userData.animParts.push({ mesh: throneGlow, pulse: 0.15 });

    // Lightning wolf silhouette (Grok spirit) — stylized
    const wolf = new THREE.Group();
    wolf.position.set(0, 8.5, -1.5);
    const wBody = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.35, 0.9, 6, 10),
      glowMat(0xa5f3fc, null, null, 0.55)
    );
    wBody.rotation.z = Math.PI / 2;
    wolf.add(wBody);
    const wHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 10, 10),
      glowMat(0x67e8f9, null, null, 0.7)
    );
    wHead.position.set(0.55, 0.15, 0);
    wolf.add(wHead);
    for (let s = -1; s <= 1; s += 2) {
      const wEar = new THREE.Mesh(
        new THREE.ConeGeometry(0.1, 0.35, 5),
        glowMat(0x22d3ee, null, null, 0.8)
      );
      wEar.position.set(0.5, 0.45, s * 0.15);
      wolf.add(wEar);
    }
    throneRoom.add(wolf);
    root.userData.animParts.push({ mesh: wolf, bob: 0.25, spin: 0.15 });
    root.userData.lightningWolf = wolf;

    // Throne pillars
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const p = new THREE.Mesh(
        new THREE.BoxGeometry(1.0, 10, 1.0),
        stone
      );
      p.position.set(Math.cos(a) * 7, 6.5, Math.sin(a) * 7 - 2);
      throneRoom.add(p);
    }
    // Dome ribs
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const rib = new THREE.Mesh(
        new THREE.TorusGeometry(7.5, 0.18, 6, 20, Math.PI),
        cyan
      );
      rib.position.set(0, 8, -2);
      rib.rotation.y = a;
      rib.rotation.z = Math.PI / 2;
      throneRoom.add(rib);
    }
    add(throneRoom);
    root.userData.rooms.throne = throneRoom;

    // =====================================================================
    // STAR CORE CHAMBER (below / linked to throne — glowing heart)
    // =====================================================================
    const coreChamber = new THREE.Group();
    coreChamber.name = "StarCoreChamber";
    coreChamber.position.set(0, 0, -2);
    // Open well under throne
    const well = new THREE.Mesh(
      new THREE.CylinderGeometry(4.5, 5, 3, 24, 1, true),
      stoneDark
    );
    well.position.y = 0.5;
    coreChamber.add(well);
    // Inner glow cylinder
    const wellGlow = new THREE.Mesh(
      new THREE.CylinderGeometry(3.8, 3.8, 8, 24, 1, true),
      glowMat(0xfbbf24, null, null, 0.2)
    );
    wellGlow.position.y = 4;
    coreChamber.add(wellGlow);

    // THE STAR CORE (main visual — will be animated from outside via userData.coreRoot)
    const coreRoot = new THREE.Group();
    coreRoot.position.set(0, 5.5, 0);
    const coreMain = new THREE.Mesh(
      new THREE.IcosahedronGeometry(2.4, 2),
      mat(0xfbbf24, {
        emissive: 0xf59e0b,
        emissiveIntensity: 1.8,
        metalness: 0.35,
        roughness: 0.22,
        flat: true,
      })
    );
    coreRoot.add(coreMain);
    const coreShell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(3.2, 1),
      new THREE.MeshBasicMaterial({
        color: 0xfde68a,
        wireframe: true,
        transparent: true,
        opacity: 0.4,
      })
    );
    coreRoot.add(coreShell);
    const coreAura = new THREE.Mesh(
      new THREE.SphereGeometry(4.2, 28, 28),
      glowMat(0xfbbf24, null, null, 0.12)
    );
    coreRoot.add(coreAura);
    // Orbit rings
    for (let i = 0; i < 3; i++) {
      const r = new THREE.Mesh(
        new THREE.TorusGeometry(3.5 + i * 0.7, 0.06, 6, 40),
        glowMat(i === 1 ? 0x67e8f9 : 0xfbbf24, null, null, 0.5)
      );
      r.rotation.x = Math.PI / 2 + i * 0.4;
      r.rotation.y = i * 0.7;
      coreRoot.add(r);
      root.userData.animParts.push({ mesh: r, spin: 0.3 + i * 0.15 });
    }
    coreChamber.add(coreRoot);
    root.userData.coreRoot = coreRoot;
    root.userData.coreMain = coreMain;
    root.userData.coreShell = coreShell;
    root.userData.coreAura = coreAura;

    // Point light for chamber
    const coreLight = new THREE.PointLight(0xfbbf24, 4, 45);
    coreLight.position.set(0, 6, 0);
    coreChamber.add(coreLight);
    root.userData.coreLight = coreLight;
    root.userData.lights.push(coreLight);

    add(coreChamber);
    root.userData.rooms.starCore = coreChamber;

    // =====================================================================
    // BOLT'S QUARTERS (west wing)
    // =====================================================================
    const quarters = new THREE.Group();
    quarters.name = "Quarters";
    quarters.position.set(-14, 0, 2);
    const qFloor = new THREE.Mesh(new THREE.BoxGeometry(10, 0.5, 10), stone);
    qFloor.position.y = 1.2;
    quarters.add(qFloor);
    // Walls (open-ish pavilion)
    for (let i = 0; i < 3; i++) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5, 8), stoneDark);
      wall.position.set(-4 + i * 0.1, 3.5, -1);
      if (i === 1) wall.position.set(4, 3.5, 0);
      if (i === 2) {
        wall.geometry = new THREE.BoxGeometry(8, 5, 0.5);
        wall.position.set(0, 3.5, -4.5);
      }
      if (i === 0) wall.position.set(-4.5, 3.5, 0);
      quarters.add(wall);
    }
    // Rest platform / bed of light
    const bed = new THREE.Mesh(
      new THREE.BoxGeometry(3.5, 0.6, 5),
      mat(0x1e3a5f, { emissive: 0x22d3ee, emissiveIntensity: 0.35, roughness: 0.6 })
    );
    bed.position.set(0, 1.8, 1);
    quarters.add(bed);
    // Memory orbs (artifacts)
    for (let i = 0; i < 4; i++) {
      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 10, 10),
        i % 2 ? gold : cyan
      );
      orb.position.set(-2 + i * 1.3, 3.5, -2.5);
      quarters.add(orb);
      root.userData.animParts.push({ mesh: orb, bob: 0.2, phase: i });
    }
    // Soft canopy
    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(5, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.45),
      glowMat(0x67e8f9, null, null, 0.12)
    );
    canopy.position.y = 4;
    quarters.add(canopy);
    add(quarters);
    root.userData.rooms.quarters = quarters;

    // =====================================================================
    // ARTIFACT VAULT (east wing)
    // =====================================================================
    const vault = new THREE.Group();
    vault.name = "ArtifactVault";
    vault.position.set(14, 0, 2);
    const vFloor = new THREE.Mesh(new THREE.BoxGeometry(10, 0.5, 10), stoneDark);
    vFloor.position.y = 1.2;
    vault.add(vFloor);
    // Vault dome
    const vDome = new THREE.Mesh(
      new THREE.SphereGeometry(5.5, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.55),
      stone
    );
    vDome.position.y = 1.5;
    vault.add(vDome);
    // Pedestals
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const ped = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.55, 1.5, 8),
        stoneLite
      );
      ped.position.set(Math.cos(a) * 3, 2.0, Math.sin(a) * 3);
      vault.add(ped);
      const relic = new THREE.Mesh(
        i % 2 === 0
          ? new THREE.OctahedronGeometry(0.4, 0)
          : new THREE.TetrahedronGeometry(0.45, 0),
        i % 3 === 0 ? gold : i % 3 === 1 ? cyan : violet
      );
      relic.position.set(Math.cos(a) * 3, 3.2, Math.sin(a) * 3);
      vault.add(relic);
      root.userData.animParts.push({ mesh: relic, spin: 0.5 + i * 0.1, bob: 0.15, phase: i });
    }
    // Vault door glow
    const vDoor = new THREE.Mesh(
      new THREE.BoxGeometry(3, 4, 0.3),
      glowMat(0xfbbf24, null, null, 0.35)
    );
    vDoor.position.set(0, 3, 5.2);
    vault.add(vDoor);
    add(vault);
    root.userData.rooms.vault = vault;

    // =====================================================================
    // TRAINING GROUNDS (north-east)
    // =====================================================================
    const training = new THREE.Group();
    training.name = "TrainingGrounds";
    training.position.set(12, 0, -14);
    const tFloor = new THREE.Mesh(
      new THREE.CylinderGeometry(9, 9.5, 0.4, 24),
      mat(0x1a2744, { metalness: 0.3, roughness: 0.7, emissive: 0x0ea5e9, emissiveIntensity: 0.15 })
    );
    tFloor.position.y = 0.9;
    training.add(tFloor);
    // Ring track
    const track = new THREE.Mesh(
      new THREE.TorusGeometry(6.5, 0.35, 8, 40),
      cyan
    );
    track.rotation.x = Math.PI / 2;
    track.position.y = 1.2;
    training.add(track);
    // Jump pads / targets
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(1.2, 1.2, 0.3, 16),
        mat(0x22d3ee, { emissive: 0x06b6d4, emissiveIntensity: 1.0 })
      );
      pad.position.set(Math.cos(a) * 4, 1.3, Math.sin(a) * 4);
      training.add(pad);
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.15, 3 + i, 6),
        stoneLite
      );
      pole.position.set(Math.cos(a + 0.5) * 5.5, 2.5, Math.sin(a + 0.5) * 5.5);
      training.add(pole);
    }
    add(training);
    root.userData.rooms.training = training;

    // =====================================================================
    // OBSERVATION DECK (high spire)
    // =====================================================================
    const observatory = new THREE.Group();
    observatory.name = "ObservationDeck";
    observatory.position.set(-12, 0, -14);
    // Tall tower
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(2.5, 3.5, 22, 12),
      stone
    );
    tower.position.y = 11;
    observatory.add(tower);
    // Deck platform
    const deck = new THREE.Mesh(
      new THREE.CylinderGeometry(7, 7, 0.5, 24),
      stoneLite
    );
    deck.position.y = 22.5;
    observatory.add(deck);
    // Rail
    const rail = new THREE.Mesh(
      new THREE.TorusGeometry(6.5, 0.15, 6, 32),
      cyan
    );
    rail.rotation.x = Math.PI / 2;
    rail.position.y = 23.2;
    observatory.add(rail);
    // Telescope / crystal array
    const scope = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.6, 4, 10),
      violet
    );
    scope.position.set(0, 24.5, 0);
    scope.rotation.z = 0.5;
    observatory.add(scope);
    const scopeOrb = new THREE.Mesh(
      new THREE.SphereGeometry(0.9, 14, 14),
      glowMat(0xa855f7, null, null, 0.7)
    );
    scopeOrb.position.set(1.5, 25.5, 0);
    observatory.add(scopeOrb);
    root.userData.animParts.push({ mesh: scopeOrb, bob: 0.2, spin: 0.5 });
    // Spiral stairs hint
    for (let i = 0; i < 10; i++) {
      const a = i * 0.55;
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 0.25, 1.2),
        stoneDark
      );
      step.position.set(Math.cos(a) * 3.2, 2 + i * 2, Math.sin(a) * 3.2);
      step.rotation.y = -a;
      observatory.add(step);
    }
    add(observatory);
    root.userData.rooms.observation = observatory;

    // =====================================================================
    // BRIDGES between wings
    // =====================================================================
    function bridge(x1, z1, x2, z2, y) {
      const dx = x2 - x1;
      const dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      const b = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 0.35, len),
        stoneLite
      );
      b.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
      b.rotation.y = Math.atan2(dx, dz);
      add(b);
      // Glow strip
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.1, len * 0.95),
        glowMat(0x67e8f9, null, null, 0.5)
      );
      strip.position.copy(b.position);
      strip.position.y += 0.25;
      strip.rotation.y = b.rotation.y;
      add(strip);
    }
    bridge(-8, 8, -12, 4, 1.5); // hall to quarters
    bridge(8, 8, 12, 4, 1.5); // hall to vault
    bridge(6, -6, 10, -12, 1.8); // to training
    bridge(-6, -6, -10, -12, 1.8); // to observatory
    bridge(0, 4, 0, 0, 2.5); // hall to throne

    // =====================================================================
    // FLOATING GARDENS (growth)
    // =====================================================================
    const gardens = new THREE.Group();
    gardens.name = "CrystalGardens";
    gardens.position.set(0, 2, 16);
    gardens.visible = false;
    gardens.userData.growthMinStage = 2; // resonant+
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const plant = new THREE.Mesh(
        new THREE.ConeGeometry(0.3, 1.5 + Math.random(), 5),
        i % 2 ? cyan : violet
      );
      plant.position.set(Math.cos(a) * 6, 0.5, Math.sin(a) * 3);
      gardens.add(plant);
    }
    const gardenRing = new THREE.Mesh(
      new THREE.TorusGeometry(7, 0.8, 8, 24),
      stone
    );
    gardenRing.rotation.x = Math.PI / 2;
    gardens.add(gardenRing);
    add(gardens);
    root.userData.growthParts.push(gardens);
    root.userData.rooms.gardens = gardens;

    // =====================================================================
    // DEFENSIVE WINGS (growth — awakened+)
    // =====================================================================
    const defense = new THREE.Group();
    defense.name = "DefenseWings";
    defense.visible = false;
    defense.userData.growthMinStage = 3;
    for (let s = -1; s <= 1; s += 2) {
      const wing = new THREE.Mesh(
        new THREE.BoxGeometry(4, 6, 12),
        stoneDark
      );
      wing.position.set(s * 22, 4, -5);
      defense.add(wing);
      const turret = new THREE.Mesh(
        new THREE.CylinderGeometry(1, 1.3, 3, 10),
        gold
      );
      turret.position.set(s * 22, 8.5, -5);
      defense.add(turret);
    }
    add(defense);
    root.userData.growthParts.push(defense);

    // Ambient lights
    const hallLight = new THREE.PointLight(0xa855f7, 2.5, 30);
    hallLight.position.set(0, 8, 10);
    root.add(hallLight);
    root.userData.lights.push(hallLight);
    const gateLight = new THREE.PointLight(0x22d3ee, 2, 25);
    gateLight.position.set(0, 10, 24);
    root.add(gateLight);
    root.userData.lights.push(gateLight);

    // Landing pads near gate (for recall later)
    for (let s = -1; s <= 1; s += 2) {
      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(2.5, 2.8, 0.4, 16),
        mat(0x0f766e, { emissive: 0x14b8a6, emissiveIntensity: 0.6 })
      );
      pad.position.set(s * 10, 0.9, 28);
      add(pad);
    }

    // Banner label helpers
    root.userData.roomLabels = [
      { name: "THRONE", pos: new THREE.Vector3(0, 12, -2) },
      { name: "STAR CORE", pos: new THREE.Vector3(0, 10, -2) },
      { name: "RESONANCE", pos: new THREE.Vector3(0, 8, 10) },
      { name: "QUARTERS", pos: new THREE.Vector3(-14, 6, 2) },
      { name: "VAULT", pos: new THREE.Vector3(14, 6, 2) },
      { name: "TRAINING", pos: new THREE.Vector3(12, 5, -14) },
      { name: "OBSERVATORY", pos: new THREE.Vector3(-12, 24, -14) },
    ];

    // Walkable collider pads in WORLD units (local * S)
    function WC(x, z, half, yLocal) {
      return {
        x: x * S,
        z: z * S,
        half: half * S,
        y: baseY + yLocal * S,
      };
    }
    root.userData.colliders = [
      WC(0, 0, 26, 0.9), // main foundation
      WC(0, 10, 9, 1.3), // resonance hall
      WC(0, -2, 8, 4.3), // throne dais top
      WC(0, -2, 5, 2.8), // throne mid
      WC(-14, 2, 5, 1.5), // quarters
      WC(14, 2, 5, 1.5), // vault
      WC(12, -14, 8, 1.2), // training
      WC(-12, -14, 6, 22.8), // observatory deck
      WC(0, 30, 3, 0.9), // path
      WC(0, 22, 5, 0.9), // gate
      WC(0, 16, 8, 1.0), // plaza
      WC(-10, 28, 2.5, 1.1),
      WC(10, 28, 2.5, 1.1),
      WC(0, 6, 7, 1.2), // toward throne
    ];

    // Outer monumental ring (reads at distance)
    const megaRing = new THREE.Mesh(
      new THREE.TorusGeometry(32, 0.8, 8, 64),
      glowMat(0xa855f7, null, null, 0.35)
    );
    megaRing.rotation.x = Math.PI / 2;
    megaRing.position.y = 2;
    add(megaRing);
    root.userData.animParts.push({ mesh: megaRing, spin: 0.04 });

    // Extra colossal outer pylons (silhouette from afar)
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const pylon = new THREE.Mesh(
        new THREE.BoxGeometry(3, 28, 3),
        stoneDark
      );
      pylon.position.set(Math.cos(a) * 34, 14, Math.sin(a) * 34);
      add(pylon);
      const flame = new THREE.Mesh(
        new THREE.SphereGeometry(1.4, 10, 10),
        glowMat(i % 2 ? 0x67e8f9 : 0xfbbf24, null, null, 0.55)
      );
      flame.position.set(Math.cos(a) * 34, 30, Math.sin(a) * 34);
      add(flame);
      root.userData.animParts.push({ mesh: flame, bob: 0.4, phase: i });
    }

    scene.add(root);

    // ---- API ----
    const api = {
      root: root,
      scale: S,
      rooms: root.userData.rooms,
      coreRoot: root.userData.coreRoot,
      coreMain: root.userData.coreMain,
      coreShell: root.userData.coreShell,
      coreAura: root.userData.coreAura,
      coreLight: root.userData.coreLight,
      colliders: root.userData.colliders,
      getBaseY: function () {
        return baseY;
      },
      getEntrance: function () {
        // South gate in world space
        return new THREE.Vector3(0, baseY + 1.6 * S, 38 * S);
      },
      getThronePos: function () {
        return new THREE.Vector3(0, baseY + 5 * S, -3 * S);
      },
      /** Radius for “already home” checks */
      getHomeRadius: function () {
        return 22 * S;
      },
      /**
       * Grow citadel visuals from progression
       * stageIndex: 0 spark … 4 throne/citadel
       */
      setGrowth: function (stageIndex, resonance, decreeCount, eventCount) {
        stageIndex = stageIndex || 0;
        resonance = resonance || 0;
        root.userData.growthParts.forEach(function (part) {
          const need = part.userData.growthMinStage != null ? part.userData.growthMinStage : 1;
          part.visible = stageIndex >= need;
        });
        // Intensify lights with resonance + stage
        root.userData.lights.forEach(function (L, i) {
          L.intensity = (2 + stageIndex * 0.6 + resonance * 2) * (i === 0 ? 1.2 : 1);
        });
        if (root.userData.coreLight) {
          root.userData.coreLight.intensity = 3 + stageIndex * 1.2 + resonance * 3;
        }
        // Scale energy ring
        energyRing.scale.setScalar(1 + stageIndex * 0.05 + resonance * 0.1);
        // Vault relics more glow with decrees
        if (root.userData.rooms.vault) {
          root.userData.rooms.vault.traverse(function (c) {
            if (c.material && c.material.emissiveIntensity != null) {
              c.material.emissiveIntensity = Math.min(2.5, 0.8 + (decreeCount || 0) * 0.05);
            }
          });
        }
      },
      update: function (t, dt) {
        root.userData.animParts.forEach(function (p) {
          if (!p.mesh) return;
          if (p.spin) p.mesh.rotation.y += dt * p.spin;
          if (p.bob) {
            const ph = p.phase || 0;
            p.mesh.position.y += Math.sin(t * 2 + ph) * p.bob * dt;
          }
          if (p.pulse && p.mesh.material && p.mesh.material.opacity != null) {
            p.mesh.material.opacity = 0.2 + Math.sin(t * 3) * 0.1;
          }
        });
        if (root.userData.coreRoot) {
          root.userData.coreRoot.rotation.y += dt * 0.35;
          if (root.userData.coreShell) {
            root.userData.coreShell.rotation.x += dt * 0.2;
            root.userData.coreShell.rotation.z += dt * 0.15;
          }
          const pulse = 1 + Math.sin(t * 2) * 0.04;
          if (root.userData.coreMain) root.userData.coreMain.scale.setScalar(pulse);
        }
        if (root.userData.lightningWolf) {
          root.userData.lightningWolf.rotation.y = Math.sin(t * 0.5) * 0.3;
        }
      },
    };

    // Initial growth
    api.setGrowth(opts.coreStageIndex || 0, opts.resonance || 0, opts.decrees || 0, opts.events || 0);

    return api;
  }

  global.BoltCitadel = {
    createCitadel: createCitadel,
  };
})(typeof window !== "undefined" ? window : globalThis);
