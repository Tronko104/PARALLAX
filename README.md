# PARALLAX — A Universe Beyond Observation

> **Note:** **PARALLAX** is an ambitious **vibe-coded** experimental project — architected and built through natural-language collaborative engineering.

[![Release](https://img.shields.io/github/v/release/Tronko104/PARALLAX?style=flat-square&color=e5a93c)](https://github.com/Tronko104/PARALLAX/releases)
[![Platforms](https://img.shields.io/badge/Platforms-Windows%20%7C%20Linux%20%7C%20Android%20%7C%20Web-38bdf8?style=flat-square)](https://github.com/Tronko104/PARALLAX/releases)
[![WebGL2](https://img.shields.io/badge/Rendering-WebGL2%20Raymarching-34d399?style=flat-square)](#rendering-pipeline)
[![Vibe Coded](https://img.shields.io/badge/Built%20With-Vibe%20Coding-e5a93c?style=flat-square)](#about)
[![License: MIT](https://img.shields.io/badge/License-MIT-94a3b8?style=flat-square)](./LICENSE)

**PARALLAX** is a procedural, virtually infinite, persistent multi-scale universe simulator powered by **WebGL2 / GLSL volumetric raymarching** and deterministic astrophysical, geophysical, astrobiological, and sociological solvers.

Available as ready-to-install native applications for **Windows**, **Linux**, and **Android**, as well as an offline standalone web build — traverse **26 continuous orders of spatial magnitude** ($10^{25.5}\text{ m} \rightarrow 10^{0}\text{ m}$) from dark-matter cosmic web filaments down to alien planetary horizons, living biospheres, and Kardashev civilizations.

---

## Install & Download (Windows, Linux, Android)

Download pre-built, ready-to-install packages directly from **[GitHub Releases](https://github.com/Tronko104/PARALLAX/releases)** — no developer tools or manual compilation required:

| Platform | Package | How to Run |
| :--- | :--- | :--- |
| **Windows (x64)** | `PARALLAX-*-Windows-nsis.exe` | Run the installer for Desktop & Start Menu shortcuts |
| **Windows Portable** | `PARALLAX-*-Windows-portable.exe` | Double-click to launch directly without installing |
| **Linux (Universal)** | `PARALLAX-*-Linux-x86_64.AppImage` | `chmod +x PARALLAX-*.AppImage && ./PARALLAX-*.AppImage` |
| **Linux (Debian/Ubuntu)** | `PARALLAX-*-Linux-amd64.deb` | `sudo apt install ./PARALLAX-*.deb` |
| **Android (7.0+)** | `PARALLAX-*-Android.apk` | Download and install directly on your Android phone or tablet |
| **Offline Web** | `PARALLAX-*-Web-Standalone.html` | Open directly in any modern WebGL2 browser |

---

## Seven Continuous Scales of Exploration

1. **Cosmos ($10^{25}\text{ m}$ — Infinite Cosmic Web)**
   - Volumetric dark-matter and baryonic filaments, supercluster gravitational attractors, cosmic voids ($\delta < -0.7$), virial mass estimates, cosmological redshift ($z$), and infinite 3D sector navigation (`[sx, sy, sz]`).
2. **Galaxy ($10^{21}\text{ m}$ — Volumetric Radiative Transfer)**
   - Hubble morphological types (`SA(s)bc`, `SB(r)b`, `SA(s)c`, `E2`, `S0`, `Irr-I`), rotating spiral density waves, dust absorption lanes, ionized HII emission nebulae ($H\alpha$ / $[O\,\text{III}]$), and central Supermassive Black Holes (`SMBH`) with relativistic AGN polar jets.
3. **Star Sector & Exotic Remnants ($10^{17}\text{ m}$ — Stellar Evolution)**
   - Spectral classes `O, B, A, F, G, K, M` with Planck blackbody radiation colors, convective granulation, T-Tauri protostars, Red Giants, Supergiants, Planetary Nebulae, White Dwarfs (`DA`), spinning Magnetar Pulsars (`PSR`), and **Gravitationally Lensed Black Holes (`BH`)** with double-imaged Doppler-beamed accretion disks and photon rings.
4. **Star System ($10^{12}\text{ m}$ — Keplerian Mechanics)**
   - Exact 3D Keplerian orbital solver ($M = E - e \sin E$ via Newton-Raphson), Circumstellar Habitable Zone (`CHZ`), Frost Line, asteroid belts, dual-tail comets, and multi-moon systems.
5. **Planet ($10^{7}\text{ m}$ — Geophysics & Climate)**
   - Raymarched 3D planetary globes with tectonic relief, procedural impact craters with raised rims, **tidally locked eyeball-world climates**, Fresnel specular oceans, active volcanic fissures, polar ice caps, dynamic volumetric cloud shadows, Cassini planetary rings, Rayleigh/Mie sunset scattering, polar auroras, and nocturnal city light grids.
6. **Surface & Life ($10^{3}\text{ m}$ — Planetary Horizon & Astrobiology)**
   - Seamless descent through the atmosphere onto a real-time 3D raymarched landscape with alien skies, visible companion moons & rings, animated waves, and WASD/touch surface flight.
   - **Astrobiology Engine:** Abiogenesis, solvent biochemistry, photosynthetic pigmentation tuned to host star spectrum, trophic food webs, and procedural biomechanical organism morphology.
7. **Biosphere & Civilization ($10^{0}\text{ m}$ — Technosphere & Chronicles)**
   - Cognitive emergence, Kardashev Scale progression ($K \in [0.15, 2.45]$), cultural ethos, cooperation vs. conflict indices, orbital megastructures (Orbital Rings, Space Elevators, Dyson Swarms), and a persistent **Historical Chronicle**.

---

## Controls & Instruments

- **Orbit / Look:** Drag with mouse or 1 finger
- **Continuous Scale Zoom (26 Orders):** Mouse wheel, 2-finger pinch-to-zoom, scale slider, or keys `1`–`7` / `Q` & `E`
- **Surface & Orbital Flight:** `W / A / S / D` or Arrow keys
- **Cosmic Wonders & Infinite Sector Jump:** Click `✦ WONDERS` to visit Black Holes, Pulsars, Eyeball Worlds, Red Giants, or jump into deep uncharted `[sx, sy, sz]` sectors
- **Cinematic Autopilot Tour:** Press `T` or click `TOUR`
- **Pure Observation (Zen) Mode:** Press `H` or click `ZEN`
- **Pause / Resume Time:** Press `Space`
- **Procedural WebAudio Soundscape:** Press `M` or click `AUDIO`
- **Universe Snapshots:** Export and import your evolved universe state as JSON

---

## Development & Building from Source

```bash
git clone https://github.com/Tronko104/PARALLAX.git
cd PARALLAX

# Run web dev server
npm run dev

# Build standalone offline web + Android assets bundle
npm run bundle

# Run desktop app locally (Electron)
npm install
npm start

# Package native desktop installers
npm run dist:win     # Windows NSIS installer + Portable .exe
npm run dist:linux   # Linux AppImage + .deb
```

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

Released under the [MIT License](./LICENSE).
