/**
 * PARALLAX — Persistent Multi-Scale Time & Evolution Simulation Engine
 * Coordinates:
 * - Continuous logarithmic spatial scale (10^25.5 m down to 10^0 m)
 * - Multi-scale time dilation (Real-time seconds -> Orbital years -> Evolutionary Myr -> Stellar Gyr)
 * - Background autonomous universe evolution & event stream across unobserved sectors
 * - Causal astrophysical, geophysical, biological & civilization state transitions
 * - LocalStorage persistence & snapshot export/import
 */

import {
  SCALE_LEVELS,
  generateCosmicWeb,
  generateGalaxiesForSupercluster,
  generateStellarSector,
  generatePlanetarySystem,
  computeStellarEvolutionState
} from '../universe/generator.js';
import { solveKeplerOrbit, PRNG, hashHierarchy } from '../math/prng.js';
import { NBodySystem, SANDBOX_PRESETS } from './nbody.js';

export { SANDBOX_PRESETS };

export const TIME_SCALES = [
  { id: 'pause', label: 'PAUSE', short: '0x', yearsPerSec: 0, visualSpeed: 0.0, desc: 'Simulation paused' },
  { id: 'realtime', label: 'Real Time', short: '1x', yearsPerSec: 1 / 31557600, visualSpeed: 0.35, desc: 'Real-time surface and atmospheric dynamics' },
  { id: 'hours', label: 'Planetary Rotation', short: '2h/s', yearsPerSec: 2 / 8766, visualSpeed: 0.85, desc: 'Day/night cycle and atmospheric circulation' },
  { id: 'days', label: 'Lunar Dynamics', short: '15d/s', yearsPerSec: 15 / 365.25, visualSpeed: 1.4, desc: 'Moon orbits and inner rocky planets' },
  { id: 'years', label: 'Orbital Mechanics', short: '1 yr/s', yearsPerSec: 1.0, visualSpeed: 2.2, desc: 'Keplerian revolutions across the planetary system' },
  { id: 'millennia', label: 'Historical & Civ Scale', short: '2 kyr/s', yearsPerSec: 2000, visualSpeed: 3.0, desc: 'Technological development, Kardashev growth & climate' },
  { id: 'megayears', label: 'Evolutionary & Tectonic', short: '5 Myr/s', yearsPerSec: 5e6, visualSpeed: 4.0, desc: 'Darwinian speciation, plate tectonics & ecosystems' },
  { id: 'gigayears', label: 'Cosmic & Stellar Scale', short: '200 Myr/s', yearsPerSec: 2e8, visualSpeed: 5.5, desc: 'H-R stellar evolution, red giants, supernovae & white dwarfs' }
];

export const COSMIC_WONDERS = [
  {
    id: 'wonder-web',
    title: 'Laniakea-Prime Cosmic Web',
    category: 'Cosmology • 10²⁵ m',
    desc: 'Dark-matter filaments and supercluster attractors spanning hundreds of megaparsecs.',
    scIdx: 0, galIdx: 0, sysIdx: 0, plIdx: 2, scaleIdx: 0
  },
  {
    id: 'wonder-galaxy',
    title: 'Aethelgard Grand-Design Spiral',
    category: 'Galaxy • 10²¹ m',
    desc: 'Rotating spiral density waves, HII emission nebulae, dust lanes, and central SMBH.',
    scIdx: 0, galIdx: 0, sysIdx: 0, plIdx: 2, scaleIdx: 1
  },
  {
    id: 'wonder-gaia',
    title: 'Aurelia IV (Gaia-Nova)',
    category: 'Civilization • Type 1.2',
    desc: 'Temperate living world with nocturnal city grids, equatorial orbital ring & active biosphere.',
    scIdx: 0, galIdx: 0, sysIdx: 0, plIdx: 2, scaleIdx: 4
  },
  {
    id: 'wonder-surface',
    title: 'Aurelia IV Surface Horizon',
    category: 'Planetary Surface • 10³ m',
    desc: 'Descend through the Rayleigh atmosphere to inspect alien landscapes, oceans & flora.',
    scIdx: 0, galIdx: 0, sysIdx: 0, plIdx: 2, scaleIdx: 5
  },
  {
    id: 'wonder-bh',
    title: 'Gargantua-Vex Black Hole',
    category: 'Relativity • Event Horizon',
    desc: 'Stellar-mass black hole with ray-deflected gravitational lensing & Doppler-beamed accretion disk.',
    scIdx: 0, galIdx: 0, sysIdx: 4, plIdx: 0, scaleIdx: 3
  },
  {
    id: 'wonder-pulsar',
    title: 'Vela-PSR Magnetar Pulsar',
    category: 'Exotic Remnant • Neutron Star',
    desc: 'Rapidly spinning magnetized neutron star sweeping relativistic lighthouse polar jets.',
    scIdx: 0, galIdx: 0, sysIdx: 5, plIdx: 0, scaleIdx: 3
  },
  {
    id: 'wonder-eyeball',
    title: 'Terminus III (Eyeball World)',
    category: 'Astrobiology • Tidally Locked',
    desc: 'M-dwarf exoplanet with a permanent sunlit ocean, twilight biosphere belt & frozen nightside.',
    scIdx: 0, galIdx: 0, sysIdx: 6, plIdx: 2, scaleIdx: 4
  },
  {
    id: 'wonder-redgiant',
    title: 'Hyperion Red Giant System',
    category: 'Stellar Evolution • RGB III',
    desc: 'Dying star swelling off the Main Sequence, superheating inner worlds & thawing outer moons.',
    scIdx: 0, galIdx: 0, sysIdx: 2, plIdx: 2, scaleIdx: 3
  },
  {
    id: 'wonder-ocean',
    title: 'Thalassa Prime Ocean World',
    category: 'Pelagic Exoplanet • 10⁷ m',
    desc: 'Global deep-ocean biosphere with bioluminescent reefs and pelagic trophic web.',
    scIdx: 0, galIdx: 0, sysIdx: 1, plIdx: 2, scaleIdx: 4
  }
];

const STORAGE_KEY = 'parallax_universe_persistence_v2';

export class SimulationEngine {
  constructor() {
    this.universeSeed = 'PARALLAX-2026-OMEGA';
    this.sectorCoords = [0, 0, 0];

    this.currentLogScale = 7.4; // Start on the breathtaking orbital view of Aurelia IV!
    this.targetLogScale = 7.4;
    this.warpFactor = 0.0;

    this.timeScaleIndex = 2; // Gentle planetary rotation on launch
    this.elapsedYears = 0.0;
    this.baseCosmicEpochGyr = 13.800;
    this.visualTime = 0.0;

    this.autopilotActive = false;
    this._autopilotTimer = 0;
    this._autopilotWonderIndex = 0;

    // Universe Sandbox 2 Interactive Physics & Controls State
    this.nbody = new NBodySystem();
    this.sandboxTool = 'select';       // 'select' | 'add' | 'laser' | 'explode'
    this.addPresetId = 'earth';
    this.addMode = 'orbit';            // 'orbit' | 'binary' | 'launch' | 'still'
    this.launchSpeedKmS = 28;
    this.laserActive = false;
    this.lightingMode = 0;             // 0: Realistic, 1: Studio, 2: Flashlight
    this.qualityMode = 'auto';         // 'auto' | 'low' | 'medium' | 'ultra'
    this.displayFlags = {
      orbits: true,
      trails: true,
      grid: false,
      hz: true,
      labels: true
    };

    this.deltas = {};
    this.bookmarks = [];
    this.globalEvents = [];

    this.cosmicWeb = null;
    this.activeSuperclusterIndex = 0;
    this.galaxies = [];
    this.activeGalaxyIndex = 0;
    this.stellarSector = null;
    this.activeSystemIndex = 0;
    this.planetarySystem = null;
    this.activePlanetIndex = 2;
    this.activeLandmarkIndex = 0;
    this.activeCladeIndex = 0;

    this.transientEffects = {
      superflareIntensity: 0.0,
      impactFlashIntensity: 0.0,
      evolutionPulseIntensity: 0.0
    };

    this.listeners = new Set();
    this._backgroundTickAccumulator = 0;

    this.loadPersistence();
    this.rebuildHierarchy();
  }

  onChange(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  emitChange(reason = 'update') {
    for (const cb of this.listeners) {
      cb(this, reason);
    }
  }

  loadPersistence() {
    try {
      if (typeof localStorage === 'undefined') return;
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed.universeSeed) this.universeSeed = parsed.universeSeed;
      if (typeof parsed.elapsedYears === 'number') this.elapsedYears = parsed.elapsedYears;
      if (parsed.deltas && typeof parsed.deltas === 'object') this.deltas = parsed.deltas;
      if (Array.isArray(parsed.bookmarks)) this.bookmarks = parsed.bookmarks;
      if (Array.isArray(parsed.globalEvents)) this.globalEvents = parsed.globalEvents.slice(0, 35);
    } catch (e) {
      // Ignore storage unavailable errors
    }
  }

  savePersistence() {
    try {
      if (typeof localStorage === 'undefined') return;
      const payload = {
        universeSeed: this.universeSeed,
        elapsedYears: this.elapsedYears,
        deltas: this.deltas,
        bookmarks: this.bookmarks,
        globalEvents: this.globalEvents.slice(0, 30)
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      // Ignore storage quota errors
    }
  }

  resetUniverse(newSeed = 'PARALLAX-2026-OMEGA') {
    this.universeSeed = newSeed.trim() || 'PARALLAX-2026-OMEGA';
    this.elapsedYears = 0;
    this.deltas = {};
    this.globalEvents = [];
    this.activeSuperclusterIndex = 0;
    this.activeGalaxyIndex = 0;
    this.activeSystemIndex = 0;
    this.activePlanetIndex = 2;
    this.rebuildHierarchy();
    this.logEvent(
      'cosmos',
      `Universal Coordinate Seed Initialized [${this.universeSeed}]`,
      'Cosmic web filaments, baryonic density fields, and Hubble constant synchronized.'
    );
    this.savePersistence();
    this.emitChange('reset');
  }

  rebuildHierarchy() {
    this.cosmicWeb = generateCosmicWeb(this.universeSeed, this.sectorCoords);
    const sc = this.getActiveSupercluster();
    this.galaxies = generateGalaxiesForSupercluster(sc);
    const gal = this.getActiveGalaxy();
    this.stellarSector = generateStellarSector(gal, 0);
    this.refreshPlanetarySystem();

    if (this.globalEvents.length === 0) {
      const homePlanet = this.getActivePlanet();
      this.logEvent(
        'cosmos',
        `Observatory Locked on ${sc.name}`,
        `Cataloged ${sc.galaxyCount.toLocaleString()} galaxies along dark-matter filaments (z = ${sc.redshift.toFixed(4)}).`
      );
      if (homePlanet && homePlanet.biosphere.active) {
        this.logEvent(
          'bio',
          `Biosignature Confirmed on ${homePlanet.name}`,
          `O₂/CH₄ atmospheric chemical disequilibrium detected; estimated biomass ${homePlanet.biosphere.biomassGt} Gt C.`
        );
      }
      if (homePlanet && homePlanet.civilization.active) {
        this.logEvent(
          'civ',
          `Kardashev ${homePlanet.civilization.kardashev.toFixed(2)} Technosignature on ${homePlanet.name}`,
          `${homePlanet.civilization.speciesName} (${homePlanet.civilization.ethos.name}) — nocturnal city grids & orbital megastructures active.`
        );
      }
    }
  }

  refreshPlanetarySystem() {
    const sysSummary = this.getActiveStarSystemSummary();
    const sysDelta = this.deltas[sysSummary.id] || {};
    const extraAgeGyr = (this.elapsedYears / 1e9) + (sysDelta.extraAgeGyr || 0);
    this.planetarySystem = generatePlanetarySystem(sysSummary, extraAgeGyr);

    for (const planet of this.planetarySystem.planets) {
      this.applyPlanetCausalityAndDeltas(planet, this.planetarySystem.star, extraAgeGyr);
    }

    if (this.activePlanetIndex >= this.planetarySystem.planets.length) {
      this.activePlanetIndex = Math.max(0, this.planetarySystem.planets.length - 1);
    }

    // Synchronize real-time Symplectic N-Body Physics Engine with the active star system
    this.nbody.loadFromPlanetarySystem(this.planetarySystem, this.elapsedYears);
  }

  applyPlanetCausalityAndDeltas(planet, star, extraAgeGyr) {
    const pDelta = this.deltas[planet.id];

    const newEqTempK = star.tempK * Math.sqrt((star.radiusSolar * 695700) / (2 * planet.orbit.a * 1.496e8)) * Math.pow(1 - planet.albedo, 0.25);

    if (Math.abs(extraAgeGyr) > 0.01) {
      planet.eqTempK = newEqTempK;
      planet.surfaceTempK = Math.max(25, newEqTempK + planet.greenhouseDeltaK);
      planet.surfaceTempC = planet.surfaceTempK - 273.15;
      planet.inHabitableZone = planet.orbit.a >= star.hzInnerAU * 0.82 && planet.orbit.a <= star.hzOuterAU * 1.22;

      if (planet.surfaceTempK > 410 && planet.oceanCoverage > 0 && planet.archetype !== 'lava_world') {
        planet.oceanCoverage = Math.max(0, planet.oceanCoverage - 0.55);
        planet.iceCoverage = 0;
        if (planet.biosphere.active) {
          planet.biosphere.biomassGt = Math.round(planet.biosphere.biomassGt * 0.15);
          planet.biosphere.stage = 'Residual Extremophile Biosphere (Stellar Thermal Stress)';
        }
      } else if (planet.surfaceTempK < 180 && planet.oceanCoverage > 0) {
        planet.iceCoverage = Math.min(0.98, planet.iceCoverage + 0.65);
      }
    }

    if (!pDelta) return;

    if (typeof pDelta.tempOffsetK === 'number') {
      planet.surfaceTempK += pDelta.tempOffsetK;
      planet.surfaceTempC = planet.surfaceTempK - 273.15;
    }
    if (typeof pDelta.volcanismBoost === 'number') {
      planet.volcanism = Math.min(1.0, planet.volcanism + pDelta.volcanismBoost);
    }
    if (pDelta.forceBiosphere && !planet.biosphere.active) {
      planet.biosphere.active = true;
      planet.biosphere.stage = 'Newly Evolved Complex Ecosystem';
      planet.biosphere.complexityIndex = pDelta.bioComplexity || 0.78;
      planet.biosphere.biomassGt = pDelta.biomassGt || 420;
      planet.biosphere.biochemistry = 'Chiral Carbon-Water with Adaptive Biopolymers';
      planet.biosphere.energySource = 'Multispectral Photosynthesis & Chemosynthesis';
      planet.biosphere.speciesCountEstimate = 1850000;
      planet.biosphere.foliageRGB = [0.16, 0.52, 0.31];
      planet.biosphere.clades = [
        {
          id: 'clade-neo-0',
          index: 0,
          binomialName: 'Neophyta synthetica',
          commonArchetype: 'Global Primary Producer',
          trophicLevel: 1,
          icon: 'flora',
          symmetry: 'Helical Fractal',
          locomotion: 'Sessile Phototropic',
          sensoryMode: 'Broad-Spectrum Photoreception',
          bioluminescence: true,
          biomassShare: 0.65,
          populationTrend: 0.06,
          generationTimeYears: 3.5,
          bodySegments: 7,
          appendageCount: 8,
          hueDeg: 145,
          traits: ['Rapid atmospheric carbon fixation', 'Synchronized nocturnal bioluminescence']
        },
        {
          id: 'clade-neo-1',
          index: 1,
          binomialName: 'Aureozoon velox',
          commonArchetype: 'Primary Consumer & Pollinator',
          trophicLevel: 2,
          icon: 'herbivore',
          symmetry: 'Bilateral Hexapod',
          locomotion: 'Articulated Gait / Gliding',
          sensoryMode: 'Multispectral Vision',
          bioluminescence: true,
          biomassShare: 0.25,
          populationTrend: 0.04,
          generationTimeYears: 2.1,
          bodySegments: 6,
          appendageCount: 6,
          hueDeg: 195,
          traits: ['Metabolic symbiosis with primary flora', 'Magnetospheric navigation']
        },
        {
          id: 'clade-neo-2',
          index: 2,
          binomialName: 'Kronocaris regalis',
          commonArchetype: 'Apex Predator',
          trophicLevel: 3,
          icon: 'predator',
          symmetry: 'Armored Bilateral',
          locomotion: 'Biomechanical Sprint',
          sensoryMode: 'Electroreception & Thermal Imaging',
          bioluminescence: false,
          biomassShare: 0.10,
          populationTrend: 0.02,
          generationTimeYears: 8.0,
          bodySegments: 9,
          appendageCount: 6,
          hueDeg: 25,
          traits: ['Advanced homeostasis', 'Coordinated pack hunting']
        }
      ];
      planet.biosphere.trophicLinks = [
        { from: 0, to: 1, efficiency: 0.15, label: 'Trophic Symbiosis' },
        { from: 1, to: 2, efficiency: 0.12, label: 'Apex Predation' }
      ];
    }
    if (typeof pDelta.bioComplexity === 'number' && planet.biosphere.active) {
      planet.biosphere.complexityIndex = Math.min(0.99, pDelta.bioComplexity);
      planet.biosphere.biomassGt = pDelta.biomassGt || Math.round(planet.biosphere.complexityIndex * 690);
      planet.biosphere.speciesCountEstimate = Math.round(Math.pow(10, 4.3 + planet.biosphere.complexityIndex * 2.8));
    }
    if (typeof pDelta.extinctionEvents === 'number' && planet.biosphere.active) {
      planet.biosphere.extinctionEvents = pDelta.extinctionEvents;
    }

    if (pDelta.forceCivilization || (pDelta.kardashev && planet.civilization.active)) {
      const k = pDelta.kardashev || 1.15;
      planet.civilization.active = true;
      planet.civilization.status = k >= 1.5 ? 'Stellar Civilization (Dyson Swarm)' : 'Active Planetary & Orbital Civilization';
      planet.civilization.kardashev = k;
      planet.civilization.speciesName = planet.civilization.speciesName || `Sapiens ${planet.name.split(' ')[0]}`;
      planet.civilization.ethos = planet.civilization.ethos || {
        name: 'Harmonic Orbital Technocracy',
        governance: 'Planetary Science Council & Quantum Mesh',
        philosophy: 'Balancing astrophysical expansion with preservation of the native biosphere'
      };
      planet.civilization.populationBillions = Number((11.5 * k).toFixed(2));
      planet.civilization.energyPowerTW = Math.round(Math.pow(10, (k - 0.7) * 4.2) * 18);
      planet.civilization.cooperationIndex = pDelta.cooperationIndex || 0.88;
      planet.civilization.conflictRisk = Math.max(0.02, 1.0 - planet.civilization.cooperationIndex);
      planet.civilization.sustainabilityIndex = 0.91;
      planet.civilization.cityLightIntensity = Math.min(1.0, k * 0.75);
      planet.civilization.megastructures = [
        {
          id: 'mega-ring',
          name: 'Equatorial Orbital Ring & Space Elevators',
          type: 'orbital_ring',
          completion: Math.min(1.0, (k - 0.5) * 1.2),
          description: 'Non-rocket orbital transport infrastructure and geostationary energy array'
        }
      ];
      if (k >= 1.05) {
        planet.civilization.megastructures.push({
          id: 'mega-dyson',
          name: 'Heliocentric Dyson Collector Swarm',
          type: 'dyson_swarm',
          completion: Math.min(1.0, (k - 0.9) * 0.9),
          description: 'Network of quantum solar collectors orbiting the host star'
        });
      }
      if (!planet.civilization.techDomains) {
        planet.civilization.techDomains = [
          { name: 'Energy Production', level: 'He³ Fusion & Stellar Collectors', progress: Math.min(100, Math.round(k * 62)) },
          { name: 'Space Propulsion', level: 'Relativistic Sails & Magneto-Plasma', progress: Math.min(100, Math.round(k * 58)) },
          { name: 'Biotech & Ecology', level: 'Genomic Engineering & Climate Homeostasis', progress: 92 },
          { name: 'Computation & AI', level: 'Distributed Quantum Networks', progress: Math.min(100, Math.round(k * 65)) }
        ];
      }
    }

    if (Array.isArray(pDelta.extraHistory)) {
      planet.civilization.history = [
        ...(planet.civilization.history || []),
        ...pDelta.extraHistory
      ];
    }
  }

  step(dtSeconds) {
    const clampedDt = Math.min(0.1, Math.max(0.001, dtSeconds));
    const timeScale = TIME_SCALES[this.timeScaleIndex] || TIME_SCALES[4];

    this.transientEffects.superflareIntensity = Math.max(0, this.transientEffects.superflareIntensity - clampedDt * 0.45);
    this.transientEffects.impactFlashIntensity = Math.max(0, this.transientEffects.impactFlashIntensity - clampedDt * 0.55);
    this.transientEffects.evolutionPulseIntensity = Math.max(0, this.transientEffects.evolutionPulseIntensity - clampedDt * 0.5);

    const scaleDiff = this.targetLogScale - this.currentLogScale;
    const scaleStep = Math.abs(scaleDiff) > 0.0001
      ? scaleDiff * Math.min(1.0, clampedDt * 5.2)
      : scaleDiff;
    this.currentLogScale += scaleStep;

    // Smooth relativistic warp streak factor proportional to logarithmic transit speed
    const targetWarp = Math.min(1.0, Math.abs(scaleDiff) * 0.28);
    this.warpFactor += (targetWarp - this.warpFactor) * Math.min(1.0, clampedDt * 7.5);

    // Cinematic Autopilot Tour cycles smoothly through Cosmic Wonders
    if (this.autopilotActive) {
      this._autopilotTimer += clampedDt;
      if (this._autopilotTimer >= 11.5) {
        this._autopilotTimer = 0;
        this._autopilotWonderIndex = (this._autopilotWonderIndex + 1) % COSMIC_WONDERS.length;
        this.jumpToWonder(COSMIC_WONDERS[this._autopilotWonderIndex]);
      }
    }

    if (timeScale.yearsPerSec > 0) {
      const prevGyr = Math.floor((this.elapsedYears / 1e9) * 20);
      const dir = this.nbody.timeReversed ? -1 : 1;
      const dtYears = timeScale.yearsPerSec * clampedDt;
      this.elapsedYears += dtYears * dir;
      this.visualTime += clampedDt * timeScale.visualSpeed * dir;

      // Step real-time N-Body Newtonian gravity, collisions & debris!
      // Keep orbital visual cadence responsive even at slower time steps
      const nbodyDtYears = Math.max(0.0002, Math.min(0.04, dtYears > 0.05 ? 0.025 : dtYears * 4.0 + clampedDt * 0.02));
      this.nbody.step(nbodyDtYears, clampedDt, (cat, title, detail) => {
        this.transientEffects.impactFlashIntensity = 1.0;
        this.logEvent(cat, title, detail);
        this.emitChange('nbody_event');
      });

      const newGyr = Math.floor((this.elapsedYears / 1e9) * 20);
      if (newGyr !== prevGyr) {
        this.refreshPlanetarySystem();
      }

      this._backgroundTickAccumulator += clampedDt * timeScale.visualSpeed;
      if (this._backgroundTickAccumulator > 14.0) {
        this._backgroundTickAccumulator = 0;
        this.simulateAutonomousBackgroundUniverse();
      }
    } else {
      this.visualTime += clampedDt * 0.04;
      this.nbody.stepFragmentsAndShockwaves(0.0002, clampedDt);
    }

    // Apply live Heating Laser if held on the active planet
    if (this.laserActive) {
      const targetBody = this.getActiveNBodyTarget();
      if (targetBody) {
        this.nbody.applyThermalLaser(targetBody, clampedDt, 1.4);
      }
    }
  }

  simulateAutonomousBackgroundUniverse() {
    const prng = new PRNG(hashHierarchy(this.universeSeed, 'BG_EVENT', Math.floor(this.elapsedYears * 100 + this.globalEvents.length)));
    const sysList = this.stellarSector ? this.stellarSector.systems : [];
    if (sysList.length === 0) return;

    const randomSys = prng.pick(sysList);
    const eventRoll = prng.next();

    if (eventRoll < 0.28 && randomSys.hasCivilization) {
      this.logEvent(
        'civ',
        `Orbital Infrastructure Expansion in ${randomSys.name}`,
        `Telemetry signals confirm completion of new orbital energy nodes in system ${randomSys.catalogId}.`,
        { systemIndex: randomSys.index }
      );
    } else if (eventRoll < 0.55 && randomSys.hasBiosphere) {
      this.logEvent(
        'bio',
        `Seasonal Biospheric Bloom in ${randomSys.name}`,
        `Spectroscopic albedo shift at 700 nm (photosynthetic Red-Edge) detected in ${randomSys.catalogId}.`,
        { systemIndex: randomSys.index }
      );
    } else if (eventRoll < 0.80) {
      this.logEvent(
        'astro',
        `Magnetospheric Superflare on ${randomSys.name} (${randomSys.star.spectralClass})`,
        `Coronal emission recorded at ${randomSys.distancePc.toFixed(1)} pc; interacting with planetary magnetospheres.`,
        { systemIndex: randomSys.index }
      );
    } else {
      const gal = prng.pick(this.galaxies);
      this.logEvent(
        'cosmos',
        `Type II Supernova Transient in ${gal.name}`,
        `Bolometric luminosity spike detected in outer spiral arms of ${gal.catalogId}; enriching ISM metallicity.`,
        { galaxyIndex: gal.index }
      );
    }

    this.emitChange('background_event');
  }

  triggerPhenomenon(type) {
    const sysSummary = this.getActiveStarSystemSummary();
    const planet = this.getActivePlanet();
    if (!sysSummary || !planet) return;

    const epochLabel = `T + ${this.formatElapsedCosmicTime()}`;

    switch (type) {
      case 'stellar_evolution_step': {
        const stepGyr = Math.max(0.05, sysSummary.star.msLifetimeGyr * 0.18);
        const sysDelta = this.deltas[sysSummary.id] || {};
        sysDelta.extraAgeGyr = (sysDelta.extraAgeGyr || 0) + stepGyr;
        this.deltas[sysSummary.id] = sysDelta;

        const prevPhase = this.planetarySystem.star.phase;
        this.refreshPlanetarySystem();
        const newStar = this.planetarySystem.star;
        const updatedPlanet = this.getActivePlanet();

        this.transientEffects.superflareIntensity = 1.0;
        this.logEvent(
          'astro',
          `Stellar Evolution: ${sysSummary.name} (+${stepGyr.toFixed(2)} Gyr)`,
          `Stage: ${prevPhase} → ${newStar.phase} (${newStar.spectralClass}, ${Math.round(newStar.tempK)} K, ${newStar.luminositySolar.toFixed(2)} L☉). ${updatedPlanet.name} surface temp: ${updatedPlanet.surfaceTempC.toFixed(1)} °C.`
        );
        break;
      }

      case 'asteroid_impact': {
        const pDelta = this.deltas[planet.id] || {};
        pDelta.tempOffsetK = (pDelta.tempOffsetK || 0) + 6.5;
        pDelta.volcanismBoost = (pDelta.volcanismBoost || 0) + 0.25;
        pDelta.extraHistory = pDelta.extraHistory || [];

        let impactSummary = `Chondritic asteroid impact (Ø 14 km at 28 km/s); stratospheric silicate injection and tectonic volcanism surge.`;
        if (planet.biosphere.active) {
          pDelta.extinctionEvents = (planet.biosphere.extinctionEvents || 0) + 1;
          pDelta.bioComplexity = Math.max(0.35, planet.biosphere.complexityIndex * 0.85);
          pDelta.biomassGt = Math.round(planet.biosphere.biomassGt * 0.62);
          impactSummary += ` Selective mass extinction followed by rapid adaptive radiation of surviving clades.`;
        }
        pDelta.extraHistory.push({
          epoch: epochLabel,
          category: 'geo',
          title: 'Major Bolide Impact & Impact Winter',
          detail: impactSummary
        });

        this.deltas[planet.id] = pDelta;
        this.transientEffects.impactFlashIntensity = 1.0;
        this.refreshPlanetarySystem();
        this.logEvent('geo', `Bolide Impact on ${planet.name}`, impactSummary);
        break;
      }

      case 'abiogenesis_surge': {
        const pDelta = this.deltas[planet.id] || {};
        pDelta.forceBiosphere = true;
        const currentComp = planet.biosphere.active ? planet.biosphere.complexityIndex : 0.45;
        pDelta.bioComplexity = Math.min(0.99, currentComp + 0.22);
        pDelta.biomassGt = Math.round(pDelta.bioComplexity * 720);
        pDelta.extraHistory = pDelta.extraHistory || [];

        const title = planet.biosphere.active
          ? 'Evolutionary Radiation & Global Symbiogenesis'
          : 'Catalytic Abiogenesis & Biosphere Emergence';
        const detail = planet.biosphere.active
          ? `Accelerated phylogenetic diversification on ${planet.name}; complexity index rose to ${(pDelta.bioComplexity * 100).toFixed(0)}%.`
          : `Synthesis of self-replicating polymers near hydrothermal vents; photosynthetic colonization of ${planet.name}'s oceans.`;

        pDelta.extraHistory.push({
          epoch: epochLabel,
          category: 'bio',
          title,
          detail
        });

        this.deltas[planet.id] = pDelta;
        this.transientEffects.evolutionPulseIntensity = 1.0;
        this.refreshPlanetarySystem();
        this.logEvent('bio', `${title} (${planet.name})`, detail);
        break;
      }

      case 'kardashev_breakthrough': {
        const pDelta = this.deltas[planet.id] || {};
        pDelta.forceBiosphere = true;
        pDelta.forceCivilization = true;
        const currentK = planet.civilization.active ? planet.civilization.kardashev : 0.68;
        pDelta.kardashev = Math.min(2.45, currentK + 0.28);
        pDelta.cooperationIndex = Math.min(0.99, (planet.civilization.cooperationIndex || 0.78) + 0.06);
        pDelta.extraHistory = pDelta.extraHistory || [];

        const title = planet.civilization.active
          ? `Technological Leap to Kardashev ${pDelta.kardashev.toFixed(2)}`
          : `Sapient Technological Civilization Emerges on ${planet.name}`;
        const detail = pDelta.kardashev >= 1.15
          ? `Expansion of the Dyson Swarm and Orbital Ring; mastery of He³ fusion and planetary quantum computing.`
          : `Global unification, construction of equatorial space elevators, and climate stabilization.`;

        pDelta.extraHistory.push({
          epoch: epochLabel,
          category: 'tech',
          title,
          detail
        });

        this.deltas[planet.id] = pDelta;
        this.transientEffects.evolutionPulseIntensity = 1.0;
        this.refreshPlanetarySystem();
        this.logEvent('civ', `${title} (${planet.name})`, detail);
        break;
      }

      case 'superflare_cme': {
        this.transientEffects.superflareIntensity = 1.0;
        const shieldMsg = planet.magneticFieldGauss > 0.3
          ? `Magnetosphere (${planet.magneticFieldGauss.toFixed(2)} G) deflects plasma, igniting intense polar auroras.`
          : `Weak magnetic shielding (${planet.magneticFieldGauss.toFixed(2)} G): temporary ionospheric erosion.`;
        this.logEvent(
          'astro',
          `Coronal Mass Ejection (CME) Striking ${planet.name}`,
          `Solar plasma shockwave from ${sysSummary.name}. ${shieldMsg}`
        );
        break;
      }
    }

    this.savePersistence();
    this.emitChange('phenomenon');
  }

  scanAndJumpToNextBiosignature() {
    if (!this.stellarSector) return null;
    const systems = this.stellarSector.systems;
    const total = systems.length;

    for (let offset = 1; offset <= total; offset++) {
      const candidateIdx = (this.activeSystemIndex + offset) % total;
      const cand = systems[candidateIdx];
      if (cand.hasCivilization || cand.hasBiosphere) {
        this.selectStarSystem(candidateIdx, false);
        let bestPlanetIdx = 0;
        let bestScore = -1;
        this.planetarySystem.planets.forEach((p, idx) => {
          const score = (p.civilization.active ? 2.0 : 0) + (p.biosphere.active ? 1.0 : 0) + p.habitabilityScore;
          if (score > bestScore) {
            bestScore = score;
            bestPlanetIdx = idx;
          }
        });
        this.activePlanetIndex = bestPlanetIdx;
        this.flyToScale(4);
        const targetPlanet = this.getActivePlanet();
        this.logEvent(
          'bio',
          `SETI Spectroscopic Scanner: Locked onto ${targetPlanet.name}`,
          `System ${cand.name} (${cand.catalogId}) — ${targetPlanet.civilization.active ? `Kardashev ${targetPlanet.civilization.kardashev.toFixed(2)} Civilization` : `Active Biosphere (${targetPlanet.biosphere.biomassGt} Gt C)`}.`
        );
        this.emitChange('scanner_lock');
        return targetPlanet;
      }
    }
    return null;
  }

  logEvent(category, title, detail, targetRef = null) {
    const entry = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      epoch: `T + ${this.formatElapsedCosmicTime()}`,
      category,
      title,
      detail,
      targetRef
    };
    this.globalEvents.unshift(entry);
    if (this.globalEvents.length > 40) this.globalEvents.length = 40;
  }

  formatElapsedCosmicTime() {
    const y = this.elapsedYears;
    if (y < 1) {
      const days = y * 365.25;
      if (days < 1) {
        const hours = days * 24;
        return `${hours.toFixed(1)} h`;
      }
      return `${days.toFixed(1)} d`;
    }
    if (y < 1e3) return `${y.toFixed(1)} yr`;
    if (y < 1e6) return `${(y / 1e3).toFixed(2)} kyr`;
    if (y < 1e9) return `${(y / 1e6).toFixed(2)} Myr`;
    return `${(y / 1e9).toFixed(3)} Gyr`;
  }

  getActiveScaleLevel() {
    const log = this.currentLogScale;
    for (const lvl of SCALE_LEVELS) {
      if (log >= lvl.minLog && log <= lvl.maxLog) return lvl;
    }
    if (log > 22.8) return SCALE_LEVELS[0];
    return SCALE_LEVELS[SCALE_LEVELS.length - 1];
  }

  flyToScale(levelIndex) {
    const clamped = Math.max(0, Math.min(SCALE_LEVELS.length - 1, levelIndex));
    this.targetLogScale = SCALE_LEVELS[clamped].defaultLogScale;
    this.emitChange('scale_change');
  }

  setTargetLogScale(logMeters) {
    this.targetLogScale = Math.max(-0.4, Math.min(25.8, logMeters));
    this.emitChange('scale_change');
  }

  setTimeScale(index) {
    this.timeScaleIndex = Math.max(0, Math.min(TIME_SCALES.length - 1, index));
    this.emitChange('time_scale');
  }

  getActiveSupercluster() {
    return this.cosmicWeb.superclusters[this.activeSuperclusterIndex] || this.cosmicWeb.superclusters[0];
  }

  getActiveGalaxy() {
    return this.galaxies[this.activeGalaxyIndex] || this.galaxies[0];
  }

  getActiveStarSystemSummary() {
    return this.stellarSector.systems[this.activeSystemIndex] || this.stellarSector.systems[0];
  }

  getActivePlanetarySystem() {
    return this.planetarySystem;
  }

  getActivePlanet() {
    if (!this.planetarySystem || !this.planetarySystem.planets.length) return null;
    return this.planetarySystem.planets[this.activePlanetIndex] || this.planetarySystem.planets[0];
  }

  getActiveLandmark() {
    const p = this.getActivePlanet();
    if (!p || !p.landmarks || !p.landmarks.length) return null;
    return p.landmarks[this.activeLandmarkIndex % p.landmarks.length];
  }

  getActiveClade() {
    const p = this.getActivePlanet();
    if (!p || !p.biosphere || !p.biosphere.clades || !p.biosphere.clades.length) return null;
    return p.biosphere.clades[this.activeCladeIndex % p.biosphere.clades.length];
  }

  selectSupercluster(index, autoZoom = true) {
    this.activeSuperclusterIndex = index;
    const sc = this.getActiveSupercluster();
    this.galaxies = generateGalaxiesForSupercluster(sc);
    this.activeGalaxyIndex = 0;
    this.stellarSector = generateStellarSector(this.getActiveGalaxy(), 0);
    this.activeSystemIndex = 0;
    this.refreshPlanetarySystem();
    if (autoZoom) this.flyToScale(1);
    this.emitChange('select_supercluster');
  }

  selectGalaxy(index, autoZoom = true) {
    this.activeGalaxyIndex = index;
    const gal = this.getActiveGalaxy();
    this.stellarSector = generateStellarSector(gal, 0);
    this.activeSystemIndex = 0;
    this.refreshPlanetarySystem();
    if (autoZoom) this.flyToScale(1);
    this.emitChange('select_galaxy');
  }

  selectStarSystem(index, autoZoom = true) {
    this.activeSystemIndex = index;
    this.refreshPlanetarySystem();
    const habitableIdx = this.planetarySystem.planets.findIndex((p) => p.biosphere.active || p.inHabitableZone);
    this.activePlanetIndex = habitableIdx >= 0 ? habitableIdx : Math.min(2, this.planetarySystem.planets.length - 1);
    if (autoZoom) this.flyToScale(3);
    this.emitChange('select_system');
  }

  selectPlanet(index, autoZoom = true) {
    this.activePlanetIndex = index;
    this.activeLandmarkIndex = 0;
    this.activeCladeIndex = 0;
    if (autoZoom) this.flyToScale(4);
    this.emitChange('select_planet');
  }

  selectLandmark(index, autoZoom = true) {
    this.activeLandmarkIndex = index;
    if (autoZoom) this.flyToScale(5);
    this.emitChange('select_landmark');
  }

  selectClade(index, autoZoom = false) {
    this.activeCladeIndex = index;
    if (autoZoom) this.flyToScale(6);
    this.emitChange('select_clade');
  }

  getLivePlanetaryPositions() {
    if (!this.planetarySystem) return [];
    return this.planetarySystem.planets.map((planet) => {
      const state = solveKeplerOrbit(planet.orbit, this.elapsedYears);
      return {
        planet,
        ...state
      };
    });
  }

  addBookmark() {
    const lvl = this.getActiveScaleLevel();
    const sc = this.getActiveSupercluster();
    const gal = this.getActiveGalaxy();
    const sys = this.getActiveStarSystemSummary();
    const pl = this.getActivePlanet();

    let title = sc.name;
    if (lvl.index === 1) title = gal.name;
    else if (lvl.index === 2 || lvl.index === 3) title = sys.name;
    else if (lvl.index >= 4 && pl) title = `${pl.name} (${lvl.name})`;

    const bm = {
      id: `bm-${Date.now()}`,
      title,
      scaleLabel: lvl.name,
      logScale: this.targetLogScale,
      superclusterIndex: this.activeSuperclusterIndex,
      galaxyIndex: this.activeGalaxyIndex,
      systemIndex: this.activeSystemIndex,
      planetIndex: this.activePlanetIndex,
      landmarkIndex: this.activeLandmarkIndex
    };
    this.bookmarks.unshift(bm);
    if (this.bookmarks.length > 12) this.bookmarks.length = 12;
    this.savePersistence();
    this.emitChange('bookmark');
    return bm;
  }

  jumpToBookmark(bm) {
    this.selectSupercluster(bm.superclusterIndex, false);
    this.selectGalaxy(bm.galaxyIndex, false);
    this.selectStarSystem(bm.systemIndex, false);
    this.selectPlanet(bm.planetIndex, false);
    this.activeLandmarkIndex = bm.landmarkIndex || 0;
    this.setTargetLogScale(bm.logScale);
    this.emitChange('jump_bookmark');
  }

  /**
   * Travel freely across infinite 3D cosmic sectors [sx, sy, sz]
   */
  travelCosmicSector(dx, dy, dz) {
    this.sectorCoords = [
      this.sectorCoords[0] + dx,
      this.sectorCoords[1] + dy,
      this.sectorCoords[2] + dz
    ];
    this.activeSuperclusterIndex = 0;
    this.activeGalaxyIndex = 0;
    this.activeSystemIndex = 0;
    this.activePlanetIndex = 2;
    this.rebuildHierarchy();
    this.flyToScale(0);
    this.logEvent(
      'cosmos',
      `Entered Cosmic Sector [${this.sectorCoords.join(', ')}]`,
      `Mapped ${this.cosmicWeb.superclusters.length} supercluster attractors and ${this.cosmicWeb.voids.length} cosmic voids.`
    );
    this.savePersistence();
    this.emitChange('sector_travel');
  }

  jumpToWonder(wonder) {
    if (!wonder) return;
    this.sectorCoords = [0, 0, 0];
    this.cosmicWeb = generateCosmicWeb(this.universeSeed, this.sectorCoords);
    this.selectSupercluster(wonder.scIdx, false);
    this.selectGalaxy(wonder.galIdx, false);
    this.selectStarSystem(wonder.sysIdx, false);
    this.selectPlanet(wonder.plIdx, false);
    this.flyToScale(wonder.scaleIdx);
    this.logEvent('cosmos', `Discovery Lock: ${wonder.title}`, wonder.desc);
    this.emitChange('wonder_jump');
  }

  toggleAutopilot(forceState = null) {
    this.autopilotActive = forceState !== null ? Boolean(forceState) : !this.autopilotActive;
    this._autopilotTimer = 0;
    if (this.autopilotActive) {
      this._autopilotWonderIndex = 0;
      this.jumpToWonder(COSMIC_WONDERS[0]);
    }
    this.emitChange('autopilot');
    return this.autopilotActive;
  }

  exportUniverseSnapshot() {
    return JSON.stringify(
      {
        version: '2.0.0',
        universeSeed: this.universeSeed,
        sectorCoords: this.sectorCoords,
        elapsedYears: this.elapsedYears,
        deltas: this.deltas,
        bookmarks: this.bookmarks,
        globalEvents: this.globalEvents.slice(0, 30)
      },
      null,
      2
    );
  }

  importUniverseSnapshot(jsonString) {
    const parsed = JSON.parse(jsonString);
    if (!parsed || !parsed.universeSeed) {
      throw new Error('Invalid PARALLAX universe snapshot');
    }
    this.universeSeed = String(parsed.universeSeed);
    this.sectorCoords = Array.isArray(parsed.sectorCoords) ? parsed.sectorCoords : [0, 0, 0];
    this.elapsedYears = typeof parsed.elapsedYears === 'number' ? parsed.elapsedYears : 0;
    this.deltas = parsed.deltas && typeof parsed.deltas === 'object' ? parsed.deltas : {};
    this.bookmarks = Array.isArray(parsed.bookmarks) ? parsed.bookmarks : [];
    this.globalEvents = Array.isArray(parsed.globalEvents) ? parsed.globalEvents : [];
    this.rebuildHierarchy();
    this.savePersistence();
    this.emitChange('import');
  }

  getActiveNBodyTarget() {
    if (!this.nbody || !this.nbody.bodies.length) return null;
    const pl = this.getActivePlanet();
    if (pl) {
      const match = this.nbody.bodies.find((b) => b.alive && b.id === pl.id);
      if (match) return match;
    }
    return this.nbody.bodies[0];
  }

  toggleDisplayFlag(flag) {
    if (flag in this.displayFlags) {
      this.displayFlags[flag] = !this.displayFlags[flag];
      this.emitChange('display_flag');
    }
  }

  cycleLightingMode() {
    this.lightingMode = (this.lightingMode + 1) % 3;
    this.emitChange('lighting');
    return this.lightingMode;
  }

  setSandboxTool(tool) {
    this.sandboxTool = tool;
    this.laserActive = false;
    this.emitChange('sandbox_tool');
  }

  /**
   * Universe Sandbox Live Property Editor: mutates planet/star physics in real time!
   */
  editActivePlanetProperty(prop, value) {
    const pl = this.getActivePlanet();
    const nb = this.getActiveNBodyTarget();
    if (!pl) return;

    if (prop === 'massEarths') {
      pl.massEarths = Math.max(0.01, value);
      pl.gravityG = pl.massEarths / Math.max(0.05, pl.radiusEarths * pl.radiusEarths);
      if (nb) nb.massSolar = pl.massEarths * 3.0034896e-6;
    } else if (prop === 'surfaceTempC') {
      pl.surfaceTempC = value;
      pl.surfaceTempK = value + 273.15;
      if (nb) {
        nb.tempK = pl.surfaceTempK;
        nb.moltenHeat = pl.surfaceTempC > 750 ? Math.min(1.0, (pl.surfaceTempC - 750) / 1400) : 0;
      }
      if (pl.surfaceTempC > 100) pl.oceanCoverage = Math.max(0, pl.oceanCoverage * 0.6);
      if (pl.surfaceTempC < -10) pl.iceCoverage = Math.min(0.98, Math.max(pl.iceCoverage, (-pl.surfaceTempC) / 90));
      else if (pl.surfaceTempC > 45) pl.iceCoverage = 0;
    } else if (prop === 'oceanCoverage') {
      pl.oceanCoverage = Math.max(0, Math.min(1, value));
    } else if (prop === 'pressureAtm') {
      pl.pressureAtm = Math.max(0.0001, value);
      pl.cloudCoverage = Math.min(0.96, Math.pow(pl.pressureAtm, 0.35) * 0.55);
    } else if (prop === 'starMassSolar') {
      const star = this.planetarySystem.star;
      star.currentMassSolar = Math.max(0.08, value);
      star.luminositySolar = Math.pow(star.currentMassSolar, 3.5);
      star.radiusSolar = Math.pow(star.currentMassSolar, 0.8);
      star.tempK = Math.min(42000, 5778 * Math.pow(star.luminositySolar / (star.radiusSolar * star.radiusSolar), 0.25));
      if (this.nbody.bodies[0]) {
        this.nbody.bodies[0].massSolar = star.currentMassSolar;
        this.nbody.bodies[0].luminositySolar = star.luminositySolar;
      }
    }

    this.emitChange('property_edit');
  }

  explodeTargetBody(body) {
    const target = body || this.getActiveNBodyTarget();
    if (!target || !target.alive) return;
    this.nbody.shatterBody(target, this.nbody.bodies[0], (cat, title, detail) => {
      this.transientEffects.impactFlashIntensity = 1.0;
      this.transientEffects.superflareIntensity = target.kind === 'star' ? 1.0 : 0.4;
      this.logEvent(cat, title, detail);
    });
    this.emitChange('explode');
  }
}
