/**
 * PARALLAX — WebGL2 Volumetric Raymarching & 3D Astrographic Telemetry Renderer
 * Combines GPU WebGL2 fragment raymarching with a synchronized 3D projective vector
 * & interactive spatial picking layer.
 */

import { VERTEX_SHADER_SOURCE, FRAGMENT_SHADER_SOURCE } from './shaders.js';
import { solveKeplerOrbit } from '../math/prng.js';

export class UniverseRenderer {
  constructor(webglCanvas, overlayCanvas, engine) {
    this.webglCanvas = webglCanvas;
    this.overlayCanvas = overlayCanvas;
    this.ctx = overlayCanvas.getContext('2d');
    this.engine = engine;

    // 3D Orbital Camera & Surface Flight State
    this.yaw = 0.45;
    this.pitch = 0.28;
    this.targetYaw = 0.45;
    this.targetPitch = 0.28;
    this.cameraZoom = 1.0;
    this.surfaceOffset = { x: 0, z: 0 };
    this.keysPressed = new Set();

    // Pointer, Multi-Touch Pinch & 3D spatial picking state
    this.isDragging = false;
    this.dragMoved = false;
    this.lastPointer = { x: 0, y: 0 };
    this.hoverPointer = { x: -1000, y: -1000 };
    this.activePointers = new Map();
    this.lastPinchDist = null;
    this.interactiveTargets = [];
    this.hoveredTarget = null;

    // FPS tracking
    this.fps = 60;
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
      powerPreference: 'high-performance'
    });

    if (!gl) {
      console.warn('WebGL2 unavailable, falling back to 2D astrographic renderer.');
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
      'u_resolution', 'u_time', 'u_logScale', 'u_cameraAngles', 'u_surfaceOffset',
      'u_cameraZoom', 'u_warpFactor', 'u_seed',
      'u_starColor', 'u_starTempK', 'u_starRadiusNorm', 'u_remnantType', 'u_hasNebulaHalo',
      'u_isBinary', 'u_companionColor',
      'u_galaxyFamily', 'u_galaxyArms', 'u_galaxyTwist', 'u_galaxyBar', 'u_agnActive', 'u_nebulaColor',
      'u_planetArchetype', 'u_colDeepOcean', 'u_colShallowOcean', 'u_colLowland',
      'u_colHighland', 'u_colPeak', 'u_colAtmo', 'u_colFoliage',
      'u_oceanCoverage', 'u_iceCoverage', 'u_cloudCoverage', 'u_terrainRoughness',
      'u_volcanism', 'u_pressureAtm', 'u_bioComplexity', 'u_cityLights', 'u_isTidallyLocked',
      'u_hasRings', 'u_ringInner', 'u_ringOuter', 'u_planetSeed',
      'u_superflare', 'u_impactFlash', 'u_evoPulse'
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

    // Keep shader resolution crisp & high-FPS
    const shaderScale = Math.min(dpr, 1.35);
    this.webglCanvas.width = Math.floor(w * shaderScale);
    this.webglCanvas.height = Math.floor(h * shaderScale);

    this.overlayCanvas.width = Math.floor(w * dpr);
    this.overlayCanvas.height = Math.floor(h * dpr);
    this.dpr = dpr;
    this.width = w;
    this.height = h;
  }

  bindInteractionEvents() {
    const el = this.overlayCanvas;
    el.style.touchAction = 'none';

    el.addEventListener('pointerdown', (e) => {
      this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.activePointers.size === 1) {
        this.isDragging = true;
        this.dragMoved = false;
        this.lastPointer = { x: e.clientX, y: e.clientY };
      } else if (this.activePointers.size === 2) {
        this.isDragging = false;
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

      // Two-finger pinch-to-zoom for Android & touchscreens
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

      if (!this.isDragging) return;
      const dx = e.clientX - this.lastPointer.x;
      const dy = e.clientY - this.lastPointer.y;
      if (Math.hypot(dx, dy) > 4) this.dragMoved = true;

      this.targetYaw -= dx * 0.0065;
      this.targetPitch = Math.max(-1.38, Math.min(1.38, this.targetPitch + dy * 0.0065));
      this.lastPointer = { x: e.clientX, y: e.clientY };
    });

    const releasePointer = (e) => {
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
      }
    };

    el.addEventListener('pointerup', releasePointer);
    el.addEventListener('pointercancel', releasePointer);

    // Continuous logarithmic scale zoom via mouse wheel
    el.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const delta = e.deltaY * 0.0032;
        this.engine.setTargetLogScale(this.engine.targetLogScale + delta);
      },
      { passive: false }
    );

    // Keyboard camera & surface flight controls (WASD / Arrows / Q & E)
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      this.keysPressed.add(e.key.toLowerCase());
    });
    window.addEventListener('keyup', (e) => {
      this.keysPressed.delete(e.key.toLowerCase());
    });
  }

  handleSpatialClick(clientX, clientY) {
    let closest = null;
    let minDist = 34;
    for (const target of this.interactiveTargets) {
      const d = Math.hypot(clientX - target.screenX, clientY - target.screenY);
      if (d < Math.max(minDist, target.hitRadius || 24)) {
        minDist = d;
        closest = target;
      }
    }

    if (!closest) return;

    if (closest.type === 'supercluster') {
      const same = this.engine.activeSuperclusterIndex === closest.index;
      this.engine.selectSupercluster(closest.index, same);
    } else if (closest.type === 'galaxy') {
      const same = this.engine.activeGalaxyIndex === closest.index;
      this.engine.selectGalaxy(closest.index, same);
    } else if (closest.type === 'system') {
      const same = this.engine.activeSystemIndex === closest.index;
      this.engine.selectStarSystem(closest.index, same);
    } else if (closest.type === 'planet') {
      const same = this.engine.activePlanetIndex === closest.index;
      this.engine.selectPlanet(closest.index, true);
      if (same && this.engine.currentLogScale < 8.5) {
        this.engine.flyToScale(5); // Descend to surface on second click!
      }
    } else if (closest.type === 'landmark') {
      this.engine.selectLandmark(closest.index, true);
    } else if (closest.type === 'clade') {
      this.engine.selectClade(closest.index, true);
    } else if (closest.type === 'star_center') {
      this.engine.flyToScale(3);
    }
  }

  /**
   * Project a 3D world point [x, y, z] into 2D screen coordinates matching the WebGL camera matrix
   */
  project3D(point3D, camDist = 3.35) {
    const [x, y, z] = point3D;
    const cy = Math.cos(this.yaw);
    const sy = Math.sin(this.yaw);
    const cp = Math.cos(this.pitch);
    const sp = Math.sin(this.pitch);

    const forward = [sy * cp, sp, cy * cp];
    // Right = normalize(cross(forward, [0, 1, 0])) = normalize([-forward.z, 0, forward.x])
    const rLen = Math.hypot(forward[2], forward[0]) || 1;
    const right = [-forward[2] / rLen, 0, forward[0] / rLen];
    // Up = cross(right, forward)
    const up = [
      right[1] * forward[2] - right[2] * forward[1],
      right[2] * forward[0] - right[0] * forward[2],
      right[0] * forward[1] - right[1] * forward[0]
    ];

    // Camera position in world space
    const ro = [-forward[0] * camDist, -forward[1] * camDist, -forward[2] * camDist];
    const rel = [x - ro[0], y - ro[1], z - ro[2]];

    const vx = rel[0] * right[0] + rel[1] * right[1] + rel[2] * right[2];
    const vy = rel[0] * up[0] + rel[1] * up[1] + rel[2] * up[2];
    const vz = rel[0] * forward[0] + rel[1] * forward[1] + rel[2] * forward[2];

    if (vz <= 0.15) {
      return { visible: false, x: 0, y: 0, depth: vz, scale: 0 };
    }

    const fov = 1.55;
    const aspect = this.width / Math.max(1, this.height);
    const ndcX = (vx * fov) / (vz * aspect);
    const ndcY = (vy * fov) / vz;

    const screenX = (ndcX * 0.5 + 0.5) * this.width;
    const screenY = (-ndcY * 0.5 + 0.5) * this.height;

    return {
      visible: true,
      x: screenX,
      y: screenY,
      depth: vz,
      scale: fov / vz
    };
  }

  /**
   * Main render loop execution
   */
  render(dtSeconds) {
    // Update FPS counter
    this._frameCount++;
    const now = performance.now();
    if (now - this._fpsTimer >= 500) {
      this.fps = Math.round((this._frameCount * 1000) / (now - this._fpsTimer));
      this._frameCount = 0;
      this._fpsTimer = now;
    }

    // Apply WASD / Arrow / Q-E flight controls
    if (this.keysPressed.size > 0) {
      const k = this.keysPressed;
      const isSurface = this.engine.currentLogScale < 4.5;
      const speed = dtSeconds * (isSurface ? 2.4 : 1.2);
      if (k.has('a') || k.has('arrowleft')) this.targetYaw -= speed;
      if (k.has('d') || k.has('arrowright')) this.targetYaw += speed;
      if (k.has('w') || k.has('arrowup')) {
        if (isSurface) {
          this.surfaceOffset.x += Math.sin(this.yaw * 0.72) * speed * 1.4;
          this.surfaceOffset.z += Math.cos(this.yaw * 0.72) * speed * 1.4;
        } else {
          this.targetPitch = Math.min(1.38, this.targetPitch + speed * 0.75);
        }
      }
      if (k.has('s') || k.has('arrowdown')) {
        if (isSurface) {
          this.surfaceOffset.x -= Math.sin(this.yaw * 0.72) * speed * 1.4;
          this.surfaceOffset.z -= Math.cos(this.yaw * 0.72) * speed * 1.4;
        } else {
          this.targetPitch = Math.max(-1.38, this.targetPitch - speed * 0.75);
        }
      }
      if (k.has('q')) this.engine.setTargetLogScale(this.engine.targetLogScale + dtSeconds * 3.8);
      if (k.has('e')) this.engine.setTargetLogScale(this.engine.targetLogScale - dtSeconds * 3.8);
    }

    // Smooth orbital camera interpolation
    this.yaw += (this.targetYaw - this.yaw) * Math.min(1.0, dtSeconds * 10.0);
    this.pitch += (this.targetPitch - this.pitch) * Math.min(1.0, dtSeconds * 10.0);

    // Subtle slow orbital drift when not dragging
    if (!this.isDragging) {
      this.targetYaw += dtSeconds * (this.engine.autopilotActive ? 0.14 : 0.028);
    }

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

    gl.uniform2f(this.uniforms.u_resolution, this.webglCanvas.width, this.webglCanvas.height);
    gl.uniform1f(this.uniforms.u_time, eng.visualTime);
    gl.uniform1f(this.uniforms.u_logScale, eng.currentLogScale);
    gl.uniform2f(this.uniforms.u_cameraAngles, this.yaw, this.pitch);
    gl.uniform2f(this.uniforms.u_surfaceOffset, this.surfaceOffset.x, this.surfaceOffset.z);
    gl.uniform1f(this.uniforms.u_cameraZoom, this.cameraZoom);
    gl.uniform1f(this.uniforms.u_warpFactor, eng.warpFactor || 0.0);
    gl.uniform1f(this.uniforms.u_seed, (sys.seed % 10000) * 0.1);

    // Star uniforms
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
    gl.uniform3fv(
      this.uniforms.u_companionColor,
      sys.companion ? sys.companion.rgb : [0.8, 0.9, 1.0]
    );

    // Galaxy uniforms
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

    // Planet uniforms
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
        planet.biosphere.active && planet.biosphere.foliageRGB
          ? planet.biosphere.foliageRGB
          : planet.palette.lowland
      );
      gl.uniform1f(this.uniforms.u_oceanCoverage, planet.oceanCoverage);
      gl.uniform1f(this.uniforms.u_iceCoverage, planet.iceCoverage);
      gl.uniform1f(this.uniforms.u_cloudCoverage, planet.cloudCoverage);
      gl.uniform1f(this.uniforms.u_terrainRoughness, planet.terrainRoughness);
      gl.uniform1f(this.uniforms.u_volcanism, planet.volcanism);
      gl.uniform1f(this.uniforms.u_pressureAtm, planet.pressureAtm);
      gl.uniform1f(
        this.uniforms.u_bioComplexity,
        planet.biosphere.active ? planet.biosphere.complexityIndex : 0.0
      );
      gl.uniform1f(
        this.uniforms.u_cityLights,
        planet.civilization.active ? planet.civilization.cityLightIntensity : 0.0
      );
      gl.uniform1f(this.uniforms.u_isTidallyLocked, planet.isTidallyLocked ? 1.0 : 0.0);
      gl.uniform1f(this.uniforms.u_hasRings, planet.rings ? 1.0 : 0.0);
      gl.uniform1f(this.uniforms.u_ringInner, planet.rings ? planet.rings.innerRadiusRatio : 1.4);
      gl.uniform1f(this.uniforms.u_ringOuter, planet.rings ? planet.rings.outerRadiusRatio : 2.3);
      gl.uniform1f(this.uniforms.u_planetSeed, (planet.seed % 1000) * 0.1);
    }

    // Transient phenomena uniforms
    gl.uniform1f(this.uniforms.u_superflare, eng.transientEffects.superflareIntensity);
    gl.uniform1f(this.uniforms.u_impactFlash, eng.transientEffects.impactFlashIntensity);
    gl.uniform1f(this.uniforms.u_evoPulse, eng.transientEffects.evolutionPulseIntensity);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  /**
   * Synchronized 2D/3D High-DPI Astrographic Vector Telemetry & Interactive Picking Layer
   */
  renderAstrographicOverlayPass() {
    const ctx = this.ctx;
    const dpr = this.dpr;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);

    this.interactiveTargets = [];
    const s = this.engine.currentLogScale;

    // Blend weights matching the GLSL shader scale zones
    const wCosmos = this.smoothstep(21.4, 23.0, s);
    const wGalaxy = this.smoothstep(17.5, 19.2, s) * (1.0 - this.smoothstep(22.2, 23.6, s));
    const wSector = this.smoothstep(14.5, 15.8, s) * (1.0 - this.smoothstep(18.0, 19.4, s));
    const wSystem = this.smoothstep(9.5, 10.8, s) * (1.0 - this.smoothstep(14.5, 15.8, s));
    const wPlanet = this.smoothstep(3.5, 4.9, s) * (1.0 - this.smoothstep(9.5, 10.8, s));
    const wSurface = 1.0 - this.smoothstep(3.4, 4.9, s);

    if (wCosmos > 0.05) this.drawCosmosOverlay(ctx, wCosmos);
    if (wGalaxy > 0.05) this.drawGalaxyOverlay(ctx, wGalaxy);
    if (wSector > 0.05) this.drawStellarSectorOverlay(ctx, wSector);
    if (wSystem > 0.05) this.drawPlanetarySystemOverlay(ctx, wSystem);
    if (wPlanet > 0.05) this.drawPlanetOrbitOverlay(ctx, wPlanet);
    if (wSurface > 0.05) this.drawSurfaceAndBioOverlay(ctx, wSurface);

    // Update hover cursor feedback
    this.hoveredTarget = null;
    for (const target of this.interactiveTargets) {
      const d = Math.hypot(this.hoverPointer.x - target.screenX, this.hoverPointer.y - target.screenY);
      if (d < (target.hitRadius || 24)) {
        this.hoveredTarget = target;
        break;
      }
    }
    this.overlayCanvas.style.cursor = this.hoveredTarget ? 'pointer' : this.isDragging ? 'grabbing' : 'grab';

    if (this.hoveredTarget) {
      this.drawHoverReticle(ctx, this.hoveredTarget);
    }

    ctx.restore();
  }

  smoothstep(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  /**
   * SCALE 1 OVERLAY: Cosmic Web Filaments, Voids & Superclusters
   */
  drawCosmosOverlay(ctx, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const web = this.engine.cosmicWeb;
    const activeIdx = this.engine.activeSuperclusterIndex;

    // 1. Draw Cosmic Filaments connecting superclusters
    for (const fil of web.filaments) {
      const pA = this.project3D(fil.start, 4.2);
      const pB = this.project3D(fil.end, 4.2);
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

    // 2. Draw Cosmic Voids
    for (const v of web.voids) {
      const pV = this.project3D(v.position, 4.2);
      if (!pV.visible) continue;
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.arc(pV.x, pV.y, 26 * pV.scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
      ctx.font = '500 10px "JetBrains Mono", monospace';
      ctx.fillText(`${v.name.toUpperCase()} (δ=${v.underdensityDelta.toFixed(2)})`, pV.x - 42, pV.y + 4);
    }

    // 3. Draw Supercluster Nodes
    web.superclusters.forEach((sc, idx) => {
      const proj = this.project3D(sc.position, 4.2);
      if (!proj.visible) return;
      const isSelected = idx === activeIdx;
      const radius = (isSelected ? 10 : 6.5) * Math.min(1.6, proj.scale * 1.8);

      // Outer glow
      const [r, g, b] = sc.color.map((c) => Math.round(c * 255));
      const glow = ctx.createRadialGradient(proj.x, proj.y, 1, proj.x, proj.y, radius * 3.8);
      glow.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.85)`);
      glow.addColorStop(0.4, `rgba(${r}, ${g}, ${b}, 0.25)`);
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, radius * 3.8, 0, Math.PI * 2);
      ctx.fill();

      // Core node
      ctx.fillStyle = isSelected ? '#fde047' : `rgb(${r}, ${g}, ${b})`;
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, Math.max(3, radius * 0.55), 0, Math.PI * 2);
      ctx.fill();

      if (isSelected) {
        this.drawSelectionReticle(ctx, proj.x, proj.y, radius * 2.3, '#e5a93c');
      }

      // Telemetry label
      ctx.fillStyle = isSelected ? '#f8fafc' : 'rgba(226, 232, 240, 0.78)';
      ctx.font = isSelected ? '600 11px "Space Grotesk", sans-serif' : '500 10px "Space Grotesk", sans-serif';
      ctx.fillText(sc.name, proj.x + radius + 8, proj.y - 2);
      ctx.fillStyle = 'rgba(148, 163, 184, 0.75)';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText(`${sc.catalogId} • z=${sc.redshift.toFixed(4)} • ${(sc.galaxyCount / 1000).toFixed(1)}k gal`, proj.x + radius + 8, proj.y + 11);

      this.interactiveTargets.push({
        type: 'supercluster',
        index: idx,
        label: sc.name,
        sublabel: `${sc.catalogId} (${sc.galaxyCount.toLocaleString()} galaxies)`,
        screenX: proj.x,
        screenY: proj.y,
        hitRadius: 26
      });
    });

    ctx.restore();
  }

  /**
   * SCALE 2 OVERLAY: Galactic Structure, Nebulae, SMBH & Cluster Galaxies
   */
  drawGalaxyOverlay(ctx, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const gal = this.engine.getActiveGalaxy();

    // 1. Central Supermassive Black Hole Marker
    const pCore = this.project3D([0, 0, 0], 3.35);
    if (pCore.visible) {
      ctx.strokeStyle = 'rgba(229, 169, 60, 0.75)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(pCore.x, pCore.y, 12, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(253, 224, 71, 0.9)';
      ctx.font = '600 10px "JetBrains Mono", monospace';
      ctx.fillText(`SMBH ${gal.smbh.name} (${(gal.smbh.massSolar / 1e6).toFixed(1)}M M☉)`, pCore.x + 16, pCore.y - 4);
    }

    // 2. HII Star-Forming Nebulae inside the Galaxy
    const rot = this.engine.visualTime * 0.035;
    gal.nebulae.forEach((neb) => {
      const [nx, ny, nz] = neb.position;
      const rx = nx * Math.cos(rot) - nz * Math.sin(rot);
      const rz = nx * Math.sin(rot) + nz * Math.cos(rot);
      const pNeb = this.project3D([rx * 1.4, ny, rz * 1.4], 3.35);
      if (!pNeb.visible) return;

      const [r, g, b] = neb.color.map((c) => Math.round(c * 255));
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.65)`;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.arc(pNeb.x, pNeb.y, 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.88)`;
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText(`${neb.name} (${Math.round(neb.radiusPc)} pc)`, pNeb.x + 12, pNeb.y + 3);
    });

    // 3. Active Stellar Sector Beacon (Click to enter Stellar Sector)
    const sectorPos = [Math.cos(rot + 0.8) * 0.75, 0.02, Math.sin(rot + 0.8) * 0.75];
    const pSec = this.project3D(sectorPos, 3.35);
    if (pSec.visible) {
      this.drawSelectionReticle(ctx, pSec.x, pSec.y, 18, '#38bdf8');
      ctx.fillStyle = '#38bdf8';
      ctx.font = '600 11px "Space Grotesk", sans-serif';
      ctx.fillText(`ACTIVE SECTOR: ${this.engine.stellarSector.name}`, pSec.x + 22, pSec.y - 2);
      ctx.fillStyle = 'rgba(226, 232, 240, 0.75)';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText(`Click to explore ${this.engine.stellarSector.systems.length} star systems`, pSec.x + 22, pSec.y + 11);

      this.interactiveTargets.push({
        type: 'system',
        index: this.engine.activeSystemIndex,
        label: this.engine.stellarSector.name,
        sublabel: 'Zoom into Star Sector',
        screenX: pSec.x,
        screenY: pSec.y,
        hitRadius: 30
      });
    }

    ctx.restore();
  }

  /**
   * SCALE 3 OVERLAY: 3D Stellar Sector & Local Star Systems
   */
  drawStellarSectorOverlay(ctx, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const systems = this.engine.stellarSector.systems;
    const activeSysIdx = this.engine.activeSystemIndex;

    // Subtle 3D Galactic Plane Astrographic Grid
    this.drawAstrographicDiscGrid(ctx, 3.35, 'rgba(56, 189, 248, 0.12)');

    systems.forEach((sys, idx) => {
      const pStar = this.project3D(sys.position, 3.35);
      const pPlane = this.project3D([sys.position[0], 0, sys.position[2]], 3.35);
      if (!pStar.visible) return;

      const isSelected = idx === activeSysIdx;

      // Vertical 3D coordinate projection stalk onto galactic reference plane
      if (pPlane.visible) {
        ctx.strokeStyle = isSelected ? 'rgba(229, 169, 60, 0.55)' : 'rgba(148, 163, 184, 0.18)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pStar.x, pStar.y);
        ctx.lineTo(pPlane.x, pPlane.y);
        ctx.stroke();

        ctx.fillStyle = 'rgba(148, 163, 184, 0.35)';
        ctx.beginPath();
        ctx.arc(pPlane.x, pPlane.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Star glow colored by Planck blackbody temperature
      const [r, g, b] = sys.star.rgb.map((c) => Math.round(c * 255));
      const baseR = isSelected ? 9 : 5.5;
      const glow = ctx.createRadialGradient(pStar.x, pStar.y, 1, pStar.x, pStar.y, baseR * 3.2);
      glow.addColorStop(0, '#ffffff');
      glow.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, 0.9)`);
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(pStar.x, pStar.y, baseR * 3.2, 0, Math.PI * 2);
      ctx.fill();

      // Biosignature / Civilization emerald or amber orbital indicator ring
      if (sys.hasCivilization || sys.hasBiosphere) {
        ctx.strokeStyle = sys.hasCivilization ? 'rgba(229, 169, 60, 0.85)' : 'rgba(52, 211, 153, 0.8)';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.arc(pStar.x, pStar.y, baseR * 1.9, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (isSelected) {
        this.drawSelectionReticle(ctx, pStar.x, pStar.y, 20, '#e5a93c');
      }

      // Star system label & spectral classification
      ctx.fillStyle = isSelected ? '#f8fafc' : 'rgba(226, 232, 240, 0.82)';
      ctx.font = isSelected ? '600 11px "Space Grotesk", sans-serif' : '500 10px "Space Grotesk", sans-serif';
      ctx.fillText(sys.name, pStar.x + 12, pStar.y - 2);

      let tag = `${sys.star.spectralClass} • ${Math.round(sys.star.tempK)}K`;
      if (sys.hasCivilization) tag += ' • [CIVILIZATION]';
      else if (sys.hasBiosphere) tag += ' • [LIFE]';

      ctx.fillStyle = sys.hasCivilization
        ? '#e5a93c'
        : sys.hasBiosphere
        ? '#34d399'
        : 'rgba(148, 163, 184, 0.72)';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText(tag, pStar.x + 12, pStar.y + 10);

      this.interactiveTargets.push({
        type: 'system',
        index: idx,
        label: sys.name,
        sublabel: `${sys.star.spectralClass} • ${sys.notableFeature}`,
        screenX: pStar.x,
        screenY: pStar.y,
        hitRadius: 24
      });
    });

    ctx.restore();
  }

  /**
   * SCALE 4 OVERLAY: Keplerian Planetary System Orbits, Habitable Zone, Comets & Planets
   */
  drawPlanetarySystemOverlay(ctx, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;

    const pSys = this.engine.getActivePlanetarySystem();
    const planets = pSys.planets;
    const activePlanetIdx = this.engine.activePlanetIndex;
    const maxAU = planets.length ? planets[planets.length - 1].orbit.a : 10;

    // Non-linear power compression so both inner terrestrial and outer gas giant orbits fit gracefully in 3D view
    const mapAU = (au) => 0.36 + Math.pow(au / Math.max(0.5, maxAU), 0.52) * 1.75;

    // 1. Circumstellar Habitable Zone (CHZ) 3D Ring Band
    if (!pSys.star.isRemnant) {
      const rIn = mapAU(pSys.star.hzInnerAU);
      const rOut = mapAU(pSys.star.hzOuterAU);
      this.draw3DRingBand(ctx, (rIn + rOut) * 0.5, Math.max(2, (rOut - rIn) * 45), 'rgba(52, 211, 153, 0.08)');
    }

    // 2. Asteroid Belt Particle Field
    if (pSys.asteroidBelts && pSys.asteroidBelts.length) {
      const belt = pSys.asteroidBelts[0];
      const rBelt = mapAU((belt.innerRadiusAU + belt.outerRadiusAU) * 0.5);
      ctx.fillStyle = 'rgba(148, 163, 184, 0.42)';
      for (let a = 0; a < 140; a++) {
        const theta = a * 2.39996 + this.engine.visualTime * 0.03;
        const rad = rBelt + Math.sin(a * 17.3) * 0.06;
        const py = Math.cos(a * 9.1) * 0.03;
        const proj = this.project3D([Math.cos(theta) * rad, py, Math.sin(theta) * rad], 3.35);
        if (proj.visible) {
          ctx.fillRect(proj.x, proj.y, 1.6, 1.6);
        }
      }
    }

    // 3. Comets with Dual Ion & Dust Tails oriented away from the Star
    if (pSys.comets) {
      pSys.comets.forEach((comet) => {
        const state = solveKeplerOrbit(comet.orbit, this.engine.elapsedYears + 1.5);
        const rScaled = mapAU(state.r);
        const len = Math.hypot(state.x, state.y, state.z) || 1;
        const pos3D = [(state.x / len) * rScaled, (state.y / len) * rScaled, (state.z / len) * rScaled];
        const pHead = this.project3D(pos3D, 3.35);
        // Anti-solar tail vector pointing away from star at origin
        const tail3D = [pos3D[0] * 1.28, pos3D[1] * 1.28, pos3D[2] * 1.28];
        const pTail = this.project3D(tail3D, 3.35);

        if (pHead.visible && pTail.visible) {
          const grad = ctx.createLinearGradient(pHead.x, pHead.y, pTail.x, pTail.y);
          grad.addColorStop(0, 'rgba(125, 211, 252, 0.85)');
          grad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
          ctx.strokeStyle = grad;
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(pHead.x, pHead.y);
          ctx.lineTo(pTail.x, pTail.y);
          ctx.stroke();

          ctx.fillStyle = '#e0f2fe';
          ctx.beginPath();
          ctx.arc(pHead.x, pHead.y, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }

    // 4. Planets & Their 3D Keplerian Elliptical Orbits
    planets.forEach((planet, idx) => {
      const isSelected = idx === activePlanetIdx;

      // Draw full 3D elliptical orbit path
      ctx.beginPath();
      let started = false;
      const segments = 72;
      for (let s = 0; s <= segments; s++) {
        const fakeTime = (s / segments) * planet.orbit.periodYears;
        const st = solveKeplerOrbit(planet.orbit, fakeTime);
        const stLen = Math.hypot(st.x, st.y, st.z) || 1;
        const orbScale = mapAU(st.r);
        const pt = [(st.x / stLen) * orbScale, (st.y / stLen) * orbScale, (st.z / stLen) * orbScale];
        const proj = this.project3D(pt, 3.35);
        if (proj.visible) {
          if (!started) {
            ctx.moveTo(proj.x, proj.y);
            started = true;
          } else {
            ctx.lineTo(proj.x, proj.y);
          }
        }
      }
      ctx.strokeStyle = isSelected
        ? 'rgba(229, 169, 60, 0.72)'
        : planet.biosphere.active
        ? 'rgba(52, 211, 153, 0.35)'
        : 'rgba(148, 163, 184, 0.24)';
      ctx.lineWidth = isSelected ? 1.6 : 1.0;
      ctx.stroke();

      // Current planet 3D position
      const liveState = solveKeplerOrbit(planet.orbit, this.engine.elapsedYears);
      const liveLen = Math.hypot(liveState.x, liveState.y, liveState.z) || 1;
      const liveR = mapAU(liveState.r);
      const planet3D = [
        (liveState.x / liveLen) * liveR,
        (liveState.y / liveLen) * liveR,
        (liveState.z / liveLen) * liveR
      ];

      const pProj = this.project3D(planet3D, 3.35);
      if (!pProj.visible) return;

      const bodyR = Math.max(4.5, Math.min(13, Math.pow(planet.radiusEarths, 0.38) * 5.2));
      const [cr, cg, cb] = planet.palette.atmosphere.map((c) => Math.round(c * 255));

      // Planetary ring ellipse if ringed
      if (planet.rings) {
        ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, 0.65)`;
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.ellipse(pProj.x, pProj.y, bodyR * 2.1, bodyR * 0.75, 0.35, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Planet sphere with day/night directional shading away from central star
      const pCenter = this.project3D([0, 0, 0], 3.35);
      const sunAngle = Math.atan2(pCenter.y - pProj.y, pCenter.x - pProj.x);
      const litX = pProj.x + Math.cos(sunAngle) * bodyR * 0.35;
      const litY = pProj.y + Math.sin(sunAngle) * bodyR * 0.35;

      const sphereGrad = ctx.createRadialGradient(litX, litY, 1, pProj.x, pProj.y, bodyR);
      const [lr, lg, lb] = planet.palette.lowland.map((c) => Math.round(c * 255));
      sphereGrad.addColorStop(0, `rgb(${Math.min(255, lr + 55)}, ${Math.min(255, lg + 55)}, ${Math.min(255, lb + 55)})`);
      sphereGrad.addColorStop(0.65, `rgb(${lr}, ${lg}, ${lb})`);
      sphereGrad.addColorStop(1, '#090d16');

      ctx.fillStyle = sphereGrad;
      ctx.beginPath();
      ctx.arc(pProj.x, pProj.y, bodyR, 0, Math.PI * 2);
      ctx.fill();

      // Atmospheric halo
      ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, 0.75)`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(pProj.x, pProj.y, bodyR + 1.5, 0, Math.PI * 2);
      ctx.stroke();

      if (isSelected) {
        this.drawSelectionReticle(ctx, pProj.x, pProj.y, bodyR + 10, '#e5a93c');
      }

      // Label & telemetry
      ctx.fillStyle = isSelected ? '#f8fafc' : 'rgba(226, 232, 240, 0.88)';
      ctx.font = isSelected ? '600 11px "Space Grotesk", sans-serif' : '500 10px "Space Grotesk", sans-serif';
      ctx.fillText(planet.name, pProj.x + bodyR + 8, pProj.y - 2);

      let sub = `${planet.orbit.a.toFixed(2)} AU • ${Math.round(planet.surfaceTempC)}°C`;
      if (planet.civilization.active) sub += ` • K-${planet.civilization.kardashev.toFixed(2)}`;
      else if (planet.biosphere.active) sub += ' • BIOSPHERE';

      ctx.fillStyle = planet.civilization.active
        ? '#e5a93c'
        : planet.biosphere.active
        ? '#34d399'
        : 'rgba(148, 163, 184, 0.78)';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText(sub, pProj.x + bodyR + 8, pProj.y + 10);

      this.interactiveTargets.push({
        type: 'planet',
        index: idx,
        label: planet.name,
        sublabel: `${planet.typeLabel} (${planet.orbit.a.toFixed(2)} AU)`,
        screenX: pProj.x,
        screenY: pProj.y,
        hitRadius: Math.max(22, bodyR + 10)
      });
    });

    ctx.restore();
  }

  /**
   * SCALE 5 OVERLAY: Planetary Globe Landmarks, Orbiting Moons & Civilization Megastructures
   */
  drawPlanetOrbitOverlay(ctx, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const planet = this.engine.getActivePlanet();
    if (!planet) {
      ctx.restore();
      return;
    }

    const planetR = 1.05;
    const rot = this.engine.visualTime * 0.09;

    // 1. Civilization Orbital Ring & Dyson Nodes if active
    if (planet.civilization.active && planet.civilization.kardashev >= 0.8) {
      const ringR = planetR * 1.16;
      ctx.beginPath();
      for (let i = 0; i <= 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        const p3 = [Math.cos(a) * ringR, Math.sin(a * 2) * 0.02, Math.sin(a) * ringR];
        const proj = this.project3D(p3, 3.35);
        if (proj.visible) {
          if (i === 0) ctx.moveTo(proj.x, proj.y);
          else ctx.lineTo(proj.x, proj.y);
        }
      }
      ctx.strokeStyle = 'rgba(229, 169, 60, 0.55)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 2. Orbiting Moons
    planet.moons.forEach((moon, mIdx) => {
      const mOrbitR = 1.55 + mIdx * 0.35;
      const mAngle = moon.angleOffset + this.engine.visualTime * (0.45 / (mIdx + 1));
      const mPos = [
        Math.cos(mAngle) * mOrbitR,
        Math.sin(mAngle * 0.7) * 0.18,
        Math.sin(mAngle) * mOrbitR
      ];
      const pMoon = this.project3D(mPos, 3.35);
      if (!pMoon.visible || (pMoon.depth > 3.35 && Math.hypot(mPos[0], mPos[1]) < planetR)) return;

      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.arc(pMoon.x, pMoon.y, 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(226, 232, 240, 0.8)';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText(`Moon ${moon.name} (${Math.round(moon.radiusKm)} km)`, pMoon.x + 8, pMoon.y + 3);
    });

    // 3. 3D Spherical Surface Landmarks
    const cy = Math.cos(this.yaw);
    const sy = Math.sin(this.yaw);
    const cp = Math.cos(this.pitch);
    const sp = Math.sin(this.pitch);
    const camDir = [sy * cp, sp, cy * cp];

    planet.landmarks.forEach((lm, idx) => {
      const latRad = (lm.lat * Math.PI) / 180;
      const lonRad = (lm.lon * Math.PI) / 180 + rot;

      const nx = Math.cos(latRad) * Math.cos(lonRad);
      const ny = Math.sin(latRad);
      const nz = Math.cos(latRad) * Math.sin(lonRad);

      const facing = -(nx * camDir[0] + ny * camDir[1] + nz * camDir[2]);
      if (facing < 0.18) return;

      const pos3D = [nx * planetR * 1.01, ny * planetR * 1.01, nz * planetR * 1.01];
      const proj = this.project3D(pos3D, 3.35);
      if (!proj.visible) return;

      const isSelected = idx === this.engine.activeLandmarkIndex;
      const pinColor = lm.icon === 'city'
        ? '#e5a93c'
        : lm.icon === 'biosphere'
        ? '#34d399'
        : lm.icon === 'volcano'
        ? '#f43f5e'
        : '#38bdf8';

      ctx.strokeStyle = pinColor;
      ctx.lineWidth = isSelected ? 1.8 : 1.2;
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, isSelected ? 7 : 4.5, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = pinColor;
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = isSelected ? '#ffffff' : 'rgba(241, 245, 249, 0.85)';
      ctx.font = isSelected ? '600 10px "Space Grotesk", sans-serif' : '500 10px "Space Grotesk", sans-serif';
      ctx.fillText(lm.name, proj.x + 10, proj.y - 1);
      ctx.fillStyle = 'rgba(148, 163, 184, 0.78)';
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillText(`${lm.category.split(' ')[0]} • ${lm.lat.toFixed(1)}°, ${lm.lon.toFixed(1)}°`, proj.x + 10, proj.y + 9);

      this.interactiveTargets.push({
        type: 'landmark',
        index: idx,
        label: lm.name,
        sublabel: `${lm.category} (Click to descend to surface)`,
        screenX: proj.x,
        screenY: proj.y,
        hitRadius: 22
      });
    });

    ctx.restore();
  }

  /**
   * SCALE 6 & 7 OVERLAY: Surface Horizon Telemetry, Organism Bio-Morphology & Civilization Nodes
   */
  drawSurfaceAndBioOverlay(ctx, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const planet = this.engine.getActivePlanet();
    const lm = this.engine.getActiveLandmark();
    if (!planet) {
      ctx.restore();
      return;
    }

    const cx = this.width * 0.5;
    const cy = this.height * 0.5;

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 120, 82);
    ctx.lineTo(cx + 120, 82);
    ctx.stroke();

    const headingDeg = Math.round((((this.yaw * 180) / Math.PI) % 360 + 360) % 360);
    ctx.fillStyle = 'rgba(226, 232, 240, 0.82)';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      `AZIMUTH ${headingDeg.toString().padStart(3, '0')}°  •  SITE: ${lm ? lm.name.toUpperCase() : planet.name.toUpperCase()}  •  G=${planet.gravityG.toFixed(2)}g  •  P=${planet.pressureAtm.toFixed(2)} atm`,
      cx,
      74
    );
    ctx.textAlign = 'left';

    if (planet.biosphere.active && planet.biosphere.clades.length > 0) {
      planet.biosphere.clades.forEach((clade, idx) => {
        const angle = (idx - 2) * 0.42 - (this.yaw % 0.6) * 0.3;
        const sx = cx + Math.sin(angle) * (this.width * 0.26);
        const sy = cy + 65 + (idx % 2) * 48;
        const isSelected = idx === this.engine.activeCladeIndex;

        this.drawProceduralOrganismSpecimen(
          ctx,
          sx,
          sy,
          clade,
          isSelected ? 34 : 20,
          this.engine.visualTime,
          isSelected
        );

        this.interactiveTargets.push({
          type: 'clade',
          index: idx,
          label: clade.binomialName,
          sublabel: `${clade.commonArchetype} (Click for morphological scan)`,
          screenX: sx,
          screenY: sy,
          hitRadius: 34
        });
      });
    }

    const wMicro = 1.0 - this.smoothstep(1.1, 2.2, this.engine.currentLogScale);
    if (wMicro > 0.05) {
      ctx.save();
      ctx.globalAlpha = alpha * wMicro;
      this.drawMicroSpecimenHologram(ctx, cx, cy - 10, planet);
      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * Procedural Organism Morphology & Biomechanical Renderer
   */
  drawProceduralOrganismSpecimen(ctx, x, y, clade, radius, time, isSelected) {
    ctx.save();
    const hue = clade.hueDeg;
    const color = `hsl(${hue}, 82%, 62%)`;
    const glowColor = `hsla(${hue}, 90%, 55%, 0.28)`;

    // Outer bio-field aura
    const grad = ctx.createRadialGradient(x, y, 2, x, y, radius * 1.9);
    grad.addColorStop(0, glowColor);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, radius * 1.9, 0, Math.PI * 2);
    ctx.fill();

    // Animated biomechanical appendages / fractal fronds
    const appendages = clade.appendageCount || 6;
    const segments = clade.bodySegments || 6;
    ctx.strokeStyle = color;
    ctx.lineWidth = isSelected ? 1.8 : 1.2;

    if (clade.icon === 'flora' || clade.icon === 'colonial') {
      // Fractal phototrophic / colonial radial morphology
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

        // Bioluminescent photophore node at tip
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ex, ey, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Articulated bilateral / hexapod / cephalopod mobile organism morphology
      for (let s = 0; s < segments; s++) {
        const frac = s / segments;
        const sx = x + (frac - 0.45) * radius * 1.4;
        const sy = y + Math.sin(time * 3.5 + s * 0.9) * (radius * 0.16);
        const segR = radius * (0.36 - Math.abs(frac - 0.35) * 0.28);

        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(2, segR), 0, Math.PI * 2);
        ctx.stroke();

        // Paired articulated limbs
        if (s > 0 && s < segments - 1) {
          const swing = Math.sin(time * 4.2 + s * 1.3) * 0.35;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + Math.sin(swing) * radius * 0.55, sy + radius * 0.65);
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx - Math.sin(swing) * radius * 0.55, sy - radius * 0.55);
          ctx.stroke();
        }
      }
    }

    if (isSelected) {
      this.drawSelectionReticle(ctx, x, y, radius * 1.5, '#34d399');
    }

    ctx.fillStyle = isSelected ? '#ffffff' : 'rgba(226, 232, 240, 0.88)';
    ctx.font = isSelected ? '600 11px "Space Grotesk", sans-serif' : '500 10px "Space Grotesk", sans-serif';
    ctx.fillText(clade.binomialName, x + radius * 1.3, y - 2);
    ctx.fillStyle = color;
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.fillText(`${clade.commonArchetype} (Trophic Lvl ${clade.trophicLevel})`, x + radius * 1.3, y + 10);
    ctx.restore();
  }

  /**
   * High-Detail Scale 7 Micro-Specimen & Civilization Technosphere Holographic Scanner
   */
  drawMicroSpecimenHologram(ctx, cx, cy, planet) {
    const clade = this.engine.getActiveClade();
    const r = 135;

    ctx.strokeStyle = 'rgba(52, 211, 153, 0.35)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.arc(cx, cy, r + 16, -this.engine.visualTime * 0.3, -this.engine.visualTime * 0.3 + Math.PI * 1.5);
    ctx.stroke();
    ctx.setLineDash([]);

    if (clade) {
      this.drawProceduralOrganismSpecimen(ctx, cx, cy, clade, 78, this.engine.visualTime, false);
      ctx.fillStyle = '#34d399';
      ctx.font = '600 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`BIO-MORPHOLOGICAL SCAN: ${clade.binomialName.toUpperCase()}`, cx, cy - r - 26);
      ctx.fillStyle = 'rgba(226, 232, 240, 0.8)';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText(`${clade.symmetry} • ${clade.sensoryMode}`, cx, cy + r + 28);
      ctx.textAlign = 'left';
    } else if (planet.civilization.active) {
      ctx.fillStyle = '#e5a93c';
      ctx.font = '600 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`TECHNOSPHERE MATRIX: ${planet.civilization.speciesName.toUpperCase()}`, cx, cy - r - 24);
      ctx.textAlign = 'left';
    }
  }

  drawAstrographicDiscGrid(ctx, camDist, strokeColor) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1;
    const rings = [0.6, 1.2, 1.8];
    for (const rad of rings) {
      ctx.beginPath();
      let started = false;
      for (let i = 0; i <= 48; i++) {
        const a = (i / 48) * Math.PI * 2;
        const p = this.project3D([Math.cos(a) * rad, 0, Math.sin(a) * rad], camDist);
        if (p.visible) {
          if (!started) {
            ctx.moveTo(p.x, p.y);
            started = true;
          } else {
            ctx.lineTo(p.x, p.y);
          }
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
      const p = this.project3D([Math.cos(a) * radius3D, 0, Math.sin(a) * radius3D], 3.35);
      if (p.visible) {
        if (!started) {
          ctx.moveTo(p.x, p.y);
          started = true;
        } else {
          ctx.lineTo(p.x, p.y);
        }
      }
    }
    ctx.stroke();
  }

  drawSelectionReticle(ctx, x, y, radius, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    const span = 0.42;
    for (let q = 0; q < 4; q++) {
      const a0 = q * (Math.PI * 0.5) + 0.15;
      ctx.beginPath();
      ctx.arc(x, y, radius, a0, a0 + span);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawHoverReticle(ctx, target) {
    ctx.save();
    const { screenX: x, screenY: y } = target;
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
}
