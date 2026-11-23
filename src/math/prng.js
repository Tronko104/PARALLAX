/**
 * PARALLAX — Mathematical, Deterministic PRNG, 3D Fractal Noise & Astrophysical Solver
 * Guarantees 100% deterministic, reproducible, and persistent generation across 26 orders of magnitude.
 */

export const CONSTANTS = {
  G: 6.67430e-11,
  C: 299792458,
  AU_IN_METERS: 1.495978707e11,
  LY_IN_METERS: 9.4607304725808e15,
  PC_IN_METERS: 3.0856775814913673e16,
  KPC_IN_METERS: 3.0856775814913673e19,
  MPC_IN_METERS: 3.0856775814913673e22,
  SOLAR_MASS_KG: 1.98847e30,
  SOLAR_RADIUS_KM: 695700,
  SOLAR_TEMP_K: 5778,
  EARTH_MASS_KG: 5.9722e24,
  EARTH_RADIUS_KM: 6371,
  HUBBLE_H0: 67.4 // km/s/Mpc (Planck 2018)
};

/**
 * Convert an arbitrary string or number seed into a deterministic 32-bit unsigned integer
 */
export function stringToSeed(str) {
  const s = String(str ?? 'PARALLAX-PRIME-2026');
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Hierarchical coordinate hash combining arbitrary integer/string tokens into a 32-bit seed
 */
export function hashHierarchy(...tokens) {
  let h = 0x811c9dc5 >>> 0;
  for (let t = 0; t < tokens.length; t++) {
    const val = tokens[t];
    if (typeof val === 'number') {
      let n = Math.floor(val) | 0;
      h ^= n & 0xff;
      h = Math.imul(h, 0x01000193);
      h ^= (n >>> 8) & 0xff;
      h = Math.imul(h, 0x01000193);
      h ^= (n >>> 16) & 0xff;
      h = Math.imul(h, 0x01000193);
      h ^= (n >>> 24) & 0xff;
      h = Math.imul(h, 0x01000193);
    } else {
      const s = String(val);
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
      }
    }
  }
  // Final avalanche mix
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * Fast, high-quality deterministic PRNG instance (Mulberry32 / SplitMix32 hybrid)
 */
export class PRNG {
  constructor(seed) {
    this.state = typeof seed === 'number' ? (seed >>> 0) : stringToSeed(seed);
    if (this.state === 0) this.state = 0x6d2b79f5;
  }

  next() {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min, max) {
    return min + this.next() * (max - min);
  }

  int(min, maxInclusive) {
    return Math.floor(this.range(min, maxInclusive + 0.999999));
  }

  chance(probability) {
    return this.next() < probability;
  }

  pick(array) {
    if (!array || array.length === 0) return null;
    return array[Math.floor(this.next() * array.length)];
  }

  weightedPick(items) {
    let total = 0;
    for (const item of items) total += item.weight;
    let r = this.next() * total;
    for (const item of items) {
      r -= item.weight;
      if (r <= 0) return item.value;
    }
    return items[items.length - 1].value;
  }

  /**
   * Box-Muller Gaussian distribution
   */
  gaussian(mean = 0, stdDev = 1) {
    const u1 = Math.max(1e-7, this.next());
    const u2 = this.next();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return z0 * stdDev + mean;
  }

  /**
   * Power-law distribution (e.g. Salpeter / Kroupa Initial Mass Function)
   */
  powerLaw(min, max, alpha) {
    const u = this.next();
    if (Math.abs(alpha + 1) < 1e-5) {
      return min * Math.pow(max / min, u);
    }
    const a1 = alpha + 1;
    const minP = Math.pow(min, a1);
    const maxP = Math.pow(max, a1);
    return Math.pow(minP + u * (maxP - minP), 1 / a1);
  }
}

/**
 * 3D Value Noise & FBM matching the GPU GLSL shader math
 */
function fract(x) {
  return x - Math.floor(x);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function hash3(x, y, z) {
  const dot = x * 127.1 + y * 311.7 + z * 74.7;
  return fract(Math.sin(dot) * 43758.5453123);
}

export function noise3D(x, y, z) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;

  const ux = fx * fx * (3.0 - 2.0 * fx);
  const uy = fy * fy * (3.0 - 2.0 * fy);
  const uz = fz * fz * (3.0 - 2.0 * fz);

  const n000 = hash3(ix, iy, iz);
  const n100 = hash3(ix + 1, iy, iz);
  const n010 = hash3(ix, iy + 1, iz);
  const n110 = hash3(ix + 1, iy + 1, iz);
  const n001 = hash3(ix, iy, iz + 1);
  const n101 = hash3(ix + 1, iy, iz + 1);
  const n011 = hash3(ix, iy + 1, iz + 1);
  const n111 = hash3(ix + 1, iy + 1, iz + 1);

  const nx00 = lerp(n000, n100, ux);
  const nx10 = lerp(n010, n110, ux);
  const nx01 = lerp(n001, n101, ux);
  const nx11 = lerp(n011, n111, ux);

  const nxy0 = lerp(nx00, nx10, uy);
  const nxy1 = lerp(nx01, nx11, uy);

  return lerp(nxy0, nxy1, uz);
}

export function fbm3D(x, y, z, octaves = 5, lacunarity = 2.03, gain = 0.5) {
  let value = 0.0;
  let amplitude = 0.5;
  let px = x;
  let py = y;
  let pz = z;

  for (let i = 0; i < octaves; i++) {
    value += amplitude * noise3D(px, py, pz);
    px *= lacunarity;
    py *= lacunarity;
    pz *= lacunarity;
    amplitude *= gain;
  }
  return value;
}

export function ridge3D(x, y, z, octaves = 4) {
  let value = 0.0;
  let amplitude = 0.5;
  let weight = 1.0;
  let px = x;
  let py = y;
  let pz = z;

  for (let i = 0; i < octaves; i++) {
    let v = 1.0 - Math.abs(noise3D(px, py, pz) * 2.0 - 1.0);
    v = v * v * weight;
    weight = Math.max(0.0, Math.min(1.0, v * 2.0));
    value += v * amplitude;
    px *= 2.11;
    py *= 2.11;
    pz *= 2.11;
    amplitude *= 0.5;
  }
  return value;
}

/**
 * Planck Blackbody Radiation approximation (T in Kelvin -> sRGB [r, g, b] in 0..1)
 * Accurate across 1,000 K (L/T dwarfs) to 45,000 K (O-class blue hypergiants)
 */
export function planckBlackbodyRGB(kelvin) {
  const temp = Math.max(1000, Math.min(45000, kelvin)) / 100.0;
  let r, g, b;

  if (temp <= 66.0) {
    r = 255.0;
    g = 99.4708025861 * Math.log(temp) - 161.1195681661;
    if (temp <= 19.0) {
      b = 0.0;
    } else {
      b = 138.5177312231 * Math.log(temp - 10.0) - 305.0447927307;
    }
  } else {
    r = 329.698727446 * Math.pow(temp - 60.0, -0.1332047592);
    g = 288.1221695283 * Math.pow(temp - 60.0, -0.0755148492);
    b = 255.0;
  }

  return [
    Math.max(0, Math.min(255, r)) / 255,
    Math.max(0, Math.min(255, g)) / 255,
    Math.max(0, Math.min(255, b)) / 255
  ];
}

export function rgbToHex([r, g, b]) {
  const toHex = (c) => Math.round(Math.max(0, Math.min(1, c)) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Keplerian 3D Orbit Solver via Newton-Raphson
 * Given orbital elements:
 *   a: semi-major axis (AU)
 *   e: eccentricity (0 <= e < 1)
 *   i: inclination (radians)
 *   omega: longitude of ascending node Ω (radians)
 *   w: argument of periapsis ω (radians)
 *   M0: mean anomaly at epoch (radians)
 *   periodYears: orbital period (Julian years)
 *   timeYears: current simulation time (Julian years)
 */
export function solveKeplerOrbit(elements, timeYears) {
  const { a, e, i, omega, w, M0, periodYears } = elements;
  const n = (2.0 * Math.PI) / Math.max(1e-6, periodYears);
  let M = (M0 + n * timeYears) % (2.0 * Math.PI);
  if (M < 0) M += 2.0 * Math.PI;

  // Newton-Raphson for M = E - e * sin(E)
  let E = e < 0.8 ? M : Math.PI;
  for (let iter = 0; iter < 7; iter++) {
    const f = E - e * Math.sin(E) - M;
    const fPrime = 1.0 - e * Math.cos(E);
    E = E - f / Math.max(1e-7, fPrime);
  }

  const cosE = Math.cos(E);
  const sinE = Math.sin(E);
  const sqrtOneMinusESq = Math.sqrt(Math.max(0.0001, 1.0 - e * e));

  // Position in orbital plane
  const xOrb = a * (cosE - e);
  const yOrb = a * sqrtOneMinusESq * sinE;
  const r = Math.hypot(xOrb, yOrb);
  const trueAnomaly = Math.atan2(yOrb, xOrb);

  // Rotate to 3D heliocentric ecliptic coordinates
  const cosO = Math.cos(omega);
  const sinO = Math.sin(omega);
  const cosW = Math.cos(w);
  const sinW = Math.sin(w);
  const cosI = Math.cos(i);
  const sinI = Math.sin(i);

  const px = cosO * cosW - sinO * sinW * cosI;
  const py = sinO * cosW + cosO * sinW * cosI;
  const pz = sinW * sinI;

  const qx = -cosO * sinW - sinO * cosW * cosI;
  const qy = -sinO * sinW + cosO * cosW * cosI;
  const qz = cosW * sinI;

  const x = px * xOrb + qx * yOrb;
  const y = pz * xOrb + qz * yOrb; // Y is vertical axis in 3D view
  const z = py * xOrb + qy * yOrb;

  // Instantaneous orbital velocity in km/s (vis-viva equation)
  const velocityKmS = 29.78 * Math.sqrt(Math.max(0.01, 2.0 / Math.max(0.001, r) - 1.0 / Math.max(0.001, a)));

  return {
    x,
    y,
    z,
    r,
    trueAnomaly,
    eccentricAnomaly: E,
    meanAnomaly: M,
    velocityKmS
  };
}

/**
 * Format spatial scale value from log10(meters) into scientific human-readable units
 */
export function formatLogScale(logMeters) {
  const meters = Math.pow(10, logMeters);
  if (logMeters >= 24.49) {
    return `${(meters / (CONSTANTS.MPC_IN_METERS * 1000)).toFixed(2)} Gpc`;
  }
  if (logMeters >= 21.8) {
    return `${(meters / CONSTANTS.MPC_IN_METERS).toFixed(2)} Mpc`;
  }
  if (logMeters >= 18.8) {
    return `${(meters / CONSTANTS.KPC_IN_METERS).toFixed(2)} kpc`;
  }
  if (logMeters >= 15.8) {
    return `${(meters / CONSTANTS.PC_IN_METERS).toFixed(2)} pc`;
  }
  if (logMeters >= 14.5) {
    return `${(meters / CONSTANTS.LY_IN_METERS).toFixed(2)} ly`;
  }
  if (logMeters >= 10.2) {
    return `${(meters / CONSTANTS.AU_IN_METERS).toFixed(2)} AU`;
  }
  if (logMeters >= 6.0) {
    return `${(meters / 1e6).toFixed(1)} Mm`;
  }
  if (logMeters >= 3.0) {
    return `${(meters / 1e3).toFixed(2)} km`;
  }
  return `${meters.toFixed(1)} m`;
}

/**
 * Procedural Greek / Astronomical / IAU Catalog Nomenclature Generator
 */
const GREEK_LETTERS = [
  'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta',
  'Iota', 'Kappa', 'Lambda', 'Mu', 'Nu', 'Xi', 'Omicron', 'Pi', 'Rho',
  'Sigma', 'Tau', 'Upsilon', 'Phi', 'Chi', 'Psi', 'Omega'
];

const SYLLABLES_START = [
  'Aeth', 'Vela', 'Cygn', 'Lyra', 'Orph', 'Cael', 'Astr', 'Nyx', 'Kron',
  'Heli', 'Sol', 'Vega', 'Alt', 'Alde', ' Cent', 'Prox', 'Sir', 'Polar',
  'Andr', 'Cass', 'Per', 'Erid', 'Hydr', 'Drac', 'Aql', 'Taur', 'Scor',
  'Ophi', 'Sagit', 'Capr', 'Pisc', 'Arie', 'Virg', 'Libr', 'Crux', 'Carin',
  'Forn', 'Sculp', 'Phoe', 'Dor', 'Мен', 'Oct', 'Pav', 'Tuc', 'Grus',
  'Zeph', 'Bor', 'Not', 'Eur', 'Thal', 'Pelag', 'Chry', 'Argy', 'Pyrr'
];

const SYLLABLES_MID = [
  'el', 'ar', 'on', 'is', 'or', 'an', 'en', 'ir', 'ul', 'os',
  'ia', 'ea', 'io', 'ua', 'ae', 'yr', 'yn', 'ax', 'ex', 'ox'
];

const SYLLABLES_END = [
  'is', 'os', 'on', 'us', 'a', 'ia', 'ea', 'um', 'ar', 'or',
  'ix', 'ax', 'is Prime', 'is Major', 'is Minor', 'ara', 'ora', 'ion'
];

export function generateAstronomicalName(prng, prefix = '') {
  const start = prng.pick(SYLLABLES_START).trim();
  const mid = prng.chance(0.65) ? prng.pick(SYLLABLES_MID) : '';
  const end = prng.pick(SYLLABLES_END);
  const base = `${start}${mid}${end}`;
  if (prefix) return `${prefix} ${base}`;
  return base;
}

export function generateStarDesignation(prng, galaxyCode, index) {
  const greek = GREEK_LETTERS[index % GREEK_LETTERS.length];
  const stem = generateAstronomicalName(prng);
  const catalogNum = prng.int(100, 9999);
  return {
    properName: `${greek} ${stem}`,
    catalogId: `${galaxyCode}-HD ${catalogNum}`
  };
}
