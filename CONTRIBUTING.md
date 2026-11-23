# Contributing to PARALLAX

Thank you for your interest in contributing to **PARALLAX — A Universe Beyond Observation**!

PARALLAX is a **vibe-coded** experimental project built with zero runtime dependencies using standard ES Modules, WebGL2 GLSL shaders, HTML5 Canvas, WebAudio, and Vanilla CSS.

## Development Workflow

1. **Fork & Clone** the repository:
   ```bash
   git clone https://github.com/Tronko104/PARALLAX.git
   cd PARALLAX
   ```
2. **Run the local dev server**:
   ```bash
   npm run dev
   ```
3. **Make your changes** cleanly inside `src/`. Keep modules self-contained and free of external runtime dependencies.
4. **Rebuild & verify the standalone bundle**:
   ```bash
   npm run bundle
   ```
5. **Verify ES module syntax and simulation integrity** before opening a Pull Request:
   ```bash
   node --check src/main.js
   ```

## Areas Open for Expansion

- **Astrophysics & Relativity:** Binary mass transfer, gravitational microlensing, pulsar timing arrays, exoplanet ring dynamics.
- **Planetary Science:** Plate tectonic drift over Gyr timescales, atmospheric escape, tidal locking heat distribution.
- **Astrobiology & Civilizations:** Speciation trees, inter-system colonization routes, megastructure construction stages.
- **WebGL2 Shaders:** Volumetric cloud raymarching, deeper surface biome scatter, relativistic jet shaders.
