# PARALLAX — A Universe Beyond Observation

> **Note:** **PARALLAX** is an ambitious **vibe-coded** experimental project — architected and implemented through natural-language collaborative coding.

[![WebGL2](https://img.shields.io/badge/Rendering-WebGL2%20Raymarching-38bdf8?style=flat-square)](#rendering-pipeline)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-Zero%20Runtime-34d399?style=flat-square)](#architecture)
[![Vibe Coded](https://img.shields.io/badge/Built%20With-Vibe%20Coding-e5a93c?style=flat-square)](#about)
[![License: MIT](https://img.shields.io/badge/License-MIT-94a3b8?style=flat-square)](./LICENSE)

**PARALLAX** is a procedural, virtually infinite, persistent multi-scale universe simulator powered by **WebGL2 / GLSL volumetric raymarching** and deterministic astrophysical, geological, biological, and sociological solvers.

Explore a single coherent universe continuously across **26 orders of spatial magnitude** ($10^{25.5}\text{ m} \rightarrow 10^{0}\text{ m}$) and temporal scales spanning from real-time planetary weather to billions of years of stellar evolution.

---

## About

PARALLAX is designed not as a static planetarium or simple star-map, but as a living, persistent simulated universe where every structure has an identity, physical history, and causal continuity.

- **100% Deterministic & Reproducible:** Hierarchical 32-bit FNV/Mulberry32 seed hashing guarantees every supercluster, galaxy, star, planet, continent, clade, and civilization is identical for a given `SEED`.
- **Persistent State & Deltas:** Time progression, stellar evolution steps, asteroid impacts, evolutionary surges, and Kardashev breakthroughs persist in `localStorage` and dynamically feed back into climate, biospheres, and planetary chronicles.
- **Zero External Runtime Dependencies:** Built cleanly in vanilla ES Modules, HTML5, CSS, WebGL2 GLSL, and WebAudio, plus a self-contained single-file standalone bundler (`dist/index.html`).

---

## Seven Continuous Scales of Exploration

1. **Cosmos ($10^{25}\text{ m}$ — Cosmological Scale)**
   - Volumetric Cosmic Web filaments of dark and baryonic matter, supercluster gravitational nodes, cosmic voids ($\delta < -0.7$), virial mass estimates, and cosmological redshift ($z$).
2. **Galaxy ($10^{21}\text{ m}$ — Galactic Scale)**
   - Hubble morphological types (`SA(s)bc`, `SB(r)b`, `SA(s)c`, `E2`, `S0`, `Irr-I`), central Supermassive Black Holes (`SMBH`), interstellar dust lanes, and ionized HII star-forming nebulae ($H\alpha$ / $[O\,\text{III}]$).
3. **Star Sector & Stars ($10^{17}\text{ m}$ — Stellar Scale)**
   - Spectral classes `O, B, A, F, G, K, M` with Planck blackbody radiation colors, T-Tauri protostars, Main Sequence fusion, Subgiants, Red Giants, Supergiants, Planetary Nebulae, White Dwarfs (`DA`), Neutron Stars / Pulsars (`PSR`), and Stellar Black Holes (`BH`) with relativistic accretion disks and photon rings.
4. **Star System ($10^{12}\text{ m}$ — Orbital Dynamics)**
   - Exact 3D Keplerian orbital mechanics ($M = E - e \sin E$ solved via Newton-Raphson), Circumstellar Habitable Zone (`CHZ`), Frost Line, asteroid belts, dual-tail comets, and multi-moon systems.
5. **Planet ($10^{7}\text{ m}$ — Global Scale)**
   - 3D raymarched planetary globes featuring multifractal FBM/Ridge topography, tectonic relief, Fresnel specular oceans, active volcanism, polar ice caps, dynamic volumetric cloud shadows, planetary rings with Cassini gaps, Rayleigh/Mie atmospheric scattering, polar auroras, and nocturnal city lights.
6. **Surface & Life ($10^{3}\text{ m}$ — Planetary Horizon & Astrobiology)**
   - Seamless atmospheric descent onto a real-time 3D raymarched planetary surface (mountains, animated oceans, alien sky scattering, rings/sun overhead).
   - **Astrobiology Engine:** Abiogenesis, solvent biochemistry, photosynthetic pigmentation tuned to host star temperature, multi-level trophic food webs, procedural biomechanical organism morphology, and mass-extinction/speciation cycles.
7. **Biosphere & Civilization ($10^{0}\text{ m}$ — Technosphere & Xeno-Sociology)**
   - Cognitive emergence, Kardashev Scale progression ($K \in [0.15, 2.45]$), cultural ethos, cooperation vs. conflict dynamics, orbital megastructures (Orbital Rings, Space Elevators, Dyson Swarms), and a persistent **Historical Chronicle**.

---

## Scientific Observatory HUD & Controls

- **Continuous Zoom:** Scroll wheel, the logarithmic scale slider (`10^25.5 m` down to `10^0 m`), scale preset buttons (`1`–`7`), or the top hierarchical cosmic breadcrumb.
- **3D Orbital Camera & Picking:** Drag to orbit in 3D space; click superclusters, galaxies, stars, planets, surface landmarks, or organism clades directly inside the viewport.
- **Bio / SETI Scanner (`◉ BIO / SETI SCAN`):** Automatically surveys the current stellar sector for spectroscopic biosignatures or technosignatures and flies directly to the next inhabited world.
- **Live Scientific Instruments:**
  - Real-time **Hertzsprung-Russell (H-R) Evolutionary Diagram**
  - **Atmospheric Absorption Spectrogram** ($380\text{–}780\text{ nm}$) showing molecular bands ($\text{O}_2, \text{H}_2\text{O}, \text{CH}_4, \text{CO}_2, \text{N}_2$)
- **Time Dilation & Causal Phenomena:** Step time from `PAUSE` and `1x` real-time up to `200 Myr/s`, or trigger **Stellar Evolution**, **Bolide Impact**, **Evolution Surge**, and **Kardashev Leap**.
- **Pure Observation Mode (`H`):** Toggle Zen Mode to hide side panels and view the cosmos uninterrupted.
- **Procedural WebAudio Soundscape (`AUDIO`):** Optional real-time deep-space harmonic drone modulated by spatial scale and stellar temperature.

---

## Repository Structure

```text
PARALLAX/
├── .github/
│   ├── ISSUE_TEMPLATE/         # Bug report and feature request templates
│   └── workflows/ci.yml        # Automated syntax & standalone bundle CI check
├── dist/
│   └── index.html              # Zero-dependency standalone build
├── scripts/
│   └── bundle_artifact.js      # Bundles ES modules & CSS into dist/index.html
├── src/
│   ├── main.js                 # Application bootstrapper & frame scheduler
│   ├── audio/soundscape.js     # WebAudio deep-space acoustic synthesizer
│   ├── math/prng.js            # Deterministic hashing, 3D noise, Planck & Kepler solvers
│   ├── renderer/
│   │   ├── shaders.js          # WebGL2 GLSL volumetric & raymarching shaders
│   │   └── webgl_renderer.js   # WebGL2 pipeline + 3D projective vector overlay
│   ├── simulation/engine.js    # Multi-scale time dilation, persistence & causal engine
│   ├── styles/index.css        # Scientific observatory design system (Vanilla CSS)
│   ├── ui/hud.js               # HUD controller, H-R diagram, spectrometer & chronicle
│   └── universe/generator.js   # Procedural cosmos, galaxy, star, planet, bio & civ generator
├── CONTRIBUTING.md
├── LICENSE
├── index.html
└── package.json
```

---

## Quick Start

### Run Locally

```bash
git clone https://github.com/Tronko104/PARALLAX.git
cd PARALLAX
npm run dev
```

Then open `http://localhost:4173` in any WebGL2-capable browser.

### Build Standalone Single-File Bundle

```bash
npm run bundle
```

This compiles all ES modules and stylesheets into a single zero-dependency `dist/index.html` file that runs cleanly offline.

---

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on extending shaders, astrophysical models, astrobiology clades, or UI telemetry.

## License

Released under the [MIT License](./LICENSE).
