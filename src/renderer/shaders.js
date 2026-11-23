/**
 * PARALLAX — Custom WebGL2 GLSL Shaders
 * Implements multi-scale volumetric raymarching across 26 orders of magnitude:
 * - Cosmic Web dark-matter filaments & supercluster nodes
 * - Galactic logarithmic spiral / barred / elliptical volumetric radiative transfer
 * - Stellar photosphere convection, coronal loops, planetary nebulae & black hole gravitational lensing
 * - Planetary globe 3D FBM terrain, bathymetry, specular oceans, city lights, clouds, rings & Rayleigh atmosphere
 * - Planetary surface 3D terrain raymarching, ocean waves, atmospheric sky scattering & celestial horizon
 */

export const VERTEX_SHADER_SOURCE = `#version 300 es
precision highp float;

layout(location = 0) in vec2 a_position;
out vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const FRAGMENT_SHADER_SOURCE = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_logScale;       // Continuous scale: 25.5 (Cosmos) -> 0.0 (Surface/Bio)
uniform vec2 u_cameraAngles;    // x: yaw, y: pitch
uniform float u_cameraZoom;
uniform float u_seed;

// Star uniforms
uniform vec3 u_starColor;
uniform float u_starTempK;
uniform float u_starRadiusNorm;
uniform int u_remnantType;      // 0: normal star, 1: white dwarf, 2: neutron star/pulsar, 3: black hole
uniform float u_hasNebulaHalo;
uniform float u_isBinary;
uniform vec3 u_companionColor;

// Galaxy uniforms
uniform int u_galaxyFamily;     // 0: spiral, 1: barred, 2: elliptical, 3: irregular
uniform float u_galaxyArms;
uniform float u_galaxyTwist;
uniform float u_galaxyBar;
uniform vec3 u_nebulaColor;

// Planet uniforms
uniform int u_planetArchetype;  // 0: temperate, 1: ocean, 2: lava, 3: venus, 4: desert, 5: gas_giant, 6: ice_giant, 7: cryo, 8: barren
uniform vec3 u_colDeepOcean;
uniform vec3 u_colShallowOcean;
uniform vec3 u_colLowland;
uniform vec3 u_colHighland;
uniform vec3 u_colPeak;
uniform vec3 u_colAtmo;
uniform vec3 u_colFoliage;
uniform float u_oceanCoverage;
uniform float u_iceCoverage;
uniform float u_cloudCoverage;
uniform float u_terrainRoughness;
uniform float u_volcanism;
uniform float u_pressureAtm;
uniform float u_bioComplexity;
uniform float u_cityLights;
uniform float u_hasRings;
uniform float u_ringInner;
uniform float u_ringOuter;
uniform float u_planetSeed;

// Transient phenomena uniforms
uniform float u_superflare;
uniform float u_impactFlash;
uniform float u_evoPulse;

#define PI 3.14159265359

// --- Fast GPU Hash & 3D Value Noise ---
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}

float noise3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);

  return mix(
    mix(
      mix(hash13(i + vec3(0, 0, 0)), hash13(i + vec3(1, 0, 0)), f.x),
      mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), f.x),
      f.y
    ),
    mix(
      mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), f.x),
      mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), f.x),
      f.y
    ),
    f.z
  );
}

const mat3 m3 = mat3(
   0.00,  0.80,  0.60,
  -0.80,  0.36, -0.48,
  -0.60, -0.48,  0.64
);

float fbm(vec3 p, int octaves) {
  float f = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    f += amp * noise3(p);
    p = m3 * p * 2.04;
    amp *= 0.5;
  }
  return f;
}

float ridgeFbm(vec3 p, int octaves) {
  float f = 0.0;
  float amp = 0.5;
  float weight = 1.0;
  for (int i = 0; i < 5; i++) {
    if (i >= octaves) break;
    float v = 1.0 - abs(noise3(p) * 2.0 - 1.0);
    v = v * v * weight;
    weight = clamp(v * 2.0, 0.0, 1.0);
    f += v * amp;
    p = m3 * p * 2.12;
    amp *= 0.5;
  }
  return f;
}

// --- Camera Ray Construction ---
mat3 getCameraMatrix(float yaw, float pitch) {
  float cy = cos(yaw), sy = sin(yaw);
  float cp = cos(pitch), sp = sin(pitch);
  vec3 forward = vec3(sy * cp, sp, cy * cp);
  vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(right, forward);
  return mat3(right, up, -forward);
}

// --- Deep Space Starfield & Background Galactic Dust ---
vec3 renderDeepStarfield(vec3 rd) {
  vec3 col = vec3(0.012, 0.016, 0.026);

  // Subtle background galactic band
  float band = pow(max(0.0, 1.0 - abs(rd.y * 1.6 + rd.x * 0.35)), 3.0);
  float dust = fbm(rd * 3.5 + vec3(u_seed * 0.01), 4);
  col += vec3(0.035, 0.055, 0.095) * band * smoothstep(0.25, 0.85, dust);
  col += u_nebulaColor * 0.025 * band * pow(dust, 2.5);

  // Multi-layer procedural starfield with Planck blackbody colors
  for (int layer = 0; layer < 2; layer++) {
    float scale = layer == 0 ? 110.0 : 240.0;
    vec3 p = rd * scale;
    vec3 id = floor(p);
    vec3 local = fract(p) - 0.5;
    float h = hash13(id + float(layer) * 77.7);
    if (h > 0.962) {
      vec3 offset = (vec3(hash13(id + 1.0), hash13(id + 2.0), hash13(id + 3.0)) - 0.5) * 0.65;
      float d = length(local - offset);
      float brightness = smoothstep(0.962, 1.0, h);
      float starGlow = exp(-d * (layer == 0 ? 18.0 : 28.0)) * brightness;
      vec3 sCol = mix(vec3(1.0, 0.72, 0.48), vec3(0.62, 0.82, 1.0), hash13(id + 9.0));
      col += sCol * starGlow * (layer == 0 ? 1.3 : 0.75);
    }
  }
  return col;
}

// --- SCALE 1: COSMIC WEB VOLUMETRIC FILAMENTS ---
vec4 renderCosmicWeb(vec3 ro, vec3 rd) {
  vec3 accum = vec3(0.0);
  float alpha = 0.0;
  float t = 0.8;
  vec3 seedOff = vec3(mod(u_seed, 97.0) * 0.13);

  for (int i = 0; i < 34; i++) {
    vec3 p = ro + rd * t;
    float r = length(p);
    if (r < 4.5) {
      float fil = ridgeFbm(p * 0.85 + seedOff, 4);
      float node = smoothstep(0.56, 0.95, fil);
      float radialFalloff = smoothstep(4.2, 0.6, r);
      float density = pow(max(0.0, fil - 0.34), 2.2) * radialFalloff;

      vec3 filColor = mix(vec3(0.18, 0.42, 0.88), vec3(0.96, 0.72, 0.36), node);
      filColor = mix(filColor, vec3(0.55, 0.32, 0.85), smoothstep(1.5, 3.8, r) * 0.4);

      // Central Laniakea-Prime attractor core boost
      float coreGlow = exp(-r * 1.45) * 0.12;
      accum += (filColor * density * 0.22 + vec3(1.0, 0.78, 0.45) * coreGlow * 0.14) * (1.0 - alpha);
      alpha = min(0.96, alpha + density * 0.045);
    }
    t += 0.16;
  }
  return vec4(accum, clamp(alpha, 0.0, 1.0));
}

// --- SCALE 2: VOLUMETRIC GALAXY SHADER ---
vec4 renderGalaxy(vec3 ro, vec3 rd) {
  vec3 accum = vec3(0.0);
  float alpha = 0.0;

  // Intersect bounding sphere of radius 2.6
  float b = dot(ro, rd);
  float c = dot(ro, ro) - 6.76;
  float disc = b * b - c;
  if (disc < 0.0) return vec4(0.0);

  float tMin = max(0.05, -b - sqrt(disc));
  float tMax = -b + sqrt(disc);
  if (tMax <= tMin) return vec4(0.0);

  int steps = 40;
  float dt = (tMax - tMin) / float(steps);
  float t = tMin;
  float rotTime = u_time * 0.035;

  for (int i = 0; i < 40; i++) {
    vec3 p = ro + rd * t;
    float r = length(p.xz);
    float y = p.y;

    if (u_galaxyFamily == 2) {
      // Giant Elliptical Galaxy
      float ellipR = length(vec3(p.x, p.y * 1.65, p.z));
      float bulge = exp(-ellipR * 2.4) * 1.4;
      vec3 gCol = mix(vec3(1.0, 0.74, 0.42), vec3(1.0, 0.92, 0.78), exp(-ellipR * 4.0));
      accum += gCol * bulge * dt * 0.85;
      alpha = min(0.98, alpha + bulge * dt * 0.4);
    } else {
      // Spiral / Barred / Irregular Disk Galaxy
      float diskThickness = 0.11 + 0.18 * exp(-r * 1.6);
      float verticalProfile = exp(-abs(y) / diskThickness);

      if (verticalProfile > 0.01 && r < 2.4) {
        float theta = atan(p.z, p.x) - rotTime;
        float logR = log(max(0.06, r));
        float armPhase = theta * max(1.0, u_galaxyArms) + logR * u_galaxyTwist;
        float spiralPattern = cos(armPhase) * 0.5 + 0.5;
        spiralPattern = pow(spiralPattern, 1.85);

        // Galactic bar if barred spiral
        float barAngle = theta;
        float barFactor = u_galaxyBar * exp(-r * 1.8) * pow(abs(cos(barAngle)), 3.0);

        float noiseVal = fbm(vec3(p.xz * 2.4, y * 4.0) + vec3(rotTime), 4);
        float dustLane = smoothstep(0.42, 0.72, fbm(vec3(p.xz * 3.8, y * 8.0), 3));

        float radialDisk = exp(-r * 1.25) * smoothstep(2.35, 0.8, r);
        float armDensity = (0.18 + 0.82 * spiralPattern + barFactor) * radialDisk * verticalProfile;
        armDensity *= (0.55 + 0.75 * noiseVal);

        // Core bulge + SMBH relativistic glow
        float bulge = exp(-length(vec3(p.x, p.y * 2.4, p.z)) * 3.8) * 2.2;

        // HII star-forming nebulae along spiral arms
        float hiiMask = pow(spiralPattern * noiseVal, 2.4) * smoothstep(0.25, 0.7, r) * smoothstep(2.0, 0.8, r);

        vec3 armCol = mix(vec3(0.48, 0.68, 1.0), vec3(0.95, 0.88, 0.76), exp(-r * 1.2));
        armCol = mix(armCol, u_nebulaColor * 1.6, hiiMask * 1.35);
        // Dust lane extinction
        armCol *= (1.0 - 0.58 * dustLane * smoothstep(0.08, 0.0, abs(y)));

        vec3 coreCol = vec3(1.0, 0.84, 0.56) * bulge;
        vec3 sampleLight = (armCol * armDensity * 1.45 + coreCol);

        accum += sampleLight * dt * (1.0 - alpha * 0.45);
        alpha = min(0.98, alpha + (armDensity + bulge) * dt * 0.42);
      }
    }
    t += dt;
  }

  return vec4(accum, clamp(alpha, 0.0, 1.0));
}

// --- SCALE 3 & 4: VOLUMETRIC STAR, CORONA, NEBULA & BLACK HOLE SHADER ---
vec4 renderStar(vec3 ro, vec3 rd, float scaleFactor) {
  vec3 col = vec3(0.0);
  float alpha = 0.0;

  float starR = 0.62 * scaleFactor;
  // Closest point on ray to origin
  float b = dot(ro, rd);
  float c = dot(ro, ro);
  float closestDistSq = max(0.0, c - b * b);
  float closestDist = sqrt(closestDistSq);

  // Expanding Planetary Nebula / Supernova Remnant shell if active
  if (u_hasNebulaHalo > 0.5) {
    float shellR = starR * 2.45;
    float shellDist = abs(closestDist - shellR);
    float nNoise = fbm(normalize(ro + rd * max(0.0, -b)) * 4.5 + u_time * 0.05, 4);
    float shellGlow = exp(-shellDist / (starR * 0.85)) * (0.45 + 0.85 * nNoise);
    vec3 shellCol = mix(vec3(0.18, 0.86, 0.92), vec3(0.96, 0.28, 0.52), smoothstep(starR * 1.4, shellR * 1.15, closestDist));
    col += shellCol * shellGlow * 0.95;
    alpha = max(alpha, clamp(shellGlow * 0.65, 0.0, 0.85));
  }

  // Case A: Stellar-Mass Black Hole with Gravitational Lensing & Accretion Disk
  if (u_remnantType == 3) {
    float ehRadius = starR * 0.48;
    float photonRing = abs(closestDist - ehRadius * 1.45);
    float ringGlow = exp(-photonRing / (ehRadius * 0.14)) * 2.2;

    // Accretion disk intersection (tilted plane)
    vec3 diskNormal = normalize(vec3(0.15, 0.94, -0.28));
    float denom = dot(rd, diskNormal);
    if (abs(denom) > 0.001) {
      float tDisk = -dot(ro, diskNormal) / denom;
      if (tDisk > 0.0) {
        vec3 pDisk = ro + rd * tDisk;
        // Gravitational lensing warp near event horizon
        float dDisk = length(pDisk);
        if (dDisk > ehRadius * 1.35 && dDisk < starR * 2.8) {
          float angle = atan(pDisk.z, pDisk.x) - u_time * 1.8;
          float rings = fbm(vec3(dDisk * 8.0, angle * 1.5, u_time * 0.4), 4);
          // Relativistic Doppler beaming (approaching side brighter)
          float doppler = 0.7 + 0.55 * normalize(pDisk).x;
          float radialFade = smoothstep(ehRadius * 1.35, ehRadius * 1.8, dDisk) * smoothstep(starR * 2.8, starR * 1.4, dDisk);
          vec3 diskCol = mix(vec3(0.98, 0.35, 0.08), vec3(1.0, 0.92, 0.72), rings * doppler);
          col += diskCol * radialFade * (0.8 + 1.4 * rings) * doppler;
          alpha = max(alpha, radialFade * 0.9);
        }
      }
    }

    col += vec3(1.0, 0.78, 0.42) * ringGlow;
    alpha = max(alpha, clamp(ringGlow, 0.0, 1.0));
    if (closestDist < ehRadius && -b > 0.0) {
      // Event Horizon shadow
      col = vec3(0.01, 0.005, 0.0);
      alpha = 1.0;
    }
    return vec4(col, alpha);
  }

  // Case B: Neutron Star / Pulsar with Relativistic Magnetic Polar Jets
  if (u_remnantType == 2) {
    float psrR = starR * 0.25;
    float coreGlow = exp(-closestDist / (psrR * 1.2)) * 2.5;
    col += vec3(0.55, 0.88, 1.0) * coreGlow;

    // Rotating Lighthouse Magnetic Beam
    vec3 pClosest = ro + rd * max(0.0, -b);
    vec3 jetAxis = normalize(vec3(sin(u_time * 4.5) * 0.45, 0.9, cos(u_time * 4.5) * 0.45));
    float align = abs(dot(normalize(pClosest + 1e-4), jetAxis));
    float jetBeam = pow(max(0.0, align), 18.0) * exp(-closestDist * 0.55);
    col += vec3(0.38, 0.85, 1.0) * jetBeam * 2.4;
    alpha = clamp(coreGlow + jetBeam, 0.0, 1.0);
    return vec4(col, alpha);
  }

  // Case C: Standard Star / Giant / White Dwarf with Convective Photosphere & Corona
  float disc = b * b - (c - starR * starR);
  if (disc > 0.0 && -b > 0.0) {
    float tHit = -b - sqrt(disc);
    vec3 hitPos = ro + rd * tHit;
    vec3 n = normalize(hitPos);

    // Rotate photosphere
    float a = u_time * 0.14;
    vec3 nRot = vec3(n.x * cos(a) - n.z * sin(a), n.y, n.x * sin(a) + n.z * cos(a));

    // Boiling convective granulation + magnetic sunspots
    float gran = fbm(nRot * 8.5 + vec3(u_time * 0.22), 5);
    float fineGran = ridgeFbm(nRot * 18.0 - vec3(u_time * 0.35), 3);
    float spots = smoothstep(0.68, 0.78, fbm(nRot * 3.2 + vec3(u_seed * 0.1), 3));

    float mu = max(0.0, dot(n, -rd));
    float limbDarkening = pow(mu, 0.42);

    vec3 photoCol = u_starColor * (0.75 + 0.65 * gran + 0.35 * fineGran);
    photoCol = mix(photoCol * 0.28, photoCol, 1.0 - spots * 0.75);
    // Hot limb chromosphere edge
    photoCol += u_starColor * 1.4 * pow(1.0 - mu, 3.0) * 0.45;
    photoCol *= (0.35 + 0.85 * limbDarkening);
    // Boost core brightness
    photoCol += vec3(1.0, 0.98, 0.94) * pow(gran, 3.0) * 0.55;

    col = photoCol * (1.0 + u_superflare * 1.2);
    alpha = 1.0;
  } else {
    // Volumetric Solar Corona & Prominences outside the stellar limb
    vec3 pClosest = ro + rd * max(0.0, -b);
    vec3 dir = normalize(pClosest + 1e-5);
    float coronaNoise = ridgeFbm(dir * 5.2 + vec3(u_time * 0.28), 4);
    float distFromLimb = max(0.0, closestDist - starR);
    float corona = exp(-distFromLimb / (starR * (0.55 + u_superflare * 0.65))) * (0.65 + 0.65 * coronaNoise);
    float outerHalo = exp(-distFromLimb / (starR * 2.2)) * 0.38;

    col += u_starColor * (corona * 1.35 + outerHalo) * (1.0 + u_superflare * 1.5);
    alpha = clamp(corona + outerHalo * 0.5, 0.0, 1.0);
  }

  // Binary companion star if present
  if (u_isBinary > 0.5 && scaleFactor > 0.3) {
    float compAngle = u_time * 0.45;
    vec3 compPos = vec3(cos(compAngle) * starR * 2.6, sin(compAngle * 0.5) * starR * 0.3, sin(compAngle) * starR * 2.6);
    vec3 roComp = ro - compPos;
    float bC = dot(roComp, rd);
    float cC = dot(roComp, roComp);
    float dCSq = max(0.0, cC - bC * bC);
    float dC = sqrt(dCSq);
    float compR = starR * 0.42;
    float compGlow = exp(-max(0.0, dC - compR * 0.5) / (compR * 1.1));
    if (-bC > 0.0) {
      col += u_companionColor * compGlow * 1.4;
      alpha = max(alpha, clamp(compGlow, 0.0, 1.0));
    }
  }

  return vec4(col, alpha);
}

// --- SCALE 5: 3D RAYMARCHED PLANETARY GLOBE, ATMOSPHERE, CLOUDS, RINGS & CITY LIGHTS ---
float getPlanetElevation(vec3 n) {
  vec3 seedShift = vec3(mod(u_planetSeed, 73.0) * 0.17, mod(u_planetSeed, 41.0) * 0.23, mod(u_planetSeed, 89.0) * 0.11);
  if (u_planetArchetype == 5 || u_planetArchetype == 6) {
    // Gas / Ice Giant zonal bands + Coriolis storms
    float bands = sin(n.y * 16.0 + fbm(n * 3.5 + seedShift, 4) * 3.2) * 0.5 + 0.5;
    float storm = smoothstep(0.68, 0.92, fbm(vec3(n.x * 2.5, n.y * 6.0, n.z * 2.5) + seedShift, 4));
    return mix(bands, 1.0, storm * 0.65);
  }
  float continents = fbm(n * 2.35 + seedShift, 5);
  float mountains = ridgeFbm(n * 6.2 + seedShift, 4) * u_terrainRoughness;
  return continents * 0.72 + mountains * 0.28;
}

vec4 renderPlanetaryGlobe(vec3 ro, vec3 rd) {
  vec3 col = vec3(0.0);
  float alpha = 0.0;
  float planetR = 1.05;
  float atmoR = planetR * (1.08 + clamp(u_pressureAtm * 0.015, 0.02, 0.09));

  // Sun illumination direction
  vec3 sunDir = normalize(vec3(0.82, 0.28, 0.48));

  float b = dot(ro, rd);
  float c = dot(ro, ro);
  float closestDist = sqrt(max(0.0, c - b * b));

  // 1. Planetary Rings (Back half behind planet + front half in front)
  vec3 ringAccum = vec3(0.0);
  float ringAlpha = 0.0;
  float tRing = -1.0;

  if (u_hasRings > 0.5) {
    vec3 ringNormal = normalize(vec3(0.16, 0.94, 0.28));
    float denom = dot(rd, ringNormal);
    if (abs(denom) > 0.001) {
      tRing = -dot(ro, ringNormal) / denom;
      if (tRing > 0.0) {
        vec3 pRing = ro + rd * tRing;
        float rRing = length(pRing) / planetR;
        if (rRing > u_ringInner && rRing < u_ringOuter) {
          float normR = (rRing - u_ringInner) / (u_ringOuter - u_ringInner);
          float bands = sin(normR * 42.0) * 0.35 + sin(normR * 115.0) * 0.2 + 0.55;
          // Cassini division gap
          float cassiniGap = smoothstep(0.03, 0.08, abs(normR - 0.62));
          float edgeFade = smoothstep(0.0, 0.08, normR) * smoothstep(1.0, 0.9, normR);

          // Planet shadow cast on rings
          float shadow = 1.0;
          float bShadow = dot(pRing, sunDir);
          if (bShadow < 0.0) {
            float dShadow = length(pRing - sunDir * bShadow);
            shadow = smoothstep(planetR * 0.94, planetR * 1.04, dShadow);
          }

          ringAlpha = clamp(bands * cassiniGap * edgeFade * 0.78, 0.0, 0.92);
          ringAccum = mix(u_colLowland, u_colPeak, bands) * (0.2 + 0.8 * shadow);
        }
      }
    }
  }

  // 2. Sphere Intersection with Planet Surface
  float disc = b * b - (c - planetR * planetR);
  float tPlanet = 1e9;
  if (disc > 0.0 && -b > 0.0) {
    tPlanet = -b - sqrt(disc);
    vec3 hitPos = ro + rd * tPlanet;
    vec3 nSphere = normalize(hitPos);

    // Axial rotation
    float rot = u_time * 0.09;
    vec3 nRot = vec3(
      nSphere.x * cos(rot) - nSphere.z * sin(rot),
      nSphere.y,
      nSphere.x * sin(rot) + nSphere.z * cos(rot)
    );

    float elev = getPlanetElevation(nRot);

    // Compute analytic perturbation normal for 3D topographic relief
    float eps = 0.008;
    float ex = getPlanetElevation(normalize(nRot + vec3(eps, 0.0, 0.0))) - elev;
    float ey = getPlanetElevation(normalize(nRot + vec3(0.0, eps, 0.0))) - elev;
    float ez = getPlanetElevation(normalize(nRot + vec3(0.0, 0.0, eps))) - elev;
    vec3 bumpGrad = vec3(ex, ey, ez) / eps;

    float isOcean = (u_planetArchetype != 5 && u_planetArchetype != 6 && elev < u_oceanCoverage) ? 1.0 : 0.0;
    float bumpStrength = isOcean > 0.5 ? 0.015 : (0.14 * u_terrainRoughness);
    vec3 nSurface = normalize(nSphere - bumpGrad * bumpStrength);

    float ndotl = dot(nSurface, sunDir);
    float dayMask = smoothstep(-0.12, 0.22, ndotl);
    float diffuse = max(0.03, smoothstep(-0.08, 0.95, ndotl));

    // Surface material & biome coloring
    vec3 surfCol;
    float specStrength = 0.08;

    if (u_planetArchetype == 5 || u_planetArchetype == 6) {
      // Gas / Ice Giant cloud bands
      surfCol = mix(u_colDeepOcean, u_colLowland, elev);
      surfCol = mix(surfCol, u_colHighland, sin(elev * 12.0) * 0.5 + 0.5);
      specStrength = 0.12;
    } else if (isOcean > 0.5) {
      float depth = clamp(elev / max(0.01, u_oceanCoverage), 0.0, 1.0);
      surfCol = mix(u_colDeepOcean, u_colShallowOcean, pow(depth, 1.6));
      specStrength = (u_planetArchetype == 2) ? 0.25 : 0.85; // High Fresnel specular on liquid oceans
    } else {
      float landH = clamp((elev - u_oceanCoverage) / max(0.01, 1.0 - u_oceanCoverage), 0.0, 1.0);
      surfCol = mix(u_colLowland, u_colHighland, smoothstep(0.15, 0.72, landH));
      surfCol = mix(surfCol, u_colPeak, smoothstep(0.68, 0.95, landH));

      // Biosphere vegetation / photosynthetic pigment layer!
      if (u_bioComplexity > 0.1) {
        float latFactor = 1.0 - abs(nRot.y);
        float bioZone = smoothstep(0.02, 0.45, landH) * smoothstep(0.82, 0.35, landH) * smoothstep(0.15, 0.75, latFactor);
        surfCol = mix(surfCol, u_colFoliage, bioZone * u_bioComplexity * 0.88);
      }
      specStrength = 0.08;
    }

    // Polar Ice Caps
    if (u_iceCoverage > 0.01 && u_planetArchetype != 5 && u_planetArchetype != 6) {
      float poleLat = abs(nRot.y) + (elev - 0.5) * 0.18;
      float iceMask = smoothstep(1.02 - u_iceCoverage * 0.85, 1.06 - u_iceCoverage * 0.85, poleLat);
      surfCol = mix(surfCol, vec3(0.92, 0.96, 1.0), iceMask);
      specStrength = mix(specStrength, 0.45, iceMask);
    }

    // Specular reflection (Sun glint on oceans & ice)
    vec3 halfVec = normalize(sunDir - rd);
    float spec = pow(max(0.0, dot(nSurface, halfVec)), isOcean > 0.5 ? 48.0 : 16.0) * specStrength * dayMask;
    vec3 sunTint = mix(vec3(1.0), u_starColor, 0.35);

    vec3 litCol = surfCol * diffuse * sunTint + sunTint * spec * 0.75;

    // 3. Dynamic Volumetric Cloud Layer + Cloud Shadows
    if (u_cloudCoverage > 0.02 && u_planetArchetype != 5 && u_planetArchetype != 6) {
      float cloudRot = u_time * 0.135;
      vec3 nCloud = vec3(
        nSphere.x * cos(cloudRot) - nSphere.z * sin(cloudRot),
        nSphere.y,
        nSphere.x * sin(cloudRot) + nSphere.z * cos(cloudRot)
      );
      float swirl = fbm(nCloud * 3.2 + vec3(0.0, u_time * 0.02, 0.0), 4);
      float clouds = fbm(nCloud * 4.5 + vec3(swirl * 1.4), 5);
      float cloudMask = smoothstep(0.92 - u_cloudCoverage * 0.58, 0.98, clouds);

      // Cloud shadow offset on surface
      float shadowClouds = fbm((nCloud - sunDir * 0.03) * 4.5 + vec3(swirl * 1.4), 4);
      float shadowMask = smoothstep(0.92 - u_cloudCoverage * 0.58, 0.98, shadowClouds);
      litCol *= (1.0 - shadowMask * 0.38 * dayMask);

      vec3 cloudLight = mix(u_colAtmo * 0.25, vec3(0.98, 0.99, 1.0) * sunTint, max(0.08, smoothstep(-0.15, 0.85, dot(nSphere, sunDir))));
      litCol = mix(litCol, cloudLight, cloudMask * 0.88);
    }

    // 4. Night-Side Emissive Features: Civilization City Lights, Volcanic Lava & Bioluminescence!
    float nightMask = smoothstep(0.15, -0.22, dot(nSphere, sunDir));
    if (nightMask > 0.01) {
      // Volcanic magma fissures
      if (u_volcanism > 0.35 || u_planetArchetype == 2) {
        float lavaRift = pow(ridgeFbm(nRot * 7.5 + vec3(u_time * 0.05), 4), 3.2);
        float lavaThreshold = u_planetArchetype == 2 ? 0.18 : (0.55 - u_volcanism * 0.28);
        float lavaGlow = smoothstep(lavaThreshold, lavaThreshold + 0.25, lavaRift);
        litCol += vec3(1.0, 0.38, 0.06) * lavaGlow * (u_planetArchetype == 2 ? 1.3 : nightMask * 0.95);
      }

      // Civilization Urban City Light Grids on Continents
      if (u_cityLights > 0.05 && isOcean < 0.5) {
        float urbanCluster = fbm(nRot * 6.5, 4);
        float roadGrid = ridgeFbm(nRot * 28.0, 3);
        float coastalBonus = smoothstep(u_oceanCoverage + 0.25, u_oceanCoverage + 0.01, elev);
        float cityMask = smoothstep(0.48, 0.76, urbanCluster + coastalBonus * 0.25) * smoothstep(0.45, 0.82, roadGrid);
        float latValid = smoothstep(0.85, 0.45, abs(nRot.y));
        vec3 cityColor = mix(vec3(1.0, 0.72, 0.28), vec3(0.45, 0.88, 1.0), smoothstep(0.65, 0.95, roadGrid));
        litCol += cityColor * cityMask * latValid * nightMask * u_cityLights * 1.65;
      }

      // Bioluminescent coastal glow on rich biospheres
      if (u_bioComplexity > 0.55 && abs(elev - u_oceanCoverage) < 0.045) {
        float bioPulse = 0.65 + 0.35 * sin(u_time * 2.2 + nRot.x * 12.0);
        litCol += vec3(0.15, 0.95, 0.78) * nightMask * u_bioComplexity * bioPulse * 0.42;
      }
    }

    // 5. Polar Auroras (when magnetic field / superflare active)
    float auroraLat = smoothstep(0.68, 0.88, abs(nRot.y)) * smoothstep(0.98, 0.88, abs(nRot.y));
    if (auroraLat > 0.01 && u_pressureAtm > 0.02) {
      float curtain = sin(nRot.x * 24.0 + fbm(nRot * 8.0 + u_time * 0.5, 3) * 8.0) * 0.5 + 0.5;
      float auroraStrength = (0.28 + u_superflare * 1.4) * auroraLat * pow(curtain, 2.0);
      litCol += vec3(0.18, 0.96, 0.62) * auroraStrength * (0.35 + 0.65 * nightMask);
    }

    // 6. Atmospheric Rayleigh Fresnel Limb Scatter on planet surface
    float fresnel = pow(1.0 - max(0.0, dot(nSphere, -rd)), 3.2);
    float atmoDensity = clamp(pow(u_pressureAtm, 0.35), 0.05, 1.35);
    float terminatorScatter = smoothstep(-0.35, 0.45, dot(nSphere, sunDir));
    vec3 rayleighRim = mix(u_colAtmo * vec3(1.3, 0.65, 0.35), u_colAtmo, smoothstep(-0.1, 0.35, dot(nSphere, sunDir)));
    litCol += rayleighRim * fresnel * terminatorScatter * atmoDensity * 0.85;

    // Transient asteroid impact flash or evolutionary wave pulse
    if (u_impactFlash > 0.01) {
      float impDist = length(nSphere - normalize(vec3(0.3, 0.2, 0.9)));
      float shockRing = exp(-abs(impDist - (1.0 - u_impactFlash) * 1.2) * 18.0);
      litCol += vec3(1.0, 0.55, 0.15) * (exp(-impDist * 4.5) + shockRing * 1.5) * u_impactFlash * 2.0;
    }
    if (u_evoPulse > 0.01) {
      float wave = exp(-abs(nSphere.y - (1.0 - u_evoPulse * 2.0)) * 8.0);
      litCol += vec3(0.22, 0.96, 0.72) * wave * u_evoPulse * 1.2;
    }

    col = litCol;
    alpha = 1.0;
  }

  // 7. Outer Atmospheric Limb Halo outside planet sphere
  if (closestDist >= planetR * 0.98 && closestDist < atmoR * 1.18 && -b > 0.0 && u_pressureAtm > 0.005) {
    vec3 pLimb = normalize(ro + rd * max(0.0, -b));
    float sunAlign = smoothstep(-0.35, 0.65, dot(pLimb, sunDir));
    float limbFactor = exp(-(closestDist - planetR) / max(0.015, (atmoR - planetR) * 0.52));
    float atmoWeight = clamp(pow(u_pressureAtm, 0.3), 0.1, 1.2);
    vec3 haloCol = u_colAtmo * limbFactor * (0.25 + 0.95 * sunAlign) * atmoWeight;
    col += haloCol * (1.0 - alpha * 0.3);
    alpha = max(alpha, clamp(limbFactor * atmoWeight * 0.85, 0.0, 1.0));
  }

  // Composite planetary rings (either in front of or behind planet)
  if (ringAlpha > 0.001) {
    if (tRing < tPlanet) {
      col = mix(col, ringAccum, ringAlpha);
      alpha = max(alpha, ringAlpha);
    } else {
      col = col + ringAccum * ringAlpha * (1.0 - alpha);
      alpha = max(alpha, ringAlpha);
    }
  }

  return vec4(col, alpha);
}

// --- SCALE 6 & 7: 3D PLANETARY SURFACE, ATMOSPHERIC SKY & BIOSPHERE LANDSCAPE ---
float getSurfaceTerrainHeight(vec2 xz) {
  vec2 seedShift = vec2(mod(u_planetSeed, 53.0) * 1.7, mod(u_planetSeed, 79.0) * 2.3);
  vec3 p = vec3(xz * 0.22 + seedShift, u_planetSeed * 0.05);
  float base = fbm(p, 5);
  float ridges = ridgeFbm(p * 1.85, 4) * u_terrainRoughness;
  return (base * 0.65 + ridges * 0.55) * 2.4 - 0.85;
}

vec4 renderPlanetarySurface(vec2 uv) {
  // Construct surface horizon camera
  float yaw = u_cameraAngles.x * 0.65;
  float pitch = clamp(u_cameraAngles.y * 0.35 + 0.08, -0.25, 0.45);
  mat3 cam = getCameraMatrix(yaw, pitch);
  vec3 rd = normalize(cam * vec3(uv, -1.35));

  // Camera hovers above the planetary surface with gentle flight motion
  vec3 ro = vec3(u_time * 0.22, 1.45, u_time * 0.35);
  float groundUnderCam = getSurfaceTerrainHeight(ro.xz);
  float waterLevel = (u_oceanCoverage - 0.42) * 1.1;
  ro.y = max(groundUnderCam, waterLevel) + 1.15;

  // Dynamic sun position across the alien sky
  float dayCycle = u_time * 0.08 + 0.55;
  vec3 sunDir = normalize(vec3(cos(dayCycle) * 0.65, max(0.06, sin(dayCycle) * 0.55 + 0.22), 0.62));
  float sunElevation = clamp(sunDir.y, 0.0, 1.0);

  // 1. Physically Based Atmospheric Sky Scattering
  float atmoThick = clamp(pow(u_pressureAtm, 0.35), 0.02, 1.6);
  vec3 spaceSky = renderDeepStarfield(rd) * (1.0 - clamp(atmoThick * sunElevation * 0.88, 0.0, 0.94));
  vec3 zenithCol = u_colAtmo * (0.25 + 0.85 * sunElevation) * clamp(atmoThick, 0.05, 1.25);
  vec3 horizonCol = mix(u_colAtmo * 1.25, u_starColor * vec3(1.0, 0.65, 0.42), 1.0 - sunElevation * 0.65) * clamp(atmoThick, 0.08, 1.35);

  float horizonGrad = pow(1.0 - max(0.0, rd.y), 3.2);
  vec3 skyCol = spaceSky + mix(zenithCol, horizonCol, horizonGrad);

  // Parent Star Disk & Mie Forward Scattering Halo in the Sky
  float sunCos = max(0.0, dot(rd, sunDir));
  float sunDisk = smoothstep(0.9982, 0.9994, sunCos);
  float mieScatter = pow(sunCos, 12.0) * 0.45 * clamp(atmoThick, 0.1, 1.4) + pow(sunCos, 64.0) * 0.75;
  skyCol += u_starColor * (sunDisk * 3.5 + mieScatter);

  // Planetary Rings or Companion Moon arching across the alien sky!
  if (u_hasRings > 0.5 && rd.y > 0.0) {
    float ringArc = abs(rd.y * 0.75 - abs(rd.x) * 0.42 - 0.28);
    if (ringArc < 0.09) {
      float rBand = sin(ringArc * 260.0) * 0.4 + 0.6;
      float rMask = smoothstep(0.09, 0.01, ringArc);
      skyCol = mix(skyCol, u_colPeak * 0.85, rMask * rBand * 0.55);
    }
  }

  // High-altitude atmospheric clouds in sky
  if (u_cloudCoverage > 0.05 && rd.y > 0.03) {
    vec2 skyUV = rd.xz / (rd.y + 0.18) * 1.6 + vec2(u_time * 0.04, 0.0);
    float cNoise = fbm(vec3(skyUV, u_time * 0.02), 5);
    float cMask = smoothstep(0.88 - u_cloudCoverage * 0.48, 0.96, cNoise) * smoothstep(0.03, 0.22, rd.y);
    vec3 cCol = mix(horizonCol, vec3(0.98, 0.98, 1.0) * mix(vec3(1.0), u_starColor, 0.3), 0.65);
    skyCol = mix(skyCol, cCol, cMask * 0.82);
  }

  // 2. Raymarch 3D Planetary Terrain & Ocean
  vec3 finalCol = skyCol;
  float t = 0.2;
  float maxT = 26.0;
  bool hitTerrain = false;
  vec3 hitPos = vec3(0.0);

  for (int i = 0; i < 64; i++) {
    vec3 p = ro + rd * t;
    float h = getSurfaceTerrainHeight(p.xz);
    if (u_oceanCoverage > 0.05) {
      h = max(h, waterLevel);
    }
    float diff = p.y - h;
    if (diff < 0.008 * t) {
      hitTerrain = true;
      hitPos = p;
      break;
    }
    t += max(0.05, diff * 0.52);
    if (t > maxT) break;
  }

  if (hitTerrain) {
    float rawH = getSurfaceTerrainHeight(hitPos.xz);
    bool isWaterSurface = (u_oceanCoverage > 0.05) && (rawH <= waterLevel + 0.015);

    vec3 n;
    vec3 matCol;

    if (isWaterSurface) {
      // Animated Ocean / Liquid Wave Normal & Fresnel Reflection
      vec2 wuv = hitPos.xz * 3.5 + vec2(u_time * 0.6, u_time * 0.4);
      float w1 = noise3(vec3(wuv, u_time * 0.8));
      float w2 = noise3(vec3(wuv * 2.3 - u_time * 0.9, u_time * 0.5));
      n = normalize(vec3((w1 - 0.5) * 0.14, 1.0, (w2 - 0.5) * 0.14));

      vec3 reflDir = reflect(rd, n);
      reflDir.y = abs(reflDir.y);
      float fresnel = clamp(0.12 + 0.88 * pow(1.0 - max(0.0, dot(-rd, n)), 4.0), 0.0, 1.0);
      vec3 waterDeep = (u_planetArchetype == 2) ? vec3(0.98, 0.32, 0.05) : u_colDeepOcean;
      vec3 waterShallow = (u_planetArchetype == 2) ? vec3(1.0, 0.65, 0.12) : u_colShallowOcean;
      float shoreDepth = clamp((waterLevel - rawH) * 2.5, 0.0, 1.0);
      vec3 baseWater = mix(waterShallow, waterDeep, shoreDepth);

      float sunGlint = pow(max(0.0, dot(reflDir, sunDir)), 96.0) * 2.4;
      matCol = mix(baseWater * (0.35 + 0.65 * sunElevation), skyCol, fresnel * 0.78) + u_starColor * sunGlint;
    } else {
      // 3D Terrain Normal & Stratigraphy
      float eps = 0.04;
      float hx = getSurfaceTerrainHeight(hitPos.xz + vec2(eps, 0.0)) - rawH;
      float hz = getSurfaceTerrainHeight(hitPos.xz + vec2(0.0, eps)) - rawH;
      n = normalize(vec3(-hx, eps, -hz));

      float slope = 1.0 - n.y;
      float normH = clamp((rawH - waterLevel) / 1.8, 0.0, 1.0);

      matCol = mix(u_colLowland, u_colHighland, smoothstep(0.15, 0.68, normH + slope * 0.35));
      matCol = mix(matCol, u_colPeak, smoothstep(0.65, 0.92, normH));

      // Biosphere Flora on flatter terrain slopes
      if (u_bioComplexity > 0.1) {
        float floraMask = smoothstep(0.45, 0.08, slope) * smoothstep(0.72, 0.12, normH);
        float detailFlora = noise3(vec3(hitPos.xz * 4.5, 1.0));
        matCol = mix(matCol, u_colFoliage * (0.7 + 0.6 * detailFlora), floraMask * u_bioComplexity * 0.92);

        // Bioluminescent organic nodes
        if (detailFlora > 0.74) {
          matCol += vec3(0.18, 0.95, 0.72) * smoothstep(0.74, 0.92, detailFlora) * u_bioComplexity * 0.45;
        }
      }

      // Ice / Snow layer on cold planets or high peaks
      if (u_iceCoverage > 0.05) {
        float snowLine = 1.05 - u_iceCoverage * 0.95;
        float snowMask = smoothstep(snowLine - 0.15, snowLine + 0.12, normH) * smoothstep(0.55, 0.2, slope);
        matCol = mix(matCol, vec3(0.92, 0.96, 1.0), snowMask);
      }

      // Civilization surface structures & energy grids
      if (u_cityLights > 0.08 && slope < 0.28 && normH < 0.45) {
        vec2 grid = abs(fract(hitPos.xz * 2.2) - 0.5);
        float structMask = smoothstep(0.06, 0.01, min(grid.x, grid.y)) * smoothstep(0.58, 0.78, noise3(vec3(hitPos.xz * 0.8, 2.0)));
        matCol += vec3(1.0, 0.78, 0.36) * structMask * u_cityLights * 1.4;
      }

      float diff = max(0.08, dot(n, sunDir));
      vec3 amb = horizonCol * 0.35 + vec3(0.06, 0.08, 0.12);
      matCol = matCol * (diff * mix(vec3(1.0), u_starColor, 0.35) + amb);
    }

    // Distance atmospheric aerial perspective (exponential fog matching sky horizon)
    float fogFactor = 1.0 - exp(-t * (0.042 + clamp(atmoThick, 0.0, 1.0) * 0.035));
    finalCol = mix(matCol, horizonCol, clamp(fogFactor, 0.0, 0.95));
  }

  return vec4(finalCol, 1.0);
}

// --- ACES Filmic HDR Tone Mapping ---
vec3 acesToneMap(vec3 x) {
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

void main() {
  vec2 aspectUV = (v_uv - 0.5) * 2.0;
  aspectUV.x *= u_resolution.x / max(1.0, u_resolution.y);

  // Build 3D Orbital Camera Ray
  mat3 camMat = getCameraMatrix(u_cameraAngles.x, u_cameraAngles.y);
  vec3 ro = camMat * vec3(0.0, 0.0, 3.35 / max(0.25, u_cameraZoom));
  vec3 rd = normalize(camMat * vec3(aspectUV, -1.55));

  // Base deep-space starfield & cosmic dust
  vec3 finalColor = renderDeepStarfield(rd);

  // Compute smooth continuous cross-dissolve weights across all 7 scales!
  float s = u_logScale;
  float wCosmos  = smoothstep(21.4, 23.0, s);
  float wGalaxy  = smoothstep(17.5, 19.2, s) * (1.0 - smoothstep(22.2, 23.6, s));
  float wStar    = smoothstep(9.6, 11.4, s)  * (1.0 - smoothstep(18.0, 19.5, s));
  float wPlanet  = smoothstep(3.3, 4.9, s)   * (1.0 - smoothstep(9.5, 10.9, s));
  float wSurface = 1.0 - smoothstep(3.4, 4.9, s);

  if (wCosmos > 0.005) {
    vec4 cosCol = renderCosmicWeb(ro, rd);
    finalColor = mix(finalColor, finalColor + cosCol.rgb, wCosmos);
  }

  if (wGalaxy > 0.005) {
    vec4 galCol = renderGalaxy(ro, rd);
    finalColor = mix(finalColor, mix(finalColor, galCol.rgb, galCol.a) + galCol.rgb * 0.25, wGalaxy);
  }

  if (wStar > 0.005) {
    // At sector scale (s ~ 17) star is more compact; at system scale (s ~ 12.3) star is prominent at center
    float starSizeFactor = mix(1.05, 0.55, smoothstep(11.5, 17.5, s));
    vec4 stCol = renderStar(ro, rd, starSizeFactor);
    finalColor = mix(finalColor, mix(finalColor, stCol.rgb, stCol.a), wStar);
  }

  if (wPlanet > 0.005) {
    vec4 plCol = renderPlanetaryGlobe(ro, rd);
    finalColor = mix(finalColor, mix(finalColor, plCol.rgb, plCol.a), wPlanet);
  }

  if (wSurface > 0.005) {
    vec4 surfCol = renderPlanetarySurface(aspectUV);
    finalColor = mix(finalColor, surfCol.rgb, wSurface);
  }

  // Subtle vignette & ACES Filmic HDR Tone Mapping
  float vig = 1.0 - dot(v_uv - 0.5, v_uv - 0.5) * 0.35;
  finalColor = acesToneMap(finalColor * vig * 1.08);
  finalColor = pow(finalColor, vec3(0.95));

  fragColor = vec4(finalColor, 1.0);
}
`;
