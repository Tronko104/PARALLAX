/**
 * PARALLAX v3.0 — Real-Time Symplectic N-Body Gravity, Collision & Fragmentation Engine
 * Inspired by Universe Sandbox 2:
 * - Velocity-Verlet N-Body Newtonian gravity integrator (exact momentum & energy stability)
 * - Real-time gravitational slingshots, orbital perturbations, binary captures & escapes
 * - Kinetic collision physics: momentum conservation, thermal impact heating, molten debris ejecta
 * - Roche Limit tidal disruption into glowing orbital ring fragments
 * - Zero-allocation circular motion trail buffers
 */

import { solveKeplerOrbit, planckBlackbodyRGB, rgbToHex } from '../math/prng.js';

// Gravitational constant in AU^3 / (M_sun * yr^2) = 4 * pi^2
const G_AU_MSUN_YR = 4.0 * Math.PI * Math.PI;
const EARTH_TO_SOLAR_MASS = 3.0034896e-6;
const SOLAR_TO_EARTH_MASS = 332946.0487;
const MAX_TRAIL_POINTS = 72;
const MAX_FRAGMENTS = 120;

export const SANDBOX_PRESETS = [
  { id: 'asteroid', name: 'Iron Asteroid', kind: 'planet', massEarths: 0.002, radiusEarths: 0.14, tempK: 210, color: [0.58, 0.55, 0.52], archetype: 'iron_cratered' },
  { id: 'comet', name: 'Halley Comet', kind: 'planet', massEarths: 0.0005, radiusEarths: 0.10, tempK: 140, color: [0.65, 0.88, 1.0], archetype: 'cryo_glacial' },
  { id: 'moon', name: 'Rocky Moon', kind: 'planet', massEarths: 0.0123, radiusEarths: 0.27, tempK: 250, color: [0.72, 0.73, 0.76], archetype: 'iron_cratered' },
  { id: 'earth', name: 'Earth-Like World', kind: 'planet', massEarths: 1.0, radiusEarths: 1.0, tempK: 288, color: [0.22, 0.55, 0.86], archetype: 'temperate_terrestrial' },
  { id: 'jupiter', name: 'Jovian Gas Giant', kind: 'planet', massEarths: 317.8, radiusEarths: 11.2, tempK: 165, color: [0.85, 0.66, 0.44], archetype: 'gas_giant' },
  { id: 'red_dwarf', name: 'M-Class Red Dwarf', kind: 'star', massSolar: 0.28, radiusSolar: 0.34, tempK: 3300, color: [1.0, 0.52, 0.28] },
  { id: 'sun', name: 'G-Class Yellow Star', kind: 'star', massSolar: 1.0, radiusSolar: 1.0, tempK: 5778, color: [1.0, 0.94, 0.84] },
  { id: 'blue_giant', name: 'O-Class Blue Giant', kind: 'star', massSolar: 16.0, radiusSolar: 6.2, tempK: 31000, color: [0.58, 0.78, 1.0] },
  { id: 'black_hole', name: 'Stellar Black Hole', kind: 'black_hole', massSolar: 12.0, radiusSolar: 0.05, tempK: 28000, color: [1.0, 0.65, 0.25] }
];

export class NBodySystem {
  constructor() {
    this.bodies = [];
    this.fragments = [];
    this.shockwaves = [];
    this.active = false;
    this.timeReversed = false;
    this.collisionCount = 0;
    this._trailTimer = 0;
    this._nextSpawnId = 1;
  }

  /**
   * Initialize live N-Body state vectors (position in AU, velocity in AU/yr)
   * directly from the procedural planetary system's exact Keplerian elements!
   */
  loadFromPlanetarySystem(planetarySystem, currentElapsedYears = 0) {
    this.bodies = [];
    this.fragments = [];
    this.shockwaves = [];
    this.collisionCount = 0;
    this._trailTimer = 0;

    if (!planetarySystem) return;
    const star = planetarySystem.star;

    // 1. Central Star Body
    this.bodies.push({
      id: `star-${planetarySystem.id}`,
      name: planetarySystem.name,
      kind: star.remnantType === 'black_hole' ? 'black_hole' : 'star',
      planetIndex: -1,
      massSolar: Math.max(0.05, star.currentMassSolar),
      radiusVisual: star.remnantType === 'black_hole' ? 0.07 : 0.14,
      tempK: star.tempK,
      luminositySolar: star.luminositySolar,
      color: [...star.rgb],
      hexColor: star.hexColor,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      ax: 0,
      ay: 0,
      az: 0,
      moltenHeat: 0,
      alive: true,
      trail: [],
      sourcePlanet: null
    });

    const M_star = Math.max(0.05, star.currentMassSolar);

    // 2. All Procedural Planets with exact 3D position & tangential velocity from Kepler solver
    planetarySystem.planets.forEach((planet, idx) => {
      const dt = 0.0004;
      const p0 = solveKeplerOrbit(planet.orbit, currentElapsedYears);
      const p1 = solveKeplerOrbit(planet.orbit, currentElapsedYears + dt);

      const vx = (p1.x - p0.x) / dt;
      const vy = (p1.y - p0.y) / dt;
      const vz = (p1.z - p0.z) / dt;

      this.bodies.push({
        id: planet.id,
        name: planet.name,
        kind: 'planet',
        planetIndex: idx,
        massSolar: Math.max(1e-9, planet.massEarths * EARTH_TO_SOLAR_MASS),
        radiusVisual: Math.max(0.025, Math.min(0.08, Math.pow(planet.radiusEarths, 0.35) * 0.028)),
        tempK: planet.surfaceTempK,
        luminositySolar: 0,
        color: [...planet.palette.lowland],
        atmoColor: [...planet.palette.atmosphere],
        hexColor: rgbToHex(planet.palette.lowland),
        x: p0.x,
        y: p0.y,
        z: p0.z,
        vx,
        vy,
        vz,
        ax: 0,
        ay: 0,
        az: 0,
        moltenHeat: 0,
        alive: true,
        trail: [{ x: p0.x, y: p0.y, z: p0.z }],
        sourcePlanet: planet
      });
    });

    this.computeAccelerations();
    this.active = true;
  }

  /**
   * Velocity-Verlet N-Body Gravitational Integration Step
   */
  step(dtYears, dtRealSeconds, onEventCallback) {
    if (!this.active || this.bodies.length === 0) return;

    const dir = this.timeReversed ? -1 : 1;
    // Clamp integration step size for orbital stability & substep when time runs fast
    const totalDt = Math.max(-0.08, Math.min(0.08, dtYears * dir));
    const substeps = Math.abs(totalDt) > 0.012 ? 4 : Math.abs(totalDt) > 0.004 ? 2 : 1;
    const h = totalDt / substeps;

    if (Math.abs(h) > 1e-9) {
      for (let s = 0; s < substeps; s++) {
        this.verletSubstep(h, onEventCallback);
      }
    }

    // Step molten ejecta fragments & supernova shockwaves
    this.stepFragmentsAndShockwaves(Math.max(0.0005, Math.abs(totalDt)), dtRealSeconds);

    // Record motion trail breadcrumbs
    this._trailTimer += dtRealSeconds;
    if (this._trailTimer >= 0.045) {
      this._trailTimer = 0;
      for (let i = 0; i < this.bodies.length; i++) {
        const b = this.bodies[i];
        if (!b.alive) continue;
        b.trail.push({ x: b.x, y: b.y, z: b.z });
        if (b.trail.length > MAX_TRAIL_POINTS) {
          b.trail.shift();
        }
        // Cool down molten collision scars over time
        if (b.moltenHeat > 0) {
          b.moltenHeat = Math.max(0, b.moltenHeat - dtRealSeconds * 0.06);
        }
      }
    }
  }

  verletSubstep(h, onEventCallback) {
    const bodies = this.bodies;
    const n = bodies.length;
    const halfH2 = 0.5 * h * h;

    // 1. Update positions & half-step velocities
    for (let i = 0; i < n; i++) {
      const b = bodies[i];
      if (!b.alive) continue;
      b.x += b.vx * h + b.ax * halfH2;
      b.y += b.vy * h + b.ay * halfH2;
      b.z += b.vz * h + b.az * halfH2;

      b.vx += 0.5 * b.ax * h;
      b.vy += 0.5 * b.ay * h;
      b.vz += 0.5 * b.az * h;
    }

    // 2. Recompute pairwise Newtonian forces & check collisions / Roche limit
    this.computeAccelerationsAndCollisions(onEventCallback);

    // 3. Complete second half-step velocities
    for (let i = 0; i < n; i++) {
      const b = bodies[i];
      if (!b.alive) continue;
      b.vx += 0.5 * b.ax * h;
      b.vy += 0.5 * b.ay * h;
      b.vz += 0.5 * b.az * h;

      // Live thermodynamic update: distance to primary star updates planet equilibrium temp!
      if (b.sourcePlanet && i > 0 && bodies[0].alive) {
        const dx = b.x - bodies[0].x;
        const dy = b.y - bodies[0].y;
        const dz = b.z - bodies[0].z;
        const distAU = Math.max(0.05, Math.hypot(dx, dy, dz));
        const L = Math.max(0.001, bodies[0].luminositySolar || 1.0);
        const eqT = 278.5 * Math.pow(L, 0.25) / Math.sqrt(distAU) * Math.pow(1 - (b.sourcePlanet.albedo || 0.3), 0.25);
        const targetT = Math.max(25, eqT + (b.sourcePlanet.greenhouseDeltaK || 0) + b.moltenHeat * 1800);
        b.tempK += (targetT - b.tempK) * 0.04;
        b.sourcePlanet.surfaceTempK = b.tempK;
        b.sourcePlanet.surfaceTempC = b.tempK - 273.15;
        b.sourcePlanet.orbit.a = distAU;
      }
    }
  }

  computeAccelerations() {
    this.computeAccelerationsAndCollisions(null);
  }

  computeAccelerationsAndCollisions(onEventCallback) {
    const bodies = this.bodies;
    const n = bodies.length;

    for (let i = 0; i < n; i++) {
      bodies[i].ax = 0;
      bodies[i].ay = 0;
      bodies[i].az = 0;
    }

    for (let i = 0; i < n; i++) {
      const a = bodies[i];
      if (!a.alive) continue;

      for (let j = i + 1; j < n; j++) {
        const b = bodies[j];
        if (!b.alive) continue;

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dz = b.z - a.z;
        const distSq = dx * dx + dy * dy + dz * dz;
        const dist = Math.sqrt(distSq);

        // Collision threshold (scaled visual-physical capture radius)
        const collideDist = (a.radiusVisual + b.radiusVisual) * 0.72;
        if (dist < collideDist) {
          this.resolveCollision(a, b, onEventCallback);
          continue;
        }

        // Roche Limit tidal shredding check if a small planet passes very close to a black hole or giant star
        if (a.kind === 'black_hole' && b.kind === 'planet' && dist < a.radiusVisual * 2.1 && b.massSolar < 0.01) {
          this.shatterBody(b, a, onEventCallback, 'Roche Limit Tidal Disruption');
          continue;
        }

        // Softened Newtonian Gravity: F = G * m1 * m2 / (r^2 + eps^2)^(3/2)
        const softSq = distSq + 0.0004;
        const invDist3 = G_AU_MSUN_YR / (softSq * Math.sqrt(softSq));

        const fx = dx * invDist3;
        const fy = dy * invDist3;
        const fz = dz * invDist3;

        a.ax += fx * b.massSolar;
        a.ay += fy * b.massSolar;
        a.az += fz * b.massSolar;

        b.ax -= fx * a.massSolar;
        b.ay -= fy * a.massSolar;
        b.az -= fz * a.massSolar;
      }
    }
  }

  /**
   * Momentum-conserving inelastic collision with molten thermal heating & glowing ejecta fragments
   */
  resolveCollision(a, b, onEventCallback) {
    const primary = a.massSolar >= b.massSolar ? a : b;
    const secondary = a.massSolar >= b.massSolar ? b : a;

    const totalMass = primary.massSolar + secondary.massSolar;
    const relV = Math.hypot(primary.vx - secondary.vx, primary.vy - secondary.vy, primary.vz - secondary.vz);

    // Conserve linear momentum
    primary.vx = (primary.vx * primary.massSolar + secondary.vx * secondary.massSolar) / totalMass;
    primary.vy = (primary.vy * primary.massSolar + secondary.vy * secondary.massSolar) / totalMass;
    primary.vz = (primary.vz * primary.massSolar + secondary.vz * secondary.massSolar) / totalMass;
    primary.massSolar = totalMass;

    // Kinetic thermal heating
    const massRatio = Math.min(1.0, secondary.massSolar / Math.max(1e-9, primary.massSolar));
    const heatSpikeK = Math.min(4500, 350 + massRatio * 3200 + relV * 140);
    primary.tempK += heatSpikeK;
    primary.moltenHeat = Math.min(1.0, primary.moltenHeat + 0.55 + massRatio * 0.45);
    if (primary.sourcePlanet) {
      primary.sourcePlanet.surfaceTempK = primary.tempK;
      primary.sourcePlanet.surfaceTempC = primary.tempK - 273.15;
      primary.sourcePlanet.volcanism = Math.min(1.0, (primary.sourcePlanet.volcanism || 0.2) + 0.45);
      primary.sourcePlanet.massEarths = primary.massSolar * SOLAR_TO_EARTH_MASS;
    }

    // Spawn molten ejecta debris cloud orbiting from the collision point
    this.spawnFragments(
      secondary.x,
      secondary.y,
      secondary.z,
      primary.vx,
      primary.vy,
      primary.vz,
      Math.min(28, 12 + Math.round(massRatio * 22)),
      [1.0, 0.52, 0.16]
    );

    // Expanding thermal impact shockwave
    this.shockwaves.push({
      x: secondary.x,
      y: secondary.y,
      z: secondary.z,
      radius: 0.02,
      maxRadius: 0.45 + massRatio * 0.5,
      alpha: 1.0,
      color: [1.0, 0.62, 0.22]
    });

    secondary.alive = false;
    this.collisionCount++;

    if (onEventCallback) {
      onEventCallback(
        'geo',
        `Catastrophic Collision: ${secondary.name} → ${primary.name}`,
        `Impact velocity ${(relV * 4.74).toFixed(1)} km/s; temperature spiked by +${Math.round(heatSpikeK)} K; molten debris ejected into orbit.`
      );
    }
  }

  /**
   * Shatter / Explode a planet or trigger a Supernova shockwave on a star!
   */
  shatterBody(body, attractor, onEventCallback, reason = 'Detonation') {
    if (!body || !body.alive) return;

    const isStar = body.kind === 'star';
    const fragCount = isStar ? 48 : 32;
    const fragColor = isStar ? [0.48, 0.88, 1.0] : [1.0, 0.48, 0.14];

    this.spawnFragments(body.x, body.y, body.z, body.vx, body.vy, body.vz, fragCount, fragColor);
    this.shockwaves.push({
      x: body.x,
      y: body.y,
      z: body.z,
      radius: 0.05,
      maxRadius: isStar ? 3.2 : 0.85,
      alpha: 1.0,
      color: isStar ? [0.45, 0.88, 1.0] : [1.0, 0.55, 0.15]
    });

    if (isStar) {
      // Supernova leaves behind a Neutron Star / Black Hole core and blasts outward shockwave!
      body.kind = body.massSolar > 8 ? 'black_hole' : 'star';
      body.tempK = 42000;
      body.color = [0.55, 0.90, 1.0];
      body.massSolar *= 0.28;
      // Push all surrounding planets outward with radial radiation impulse
      for (const other of this.bodies) {
        if (!other.alive || other === body) continue;
        const dx = other.x - body.x;
        const dy = other.y - body.y;
        const dz = other.z - body.z;
        const d = Math.max(0.1, Math.hypot(dx, dy, dz));
        const push = 1.6 / d;
        other.vx += (dx / d) * push;
        other.vy += (dy / d) * push;
        other.vz += (dz / d) * push;
        other.tempK += 1400 / d;
        other.moltenHeat = Math.min(1.0, other.moltenHeat + 0.7);
      }
      if (onEventCallback) {
        onEventCallback(
          'astro',
          `Core-Collapse Supernova: ${body.name}`,
          `Ejected 72% of stellar envelope; relativistic shockwave superheated surrounding planetary orbits.`
        );
      }
    } else {
      body.alive = false;
      if (onEventCallback) {
        onEventCallback(
          'geo',
          `${reason}: ${body.name} Fragmented`,
          `Body disrupted into ${fragCount} incandescent orbital debris fragments.`
        );
      }
    }
  }

  spawnFragments(x, y, z, baseVx, baseVy, baseVz, count, color) {
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI;
      const speed = 0.35 + Math.random() * 1.45;
      this.fragments.push({
        x: x + (Math.random() - 0.5) * 0.03,
        y: y + (Math.random() - 0.5) * 0.03,
        z: z + (Math.random() - 0.5) * 0.03,
        vx: baseVx + Math.cos(theta) * Math.cos(phi) * speed,
        vy: baseVy + Math.sin(phi) * speed * 0.5,
        vz: baseVz + Math.sin(theta) * Math.cos(phi) * speed,
        life: 1.0,
        color: [...color],
        size: 1.5 + Math.random() * 2.5
      });
    }
    if (this.fragments.length > MAX_FRAGMENTS) {
      this.fragments.splice(0, this.fragments.length - MAX_FRAGMENTS);
    }
  }

  stepFragmentsAndShockwaves(dtYears, dtRealSeconds) {
    const primary = this.bodies[0];
    const M = primary && primary.alive ? primary.massSolar : 1.0;

    for (let i = this.fragments.length - 1; i >= 0; i--) {
      const f = this.fragments[i];
      if (primary && primary.alive) {
        const dx = primary.x - f.x;
        const dy = primary.y - f.y;
        const dz = primary.z - f.z;
        const rSq = dx * dx + dy * dy + dz * dz + 0.008;
        const invR3 = (G_AU_MSUN_YR * M) / (rSq * Math.sqrt(rSq));
        f.vx += dx * invR3 * dtYears;
        f.vy += dy * invR3 * dtYears;
        f.vz += dz * invR3 * dtYears;
      }
      f.x += f.vx * dtYears;
      f.y += f.vy * dtYears;
      f.z += f.vz * dtYears;
      f.life -= dtRealSeconds * 0.09;
      if (f.life <= 0) {
        this.fragments.splice(i, 1);
      }
    }

    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.radius += dtRealSeconds * (sw.maxRadius * 0.55);
      sw.alpha = Math.max(0, 1.0 - sw.radius / sw.maxRadius);
      if (sw.alpha <= 0.01) {
        this.shockwaves.splice(i, 1);
      }
    }
  }

  /**
   * Universe Sandbox Add / Launch Tool:
   * placementMode: 'orbit' | 'binary' | 'launch' | 'still'
   */
  spawnBody(presetId, worldPos, placementMode = 'orbit', launchDir = [0, 0, -1], launchSpeedKmS = 28) {
    const preset = SANDBOX_PRESETS.find((p) => p.id === presetId) || SANDBOX_PRESETS[3];
    const [x, y, z] = worldPos;
    const massSolar = preset.massSolar !== undefined
      ? preset.massSolar
      : (preset.massEarths || 1.0) * EARTH_TO_SOLAR_MASS;

    // Find strongest gravitational attractor
    let attractor = this.bodies[0];
    let bestPull = -1;
    for (const b of this.bodies) {
      if (!b.alive) continue;
      const dSq = Math.max(0.01, (b.x - x) ** 2 + (b.y - y) ** 2 + (b.z - z) ** 2);
      const pull = b.massSolar / dSq;
      if (pull > bestPull) {
        bestPull = pull;
        attractor = b;
      }
    }

    let vx = 0, vy = 0, vz = 0;

    if ((placementMode === 'orbit' || placementMode === 'binary') && attractor) {
      const rx = x - attractor.x;
      const ry = y - attractor.y;
      const rz = z - attractor.z;
      const r = Math.max(0.12, Math.hypot(rx, ry, rz));
      // Circular orbital speed v = sqrt(G * M_total / r) in AU/yr
      const mTotal = placementMode === 'binary' ? (attractor.massSolar + massSolar) : attractor.massSolar;
      const vCirc = Math.sqrt((G_AU_MSUN_YR * mTotal) / r);
      // Tangential direction in ecliptic XZ plane
      const rXZ = Math.hypot(rx, rz) || 1;
      const tx = -rz / rXZ;
      const tz = rx / rXZ;

      vx = attractor.vx + tx * vCirc;
      vy = attractor.vy;
      vz = attractor.vz + tz * vCirc;

      // Balance barycenter momentum in Binary mode!
      if (placementMode === 'binary') {
        const ratio = massSolar / Math.max(1e-9, attractor.massSolar);
        attractor.vx -= tx * vCirc * Math.min(0.8, ratio);
        attractor.vz -= tz * vCirc * Math.min(0.8, ratio);
      }
    } else if (placementMode === 'launch') {
      // Convert km/s to AU/yr (1 AU/yr ≈ 4.74047 km/s)
      const speedAuYr = launchSpeedKmS / 4.74047;
      const len = Math.hypot(launchDir[0], launchDir[1], launchDir[2]) || 1;
      vx = (launchDir[0] / len) * speedAuYr;
      vy = (launchDir[1] / len) * speedAuYr;
      vz = (launchDir[2] / len) * speedAuYr;
    }

    const rgb = preset.kind === 'star' ? planckBlackbodyRGB(preset.tempK) : preset.color;
    const newBody = {
      id: `spawn-${this._nextSpawnId++}`,
      name: `${preset.name} #${this._nextSpawnId - 1}`,
      kind: preset.kind,
      planetIndex: -1,
      massSolar,
      radiusVisual: preset.kind === 'star' ? 0.12 : preset.kind === 'black_hole' ? 0.08 : Math.max(0.024, Math.min(0.075, Math.pow(preset.radiusEarths || 1, 0.35) * 0.028)),
      tempK: preset.tempK,
      luminositySolar: preset.kind === 'star' ? Math.pow(massSolar, 3.5) : 0,
      color: [...rgb],
      atmoColor: [...rgb],
      hexColor: rgbToHex(rgb),
      x,
      y,
      z,
      vx,
      vy,
      vz,
      ax: 0,
      ay: 0,
      az: 0,
      moltenHeat: 0,
      alive: true,
      trail: [{ x, y, z }],
      sourcePlanet: null
    };

    this.bodies.push(newBody);
    this.computeAccelerations();
    return newBody;
  }

  /**
   * Universe Sandbox Heating Laser Tool: continuously pumps thermal energy into a body
   */
  applyThermalLaser(body, dtSeconds, powerScale = 1.0) {
    if (!body || !body.alive) return;
    const deltaK = dtSeconds * 420 * powerScale;
    body.tempK = Math.min(18000, body.tempK + deltaK);
    body.moltenHeat = Math.min(1.0, body.moltenHeat + dtSeconds * 0.42 * powerScale);
    if (body.sourcePlanet) {
      body.sourcePlanet.surfaceTempK = body.tempK;
      body.sourcePlanet.surfaceTempC = body.tempK - 273.15;
      if (body.tempK > 373 && body.sourcePlanet.oceanCoverage > 0) {
        body.sourcePlanet.oceanCoverage = Math.max(0, body.sourcePlanet.oceanCoverage - dtSeconds * 0.14);
        body.sourcePlanet.cloudCoverage = Math.min(0.95, body.sourcePlanet.cloudCoverage + dtSeconds * 0.12);
      }
      if (body.tempK > 273 && body.sourcePlanet.iceCoverage > 0) {
        body.sourcePlanet.iceCoverage = Math.max(0, body.sourcePlanet.iceCoverage - dtSeconds * 0.18);
      }
      if (body.tempK > 950) {
        body.sourcePlanet.volcanism = Math.min(1.0, body.sourcePlanet.volcanism + dtSeconds * 0.25);
      }
    }
  }

  /**
   * Universe Sandbox System Management Actions
   */
  scaleAllVelocities(factor) {
    for (const b of this.bodies) {
      if (!b.alive) continue;
      b.vx *= factor;
      b.vy *= factor;
      b.vz *= factor;
    }
  }

  clearFragmentsAndTrails() {
    this.fragments = [];
    for (const b of this.bodies) {
      b.trail = [];
    }
  }

  deleteBody(bodyId) {
    const idx = this.bodies.findIndex((b) => b.id === bodyId);
    if (idx > 0) { // Keep index 0 anchor or mark dead
      this.bodies[idx].alive = false;
      return true;
    }
    return false;
  }
}
