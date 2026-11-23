/**
 * PARALLAX v3.0 — Ultra-Optimized WebGL2 GLSL Multi-Scale Raymarching Shaders
 * Performance & Realism Optimizations:
 * - CPU-precomputed 6-DOF orthonormal camera basis (supports Roll, Pitch, Yaw, Pan & Orbit!)
 * - Adaptive GPU step count via u_qualityLevel (0=Performance, 1=Balanced, 2=Ultra)
 * - Fast analytical impact crater relief (5x faster than 27-tap 3D Voronoi)
 * - Universe Sandbox Lighting Modes (0=Realistic, 1=Studio Fill, 2=Camera Flashlight)
 * - Real-time molten collision/laser crust heating (u_moltenHeat) & thermal laser strike
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
uniform float u_logScale;
uniform vec3 u_camRight;
uniform vec3 u_camUp;
uniform vec3 u_camForward;
uniform vec3 u_camOrigin;
uniform vec2 u_cameraAngles;
uniform vec2 u_surfaceOffset;
uniform float u_warpFactor;
uniform float u_seed;
uniform int u_qualityLevel;     // 0: Fast/Mobile, 1: Balanced, 2: Ultra
uniform int u_lightingMode;     // 0: Realistic, 1: Studio, 2: Flashlight

// Star uniforms
uniform vec3 u_starColor;
uniform float u_starTempK;
uniform float u_starRadiusNorm;
uniform int u_remnantType;
uniform float u_hasNebulaHalo;
uniform float u_isBinary;
uniform vec3 u_companionColor;

// Galaxy uniforms
uniform int u_galaxyFamily;
uniform float u_galaxyArms;
uniform float u_galaxyTwist;
uniform float u_galaxyBar;
uniform float u_agnActive;
uniform vec3 u_nebulaColor;

// Planet uniforms
uniform int u_planetArchetype;
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
uniform float u_isTidallyLocked;
uniform float u_moltenHeat;     // 0.0..1.0 real-time collision / thermal laser magma glow!
uniform float u_hasRings;
uniform float u_ringInner;
uniform float u_ringOuter;
uniform float u_planetSeed;

// Transient phenomena uniforms
uniform float u_superflare;
uniform float u_impactFlash;
uniform float u_evoPulse;
uniform float u_laserActive;

#define PI 3.14159265359

float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}

vec3 hash33(vec3 p3) {
  p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yxx) * p3.zyx);
}

float noise3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);

  return mix(
    mix(
      mix(hash13(i), hash13(i + vec3(1.0, 0.0, 0.0)), f.x),
      mix(hash13(i + vec3(0.0, 1.0, 0.0)), hash13(i + vec3(1.0, 1.0, 0.0)), f.x),
      f.y
    ),
    mix(
      mix(hash13(i + vec3(0.0, 0.0, 1.0)), hash13(i + vec3(1.0, 0.0, 1.0)), f.x),
      mix(hash13(i + vec3(0.0, 1.0, 1.0)), hash13(i + vec3(1.0, 1.0, 1.0)), f.x),
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
  for (int i = 0; i < 5; i++) {
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
  for (int i = 0; i < 4; i++) {
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

// Fast 1-cell analytical crater relief (~5x faster than 27-tap Voronoi!)
float fastCraters(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 center = hash33(i) * 0.5 + 0.25;
  float d = length(f - center);
  float bowl = smoothstep(0.0, 0.28, d);
  float rim = exp(-pow((d - 0.30) * 14.0, 2.0)) * 0.20;
  return (bowl - 1.0) * 0.30 + rim;
}

// --- Deep Space Starfield & Relativistic Warp Streaks ---
vec3 renderDeepStarfield(vec3 rd, vec2 aspectUV) {
  vec3 col = vec3(0.008, 0.012, 0.020);

  float galLat = abs(rd.y * 1.45 + rd.x * 0.38 - rd.z * 0.18);
  float band = pow(max(0.0, 1.0 - galLat), 3.2);
  if (band > 0.02) {
    float dust = fbm(rd * 3.8 + vec3(u_seed * 0.01), 3);
    col += vec3(0.036, 0.058, 0.105) * band * smoothstep(0.22, 0.82, dust);
    col += u_nebulaColor * 0.025 * band * dust * dust;
  }

  int starLayers = u_qualityLevel == 0 ? 2 : 3;
  for (int layer = 0; layer < 3; layer++) {
    if (layer >= starLayers) break;
    float scale = layer == 0 ? 96.0 : (layer == 1 ? 195.0 : 310.0);
    vec3 p = rd * scale;
    vec3 id = floor(p);
    vec3 local = fract(p) - 0.5;
    float h = hash13(id + float(layer) * 77.7);
    float thresh = layer == 0 ? 0.968 : 0.960;
    if (h > thresh) {
      vec3 offset = (hash33(id + float(layer) * 19.1) - 0.5) * 0.60;
      float d = length(local - offset);
      float brightness = smoothstep(thresh, 1.0, h);
      float starGlow = exp(-d * (layer == 0 ? 15.0 : 25.0)) * brightness;
      float tempHash = hash13(id + 9.0);
      vec3 sCol = tempHash < 0.35
        ? vec3(1.0, 0.72, 0.46)
        : (tempHash < 0.72 ? vec3(0.98, 0.97, 0.94) : vec3(0.58, 0.80, 1.0));
      col += sCol * starGlow * (layer == 0 ? 1.42 : (layer == 1 ? 0.82 : 0.45));
    }
  }

  if (u_warpFactor > 0.02) {
    float rUV = length(aspectUV);
    float angle = atan(aspectUV.y, aspectUV.x);
    float streakNoise = hash13(vec3(floor(angle * 48.0), floor(rUV * 6.0 - u_time * 12.0), 1.0));
    float streak = smoothstep(0.72, 0.98, streakNoise) * smoothstep(0.18, 0.95, rUV);
    vec3 dopplerCol = mix(vec3(0.45, 0.82, 1.0), vec3(1.0, 0.82, 0.55), hash13(vec3(floor(angle * 48.0), 2.0, 3.0)));
    col += dopplerCol * streak * u_warpFactor * 0.95;
  }

  return col;
}

// --- SCALE 1: COSMIC WEB VOLUMETRIC FILAMENTS ---
vec4 renderCosmicWeb(vec3 ro, vec3 rd) {
  vec3 accum = vec3(0.0);
  float alpha = 0.0;
  int steps = u_qualityLevel == 0 ? 22 : (u_qualityLevel == 1 ? 30 : 38);
  float stepLen = 5.4 / float(steps);
  float t = 0.75;
  vec3 seedOff = vec3(mod(u_seed, 97.0) * 0.13);

  for (int i = 0; i < 38; i++) {
    if (i >= steps || alpha > 0.94) break;
    vec3 p = ro + rd * t;
    float r = length(p);
    if (r < 4.5) {
      float fil = ridgeFbm(p * 0.88 + seedOff, 3);
      float node = smoothstep(0.52, 0.92, fil);
      float radialFalloff = smoothstep(4.4, 0.55, r);
      float density = pow(max(0.0, fil - 0.30), 2.1) * radialFalloff;

      vec3 filColor = mix(vec3(0.14, 0.44, 0.92), vec3(0.98, 0.74, 0.36), node);
      float coreGlow = exp(-r * 1.35) * 0.14;
      accum += (filColor * density * 0.25 + vec3(1.0, 0.80, 0.46) * coreGlow * 0.14) * (1.0 - alpha);
      alpha = min(0.96, alpha + density * 0.05);
    }
    t += stepLen;
  }
  return vec4(accum, clamp(alpha, 0.0, 1.0));
}

// --- SCALE 2: VOLUMETRIC 3D GALAXY & AGN QUASAR JETS ---
vec4 renderGalaxy(vec3 ro, vec3 rd) {
  float b = dot(ro, rd);
  float c = dot(ro, ro) - 7.84;
  float disc = b * b - c;
  if (disc < 0.0) return vec4(0.0);

  float tMin = max(0.05, -b - sqrt(disc));
  float tMax = -b + sqrt(disc);
  if (tMax <= tMin) return vec4(0.0);

  int steps = u_qualityLevel == 0 ? 24 : (u_qualityLevel == 1 ? 34 : 44);
  float dt = (tMax - tMin) / float(steps);
  float t = tMin;
  float rotTime = u_time * 0.032;
  vec3 accum = vec3(0.0);
  float alpha = 0.0;

  for (int i = 0; i < 44; i++) {
    if (i >= steps || alpha > 0.96) break;
    vec3 p = ro + rd * t;
    float r = length(p.xz);
    float y = p.y;

    if (u_agnActive > 0.5 && r < 0.30 && abs(y) > 0.08 && abs(y) < 2.5) {
      float jetWidth = 0.035 + abs(y) * 0.065;
      float jetMask = exp(-pow(r / jetWidth, 2.0)) * exp(-abs(y) * 0.75);
      float jetPulse = 0.75 + 0.25 * sin(abs(y) * 14.0 - u_time * 6.0);
      accum += vec3(0.42, 0.78, 1.0) * jetMask * jetPulse * dt * 1.45;
      alpha = min(0.98, alpha + jetMask * dt * 0.25);
    }

    if (u_galaxyFamily == 2) {
      float ellipR = length(vec3(p.x, p.y * 1.65, p.z));
      float bulge = exp(-ellipR * 2.3) * 1.45;
      vec3 gCol = mix(vec3(1.0, 0.74, 0.42), vec3(1.0, 0.94, 0.80), exp(-ellipR * 4.0));
      accum += gCol * bulge * dt * 0.85;
      alpha = min(0.98, alpha + bulge * dt * 0.38);
    } else {
      float diskThickness = 0.095 + 0.19 * exp(-r * 1.65);
      float verticalProfile = exp(-abs(y) / diskThickness);

      if (verticalProfile > 0.012 && r < 2.55) {
        float theta = atan(p.z, p.x) - rotTime;
        float logR = log(max(0.05, r));
        float armPhase = theta * max(1.0, u_galaxyArms) + logR * u_galaxyTwist;
        float spiralPattern = pow(cos(armPhase) * 0.5 + 0.5, 1.9);

        float barFactor = u_galaxyBar * exp(-r * 1.85) * pow(abs(cos(theta)), 3.2);
        float noiseVal = fbm(vec3(p.xz * 2.5, y * 4.5) + vec3(rotTime), 3);
        float dustLane = smoothstep(0.42, 0.72, noise3(vec3(p.xz * 4.4, y * 9.0)));

        float radialDisk = exp(-r * 1.18) * smoothstep(2.5, 0.75, r);
        float armDensity = (0.16 + 0.84 * spiralPattern + barFactor) * radialDisk * verticalProfile * (0.52 + 0.80 * noiseVal);

        float bulge = exp(-length(vec3(p.x, p.y * 2.3, p.z)) * 3.6) * 2.3;
        float hiiMask = pow(spiralPattern * noiseVal, 2.3) * smoothstep(0.22, 0.72, r) * smoothstep(2.15, 0.8, r);

        vec3 armCol = mix(vec3(0.45, 0.70, 1.0), vec3(0.98, 0.88, 0.74), exp(-r * 1.15));
        armCol = mix(armCol, u_nebulaColor * 1.75, hiiMask * 1.4);
        armCol *= (1.0 - 0.62 * dustLane * smoothstep(0.075, 0.0, abs(y)));

        accum += (armCol * armDensity * 1.55 + vec3(1.0, 0.85, 0.56) * bulge) * dt * (1.0 - alpha * 0.42);
        alpha = min(0.98, alpha + (armDensity + bulge) * dt * 0.40);
      }
    }
    t += dt;
  }

  return vec4(accum, clamp(alpha, 0.0, 1.0));
}

// --- SCALE 3 & 4: VOLUMETRIC STAR, PULSAR & GRAVITATIONALLY LENSED BLACK HOLE ---
vec4 renderStar(vec3 ro, vec3 rd, float scaleFactor, vec2 aspectUV) {
  vec3 col = vec3(0.0);
  float alpha = 0.0;

  float starR = 0.62 * scaleFactor;
  float b = dot(ro, rd);
  float c = dot(ro, ro);
  float closestDist = sqrt(max(0.0, c - b * b));

  if (u_hasNebulaHalo > 0.5) {
    float shellR = starR * 2.55;
    float shellDist = abs(closestDist - shellR);
    vec3 shellDir = normalize(ro + rd * max(0.0, -b) + 1e-4);
    float nNoise = fbm(shellDir * 4.8 + u_time * 0.04, 3);
    float shellGlow = exp(-shellDist / (starR * 0.82)) * (0.45 + 0.85 * nNoise);
    vec3 shellCol = mix(vec3(0.16, 0.88, 0.94), vec3(0.98, 0.26, 0.50), smoothstep(starR * 1.4, shellR * 1.15, closestDist));
    col += shellCol * shellGlow * 1.05;
    alpha = max(alpha, clamp(shellGlow * 0.70, 0.0, 0.88));
  }

  // Case A: Ray-Deflected Gravitational Lensing Black Hole
  if (u_remnantType == 3) {
    float ehRadius = starR * 0.46;
    vec3 diskNormal = normalize(vec3(0.14, 0.94, -0.30));
    int bhSteps = u_qualityLevel == 0 ? 32 : (u_qualityLevel == 1 ? 42 : 52);

    vec3 p = ro;
    vec3 v = rd;
    vec3 bhAccum = vec3(0.0);
    float bhAlpha = 0.0;
    bool fellIn = false;

    for (int step = 0; step < 52; step++) {
      if (step >= bhSteps) break;
      float r = length(p);
      if (r < ehRadius) {
        fellIn = true;
        break;
      }
      if (r > 7.5) break;

      float bend = (ehRadius * 0.58) / (r * r * r + 0.008);
      v = normalize(v - p * bend * 0.14);

      float stepLen = max(0.04, min(0.26, (r - ehRadius) * 0.30));
      vec3 nextP = p + v * stepLen;

      float dPrev = dot(p, diskNormal);
      float dNext = dot(nextP, diskNormal);
      if (dPrev * dNext <= 0.0) {
        float frac = abs(dPrev) / max(1e-5, abs(dPrev) + abs(dNext));
        vec3 hit = mix(p, nextP, frac);
        float rHit = length(hit);
        if (rHit > ehRadius * 1.48 && rHit < starR * 3.1) {
          float normR = (rHit - ehRadius * 1.48) / (starR * 3.1 - ehRadius * 1.48);
          float angle = atan(hit.z, hit.x) - u_time * (2.6 / (0.4 + normR));
          float spiral = fbm(vec3(rHit * 6.5, angle * 1.8, u_time * 0.3), 3);
          float bands = sin(rHit * 32.0 - u_time * 3.0) * 0.25 + 0.75;
          float doppler = clamp(0.62 + 0.68 * normalize(hit).x, 0.22, 1.55);
          float fade = smoothstep(0.0, 0.12, normR) * smoothstep(1.0, 0.25, normR);
          vec3 hotCol = mix(vec3(0.98, 0.30, 0.06), vec3(1.0, 0.94, 0.78), clamp(spiral * doppler * 0.85 + (1.0 - normR) * 0.4, 0.0, 1.0));
          bhAccum += hotCol * fade * bands * (0.75 + 1.2 * spiral) * doppler * 1.25 * (1.0 - bhAlpha * 0.55);
          bhAlpha = min(0.98, bhAlpha + fade * 0.78);
        }
      }

      float photonGlow = exp(-abs(r - ehRadius * 1.42) * 14.0) * stepLen * 1.35;
      bhAccum += vec3(1.0, 0.80, 0.45) * photonGlow * (1.0 - bhAlpha * 0.4);
      p = nextP;
    }

    if (fellIn) return vec4(bhAccum, 1.0);
    vec3 lensedBg = renderDeepStarfield(v, aspectUV);
    return vec4(mix(lensedBg, bhAccum, clamp(bhAlpha, 0.0, 1.0)) + bhAccum * 0.35, 1.0);
  }

  // Case B: Neutron Star / Magnetar Pulsar
  if (u_remnantType == 2) {
    float psrR = starR * 0.22;
    float coreGlow = exp(-closestDist / (psrR * 1.15)) * 2.8;
    col += vec3(0.62, 0.92, 1.0) * coreGlow;

    vec3 pClosest = ro + rd * max(0.0, -b);
    float spin = u_time * 5.2;
    vec3 jetAxis = normalize(vec3(sin(spin) * 0.52, 0.86, cos(spin) * 0.52));
    float align = abs(dot(normalize(pClosest + 1e-4), jetAxis));
    float jetBeam = pow(max(0.0, align), 22.0) * exp(-closestDist * 0.48);
    float torus = exp(-abs(pClosest.y) * 5.0) * exp(-abs(closestDist - starR * 1.2) * 3.5);
    col += vec3(0.35, 0.86, 1.0) * (jetBeam * 2.8 + torus * 0.85);
    alpha = clamp(coreGlow + jetBeam + torus * 0.6, 0.0, 1.0);
    return vec4(col, alpha);
  }

  // Case C: Convective Star Photosphere & Corona
  float disc = b * b - (c - starR * starR);
  if (disc > 0.0 && -b > 0.0) {
    float tHit = -b - sqrt(disc);
    vec3 hitPos = ro + rd * tHit;
    vec3 n = normalize(hitPos);

    float a = u_time * 0.12;
    vec3 nRot = vec3(n.x * cos(a) - n.z * sin(a), n.y, n.x * sin(a) + n.z * cos(a));

    int oct = u_qualityLevel == 0 ? 3 : 4;
    float gran = fbm(nRot * 9.0 + vec3(u_time * 0.22), oct);
    float fineGran = ridgeFbm(nRot * 18.0 - vec3(u_time * 0.35), 2);
    float spots = smoothstep(0.67, 0.78, fbm(nRot * 3.4 + vec3(u_seed * 0.1), 2));

    float mu = max(0.0, dot(n, -rd));
    float limbDarkening = pow(mu, 0.42);

    vec3 photoCol = u_starColor * (0.76 + 0.65 * gran + 0.38 * fineGran);
    photoCol = mix(photoCol * 0.24, photoCol, 1.0 - spots * 0.78);
    photoCol += u_starColor * 1.55 * pow(1.0 - mu, 3.0) * 0.52;
    photoCol *= (0.35 + 0.85 * limbDarkening);
    photoCol += vec3(1.0, 0.98, 0.94) * pow(gran, 3.0) * 0.58;

    col = photoCol * (1.0 + u_superflare * 1.25);
    alpha = 1.0;
  } else {
    vec3 pClosest = ro + rd * max(0.0, -b);
    vec3 dir = normalize(pClosest + 1e-5);
    float coronaNoise = ridgeFbm(dir * 5.5 + vec3(u_time * 0.28), 3);
    float distFromLimb = max(0.0, closestDist - starR);
    float corona = exp(-distFromLimb / (starR * (0.52 + u_superflare * 0.65))) * (0.65 + 0.72 * coronaNoise);
    float outerHalo = exp(-distFromLimb / (starR * 2.35)) * 0.42;
    float anamorphic = exp(-abs(aspectUV.y) * 34.0) * exp(-abs(aspectUV.x) * 2.4) * 0.35 * scaleFactor;

    col += u_starColor * (corona * 1.42 + outerHalo + anamorphic) * (1.0 + u_superflare * 1.5);
    alpha = clamp(corona + outerHalo * 0.52 + anamorphic, 0.0, 1.0);
  }

  if (u_isBinary > 0.5 && scaleFactor > 0.3) {
    float compAngle = u_time * 0.42;
    vec3 compPos = vec3(cos(compAngle) * starR * 2.65, sin(compAngle * 0.5) * starR * 0.32, sin(compAngle) * starR * 2.65);
    vec3 roComp = ro - compPos;
    float bC = dot(roComp, rd);
    float cC = dot(roComp, roComp);
    float dC = sqrt(max(0.0, cC - bC * bC));
    float compR = starR * 0.42;
    float compGlow = exp(-max(0.0, dC - compR * 0.5) / (compR * 1.05));
    if (-bC > 0.0) {
      col += u_companionColor * compGlow * 1.5;
      alpha = max(alpha, clamp(compGlow, 0.0, 1.0));
    }
  }

  return vec4(col, alpha);
}

// --- SCALE 5: ULTRA-FAST 3D PLANETARY GLOBE WITH LIGHTING MODES & MOLTEN COLLISION HEATING ---
float getPlanetElevation(vec3 n) {
  vec3 seedShift = vec3(mod(u_planetSeed, 73.0) * 0.17, mod(u_planetSeed, 41.0) * 0.23, mod(u_planetSeed, 89.0) * 0.11);
  if (u_planetArchetype == 5 || u_planetArchetype == 6) {
    float jetWarp = fbm(n * 3.8 + seedShift, 3);
    float bands = sin(n.y * 18.0 + jetWarp * 3.6) * 0.5 + 0.5;
    float greatSpot = exp(-length(n - normalize(vec3(0.55, -0.28, 0.78))) * 6.5) * 0.85;
    float eddies = smoothstep(0.64, 0.92, fbm(vec3(n.x * 3.2, n.y * 7.0, n.z * 3.2) + seedShift, 3));
    return clamp(mix(bands, 1.0, eddies * 0.55) + greatSpot * 0.35, 0.0, 1.0);
  }
  int oct = u_qualityLevel == 0 ? 3 : 4;
  float continents = fbm(n * 2.35 + seedShift, oct);
  float mountains = ridgeFbm(n * 6.5 + seedShift, oct - 1) * u_terrainRoughness;
  float elev = continents * 0.70 + mountains * 0.30;

  if (u_pressureAtm < 0.35 || u_planetArchetype == 8 || u_planetArchetype == 4) {
    elev += fastCraters(n * 6.5 + seedShift) * 0.25 + fastCraters(n * 14.0 + seedShift) * 0.11;
  }
  return elev;
}

vec4 renderPlanetaryGlobe(vec3 ro, vec3 rd) {
  vec3 col = vec3(0.0);
  float alpha = 0.0;
  float planetR = 1.05;
  float atmoR = planetR * (1.08 + clamp(u_pressureAtm * 0.016, 0.02, 0.10));

  // Universe Sandbox Lighting Mode: 0 = Realistic Star, 1 = Studio Soft Fill, 2 = Camera Flashlight
  vec3 sunDir = u_lightingMode == 2
    ? normalize(ro)
    : normalize(vec3(0.82, 0.26, 0.50));

  float b = dot(ro, rd);
  float c = dot(ro, ro);
  float closestDist = sqrt(max(0.0, c - b * b));

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
          float bands = sin(normR * 46.0) * 0.30 + sin(normR * 130.0) * 0.18 + 0.58;
          float cassiniGap = smoothstep(0.028, 0.075, abs(normR - 0.62)) * smoothstep(0.012, 0.035, abs(normR - 0.28));
          float edgeFade = smoothstep(0.0, 0.08, normR) * smoothstep(1.0, 0.88, normR);

          float shadow = 1.0;
          float bShadow = dot(pRing, sunDir);
          if (bShadow < 0.0 && u_lightingMode == 0) {
            float dShadow = length(pRing - sunDir * bShadow);
            shadow = smoothstep(planetR * 0.94, planetR * 1.04, dShadow);
          }

          ringAlpha = clamp(bands * cassiniGap * edgeFade * 0.82, 0.0, 0.94);
          ringAccum = mix(u_colLowland, u_colPeak, bands) * mix(vec3(1.0), u_starColor, 0.28) * (0.14 + 0.86 * shadow);
        }
      }
    }
  }

  float disc = b * b - (c - planetR * planetR);
  float tPlanet = 1e9;
  if (disc > 0.0 && -b > 0.0) {
    tPlanet = -b - sqrt(disc);
    vec3 hitPos = ro + rd * tPlanet;
    vec3 nSphere = normalize(hitPos);

    float rot = u_isTidallyLocked > 0.5 ? 0.0 : (u_time * 0.085);
    vec3 nRot = vec3(
      nSphere.x * cos(rot) - nSphere.z * sin(rot),
      nSphere.y,
      nSphere.x * sin(rot) + nSphere.z * cos(rot)
    );

    float elev = getPlanetElevation(nRot);
    float eps = 0.008;
    float ex = getPlanetElevation(normalize(nRot + vec3(eps, 0.0, 0.0))) - elev;
    float ey = getPlanetElevation(normalize(nRot + vec3(0.0, eps, 0.0))) - elev;
    float ez = getPlanetElevation(normalize(nRot + vec3(0.0, 0.0, eps))) - elev;
    vec3 bumpGrad = vec3(ex, ey, ez) / eps;

    float isOcean = (u_planetArchetype != 5 && u_planetArchetype != 6 && elev < u_oceanCoverage) ? 1.0 : 0.0;
    float bumpStrength = isOcean > 0.5 ? 0.012 : (0.16 * u_terrainRoughness);
    vec3 nSurface = normalize(nSphere - bumpGrad * bumpStrength);

    float ndotl = dot(nSurface, sunDir);
    float rawSun = dot(nSphere, sunDir);
    float ambientFloor = u_lightingMode == 1 ? 0.36 : 0.025;
    float dayMask = smoothstep(-0.12, 0.22, ndotl);
    float diffuse = max(ambientFloor, smoothstep(-0.08, 0.96, ndotl));

    vec3 surfCol;
    float specStrength = 0.08;

    if (u_planetArchetype == 5 || u_planetArchetype == 6) {
      surfCol = mix(u_colDeepOcean, u_colLowland, elev);
      surfCol = mix(surfCol, u_colHighland, sin(elev * 13.0) * 0.5 + 0.5);
      specStrength = 0.14;
    } else if (isOcean > 0.5) {
      float depth = clamp(elev / max(0.01, u_oceanCoverage), 0.0, 1.0);
      surfCol = mix(u_colDeepOcean, u_colShallowOcean, pow(depth, 1.65));
      specStrength = (u_planetArchetype == 2) ? 0.25 : 0.92;
    } else {
      float landH = clamp((elev - u_oceanCoverage) / max(0.01, 1.0 - u_oceanCoverage), 0.0, 1.0);
      surfCol = mix(u_colLowland, u_colHighland, smoothstep(0.14, 0.70, landH));
      surfCol = mix(surfCol, u_colPeak, smoothstep(0.66, 0.94, landH));

      if (u_bioComplexity > 0.1) {
        float bioClimaticZone = u_isTidallyLocked > 0.5
          ? exp(-pow((rawSun - 0.18) * 2.6, 2.0))
          : smoothstep(0.15, 0.75, 1.0 - abs(nRot.y));
        float bioZone = smoothstep(0.02, 0.45, landH) * smoothstep(0.84, 0.35, landH) * bioClimaticZone;
        surfCol = mix(surfCol, u_colFoliage, bioZone * u_bioComplexity * 0.90);
      }
      specStrength = 0.08;
    }

    if (u_planetArchetype != 5 && u_planetArchetype != 6) {
      float iceMask = 0.0;
      if (u_isTidallyLocked > 0.5) {
        iceMask = smoothstep(0.12, -0.22, rawSun + (elev - 0.5) * 0.18);
      } else if (u_iceCoverage > 0.01) {
        float poleLat = abs(nRot.y) + (elev - 0.5) * 0.18;
        iceMask = smoothstep(1.02 - u_iceCoverage * 0.85, 1.06 - u_iceCoverage * 0.85, poleLat);
      }
      surfCol = mix(surfCol, vec3(0.92, 0.96, 1.0), iceMask);
      specStrength = mix(specStrength, 0.45, iceMask);
    }

    vec3 halfVec = normalize(sunDir - rd);
    float spec = pow(max(0.0, dot(nSurface, halfVec)), isOcean > 0.5 ? 56.0 : 18.0) * specStrength * dayMask;
    vec3 sunTint = mix(vec3(1.0), u_starColor, 0.35);

    float sunsetBand = exp(-pow((rawSun + 0.02) * 5.8, 2.0)) * clamp(pow(u_pressureAtm, 0.3), 0.0, 1.1);
    vec3 terminatorWarmth = vec3(1.0, 0.42, 0.16) * sunsetBand * 0.32;

    vec3 litCol = surfCol * (diffuse * sunTint + terminatorWarmth) + sunTint * spec * 0.82;

    // Dynamic Volumetric Cloud Layer + Cast Cloud Shadows
    if (u_cloudCoverage > 0.02 && u_planetArchetype != 5 && u_planetArchetype != 6) {
      float cloudRot = u_time * 0.13;
      vec3 nCloud = vec3(
        nSphere.x * cos(cloudRot) - nSphere.z * sin(cloudRot),
        nSphere.y,
        nSphere.x * sin(cloudRot) + nSphere.z * cos(cloudRot)
      );
      float swirl = fbm(nCloud * 3.4 + vec3(0.0, u_time * 0.02, 0.0), 3);
      float clouds = fbm(nCloud * 4.8 + vec3(swirl * 1.5), 4);
      float cloudMask = smoothstep(0.92 - u_cloudCoverage * 0.58, 0.98, clouds);

      float shadowClouds = fbm((nCloud - sunDir * 0.032) * 4.8 + vec3(swirl * 1.5), 3);
      float shadowMask = smoothstep(0.92 - u_cloudCoverage * 0.58, 0.98, shadowClouds);
      litCol *= (1.0 - shadowMask * 0.42 * dayMask);

      vec3 cloudLight = mix(u_colAtmo * 0.22, vec3(0.98, 0.99, 1.0) * sunTint + terminatorWarmth * 1.3, max(ambientFloor, smoothstep(-0.15, 0.85, rawSun)));
      litCol = mix(litCol, cloudLight, cloudMask * 0.88);
    }

    // Real-Time Molten Crust Glow from Collisions or Thermal Heating Laser!
    if (u_moltenHeat > 0.02 || u_laserActive > 0.5) {
      float cracks = pow(ridgeFbm(nRot * 8.0 + vec3(u_time * 0.04), 3), 2.2);
      float heatVal = clamp(u_moltenHeat + u_laserActive * 0.35, 0.0, 1.0);
      vec3 magmaCol = mix(vec3(0.98, 0.24, 0.04), vec3(1.0, 0.92, 0.55), clamp(cracks * heatVal * 1.5, 0.0, 1.0));
      litCol = mix(litCol, magmaCol * 1.65, smoothstep(0.65 - heatVal * 0.55, 0.95, cracks) * heatVal);
      if (u_laserActive > 0.5) {
        float spot = exp(-length(nSphere - normalize(ro)) * 7.5);
        litCol += vec3(1.0, 0.95, 0.82) * spot * 3.2;
      }
    }

    // Night-Side Emissive Features
    float nightMask = smoothstep(0.14, -0.22, rawSun);
    if (nightMask > 0.01) {
      if (u_volcanism > 0.35 || u_planetArchetype == 2) {
        float lavaRift = pow(ridgeFbm(nRot * 7.8 + vec3(u_time * 0.05), 3), 3.2);
        float lavaThreshold = u_planetArchetype == 2 ? 0.16 : (0.55 - u_volcanism * 0.28);
        float lavaGlow = smoothstep(lavaThreshold, lavaThreshold + 0.25, lavaRift);
        litCol += vec3(1.0, 0.38, 0.06) * lavaGlow * (u_planetArchetype == 2 ? 1.35 : nightMask * 0.95);
      }

      if (u_cityLights > 0.05 && isOcean < 0.5) {
        float urbanCluster = fbm(nRot * 6.8, 3);
        float roadGrid = ridgeFbm(nRot * 28.0, 2);
        float coastalBonus = smoothstep(u_oceanCoverage + 0.26, u_oceanCoverage + 0.01, elev);
        float cityMask = smoothstep(0.46, 0.74, urbanCluster + coastalBonus * 0.26) * smoothstep(0.44, 0.80, roadGrid);
        float latValid = smoothstep(0.85, 0.42, abs(nRot.y));
        vec3 cityColor = mix(vec3(1.0, 0.74, 0.28), vec3(0.45, 0.90, 1.0), smoothstep(0.65, 0.94, roadGrid));
        litCol += cityColor * cityMask * latValid * nightMask * u_cityLights * 1.75;
      }

      if (u_bioComplexity > 0.55 && abs(elev - u_oceanCoverage) < 0.048) {
        float bioPulse = 0.65 + 0.35 * sin(u_time * 2.2 + nRot.x * 12.0);
        litCol += vec3(0.14, 0.96, 0.78) * nightMask * u_bioComplexity * bioPulse * 0.48;
      }
    }

    float auroraLat = smoothstep(0.68, 0.88, abs(nRot.y)) * smoothstep(0.98, 0.88, abs(nRot.y));
    if (auroraLat > 0.01 && u_pressureAtm > 0.02) {
      float curtain = sin(nRot.x * 26.0 + fbm(nRot * 8.0 + u_time * 0.55, 2) * 8.5) * 0.5 + 0.5;
      float auroraStrength = (0.30 + u_superflare * 1.55) * auroraLat * pow(curtain, 2.0);
      vec3 auroraCol = mix(vec3(0.16, 0.96, 0.62), vec3(0.32, 0.78, 1.0), curtain);
      litCol += auroraCol * auroraStrength * (0.35 + 0.65 * nightMask);
    }

    float fresnel = pow(1.0 - max(0.0, dot(nSphere, -rd)), 3.1);
    float atmoDensity = clamp(pow(u_pressureAtm, 0.35), 0.05, 1.38);
    float terminatorScatter = smoothstep(-0.35, 0.45, rawSun);
    vec3 rayleighRim = mix(u_colAtmo * vec3(1.35, 0.62, 0.32), u_colAtmo, smoothstep(-0.08, 0.38, rawSun));
    litCol += rayleighRim * fresnel * terminatorScatter * atmoDensity * 0.92;

    if (u_impactFlash > 0.01) {
      float impDist = length(nSphere - normalize(vec3(0.3, 0.2, 0.9)));
      float shockRing = exp(-abs(impDist - (1.0 - u_impactFlash) * 1.25) * 18.0);
      litCol += vec3(1.0, 0.55, 0.14) * (exp(-impDist * 4.5) + shockRing * 1.6) * u_impactFlash * 2.1;
    }
    if (u_evoPulse > 0.01) {
      float wave = exp(-abs(nSphere.y - (1.0 - u_evoPulse * 2.0)) * 8.0);
      litCol += vec3(0.20, 0.98, 0.74) * wave * u_evoPulse * 1.3;
    }

    col = litCol;
    alpha = 1.0;
  }

  if (closestDist >= planetR * 0.98 && closestDist < atmoR * 1.20 && -b > 0.0 && u_pressureAtm > 0.005) {
    vec3 pLimb = normalize(ro + rd * max(0.0, -b));
    float sunAlign = smoothstep(-0.35, 0.65, dot(pLimb, sunDir));
    float limbFactor = exp(-(closestDist - planetR) / max(0.015, (atmoR - planetR) * 0.50));
    float atmoWeight = clamp(pow(u_pressureAtm, 0.3), 0.1, 1.25);
    vec3 haloCol = u_colAtmo * limbFactor * (0.25 + 0.98 * sunAlign) * atmoWeight;
    col += haloCol * (1.0 - alpha * 0.28);
    alpha = max(alpha, clamp(limbFactor * atmoWeight * 0.88, 0.0, 1.0));
  }

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

// --- SCALE 6 & 7: OPTIMIZED 3D PLANETARY SURFACE RAYMARCHER ---
float getSurfaceTerrainHeight(vec2 xz) {
  vec2 seedShift = vec2(mod(u_planetSeed, 53.0) * 1.7, mod(u_planetSeed, 79.0) * 2.3);
  vec3 p = vec3(xz * 0.20 + seedShift, u_planetSeed * 0.05);
  int oct = u_qualityLevel == 0 ? 3 : 4;
  float base = fbm(p, oct);
  float ridges = ridgeFbm(p * 1.9, oct - 1) * u_terrainRoughness;
  return (base * 0.62 + ridges * 0.58) * 2.55 - 0.88;
}

vec4 renderPlanetarySurface(vec2 uv) {
  float yaw = u_cameraAngles.x * 0.72;
  float pitch = clamp(u_cameraAngles.y * 0.38 + 0.08, -0.28, 0.50);
  float cy = cos(yaw), sy = sin(yaw);
  float cp = cos(pitch), sp = sin(pitch);
  vec3 fwd = vec3(sy * cp, sp, cy * cp);
  vec3 right = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(right, fwd);
  vec3 rd = normalize(right * uv.x + up * uv.y - fwd * 1.35);

  vec3 ro = vec3(u_surfaceOffset.x + u_time * 0.14, 1.5, u_surfaceOffset.y + u_time * 0.22);
  float groundUnderCam = getSurfaceTerrainHeight(ro.xz);
  float waterLevel = (u_oceanCoverage - 0.42) * 1.1;
  ro.y = max(groundUnderCam, waterLevel) + 1.18;

  float dayCycle = u_isTidallyLocked > 0.5 ? 0.36 : (u_time * 0.065 + 0.62);
  vec3 sunDir = normalize(vec3(cos(dayCycle) * 0.65, max(0.08, sin(dayCycle) * 0.52 + 0.22), 0.62));
  float sunElevation = clamp(sunDir.y, 0.0, 1.0);

  float atmoThick = clamp(pow(u_pressureAtm, 0.35), 0.02, 1.6);
  vec3 spaceSky = renderDeepStarfield(rd, uv) * (1.0 - clamp(atmoThick * sunElevation * 0.88, 0.0, 0.94));
  vec3 zenithCol = u_colAtmo * (0.24 + 0.88 * sunElevation) * clamp(atmoThick, 0.05, 1.25);
  vec3 horizonCol = mix(u_colAtmo * 1.28, u_starColor * vec3(1.0, 0.62, 0.38), 1.0 - sunElevation * 0.62) * clamp(atmoThick, 0.08, 1.38);

  float horizonGrad = pow(1.0 - max(0.0, rd.y), 3.1);
  vec3 skyCol = spaceSky + mix(zenithCol, horizonCol, horizonGrad);

  float sunCos = max(0.0, dot(rd, sunDir));
  float sunDisk = smoothstep(0.9980, 0.9994, sunCos);
  float mieScatter = pow(sunCos, 10.0) * 0.48 * clamp(atmoThick, 0.1, 1.45) + pow(sunCos, 64.0) * 0.82;
  skyCol += u_starColor * (sunDisk * 3.8 + mieScatter);

  vec3 moonDir = normalize(vec3(-0.48, 0.38, 0.78));
  float moonCos = dot(rd, moonDir);
  if (moonCos > 0.9945 && rd.y > 0.05) {
    float mEdge = smoothstep(0.9945, 0.9952, moonCos);
    float mCrescent = smoothstep(-0.02, 0.04, dot(rd - moonDir, sunDir));
    skyCol = mix(skyCol, vec3(0.86, 0.88, 0.94) * (0.18 + 0.82 * mCrescent), mEdge * 0.82);
  }

  if (u_hasRings > 0.5 && rd.y > 0.0) {
    float ringArc = abs(rd.y * 0.75 - abs(rd.x) * 0.42 - 0.28);
    if (ringArc < 0.095) {
      float rBand = sin(ringArc * 260.0) * 0.38 + 0.62;
      float rMask = smoothstep(0.095, 0.01, ringArc);
      skyCol = mix(skyCol, u_colPeak * 0.9, rMask * rBand * 0.58);
    }
  }

  if (u_cloudCoverage > 0.05 && rd.y > 0.03) {
    vec2 skyUV = rd.xz / (rd.y + 0.17) * 1.65 + vec2(u_time * 0.038, 0.0);
    float cNoise = fbm(vec3(skyUV, u_time * 0.018), 4);
    float cMask = smoothstep(0.88 - u_cloudCoverage * 0.48, 0.96, cNoise) * smoothstep(0.03, 0.22, rd.y);
    vec3 cCol = mix(horizonCol, vec3(0.98, 0.98, 1.0) * mix(vec3(1.0), u_starColor, 0.32), 0.68);
    skyCol = mix(skyCol, cCol, cMask * 0.84);
  }

  vec3 finalCol = skyCol;
  int maxSteps = u_qualityLevel == 0 ? 40 : (u_qualityLevel == 1 ? 54 : 68);
  float t = 0.22;
  float maxT = 26.0;
  bool hitTerrain = false;
  vec3 hitPos = vec3(0.0);

  for (int i = 0; i < 68; i++) {
    if (i >= maxSteps) break;
    vec3 p = ro + rd * t;
    float h = getSurfaceTerrainHeight(p.xz);
    if (u_oceanCoverage > 0.05) h = max(h, waterLevel);
    float diff = p.y - h;
    if (diff < 0.009 * t) {
      hitTerrain = true;
      hitPos = p;
      break;
    }
    t += max(0.055, diff * 0.54);
    if (t > maxT) break;
  }

  if (hitTerrain) {
    float rawH = getSurfaceTerrainHeight(hitPos.xz);
    bool isWaterSurface = (u_oceanCoverage > 0.05) && (rawH <= waterLevel + 0.015);
    vec3 matCol;

    if (isWaterSurface) {
      vec2 wuv = hitPos.xz * 3.6 + vec2(u_time * 0.55, u_time * 0.38);
      float w1 = noise3(vec3(wuv, u_time * 0.75));
      float w2 = noise3(vec3(wuv * 2.4 - u_time * 0.85, u_time * 0.45));
      vec3 n = normalize(vec3((w1 - 0.5) * 0.14, 1.0, (w2 - 0.5) * 0.14));

      vec3 reflDir = reflect(rd, n);
      reflDir.y = abs(reflDir.y);
      float fresnel = clamp(0.14 + 0.86 * pow(1.0 - max(0.0, dot(-rd, n)), 4.0), 0.0, 1.0);
      vec3 waterDeep = (u_planetArchetype == 2) ? vec3(0.98, 0.32, 0.05) : u_colDeepOcean;
      vec3 waterShallow = (u_planetArchetype == 2) ? vec3(1.0, 0.65, 0.12) : u_colShallowOcean;
      float shoreDepth = clamp((waterLevel - rawH) * 2.5, 0.0, 1.0);
      vec3 baseWater = mix(waterShallow, waterDeep, shoreDepth);

      float sunGlint = pow(max(0.0, dot(reflDir, sunDir)), 104.0) * 2.6;
      matCol = mix(baseWater * (0.35 + 0.65 * sunElevation), skyCol, fresnel * 0.80) + u_starColor * sunGlint;
    } else {
      float eps = 0.04;
      float hx = getSurfaceTerrainHeight(hitPos.xz + vec2(eps, 0.0)) - rawH;
      float hz = getSurfaceTerrainHeight(hitPos.xz + vec2(0.0, eps)) - rawH;
      vec3 n = normalize(vec3(-hx, eps, -hz));

      float slope = 1.0 - n.y;
      float normH = clamp((rawH - waterLevel) / 1.85, 0.0, 1.0);

      matCol = mix(u_colLowland, u_colHighland, smoothstep(0.14, 0.68, normH + slope * 0.36));
      matCol = mix(matCol, u_colPeak, smoothstep(0.65, 0.92, normH));

      if (u_bioComplexity > 0.1) {
        float floraMask = smoothstep(0.45, 0.08, slope) * smoothstep(0.74, 0.12, normH);
        float detailFlora = noise3(vec3(hitPos.xz * 4.8, 1.0));
        matCol = mix(matCol, u_colFoliage * (0.68 + 0.65 * detailFlora), floraMask * u_bioComplexity * 0.92);
        if (detailFlora > 0.72) {
          matCol += vec3(0.16, 0.96, 0.74) * smoothstep(0.72, 0.92, detailFlora) * u_bioComplexity * 0.50;
        }
      }

      if (u_iceCoverage > 0.05) {
        float snowLine = 1.05 - u_iceCoverage * 0.95;
        float snowMask = smoothstep(snowLine - 0.15, snowLine + 0.12, normH) * smoothstep(0.55, 0.2, slope);
        matCol = mix(matCol, vec3(0.92, 0.96, 1.0), snowMask);
      }

      if (u_cityLights > 0.08 && slope < 0.28 && normH < 0.45) {
        vec2 grid = abs(fract(hitPos.xz * 2.2) - 0.5);
        float structMask = smoothstep(0.06, 0.01, min(grid.x, grid.y)) * smoothstep(0.56, 0.78, noise3(vec3(hitPos.xz * 0.8, 2.0)));
        matCol += vec3(1.0, 0.78, 0.36) * structMask * u_cityLights * 1.5;
      }

      float diff = max(0.08, dot(n, sunDir));
      vec3 amb = horizonCol * 0.36 + vec3(0.06, 0.08, 0.12);
      matCol = matCol * (diff * mix(vec3(1.0), u_starColor, 0.35) + amb);
    }

    float fogFactor = 1.0 - exp(-t * (0.040 + clamp(atmoThick, 0.0, 1.0) * 0.036));
    finalCol = mix(matCol, horizonCol, clamp(fogFactor, 0.0, 0.95));
  }

  return vec4(finalCol, 1.0);
}

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

  // CPU-precomputed 6-DOF Orthonormal Camera Ray (with Roll, Pan, Yaw & Pitch!)
  vec3 ro = u_camOrigin;
  vec3 rd = normalize(u_camRight * aspectUV.x + u_camUp * aspectUV.y + u_camForward * 1.55);

  vec3 finalColor = renderDeepStarfield(rd, aspectUV);

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
    float starSizeFactor = mix(1.06, 0.54, smoothstep(11.5, 17.5, s));
    vec4 stCol = renderStar(ro, rd, starSizeFactor, aspectUV);
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

  float vig = 1.0 - dot(v_uv - 0.5, v_uv - 0.5) * 0.34;
  finalColor = acesToneMap(finalColor * vig * 1.10);
  finalColor = pow(finalColor, vec3(0.95));

  fragColor = vec4(finalColor, 1.0);
}
`;
