# BOLT ENGINE — StarBoltSprint (Three.js)

**v0.88 · Seamless Scale (paw→cosmic) · Mega Citadel · Juice · Pack · Save**

## Run

Double-click **`index.html`** (Ctrl+F5 after updates).

## Graphics pack (v0.70)

| # | Feature |
|---|---------|
| 1 | **Textured biome ground** (procedural canvas maps) · wire grid almost gone |
| 2 | **Richer lights** (hemisphere + sun + fill + rim) · soft CSS bloom polish |
| 3 | **Sky dome** nebula + soft additive particles |
| 4 | **Rock materials** with procedural detail on terrain/ruins |
| 5 | **Bolt** soft materials + contact shadow |

## Core systems

- Infinite open world (`openworld.js`)
- ProceduralSpawner + Path / Terrain / Vegetation / Ruin / Detail (`procedural.js`)
- Biomes: Crystal Nebula · Ember Void · Whispering Starfields
- Meaningful Sprint Score ≥ 0.65 opens rich generation

## Controls

WASD · Shift sprint · Space jump · H howl · **L** decrees · **J** quest · **P** progress · **M** mute · Esc pause

## Seamless Scale Shifting (v0.88)

Bolt does **not** fly — he **sprints** until gravity loses.

| Scale | Feel | Spawner focus |
|-------|------|----------------|
| **Paw** | Surface detail | Vegetation + detail dense |
| **Planetary** | World opens | Terrain + ruins |
| **Orbital** | Outran the ground | Sparse ruins/paths |
| **Solar** | Vast sparse | Rare megastructures |
| **Cosmic** | Deep space | Epic sparse landmarks |

- **`transitionProgress`** (0–1) from speed + altitude + momentum + Lightning Core  
- **Surface by default**: on ground, scale caps at **planetary** — stay there forever if you want  
- **Ascent by choice**: **Shift + Space** (with momentum) commits to leave the ground; keep Shift to climb orbital→cosmic  
- **Land** anytime to return to surface/paw  
- Smooth fog/camera + graceful downgrade; spawner prediction grows with scale  

## Thunderwolf Citadel (v0.85)

Living home fortress at world origin — walkable base rooms:

| Room | Role |
|------|------|
| **Thunderwolf Throne** | Heart of power · lightning wolf spirit |
| **Star Core Chamber** | Primordial core + orbit rings |
| **Resonance Hall** | Pack / progression plaza |
| **Quarters** | Rest · memory orbs |
| **Artifact Vault** | Relic pedestals |
| **Training Grounds** | Sprint track |
| **Observation Deck** | High spire panorama |

Grows with Core stage (extra spires, gardens, defense wings). Spawn at the **south gate**. Core stage 100% renamed **THRONE** (Citadel = the place).

## Pack events + save (v0.83)

- **Pack events**: Flux Storm · Pack Call (howl) · Resonance Bloom · Starfall — density, flash, audio
- **Triggers**: high Resonance while Gate open, or **H** howl
- **Pack Memory** (`P`): lifetime save — best Core stage, decrees, quests, biomes, stats (`localStorage`)
- Legacy bonus: prior high Core stages soft-start Resonance/Core on new runs

## Intention + Quests (v0.82)

- **Landmarks**: gold beacons on ruins, cyan on paths, pink on Citadel
- **Intention** rises when sprinting toward landmarks
- **Mini-quests**: Decree chain with Core/Resonance/Flux rewards

## Audio (v0.81)

Procedural Web Audio (no sound files) in `js/audio.js`:

| Event | Sound |
|-------|--------|
| Sprint | Rising hum (speed + Meaningful + Gate) |
| Gate open/close | Crystal swell / fade |
| H howl | Dual Resonance howl |
| Ruin loot / Decree | Gold sparkle + temple chime |
| Core stage up | Rising fanfare |
| Boost / spark / jump | Short hits |

## Lore systems (v0.78–v0.79)

- **Meaningful Gate** (≥65%): ceremony when the cosmos opens this sprint
- **Star Core stages**: SPARK → KINDLED → RESONANT → AWAKENED → CITADEL — world density/ruins/detail rise with Core %
- **Lore toasts** + **Decree Log** (L) from ruins

## Files

```
js/three.min.js
js/graphics.js      ← textures, sky, lights, particles, bloom polish
js/procedural.js
js/openworld.js
js/game.js
```

Powered by xAI & YOU · AROOO ⚡🐺
