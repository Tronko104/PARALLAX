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

export const TIME_SCALES = [
  { id: 'pause', label: 'PAUSA', short: '0x', yearsPerSec: 0, visualSpeed: 0.0, desc: 'Simulazione congelata' },
  { id: 'realtime', label: 'Tempo Reale', short: '1x', yearsPerSec: 1 / 31557600, visualSpeed: 0.35, desc: 'Dinamica superficiale e atmosferica in tempo reale' },
  { id: 'hours', label: 'Rotazione Planetaria', short: '2h/s', yearsPerSec: 2 / 8766, visualSpeed: 0.85, desc: 'Ciclo giorno/notte e circolazione meteorologica' },
  { id: 'days', label: 'Dinamica Lunare', short: '15d/s', yearsPerSec: 15 / 365.25, visualSpeed: 1.4, desc: 'Orbite lunari e pianeti interni' },
  { id: 'years', label: 'Meccanica Orbitale', short: '1 yr/s', yearsPerSec: 1.0, visualSpeed: 2.2, desc: 'Rivoluzioni kepleriane dell’intero sistema planetario' },
  { id: 'millennia', label: 'Scala Storica & Civiltà', short: '2 kyr/s', yearsPerSec: 2000, visualSpeed: 3.0, desc: 'Sviluppo tecnologico, civiltà di Kardashev e clima' },
  { id: 'megayears', label: 'Scala Evolutiva & Geologica', short: '5 Myr/s', yearsPerSec: 5e6, visualSpeed: 4.0, desc: 'Speciazione darwiniana, deriva tettonica ed ecosistemi' },
  { id: 'gigayears', label: 'Scala Cosmica & Stellare', short: '200 Myr/s', yearsPerSec: 2e8, visualSpeed: 5.5, desc: 'Evoluzione stellare H-R, giganti rosse, supernovae e nane bianche' }
];

const STORAGE_KEY = 'parallax_universe_persistence_v1';

export class SimulationEngine {
  constructor() {
    this.universeSeed = 'PARALLAX-2026-OMEGA';
    this.sectorCoords = [0, 0, 0];

    // Continuous spatial scale: log10(meters)
    this.currentLogScale = 24.6; // Starts at Cosmic Web view, or can smoothly fly anywhere
    this.targetLogScale = 24.6;

    // Temporal state
    this.timeScaleIndex = 4; // Default: 1 yr/s orbital dynamics
    this.elapsedYears = 0.0;
    this.baseCosmicEpochGyr = 13.800;
    this.visualTime = 0.0;

    // Persistent deltas & bookmarks
    this.deltas = {};
    this.bookmarks = [];
    this.globalEvents = [];

    // Active hierarchy selection
    this.cosmicWeb = null;
    this.activeSuperclusterIndex = 0;
    this.galaxies = [];
    this.activeGalaxyIndex = 0;
    this.stellarSector = null;
    this.activeSystemIndex = 0;
    this.planetarySystem = null;
    this.activePlanetIndex = 2; // Anchor habitable homeworld by default
    this.activeLandmarkIndex = 0;
    this.activeCladeIndex = 0;

    // Dynamic transient effects (superflare, impact shockwave, etc.)
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
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed.universeSeed) this.universeSeed = parsed.universeSeed;
      if (typeof parsed.elapsedYears === 'number') this.elapsedYears = parsed.elapsedYears;
      if (parsed.deltas && typeof parsed.deltas === 'object') this.deltas = parsed.deltas;
      if (Array.isArray(parsed.bookmarks)) this.bookmarks = parsed.bookmarks;
      if (Array.isArray(parsed.globalEvents)) this.globalEvents = parsed.globalEvents.slice(0, 35);
    } catch (e) {
      console.warn('PARALLAX persistence load skipped:', e);
    }
  }

  savePersistence() {
    try {
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
      `Inizializzazione Coordinate Universali [${this.universeSeed}]`,
      'Rete cosmica, campi di densità barionica e costante di Hubble sincronizzati.'
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
        `Sintonizzazione Osservatorio su ${sc.name}`,
        `Rilevate ${sc.galaxyCount.toLocaleString()} galassie lungo i filamenti di materia oscura (z = ${sc.redshift.toFixed(4)}).`
      );
      if (homePlanet && homePlanet.biosphere.active) {
        this.logEvent(
          'bio',
          `Biofirma Confermata su ${homePlanet.name}`,
          `Spettro di assorbimento O₂/CH₄ in disequilibrio chimico; biomassa stimata ${homePlanet.biosphere.biomassGt} Gt.`
        );
      }
      if (homePlanet && homePlanet.civilization.active) {
        this.logEvent(
          'civ',
          `Tecnofirma Kardashev ${homePlanet.civilization.kardashev.toFixed(2)} su ${homePlanet.name}`,
          `${homePlanet.civilization.speciesName} (${homePlanet.civilization.ethos.name}) — emissione notturna e strutture orbitali attive.`
        );
      }
    }
  }

  refreshPlanetarySystem() {
    const sysSummary = this.getActiveStarSystemSummary();
    const sysDelta = this.deltas[sysSummary.id] || {};
    const extraAgeGyr = (this.elapsedYears / 1e9) + (sysDelta.extraAgeGyr || 0);
    this.planetarySystem = generatePlanetarySystem(sysSummary, extraAgeGyr);

    // Apply any persistent planet-specific deltas (e.g. evolutionary leaps, impacts, civilization growth)
    for (const planet of this.planetarySystem.planets) {
      this.applyPlanetCausalityAndDeltas(planet, this.planetarySystem.star, extraAgeGyr);
    }

    if (this.activePlanetIndex >= this.planetarySystem.planets.length) {
      this.activePlanetIndex = Math.max(0, this.planetarySystem.planets.length - 1);
    }
  }

  applyPlanetCausalityAndDeltas(planet, star, extraAgeGyr) {
    const pDelta = this.deltas[planet.id];

    // Causal astrophysical feedback when star evolves (e.g. into a Red Giant or White Dwarf!)
    const baseFlux = 1.0 / Math.max(0.001, planet.orbit.a * planet.orbit.a);
    const currentFlux = star.luminositySolar * baseFlux;
    const newEqTempK = star.tempK * Math.sqrt((star.radiusSolar * 695700) / (2 * planet.orbit.a * 1.496e8)) * Math.pow(1 - planet.albedo, 0.25);

    if (Math.abs(extraAgeGyr) > 0.01) {
      planet.eqTempK = newEqTempK;
      planet.surfaceTempK = Math.max(25, newEqTempK + planet.greenhouseDeltaK);
      planet.surfaceTempC = planet.surfaceTempK - 273.15;
      planet.inHabitableZone = planet.orbit.a >= star.hzInnerAU * 0.82 && planet.orbit.a <= star.hzOuterAU * 1.22;

      // If star expanded into a Red Giant and overheated the planet:
      if (planet.surfaceTempK > 410 && planet.oceanCoverage > 0 && planet.archetype !== 'lava_world') {
        planet.oceanCoverage = Math.max(0, planet.oceanCoverage - 0.55);
        planet.iceCoverage = 0;
        if (planet.biosphere.active) {
          planet.biosphere.biomassGt = Math.round(planet.biosphere.biomassGt * 0.15);
          planet.biosphere.stage = 'Biosfera Estremofila Residuale (Stress Termico Stellare)';
        }
      } else if (planet.surfaceTempK < 180 && planet.oceanCoverage > 0) {
        // Star cooled into a White Dwarf -> planet freezes over
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
      planet.biosphere.stage = 'Ecosistema Complesso Neo-Evoluto';
      planet.biosphere.complexityIndex = pDelta.bioComplexity || 0.78;
      planet.biosphere.biomassGt = pDelta.biomassGt || 420;
      planet.biosphere.biochemistry = 'Carbonio-Acqua Chirale con Biopolimeri Adattivi';
      planet.biosphere.energySource = 'Fotosintesi Multispettrale & Chemiosintesi';
      planet.biosphere.speciesCountEstimate = 1850000;
      planet.biosphere.foliageRGB = [0.16, 0.52, 0.31];
      planet.biosphere.clades = [
        {
          id: 'clade-neo-0',
          index: 0,
          binomialName: 'Neophyta synthetica',
          commonArchetype: 'Produttore Primario Globale',
          trophicLevel: 1,
          icon: 'flora',
          symmetry: 'Frattale Elicoidale',
          locomotion: 'Sessile Fototropica',
          sensoryMode: 'Fotoricezione a Spettro Esteso',
          bioluminescence: true,
          biomassShare: 0.65,
          populationTrend: 0.06,
          generationTimeYears: 3.5,
          bodySegments: 7,
          appendageCount: 8,
          hueDeg: 145,
          traits: ['Fissazione rapida del carbonio atmosferico', 'Bioluminescenza notturna sincronizzata']
        },
        {
          id: 'clade-neo-1',
          index: 1,
          binomialName: 'Aureozoon velox',
          commonArchetype: 'Consumatore & Impollinatore',
          trophicLevel: 2,
          icon: 'herbivore',
          symmetry: 'Bilaterale Esapode',
          locomotion: 'Locomozione Articolata / Planata',
          sensoryMode: 'Visione Multispettrale',
          bioluminescence: true,
          biomassShare: 0.25,
          populationTrend: 0.04,
          generationTimeYears: 2.1,
          bodySegments: 6,
          appendageCount: 6,
          hueDeg: 195,
          traits: ['Simbiosi metabolica con la flora primaria', 'Navigazione magnetosferica']
        },
        {
          id: 'clade-neo-2',
          index: 2,
          binomialName: 'Kronocaris regalis',
          commonArchetype: 'Predatore Apicale',
          trophicLevel: 3,
          icon: 'predator',
          symmetry: 'Bilaterale Corazzata',
          locomotion: 'Scatto Biomeccanico',
          sensoryMode: 'Elettrorecezione & Termovisione',
          bioluminescence: false,
          biomassShare: 0.10,
          populationTrend: 0.02,
          generationTimeYears: 8.0,
          bodySegments: 9,
          appendageCount: 6,
          hueDeg: 25,
          traits: ['Omeostasi avanzata', 'Coordinazione sociale di branco']
        }
      ];
      planet.biosphere.trophicLinks = [
        { from: 0, to: 1, efficiency: 0.15, label: 'Simbiosi Trofica' },
        { from: 1, to: 2, efficiency: 0.12, label: 'Predazione Apicale' }
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
      planet.civilization.status = k >= 1.5 ? 'Civiltà Stellare (Sciame di Dyson)' : 'Civiltà Planetaria & Orbitale Attiva';
      planet.civilization.kardashev = k;
      planet.civilization.speciesName = planet.civilization.speciesName || `Sapiens ${planet.name.split(' ')[0]}`;
      planet.civilization.ethos = planet.civilization.ethos || {
        name: 'Tecnocrazia Orbitale Armonica',
        governance: 'Consiglio Scientifico Planetario & Rete Quantistica',
        philosophy: 'Equilibrio tra espansione astrofisica e preservazione della biosfera nativa'
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
          name: 'Anello Orbitale Equatoriale & Ascensori Spaziali',
          type: 'orbital_ring',
          completion: Math.min(1.0, (k - 0.5) * 1.2),
          description: 'Infrastruttura di trasporto orbitale ed energia geostazionaria'
        }
      ];
      if (k >= 1.05) {
        planet.civilization.megastructures.push({
          id: 'mega-dyson',
          name: 'Sciame Collettore di Dyson Eliocentrico',
          type: 'dyson_swarm',
          completion: Math.min(1.0, (k - 0.9) * 0.9),
          description: 'Rete di collettori solari quantistici attorno alla stella madre'
        });
      }
      if (!planet.civilization.techDomains) {
        planet.civilization.techDomains = [
          { name: 'Produzione Energetica', level: 'Fusione He³ & Collettori Stellari', progress: Math.min(100, Math.round(k * 62)) },
          { name: 'Propulsione Spaziale', level: 'Vele Relativistiche & Magneto-Plasma', progress: Math.min(100, Math.round(k * 58)) },
          { name: 'Biotecnologia & Ecologia', level: 'Ingegneria Genomica & Omeostasi Climatica', progress: 92 },
          { name: 'Computazione & IA', level: 'Reti Quantistiche Distribuite', progress: Math.min(100, Math.round(k * 65)) }
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

  /**
   * Main simulation step called every animation frame (dt in seconds)
   */
  step(dtSeconds) {
    const clampedDt = Math.min(0.1, Math.max(0.001, dtSeconds));
    const timeScale = TIME_SCALES[this.timeScaleIndex] || TIME_SCALES[4];

    // Decay transient visual effects
    this.transientEffects.superflareIntensity = Math.max(0, this.transientEffects.superflareIntensity - clampedDt * 0.45);
    this.transientEffects.impactFlashIntensity = Math.max(0, this.transientEffects.impactFlashIntensity - clampedDt * 0.55);
    this.transientEffects.evolutionPulseIntensity = Math.max(0, this.transientEffects.evolutionPulseIntensity - clampedDt * 0.5);

    // Smoothly interpolate spatial scale zoom
    const scaleDiff = this.targetLogScale - this.currentLogScale;
    if (Math.abs(scaleDiff) > 0.0001) {
      this.currentLogScale += scaleDiff * Math.min(1.0, clampedDt * 6.5);
    } else {
      this.currentLogScale = this.targetLogScale;
    }

    if (timeScale.yearsPerSec > 0) {
      const prevGyr = Math.floor((this.elapsedYears / 1e9) * 20);
      this.elapsedYears += timeScale.yearsPerSec * clampedDt;
      this.visualTime += clampedDt * timeScale.visualSpeed;

      const newGyr = Math.floor((this.elapsedYears / 1e9) * 20);
      // If macro-time advanced significantly (> 50 Myr), recompute stellar evolution & planetary causal state!
      if (newGyr !== prevGyr) {
        this.refreshPlanetarySystem();
      }

      // Autonomous background universe simulation ticker
      this._backgroundTickAccumulator += clampedDt * timeScale.visualSpeed;
      if (this._backgroundTickAccumulator > 14.0) {
        this._backgroundTickAccumulator = 0;
        this.simulateAutonomousBackgroundUniverse();
      }
    } else {
      // Even when paused, allow subtle shader camera visual breathing
      this.visualTime += clampedDt * 0.08;
    }
  }

  /**
   * Autonomous background evolution: simulates events occurring across the universe
   * even when the observer is looking elsewhere.
   */
  simulateAutonomousBackgroundUniverse() {
    const prng = new PRNG(hashHierarchy(this.universeSeed, 'BG_EVENT', Math.floor(this.elapsedYears * 100 + this.globalEvents.length)));
    const sysList = this.stellarSector ? this.stellarSector.systems : [];
    if (sysList.length === 0) return;

    const randomSys = prng.pick(sysList);
    const eventRoll = prng.next();

    if (eventRoll < 0.28 && randomSys.hasCivilization) {
      // Civilization progression in sector
      this.logEvent(
        'civ',
        `Espansione Infrastruttura Orbitale in ${randomSys.name}`,
        `Segnali di telemetria indicano il completamento di nuovi nodi energetici nel sistema ${randomSys.catalogId}.`,
        { systemIndex: randomSys.index }
      );
    } else if (eventRoll < 0.55 && randomSys.hasBiosphere) {
      this.logEvent(
        'bio',
        `Fioritura Biosferica Stagionale in ${randomSys.name}`,
        `Variazione dell'albedo spettroscopico a 700 nm (Red-Edge fotosintetico) rilevata nel sistema ${randomSys.catalogId}.`,
        { systemIndex: randomSys.index }
      );
    } else if (eventRoll < 0.80) {
      this.logEvent(
        'astro',
        `Brillamento Magnetosferico su ${randomSys.name} (${randomSys.star.spectralClass})`,
        `Emissione coronale registrata a ${randomSys.distancePc.toFixed(1)} pc; interazione con le magnetosfere planetarie.`,
        { systemIndex: randomSys.index }
      );
    } else {
      const gal = prng.pick(this.galaxies);
      this.logEvent(
        'cosmos',
        `Transiente Supernova Tipo II in ${gal.name}`,
        `Picco di luminosità bolometrica rilevato nei bracci esterni di ${gal.catalogId}; arricchimento metallico del mezzo interstellare.`,
        { galaxyIndex: gal.index }
      );
    }

    this.emitChange('background_event');
  }

  /**
   * Trigger a physically modeled causal phenomenon on the active star or planet
   */
  triggerPhenomenon(type) {
    const sysSummary = this.getActiveStarSystemSummary();
    const planet = this.getActivePlanet();
    if (!sysSummary || !planet) return;

    const epochLabel = `T + ${this.formatElapsedCosmicTime()}`;

    switch (type) {
      case 'stellar_evolution_step': {
        // Advance star's evolutionary age by 15% of its Main Sequence lifetime
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
          `Evoluzione Stellare: ${sysSummary.name} (+${stepGyr.toFixed(2)} Gyr)`,
          `Stadio: ${prevPhase} → ${newStar.phase} (${newStar.spectralClass}, ${Math.round(newStar.tempK)} K, ${newStar.luminositySolar.toFixed(2)} L☉). Temp. su ${updatedPlanet.name}: ${updatedPlanet.surfaceTempC.toFixed(1)} °C.`
        );
        break;
      }

      case 'asteroid_impact': {
        const pDelta = this.deltas[planet.id] || {};
        pDelta.tempOffsetK = (pDelta.tempOffsetK || 0) + 6.5;
        pDelta.volcanismBoost = (pDelta.volcanismBoost || 0) + 0.25;
        pDelta.extraHistory = pDelta.extraHistory || [];

        let impactSummary = `Impatto di asteroide condritico (Ø 14 km) a 28 km/s; iniezione di silicati in stratosfera e attivazione vulcanica.`;
        if (planet.biosphere.active) {
          pDelta.extinctionEvents = (planet.biosphere.extinctionEvents || 0) + 1;
          pDelta.bioComplexity = Math.max(0.35, planet.biosphere.complexityIndex * 0.85);
          pDelta.biomassGt = Math.round(planet.biosphere.biomassGt * 0.62);
          impactSummary += ` Estinzione selettiva seguita da rapida radiazione adattiva dei cladi superstiti.`;
        }
        pDelta.extraHistory.push({
          epoch: epochLabel,
          category: 'geo',
          title: 'Grande Impatto Meteoritico & Inverno da Polveri',
          detail: impactSummary
        });

        this.deltas[planet.id] = pDelta;
        this.transientEffects.impactFlashIntensity = 1.0;
        this.refreshPlanetarySystem();
        this.logEvent('geo', `Impatto Bolide su ${planet.name}`, impactSummary);
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
          ? 'Radiazione Evolutiva & Simbiogenesi Globale'
          : 'Abiogenesi Catalitica & Emergenza della Biosfera';
        const detail = planet.biosphere.active
          ? `Diversificazione filogenetica accelerata su ${planet.name}; indice di complessità salito a ${(pDelta.bioComplexity * 100).toFixed(0)}%.`
          : `Sintesi di polimeri autoreplicanti presso sorgenti idrotermali; colonizzazione fotosintetica degli oceani di ${planet.name}.`;

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
          ? `Salto Tecnologico a Kardashev ${pDelta.kardashev.toFixed(2)}`
          : `Emergenza di Civiltà Tecnologica Sapiente su ${planet.name}`;
        const detail = pDelta.kardashev >= 1.15
          ? `Espansione dello Sciame di Dyson e dell'Anello Orbitale; padronanza della fusione He³ e computazione quantistica.`
          : `Unificazione planetaria, costruzione degli ascensori spaziali equatoriali e stabilizzazione climatica.`;

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
          ? `La magnetosfera (${planet.magneticFieldGauss.toFixed(2)} G) deflette il plasma generando intense aurore polari.`
          : `Bassa schermatura magnetica (${planet.magneticFieldGauss.toFixed(2)} G): erosione ionosferica temporanea.`;
        this.logEvent(
          'astro',
          `Eiezione di Massa Coronale (CME) verso ${planet.name}`,
          `Onda d'urto di plasma solare da ${sysSummary.name}. ${shieldMsg}`
        );
        break;
      }
    }

    this.savePersistence();
    this.emitChange('phenomenon');
  }

  /**
   * Deep-Space Spectroscopic Biosignature & SETI Survey Scanner
   * Scans the current galaxy/sector for habitable, life-bearing, or civilization-bearing worlds
   * and flies the observer directly to the next discovered oasis!
   */
  scanAndJumpToNextBiosignature() {
    if (!this.stellarSector) return null;
    const systems = this.stellarSector.systems;
    const total = systems.length;

    for (let offset = 1; offset <= total; offset++) {
      const candidateIdx = (this.activeSystemIndex + offset) % total;
      const cand = systems[candidateIdx];
      if (cand.hasCivilization || cand.hasBiosphere) {
        this.selectStarSystem(candidateIdx, false);
        // Find the most habitable planet in that system
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
        this.flyToScale(4); // Fly directly to Planetary Orbit scale!
        const targetPlanet = this.getActivePlanet();
        this.logEvent(
          'bio',
          `Scanner Spettroscopico SETI: Lock su ${targetPlanet.name}`,
          `Sistema ${cand.name} (${cand.catalogId}) — ${targetPlanet.civilization.active ? `Civiltà Kardashev ${targetPlanet.civilization.kardashev.toFixed(2)}` : `Biosfera Attiva (${targetPlanet.biosphere.biomassGt} Gt)`}.`
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
    // Default to a habitable planet if present, or planet index 2
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

  /**
   * Compute live 3D heliocentric coordinates of all planets in the active system
   */
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
}
