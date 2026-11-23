/**
 * PARALLAX v3.0 — Ultra-Optimized WebGL2 Renderer, 6-DOF Universe Sandbox Camera & Live N-Body Visualizer
 * Features:
 * - Dynamic Adaptive Resolution Scaling (DRS) + Quality Levels (Auto / Performance / Balanced / Ultra)
 * - Exact Universe Sandbox 2 Camera: Left-Drag Orbit, Right/Mid-Drag Pan, WASD/RF 6-DOF Fly,
 *   Q/E Roll, Arrow Keys, C to Land/Liftoff, Scroll/Pinch Continuous Logarithmic Zoom
 * - Interactive Sandbox Tools: Add/Launch with Live Orbit Preview, Heating Laser Beam, Explode/Supernova
 * - Live N-Body Gravity Trails, Molten Impact Debris, Expanding Shockwaves & F10 Photo Capture
 */

import { VERTEX_SHADER_SOURCE, FRAGMENT_SHADER_SOURCE } from './shaders.js';
import { solveKeplerOrbit } from '../math/prng.js';

export class UniverseRenderer {
  constructor(webglCanvas, overlayCanvas, engine) {
    this.webglCanvas = webglCanvas;
    this.overlayCanvas = overlayCanvas;
    this.ctx = overlayCanvas.getContext('2d');
    this.engine = engine;

    // 6-DOF Universe Sandbox Camera State
    this.yaw = 0.45;
    this.pitch = 0.28;
    this.roll = 0.0;
    this.targetYaw = 0.45;
    this.targetPitch = 0.28;
    this.targetRoll = 0.0;
    this.panOffset = { x: 0, y: 0, z: 0 };
    this.targetPan = { x: 0, y: 0, z: 0 };
    this.cameraZoom = 1.0;
    this.surfaceOffset = { x: 0, z: 0 };
    this.keysPressed = new Set();

    // CPU-precomputed Orthonormal Basis (shared identically by WebGL2 shader & 3D vector overlay!)
    this.camRight = [1, 0, 0];
    this.camUp = [0, 1, 0];
    this.camForward = [0, 0, -1];
    this.camOrigin = [0, 0, 3.35];

    // Pointer, Multi-Touch Pinch & Sandbox Tool State
    this.isDragging = false;
    this.isPanning = false;
    this.dragMoved = false;
    this.lastPointer = { x: 0, y: 0 };
    this.hoverPointer = { x: -1000, y: -1000 };
    this.activePointers = new Map();
    this.lastPinchDist = null;
    this.interactiveTargets = [];
    this.hoveredTarget = null;

    // Performance & Adaptive Resolution Scaling (DRS)
    this.fps = 60;
    this.shaderScale = window.innerWidth <= 860 ? 0.72 : 1.0;
    this.qualityLevel = window.innerWidth <= 860 ? 0 : 1;
    this._frameCount = 0;
    this._fpsTimer = performance.now();

    this.gl = null;
    this.program = null;
    this.uniforms = {};

    this.initWebGL();
    this.bindInteractionEvents();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  initWebGL() {
    const gl = this.webglCanvas.getContext('webgl2', {
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: true, // Enables crisp F10 Photo Tool capture!
      powerPreference: 'high-performance'
    });

    if (!gl) {
      console.warn('WebGL2 unavailable; running astrographic 2D renderer.');
      return;
    }

    this.gl = gl;
    const vs = this.compileShader(gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
    if (!vs || !fs) return;

    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('WebGL2 program link error:', gl.getProgramInfoLog(prog));
      return;
    }

    this.program = prog;
    gl.useProgram(prog);

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.vao = vao;

    const uniformNames = [
      'u_resolution', 'u_time', 'u_logScale',
      'u_camRight', 'u_camUp', 'u_camForward', 'u_camOrigin',
      'u_cameraAngles', 'u_surfaceOffset', 'u_warpFactor', 'u_seed',
      'u_qualityLevel', 'u_lightingMode',
      'u_starColor', 'u_starTempK', 'u_starRadiusNorm', 'u_remnantType', 'u_hasNebulaHalo',
      'u_isBinary', 'u_companionColor',
      'u_galaxyFamily', 'u_galaxyArms', 'u_galaxyTwist', 'u_galaxyBar', 'u_agnActive', 'u_nebulaColor',
      'u_planetArchetype', 'u_colDeepOcean', 'u_colShallowOcean', 'u_colLowland',
      'u_colHighland', 'u_colPeak', 'u_colAtmo', 'u_colFoliage',
      'u_oceanCoverage', 'u_iceCoverage', 'u_cloudCoverage', 'u_terrainRoughness',
      'u_volcanism', 'u_pressureAtm', 'u_bioComplexity', 'u_cityLights', 'u_isTidallyLocked',
      'u_moltenHeat', 'u_hasRings', 'u_ringInner', 'u_ringOuter', 'u_planetSeed',
      'u_superflare', 'u_impactFlash', 'u_evoPulse', 'u_laserActive'
    ];
    for (const name of uniformNames) {
      this.uniforms[name] = gl.getUniformLocation(prog, name);
    }
  }

  compileShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('GLSL compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.dpr = dpr;
    this.width = w;
    this.height = h;

    this.applyShaderResolution();
    this.overlayCanvas.width = Math.floor(w * dpr);
    this.overlayCanvas.height = Math.floor(h * dpr);
  }

  applyShaderResolution() {
    const targetW = Math.max(320, Math.floor(this.width * this.shaderScale));
    const targetH = Math.max(200, Math.floor(this.height * this.shaderScale));
    if (this.webglCanvas.width !== targetW || this.webglCanvas.height !== targetH) {
      this.webglCanvas.width = targetW;
      this.webglCanvas.height = targetH;
    }
  }

  setQualityMode(mode) {
    this.engine.qualityMode = mode;
    if (mode === 'low') {
      this.qualityLevel = 0;
      this.shaderScale = 0.65;
    } else if (mode === 'medium') {
      this.qualityLevel = 1;
      this.shaderScale = 0.92;
    } else if (mode === 'ultra') {
      this.qualityLevel = 2;
      this.shaderScale = Math.min(window.devicePixelRatio || 1, 1.35);
    }
    this.applyShaderResolution();
  }

  resetCameraFocus() {
    this.targetPan = { x: 0, y: 0, z: 0 };
    this.targetRoll = 0.0;
  }

  bindInteractionEvents() {
    const el = this.overlayCanvas;
    el.style.touchAction = 'none';
    el.addEventListener('contextmenu', (e) => e.preventDefault());

    el.addEventListener('pointerdown', (e) => {
      this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      // Heating Laser Tool: hold left button to fire plasma beam!
      if (e.button === 0 && this.engine.sandboxTool === 'laser') {
        this.engine.laserActive = true;
        this.hoverPointer = { x: e.clientX, y: e.clientY };
        el.setPointerCapture(e.pointerId);
        return;
      }

      if (this.activePointers.size === 1) {
        if (e.button === 2 || e.button === 1) {
          this.isPanning = true;
        } else {
          this.isDragging = true;
        }
        this.dragMoved = false;
        this.lastPointer = { x: e.clientX, y: e.clientY };
      } else if (this.activePointers.size === 2) {
        this.isDragging = false;
        this.isPanning = false;
        this.dragMoved = true;
        const pts = Array.from(this.activePointers.values());
        this.lastPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      }
      el.setPointerCapture(e.pointerId);
    });

    el.addEventListener('pointermove', (e) => {
      this.hoverPointer = { x: e.clientX, y: e.clientY };
      if (this.activePointers.has(e.pointerId)) {
        this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }

      if (this.activePointers.size === 2) {
        const pts = Array.from(this.activePointers.values());
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (this.lastPinchDist !== null) {
          const delta = (this.lastPinchDist - dist) * 0.025;
          this.engine.setTargetLogScale(this.engine.targetLogScale + delta);
        }
        this.lastPinchDist = dist;
        return;
      }

      if (!this.isDragging && !this.isPanning) return;
      const dx = e.clientX - this.lastPointer.x;
      const dy = e.clientY - this.lastPointer.y;
      if (Math.hypot(dx, dy) > 4) this.dragMoved = true;

      if (this.isPanning) {
        // Right/Middle drag pans camera freely in 3D space!
        const panSpeed = 0.0055;
        this.targetPan.x -= (this.camRight[0] * dx - this.camUp[0] * dy) * panSpeed;
        this.targetPan.y -= (this.camRight[1] * dx - this.camUp[1] * dy) * panSpeed;
        this.targetPan.z -= (this.camRight[2] * dx - this.camUp[2] * dy) * panSpeed;
      } else if (this.isDragging) {
        this.targetYaw -= dx * 0.0065;
        this.targetPitch = Math.max(-1.42, Math.min(1.42, this.targetPitch + dy * 0.0065));
      }
      this.lastPointer = { x: e.clientX, y: e.clientY };
    });

    const releasePointer = (e) => {
      if (this.engine.laserActive) {
        this.engine.laserActive = false;
      }
      const wasSingleClick = this.activePointers.size === 1 && this.isDragging && !this.dragMoved;
      this.activePointers.delete(e.pointerId);
      if (this.activePointers.size < 2) {
        this.lastPinchDist = null;
      }
      if (wasSingleClick) {
        this.handleSpatialClick(e.clientX, e.clientY);
      }
      if (this.activePointers.size === 0) {
        this.isDragging = false;
        this.isPanning = false;
      }
    };

    el.addEventListener('pointerup', releasePointer);
    el.addEventListener('pointercancel', releasePointer);

    el.addEventListener('dblclick', (e) => {
      this.resetCameraFocus();
      this.handleSpatialClick(e.clientX, e.clientY, true);
    });

    el.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const delta = e.deltaY * 0.0030;
        this.engine.setTargetLogScale(this.engine.targetLogScale + delta);
      },
      { passive: false }
    );

    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      this.keysPressed.add(e.key.toLowerCase());
    });
    window.addEventListener('keyup', (e) => {
      this.keysPressed.delete(e.key.toLowerCase());
    });
  }

  /**
   * Unproject a 2D screen click onto the 3D ecliptic plane (y = 0) for Universe Sandbox Add/Launch placement!
   */
  unprojectToEcliptic(clientX, clientY) {
    const aspect = this.width / Math.max(1, this.height);
    const uvX = ((clientX / this.width) * 2.0 - 1.0) * aspect;
    const uvY = -((clientY / this.height) * 2.0 - 1.0);

    const dx = this.camRight[0] * uvX + this.camUp[0] * uvY + this.camForward[0] * 1.55;
    const dy = this.camRight[1] * uvX + this.camUp[1] * uvY + this.camForward[1] * 1.55;
    const dz = this.camRight[2] * uvX + this.camUp[2] * uvY + this.camForward[2] * 1.55;
    const len = Math.hypot(dx, dy, dz) || 1;
    const rd = [dx / len, dy / len, dz / len];

    // Intersect plane y = 0
    if (Math.abs(rd[1]) < 0.01) {
      return { point3D: [this.camOrigin[0] + rd[0] * 2.5, 0, this.camOrigin[2] + rd[2] * 2.5], rayDir: rd };
    }
    const t = -this.camOrigin[1] / rd[1];
    if (t <= 0.1 || t > 18) {
      return { point3D: [this.camOrigin[0] + rd[0] * 2.5, 0, this.camOrigin[2] + rd[2] * 2.5], rayDir: rd };
    }
    return {
      point3D: [
        this.camOrigin[0] + rd[0] * t,
        0,
        this.camOrigin[2] + rd[2] * t
      ],
      rayDir: rd
    };
  }

  handleSpatialClick(clientX, clientY, isDoubleClick = false) {
    const tool = this.engine.sandboxTool;

    // 1. Universe Sandbox ADD / LAUNCH Tool
    if (tool === 'add') {
      const lvl = this.engine.getActiveScaleLevel();
      if (lvl.index !== 3) {
        this.engine.flyToScale(3); // Switch smoothly to Star System orbital view to watch N-Body physics!
      }
      const { point3D, rayDir } = this.unprojectToEcliptic(clientX, clientY);
      const pSys = this.engine.getActivePlanetarySystem();
      const maxAU = pSys.planets.length ? pSys.planets[pSys.planets.length - 1].orbit.a : 10;
      const worldScaleAU = Math.max(2.0, maxAU * 0.55);

      const auPos = this.engine.addMode === 'launch'
        ? [this.camOrigin[0] * worldScaleAU * 0.45, this.camOrigin[1] * worldScaleAU * 0.45, this.camOrigin[2] * worldScaleAU * 0.45]
        : [point3D[0] * worldScaleAU * 0.65, 0, point3D[2] * worldScaleAU * 0.65];

      const spawned = this.engine.nbody.spawnBody(
        this.engine.addPresetId,
        auPos,
        this.engine.addMode,
        rayDir,
        this.engine.launchSpeedKmS
      );
      this.engine.logEvent(
        'astro',
        `Spawned ${spawned.name} (${this.engine.addMode.toUpperCase()})`,
        `Added to live N-Body simulation at ${Math.hypot(auPos[0], auPos[2]).toFixed(2)} AU.`
      );
      this.engine.emitChange('spawn_body');
      return;
    }

    // Find closest interactive 3D body under cursor
    let closest = null;
    let minDist = 34;
    for (const target of this.interactiveTargets) {
      const d = Math.hypot(clientX - target.screenX, clientY - target.screenY);
      if (d < Math.max(minDist, target.hitRadius || 24)) {
        minDist = d;
        closest = target;
      }
    }

    // 2. Universe Sandbox EXPLODE / SUPERNOVA Tool
    if (tool === 'explode') {
      if (closest && closest.nbodyRef) {
        this.engine.explodeTargetBody(closest.nbodyRef);
      } else {
        this.engine.explodeTargetBody();
      }
      return;
    }

    if (!closest) return;

    this.resetCameraFocus();
    if (closest.type === 'supercluster') {
      const same = this.engine.activeSuperclusterIndex === closest.index;
      this.engine.selectSupercluster(closest.index, same || isDoubleClick);
    } else if (closest.type === 'galaxy') {
      const same = this.engine.activeGalaxyIndex === closest.index;
      this.engine.selectGalaxy(closest.index, same || isDoubleClick);
    } else if (closest.type === 'system') {
      const same = this.engine.activeSystemIndex === closest.index;
      this.engine.selectStarSystem(closest.index, same || isDoubleClick);
    } else if (closest.type === 'planet') {
      const same = this.engine.activePlanetIndex === closest.index;
      this.engine.selectPlanet(closest.index, true);
      if ((same || isDoubleClick) && this.engine.currentLogScale < 8.5) {
        this.engine.flyToScale(5);
      }
    } else if (closest.type === 'landmark') {
      this.engine.selectLandmark(closest.index, true);
    } else if (closest.type === 'clade') {
      this.engine.selectClade(closest.index, true);
    }
  }

  /**
   * Compute exact 6-DOF Orthonormal Camera Basis (with Roll, Yaw, Pitch, Pan) ONCE per frame on CPU!
   */
  updateCameraBasis(camDist = 3.35) {
    const cy = Math.cos(this.yaw);
    const sy = Math.sin(this.yaw);
    const cp = Math.cos(this.pitch);
    const sp = Math.sin(this.pitch);

    // Look direction from camera toward origin
    const fwd = [-sy * cp, -sp, -cy * cp];
    // Base right = normalize(cross(fwd, [0, 1, 0]))
    const r0x = -fwd[2];
    const r0z = fwd[0];
    const rLen = Math.hypot(r0x, r0z) || 1;
    const baseRight = [r0x / rLen, 0, r0z / rLen];

    // Base up = cross(baseRight, fwd)
    const baseUp = [
      baseRight[1] * fwd[2] - baseRight[2] * fwd[1],
      baseRight[2] * fwd[0] - baseRight[0] * fwd[2],
      baseRight[0] * fwd[1] - baseRight[1] * fwd[0]
    ];

    // Apply 6-DOF Space Roll (Q / E keys!) around the forward look axis
    const cr = Math.cos(this.roll);
    const sr = Math.sin(this.roll);
    this.camRight = [
      baseRight[0] * cr + baseUp[0] * sr,
      baseRight[1] * cr + baseUp[1] * sr,
      baseRight[2] * cr + baseUp[2] * sr
    ];
    this.camUp = [
      -baseRight[0] * sr + baseUp[0] * cr,
      -baseRight[1] * sr + baseUp[1] * cr,
      -baseRight[2] * sr + baseUp[2] * cr
    ];
    this.camForward = fwd;
    this.camOrigin = [
      -fwd[0] * camDist + this.panOffset.x,
      -fwd[1] * camDist + this.panOffset.y,
      -fwd[2] * camDist + this.panOffset.z
    ];
  }

  /**
   * Project 3D world point using the exact CPU-precomputed 6-DOF Camera Basis!
   */
  project3D(point3D) {
    const relX = point3D[0] - this.camOrigin[0];
    const relY = point3D[1] - this.camOrigin[1];
    const relZ = point3D[2] - this.camOrigin[2];

    const vx = relX * this.camRight[0] + relY * this.camRight[1] + relZ * this.camRight[2];
    const vy = relX * this.camUp[0] + relY * this.camUp[1] + relZ * this.camUp[2];
    const vz = relX * this.camForward[0] + relY * this.camForward[1] + relZ * this.camForward[2];

    if (vz <= 0.15) {
      return { visible: false, x: 0, y: 0, depth: vz, scale: 0 };
    }

    const fov = 1.55;
    const aspect = this.width / Math.max(1, this.height);
    const ndcX = (vx * fov) / (vz * aspect);
    const ndcY = (vy * fov) / vz;

    return {
      visible: true,
      x: (ndcX * 0.5 + 0.5) * this.width,
      y: (-ndcY * 0.5 + 0.5) * this.height,
      depth: vz,
      scale: fov / vz
    };
  }

  /**
   * Capture composite high-resolution PNG screenshot (F10 Photo Tool)
   */
  captureScreenshot() {
    const out = document.createElement('canvas');
    out.width = this.overlayCanvas.width;
    out.height = this.overlayCanvas.height;
    const octx = out.getContext('2d');
    octx.drawImage(this.webglCanvas, 0, 0, out.width, out.height);
    octx.drawImage(this.overlayCanvas, 0, 0, out.width, out.height);
    const link = document.createElement('a');
    link.download = `PARALLAX-${Date.now()}.png`;
    link.href = out.toDataURL('image/png');
    link.click();
  }

  /**
   * Main render loop with Dynamic Adaptive Resolution Scaling (DRS) & 6-DOF Flight
   */
  render(dtSeconds) {
    // 1. Rolling FPS & Dynamic Adaptive Resolution Scaling (locks 60 FPS automatically!)
    this._frameCount++;
    const now = performance.now();
    if (now - this._fpsTimer >= 550) {
      this.fps = Math.round((this._frameCount * 1000) / (now - this._fpsTimer));
      this._frameCount = 0;
      this._fpsTimer = now;

      if (this.engine.qualityMode === 'auto') {
        if (this.fps < 42 && this.shaderScale > 0.55) {
          this.shaderScale = Math.max(0.55, this.shaderScale - 0.12);
          if (this.fps < 32) this.qualityLevel = 0;
          this.applyShaderResolution();
        } else if (this.fps >= 56 && this.shaderScale < Math.min(window.devicePixelRatio || 1, 1.15)) {
          this.shaderScale = Math.min(Math.min(window.devicePixelRatio || 1, 1.15), this.shaderScale + 0.06);
          if (this.fps >= 58 && this.qualityLevel < 1) this.qualityLevel = 1;
          this.applyShaderResolution();
        }
      }
    }

    // 2. Universe Sandbox 2 Exact 6-DOF Keyboard Controls (WASD + RF + QE Roll + Arrow Keys)
    if (this.keysPressed.size > 0) {
      const k = this.keysPressed;
      const isSurface = this.engine.currentLogScale < 4.5;
      const moveSpeed = dtSeconds * (isSurface ? 2.6 : 1.5);

      // W / S: Forward / Backward flight (zooms in/out or flies across surface)
      if (k.has('w')) {
        if (isSurface) {
          this.surfaceOffset.x += Math.sin(this.yaw * 0.72) * moveSpeed * 1.4;
          this.surfaceOffset.z += Math.cos(this.yaw * 0.72) * moveSpeed * 1.4;
        } else {
          this.engine.setTargetLogScale(this.engine.targetLogScale - dtSeconds * 3.4);
        }
      }
      if (k.has('s')) {
        if (isSurface) {
          this.surfaceOffset.x -= Math.sin(this.yaw * 0.72) * moveSpeed * 1.4;
          this.surfaceOffset.z -= Math.cos(this.yaw * 0.72) * moveSpeed * 1.4;
        } else {
          this.engine.setTargetLogScale(this.engine.targetLogScale + dtSeconds * 3.4);
        }
      }
      // A / D: Strafe camera left / right
      if (k.has('a')) {
        if (isSurface) this.targetYaw -= moveSpeed;
        else {
          this.targetPan.x -= this.camRight[0] * moveSpeed;
          this.targetPan.y -= this.camRight[1] * moveSpeed;
          this.targetPan.z -= this.camRight[2] * moveSpeed;
        }
      }
      if (k.has('d')) {
        if (isSurface) this.targetYaw += moveSpeed;
        else {
          this.targetPan.x += this.camRight[0] * moveSpeed;
          this.targetPan.y += this.camRight[1] * moveSpeed;
          this.targetPan.z += this.camRight[2] * moveSpeed;
        }
      }
      // R / F: Move camera up / down vertically (exact Universe Sandbox 2!)
      if (k.has('r')) {
        this.targetPan.x += this.camUp[0] * moveSpeed;
        this.targetPan.y += this.camUp[1] * moveSpeed;
        this.targetPan.z += this.camUp[2] * moveSpeed;
      }
      if (k.has('f')) {
        this.targetPan.x -= this.camUp[0] * moveSpeed;
        this.targetPan.y -= this.camUp[1] * moveSpeed;
        this.targetPan.z -= this.camUp[2] * moveSpeed;
      }
      // Q / E: True 6-DOF Roll counterclockwise / clockwise (exact Universe Sandbox 2!)
      if (k.has('q')) this.targetRoll -= dtSeconds * 1.25;
      if (k.has('e')) this.targetRoll += dtSeconds * 1.25;

      // Arrow keys: Up/Down zoom in/out on locked object, Left/Right orbit azimuth!
      if (k.has('arrowup')) this.engine.setTargetLogScale(this.engine.targetLogScale - dtSeconds * 3.6);
      if (k.has('arrowdown')) this.engine.setTargetLogScale(this.engine.targetLogScale + dtSeconds * 3.6);
      if (k.has('arrowleft')) this.targetYaw -= dtSeconds * 1.4;
      if (k.has('arrowright')) this.targetYaw += dtSeconds * 1.4;
    }

    // Smooth camera damping
    const damp = Math.min(1.0, dtSeconds * 10.0);
    this.yaw += (this.targetYaw - this.yaw) * damp;
    this.pitch += (this.targetPitch - this.pitch) * damp;
    this.roll += (this.targetRoll - this.roll) * damp;
    this.panOffset.x += (this.targetPan.x - this.panOffset.x) * damp;
    this.panOffset.y += (this.targetPan.y - this.panOffset.y) * damp;
    this.panOffset.z += (this.targetPan.z - this.panOffset.z) * damp;

    if (!this.isDragging && !this.isPanning && this.engine.autopilotActive) {
      this.targetYaw += dtSeconds * 0.14;
    } else if (!this.isDragging && !this.isPanning && this.engine.sandboxTool === 'select') {
      this.targetYaw += dtSeconds * 0.018;
    }

    this.updateCameraBasis(3.35 / Math.max(0.25, this.cameraZoom));
    this.renderWebGLPass();
    this.renderAstrographicOverlayPass();
  }

  renderWebGLPass() {
    const gl = this.gl;
    if (!gl || !this.program) return;

    gl.viewport(0, 0, this.webglCanvas.width, this.webglCanvas.height);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    const eng = this.engine;
    const gal = eng.getActiveGalaxy();
    const sys = eng.getActivePlanetarySystem();
    const star = sys.star;
    const planet = eng.getActivePlanet();
    const nbTarget = eng.getActiveNBodyTarget();

    gl.uniform2f(this.uniforms.u_resolution, this.webglCanvas.width, this.webglCanvas.height);
    gl.uniform1f(this.uniforms.u_time, eng.visualTime);
    gl.uniform1f(this.uniforms.u_logScale, eng.currentLogScale);
    gl.uniform3fv(this.uniforms.u_camRight, this.camRight);
    gl.uniform3fv(this.uniforms.u_camUp, this.camUp);
    gl.uniform3fv(this.uniforms.u_camForward, this.camForward);
    gl.uniform3fv(this.uniforms.u_camOrigin, this.camOrigin);
    gl.uniform2f(this.uniforms.u_cameraAngles, this.yaw, this.pitch);
    gl.uniform2f(this.uniforms.u_surfaceOffset, this.surfaceOffset.x, this.surfaceOffset.z);
    gl.uniform1f(this.uniforms.u_warpFactor, eng.warpFactor || 0.0);
    gl.uniform1f(this.uniforms.u_seed, (sys.seed % 10000) * 0.1);
    gl.uniform1i(this.uniforms.u_qualityLevel, this.qualityLevel);
    gl.uniform1i(this.uniforms.u_lightingMode, eng.lightingMode || 0);

    gl.uniform3fv(this.uniforms.u_starColor, star.rgb);
    gl.uniform1f(this.uniforms.u_starTempK, star.tempK);
    gl.uniform1f(this.uniforms.u_starRadiusNorm, Math.min(2.2, Math.max(0.4, Math.pow(star.radiusSolar, 0.25))));

    let remnantInt = 0;
    if (star.remnantType === 'white_dwarf') remnantInt = 1;
    else if (star.remnantType === 'neutron_star') remnantInt = 2;
    else if (star.remnantType === 'black_hole') remnantInt = 3;
    gl.uniform1i(this.uniforms.u_remnantType, remnantInt);
    gl.uniform1f(this.uniforms.u_hasNebulaHalo, star.hasNebulaHalo ? 1.0 : 0.0);
    gl.uniform1f(this.uniforms.u_isBinary, sys.isBinary ? 1.0 : 0.0);
    gl.uniform3fv(this.uniforms.u_companionColor, sys.companion ? sys.companion.rgb : [0.8, 0.9, 1.0]);

    let galFam = 0;
    if (gal.morphology.family === 'barred') galFam = 1;
    else if (gal.morphology.family === 'elliptical') galFam = 2;
    else if (gal.morphology.family === 'irregular') galFam = 3;
    gl.uniform1i(this.uniforms.u_galaxyFamily, galFam);
    gl.uniform1f(this.uniforms.u_galaxyArms, gal.morphology.arms || 2.0);
    gl.uniform1f(this.uniforms.u_galaxyTwist, gal.armTwist || 3.4);
    gl.uniform1f(this.uniforms.u_galaxyBar, gal.morphology.bar || 0.1);
    gl.uniform1f(this.uniforms.u_agnActive, gal.smbh && gal.smbh.agnActive ? 1.0 : 0.0);
    const nebCol = gal.nebulae && gal.nebulae.length ? gal.nebulae[0].color : [0.95, 0.28, 0.48];
    gl.uniform3fv(this.uniforms.u_nebulaColor, nebCol);

    if (planet) {
      const archMap = {
        temperate_terrestrial: 0,
        super_earth_temperate: 0,
        pelagic_ocean: 1,
        lava_world: 2,
        venusian_greenhouse: 3,
        arid_desert: 4,
        gas_giant: 5,
        ice_giant: 6,
        cryo_glacial: 7,
        iron_cratered: 8
      };
      gl.uniform1i(this.uniforms.u_planetArchetype, archMap[planet.archetype] ?? 0);
      gl.uniform3fv(this.uniforms.u_colDeepOcean, planet.palette.deepOcean);
      gl.uniform3fv(this.uniforms.u_colShallowOcean, planet.palette.shallowOcean);
      gl.uniform3fv(this.uniforms.u_colLowland, planet.palette.lowland);
      gl.uniform3fv(this.uniforms.u_colHighland, planet.palette.highland);
      gl.uniform3fv(this.uniforms.u_colPeak, planet.palette.peak);
      gl.uniform3fv(this.uniforms.u_colAtmo, planet.palette.atmosphere);
      gl.uniform3fv(
        this.uniforms.u_colFoliage,
        planet.biosphere.active && planet.biosphere.foliageRGB ? planet.biosphere.foliageRGB : planet.palette.lowland
      );
      gl.uniform1f(this.uniforms.u_oceanCoverage, planet.oceanCoverage);
      gl.uniform1f(this.uniforms.u_iceCoverage, planet.iceCoverage);
      gl.uniform1f(this.uniforms.u_cloudCoverage, planet.cloudCoverage);
      gl.uniform1f(this.uniforms.u_terrainRoughness, planet.terrainRoughness);
      gl.uniform1f(this.uniforms.u_volcanism, planet.volcanism);
      gl.uniform1f(this.uniforms.u_pressureAtm, planet.pressureAtm);
      gl.uniform1f(this.uniforms.u_bioComplexity, planet.biosphere.active ? planet.biosphere.complexityIndex : 0.0);
      gl.uniform1f(this.uniforms.u_cityLights, planet.civilization.active ? planet.civilization.cityLightIntensity : 0.0);
      gl.uniform1f(this.uniforms.u_isTidallyLocked, planet.isTidallyLocked ? 1.0 : 0.0);
      gl.uniform1f(this.uniforms.u_moltenHeat, nbTarget ? nbTarget.moltenHeat : 0.0);
      gl.uniform1f(this.uniforms.u_hasRings, planet.rings ? 1.0 : 0.0);
      gl.uniform1f(this.uniforms.u_ringInner, planet.rings ? planet.rings.innerRadiusRatio : 1.4);
      gl.uniform1f(this.uniforms.u_ringOuter, planet.rings ? planet.rings.outerRadiusRatio : 2.3);
      gl.uniform1f(this.uniforms.u_planetSeed, (planet.seed % 1000) * 0.1);
    }

    gl.uniform1f(this.uniforms.u_superflare, eng.transientEffects.superflareIntensity);
    gl.uniform1f(this.uniforms.u_impactFlash, eng.transientEffects.impactFlashIntensity);
    gl.uniform1f(this.uniforms.u_evoPulse, eng.transientEffects.evolutionPulseIntensity);
    gl.uniform1f(this.uniforms.u_laserActive, eng.laserActive ? 1.0 : 0.0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  /**
   * Synchronized 3D Vector Overlay: N-Body Trails, Grid, Collisions, Laser Beam & Picking
   */
  renderAstrographicOverlayPass() {
    const ctx = this.ctx;
    const dpr = this.dpr;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);

    this.interactiveTargets = [];
    const s = this.engine.currentLogScale;
    const flags = this.engine.displayFlags;

    // Universe Sandbox 3D Simulation Reference Grid (Key G)
    if (flags.grid && s > 4.5) {
      this.drawAstrographicDiscGrid(ctx, 'rgba(56, 189, 248, 0.16)');
    }

    const wCosmos = this.smoothstep(21.4, 23.0, s);
    const wGalaxy = this.smoothstep(17.5, 19.2, s) * (1.0 - this.smoothstep(22.2, 23.6, s));
    const wSector = this.smoothstep(14.5, 15.8, s) * (1.0 - this.smoothstep(18.0, 19.4, s));
    const wSystem = this.smoothstep(9.5, 10.8, s) * (1.0 - this.smoothstep(14.5, 15.8, s));
    const wPlanet = this.smoothstep(3.5, 4.9, s) * (1.0 - this.smoothstep(9.5, 10.8, s));
    const wSurface = 1.0 - this.smoothstep(3.4, 4.9, s);

    if (wCosmos > 0.05) this.drawCosmosOverlay(ctx, wCosmos);
    if (wGalaxy > 0.05) this.drawGalaxyOverlay(ctx, wGalaxy);
    if (wSector > 0.05) this.drawStellarSectorOverlay(ctx, wSector);
    if (wSystem > 0.05) this.drawPlanetarySystemNBodyOverlay(ctx, wSystem);
    if (wPlanet > 0.05) this.drawPlanetOrbitOverlay(ctx, wPlanet);
    if (wSurface > 0.05) this.drawSurfaceAndBioOverlay(ctx, wSurface);

    // Universe Sandbox Tool Visual Feedback (Add Orbit Preview & Laser Beam)
    if (this.engine.sandboxTool === 'add' && wSystem > 0.25 && this.hoverPointer.x > 0) {
      this.drawAddOrbitPreview(ctx);
    }
    if (this.engine.laserActive) {
      this.drawThermalLaserBeam(ctx);
    }

    // Hover picking feedback
    this.hoveredTarget = null;
    for (const target of this.interactiveTargets) {
      const d = Math.hypot(this.hoverPointer.x - target.screenX, this.hoverPointer.y - target.screenY);
      if (d < (target.hitRadius || 24)) {
        this.hoveredTarget = target;
        break;
      }
    }

    if (this.engine.sandboxTool === 'add' || this.engine.sandboxTool === 'laser' || this.engine.sandboxTool === 'explode') {
      this.overlayCanvas.style.cursor = 'crosshair';
    } else {
      this.overlayCanvas.style.cursor = this.hoveredTarget ? 'pointer' : this.isDragging || this.isPanning ? 'grabbing' : 'grab';
    }

    if (this.hoveredTarget) {
      this.drawHoverReticle(ctx, this.hoveredTarget);
    }

    ctx.restore();
  }

  drawAddOrbitPreview(ctx) {
    const { point3D } = this.unprojectToEcliptic(this.hoverPointer.x, this.hoverPointer.y);
    const r = Math.hypot(point3D[0], point3D[2]);
    if (r < 0.15 || r > 5.0) return;

    ctx.save();
    if (this.engine.addMode === 'orbit' || this.engine.addMode === 'binary') {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i <= 60; i++) {
        const a = (i / 60) * Math.PI * 2;
        const p = this.project3D([Math.cos(a) * r, 0, Math.sin(a) * r]);
        if (p.visible) {
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.strokeStyle = '#e5a93c';
    ctx.beginPath();
    ctx.arc(this.hoverPointer.x, this.hoverPointer.y, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#e5a93c';
    ctx.font = '600 10px "JetBrains Mono", monospace';
    ctx.fillText(`+ ${this.engine.addPresetId.toUpperCase()} [${this.engine.addMode.toUpperCase()}]`, this.hoverPointer.x + 14, this.hoverPointer.y + 3);
    ctx.restore();
  }

  drawThermalLaserBeam(ctx) {
    ctx.save();
    const targetX = this.width * 0.5;
    const targetY = this.height * 0.5;
    const srcX = this.width * 0.12;
    const srcY = this.height * 0.88;

    const grad = ctx.createLinearGradient(srcX, srcY, targetX, targetY);
    grad.addColorStop(0, 'rgba(56, 189, 248, 0.15)');
    grad.addColorStop(0.5, 'rgba(56, 189, 248, 0.92)');
    grad.addColorStop(1, 'rgba(255, 245, 220, 1.0)');

    ctx.strokeStyle = grad;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(srcX, srcY);
    ctx.lineTo(targetX, targetY);
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(srcX, srcY);
    ctx.lineTo(targetX, targetY);
    ctx.stroke();

    const flare = ctx.createRadialGradient(targetX, targetY, 2, targetX, targetY, 44);
    flare.addColorStop(0, 'rgba(255, 250, 220, 0.95)');
    flare.addColorStop(0.4, 'rgba(251, 146, 60, 0.65)');
    flare.addColorStop(1, 'rgba(251, 146, 60, 0)');
    ctx.fillStyle = flare;
    ctx.beginPath();
    ctx.arc(targetX, targetY, 44, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  smoothstep(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  drawCosmosOverlay(ctx, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const web = this.engine.cosmicWeb;
    const activeIdx = this.engine.activeSuperclusterIndex;
    const showLabels = this.engine.displayFlags.labels;

    for (const fil of web.filaments) {
      const pA = this.project3D(fil.start);
      const pB = this.project3D(fil.end);
      if (!pA.visible || !pB.visible) continue;

      const grad = ctx.createLinearGradient(pA.x, pA.y, pB.x, pB.y);
      grad.addColorStop(0, 'rgba(56, 189, 248, 0.28)');
      grad.addColorStop(0.5, `rgba(229, 169, 60, ${0.15 + fil.linearDensity * 0.22})`);
      grad.addColorStop(1, 'rgba(56, 189, 248, 0.28)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.2 + fil.linearDensity * 1.4;
      ctx.beginPath();
      ctx.moveTo(pA.x, pA.y);
      ctx.lineTo(pB.x, pB.y);
      ctx.stroke();
    }

    web.superclusters.forEach((sc, idx) => {
      const proj = this.project3D(sc.position);
      if (!proj.visible) return;
      const isSelected = idx === activeIdx;
      const radius = (isSelected ? 9 : 6) * Math.min(1.5, proj.scale * 1.6);

      const [r, g, b] = sc.color.map((c) => Math.round(c * 255));
      const glow = ctx.createRadialGradient(proj.x, proj.y, 1, proj.x, proj.y, radius * 3.4);
      glow.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.85)`);
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, radius * 3.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = isSelected ? '#fde047' : `rgb(${r}, ${g}, ${b})`;
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, Math.max(3, radius * 0.52), 0, Math.PI * 2);
      ctx.fill();

      if (isSelected) this.drawSelectionReticle(ctx, proj.x, proj.y, radius * 2.2, '#e5a93c');

      if (showLabels) {
        ctx.fillStyle = isSelected ? '#f8fafc' : 'rgba(226, 232, 240, 0.78)';
        ctx.font = isSelected ? '600 11px "Space Grotesk", sans-serif' : '500 10px "Space Grotesk", sans-serif';
        ctx.fillText(sc.name, proj.x + radius + 8, proj.y - 2);
        ctx.fillStyle = 'rgba(148, 163, 184, 0.75)';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillText(`${sc.catalogId} • z=${sc.redshift.toFixed(4)}`, proj.x + radius + 8, proj.y + 10);
      }

      this.interactiveTargets.push({
        type: 'supercluster',
        index: idx,
        label: sc.name,
        screenX: proj.x,
        screenY: proj.y,
        hitRadius: 26
      });
    });

    ctx.restore();
  }

  drawGalaxyOverlay(ctx, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const gal = this.engine.getActiveGalaxy();
    const showLabels = this.engine.displayFlags.labels;

    const pCore = this.project3D([0, 0, 0]);
    if (pCore.visible && showLabels) {
      ctx.strokeStyle = 'rgba(229, 169, 60, 0.75)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(pCore.x, pCore.y, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(253, 224, 71, 0.9)';
      ctx.font = '600 10px "JetBrains Mono", monospace';
      ctx.fillText(`SMBH ${gal.smbh.name} (${(gal.smbh.massSolar / 1e6).toFixed(1)}M M☉)`, pCore.x + 16, pCore.y - 4);
    }

    const rot = this.engine.visualTime * 0.032;
    const sectorPos = [Math.cos(rot + 0.8) * 0.75, 0.02, Math.sin(rot + 0.8) * 0.75];
    const pSec = this.project3D(sectorPos);
    if (pSec.visible) {
      this.drawSelectionReticle(ctx, pSec.x, pSec.y, 18, '#38bdf8');
      if (showLabels) {
        ctx.fillStyle = '#38bdf8';
        ctx.font = '600 11px "Space Grotesk", sans-serif';
        ctx.fillText(`ACTIVE SECTOR: ${this.engine.stellarSector.name}`, pSec.x + 22, pSec.y - 2);
      }
      this.interactiveTargets.push({
        type: 'system',
        index: this.engine.activeSystemIndex,
        label: this.engine.stellarSector.name,
        screenX: pSec.x,
        screenY: pSec.y,
        hitRadius: 30
      });
    }
    ctx.restore();
  }

  drawStellarSectorOverlay(ctx, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const systems = this.engine.stellarSector.systems;
    const activeSysIdx = this.engine.activeSystemIndex;
    const showLabels = this.engine.displayFlags.labels;

    systems.forEach((sys, idx) => {
      const pStar = this.project3D(sys.position);
      const pPlane = this.project3D([sys.position[0], 0, sys.position[2]]);
      if (!pStar.visible) return;

      const isSelected = idx === activeSysIdx;

      if (pPlane.visible) {
        ctx.strokeStyle = isSelected ? 'rgba(229, 169, 60, 0.55)' : 'rgba(148, 163, 184, 0.16)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pStar.x, pStar.y);
        ctx.lineTo(pPlane.x, pPlane.y);
        ctx.stroke();
      }

      const [r, g, b] = sys.star.rgb.map((c) => Math.round(c * 255));
      const baseR = isSelected ? 9 : 5.5;
      const glow = ctx.createRadialGradient(pStar.x, pStar.y, 1, pStar.x, pStar.y, baseR * 3.0);
      glow.addColorStop(0, '#ffffff');
      glow.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, 0.9)`);
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(pStar.x, pStar.y, baseR * 3.0, 0, Math.PI * 2);
      ctx.fill();

      if (sys.hasCivilization || sys.hasBiosphere) {
        ctx.strokeStyle = sys.hasCivilization ? 'rgba(229, 169, 60, 0.85)' : 'rgba(52, 211, 153, 0.8)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(pStar.x, pStar.y, baseR * 1.9, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (isSelected) this.drawSelectionReticle(ctx, pStar.x, pStar.y, 20, '#e5a93c');

      if (showLabels) {
        ctx.fillStyle = isSelected ? '#f8fafc' : 'rgba(226, 232, 240, 0.82)';
        ctx.font = isSelected ? '600 11px "Space Grotesk", sans-serif' : '500 10px "Space Grotesk", sans-serif';
        ctx.fillText(sys.name, pStar.x + 12, pStar.y - 2);
        ctx.fillStyle = sys.hasCivilization ? '#e5a93c' : sys.hasBiosphere ? '#34d399' : 'rgba(148, 163, 184, 0.72)';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillText(`${sys.star.spectralClass} • ${Math.round(sys.star.tempK)}K`, pStar.x + 12, pStar.y + 10);
      }

      this.interactiveTargets.push({
        type: 'system',
        index: idx,
        label: sys.name,
        screenX: pStar.x,
        screenY: pStar.y,
        hitRadius: 24
      });
    });

    ctx.restore();
  }

  /**
   * SCALE 4 OVERLAY: LIVE N-BODY GRAVITY SYSTEM (Trails, Orbits, Collisions, Fragments, Shockwaves!)
   */
  drawPlanetarySystemNBodyOverlay(ctx, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;

    const pSys = this.engine.getActivePlanetarySystem();
    const nbody = this.engine.nbody;
    const flags = this.engine.displayFlags;
    const activePlanetIdx = this.engine.activePlanetIndex;
    const maxAU = pSys.planets.length ? pSys.planets[pSys.planets.length - 1].orbit.a : 10;

    // Consistent spatial compression mapping AU -> 3D viewport units
    const mapPos3D = (x, y, z) => {
      const r = Math.hypot(x, y, z);
      if (r < 1e-4) return [0, 0, 0];
      const rScaled = 0.36 + Math.pow(r / Math.max(0.5, maxAU), 0.52) * 1.75;
      const f = rScaled / r;
      return [x * f, y * f, z * f];
    };

    const mapRadius = (au) => 0.36 + Math.pow(au / Math.max(0.5, maxAU), 0.52) * 1.75;

    // 1. Circumstellar Habitable Zone (Key H)
    if (flags.hz && !pSys.star.isRemnant) {
      const rIn = mapRadius(pSys.star.hzInnerAU);
      const rOut = mapRadius(pSys.star.hzOuterAU);
      this.draw3DRingBand(ctx, (rIn + rOut) * 0.5, Math.max(2, (rOut - rIn) * 45), 'rgba(52, 211, 153, 0.09)');
    }

    // 2. Molten Collision & Supernova Debris Fragments!
    for (const frag of nbody.fragments) {
      const p3 = mapPos3D(frag.x, frag.y, frag.z);
      const proj = this.project3D(p3);
      if (!proj.visible) continue;
      const [fr, fg, fb] = frag.color.map((c) => Math.round(c * 255));
      ctx.fillStyle = `rgba(${fr}, ${fg}, ${fb}, ${Math.max(0.1, frag.life)})`;
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, frag.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Expanding Supernova & Collision Shockwaves!
    for (const sw of nbody.shockwaves) {
      const pCenter = this.project3D(mapPos3D(sw.x, sw.y, sw.z));
      if (!pCenter.visible) continue;
      const [sr, sg, sb] = sw.color.map((c) => Math.round(c * 255));
      ctx.strokeStyle = `rgba(${sr}, ${sg}, ${sb}, ${sw.alpha})`;
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.arc(pCenter.x, pCenter.y, sw.radius * 180 * pCenter.scale, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 4. Live N-Body Bodies (Procedural Planets + User-Spawned Stars, Black Holes & Rogue Planets!)
    nbody.bodies.forEach((body, bIdx) => {
      if (!body.alive) return;

      const isCentralAnchor = bIdx === 0;
      const isSelected = body.planetIndex >= 0 && body.planetIndex === activePlanetIdx;

      // Reference elliptical orbit (Key O) for procedural planets
      if (flags.orbits && body.sourcePlanet) {
        const pl = body.sourcePlanet;
        ctx.beginPath();
        let started = false;
        for (let s = 0; s <= 56; s++) {
          const st = solveKeplerOrbit(pl.orbit, (s / 56) * pl.orbit.periodYears);
          const proj = this.project3D(mapPos3D(st.x, st.y, st.z));
          if (proj.visible) {
            if (!started) { ctx.moveTo(proj.x, proj.y); started = true; }
            else ctx.lineTo(proj.x, proj.y);
          }
        }
        ctx.strokeStyle = isSelected ? 'rgba(229, 169, 60, 0.55)' : 'rgba(148, 163, 184, 0.16)';
        ctx.lineWidth = isSelected ? 1.4 : 0.9;
        ctx.stroke();
      }

      // Live N-Body Dynamic Motion Trails (Key T — exact Universe Sandbox 2 ribbon!)
      if (flags.trails && body.trail && body.trail.length > 1) {
        const [tr, tg, tb] = (body.atmoColor || body.color).map((c) => Math.round(c * 255));
        ctx.strokeStyle = isSelected
          ? 'rgba(229, 169, 60, 0.85)'
          : `rgba(${tr}, ${tg}, ${tb}, 0.55)`;
        ctx.lineWidth = isSelected ? 2.0 : 1.4;
        ctx.beginPath();
        let started = false;
        for (let t = 0; t < body.trail.length; t++) {
          const pt = body.trail[t];
          const proj = this.project3D(mapPos3D(pt.x, pt.y, pt.z));
          if (proj.visible) {
            if (!started) { ctx.moveTo(proj.x, proj.y); started = true; }
            else ctx.lineTo(proj.x, proj.y);
          }
        }
        ctx.stroke();
      }

      if (isCentralAnchor) {
        // Still allow clicking central star with Explode tool for Supernova!
        const pStar0 = this.project3D(mapPos3D(body.x, body.y, body.z));
        if (pStar0.visible) {
          this.interactiveTargets.push({
            type: 'star_center',
            index: 0,
            nbodyRef: body,
            label: body.name,
            screenX: pStar0.x,
            screenY: pStar0.y,
            hitRadius: 34
          });
        }
        return;
      }

      const pProj = this.project3D(mapPos3D(body.x, body.y, body.z));
      if (!pProj.visible) return;

      const bodyR = body.kind === 'star'
        ? 11
        : body.kind === 'black_hole'
        ? 9
        : Math.max(4.5, Math.min(13, body.radiusVisual * 190));

      const [lr, lg, lb] = body.color.map((c) => Math.round(c * 255));

      if (body.kind === 'black_hole') {
        // Spawned Rogue Black Hole with glowing photon ring!
        ctx.fillStyle = '#020306';
        ctx.beginPath();
        ctx.arc(pProj.x, pProj.y, bodyR, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fb923c';
        ctx.lineWidth = 2.2;
        ctx.stroke();
      } else if (body.kind === 'star') {
        const sg = ctx.createRadialGradient(pProj.x, pProj.y, 1, pProj.x, pProj.y, bodyR * 2.4);
        sg.addColorStop(0, '#ffffff');
        sg.addColorStop(0.4, `rgb(${lr}, ${lg}, ${lb})`);
        sg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.arc(pProj.x, pProj.y, bodyR * 2.4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Planet or Spawned Moon/Asteroid with molten heat glow if recently impacted!
        const [cr, cg, cb] = (body.atmoColor || body.color).map((c) => Math.round(c * 255));
        ctx.fillStyle = body.moltenHeat > 0.25 ? '#fb923c' : `rgb(${lr}, ${lg}, ${lb})`;
        ctx.beginPath();
        ctx.arc(pProj.x, pProj.y, bodyR, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = body.moltenHeat > 0.25 ? '#fde047' : `rgba(${cr}, ${cg}, ${cb}, 0.78)`;
        ctx.lineWidth = 1.3;
        ctx.stroke();
      }

      if (isSelected) this.drawSelectionReticle(ctx, pProj.x, pProj.y, bodyR + 10, '#e5a93c');

      if (flags.labels) {
        ctx.fillStyle = isSelected ? '#f8fafc' : 'rgba(226, 232, 240, 0.88)';
        ctx.font = isSelected ? '600 11px "Space Grotesk", sans-serif' : '500 10px "Space Grotesk", sans-serif';
        ctx.fillText(body.name, pProj.x + bodyR + 8, pProj.y - 2);
        const speedKmS = Math.hypot(body.vx, body.vy, body.vz) * 4.74;
        ctx.fillStyle = body.moltenHeat > 0.2 ? '#fb923c' : 'rgba(148, 163, 184, 0.82)';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillText(`${Math.round(body.tempK - 273.15)}°C • ${speedKmS.toFixed(1)} km/s`, pProj.x + bodyR + 8, pProj.y + 10);
      }

      this.interactiveTargets.push({
        type: body.planetIndex >= 0 ? 'planet' : 'spawned',
        index: body.planetIndex >= 0 ? body.planetIndex : bIdx,
        nbodyRef: body,
        label: body.name,
        screenX: pProj.x,
        screenY: pProj.y,
        hitRadius: Math.max(22, bodyR + 10)
      });
    });

    ctx.restore();
  }

  drawPlanetOrbitOverlay(ctx, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const planet = this.engine.getActivePlanet();
    if (!planet) { ctx.restore(); return; }

    const planetR = 1.05;
    const rot = planet.isTidallyLocked ? 0.0 : (this.engine.visualTime * 0.085);
    const showLabels = this.engine.displayFlags.labels;

    // Moons
    planet.moons.forEach((moon, mIdx) => {
      const mOrbitR = 1.55 + mIdx * 0.35;
      const mAngle = moon.angleOffset + this.engine.visualTime * (0.45 / (mIdx + 1));
      const mPos = [Math.cos(mAngle) * mOrbitR, Math.sin(mAngle * 0.7) * 0.18, Math.sin(mAngle) * mOrbitR];
      const pMoon = this.project3D(mPos);
      if (!pMoon.visible) return;

      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.arc(pMoon.x, pMoon.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
      if (showLabels) {
        ctx.fillStyle = 'rgba(226, 232, 240, 0.8)';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillText(`Moon ${moon.name}`, pMoon.x + 8, pMoon.y + 3);
      }
    });

    // Surface landmarks on front hemisphere
    planet.landmarks.forEach((lm, idx) => {
      const latRad = (lm.lat * Math.PI) / 180;
      const lonRad = (lm.lon * Math.PI) / 180 + rot;
      const nx = Math.cos(latRad) * Math.cos(lonRad);
      const ny = Math.sin(latRad);
      const nz = Math.cos(latRad) * Math.sin(lonRad);

      const facing = -(nx * this.camForward[0] + ny * this.camForward[1] + nz * this.camForward[2]);
      if (facing < 0.18) return;

      const proj = this.project3D([nx * planetR * 1.01, ny * planetR * 1.01, nz * planetR * 1.01]);
      if (!proj.visible) return;

      const isSelected = idx === this.engine.activeLandmarkIndex;
      const pinColor = lm.icon === 'city' ? '#e5a93c' : lm.icon === 'biosphere' ? '#34d399' : lm.icon === 'volcano' ? '#f43f5e' : '#38bdf8';

      ctx.strokeStyle = pinColor;
      ctx.lineWidth = isSelected ? 1.8 : 1.2;
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, isSelected ? 7 : 4.5, 0, Math.PI * 2);
      ctx.stroke();

      if (showLabels) {
        ctx.fillStyle = isSelected ? '#ffffff' : 'rgba(241, 245, 249, 0.85)';
        ctx.font = '500 10px "Space Grotesk", sans-serif';
        ctx.fillText(lm.name, proj.x + 10, proj.y + 3);
      }

      this.interactiveTargets.push({
        type: 'landmark',
        index: idx,
        label: lm.name,
        screenX: proj.x,
        screenY: proj.y,
        hitRadius: 22
      });
    });

    ctx.restore();
  }

  drawSurfaceAndBioOverlay(ctx, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const planet = this.engine.getActivePlanet();
    const lm = this.engine.getActiveLandmark();
    if (!planet) { ctx.restore(); return; }

    const cx = this.width * 0.5;
    const cy = this.height * 0.5;

    if (this.engine.displayFlags.labels) {
      const headingDeg = Math.round((((this.yaw * 180) / Math.PI) % 360 + 360) % 360);
      ctx.fillStyle = 'rgba(226, 232, 240, 0.82)';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        `AZIMUTH ${headingDeg.toString().padStart(3, '0')}°  •  SITE: ${lm ? lm.name.toUpperCase() : planet.name.toUpperCase()}  •  ${planet.surfaceTempC.toFixed(1)}°C  •  PRESS C TO LIFTOFF`,
        cx,
        74
      );
      ctx.textAlign = 'left';
    }

    if (planet.biosphere.active && planet.biosphere.clades.length > 0) {
      planet.biosphere.clades.forEach((clade, idx) => {
        const angle = (idx - 2) * 0.42 - (this.yaw % 0.6) * 0.3;
        const sx = cx + Math.sin(angle) * (this.width * 0.26);
        const sy = cy + 65 + (idx % 2) * 48;
        const isSelected = idx === this.engine.activeCladeIndex;

        this.drawProceduralOrganismSpecimen(ctx, sx, sy, clade, isSelected ? 34 : 20, this.engine.visualTime, isSelected);
        this.interactiveTargets.push({
          type: 'clade',
          index: idx,
          label: clade.binomialName,
          screenX: sx,
          screenY: sy,
          hitRadius: 34
        });
      });
    }

    ctx.restore();
  }

  drawProceduralOrganismSpecimen(ctx, x, y, clade, radius, time, isSelected) {
    ctx.save();
    const hue = clade.hueDeg;
    const color = `hsl(${hue}, 82%, 62%)`;
    const glowColor = `hsla(${hue}, 90%, 55%, 0.28)`;

    const grad = ctx.createRadialGradient(x, y, 2, x, y, radius * 1.9);
    grad.addColorStop(0, glowColor);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, radius * 1.9, 0, Math.PI * 2);
    ctx.fill();

    const appendages = clade.appendageCount || 6;
    const segments = clade.bodySegments || 6;
    ctx.strokeStyle = color;
    ctx.lineWidth = isSelected ? 1.8 : 1.2;

    if (clade.icon === 'flora' || clade.icon === 'colonial') {
      for (let i = 0; i < appendages; i++) {
        const baseA = (i / appendages) * Math.PI * 2 + Math.sin(time * 1.2 + i) * 0.12;
        ctx.beginPath();
        ctx.moveTo(x, y);
        const mx = x + Math.cos(baseA) * radius * 0.65;
        const my = y + Math.sin(baseA) * radius * 0.65;
        const ex = x + Math.cos(baseA + Math.sin(time * 2 + i) * 0.25) * radius * 1.15;
        const ey = y + Math.sin(baseA + Math.sin(time * 2 + i) * 0.25) * radius * 1.15;
        ctx.quadraticCurveTo(mx, my, ex, ey);
        ctx.stroke();
      }
    } else {
      for (let s = 0; s < segments; s++) {
        const frac = s / segments;
        const sx = x + (frac - 0.45) * radius * 1.4;
        const sy = y + Math.sin(time * 3.5 + s * 0.9) * (radius * 0.16);
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(2, radius * 0.28), 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    if (this.engine.displayFlags.labels) {
      ctx.fillStyle = isSelected ? '#ffffff' : 'rgba(226, 232, 240, 0.88)';
      ctx.font = '600 10px "Space Grotesk", sans-serif';
      ctx.fillText(clade.binomialName, x + radius * 1.3, y + 3);
    }
    ctx.restore();
  }

  drawAstrographicDiscGrid(ctx, strokeColor) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1;
    for (const rad of [0.6, 1.2, 1.8, 2.4]) {
      ctx.beginPath();
      let started = false;
      for (let i = 0; i <= 48; i++) {
        const a = (i / 48) * Math.PI * 2;
        const p = this.project3D([Math.cos(a) * rad, 0, Math.sin(a) * rad]);
        if (p.visible) {
          if (!started) { ctx.moveTo(p.x, p.y); started = true; }
          else ctx.lineTo(p.x, p.y);
        }
      }
      ctx.stroke();
    }
  }

  draw3DRingBand(ctx, radius3D, lineWidthPx, strokeColor) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidthPx;
    ctx.beginPath();
    let started = false;
    for (let i = 0; i <= 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      const p = this.project3D([Math.cos(a) * radius3D, 0, Math.sin(a) * radius3D]);
      if (p.visible) {
        if (!started) { ctx.moveTo(p.x, p.y); started = true; }
        else ctx.lineTo(p.x, p.y);
      }
    }
    ctx.stroke();
  }

  drawSelectionReticle(ctx, x, y, radius, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    for (let q = 0; q < 4; q++) {
      const a0 = q * (Math.PI * 0.5) + 0.15;
      ctx.beginPath();
      ctx.arc(x, y, radius, a0, a0 + 0.42);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawHoverReticle(ctx, target) {
    ctx.save();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.arc(target.screenX, target.screenY, 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
}
