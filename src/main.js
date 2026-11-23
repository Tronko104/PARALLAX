/**
 * PARALLAX — A Universe Beyond Observation
 * Main Application Bootstrapper & Frame Scheduler
 */

import { SimulationEngine } from './simulation/engine.js';
import { UniverseRenderer } from './renderer/webgl_renderer.js';
import { CosmicSoundscape } from './audio/soundscape.js';
import { ObservatoryHUD } from './ui/hud.js';

function bootstrapParallax() {
  const webglCanvas = document.getElementById('webgl-canvas');
  const overlayCanvas = document.getElementById('overlay-canvas');

  const engine = new SimulationEngine();
  const renderer = new UniverseRenderer(webglCanvas, overlayCanvas, engine);
  const soundscape = new CosmicSoundscape();
  const hud = new ObservatoryHUD(engine, renderer, soundscape);

  // Expose for telemetry inspection
  window.PARALLAX = {
    engine,
    renderer,
    soundscape,
    hud
  };

  let lastFrameTime = performance.now();

  function frameLoop(now) {
    const dtSeconds = (now - lastFrameTime) / 1000;
    lastFrameTime = now;

    engine.step(dtSeconds);
    renderer.render(dtSeconds);
    hud.updateFrameTelemetry();

    requestAnimationFrame(frameLoop);
  }

  requestAnimationFrame(frameLoop);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapParallax);
} else {
  bootstrapParallax();
}
