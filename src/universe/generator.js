/**
 * PARALLAX — Procedural Multi-Scale Universe Generator
 * Generates coherent, physically plausible, and deterministic entities across 7 scales:
 * 1. Cosmo (Cosmic Web, Superclusters, Filaments, Voids)
 * 2. Galassie (Spirals, Barred, Ellipticals, Irregulars, SMBH, Nebulae)
 * 3. Stelle (O..M spectral classes, Protostars, Main Sequence, Giants, White Dwarfs, Pulsars, Black Holes)
 * 4. Sistemi Planetari (Keplerian Orbits, Moons, Rings, Asteroid Belts, Comets)
 * 5. Pianeti (Tectonics, Continents, Oceans, Craters, Volcanoes, Rayleigh/Mie Atmospheres, Climate)
 * 6. Vita (Abiogenesis, Trophic Food Webs, Clades, Morphology, Adaptations, Extinctions)
 * 7. Civiltà (Kardashev Scale, Culture, Tech Matrix, Conflict/Cooperation, Megastructures, History)
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
  { id: 'cosmos', index: 0, name: 'Cosmo', subtitle: 'Rete Cosmica, Superammassi e Vuoti', defaultLogScale: 24.6, minLog: 22.8, maxLog: 26.0 },
  { id: 'galaxy', index: 1, name: 'Galassia', subtitle: 'Struttura Galattica, Nebulose e Nucleo', defaultLogScale: 20.6, minLog: 18.8, maxLog: 22.8 },
  { id: 'sector', index: 2, name: 'Settore Stellare', subtitle: 'Ammasso Locale ed Evoluzione Stellare', defaultLogScale: 17.2, minLog: 14.8, maxLog: 18.8 },
  { id: 'system', index: 3, name: 'Sistema Planetario', subtitle: 'Dinamica Orbitale Kepleriana', defaultLogScale: 12.3, minLog: 9.8, maxLog: 14.8 },
  { id: 'planet', index: 4, name: 'Pianeta', subtitle: 'Geofisica, Atmosfera e Clima Globale', defaultLogScale: 7.4, minLog: 4.8, maxLog: 9.8 },
  { id: 'surface', index: 5, name: 'Superficie & Vita', subtitle: 'Orizzonte Planetario ed Ecosistema', defaultLogScale: 3.1, minLog: 1.5, maxLog: 4.8 },
  { id: 'civilization', index: 6, name: 'Biosfera & Civiltà', subtitle: 'Morfologia Organica e Tecnosfera', defaultLogScale: 0.7, minLog: -0.5, maxLog: 1.5 }
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

    // Position along 3D cosmic web density ridges
    let x = scPrng.range(-1.8, 1.8);
    let y = scPrng.range(-1.1, 1.1);
    let z = scPrng.range(-1.8, 1.8);
    if (i === 0) {
      x = 0.0;
      y = 0.0;
      z = 0.0;
    }

    const density = fbm3D(x * 1.5 + 3.1, y * 1.5 + 1.7, z * 1.5 + 5.3, 4);
    const massLogSolar = scPrng.range(15.2, 16.8); // 10^15 to 10^16.8 M_sun
    const galaxyCount = Math.round(scPrng.range(1800, 45000));
    const spanMpc = scPrng.range(45, 190);
    const distMpc = Math.hypot(x + sx * 4, y + sy * 4, z + sz * 4) * 140;
    const redshift = Math.max(0.001, (distMpc * 67.4) / 299792.458);

    const name = i === 0
      ? 'Superammasso Laniakea-Prime'
      : `Superammasso ${generateAstronomicalName(scPrng)}`;

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
      icmTempKelvin: scPrng.range(1.5e7, 8.5e7), // Intracluster medium X-ray gas temp
      dominantMorphology: scPrng.pick([
        'Nodo Filamentare Ricco',
        'Attrattore Gravitazionale Centrale',
        'Arco Cosmico Multi-Ammasso',
        'Parete Galattica (Great Wall)'
      ]),
      color: i === 0 ? [0.95, 0.75, 0.42] : [
        scPrng.range(0.55, 0.98),
        scPrng.range(0.68, 0.92),
        scPrng.range(0.80, 1.0)
      ]
    });
  }

  // Build cosmic filaments connecting nearby superclusters
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

  // Cosmic Voids
  for (let v = 0; v < 5; v++) {
    const vPrng = new PRNG(hashHierarchy(seed, 'VOID', v));
    voids.push({
      id: `void-${v}`,
      name: `Vuoto di ${generateAstronomicalName(vPrng)}`,
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
  { code: 'SA(s)bc', label: 'Spirale Grand-Design', family: 'spiral', arms: 2, bar: 0.1, bulge: 0.25, dust: 0.85, starFormation: 0.85 },
  { code: 'SB(r)b', label: 'Spirale Barrata', family: 'barred', arms: 2, bar: 0.55, bulge: 0.32, dust: 0.78, starFormation: 0.75 },
  { code: 'SA(s)c', label: 'Spirale Multi-Braccio Flocculenta', family: 'spiral', arms: 4, bar: 0.08, bulge: 0.18, dust: 0.92, starFormation: 0.95 },
  { code: 'E2', label: 'Ellittica Gigante', family: 'elliptical', arms: 0, bar: 0.0, bulge: 0.95, dust: 0.12, starFormation: 0.08 },
  { code: 'S0', label: 'Lenticolare', family: 'lenticular', arms: 0, bar: 0.2, bulge: 0.60, dust: 0.35, starFormation: 0.22 },
  { code: 'Irr-I', label: 'Irregolare Magellanica Starburst', family: 'irregular', arms: 3, bar: 0.15, bulge: 0.10, dust: 0.95, starFormation: 1.0 }
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
      ? 'Galassia Aethelgard (NGC-7491)'
      : `Galassia ${generateAstronomicalName(prng)}`;

    // Position in supercluster cluster coordinates
    const angle = i * 2.39996 + prng.range(-0.2, 0.2);
    const dist = i === 0 ? 0 : Math.pow(i / count, 0.7) * 1.65;
    const pos = [
      Math.cos(angle) * dist,
      prng.range(-0.45, 0.45) * (i === 0 ? 0 : 1),
      Math.sin(angle) * dist
    ];

    // Generate HII Regions / Nebulae inside the galaxy
    const nebulae = [];
    const nebCount = morph.family === 'elliptical' ? 2 : 7;
    for (let n = 0; n < nebCount; n++) {
      const nAngle = (n / nebCount) * Math.PI * 2 + prng.range(0, 1);
      const nR = prng.range(0.22, 0.82);
      const spiralTheta = nAngle + Math.log(nR + 0.1) * armTwist;
      nebulae.push({
        id: `neb-${i}-${n}`,
        name: `Nebulosa ${generateAstronomicalName(prng)}`,
        type: prng.pick(['Regione HII ad Emissione', 'Nube Molecolare Gigante', 'Resto di Supernova', 'Nebulosa Oscura Polverosa']),
        position: [Math.cos(spiralTheta) * nR, prng.range(-0.04, 0.04), Math.sin(spiralTheta) * nR],
        radiusPc: prng.range(15, 140),
        ionizationTempK: prng.range(8000, 14000),
        color: prng.pick([
          [0.95, 0.28, 0.48], // H-alpha crimson-magenta
          [0.22, 0.82, 0.88], // O-III doubly ionized oxygen teal
          [0.42, 0.58, 0.98]  // Reflection nebula blue
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
        name: `${name.split(' ')[1] || 'Core'} A*`,
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
  // Main sequence lifetime in Gyr: solar mass = ~10 Gyr
  const msLifetimeGyr = 10.0 * Math.pow(M, -2.5);
  const lifeFraction = ageGyr / Math.max(1e-5, msLifetimeGyr);

  let phase = 'Sequenza Principale';
  let phaseCode = 'V';
  let currentMass = M;
  let radiusSolar = Math.pow(M, 0.8);
  let luminositySolar = Math.pow(M, 3.5);
  let tempK = 5778 * Math.pow(luminositySolar / (radiusSolar * radiusSolar), 0.25);
  let isRemnant = false;
  let remnantType = null;
  let hasNebulaHalo = false;

  if (ageGyr < Math.min(0.015, msLifetimeGyr * 0.02)) {
    phase = 'Protostella T-Tauri con Disco';
    phaseCode = 'PMS';
    radiusSolar = Math.pow(M, 0.8) * 2.4;
    luminositySolar = Math.pow(M, 2.8) * 1.6;
    tempK = Math.max(2900, 4400 * Math.pow(M, 0.25));
    hasNebulaHalo = true;
  } else if (lifeFraction <= 1.0) {
    // On Main Sequence: stars gradually brighten by ~30-50% over their MS life
    phase = 'Sequenza Principale (Fusione H → He)';
    phaseCode = 'V';
    const brighten = 1.0 + 0.42 * lifeFraction;
    const swell = 1.0 + 0.25 * lifeFraction;
    radiusSolar = Math.pow(M, 0.8) * swell;
    luminositySolar = Math.pow(M, 3.5) * brighten;
    tempK = 5778 * Math.pow(luminositySolar / (radiusSolar * radiusSolar), 0.25);
  } else if (lifeFraction <= 1.15) {
    // Red Giant / Supergiant helium burning phase
    const giantProgress = (lifeFraction - 1.0) / 0.15;
    if (M >= 8.5) {
      phase = giantProgress < 0.5 ? 'Supergigante Blu (Fusione He/C)' : 'Supergigante Rossa (Pre-Supernova)';
      phaseCode = 'Ia';
      radiusSolar = Math.pow(M, 0.8) * (15 + giantProgress * 180);
      luminositySolar = Math.pow(M, 3.2) * (2.5 + giantProgress * 4.0);
      tempK = giantProgress < 0.5 ? 14500 : 3650;
    } else {
      phase = giantProgress < 0.35 ? 'Subgigante (Esaurimento H Core)' : 'Gigante Rossa (Ramo RGB/AGB)';
      phaseCode = giantProgress < 0.35 ? 'IV' : 'III';
      radiusSolar = Math.pow(M, 0.75) * (2.5 + Math.pow(giantProgress, 1.6) * 45);
      luminositySolar = Math.pow(M, 2.5) * (3.0 + Math.pow(giantProgress, 1.8) * 180);
      tempK = Math.max(3050, 5200 - giantProgress * 2000);
    }
    currentMass = M * (1.0 - 0.15 * giantProgress);
  } else {
    // Post-stellar Remnant Phase!
    isRemnant = true;
    const remnantAgeGyr = ageGyr - msLifetimeGyr * 1.15;
    hasNebulaHalo = remnantAgeGyr < 0.08; // Ejected planetary nebula or supernova remnant visible!

    if (M < 8.0) {
      phase = hasNebulaHalo ? 'Nebulosa Planetaria & Nana Bianca' : 'Nana Bianca Degenerata (Carbonio-Ossigeno)';
      phaseCode = 'DA';
      remnantType = 'white_dwarf';
      currentMass = Math.min(1.38, 0.45 + M * 0.11);
      radiusSolar = 0.012 * Math.pow(currentMass, -0.33); // Earth-sized!
      const coolingFactor = Math.exp(-remnantAgeGyr / 1.8);
      tempK = Math.max(4500, 38000 * coolingFactor + 4500);
      luminositySolar = Math.pow(radiusSolar, 2) * Math.pow(tempK / 5778, 4);
    } else if (M < 21.0) {
      phase = hasNebulaHalo ? 'Resto di Supernova & Pulsar' : 'Stella di Neutroni / Pulsar Magnetica';
      phaseCode = 'PSR';
      remnantType = 'neutron_star';
      currentMass = 1.35 + (M - 8.0) * 0.06;
      radiusSolar = 0.00002; // ~14 km
      tempK = 42000;
      luminositySolar = 0.04;
    } else {
      phase = 'Buco Nero Stellare (Orizzonte degli Eventi)';
      phaseCode = 'BH';
      remnantType = 'black_hole';
      currentMass = M * 0.38;
      radiusSolar = 0.000045 * currentMass;
      tempK = 28000; // Accretion disk effective color temperature
      luminositySolar = 0.08;
    }
  }

  // Determine spectral letter from effective temperature
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

  // Circumstellar Habitable Zone (Kopparapu et al. approximation in AU)
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
 * Generate a Star Sector inside a Galaxy, containing 28 interactive Star Systems
 */
export function generateStellarSector(galaxy, sectorIndex = 0) {
  const sectorSeed = hashHierarchy(galaxy.seed, 'SECTOR', sectorIndex);
  const prng = new PRNG(sectorSeed);
  const systems = [];
  const count = 26;

  for (let i = 0; i < count; i++) {
    const sysSeed = hashHierarchy(sectorSeed, 'STAR_SYS', i);
    const sysPrng = new PRNG(sysSeed);

    // System 0 is guaranteed to be a rich solar/temperate anchor system with biosphere & civilization;
    // Systems 1..5 guarantee diverse exotic astrophysical classes (Red Giant, O-Supergiant, Pulsar, Black Hole, M-Dwarf Trappist-like)
    let initialMassSolar;
    let ageGyr;
    let isBinary = sysPrng.chance(0.28);

    if (i === 0) {
      initialMassSolar = 1.04;
      ageGyr = 4.62;
      isBinary = false;
    } else if (i === 1) {
      // K-type orange dwarf with lush biosphere
      initialMassSolar = 0.82;
      ageGyr = 6.1;
    } else if (i === 2) {
      // Evolved Red Giant
      initialMassSolar = 1.45;
      ageGyr = 4.25; // past MS lifetime (~3.95 Gyr)
    } else if (i === 3) {
      // Massive Blue O/B Star
      initialMassSolar = 14.2;
      ageGyr = 0.008;
      isBinary = true;
    } else if (i === 4) {
      // Stellar Black Hole / Pulsar remnant system
      initialMassSolar = 26.0;
      ageGyr = 0.04;
    } else if (i === 5) {
      // White Dwarf with Planetary Nebula
      initialMassSolar = 2.2;
      ageGyr = 1.61;
    } else {
      // Realistic Kroupa IMF biased toward exploratory variety
      initialMassSolar = sysPrng.weightedPick([
        { value: sysPrng.range(0.18, 0.55), weight: 32 }, // M dwarf
        { value: sysPrng.range(0.60, 0.89), weight: 24 }, // K dwarf
        { value: sysPrng.range(0.90, 1.25), weight: 20 }, // G/F star
        { value: sysPrng.range(1.30, 2.80), weight: 14 }, // A/F star
        { value: sysPrng.range(3.20, 11.0), weight: 6 },  // B star
        { value: sysPrng.range(12.0, 35.0), weight: 4 }   // O star / remnant
      ]);
      const msLife = 10.0 * Math.pow(initialMassSolar, -2.5);
      ageGyr = sysPrng.chance(0.78)
        ? sysPrng.range(0.05, Math.min(galaxy.ageGyr, msLife * 0.94))
        : sysPrng.range(msLife * 1.01, msLife * 1.35);
    }

    const metallicityFeH = Math.max(-1.2, Math.min(0.5, galaxy.metallicityFeH + sysPrng.range(-0.25, 0.25)));
    const evolution = computeStellarEvolutionState(initialMassSolar, ageGyr, metallicityFeH);

    // Companion star if binary
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

    const designation = i === 0 && galaxy.index === 0
      ? { properName: 'Helios-Vega Prime', catalogId: `${galaxy.catalogId}-S001` }
      : generateStarDesignation(sysPrng, galaxy.catalogId, i);

    const pos = i === 0
      ? [0, 0, 0]
      : [
          sysPrng.range(-1.65, 1.65),
          sysPrng.range(-0.65, 0.65),
          sysPrng.range(-1.65, 1.65)
        ];

    // Summary badge for quick sector scanning (does it have life or civilization?)
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
    name: `Settore Orion-Cygnus ${sectorIndex + 1}`,
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
      notableFeature: 'Civiltà Tecnologica & Biosfera Complessa'
    };
  }
  if (sysIndex === 1) {
    return {
      planetCount: 6,
      hasBiosphere: true,
      hasCivilization: true,
      maxHabitability: 0.89,
      notableFeature: 'Mondo Oceanico Abitato & Rete Orbitale'
    };
  }
  const canHostLife = !starEvo.isRemnant && starEvo.ageGyr > 0.6 && starEvo.tempK < 8500;
  const hasBiosphere = canHostLife && (sysIndex % 3 === 0 || prng.chance(0.42));
  const hasCivilization = hasBiosphere && (sysIndex % 5 === 0 || prng.chance(0.38));
  let notableFeature = starEvo.phase;
  if (hasCivilization) notableFeature = 'Tecnofirma Rilevata (Civiltà Attiva)';
  else if (hasBiosphere) notableFeature = 'Biofirma Spettroscopica (O₂ / CH₄)';
  else if (starEvo.hasNebulaHalo) notableFeature = 'Guscio Nebulare Ionizzato';

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

  // Titius-Bode-like logarithmic orbital spacing scaled by stellar luminosity / mass
  const baseScaleAU = Math.max(0.12, Math.min(1.6, Math.pow(star.initialMassSolar, 1.35) * 0.35));

  for (let p = 0; p < planetCount; p++) {
    const pSeed = hashHierarchy(sysSeed, 'PLANET', p);
    const pPrng = new PRNG(pSeed);

    let semiMajorAxisAU = baseScaleAU * Math.pow(1.72, p) * pPrng.range(0.88, 1.14);

    // Ensure planet 2 in anchor systems sits squarely inside the Circumstellar Habitable Zone!
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

  // Generate 1-2 Asteroid Belts (typically near the frost line)
  const beltAU = star.frostLineAU * prng.range(0.82, 1.15);
  asteroidBelts.push({
    id: `${starSystem.id}-belt-0`,
    name: `Fascia Principale di ${starSystem.name.split(' ')[0]}`,
    innerRadiusAU: beltAU * 0.88,
    outerRadiusAU: beltAU * 1.14,
    composition: 'Silicati Condritici, Carbonacei e Nucleo Metallico Fe-Ni',
    totalMassEarths: prng.range(0.0004, 0.015),
    particleCount: 450
  });

  // Generate 3 Comets on eccentric orbits
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

  // Compute solar irradiance and equilibrium temperature
  const solarFluxEarths = star.luminositySolar / Math.max(0.001, semiMajorAxisAU * semiMajorAxisAU);
  const inHabitableZone = semiMajorAxisAU >= star.hzInnerAU * 0.82 && semiMajorAxisAU <= star.hzOuterAU * 1.22;
  const beyondFrostLine = semiMajorAxisAU > star.frostLineAU;

  // Determine planetary archetype from astrophysical zone
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

  // Physical Dimensions & Interior Geophysics
  let massEarths, radiusEarths, albedo, pressureAtm, oceanCoverage, iceCoverage, cloudCoverage;
  let typeLabel, atmosphereComposition, palette, terrainRoughness, volcanism, tectonics;

  switch (archetype) {
    case 'temperate_terrestrial':
    case 'super_earth_temperate': {
      const isSuper = archetype === 'super_earth_temperate';
      typeLabel = isSuper ? 'Super-Terra Temperata' : 'Pianeta Roccioso Temperato';
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
        { formula: 'N₂', name: 'Azoto Molecolare', pct: 75.4, color: '#38bdf8' },
        { formula: 'O₂', name: 'Ossigeno Biogenico', pct: 21.8, color: '#34d399' },
        { formula: 'Ar', name: 'Argon', pct: 1.4, color: '#94a3b8' },
        { formula: 'H₂O', name: 'Vapore Acqueo', pct: 0.95, color: '#60a5fa' },
        { formula: 'CO₂', name: 'Anidride Carbonica', pct: 0.41, color: '#f59e0b' },
        { formula: 'CH₄', name: 'Metano in Tracce', pct: 0.04, color: '#a78bfa' }
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
      typeLabel = 'Mondo Pelagico Oceanico';
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
        { formula: 'N₂', name: 'Azoto Molecolare', pct: 71.2, color: '#38bdf8' },
        { formula: 'O₂', name: 'Ossigeno Disciolto', pct: 23.5, color: '#34d399' },
        { formula: 'H₂O', name: 'Vapore Acqueo', pct: 3.4, color: '#60a5fa' },
        { formula: 'CO₂', name: 'Anidride Carbonica', pct: 1.9, color: '#f59e0b' }
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
      typeLabel = 'Mondo Vulcanico Iper-Termico';
      massEarths = prng.range(0.55, 2.1);
      radiusEarths = Math.pow(massEarths, 0.27);
      albedo = 0.12;
      pressureAtm = prng.range(0.15, 6.5);
      oceanCoverage = 0.35; // Magma ocean fraction!
      iceCoverage = 0.0;
      cloudCoverage = prng.range(0.25, 0.55);
      terrainRoughness = 0.88;
      tectonics = 0.98;
      volcanism = 0.98;
      atmosphereComposition = [
        { formula: 'SO₂', name: 'Anidride Solforosa', pct: 58.0, color: '#f59e0b' },
        { formula: 'CO₂', name: 'Anidride Carbonica', pct: 32.5, color: '#fb7185' },
        { formula: 'SiO', name: 'Vapore di Silicati', pct: 6.5, color: '#f97316' },
        { formula: 'Na', name: 'Sodio Ionizzato', pct: 3.0, color: '#fde047' }
      ];
      palette = {
        deepOcean: [0.98, 0.32, 0.05], // Molten lava seas
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
      typeLabel = 'Mondo Super-Serra Denso';
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
        { formula: 'CO₂', name: 'Anidride Carbonica Supercritica', pct: 95.8, color: '#f59e0b' },
        { formula: 'N₂', name: 'Azoto', pct: 3.5, color: '#38bdf8' },
        { formula: 'H₂SO₄', name: 'Aerosol Acido Solforico', pct: 0.7, color: '#eab308' }
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
      typeLabel = 'Mondo Desertico & Canyon Tettonici';
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
        { formula: 'CO₂', name: 'Anidride Carbonica', pct: 88.4, color: '#f97316' },
        { formula: 'N₂', name: 'Azoto', pct: 7.2, color: '#38bdf8' },
        { formula: 'Ar', name: 'Argon', pct: 3.1, color: '#94a3b8' },
        { formula: 'O₂', name: 'Ossigeno', pct: 1.3, color: '#34d399' }
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
      typeLabel = 'Gigante Gassoso Gioviano';
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
        { formula: 'H₂', name: 'Idrogeno Molecolare', pct: 87.6, color: '#38bdf8' },
        { formula: 'He', name: 'Elio', pct: 11.8, color: '#fbbf24' },
        { formula: 'CH₄', name: 'Metano', pct: 0.35, color: '#a78bfa' },
        { formula: 'NH₃', name: 'Cristalli di Ammoniaca', pct: 0.25, color: '#f472b6' }
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
      typeLabel = 'Gigante Ghiacciato Nettuniano';
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
        { formula: 'H₂', name: 'Idrogeno Molecolare', pct: 79.5, color: '#38bdf8' },
        { formula: 'He', name: 'Elio', pct: 17.2, color: '#fbbf24' },
        { formula: 'CH₄', name: 'Idrocarburi e Metano', pct: 2.8, color: '#2dd4bf' },
        { formula: 'H₂O/NH₃', name: 'Mantello Fluido Ghiacciato', pct: 0.5, color: '#818cf8' }
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
      typeLabel = 'Mondo Criogenico con Oceano Sub-Glaciale';
      massEarths = prng.range(0.18, 1.4);
      radiusEarths = Math.pow(massEarths, 0.3);
      albedo = prng.range(0.58, 0.74);
      pressureAtm = prng.chance(0.5) ? prng.range(0.05, 1.4) : 0.002;
      oceanCoverage = 0.15; // Fractured ice leads / cryovolcanic plumes
      iceCoverage = 0.92;
      cloudCoverage = Math.min(0.65, pressureAtm * 0.4);
      terrainRoughness = 0.58;
      tectonics = 0.45; // Cryo-tectonics
      volcanism = 0.42; // Cryovolcanism
      atmosphereComposition = [
        { formula: 'N₂', name: 'Azoto Criogenico', pct: 91.5, color: '#38bdf8' },
        { formula: 'CH₄', name: 'Metano Liquido/Gassoso', pct: 6.8, color: '#2dd4bf' },
        { formula: 'CO', name: 'Monossido di Carbonio', pct: 1.7, color: '#94a3b8' }
      ];
      palette = {
        deepOcean: [0.12, 0.28, 0.45],
        shallowOcean: [0.35, 0.58, 0.74],
        lowland: [0.68, 0.78, 0.88],
        highland: [0.54, 0.46, 0.44], // Tholin cracks
        peak: [0.94, 0.97, 1.0],
        atmosphere: [0.45, 0.82, 0.96],
        cloud: [0.88, 0.94, 0.98]
      };
      break;
    }

    default: {
      typeLabel = 'Pianeta Silicatico Craterizzato';
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
        { formula: 'Exosfera', name: 'Tracce di Sodio / Elio da Vento Stellare', pct: 100.0, color: '#94a3b8' }
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

  // Compute physical Equilibrium & Surface Temperatures
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

  // Gravity, escape velocity, magnetic field
  const gravityG = massEarths / Math.max(0.05, radiusEarths * radiusEarths);
  const escapeVelocityKmS = 11.186 * Math.sqrt(massEarths / Math.max(0.05, radiusEarths));
  const densityGcm3 = 5.51 * (massEarths / Math.pow(radiusEarths, 3));
  const magneticFieldGauss = archetype === 'gas_giant'
    ? prng.range(3.5, 14.0)
    : tectonics > 0.4
    ? prng.range(0.35, 1.45)
    : prng.range(0.0, 0.08);

  // Earth Similarity Index (ESI)
  const esiTemp = Math.max(0, 1 - Math.abs(surfaceTempK - 288) / 140);
  const esiRadius = Math.max(0, 1 - Math.abs(radiusEarths - 1.0) / 3.5);
  const esiAtm = archetype === 'gas_giant' || archetype === 'ice_giant' ? 0.05 : Math.max(0, 1 - Math.abs(Math.log10(Math.max(0.01, pressureAtm))) / 2.2);
  const habitabilityScore = isAnchorHomeworld
    ? 0.95
    : Math.max(0.02, Math.min(0.98, esiTemp * 0.5 + esiRadius * 0.25 + esiAtm * 0.25));

  // Keplerian Orbital Elements
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

  // Ring System (common on gas/ice giants, occasional on massive terrestrial worlds)
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
      composition: beyondFrostLine ? 'Ghiaccio d’Acqua Cristallino & Silicati' : 'Polveri Silicatiche e Regolite',
      color: palette.peak
    };
  }

  // Moons
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
        ? 'Luna Vulcanica Mareale (Tipo Io)'
        : beyondFrostLine
        ? 'Luna Ghiacciata con Oceano Interno (Tipo Europa)'
        : 'Satellite Silicatico Craterizzato',
      color: m === 0 && archetype === 'gas_giant' ? [0.95, 0.78, 0.28] : [0.75, 0.78, 0.82]
    });
  }

  const properName = isAnchorHomeworld
    ? (starSystem.index === 1 ? 'Thalassa Prime' : 'Aurelia IV (Gaia-Nova)')
    : `${starSystem.name.split(' ')[1] || starSystem.name} ${roman}`;

  // Generate Biosphere (Scale 6)
  const biosphere = generateBiosphere({
    pSeed,
    archetype,
    habitabilityScore,
    surfaceTempK,
    pressureAtm,
    gravityG,
    star,
    currentAgeGyr,
    forceBiosphere: isAnchorHomeworld || isSecondaryHabitable
  });

  // Generate Civilization (Scale 7)
  const civilization = generateCivilization({
    pSeed,
    properName,
    biosphere,
    habitabilityScore,
    currentAgeGyr,
    forceCivilization: isAnchorHomeworld || (starSystem.hasCivilization && pIndex === 2)
  });

  // Generate Surface Landmarks (Continents, Oceans, Volcanoes, Craters, Biomes, Cities)
  const landmarks = generateSurfaceLandmarks(pSeed, properName, archetype, biosphere, civilization);

  return {
    id: `${starSystem.id}-pl-${pIndex}`,
    index: pIndex,
    seed: pSeed,
    name: properName,
    roman,
    archetype,
    typeLabel,
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
    volcanism,
    magneticFieldGauss,
    habitabilityScore,
    inHabitableZone,
    axialTiltDeg: prng.range(2.5, 34.0),
    rotationPeriodHours: prng.range(9.5, 42.0),
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
      stage: 'Sterile / Chimica Prebiotica Inerte',
      complexityIndex: 0.0,
      biomassGt: 0,
      biochemistry: 'Assente',
      energySource: 'Nessuna',
      speciesCountEstimate: 0,
      clades: [],
      trophicLinks: [],
      adaptations: ['Superficie priva di attività metabolica rilevabile'],
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
    ? 'Biosfera Complessa Multicostituente (Ecosistemi Globali)'
    : complexityIndex > 0.48
    ? 'Rete Trofica Multicorporale & Flora Continentale'
    : 'Ecosistema Chemiosintetico / Microbico Coloniale';

  const biochemistry = isSubsurface
    ? 'Carbonio-Acqua Subglaciale (Idrotermale)'
    : surfaceTempK < 210
    ? 'Idrocarburi / Ammoniaca-Acqua Criogenica'
    : 'Carbonio-Acqua Chirale con Biopolimeri Complessi';

  const energySource = isSubsurface
    ? 'Chemiosintesi da Camini Idrotermali Mareali'
    : star.tempK < 4100
    ? 'Fotosintesi nell’Infrarosso Vicino (Pigmenti Nero-Porpora)'
    : star.tempK > 6600
    ? 'Fotosintesi UV-Protettiva ad Alta Riflettanza (Pigmenti Oro-Ciano)'
    : 'Fotosintesi Ossigenica Multi-Banda (Clorofilla & Ficobiline)';

  // Foliar pigment color on planet surface depending on star's Planck peak wavelength!
  const foliageRGB = star.tempK < 4200
    ? [0.42, 0.14, 0.32] // Deep crimson-violet for M-dwarf infrared capture
    : star.tempK > 6600
    ? [0.16, 0.56, 0.52] // Teal-amber UV protective
    : [0.16, 0.46, 0.24]; // Classic emerald green

  // Generate 5 Ecological Trophic Clades
  const roles = [
    { role: 'Produttore Primario', trophicLevel: 1, icon: 'flora', baseBiomass: 0.62 },
    { role: 'Simbionte Coloniale / Corallino', trophicLevel: 1.5, icon: 'colonial', baseBiomass: 0.21 },
    { role: 'Erbivoro / Filtratore Primario', trophicLevel: 2, icon: 'herbivore', baseBiomass: 0.11 },
    { role: 'Predatore Apicale', trophicLevel: 3, icon: 'predator', baseBiomass: 0.025 },
    { role: 'Decompositore & Riciclatore Biogeochimico', trophicLevel: 1.8, icon: 'decomposer', baseBiomass: 0.035 }
  ];

  const clades = roles.map((r, idx) => {
    const cPrng = new PRNG(hashHierarchy(pSeed, 'CLADE', idx));
    const genus = `${cPrng.pick(CLADE_PREFIXES)}${cPrng.pick(CLADE_ROOTS)}`;
    const species = cPrng.pick(CLADE_SPECIES);

    const symmetry = idx === 0
      ? cPrng.pick(['Frattale Radiale', 'Elicoidale Fotonica', 'Reticolare Pneumatica'])
      : cPrng.pick(['Bilaterale Esapode', 'Radiale Pentamerica', 'Cefalopode Idrodinamico', 'Articolata Corazzata']);

    const locomotion = idx === 0
      ? 'Sessile Radicata con Fototropismo Attivo'
      : idx === 1
      ? 'Fluttuazione Aero-Planctonica / Barriera'
      : gravityG > 1.35
      ? 'Locomozione Multi-Arto Bassa ad Alta Stabilità'
      : 'Propulsione Biomeccanica / Planata Atmosferica';

    const sensoryMode = cPrng.pick([
      'Visione Multispettrale (UV + Infrarosso Termico)',
      'Ecolocalizzazione Acustica a Fase Variabile',
      'Elettrorecezione Magnetosferica',
      'Chemiorecezione Fotonica Bioluminescente'
    ]);

    const traits = [];
    if (gravityG > 1.3) traits.push(`Endoscheletro rinforzato in composito carbonio-silicio (${gravityG.toFixed(2)} g)`);
    else if (gravityG < 0.8) traits.push(`Morfologia slanciata a bassa gravità (${gravityG.toFixed(2)} g)`);
    else traits.push('Omeostasi termica ed endoscheletro articolato');

    if (star.tempK < 4400) traits.push('Membrane cellulari schermate contro super-flare stellari XUV');
    if (pressureAtm > 1.8) traits.push('Apparato respiratorio a scambio controcorrente ad alta densità');
    traits.push(`Bioluminescenza adattiva (${sensoryMode.split(' ')[0]})`);

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
    { from: 0, to: 2, efficiency: 0.14, label: 'Flusso Fotosintetico' },
    { from: 1, to: 2, efficiency: 0.12, label: 'Simbiosi Nutritiva' },
    { from: 2, to: 3, efficiency: 0.11, label: 'Predazione Selettiva' },
    { from: 3, to: 4, efficiency: 0.22, label: 'Ciclo Detritivoro' },
    { from: 4, to: 0, efficiency: 0.85, label: 'Mineralizzazione Azoto/Fosforo' }
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
      `Pigmentazione fotosintetica calibrata sullo spettro ${star.spectralClass} (${Math.round(star.tempK)} K)`,
      `Adattamento biomeccanico a gravità superficiale di ${gravityG.toFixed(2)} g`,
      `Ciclo metabolico sincronizzato con periodo di rotazione di ${(12 + (pSeed % 20)).toFixed(1)} ore`
    ],
    extinctionEvents: Math.floor(bioAgeGyr * 1.1)
  };
}

/**
 * 7. INTELLIGENT CIVILIZATION & HISTORICAL CHRONICLE GENERATOR
 */
const CIV_ETHOS = [
  {
    name: 'Tecnocrazia Orbitale Armonica',
    governance: 'Consiglio Scientifico Planetario & Rete Quantistica',
    philosophy: 'Equilibrio tra espansione astrofisica e preservazione della biosfera nativa'
  },
  {
    name: 'Simbiosi Ecosferica Collettiva',
    governance: 'Sinapsi Bio-Digitale Distribuita',
    philosophy: 'Integrazione genetica e tecnologica con le reti trofiche planetarie'
  },
  {
    name: 'Coalizione Mercantile Interplanetaria',
    governance: 'Federazione di Città-Stato Orbitali e Ascensori Spaziali',
    philosophy: 'Estrazione mineraria asteroidea, commercio energetico e colonizzazione'
  },
  {
    name: 'Ordine Archivistico Post-Biologico',
    governance: 'Matrice Computazionale Autonoma',
    philosophy: 'Osservazione cosmologica a lungo termine e simulazione di sottouniversi'
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
      status: 'Nessuna Civiltà Tecnologica Presente',
      kardashev: 0.0,
      history: generateNaturalChronicle(properName, currentAgeGyr, biosphere)
    };
  }

  const kardashev = forceCivilization
    ? prng.range(1.08, 1.48)
    : prng.range(0.72, 1.65);

  const ethos = prng.pick(CIV_ETHOS);
  const speciesName = `Sapiens ${generateAstronomicalName(prng)}`;
  const civAgeKy = Math.round(prng.range(14, 420)); // thousand years
  const populationBillions = Number((prng.range(4.2, 28.5) * kardashev).toFixed(2));
  const energyPowerTW = Math.round(Math.pow(10, (kardashev - 0.7) * 4.2) * 18);

  const cooperationIndex = prng.range(0.62, 0.96);
  const conflictRisk = Math.max(0.03, 1.0 - cooperationIndex - prng.range(0, 0.15));
  const sustainabilityIndex = prng.range(0.68, 0.95);

  const megastructures = [];
  if (kardashev >= 0.85) {
    megastructures.push({
      id: 'mega-ring',
      name: 'Anello Orbitale Equatoriale & Ascensori Spaziali',
      type: 'orbital_ring',
      completion: Math.min(1.0, (kardashev - 0.65) * 1.4),
      description: 'Infrastruttura di lancio non-propulsivo ed energia solare geostazionaria'
    });
  }
  if (kardashev >= 1.05) {
    megastructures.push({
      id: 'mega-dyson',
      name: 'Nodi Collettori dello Sciame di Dyson',
      type: 'dyson_swarm',
      completion: Math.min(1.0, (kardashev - 0.9) * 0.95),
      description: 'Specchi e collettori fotovoltaici in orbita eliocentrica ravvicinata'
    });
  }
  if (kardashev >= 0.95) {
    megastructures.push({
      id: 'mega-shield',
      name: 'Griglia di Regolazione Climatica & Magnetosferica',
      type: 'climate_array',
      completion: 0.92,
      description: 'Stabilizzazione dell’albedo planetario e schermatura dalle tempeste solari'
    });
  }

  const techDomains = [
    { name: 'Produzione Energetica', level: kardashev > 1.2 ? 'Fusione He³ & Collettori Stellari' : 'Fusione Confinamento Magnetico & Solare Orbitale', progress: Math.min(100, Math.round(kardashev * 62)) },
    { name: 'Propulsione Spaziale', level: kardashev > 1.3 ? 'Vele Laser Relativistiche & Antimateria Catalizzata' : 'Torce a Fusione Impulsiva & Magneto-Plasma', progress: Math.min(100, Math.round(kardashev * 58)) },
    { name: 'Biotecnologia & Ecologia', level: 'Ingegneria Genomica Adattiva & Ripristino Biosferico', progress: Math.min(100, Math.round(sustainabilityIndex * 94)) },
    { name: 'Computazione & IA', level: 'Reti Quantistiche Planetarie & Sintesi Cognitiva', progress: Math.min(100, Math.round(kardashev * 65)) }
  ];

  const history = [
    ...generateNaturalChronicle(properName, currentAgeGyr, biosphere),
    {
      epoch: `T - ${civAgeKy} kyr`,
      category: 'evolution',
      title: `Emergenza cognitiva di ${speciesName}`,
      detail: 'Sviluppo del linguaggio simbolico, trasmissione culturale cumulativa e primi insediamenti.'
    },
    {
      epoch: `T - ${Math.round(civAgeKy * 0.25)} kyr`,
      category: 'civ',
      title: 'Rivoluzione Termodinamica & Unificazione Planetaria',
      detail: `Superamento della crisi ecologica pre-Kardashev I; adozione del modello ${ethos.name}.`
    },
    {
      epoch: `T - ${Math.round(civAgeKy * 0.08)} kyr`,
      category: 'tech',
      title: 'Inaugurazione dell’Infrastruttura Orbitale',
      detail: 'Costruzione dei primi ascensori spaziali equatoriali e colonizzazione delle lune.'
    },
    {
      epoch: 'Epoca Attuale',
      category: 'civ',
      title: `Civiltà di Tipo Kardashev ${kardashev.toFixed(2)}`,
      detail: `Popolazione di ${populationBillions} miliardi; potenza installata ${energyPowerTW} TW; indice cooperazione ${Math.round(cooperationIndex * 100)}%.`
    }
  ];

  return {
    active: true,
    status: 'Civiltà Interplanetaria Attiva',
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
      title: `Accrescimento protoplanetario di ${properName}`,
      detail: 'Condensazione dei silicati e differenziazione gravitazionale del nucleo ferro-nichel.'
    },
    {
      epoch: `T - ${(currentAgeGyr * 0.85).toFixed(2)} Gyr`,
      category: 'geo',
      title: 'Stabilizzazione crostale e degassamento atmosferico',
      detail: 'Raffreddamento del mantello, formazione dell’atmosfera secondaria e condensazione dei volatili.'
    }
  ];

  if (biosphere && biosphere.active) {
    chronicle.push({
      epoch: `T - ${biosphere.bioAgeGyr.toFixed(2)} Gyr`,
      category: 'bio',
      title: 'Abiogenesi e comparsa dei primi replicatori',
      detail: `Transizione dalla chimica prebiotica a membrane autoreplicanti (${biosphere.biochemistry}).`
    });
    if (biosphere.complexityIndex > 0.5) {
      chronicle.push({
        epoch: `T - ${(biosphere.bioAgeGyr * 0.45).toFixed(2)} Gyr`,
        category: 'bio',
        title: 'Grande Ossidazione & Radiazione Multicorporale',
        detail: `Espansione dei produttori primari (${biosphere.energySource}) e diversificazione trofica.`
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
        { type: 'Anticiclone Persistente', icon: 'storm' },
        { type: 'Corrente a Getto Equatoriale', icon: 'wind' },
        { type: 'Vortice Polare Esagonale', icon: 'vortex' }
      ]
    : [
        { type: 'Continente / Altopiano Cratonico', icon: 'continent' },
        { type: 'Bacino Oceanico / Mare', icon: 'ocean' },
        { type: 'Vulcano a Scudo / Caldera', icon: 'volcano' },
        { type: 'Rift Valley / Canyon Tettonico', icon: 'canyon' },
        { type: 'Cratere da Impatto Multi-Anello', icon: 'crater' }
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
      name: `Riserva Biosferica di ${generateAstronomicalName(prng)}`,
      category: 'Hotspot di Biodiversità & Foresta Primaria',
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
      name: `Metropoli & Terminale Orbitale ${generateAstronomicalName(prng)}`,
      category: 'Capitale Planetaria & Ancoraggio Ascensore Spaziale',
      icon: 'city',
      lat: prng.range(-18, 18),
      lon: prng.range(-90, 90),
      elevationKm: 0.25,
      tempOffsetK: 1.5
    });
  }

  return landmarks;
}
