# Transfer Bolt Engine to another computer (Grok Build)

## What’s in this project
Self-contained HTML + JS game engine (~1.1 MB). **No npm install required.**

```
bolt-engine/
  index.html
  css/style.css
  js/
    three.min.js
    game.js, procedural.js, openworld.js, graphics.js
    citadel.js, audio.js, debris.js, trail.js
  serve.ps1
  README.md
```

## Option A — Zip (easiest)

### On this PC
1. Zip is on Desktop: `bolt-engine-transfer.zip`  
   (or zip the whole `C:\Users\RM\bolt-engine` folder yourself)
2. Copy via USB, OneDrive, Google Drive, email, etc.

### On the other PC
1. Unzip to e.g. `C:\Users\YOU\bolt-engine` (or your Documents folder)
2. Open **Grok Build**
3. Open that folder as the workspace (`File → Open Folder` / open project)
4. Open `index.html` and run with a local server if needed:
   - Double-click `serve.ps1`, **or**
   - In PowerShell: `cd path\to\bolt-engine; .\serve.ps1`
5. Hard-refresh browser: **Ctrl+F5**

## Option B — USB / cloud folder copy
Copy the entire `bolt-engine` folder (not only `index.html` — keep the `js/` and `css/` structure).

## Option C — Git (if you use GitHub)
```bash
cd C:\Users\RM\bolt-engine
git init
git add .
git commit -m "Bolt Engine Spiral-47 full prototype"
# create a repo on GitHub, then:
git remote add origin https://github.com/YOUR_USER/bolt-engine.git
git push -u origin main
```
On the other PC: `git clone ...` then open the folder in Grok Build.

## After transfer — check
- [ ] All files under `js/` and `css/` are present  
- [ ] Game boots (click **AROOOO — ENTER THE BOLTVERSE**)  
- [ ] Brand shows recent version (e.g. **v1.4 · FLANKS**)  
- [ ] Sprint + Gate still generates world content  

## Notes
- Browser **localStorage** saves (Pack Memory) do **not** transfer with the zip — they’re per browser/machine.
- Prefer a local server (`serve.ps1`) over `file://` for best compatibility.
- Grok Build does not need Node for this project.
