# BOLT ENGINE — StarBoltSprint (Three.js)

**v2.5 · Playable open-world cosmic sprint · PCG · Graphics tiers · Perf pass**

## Play online

**https://starboltsprint.github.io/boltverse-threejs-game/**

Hard-refresh after updates: **Ctrl+F5**.

Repo: **https://github.com/StarBoltSprint/boltverse-threejs-game**

## Run locally

Double-click **`index.html`** (or open via a local server). Use **Ctrl+F5** after pulls.

## What’s in v2.5

### Performance (smooth Low / Med)
- Chunk builds **throttled** (1–2 per frame) — less hitching while sprinting
- Cached height / biome / forest-density noise
- **Low / Med**: fewer live PCG objects, light dressing, no bloom/shadows by default
- **GPU terrain height** only on **MAX**
- Default graphics tier: **MED** (raise to HIGH/MAX if your PC can take it)

### Clean procedural generation
- Hard **exclusion bubble** around Bolt + clear **path corridor**
- Solids (rocks / forests / ruins) spawn on **flanks**, not on the highway
- Density budgets + spawn priority: Path → Terrain → Ruins → Vegetation → Details
- **Domain-warped forest density** — thickets and clearings, not random circles
- **HIGH / MAX**: richer flora; **Whisper Stars** less barren

### Terrain
- Layered CPU height (fBm + ridged + Crystal domain warp)
- Sprint score lightly bakes into **new chunks only**
- Optional GPU vertex height (MAX tier)

### Graphics tiers
| Tier | Goal |
|------|------|
| **LOW** | Best FPS · same style, lighter world |
| **MED** | Balanced (default) |
| **HIGH** | Full detail · more vegetation |
| **MAX** | Highest fidelity + GPU height |

Pick tier on the boot screen or pause menu.

## Core systems

| Module | Role |
|--------|------|
| `js/openworld.js` | Infinite chunked ground, height, scale stages |
| `js/procedural.js` | Path / Terrain / Vegetation / Ruin / Detail + biomes |
| `js/graphics.js` | Sky, materials, lights, bloom |
| `js/game.js` | Bolt, HUD, tiers, loop |
| `js/citadel.js` | Thunderwolf Citadel |
| `js/audio.js` | Procedural SFX |

### Biomes
Crystal Nebula · Ember Void · Whispering Starfields · Jade Canopy · Solar Gold · Frost Glacier · Rose Pulse

### Scale shifting
Bolt does **not** fly — he **sprints** until gravity loses:  
**Paw → Planetary → Orbital → Solar → Cosmic**  
Surface by default; **Shift + Space** commits ascent.

## Controls

| Key | Action |
|-----|--------|
| WASD | Move |
| Shift | Sprint |
| Space | Jump / ascent commit |
| Mouse | Look (third-person) |
| H | Howl |
| L | Decrees |
| J | Quest |
| P | Progress / Pack Memory |
| M | Mute |
| Esc | Pause · graphics tier |

## Files

```
index.html
css/style.css
js/three.min.js
js/graphics.js
js/procedural.js
js/openworld.js
js/game.js
js/citadel.js
js/audio.js
js/trail.js
js/debris.js
```

Powered by xAI & YOU · AROOO ⚡🐺
