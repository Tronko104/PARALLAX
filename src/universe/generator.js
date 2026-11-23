/**
 * PARALLAX — Procedural Multi-Scale Universe Generator
 * Generates coherent, physically plausible, and deterministic entities across 7 scales:
 * 1. Cosmos (Cosmic Web, Superclusters, Filaments, Voids)
 * 2. Galaxies (Spirals, Barred, Ellipticals, Irregulars, SMBH, Nebulae)
 * 3. Stars (O..M spectral classes, Protostars, Main Sequence, Giants, White Dwarfs, Pulsars, Black Holes)
 * 4. Planetary Systems (Keplerian Orbits, Moons, Rings, Asteroid Belts, Comets)
 * 5. Planets (Tectonics, Continents, Oceans, Craters, Volcanoes, Rayleigh/Mie Atmospheres, Climate)
 * 6. Life (Abiogenesis, Trophic Food Webs, Clades, Morphology, Adaptations, Extinctions)
 * 7. Civilizations (Kardashev Scale, Culture, Tech Matrix, Conflict/Cooperation, Megastructures, History)
 */

import {
  PRNG,
  hashHierarchy,
  fbm3D,
  planckBlackbodyRGB,
  rgbToHex,
  generateAstronomicalName,
  generateStarDesignation
} from '../math/prng.js';

export const SCALE_LEVELS = [
  { id: 'cosmos', index: 0, name: 'Cosmos', subtitle: 'Cosmic Web, Superclusters & Voids', defaultLogScale: 24.6, minLog: 22.8, maxLog: 26.0 },
  { id: 'galaxy', index: 1, name: 'Galaxy', subtitle: 'Galactic Structure, Nebulae & Core', defaultLogScale: 20.6, minLog: 18.8, maxLog: 22.8 },
  { id: 'sector', index: 2, name: 'Star Sector', subtitle: 'Local Cluster & Stellar Evolution', defaultLogScale: 17.2, minLog: 14.8, maxLog: 18.8 },
  { id: 'system', index: 3, name: 'Star System', subtitle: 'Keplerian Orbital Dynamics', defaultLogScale: 12.3, minLog: 9.8, maxLog: 14.8 },
  { id: 'planet', index: 4, name: 'Planet', subtitle: 'Geophysics, Atmosphere & Global Climate', defaultLogScale: 7.4, minLog: 4.8, maxLog: 9.8 },
  { id: 'surface', index: 5, name: 'Surface & Life', subtitle: 'Planetary Horizon & Ecosystems', defaultLogScale: 3.1, minLog: 1.5, maxLog: 4.8 },
  { id: 'civilization', index: 6, name: 'Biosphere & Civ', subtitle: 'Organic Morphology & Technosphere', defaultLogScale: 0.7, minLog: -0.5, maxLog: 1.5 }
];

/**
 * 1. COSMIC WEB & SUPERCLUSTERS GENERATOR
 */
export function generateCosmicWeb(universeSeed, sectorCoords = [0, 0, 0]) {
  const [sx, sy, sz] = sectorCoords;
  const seed = hashHierarchy(universeSeed, 'COSMOS', sx, sy, sz);
  const prng = new PRNG(seed);

  const superclusters = [];
  const voids = [];
  const filaments = [];

  const count = 14;
  for (let i = 0; i < count; i++) {
    const scSeed = hashHierarchy(seed, 'SC', i);
    const scPrng = new PRNG(scSeed);

    let x = scPrng.range(-1.8, 1.8);
    let y = scPrng.range(-1.1, 1.1);
    let z = scPrng.range(-1.8, 1.8);
    if (i === 0) {
      x = 0.0;
      y = 0.0;
      z = 0.0;
    }

    const density = fbm3D(x * 1.5 + 3.1, y * 1.5 + 1.7, z * 1.5 + 5.3, 4);
    const massLogSolar = scPrng.range(15.2, 16.8);
    const galaxyCount = Math.round(scPrng.range(1800, 45000));
    const spanMpc = scPrng.range(45, 190);
    const distMpc = Math.hypot(x + sx * 4, y + sy * 4, z + sz * 4) * 140;
    const redshift = Math.max(0.001, (distMpc * 67.4) / 299792.458);

    const isOriginSector = sx === 0 && sy === 0 && sz === 0;
    const name = i === 0 && isOriginSector
      ? 'Laniakea-Prime Supercluster'
      : `${generateAstronomicalName(scPrng)} Supercluster`;

    superclusters.push({
      id: `sc-${sx}-${sy}-${sz}-${i}`,
      index: i,
      seed: scSeed,
      name,
      catalogId: `PCL-${sx >= 0 ? 'N' : 'S'}${Math.abs(sx)}${i.toString().padStart(3, '0')}`,
      position: [x, y, z],
      density: 0.45 + density * 0.55,
      massLogSolar,
      galaxyCount,
      spanMpc,
      distMpc,
      redshift,
      darkMatterFraction: scPrng.range(0.81, 0.86),
      icmTempKelvin: scPrng.range(1.5e7, 8.5e7),
      dominantMorphology: scPrng.pick([
        'Rich Filamentary Node',
        'Central Gravitational Attractor',
        'Multi-Cluster Cosmic Arc',
        'Galactic Great Wall'
      ]),
      color: i === 0 ? [0.95, 0.75, 0.42] : [
        scPrng.range(0.55, 0.98),
        scPrng.range(0.68, 0.92),
        scPrng.range(0.80, 1.0)
      ]
    });
  }

  for (let i = 0; i < superclusters.length; i++) {
    for (let j = i + 1; j < superclusters.length; j++) {
      const a = superclusters[i].position;
      const b = superclusters[j].position;
      const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      if (d < 1.65 || (i === 0 && j <= 3)) {
        filaments.push({
          from: i,
          to: j,
          start: a,
          end: b,
          lengthMpc: d * 140,
          linearDensity: prng.range(0.4, 0.95)
        });
      }
    }
  }

  for (let v = 0; v < 5; v++) {
    const vPrng = new PRNG(hashHierarchy(seed, 'VOID', v));
    voids.push({
      id: `void-${v}`,
      name: `${generateAstronomicalName(vPrng)} Void`,
      position: [vPrng.range(-1.6, 1.6), vPrng.range(-0.9, 0.9), vPrng.range(-1.6, 1.6)],
      diameterMpc: vPrng.range(65, 210),
      underdensityDelta: vPrng.range(-0.88, -0.72)
    });
  }

  return {
    seed,
    sectorCoords,
    superclusters,
    filaments,
    voids
  };
}

/**
 * 2. GALAXY GENERATOR (Inside a Supercluster)
 */
const GALAXY_TYPES = [
  { code: 'SA(s)bc', label: 'Grand-Design Spiral', family: 'spiral', arms: 2, bar: 0.1, bulge: 0.25, dust: 0.85, starFormation: 0.85 },
  { code: 'SB(r)b', label: 'Barred Spiral', family: 'barred', arms: 2, bar: 0.55, bulge: 0.32, dust: 0.78, starFormation: 0.75 },
  { code: 'SA(s)c', label: 'Flocculent Multi-Arm Spiral', family: 'spiral', arms: 4, bar: 0.08, bulge: 0.18, dust: 0.92, starFormation: 0.95 },
  { code: 'E2', label: 'Giant Elliptical', family: 'elliptical', arms: 0, bar: 0.0, bulge: 0.95, dust: 0.12, starFormation: 0.08 },
  { code: 'S0', label: 'Lenticular Disk', family: 'lenticular', arms: 0, bar: 0.2, bulge: 0.60, dust: 0.35, starFormation: 0.22 },
  { code: 'Irr-I', label: 'Magellanic Starburst Irregular', family: 'irregular', arms: 3, bar: 0.15, bulge: 0.10, dust: 0.95, starFormation: 1.0 }
];

export function generateGalaxiesForSupercluster(supercluster) {
  const galaxies = [];
  const count = 16;

  for (let i = 0; i < count; i++) {
    const gSeed = hashHierarchy(supercluster.seed, 'GALAXY', i);
    const prng = new PRNG(gSeed);

    const morph = i === 0
      ? GALAXY_TYPES[0]
      : prng.weightedPick([
          { value: GALAXY_TYPES[0], weight: 28 },
          { value: GALAXY_TYPES[1], weight: 26 },
          { value: GALAXY_TYPES[2], weight: 18 },
          { value: GALAXY_TYPES[3], weight: 14 },
          { value: GALAXY_TYPES[4], weight: 8 },
          { value: GALAXY_TYPES[5], weight: 6 }
        ]);

    const radiusKpc = morph.family === 'elliptical'
      ? prng.range(22, 65)
      : morph.family === 'irregular'
      ? prng.range(4, 14)
      : prng.range(12, 38);

    const massLogSolar = morph.family === 'elliptical'
      ? prng.range(11.4, 12.6)
      : morph.family === 'irregular'
      ? prng.range(8.9, 10.2)
      : prng.range(10.6, 11.9);

    const starCountBillions = Math.pow(10, massLogSolar - 9.35);
    const smbhMassSolar = Math.pow(10, massLogSolar - 3.85) * prng.range(0.5, 2.2);
    const ageGyr = morph.family === 'elliptical'
      ? prng.range(11.2, 13.4)
      : prng.range(7.5, 12.8);

    const metallicityFeH = prng.range(-0.65, 0.35);
    const armTwist = prng.range(2.6, 4.8);

    const name = i === 0 && supercluster.index === 0
      ? 'Aethelgard Galaxy (NGC-7491)'
      : `${generateAstronomicalName(prng)} Galaxy`;

    const angle = i * 2.39996 + prng.range(-0.2, 0.2);
    const dist = i === 0 ? 0 : Math.pow(i / count, 0.7) * 1.65;
    const pos = [
      Math.cos(angle) * dist,
      prng.range(-0.45, 0.45) * (i === 0 ? 0 : 1),
      Math.sin(angle) * dist
    ];

    const nebulae = [];
    const nebCount = morph.family === 'elliptical' ? 2 : 7;
    for (let n = 0; n < nebCount; n++) {
      const nAngle = (n / nebCount) * Math.PI * 2 + prng.range(0, 1);
      const nR = prng.range(0.22, 0.82);
      const spiralTheta = nAngle + Math.log(nR + 0.1) * armTwist;
      nebulae.push({
        id: `neb-${i}-${n}`,
        name: `${generateAstronomicalName(prng)} Nebula`,
        type: prng.pick(['HII Emission Region', 'Giant Molecular Cloud', 'Supernova Remnant', 'Dark Dust Nebula']),
        position: [Math.cos(spiralTheta) * nR, prng.range(-0.04, 0.04), Math.sin(spiralTheta) * nR],
        radiusPc: prng.range(15, 140),
        ionizationTempK: prng.range(8000, 14000),
        color: prng.pick([
          [0.95, 0.28, 0.48],
          [0.22, 0.82, 0.88],
          [0.42, 0.58, 0.98]
        ])
      });
    }

    galaxies.push({
      id: `${supercluster.id}-gal-${i}`,
      index: i,
      seed: gSeed,
      superclusterId: supercluster.id,
      name,
      catalogId: `PGC-${(gSeed % 90000 + 10000)}`,
      morphology: morph,
      position: pos,
      orientation: [prng.range(-0.5, 0.5), prng.range(0, Math.PI), prng.range(-0.5, 0.5)],
      radiusKpc,
      diameterLy: radiusKpc * 2 * 3261.56,
      massLogSolar,
      starCountBillions,
      smbh: {
        name: `${name.split(' ')[0]} A*`,
        massSolar: smbhMassSolar,
        schwarzschildRadiusAU: (2 * 6.674e-11 * smbhMassSolar * 1.988e30) / (299792458 ** 2) / 1.496e11,
        agnActive: prng.chance(0.28),
        accretionLuminosityEddington: prng.range(0.01, 0.45)
      },
      ageGyr,
      metallicityFeH,
      armTwist,
      nebulae
    });
  }

  return galaxies;
}

/**
 * 3. STELLAR EVOLUTION & STAR SYSTEM GENERATOR
 */
export function computeStellarEvolutionState(initialMassSolar, ageGyr, metallicityFeH = 0.0) {
  const M = Math.max(0.08, initialMassSolar);
  const msLifetimeGyr = 10.0 * Math.pow(M, -2.5);
  const lifeFraction = ageGyr / Math.max(1e-5, msLifetimeGyr);

  let phase = 'Main Sequence';
  let phaseCode = 'V';
  let currentMass = M;
  let radiusSolar = Math.pow(M, 0.8);
  let luminositySolar = Math.pow(M, 3.5);
  let tempK = 5778 * Math.pow(luminositySolar / (radiusSolar * radiusSolar), 0.25);
  let isRemnant = false;
  let remnantType = null;
  let hasNebulaHalo = false;

  if (ageGyr < Math.min(0.015, msLifetimeGyr * 0.02)) {
    phase = 'T-Tauri Protostar with Accretion Disk';
    phaseCode = 'PMS';
    radiusSolar = Math.pow(M, 0.8) * 2.4;
    luminositySolar = Math.pow(M, 2.8) * 1.6;
    tempK = Math.max(2900, 4400 * Math.pow(M, 0.25));
    hasNebulaHalo = true;
  } else if (lifeFraction <= 1.0) {
    phase = 'Main Sequence (H → He Core Fusion)';
    phaseCode = 'V';
    const brighten = 1.0 + 0.42 * lifeFraction;
    const swell = 1.0 + 0.25 * lifeFraction;
    radiusSolar = Math.pow(M, 0.8) * swell;
    luminositySolar = Math.pow(M, 3.5) * brighten;
    tempK = 5778 * Math.pow(luminositySolar / (radiusSolar * radiusSolar), 0.25);
  } else if (lifeFraction <= 1.15) {
    const giantProgress = (lifeFraction - 1.0) / 0.15;
    if (M >= 8.5) {
      phase = giantProgress < 0.5 ? 'Blue Supergiant (He/C Fusion)' : 'Red Supergiant (Pre-Supernova)';
      phaseCode = 'Ia';
      radiusSolar = Math.pow(M, 0.8) * (15 + giantProgress * 180);
      luminositySolar = Math.pow(M, 3.2) * (2.5 + giantProgress * 4.0);
      tempK = giantProgress < 0.5 ? 14500 : 3650;
    } else {
      phase = giantProgress < 0.35 ? 'Subgiant (Core H Exhaustion)' : 'Red Giant (RGB/AGB Branch)';
      phaseCode = giantProgress < 0.35 ? 'IV' : 'III';
      radiusSolar = Math.pow(M, 0.75) * (2.5 + Math.pow(giantProgress, 1.6) * 45);
      luminositySolar = Math.pow(M, 2.5) * (3.0 + Math.pow(giantProgress, 1.8) * 180);
      tempK = Math.max(3050, 5200 - giantProgress * 2000);
    }
    currentMass = M * (1.0 - 0.15 * giantProgress);
  } else {
    isRemnant = true;
    const remnantAgeGyr = ageGyr - msLifetimeGyr * 1.15;
    hasNebulaHalo = remnantAgeGyr < 0.08;

    if (M < 8.0) {
      phase = hasNebulaHalo ? 'Planetary Nebula & White Dwarf' : 'Degenerate Carbon-Oxygen White Dwarf';
      phaseCode = 'DA';
      remnantType = 'white_dwarf';
      currentMass = Math.min(1.38, 0.45 + M * 0.11);
      radiusSolar = 0.012 * Math.pow(currentMass, -0.33);
      const coolingFactor = Math.exp(-remnantAgeGyr / 1.8);
      tempK = Math.max(4500, 38000 * coolingFactor + 4500);
      luminositySolar = Math.pow(radiusSolar, 2) * Math.pow(tempK / 5778, 4);
    } else if (M < 21.0) {
      phase = hasNebulaHalo ? 'Supernova Remnant & Pulsar' : 'Neutron Star / Magnetar Pulsar';
      phaseCode = 'PSR';
      remnantType = 'neutron_star';
      currentMass = 1.35 + (M - 8.0) * 0.06;
      radiusSolar = 0.00002;
      tempK = 42000;
      luminositySolar = 0.04;
    } else {
      phase = 'Stellar-Mass Black Hole (Event Horizon)';
      phaseCode = 'BH';
      remnantType = 'black_hole';
      currentMass = M * 0.38;
      radiusSolar = 0.000045 * currentMass;
      tempK = 28000;
      luminositySolar = 0.08;
    }
  }

  let spectralLetter = 'G';
  if (remnantType === 'black_hole') spectralLetter = 'BH';
  else if (remnantType === 'neutron_star') spectralLetter = 'NS';
  else if (remnantType === 'white_dwarf') spectralLetter = 'D';
  else if (tempK >= 30000) spectralLetter = 'O';
  else if (tempK >= 10000) spectralLetter = 'B';
  else if (tempK >= 7500) spectralLetter = 'A';
  else if (tempK >= 6000) spectralLetter = 'F';
  else if (tempK >= 5200) spectralLetter = 'G';
  else if (tempK >= 3700) spectralLetter = 'K';
  else spectralLetter = 'M';

  const subDigit = isRemnant
    ? ''
    : Math.max(0, Math.min(9, Math.floor(9 - ((tempK % 1500) / 1500) * 9)));
  const spectralClass = isRemnant ? phaseCode : `${spectralLetter}${subDigit}${phaseCode}`;

  const rgb = remnantType === 'black_hole'
    ? [1.0, 0.58, 0.24]
    : remnantType === 'neutron_star'
    ? [0.45, 0.85, 1.0]
    : planckBlackbodyRGB(tempK);

  const sqrtL = Math.sqrt(Math.max(0.00001, luminositySolar));
  const hzInnerAU = 0.95 * sqrtL;
  const hzOuterAU = 1.67 * sqrtL;
  const frostLineAU = 2.7 * sqrtL;

  return {
    initialMassSolar: M,
    currentMassSolar: currentMass,
    ageGyr,
    msLifetimeGyr,
    lifeFraction,
    phase,
    phaseCode,
    spectralLetter,
    spectralClass,
    radiusSolar,
    luminositySolar,
    tempK,
    rgb,
    hexColor: rgbToHex(rgb),
    isRemnant,
    remnantType,
    hasNebulaHalo,
    hzInnerAU,
    hzOuterAU,
    frostLineAU
  };
}

/**
 * Generate a Star Sector inside a Galaxy, containing 26 interactive Star Systems
 */
export function generateStellarSector(galaxy, sectorIndex = 0) {
  const sectorSeed = hashHierarchy(galaxy.seed, 'SECTOR', sectorIndex);
  const prng = new PRNG(sectorSeed);
  const systems = [];
  const count = 26;

  for (let i = 0; i < count; i++) {
    const sysSeed = hashHierarchy(sectorSeed, 'STAR_SYS', i);
    const sysPrng = new PRNG(sysSeed);

    let initialMassSolar;
    let ageGyr;
    let isBinary = sysPrng.chance(0.28);

    if (i === 0) {
      // Solar-type G-star with inhabited temperate Gaia homeworld
      initialMassSolar = 1.04;
      ageGyr = 4.62;
      isBinary = false;
    } else if (i === 1) {
      // K-type orange dwarf with lush pelagic ocean world
      initialMassSolar = 0.82;
      ageGyr = 6.1;
    } else if (i === 2) {
      // Evolved Red Giant expanding into its inner system
      initialMassSolar = 1.45;
      ageGyr = 4.25;
    } else if (i === 3) {
      // Massive Blue O/B Binary Supergiant
      initialMassSolar = 14.2;
      ageGyr = 0.008;
      isBinary = true;
    } else if (i === 4) {
      // Stellar-Mass Black Hole with relativistic accretion disk & gravitational lensing
      initialMassSolar = 26.0;
      ageGyr = 0.04;
    } else if (i === 5) {
      // Magnetar / Neutron Star Pulsar with relativistic polar jets
      initialMassSolar = 15.5;
      ageGyr = 0.025;
    } else if (i === 6) {
      // Cool M-Dwarf hosting a Tidally Locked Eyeball World in close HZ!
      initialMassSolar = 0.32;
      ageGyr = 7.4;
      isBinary = false;
    } else if (i === 7) {
      // White Dwarf with Ionized Planetary Nebula shell
      initialMassSolar = 2.2;
      ageGyr = 1.61;
    } else {
      initialMassSolar = sysPrng.weightedPick([
        { value: sysPrng.range(0.18, 0.55), weight: 32 },
        { value: sysPrng.range(0.60, 0.89), weight: 24 },
        { value: sysPrng.range(0.90, 1.25), weight: 20 },
        { value: sysPrng.range(1.30, 2.80), weight: 14 },
        { value: sysPrng.range(3.20, 11.0), weight: 6 },
        { value: sysPrng.range(12.0, 35.0), weight: 4 }
      ]);
      const msLife = 10.0 * Math.pow(initialMassSolar, -2.5);
      ageGyr = sysPrng.chance(0.78)
        ? sysPrng.range(0.05, Math.min(galaxy.ageGyr, msLife * 0.94))
        : sysPrng.range(msLife * 1.01, msLife * 1.35);
    }

    const metallicityFeH = Math.max(-1.2, Math.min(0.5, galaxy.metallicityFeH + sysPrng.range(-0.25, 0.25)));
    const evolution = computeStellarEvolutionState(initialMassSolar, ageGyr, metallicityFeH);

    let companion = null;
    if (isBinary) {
      const compMass = initialMassSolar * sysPrng.range(0.25, 0.85);
      const compEvo = computeStellarEvolutionState(compMass, ageGyr, metallicityFeH);
      companion = {
        name: 'B',
        separationAU: sysPrng.range(0.18, 0.65),
        orbitalPeriodDays: sysPrng.range(12, 180),
        ...compEvo
      };
    }

    const anchorNames = [
      'Helios-Vega Prime',
      'Thalassa-K8',
      'Hyperion Giant',
      'Cygnus-OB Binary',
      'Gargantua-Vex BH',
      'Vela-PSR Magnetar',
      'Terminus-M4 Dwarf'
    ];
    const designation = galaxy.index === 0 && i < anchorNames.length
      ? { properName: anchorNames[i], catalogId: `${galaxy.catalogId}-S${String(i + 1).padStart(3, '0')}` }
      : generateStarDesignation(sysPrng, galaxy.catalogId, i);

    const pos = i === 0
      ? [0, 0, 0]
      : [
          sysPrng.range(-1.65, 1.65),
          sysPrng.range(-0.65, 0.65),
          sysPrng.range(-1.65, 1.65)
        ];

    const previewSummary = peekSystemBiosignature(sysSeed, evolution, i);

    systems.push({
      id: `${galaxy.id}-sys-${i}`,
      index: i,
      seed: sysSeed,
      galaxyId: galaxy.id,
      name: designation.properName,
      catalogId: designation.catalogId,
      position: pos,
      distancePc: Math.hypot(pos[0], pos[1], pos[2]) * 18.5,
      metallicityFeH,
      isBinary,
      companion,
      star: evolution,
      planetCount: previewSummary.planetCount,
      hasBiosphere: previewSummary.hasBiosphere,
      hasCivilization: previewSummary.hasCivilization,
      maxHabitability: previewSummary.maxHabitability,
      notableFeature: previewSummary.notableFeature
    });
  }

  return {
    id: `${galaxy.id}-sec-${sectorIndex}`,
    seed: sectorSeed,
    galaxyId: galaxy.id,
    name: `Orion-Cygnus Sector ${sectorIndex + 1}`,
    systems
  };
}

function peekSystemBiosignature(sysSeed, starEvo, sysIndex) {
  const prng = new PRNG(hashHierarchy(sysSeed, 'PEEK'));
  const planetCount = starEvo.remnantType === 'black_hole' ? prng.int(2, 4) : prng.int(4, 9);
  if (sysIndex === 0) {
    return {
      planetCount: 7,
      hasBiosphere: true,
      hasCivilization: true,
      maxHabitability: 0.94,
      notableFeature: 'Technological Civilization & Complex Biosphere'
    };
  }
  if (sysIndex === 1) {
    return {
      planetCount: 6,
      hasBiosphere: true,
      hasCivilization: true,
      maxHabitability: 0.89,
      notableFeature: 'Inhabited Pelagic Ocean World & Orbital Ring'
    };
  }
  const canHostLife = !starEvo.isRemnant && starEvo.ageGyr > 0.6 && starEvo.tempK < 8500;
  const hasBiosphere = canHostLife && (sysIndex % 3 === 0 || prng.chance(0.42));
  const hasCivilization = hasBiosphere && (sysIndex % 5 === 0 || prng.chance(0.38));
  let notableFeature = starEvo.phase;
  if (hasCivilization) notableFeature = 'Technosignature Detected (Active Civilization)';
  else if (hasBiosphere) notableFeature = 'Spectroscopic Biosignature (O₂ / CH₄)';
  else if (starEvo.hasNebulaHalo) notableFeature = 'Ionized Nebular Shell';

  return {
    planetCount,
    hasBiosphere,
    hasCivilization,
    maxHabitability: hasBiosphere ? prng.range(0.74, 0.95) : prng.range(0.12, 0.58),
    notableFeature
  };
}

/**
 * 4 & 5. PLANETARY SYSTEM, GEOPHYSICS, ATMOSPHERE, BIOSPHERE & CIVILIZATION GENERATOR
 */
export function generatePlanetarySystem(starSystem, timeOffsetGyr = 0) {
  const sysSeed = starSystem.seed;
  const prng = new PRNG(hashHierarchy(sysSeed, 'PLANETARY_SYSTEM'));
  const currentAgeGyr = Math.max(0.001, starSystem.star.ageGyr + timeOffsetGyr);
  const star = computeStellarEvolutionState(
    starSystem.star.initialMassSolar,
    currentAgeGyr,
    starSystem.metallicityFeH
  );

  const planetCount = starSystem.planetCount || 7;
  const planets = [];
  const asteroidBelts = [];
  const comets = [];

  const baseScaleAU = Math.max(0.12, Math.min(1.6, Math.pow(star.initialMassSolar, 1.35) * 0.35));

  for (let p = 0; p < planetCount; p++) {
    const pSeed = hashHierarchy(sysSeed, 'PLANET', p);
    const pPrng = new PRNG(pSeed);

    let semiMajorAxisAU = baseScaleAU * Math.pow(1.72, p) * pPrng.range(0.88, 1.14);

    if ((starSystem.index === 0 || starSystem.index === 1 || starSystem.hasBiosphere) && p === 2 && !star.isRemnant) {
      semiMajorAxisAU = (star.hzInnerAU + star.hzOuterAU) * 0.48;
    }

    const planet = generateSinglePlanet({
      pSeed,
      pIndex: p,
      starSystem,
      star,
      semiMajorAxisAU,
      currentAgeGyr
    });

    planets.push(planet);
  }

  const beltAU = star.frostLineAU * prng.range(0.82, 1.15);
  asteroidBelts.push({
    id: `${starSystem.id}-belt-0`,
    name: `${starSystem.name.split(' ')[0]} Main Asteroid Belt`,
    innerRadiusAU: beltAU * 0.88,
    outerRadiusAU: beltAU * 1.14,
    composition: 'Chondritic Silicates, Carbonaceous Dust & Fe-Ni Metallic Cores',
    totalMassEarths: prng.range(0.0004, 0.015),
    particleCount: 450
  });

  for (let c = 0; c < 3; c++) {
    const cPrng = new PRNG(hashHierarchy(sysSeed, 'COMET', c));
    const a = star.frostLineAU * cPrng.range(1.6, 3.8);
    const e = cPrng.range(0.58, 0.86);
    const periodYears = Math.sqrt(Math.pow(a, 3) / Math.max(0.08, star.currentMassSolar));
    comets.push({
      id: `${starSystem.id}-comet-${c}`,
      name: `C/${cPrng.int(2020, 2999)} ${generateAstronomicalName(cPrng)}`,
      orbit: {
        a,
        e,
        i: cPrng.range(-0.45, 0.45),
        omega: cPrng.range(0, Math.PI * 2),
        w: cPrng.range(0, Math.PI * 2),
        M0: cPrng.range(0, Math.PI * 2),
        periodYears
      },
      nucleusRadiusKm: cPrng.range(2.5, 24.0),
      volatileActivity: cPrng.range(0.6, 1.0)
    });
  }

  return {
    ...starSystem,
    star,
    currentAgeGyr,
    planets,
    asteroidBelts,
    comets
  };
}

/**
 * Detailed Planet, Atmosphere, Surface Landmarks, Biosphere & Civilization Builder
 */
function generateSinglePlanet({ pSeed, pIndex, starSystem, star, semiMajorAxisAU, currentAgeGyr }) {
  const prng = new PRNG(pSeed);
  const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][pIndex] || `${pIndex + 1}`;
  const isAnchorHomeworld = (starSystem.index === 0 && pIndex === 2) || (starSystem.index === 1 && pIndex === 2);
  const isSecondaryHabitable = !isAnchorHomeworld && starSystem.hasBiosphere && pIndex === 2;

  const inHabitableZone = semiMajorAxisAU >= star.hzInnerAU * 0.82 && semiMajorAxisAU <= star.hzOuterAU * 1.22;
  const beyondFrostLine = semiMajorAxisAU > star.frostLineAU;

  let archetype;
  if (isAnchorHomeworld) {
    archetype = starSystem.index === 1 ? 'pelagic_ocean' : 'temperate_terrestrial';
  } else if (isSecondaryHabitable || (inHabitableZone && !star.isRemnant && prng.chance(0.75))) {
    archetype = prng.pick(['temperate_terrestrial', 'pelagic_ocean', 'super_earth_temperate']);
  } else if (semiMajorAxisAU < star.hzInnerAU * 0.55) {
    archetype = prng.pick(['lava_world', 'iron_cratered', 'venusian_greenhouse']);
  } else if (!beyondFrostLine) {
    archetype = prng.pick(['arid_desert', 'venusian_greenhouse', 'iron_cratered', 'temperate_terrestrial']);
  } else if (pIndex <= 5) {
    archetype = prng.pick(['gas_giant', 'gas_giant', 'ice_giant', 'cryo_glacial']);
  } else {
    archetype = prng.pick(['ice_giant', 'cryo_glacial', 'iron_cratered']);
  }

  let massEarths, radiusEarths, albedo, pressureAtm, oceanCoverage, iceCoverage, cloudCoverage;
  let typeLabel, atmosphereComposition, palette, terrainRoughness, volcanism, tectonics;

  switch (archetype) {
    case 'temperate_terrestrial':
    case 'super_earth_temperate': {
      const isSuper = archetype === 'super_earth_temperate';
      typeLabel = isSuper ? 'Temperate Super-Earth' : 'Temperate Terrestrial World';
      massEarths = isAnchorHomeworld ? 1.08 : isSuper ? prng.range(1.6, 3.8) : prng.range(0.65, 1.55);
      radiusEarths = Math.pow(massEarths, 0.28);
      albedo = prng.range(0.27, 0.34);
      pressureAtm = isAnchorHomeworld ? 1.12 : prng.range(0.65, 2.8);
      oceanCoverage = isAnchorHomeworld ? 0.68 : prng.range(0.42, 0.82);
      iceCoverage = prng.range(0.06, 0.22);
      cloudCoverage = prng.range(0.45, 0.68);
      terrainRoughness = 0.68;
      tectonics = prng.range(0.65, 0.92);
      volcanism = prng.range(0.25, 0.55);
      atmosphereComposition = [
        { formula: 'N₂', name: 'Molecular Nitrogen', pct: 75.4, color: '#38bdf8' },
        { formula: 'O₂', name: 'Biogenic Oxygen', pct: 21.8, color: '#34d399' },
        { formula: 'Ar', name: 'Argon', pct: 1.4, color: '#94a3b8' },
        { formula: 'H₂O', name: 'Water Vapor', pct: 0.95, color: '#60a5fa' },
        { formula: 'CO₂', name: 'Carbon Dioxide', pct: 0.41, color: '#f59e0b' },
        { formula: 'CH₄', name: 'Trace Methane', pct: 0.04, color: '#a78bfa' }
      ];
      palette = {
        deepOcean: [0.03, 0.13, 0.28],
        shallowOcean: [0.06, 0.35, 0.54],
        lowland: [0.16, 0.42, 0.24],
        highland: [0.46, 0.42, 0.31],
        peak: [0.88, 0.91, 0.95],
        atmosphere: [0.26, 0.62, 0.98],
        cloud: [0.95, 0.97, 1.0]
      };
      break;
    }

    case 'pelagic_ocean': {
      typeLabel = 'Pelagic Ocean World';
      massEarths = prng.range(1.1, 2.9);
      radiusEarths = Math.pow(massEarths, 0.31) * 1.06;
      albedo = prng.range(0.22, 0.32);
      pressureAtm = prng.range(1.4, 4.2);
      oceanCoverage = prng.range(0.86, 0.96);
      iceCoverage = prng.range(0.05, 0.18);
      cloudCoverage = prng.range(0.55, 0.78);
      terrainRoughness = 0.52;
      tectonics = prng.range(0.55, 0.85);
      volcanism = prng.range(0.35, 0.65);
      atmosphereComposition = [
        { formula: 'N₂', name: 'Molecular Nitrogen', pct: 71.2, color: '#38bdf8' },
        { formula: 'O₂', name: 'Dissolved Oxygen', pct: 23.5, color: '#34d399' },
        { formula: 'H₂O', name: 'Water Vapor', pct: 3.4, color: '#60a5fa' },
        { formula: 'CO₂', name: 'Carbon Dioxide', pct: 1.9, color: '#f59e0b' }
      ];
      palette = {
        deepOcean: [0.02, 0.16, 0.34],
        shallowOcean: [0.05, 0.54, 0.65],
        lowland: [0.18, 0.52, 0.38],
        highland: [0.55, 0.51, 0.42],
        peak: [0.92, 0.95, 0.98],
        atmosphere: [0.18, 0.76, 0.92],
        cloud: [0.94, 0.98, 1.0]
      };
      break;
    }

    case 'lava_world': {
      typeLabel = 'Hyper-Thermal Volcanic World';
      massEarths = prng.range(0.55, 2.1);
      radiusEarths = Math.pow(massEarths, 0.27);
      albedo = 0.12;
      pressureAtm = prng.range(0.15, 6.5);
      oceanCoverage = 0.35;
      iceCoverage = 0.0;
      cloudCoverage = prng.range(0.25, 0.55);
      terrainRoughness = 0.88;
      tectonics = 0.98;
      volcanism = 0.98;
      atmosphereComposition = [
        { formula: 'SO₂', name: 'Sulfur Dioxide', pct: 58.0, color: '#f59e0b' },
        { formula: 'CO₂', name: 'Carbon Dioxide', pct: 32.5, color: '#fb7185' },
        { formula: 'SiO', name: 'Silicate Vapor', pct: 6.5, color: '#f97316' },
        { formula: 'Na', name: 'Ionized Sodium', pct: 3.0, color: '#fde047' }
      ];
      palette = {
        deepOcean: [0.98, 0.32, 0.05],
        shallowOcean: [1.0, 0.62, 0.12],
        lowland: [0.14, 0.11, 0.11],
        highland: [0.25, 0.18, 0.16],
        peak: [0.42, 0.26, 0.22],
        atmosphere: [0.96, 0.38, 0.14],
        cloud: [0.35, 0.26, 0.24]
      };
      break;
    }

    case 'venusian_greenhouse': {
      typeLabel = 'Runaway Greenhouse World';
      massEarths = prng.range(0.75, 1.8);
      radiusEarths = Math.pow(massEarths, 0.28);
      albedo = 0.76;
      pressureAtm = prng.range(35, 95);
      oceanCoverage = 0.0;
      iceCoverage = 0.0;
      cloudCoverage = 0.96;
      terrainRoughness = 0.62;
      tectonics = 0.32;
      volcanism = 0.78;
      atmosphereComposition = [
        { formula: 'CO₂', name: 'Supercritical Carbon Dioxide', pct: 95.8, color: '#f59e0b' },
        { formula: 'N₂', name: 'Nitrogen', pct: 3.5, color: '#38bdf8' },
        { formula: 'H₂SO₄', name: 'Sulfuric Acid Aerosols', pct: 0.7, color: '#eab308' }
      ];
      palette = {
        deepOcean: [0.38, 0.24, 0.12],
        shallowOcean: [0.52, 0.34, 0.16],
        lowland: [0.64, 0.44, 0.21],
        highland: [0.78, 0.56, 0.28],
        peak: [0.88, 0.68, 0.38],
        atmosphere: [0.92, 0.68, 0.28],
        cloud: [0.94, 0.82, 0.54]
      };
      break;
    }

    case 'arid_desert': {
      typeLabel = 'Arid Desert & Tectonic Canyon World';
      massEarths = prng.range(0.25, 1.15);
      radiusEarths = Math.pow(massEarths, 0.28);
      albedo = 0.25;
      pressureAtm = prng.range(0.02, 0.45);
      oceanCoverage = prng.chance(0.35) ? prng.range(0.05, 0.18) : 0.0;
      iceCoverage = prng.range(0.08, 0.25);
      cloudCoverage = prng.range(0.08, 0.24);
      terrainRoughness = 0.85;
      tectonics = 0.35;
      volcanism = 0.28;
      atmosphereComposition = [
        { formula: 'CO₂', name: 'Carbon Dioxide', pct: 88.4, color: '#f97316' },
        { formula: 'N₂', name: 'Nitrogen', pct: 7.2, color: '#38bdf8' },
        { formula: 'Ar', name: 'Argon', pct: 3.1, color: '#94a3b8' },
        { formula: 'O₂', name: 'Oxygen', pct: 1.3, color: '#34d399' }
      ];
      palette = {
        deepOcean: [0.12, 0.28, 0.36],
        shallowOcean: [0.22, 0.42, 0.48],
        lowland: [0.62, 0.32, 0.18],
        highland: [0.78, 0.46, 0.26],
        peak: [0.92, 0.82, 0.72],
        atmosphere: [0.88, 0.52, 0.32],
        cloud: [0.92, 0.78, 0.65]
      };
      break;
    }

    case 'gas_giant': {
      typeLabel = 'Jovian Gas Giant';
      massEarths = prng.range(65, 420);
      radiusEarths = prng.range(8.5, 12.2);
      albedo = prng.range(0.45, 0.58);
      pressureAtm = 1000;
      oceanCoverage = 0.0;
      iceCoverage = 0.0;
      cloudCoverage = 1.0;
      terrainRoughness = 0.25;
      tectonics = 0.0;
      volcanism = 0.0;
      atmosphereComposition = [
        { formula: 'H₂', name: 'Molecular Hydrogen', pct: 87.6, color: '#38bdf8' },
        { formula: 'He', name: 'Helium', pct: 11.8, color: '#fbbf24' },
        { formula: 'CH₄', name: 'Methane', pct: 0.35, color: '#a78bfa' },
        { formula: 'NH₃', name: 'Ammonia Ice Crystals', pct: 0.25, color: '#f472b6' }
      ];
      palette = prng.chance(0.5)
        ? {
            deepOcean: [0.58, 0.38, 0.24],
            shallowOcean: [0.76, 0.56, 0.38],
            lowland: [0.88, 0.75, 0.58],
            highland: [0.68, 0.42, 0.26],
            peak: [0.94, 0.88, 0.78],
            atmosphere: [0.85, 0.68, 0.46],
            cloud: [0.92, 0.84, 0.72]
          }
        : {
            deepOcean: [0.25, 0.34, 0.48],
            shallowOcean: [0.46, 0.56, 0.68],
            lowland: [0.76, 0.72, 0.64],
            highland: [0.54, 0.44, 0.38],
            peak: [0.92, 0.90, 0.86],
            atmosphere: [0.62, 0.74, 0.88],
            cloud: [0.88, 0.90, 0.94]
          };
      break;
    }

    case 'ice_giant': {
      typeLabel = 'Neptunian Ice Giant';
      massEarths = prng.range(12, 38);
      radiusEarths = prng.range(3.6, 5.4);
      albedo = prng.range(0.35, 0.48);
      pressureAtm = 500;
      oceanCoverage = 0.0;
      iceCoverage = 0.0;
      cloudCoverage = 0.95;
      terrainRoughness = 0.2;
      tectonics = 0.0;
      volcanism = 0.0;
      atmosphereComposition = [
        { formula: 'H₂', name: 'Molecular Hydrogen', pct: 79.5, color: '#38bdf8' },
        { formula: 'He', name: 'Helium', pct: 17.2, color: '#fbbf24' },
        { formula: 'CH₄', name: 'Hydrocarbons & Methane', pct: 2.8, color: '#2dd4bf' },
        { formula: 'H₂O/NH₃', name: 'Superionic Ice Mantle', pct: 0.5, color: '#818cf8' }
      ];
      palette = {
        deepOcean: [0.06, 0.26, 0.58],
        shallowOcean: [0.12, 0.48, 0.78],
        lowland: [0.22, 0.68, 0.88],
        highland: [0.15, 0.38, 0.68],
        peak: [0.78, 0.94, 1.0],
        atmosphere: [0.22, 0.74, 0.96],
        cloud: [0.78, 0.95, 1.0]
      };
      break;
    }

    case 'cryo_glacial': {
      typeLabel = 'Cryogenic World with Subsurface Ocean';
      massEarths = prng.range(0.18, 1.4);
      radiusEarths = Math.pow(massEarths, 0.3);
      albedo = prng.range(0.58, 0.74);
      pressureAtm = prng.chance(0.5) ? prng.range(0.05, 1.4) : 0.002;
      oceanCoverage = 0.15;
      iceCoverage = 0.92;
      cloudCoverage = Math.min(0.65, pressureAtm * 0.4);
      terrainRoughness = 0.58;
      tectonics = 0.45;
      volcanism = 0.42;
      atmosphereComposition = [
        { formula: 'N₂', name: 'Cryogenic Nitrogen', pct: 91.5, color: '#38bdf8' },
        { formula: 'CH₄', name: 'Liquid/Gaseous Methane', pct: 6.8, color: '#2dd4bf' },
        { formula: 'CO', name: 'Carbon Monoxide', pct: 1.7, color: '#94a3b8' }
      ];
      palette = {
        deepOcean: [0.12, 0.28, 0.45],
        shallowOcean: [0.35, 0.58, 0.74],
        lowland: [0.68, 0.78, 0.88],
        highland: [0.54, 0.46, 0.44],
        peak: [0.94, 0.97, 1.0],
        atmosphere: [0.45, 0.82, 0.96],
        cloud: [0.88, 0.94, 0.98]
      };
      break;
    }

    default: {
      typeLabel = 'Cratered Silicate Planet';
      massEarths = prng.range(0.06, 0.65);
      radiusEarths = Math.pow(massEarths, 0.28);
      albedo = 0.14;
      pressureAtm = 0.0001;
      oceanCoverage = 0.0;
      iceCoverage = semiMajorAxisAU > star.frostLineAU ? 0.35 : 0.0;
      cloudCoverage = 0.0;
      terrainRoughness = 0.92;
      tectonics = 0.05;
      volcanism = 0.05;
      atmosphereComposition = [
        { formula: 'Exosphere', name: 'Stellar-Wind Sputtered Sodium & Helium', pct: 100.0, color: '#94a3b8' }
      ];
      palette = {
        deepOcean: [0.22, 0.21, 0.23],
        shallowOcean: [0.30, 0.29, 0.31],
        lowland: [0.42, 0.41, 0.43],
        highland: [0.56, 0.55, 0.57],
        peak: [0.76, 0.75, 0.78],
        atmosphere: [0.45, 0.48, 0.54],
        cloud: [0.5, 0.5, 0.5]
      };
      break;
    }
  }

  const eqTempK = star.tempK * Math.sqrt((star.radiusSolar * 695700) / (2 * semiMajorAxisAU * 1.496e8)) * Math.pow(1 - albedo, 0.25);
  let greenhouseDeltaK = 0;
  if (archetype === 'venusian_greenhouse') greenhouseDeltaK = 380;
  else if (archetype === 'temperate_terrestrial' || archetype === 'super_earth_temperate' || archetype === 'pelagic_ocean') {
    greenhouseDeltaK = Math.max(12, Math.min(85, 290 - eqTempK));
  } else if (pressureAtm > 0.1 && pressureAtm < 20) {
    greenhouseDeltaK = Math.pow(pressureAtm, 0.5) * 24;
  }
  const surfaceTempK = isAnchorHomeworld ? 289.5 : Math.max(25, eqTempK + greenhouseDeltaK);
  const surfaceTempC = surfaceTempK - 273.15;

  const gravityG = massEarths / Math.max(0.05, radiusEarths * radiusEarths);
  const escapeVelocityKmS = 11.186 * Math.sqrt(massEarths / Math.max(0.05, radiusEarths));
  const densityGcm3 = 5.51 * (massEarths / Math.pow(radiusEarths, 3));
  const magneticFieldGauss = archetype === 'gas_giant'
    ? prng.range(3.5, 14.0)
    : tectonics > 0.4
    ? prng.range(0.35, 1.45)
    : prng.range(0.0, 0.08);

  const esiTemp = Math.max(0, 1 - Math.abs(surfaceTempK - 288) / 140);
  const esiRadius = Math.max(0, 1 - Math.abs(radiusEarths - 1.0) / 3.5);
  const esiAtm = archetype === 'gas_giant' || archetype === 'ice_giant' ? 0.05 : Math.max(0, 1 - Math.abs(Math.log10(Math.max(0.01, pressureAtm))) / 2.2);
  const habitabilityScore = isAnchorHomeworld
    ? 0.95
    : Math.max(0.02, Math.min(0.98, esiTemp * 0.5 + esiRadius * 0.25 + esiAtm * 0.25));

  const periodYears = Math.sqrt(Math.pow(semiMajorAxisAU, 3) / Math.max(0.08, star.currentMassSolar));
  const orbit = {
    a: semiMajorAxisAU,
    e: isAnchorHomeworld ? 0.017 : prng.range(0.004, 0.14),
    i: prng.range(-0.08, 0.08),
    omega: prng.range(0, Math.PI * 2),
    w: prng.range(0, Math.PI * 2),
    M0: (pIndex * 1.45 + prng.range(0, 1.2)) % (Math.PI * 2),
    periodYears
  };

  let rings = null;
  if (
    (archetype === 'gas_giant' && prng.chance(0.68)) ||
    (archetype === 'ice_giant' && prng.chance(0.55)) ||
    (pIndex === 3 && prng.chance(0.35))
  ) {
    rings = {
      innerRadiusRatio: 1.38,
      outerRadiusRatio: prng.range(2.15, 2.85),
      tiltRad: prng.range(0.12, 0.45),
      opacity: prng.range(0.45, 0.88),
      composition: beyondFrostLine ? 'Crystalline Water Ice & Silicates' : 'Silicate Dust & Regolith',
      color: palette.peak
    };
  }

  const moonCount = archetype === 'gas_giant'
    ? prng.int(3, 5)
    : archetype === 'ice_giant'
    ? prng.int(2, 4)
    : massEarths > 0.6
    ? prng.int(1, 2)
    : 0;

  const moons = [];
  for (let m = 0; m < moonCount; m++) {
    const mPrng = new PRNG(hashHierarchy(pSeed, 'MOON', m));
    const mDistRadii = 3.2 + m * 2.1 + mPrng.range(0, 0.8);
    moons.push({
      id: `moon-${pIndex}-${m}`,
      name: `${generateAstronomicalName(mPrng)}`,
      designation: `${roman}-${String.fromCharCode(97 + m)}`,
      radiusKm: mPrng.range(450, 2650),
      distancePlanetRadii: mDistRadii,
      orbitalPeriodDays: 1.2 * Math.pow(mDistRadii, 1.5),
      angleOffset: mPrng.range(0, Math.PI * 2),
      type: m === 0 && archetype === 'gas_giant'
        ? 'Tidally Heated Volcanic Moon (Io-Analog)'
        : beyondFrostLine
        ? 'Cryo-Crustal Moon with Subsurface Ocean (Europa-Analog)'
        : 'Cratered Silicate Satellite',
      color: m === 0 && archetype === 'gas_giant' ? [0.95, 0.78, 0.28] : [0.75, 0.78, 0.82]
    });
  }

  // Tidal Locking Physics: tau_lock scales roughly with a^6 / M_star^2
  const tidalLockRadiusAU = 0.42 * Math.pow(star.currentMassSolar, 0.35) * Math.pow(Math.max(0.5, currentAgeGyr) / 4.5, 0.16);
  const isTidallyLocked = (starSystem.index === 6 && pIndex === 2) || (semiMajorAxisAU < tidalLockRadiusAU && archetype !== 'gas_giant');

  // Tectonic Regime & Atmospheric Scale Height (H = R*T / (M*g))
  const tectonicRegime = archetype === 'gas_giant' || archetype === 'ice_giant'
    ? 'Superionic Convective Fluid Mantle'
    : archetype === 'cryo_glacial'
    ? 'Cryo-Tectonic Ice Shell Convection'
    : tectonics > 0.65
    ? 'Active Mobile-Lid Plate Tectonics'
    : tectonics > 0.32
    ? 'Episodic Mantle Overturn'
    : 'Stagnant-Lid Thermal Conduction';

  const meanMolarMass = archetype === 'gas_giant' || archetype === 'ice_giant' ? 0.0023 : 0.029;
  const scaleHeightKm = (8.314 * surfaceTempK) / Math.max(0.01, meanMolarMass * gravityG * 9.81) / 1000;
  const surfaceWindKmH = pressureAtm < 0.005
    ? 0
    : archetype === 'gas_giant' || archetype === 'ice_giant'
    ? Math.round(prng.range(380, 1450))
    : isTidallyLocked
    ? Math.round(prng.range(65, 160)) // Strong substellar-to-nightside thermal circulation
    : Math.round(prng.range(14, 72));

  const properName = isAnchorHomeworld
    ? (starSystem.index === 1 ? 'Thalassa Prime' : 'Aurelia IV (Gaia-Nova)')
    : (starSystem.index === 6 && pIndex === 2)
    ? 'Terminus III (Eyeball World)'
    : `${starSystem.name.split(' ')[1] || starSystem.name} ${roman}`;

  const biosphere = generateBiosphere({
    pSeed,
    archetype,
    habitabilityScore,
    surfaceTempK,
    pressureAtm,
    gravityG,
    star,
    currentAgeGyr,
    forceBiosphere: isAnchorHomeworld || isSecondaryHabitable || (starSystem.index === 6 && pIndex === 2)
  });

  const civilization = generateCivilization({
    pSeed,
    properName,
    biosphere,
    habitabilityScore,
    currentAgeGyr,
    forceCivilization: isAnchorHomeworld || (starSystem.hasCivilization && pIndex === 2)
  });

  const landmarks = generateSurfaceLandmarks(pSeed, properName, archetype, biosphere, civilization);

  return {
    id: `${starSystem.id}-pl-${pIndex}`,
    index: pIndex,
    seed: pSeed,
    name: properName,
    roman,
    archetype,
    typeLabel: isTidallyLocked && biosphere.active ? 'Tidally Locked Eyeball World' : typeLabel,
    massEarths,
    radiusEarths,
    radiusKm: radiusEarths * 6371,
    gravityG,
    escapeVelocityKmS,
    densityGcm3,
    albedo,
    pressureAtm,
    eqTempK,
    greenhouseDeltaK,
    surfaceTempK,
    surfaceTempC,
    oceanCoverage,
    iceCoverage,
    cloudCoverage,
    terrainRoughness,
    tectonics,
    tectonicRegime,
    volcanism,
    magneticFieldGauss,
    habitabilityScore,
    inHabitableZone,
    isTidallyLocked,
    scaleHeightKm,
    surfaceWindKmH,
    axialTiltDeg: isTidallyLocked ? 0.4 : prng.range(2.5, 34.0),
    rotationPeriodHours: isTidallyLocked ? periodYears * 8766 : prng.range(9.5, 42.0),
    atmosphereComposition,
    palette,
    orbit,
    rings,
    moons,
    biosphere,
    civilization,
    landmarks
  };
}

/**
 * 6. BIOSPHERE & EVOLUTIONARY ECOLOGY GENERATOR
 */
const CLADE_PREFIXES = ['Xeno', 'Chryso', 'Thalasso', 'Aero', 'Pyro', 'Litho', 'Photono', 'Neuro', 'Myco', 'Bathy', 'Caelo', 'Sylvo'];
const CLADE_ROOTS = ['phyta', 'zoon', 'morpha', 'caris', 'dendron', 'teuthis', 'sauros', 'ptera', 'corallis', 'medusa', 'arachne', 'cetos'];
const CLADE_SPECIES = ['luminis', 'imperialis', 'abyssalis', 'stellaris', 'velox', 'magnifica', 'symbiotica', 'prisca', 'coronata', 'regalis'];

function generateBiosphere({ pSeed, archetype, habitabilityScore, surfaceTempK, pressureAtm, gravityG, star, currentAgeGyr, forceBiosphere }) {
  const prng = new PRNG(hashHierarchy(pSeed, 'BIOSPHERE'));

  const canHaveSubsurfaceLife = archetype === 'cryo_glacial' && prng.chance(0.55);
  const canHaveSurfaceLife =
    forceBiosphere ||
    (habitabilityScore > 0.58 && currentAgeGyr > 0.45 && archetype !== 'gas_giant' && archetype !== 'ice_giant');

  if (!canHaveSurfaceLife && !canHaveSubsurfaceLife) {
    return {
      active: false,
      stage: 'Sterile / Inert Prebiotic Chemistry',
      complexityIndex: 0.0,
      biomassGt: 0,
      biochemistry: 'None',
      energySource: 'None',
      speciesCountEstimate: 0,
      clades: [],
      trophicLinks: [],
      adaptations: ['No detectable metabolic activity on planetary surface'],
      extinctionEvents: 0
    };
  }

  const isSubsurface = !canHaveSurfaceLife && canHaveSubsurfaceLife;
  const bioAgeGyr = Math.max(0.15, currentAgeGyr - 0.35);
  const complexityIndex = forceBiosphere
    ? prng.range(0.86, 0.98)
    : isSubsurface
    ? prng.range(0.32, 0.62)
    : Math.min(0.96, 0.35 + bioAgeGyr * 0.14);

  const stage = complexityIndex > 0.78
    ? 'Complex Multicellular Biosphere (Global Ecosystems)'
    : complexityIndex > 0.48
    ? 'Multicellular Trophic Web & Continental Flora'
    : 'Chemosynthetic / Colonial Microbial Ecosystem';

  const biochemistry = isSubsurface
    ? 'Subglacial Carbon-Water (Hydrothermal)'
    : surfaceTempK < 210
    ? 'Cryogenic Hydrocarbon / Ammonia-Water'
    : 'Chiral Carbon-Water with Complex Biopolymers';

  const energySource = isSubsurface
    ? 'Tidal Hydrothermal Vent Chemosynthesis'
    : star.tempK < 4100
    ? 'Near-Infrared Photosynthesis (Deep Crimson-Black Pigments)'
    : star.tempK > 6600
    ? 'High-Reflectance UV-Protective Photosynthesis (Gold-Teal Pigments)'
    : 'Multi-Band Oxygenic Photosynthesis (Chlorophyll & Phycobilins)';

  const foliageRGB = star.tempK < 4200
    ? [0.42, 0.14, 0.32]
    : star.tempK > 6600
    ? [0.16, 0.56, 0.52]
    : [0.16, 0.46, 0.24];

  const roles = [
    { role: 'Primary Producer', trophicLevel: 1, icon: 'flora', baseBiomass: 0.62 },
    { role: 'Colonial / Reef Symbiont', trophicLevel: 1.5, icon: 'colonial', baseBiomass: 0.21 },
    { role: 'Primary Herbivore / Filter Feeder', trophicLevel: 2, icon: 'herbivore', baseBiomass: 0.11 },
    { role: 'Apex Predator', trophicLevel: 3, icon: 'predator', baseBiomass: 0.025 },
    { role: 'Biogeochemical Decomposer', trophicLevel: 1.8, icon: 'decomposer', baseBiomass: 0.035 }
  ];

  const clades = roles.map((r, idx) => {
    const cPrng = new PRNG(hashHierarchy(pSeed, 'CLADE', idx));
    const genus = `${cPrng.pick(CLADE_PREFIXES)}${cPrng.pick(CLADE_ROOTS)}`;
    const species = cPrng.pick(CLADE_SPECIES);

    const symmetry = idx === 0
      ? cPrng.pick(['Radial Fractal', 'Photonic Helical', 'Pneumatic Reticular'])
      : cPrng.pick(['Bilateral Hexapod', 'Pentameric Radial', 'Hydrodynamic Cephalopod', 'Armored Articulated']);

    const locomotion = idx === 0
      ? 'Sessile Rooted with Active Phototropism'
      : idx === 1
      ? 'Aero-Planktonic Drift / Reef Matrix'
      : gravityG > 1.35
      ? 'Low-Center Multi-Limb High-Stability Gait'
      : 'Biomechanical Propulsion / Atmospheric Gliding';

    const sensoryMode = cPrng.pick([
      'Multispectral Vision (UV + Thermal Infrared)',
      'Phase-Variable Acoustic Echolocation',
      'Magnetospheric Electroreception',
      'Bioluminescent Photonic Chemoreception'
    ]);

    const traits = [];
    if (gravityG > 1.3) traits.push(`Reinforced carbon-silicate composite endoskeleton (${gravityG.toFixed(2)} g)`);
    else if (gravityG < 0.8) traits.push(`Elongated low-gravity morphology (${gravityG.toFixed(2)} g)`);
    else traits.push('Articulated endoskeleton & active thermoregulation');

    if (star.tempK < 4400) traits.push('Cellular membranes shielded against XUV stellar superflares');
    if (pressureAtm > 1.8) traits.push('High-density counter-current respiratory exchange');
    traits.push(`Adaptive bioluminescence (${sensoryMode.split(' ')[0]})`);

    return {
      id: `clade-${idx}`,
      index: idx,
      binomialName: `${genus} ${species}`,
      commonArchetype: r.role,
      trophicLevel: r.trophicLevel,
      icon: r.icon,
      symmetry,
      locomotion,
      sensoryMode,
      bioluminescence: cPrng.chance(0.65),
      biomassShare: r.baseBiomass,
      populationTrend: cPrng.range(-0.04, 0.08),
      generationTimeYears: idx === 0 ? cPrng.range(1.5, 40) : cPrng.range(0.8, 18),
      bodySegments: cPrng.int(4, 11),
      appendageCount: idx === 0 ? cPrng.int(5, 12) : cPrng.int(4, 8),
      hueDeg: (idx * 68 + cPrng.int(0, 45)) % 360,
      traits
    };
  });

  const trophicLinks = [
    { from: 0, to: 2, efficiency: 0.14, label: 'Photosynthetic Flux' },
    { from: 1, to: 2, efficiency: 0.12, label: 'Nutrient Symbiosis' },
    { from: 2, to: 3, efficiency: 0.11, label: 'Selective Predation' },
    { from: 3, to: 4, efficiency: 0.22, label: 'Detritivore Loop' },
    { from: 4, to: 0, efficiency: 0.85, label: 'Nitrogen/Phosphorus Mineralization' }
  ];

  return {
    active: true,
    isSubsurface,
    stage,
    complexityIndex,
    bioAgeGyr,
    biomassGt: Math.round(complexityIndex * 640 * (1 + prng.range(-0.2, 0.4))),
    biochemistry,
    energySource,
    foliageRGB,
    speciesCountEstimate: Math.round(Math.pow(10, 4.2 + complexityIndex * 2.8)),
    clades,
    trophicLinks,
    adaptations: [
      `Photosynthetic pigmentation tuned to ${star.spectralClass} spectrum (${Math.round(star.tempK)} K)`,
      `Biomechanical adaptation to ${gravityG.toFixed(2)} g surface gravity`,
      `Circadian metabolism synchronized with ${(12 + (pSeed % 20)).toFixed(1)}-hour rotation`
    ],
    extinctionEvents: Math.floor(bioAgeGyr * 1.1)
  };
}

/**
 * 7. INTELLIGENT CIVILIZATION & HISTORICAL CHRONICLE GENERATOR
 */
const CIV_ETHOS = [
  {
    name: 'Harmonic Orbital Technocracy',
    governance: 'Planetary Science Council & Quantum Mesh',
    philosophy: 'Balancing astrophysical expansion with preservation of the native biosphere'
  },
  {
    name: 'Collective Ecospheric Symbiosis',
    governance: 'Distributed Bio-Digital Synapse',
    philosophy: 'Genetic and technological integration with planetary trophic networks'
  },
  {
    name: 'Interplanetary Mercantile Coalition',
    governance: 'Federation of Orbital City-States & Space Elevators',
    philosophy: 'Asteroid belt mining, energy commerce, and outer-moon colonization'
  },
  {
    name: 'Post-Biological Archival Order',
    governance: 'Autonomous Computational Matrix',
    philosophy: 'Long-term cosmological observation and sub-universe simulation'
  }
];

function generateCivilization({ pSeed, properName, biosphere, habitabilityScore, currentAgeGyr, forceCivilization }) {
  const prng = new PRNG(hashHierarchy(pSeed, 'CIVILIZATION'));

  const emerged =
    forceCivilization ||
    (biosphere.active && biosphere.complexityIndex > 0.76 && prng.chance(0.42));

  if (!emerged) {
    return {
      active: false,
      status: 'No Technological Civilization Detected',
      kardashev: 0.0,
      history: generateNaturalChronicle(properName, currentAgeGyr, biosphere)
    };
  }

  const kardashev = forceCivilization
    ? prng.range(1.08, 1.48)
    : prng.range(0.72, 1.65);

  const ethos = prng.pick(CIV_ETHOS);
  const speciesName = `Sapiens ${generateAstronomicalName(prng)}`;
  const civAgeKy = Math.round(prng.range(14, 420));
  const populationBillions = Number((prng.range(4.2, 28.5) * kardashev).toFixed(2));
  const energyPowerTW = Math.round(Math.pow(10, (kardashev - 0.7) * 4.2) * 18);

  const cooperationIndex = prng.range(0.62, 0.96);
  const conflictRisk = Math.max(0.03, 1.0 - cooperationIndex - prng.range(0, 0.15));
  const sustainabilityIndex = prng.range(0.68, 0.95);

  const megastructures = [];
  if (kardashev >= 0.85) {
    megastructures.push({
      id: 'mega-ring',
      name: 'Equatorial Orbital Ring & Space Elevators',
      type: 'orbital_ring',
      completion: Math.min(1.0, (kardashev - 0.65) * 1.4),
      description: 'Non-rocket orbital launch infrastructure and geostationary solar power relay'
    });
  }
  if (kardashev >= 1.05) {
    megastructures.push({
      id: 'mega-dyson',
      name: 'Dyson Swarm Collector Nodes',
      type: 'dyson_swarm',
      completion: Math.min(1.0, (kardashev - 0.9) * 0.95),
      description: 'Photovoltaic mirrors and quantum collectors in close heliocentric orbit'
    });
  }
  if (kardashev >= 0.95) {
    megastructures.push({
      id: 'mega-shield',
      name: 'Climate & Magnetospheric Regulation Grid',
      type: 'climate_array',
      completion: 0.92,
      description: 'Planetary albedo stabilization and solar-storm magnetic shielding'
    });
  }

  const techDomains = [
    { name: 'Energy Production', level: kardashev > 1.2 ? 'He³ Fusion & Stellar Collectors' : 'Magnetic Confinement Fusion & Orbital Solar', progress: Math.min(100, Math.round(kardashev * 62)) },
    { name: 'Space Propulsion', level: kardashev > 1.3 ? 'Relativistic Laser Sails & Catalyzed Antimatter' : 'Pulsed Fusion Torches & Magneto-Plasma', progress: Math.min(100, Math.round(kardashev * 58)) },
    { name: 'Biotech & Ecology', level: 'Adaptive Genomic Engineering & Biospheric Restoration', progress: Math.min(100, Math.round(sustainabilityIndex * 94)) },
    { name: 'Computation & AI', level: 'Planetary Quantum Networks & Cognitive Synthesis', progress: Math.min(100, Math.round(kardashev * 65)) }
  ];

  const history = [
    ...generateNaturalChronicle(properName, currentAgeGyr, biosphere),
    {
      epoch: `T - ${civAgeKy} kyr`,
      category: 'evolution',
      title: `Cognitive Emergence of ${speciesName}`,
      detail: 'Development of symbolic language, cumulative cultural transmission, and early settlements.'
    },
    {
      epoch: `T - ${Math.round(civAgeKy * 0.25)} kyr`,
      category: 'civ',
      title: 'Thermodynamic Revolution & Planetary Unification',
      detail: `Resolved pre-Kardashev I ecological bottleneck; adopted the ${ethos.name} model.`
    },
    {
      epoch: `T - ${Math.round(civAgeKy * 0.08)} kyr`,
      category: 'tech',
      title: 'Inauguration of Orbital Infrastructure',
      detail: 'Construction of equatorial space elevators and colonization of natural moons.'
    },
    {
      epoch: 'Current Epoch',
      category: 'civ',
      title: `Kardashev Type ${kardashev.toFixed(2)} Civilization`,
      detail: `Population ${populationBillions} billion; installed output ${energyPowerTW} TW; cooperation index ${Math.round(cooperationIndex * 100)}%.`
    }
  ];

  return {
    active: true,
    status: 'Active Interplanetary Civilization',
    speciesName,
    ethos,
    kardashev,
    civAgeKy,
    populationBillions,
    energyPowerTW,
    cooperationIndex,
    conflictRisk,
    sustainabilityIndex,
    cityLightIntensity: Math.min(1.0, kardashev * 0.72),
    megastructures,
    techDomains,
    history
  };
}

function generateNaturalChronicle(properName, currentAgeGyr, biosphere) {
  const chronicle = [
    {
      epoch: `T - ${currentAgeGyr.toFixed(2)} Gyr`,
      category: 'astro',
      title: `Protoplanetary Accretion of ${properName}`,
      detail: 'Silicate condensation and gravitational differentiation of the iron-nickel core.'
    },
    {
      epoch: `T - ${(currentAgeGyr * 0.85).toFixed(2)} Gyr`,
      category: 'geo',
      title: 'Crustal Stabilization & Atmospheric Outgassing',
      detail: 'Mantle cooling, secondary atmosphere formation, and condensation of volatile oceans.'
    }
  ];

  if (biosphere && biosphere.active) {
    chronicle.push({
      epoch: `T - ${biosphere.bioAgeGyr.toFixed(2)} Gyr`,
      category: 'bio',
      title: 'Abiogenesis & Emergence of First Replicators',
      detail: `Transition from prebiotic chemistry to self-replicating membranes (${biosphere.biochemistry}).`
    });
    if (biosphere.complexityIndex > 0.5) {
      chronicle.push({
        epoch: `T - ${(biosphere.bioAgeGyr * 0.45).toFixed(2)} Gyr`,
        category: 'bio',
        title: 'Great Oxidation & Multicellular Radiation',
        detail: `Expansion of primary producers (${biosphere.energySource}) and trophic diversification.`
      });
    }
  }

  return chronicle;
}

/**
 * Generate Interactive 3D Planetary Surface Landmarks
 */
function generateSurfaceLandmarks(pSeed, planetName, archetype, biosphere, civilization) {
  const prng = new PRNG(hashHierarchy(pSeed, 'LANDMARKS'));
  const landmarks = [];

  const geoTypes = archetype === 'gas_giant' || archetype === 'ice_giant'
    ? [
        { type: 'Persistent Anticyclone', icon: 'storm' },
        { type: 'Equatorial Jet Stream', icon: 'wind' },
        { type: 'Hexagonal Polar Vortex', icon: 'vortex' }
      ]
    : [
        { type: 'Cratonic Continent / Plateau', icon: 'continent' },
        { type: 'Oceanic Basin / Mare', icon: 'ocean' },
        { type: 'Shield Volcano / Caldera', icon: 'volcano' },
        { type: 'Rift Valley / Tectonic Canyon', icon: 'canyon' },
        { type: 'Multi-Ring Impact Crater', icon: 'crater' }
      ];

  for (let i = 0; i < 6; i++) {
    const g = geoTypes[i % geoTypes.length];
    const lat = prng.range(-65, 65);
    const lon = prng.range(-180, 180);
    landmarks.push({
      id: `lm-${i}`,
      name: `${g.type.split(' ')[0]} ${generateAstronomicalName(prng)}`,
      category: g.type,
      icon: g.icon,
      lat,
      lon,
      elevationKm: g.icon === 'ocean' ? prng.range(-8.5, -2.1) : prng.range(1.4, 14.8),
      tempOffsetK: -lat * 0.25
    });
  }

  if (biosphere && biosphere.active) {
    landmarks.push({
      id: 'lm-bio-0',
      name: `${generateAstronomicalName(prng)} Biosphere Reserve`,
      category: 'Biodiversity Hotspot & Primary Forest',
      icon: 'biosphere',
      lat: prng.range(-25, 25),
      lon: prng.range(-120, 120),
      elevationKm: 0.4,
      tempOffsetK: 2.0
    });
  }

  if (civilization && civilization.active) {
    landmarks.push({
      id: 'lm-civ-0',
      name: `${generateAstronomicalName(prng)} Metropolis & Tether`,
      category: 'Planetary Capital & Space Elevator Anchor',
      icon: 'city',
      lat: prng.range(-18, 18),
      lon: prng.range(-90, 90),
      elevationKm: 0.25,
      tempOffsetK: 1.5
    });
  }

  return landmarks;
}
