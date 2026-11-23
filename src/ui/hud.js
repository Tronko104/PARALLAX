/**
 * PARALLAX — Scientific Observatory HUD & Telemetry Controller
 * Manages:
 * - Hierarchical Cosmic Breadcrumb navigation
 * - Continuous Logarithmic Scale Slider & 7 Scale Level Presets
 * - Context-Sensitive Spatial Catalog (Superclusters, Galaxies, Stars, Planets, Landmarks, Clades)
 * - 4-Tab Scientific Dossier (Physics/H-R Diagram, Climate/Spectrometer, Life/Trophic Web, Civilization/History)
 * - Multi-Scale Temporal Control Dock & Causal Phenomenon Simulators
 */

import { SCALE_LEVELS } from '../universe/generator.js';
import { TIME_SCALES, COSMIC_WONDERS, SANDBOX_PRESETS } from '../simulation/engine.js';
import { formatLogScale } from '../math/prng.js';

export class ObservatoryHUD {
  constructor(engine, renderer, soundscape) {
    this.engine = engine;
    this.renderer = renderer;
    this.soundscape = soundscape;

    this.activeTab = 'physics';
    this.zenMode = false;

    const isMobile = window.innerWidth <= 860;
    this.leftDrawerCollapsed = isMobile;
    this.rightDrawerCollapsed = isMobile;

    this.cacheDOM();
    this.bindEvents();
    this.renderScalePresets();
    this.renderTimeControls();
    this.renderWondersGrid();
    this.renderAddPresets();
    this.syncDrawerStates();
    this.refreshAll();

    this.engine.onChange((_eng, reason) => {
      if (reason === 'select_planet' || reason === 'scanner_lock' || reason === 'wonder_jump') {
        this.soundscape.playTelemetryPing(660, 0.14);
      } else if (reason === 'phenomenon' || reason === 'explode' || reason === 'nbody_event') {
        this.soundscape.playTelemetryPing(360, 0.24);
      } else if (reason === 'spawn_body') {
        this.soundscape.playTelemetryPing(740, 0.12);
      }
      this.refreshAll();
    });
  }

  cacheDOM() {
    this.introOverlay = document.getElementById('intro-overlay');
    this.btnIntroEnter = document.getElementById('btn-intro-enter');
    this.btnIntroTour = document.getElementById('btn-intro-tour');

    this.wondersModal = document.getElementById('wonders-modal');
    this.wondersGrid = document.getElementById('wonders-grid');
    this.btnOpenWonders = document.getElementById('btn-open-wonders');
    this.btnCloseWonders = document.getElementById('btn-close-wonders');
    this.sectorCoordsBadge = document.getElementById('sector-coords-badge');
    this.btnSectorPrev = document.getElementById('btn-sector-prev');
    this.btnSectorNext = document.getElementById('btn-sector-next');
    this.btnSectorRandom = document.getElementById('btn-sector-random');
    this.btnExportSnapshot = document.getElementById('btn-export-snapshot');
    this.inputImportSnapshot = document.getElementById('input-import-snapshot');

    this.hudLayer = document.getElementById('hud-layer');
    this.leftPanel = document.getElementById('left-navigator-panel');
    this.rightPanel = document.getElementById('right-dossier-panel');
    this.btnToggleLeft = document.getElementById('btn-toggle-left');
    this.btnToggleRight = document.getElementById('btn-toggle-right');

    this.breadcrumbContainer = document.getElementById('cosmic-breadcrumb');
    this.seedInput = document.getElementById('seed-input');
    this.btnApplySeed = document.getElementById('btn-apply-seed');
    this.btnSetiScanner = document.getElementById('btn-seti-scanner');
    this.btnLightingMode = document.getElementById('btn-lighting-mode');
    this.btnQualityMode = document.getElementById('btn-quality-mode');
    this.btnPhotoCapture = document.getElementById('btn-photo-capture');
    this.btnBookmark = document.getElementById('btn-bookmark');
    this.btnAudio = document.getElementById('btn-audio');
    this.btnZen = document.getElementById('btn-zen');

    this.scaleMetricBig = document.getElementById('scale-metric-big');
    this.scaleExponentTag = document.getElementById('scale-exponent-tag');
    this.scaleSlider = document.getElementById('scale-slider');
    this.scalePresetsContainer = document.getElementById('scale-presets-grid');
    this.displayToggleBtns = document.querySelectorAll('.toggle-chip');
    this.catalogHeaderTitle = document.getElementById('catalog-header-title');
    this.catalogCountBadge = document.getElementById('catalog-count-badge');
    this.catalogListContainer = document.getElementById('catalog-list-container');

    this.entityOverline = document.getElementById('entity-category-overline');
    this.entityMainTitle = document.getElementById('entity-main-title');
    this.entityCatalogCode = document.getElementById('entity-catalog-code');
    this.dossierTabBtns = document.querySelectorAll('.dossier-tab-btn');
    this.dossierContent = document.getElementById('dossier-content-scroll');

    this.addToolPalette = document.getElementById('add-tool-palette');
    this.addModeBtns = document.querySelectorAll('[data-add-mode]');
    this.addPresetsBar = document.getElementById('add-presets-bar');
    this.sandboxToolBtns = document.querySelectorAll('.sandbox-tool-btn');
    this.btnReverseTime = document.getElementById('btn-reverse-time');
    this.btnLandToggle = document.getElementById('btn-land-toggle');
    this.btnResetNBody = document.getElementById('btn-reset-nbody');

    this.epochTimeVal = document.getElementById('epoch-time-val');
    this.timePillsContainer = document.getElementById('time-speed-pills');
    this.liveTickerText = document.getElementById('live-ticker-text');
  }

  syncDrawerStates() {
    if (this.leftPanel) this.leftPanel.classList.toggle('collapsed', this.leftDrawerCollapsed);
    if (this.rightPanel) this.rightPanel.classList.toggle('collapsed', this.rightDrawerCollapsed);
  }

  bindEvents() {
    if (this.btnIntroEnter) {
      this.btnIntroEnter.addEventListener('click', () => {
        this.introOverlay.classList.add('dismissed');
      });
    }

    if (this.btnIntroTour) {
      this.btnIntroTour.addEventListener('click', () => {
        this.introOverlay.classList.add('dismissed');
        if (!this.soundscape.enabled) {
          this.soundscape.toggle();
          this.btnAudio.textContent = 'AUDIO: ON';
          this.btnAudio.classList.add('accent-emerald');
        }
        this.leftDrawerCollapsed = true;
        this.rightDrawerCollapsed = true;
        this.syncDrawerStates();
        this.engine.toggleAutopilot(true);
      });
    }

    if (this.btnToggleLeft) {
      this.btnToggleLeft.addEventListener('click', () => {
        this.leftDrawerCollapsed = !this.leftDrawerCollapsed;
        if (window.innerWidth <= 820 && !this.leftDrawerCollapsed) this.rightDrawerCollapsed = true;
        this.syncDrawerStates();
      });
    }

    if (this.btnToggleRight) {
      this.btnToggleRight.addEventListener('click', () => {
        this.rightDrawerCollapsed = !this.rightDrawerCollapsed;
        if (window.innerWidth <= 820 && !this.rightDrawerCollapsed) this.leftDrawerCollapsed = true;
        this.syncDrawerStates();
      });
    }

    if (this.btnOpenWonders) {
      this.btnOpenWonders.addEventListener('click', () => this.wondersModal.classList.remove('hidden'));
    }
    if (this.btnCloseWonders) {
      this.btnCloseWonders.addEventListener('click', () => this.wondersModal.classList.add('hidden'));
    }
    if (this.wondersModal) {
      this.wondersModal.addEventListener('click', (e) => {
        if (e.target === this.wondersModal) this.wondersModal.classList.add('hidden');
      });
    }

    if (this.btnSectorPrev) {
      this.btnSectorPrev.addEventListener('click', () => {
        this.engine.travelCosmicSector(-1, 0, 0);
        this.wondersModal.classList.add('hidden');
      });
    }
    if (this.btnSectorNext) {
      this.btnSectorNext.addEventListener('click', () => {
        this.engine.travelCosmicSector(1, 0, 0);
        this.wondersModal.classList.add('hidden');
      });
    }
    if (this.btnSectorRandom) {
      this.btnSectorRandom.addEventListener('click', () => {
        const dx = Math.floor(Math.random() * 19) - 9 || 3;
        const dy = Math.floor(Math.random() * 9) - 4;
        const dz = Math.floor(Math.random() * 19) - 9 || -2;
        this.engine.travelCosmicSector(dx, dy, dz);
        this.wondersModal.classList.add('hidden');
      });
    }

    if (this.btnExportSnapshot) {
      this.btnExportSnapshot.addEventListener('click', () => {
        const json = this.engine.exportUniverseSnapshot();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `PARALLAX-${this.engine.universeSeed}.json`;
        a.click();
        URL.revokeObjectURL(url);
      });
    }

    if (this.inputImportSnapshot) {
      this.inputImportSnapshot.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            this.engine.importUniverseSnapshot(String(reader.result));
            this.wondersModal.classList.add('hidden');
          } catch (err) {
            this.liveTickerText.textContent = '[ERROR] Invalid universe snapshot JSON.';
          }
        };
        reader.readAsText(file);
      });
    }

    // Lighting Mode (Realistic -> Studio -> Flashlight)
    if (this.btnLightingMode) {
      this.btnLightingMode.addEventListener('click', () => {
        const m = this.engine.cycleLightingMode();
        const labels = ['☀ REALISTIC', '☀ STUDIO', '☀ FLASHLIGHT'];
        this.btnLightingMode.textContent = labels[m];
      });
    }

    // Adaptive Graphics Quality Mode (Auto DRS -> Fast -> Balanced -> Ultra)
    if (this.btnQualityMode) {
      const modes = ['auto', 'low', 'medium', 'ultra'];
      const labels = { auto: '⚙ AUTO DRS', low: '⚙ FAST', medium: '⚙ BALANCED', ultra: '⚙ ULTRA' };
      this.btnQualityMode.addEventListener('click', () => {
        const next = modes[(modes.indexOf(this.engine.qualityMode) + 1) % modes.length];
        this.renderer.setQualityMode(next);
        this.btnQualityMode.textContent = labels[next];
      });
    }

    // F10 Photo Tool
    if (this.btnPhotoCapture) {
      this.btnPhotoCapture.addEventListener('click', () => {
        this.renderer.captureScreenshot();
        this.liveTickerText.textContent = '[PHOTO CAPTURED] High-resolution PNG saved.';
      });
    }

    // Universe Sandbox Display Toggles (O / T / G / H / L)
    this.displayToggleBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.engine.toggleDisplayFlag(btn.dataset.flag);
      });
    });

    // Universe Sandbox Interactive Tool Selector (Select / Add / Laser / Explode)
    this.sandboxToolBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tool = btn.dataset.tool;
        this.engine.setSandboxTool(tool);
        if (tool === 'add' && this.engine.getActiveScaleLevel().index !== 3) {
          this.engine.flyToScale(3); // Fly to Star System so user sees live N-Body placement!
        }
        if (tool === 'laser' && this.engine.getActiveScaleLevel().index !== 4) {
          this.engine.flyToScale(4); // Fly to Planet Globe to watch crust melt & oceans boil!
        }
      });
    });

    // Add Placement Modes (Orbit / Binary / Launch / Still)
    this.addModeBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.engine.addMode = btn.dataset.addMode;
        this.addModeBtns.forEach((b) => b.classList.toggle('active', b === btn));
      });
    });

    // Reverse Time & Reset N-Body & Land Toggle
    if (this.btnReverseTime) {
      this.btnReverseTime.addEventListener('click', () => {
        this.engine.nbody.timeReversed = !this.engine.nbody.timeReversed;
        this.btnReverseTime.classList.toggle('active', this.engine.nbody.timeReversed);
      });
    }

    if (this.btnLandToggle) {
      this.btnLandToggle.addEventListener('click', () => {
        const lvl = this.engine.getActiveScaleLevel();
        this.engine.flyToScale(lvl.index >= 5 ? 4 : 5);
      });
    }

    if (this.btnResetNBody) {
      this.btnResetNBody.addEventListener('click', () => {
        this.engine.refreshPlanetarySystem();
        this.renderer.resetCameraFocus();
        this.liveTickerText.textContent = '[N-BODY RESET] Restored orbital elements & cleared collision debris.';
      });
    }

    this.btnApplySeed.addEventListener('click', () => {
      const val = this.seedInput.value.trim() || `PARALLAX-${Math.floor(Math.random() * 9000 + 1000)}`;
      this.seedInput.value = val;
      this.engine.resetUniverse(val);
    });

    this.seedInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.engine.resetUniverse(this.seedInput.value);
    });

    this.btnSetiScanner.addEventListener('click', () => {
      this.engine.toggleAutopilot(false);
      this.engine.scanAndJumpToNextBiosignature();
    });

    this.btnBookmark.addEventListener('click', () => {
      const bm = this.engine.addBookmark();
      this.soundscape.playTelemetryPing(780, 0.12);
      this.liveTickerText.textContent = `[BOOKMARK SAVED] ${bm.title} (${bm.scaleLabel})`;
    });

    this.btnAudio.addEventListener('click', () => {
      const on = this.soundscape.toggle();
      this.btnAudio.textContent = on ? 'AUDIO: ON' : 'AUDIO';
      this.btnAudio.classList.toggle('accent-emerald', on);
      if (on) this.soundscape.playTelemetryPing(520, 0.18);
    });

    this.btnZen.addEventListener('click', () => this.toggleZenMode());

    // Exact Universe Sandbox 2 Keyboard Shortcuts!
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const key = e.key.toLowerCase();

      if (key === ' ') {
        e.preventDefault();
        this.engine.setTimeScale(this.engine.timeScaleIndex === 0 ? 4 : 0);
      } else if (e.key === ',') {
        this.engine.setTimeScale(this.engine.timeScaleIndex - 1);
      } else if (e.key === '.') {
        this.engine.setTimeScale(this.engine.timeScaleIndex + 1);
      } else if (key === 'c') {
        const lvl = this.engine.getActiveScaleLevel();
        this.engine.flyToScale(lvl.index >= 5 ? 4 : 5);
      } else if (key === 'o') {
        this.engine.toggleDisplayFlag('orbits');
      } else if (key === 't') {
        this.engine.toggleDisplayFlag('trails');
      } else if (key === 'g') {
        this.engine.toggleDisplayFlag('grid');
      } else if (key === 'h') {
        this.engine.toggleDisplayFlag('hz');
      } else if (key === 'l') {
        this.engine.toggleDisplayFlag('labels');
      } else if (key === 'u') {
        this.toggleZenMode();
      } else if (key === 'm') {
        this.btnAudio.click();
      } else if (key === 'v') {
        this.renderer.resetCameraFocus();
      } else if (e.key === 'F10') {
        e.preventDefault();
        this.renderer.captureScreenshot();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        const target = this.engine.getActiveNBodyTarget();
        if (target && this.engine.nbody.deleteBody(target.id)) {
          this.liveTickerText.textContent = `[DELETED] Removed ${target.name} from live simulation.`;
        }
      } else if (e.key === 'Escape') {
        if (this.wondersModal) this.wondersModal.classList.add('hidden');
        this.engine.setSandboxTool('select');
      } else if (e.key >= '1' && e.key <= '7') {
        this.engine.toggleAutopilot(false);
        this.engine.flyToScale(parseInt(e.key, 10) - 1);
      }
    });

    this.scaleSlider.addEventListener('input', (e) => {
      this.engine.toggleAutopilot(false);
      this.engine.setTargetLogScale(parseFloat(e.target.value));
    });

    this.dossierTabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.activeTab = btn.dataset.tab;
        this.dossierTabBtns.forEach((b) => b.classList.toggle('active', b === btn));
        this.renderDossierContent();
      });
    });
  }

  renderAddPresets() {
    if (!this.addPresetsBar) return;
    this.addPresetsBar.innerHTML = '';
    SANDBOX_PRESETS.forEach((preset) => {
      const btn = document.createElement('button');
      btn.className = `preset-chip ${preset.id === this.engine.addPresetId ? 'active' : ''}`;
      btn.dataset.presetId = preset.id;
      btn.textContent = preset.name;
      btn.addEventListener('click', () => {
        this.engine.addPresetId = preset.id;
        this.addPresetsBar.querySelectorAll('.preset-chip').forEach((c) => {
          c.classList.toggle('active', c.dataset.presetId === preset.id);
        });
      });
      this.addPresetsBar.appendChild(btn);
    });
  }

  renderWondersGrid() {
    if (!this.wondersGrid) return;
    this.wondersGrid.innerHTML = '';
    COSMIC_WONDERS.forEach((wonder) => {
      const card = document.createElement('button');
      card.className = 'wonder-card';
      card.innerHTML = `
        <span class="wonder-cat">${wonder.category}</span>
        <span class="wonder-name">${wonder.title}</span>
        <span class="wonder-desc">${wonder.desc}</span>
      `;
      card.addEventListener('click', () => {
        this.engine.toggleAutopilot(false);
        this.renderer.resetCameraFocus();
        this.engine.jumpToWonder(wonder);
        this.wondersModal.classList.add('hidden');
      });
      this.wondersGrid.appendChild(card);
    });
  }

  toggleZenMode() {
    this.zenMode = !this.zenMode;
    this.hudLayer.classList.toggle('zen-mode', this.zenMode);
    this.btnZen.textContent = this.zenMode ? 'SHOW UI' : 'UI';
    this.btnZen.classList.toggle('accent-amber', this.zenMode);
  }

  renderScalePresets() {
    this.scalePresetsContainer.innerHTML = '';
    SCALE_LEVELS.forEach((lvl) => {
      const btn = document.createElement('button');
      btn.className = 'scale-preset-btn';
      btn.dataset.scaleIndex = lvl.index;
      btn.innerHTML = `
        <span>${lvl.index + 1}. ${lvl.name}</span>
        <span style="opacity:0.65">10<sup>${Math.round(lvl.defaultLogScale)}</sup>m</span>
      `;
      btn.addEventListener('click', () => {
        this.engine.flyToScale(lvl.index);
        this.soundscape.playTelemetryPing(420 + lvl.index * 55, 0.1);
      });
      this.scalePresetsContainer.appendChild(btn);
    });
  }

  renderTimeControls() {
    this.timePillsContainer.innerHTML = '';
    TIME_SCALES.forEach((ts, idx) => {
      const btn = document.createElement('button');
      btn.className = 'time-pill-btn';
      btn.dataset.timeIndex = idx;
      btn.title = `${ts.label}: ${ts.desc}`;
      btn.textContent = ts.short;
      btn.addEventListener('click', () => {
        this.engine.setTimeScale(idx);
      });
      this.timePillsContainer.appendChild(btn);
    });
  }

  updateFrameTelemetry() {
    const logS = this.engine.currentLogScale;
    this.scaleMetricBig.textContent = formatLogScale(logS);
    this.scaleExponentTag.textContent = `10^${logS.toFixed(2)} m • ${this.renderer.fps} FPS`;
    if (document.activeElement !== this.scaleSlider) {
      this.scaleSlider.value = logS.toFixed(2);
    }

    const totalGyr = this.engine.baseCosmicEpochGyr + this.engine.elapsedYears / 1e9;
    this.epochTimeVal.textContent = `${totalGyr.toFixed(4)} Gyr (+${this.engine.formatElapsedCosmicTime()})`;

    const activeLvl = this.engine.getActiveScaleLevel();
    if (this._lastActiveLevelId !== activeLvl.id) {
      this._lastActiveLevelId = activeLvl.id;
      this.refreshAll();
    }

    const star = this.engine.getActivePlanetarySystem()?.star;
    const pl = this.engine.getActivePlanet();
    this.soundscape.updateScaleTone(
      logS,
      star ? star.tempK : 5778,
      this.engine.warpFactor || 0,
      pl ? pl.pressureAtm : 1.0
    );
  }

  refreshAll() {
    this.seedInput.value = this.engine.universeSeed;
    const activeLvl = this.engine.getActiveScaleLevel();

    if (this.sectorCoordsBadge) {
      this.sectorCoordsBadge.textContent = `[${this.engine.sectorCoords.join(', ')}]`;
    }

    this.sandboxToolBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tool === this.engine.sandboxTool);
    });

    if (this.addToolPalette) {
      this.addToolPalette.classList.toggle('hidden', this.engine.sandboxTool !== 'add');
    }

    this.displayToggleBtns.forEach((btn) => {
      btn.classList.toggle('active', Boolean(this.engine.displayFlags[btn.dataset.flag]));
    });

    if (this.btnLandToggle) {
      this.btnLandToggle.textContent = activeLvl.index >= 5 ? '↑ Liftoff (C)' : '↓ Land (C)';
    }

    this.scalePresetsContainer.querySelectorAll('.scale-preset-btn').forEach((btn) => {
      const idx = parseInt(btn.dataset.scaleIndex, 10);
      btn.classList.toggle('active', idx === activeLvl.index);
    });

    this.timePillsContainer.querySelectorAll('.time-pill-btn').forEach((btn) => {
      const idx = parseInt(btn.dataset.timeIndex, 10);
      btn.classList.toggle('active', idx === this.engine.timeScaleIndex);
    });

    if (this.engine.globalEvents.length > 0) {
      const latest = this.engine.globalEvents[0];
      this.liveTickerText.textContent = `[${latest.epoch}] ${latest.title} — ${latest.detail}`;
    }

    this.renderBreadcrumb(activeLvl);
    this.renderCatalogList(activeLvl);
    this.renderDossierHeader(activeLvl);
    this.renderDossierContent();
  }

  renderBreadcrumb(activeLvl) {
    const sc = this.engine.getActiveSupercluster();
    const gal = this.engine.getActiveGalaxy();
    const sys = this.engine.getActiveStarSystemSummary();
    const pl = this.engine.getActivePlanet();
    const lm = this.engine.getActiveLandmark();

    const crumbs = [
      { label: 'COSMOS', level: 0, sub: sc.catalogId },
      { label: gal.name.replace(' Galaxy', ''), level: 1, sub: gal.morphology.code },
      { label: 'SECTOR', level: 2, sub: `${this.engine.stellarSector.systems.length} stars` },
      { label: sys.name, level: 3, sub: sys.star.spectralClass },
      { label: pl ? pl.name : 'Planet', level: 4, sub: pl ? `${pl.orbit.a.toFixed(2)} AU` : '' },
      { label: lm ? lm.name.split(' ')[0] : 'Surface', level: 5, sub: pl && pl.biosphere.active ? 'Biosphere' : 'Horizon' }
    ];

    this.breadcrumbContainer.innerHTML = '';
    crumbs.forEach((c, idx) => {
      const btn = document.createElement('button');
      btn.className = `crumb-btn ${activeLvl.index === c.level || (activeLvl.index === 6 && c.level === 5) ? 'active' : ''}`;
      btn.innerHTML = `<span>${c.label}</span><span style="opacity:0.6;font-size:9px">${c.sub}</span>`;
      btn.addEventListener('click', () => {
        this.engine.flyToScale(c.level);
      });
      this.breadcrumbContainer.appendChild(btn);

      if (idx < crumbs.length - 1) {
        const sep = document.createElement('span');
        sep.className = 'crumb-sep';
        sep.textContent = '›';
        this.breadcrumbContainer.appendChild(sep);
      }
    });
  }

  renderCatalogList(activeLvl) {
    this.catalogListContainer.innerHTML = '';

    if (activeLvl.index === 0) {
      const list = this.engine.cosmicWeb.superclusters;
      this.catalogHeaderTitle.textContent = 'Cosmic Superclusters';
      this.catalogCountBadge.textContent = `${list.length} nodes`;

      list.forEach((sc, idx) => {
        const item = this.createCatalogRow({
          name: sc.name,
          sub: `${sc.catalogId} • z=${sc.redshift.toFixed(4)} • ${(sc.galaxyCount / 1000).toFixed(1)}k gal`,
          tagText: `${Math.round(sc.spanMpc)} Mpc`,
          tagClass: 'neutral',
          active: idx === this.engine.activeSuperclusterIndex,
          onClick: () => {
            const same = idx === this.engine.activeSuperclusterIndex;
            this.engine.selectSupercluster(idx, same);
          }
        });
        this.catalogListContainer.appendChild(item);
      });
    } else if (activeLvl.index === 1) {
      const list = this.engine.galaxies;
      this.catalogHeaderTitle.textContent = 'Galactic Catalog';
      this.catalogCountBadge.textContent = `${list.length} galaxies`;

      list.forEach((gal, idx) => {
        const item = this.createCatalogRow({
          name: gal.name,
          sub: `${gal.catalogId} • ${gal.morphology.label} • ${Math.round(gal.diameterLy / 1000)}k ly`,
          tagText: gal.morphology.code,
          tagClass: 'neutral',
          active: idx === this.engine.activeGalaxyIndex,
          onClick: () => {
            const same = idx === this.engine.activeGalaxyIndex;
            this.engine.selectGalaxy(idx, false);
            if (same) this.engine.flyToScale(2);
          }
        });
        this.catalogListContainer.appendChild(item);
      });
    } else if (activeLvl.index === 2) {
      const list = this.engine.stellarSector.systems;
      this.catalogHeaderTitle.textContent = 'Star Systems in Sector';
      this.catalogCountBadge.textContent = `${list.length} systems`;

      list.forEach((sys, idx) => {
        let tagText = sys.star.spectralClass;
        let tagClass = 'neutral';
        if (sys.hasCivilization) {
          tagText = 'CIV';
          tagClass = 'civ';
        } else if (sys.hasBiosphere) {
          tagText = 'LIFE';
          tagClass = 'bio';
        }

        const item = this.createCatalogRow({
          name: sys.name,
          sub: `${sys.catalogId} • ${Math.round(sys.star.tempK)} K • ${sys.planetCount} planets`,
          tagText,
          tagClass,
          active: idx === this.engine.activeSystemIndex,
          onClick: () => {
            const same = idx === this.engine.activeSystemIndex;
            this.engine.selectStarSystem(idx, same);
          }
        });
        this.catalogListContainer.appendChild(item);
      });
    } else if (activeLvl.index === 3 || activeLvl.index === 4) {
      const pSys = this.engine.getActivePlanetarySystem();
      const list = pSys.planets;
      this.catalogHeaderTitle.textContent = `Orbital Bodies (${pSys.name})`;
      this.catalogCountBadge.textContent = `${list.length} planets`;

      list.forEach((pl, idx) => {
        let tagText = `${pl.orbit.a.toFixed(2)} AU`;
        let tagClass = 'neutral';
        if (pl.civilization.active) {
          tagText = `K-${pl.civilization.kardashev.toFixed(2)}`;
          tagClass = 'civ';
        } else if (pl.biosphere.active) {
          tagText = 'LIFE';
          tagClass = 'bio';
        }

        const item = this.createCatalogRow({
          name: pl.name,
          sub: `${pl.typeLabel} • ${Math.round(pl.surfaceTempC)}°C • ${pl.moons.length} moons`,
          tagText,
          tagClass,
          active: idx === this.engine.activePlanetIndex,
          onClick: () => {
            const same = idx === this.engine.activePlanetIndex;
            this.engine.selectPlanet(idx, true);
            if (same && activeLvl.index === 4) {
              this.engine.flyToScale(5);
            }
          }
        });
        this.catalogListContainer.appendChild(item);
      });
    } else {
      const pl = this.engine.getActivePlanet();
      if (!pl) return;
      this.catalogHeaderTitle.textContent = `Sites & Clades on ${pl.name}`;
      const totalItems = pl.landmarks.length + (pl.biosphere.clades ? pl.biosphere.clades.length : 0);
      this.catalogCountBadge.textContent = `${totalItems} entries`;

      pl.landmarks.forEach((lm, idx) => {
        const tagClass = lm.icon === 'city' ? 'civ' : lm.icon === 'biosphere' ? 'bio' : 'neutral';
        const item = this.createCatalogRow({
          name: lm.name,
          sub: `${lm.category} (${lm.lat.toFixed(1)}°, ${lm.lon.toFixed(1)}°)`,
          tagText: lm.icon.toUpperCase(),
          tagClass,
          active: activeLvl.index === 5 && idx === this.engine.activeLandmarkIndex,
          onClick: () => {
            this.engine.selectLandmark(idx, true);
          }
        });
        this.catalogListContainer.appendChild(item);
      });

      if (pl.biosphere.active && pl.biosphere.clades.length) {
        pl.biosphere.clades.forEach((clade, cIdx) => {
          const item = this.createCatalogRow({
            name: clade.binomialName,
            sub: `${clade.commonArchetype} • ${clade.symmetry}`,
            tagText: `T-${clade.trophicLevel}`,
            tagClass: 'bio',
            active: activeLvl.index === 6 && cIdx === this.engine.activeCladeIndex,
            onClick: () => {
              this.engine.selectClade(cIdx, true);
              this.activeTab = 'life';
              this.dossierTabBtns.forEach((b) => b.classList.toggle('active', b.dataset.tab === 'life'));
              this.renderDossierContent();
            }
          });
          this.catalogListContainer.appendChild(item);
        });
      }
    }
  }

  createCatalogRow({ name, sub, tagText, tagClass, active, onClick }) {
    const div = document.createElement('div');
    div.className = `catalog-item ${active ? 'active' : ''}`;
    div.innerHTML = `
      <div class="catalog-item-main">
        <div class="catalog-item-name">${name}</div>
        <div class="catalog-item-sub">${sub}</div>
      </div>
      <span class="catalog-tag ${tagClass}">${tagText}</span>
    `;
    div.addEventListener('click', onClick);
    return div;
  }

  renderDossierHeader(activeLvl) {
    const sc = this.engine.getActiveSupercluster();
    const gal = this.engine.getActiveGalaxy();
    const pSys = this.engine.getActivePlanetarySystem();
    const pl = this.engine.getActivePlanet();

    if (activeLvl.index === 0) {
      this.entityOverline.textContent = `COSMOLOGICAL STRUCTURE • ${sc.dominantMorphology}`;
      this.entityMainTitle.textContent = sc.name;
      this.entityCatalogCode.textContent = sc.catalogId;
    } else if (activeLvl.index === 1) {
      this.entityOverline.textContent = `GALAXY • ${gal.morphology.label}`;
      this.entityMainTitle.textContent = gal.name;
      this.entityCatalogCode.textContent = `${gal.catalogId} (${gal.morphology.code})`;
    } else if (activeLvl.index === 2 || activeLvl.index === 3) {
      this.entityOverline.textContent = `STAR SYSTEM • ${pSys.star.phase}`;
      this.entityMainTitle.textContent = pSys.name;
      this.entityCatalogCode.textContent = `${pSys.catalogId} [${pSys.star.spectralClass}]`;
    } else if (pl) {
      this.entityOverline.textContent = `${pl.typeLabel.toUpperCase()} • ${pSys.name}`;
      this.entityMainTitle.textContent = pl.name;
      this.entityCatalogCode.textContent = `${pl.orbit.a.toFixed(2)} AU • ESI ${(pl.habitabilityScore * 100).toFixed(0)}%`;
    }
  }

  renderDossierContent() {
    const activeLvl = this.engine.getActiveScaleLevel();
    const sc = this.engine.getActiveSupercluster();
    const gal = this.engine.getActiveGalaxy();
    const pSys = this.engine.getActivePlanetarySystem();
    const pl = this.engine.getActivePlanet();

    if (this.activeTab === 'physics') {
      this.renderPhysicsTab(activeLvl, sc, gal, pSys, pl);
    } else if (this.activeTab === 'climate') {
      this.renderClimateTab(pSys, pl);
    } else if (this.activeTab === 'life') {
      this.renderLifeTab(pSys, pl);
    } else if (this.activeTab === 'civ') {
      this.renderCivTab(pSys, pl);
    }
  }

  renderPhysicsTab(activeLvl, sc, gal, pSys, pl) {
    const star = pSys.star;

    let telemetryHTML = '';
    if (activeLvl.index === 0) {
      telemetryHTML = `
        <div class="telemetry-grid">
          <div class="telemetry-cell">
            <div class="telemetry-label">Total Virial Mass</div>
            <div class="telemetry-val highlight-amber">10<sup>${sc.massLogSolar.toFixed(2)}</sup> M☉</div>
          </div>
          <div class="telemetry-cell">
            <div class="telemetry-label">Cosmological Redshift</div>
            <div class="telemetry-val highlight-cyan">z = ${sc.redshift.toFixed(4)}</div>
          </div>
          <div class="telemetry-cell">
            <div class="telemetry-label">Cataloged Galaxies</div>
            <div class="telemetry-val">${sc.galaxyCount.toLocaleString()}</div>
          </div>
          <div class="telemetry-cell">
            <div class="telemetry-label">Dark Matter Fraction</div>
            <div class="telemetry-val">${(sc.darkMatterFraction * 100).toFixed(1)}%</div>
          </div>
          <div class="telemetry-cell">
            <div class="telemetry-label">Linear Span</div>
            <div class="telemetry-val">${sc.spanMpc.toFixed(1)} Mpc</div>
          </div>
          <div class="telemetry-cell">
            <div class="telemetry-label">X-Ray ICM Gas Temp</div>
            <div class="telemetry-val">${(sc.icmTempKelvin / 1e6).toFixed(1)} MK</div>
          </div>
        </div>
      `;
    } else if (activeLvl.index === 1) {
      telemetryHTML = `
        <div class="telemetry-grid">
          <div class="telemetry-cell">
            <div class="telemetry-label">Hubble Classification</div>
            <div class="telemetry-val highlight-amber">${gal.morphology.code}</div>
          </div>
          <div class="telemetry-cell">
            <div class="telemetry-label">Disk Diameter</div>
            <div class="telemetry-val highlight-cyan">${Math.round(gal.diameterLy).toLocaleString()} ly</div>
          </div>
          <div class="telemetry-cell">
            <div class="telemetry-label">Stellar Population</div>
            <div class="telemetry-val">~${gal.starCountBillions.toFixed(0)} Billion</div>
          </div>
          <div class="telemetry-cell">
            <div class="telemetry-label">Central SMBH</div>
            <div class="telemetry-val">${(gal.smbh.massSolar / 1e6).toFixed(2)}×10⁶ M☉</div>
          </div>
          <div class="telemetry-cell">
            <div class="telemetry-label">Mean Galactic Age</div>
            <div class="telemetry-val">${gal.ageGyr.toFixed(2)} Gyr</div>
          </div>
          <div class="telemetry-cell">
            <div class="telemetry-label">Mean Metallicity</div>
            <div class="telemetry-val">[Fe/H] ${gal.metallicityFeH >= 0 ? '+' : ''}${gal.metallicityFeH.toFixed(2)}</div>
          </div>
        </div>
      `;
    } else {
      telemetryHTML = `
        <div class="telemetry-grid">
          <div class="telemetry-cell">
            <div class="telemetry-label">Host Star (${star.spectralClass})</div>
            <div class="telemetry-val" style="color:${star.hexColor}">${Math.round(star.tempK)} K • ${star.currentMassSolar.toFixed(2)} M☉</div>
          </div>
          <div class="telemetry-cell">
            <div class="telemetry-label">Luminosity & Radius</div>
            <div class="telemetry-val">${star.luminositySolar < 0.01 ? star.luminositySolar.toExponential(1) : star.luminositySolar.toFixed(2)} L☉ • ${star.radiusSolar < 0.05 ? star.radiusSolar.toFixed(4) : star.radiusSolar.toFixed(2)} R☉</div>
          </div>
          <div class="telemetry-cell">
            <div class="telemetry-label">Age / MS Lifetime</div>
            <div class="telemetry-val">${pSys.currentAgeGyr.toFixed(2)} / ${star.msLifetimeGyr.toFixed(2)} Gyr</div>
          </div>
          <div class="telemetry-cell">
            <div class="telemetry-label">Habitable Zone (CHZ)</div>
            <div class="telemetry-val highlight-emerald">${star.hzInnerAU.toFixed(2)} – ${star.hzOuterAU.toFixed(2)} AU</div>
          </div>
          <div class="telemetry-cell">
            <div class="telemetry-label">${pl.name} (Mass/Radius)</div>
            <div class="telemetry-val highlight-cyan">${pl.massEarths.toFixed(2)} M⊕ • ${Math.round(pl.radiusKm).toLocaleString()} km</div>
          </div>
          <div class="telemetry-cell">
            <div class="telemetry-label">Gravity & Escape Vel.</div>
            <div class="telemetry-val">${pl.gravityG.toFixed(2)} g • ${pl.escapeVelocityKmS.toFixed(1)} km/s</div>
          </div>
          <div class="telemetry-cell">
            <div class="telemetry-label">Semi-Major & Period</div>
            <div class="telemetry-val">${pl.orbit.a.toFixed(3)} AU • ${pl.orbit.periodYears.toFixed(2)} yr</div>
          </div>
          <div class="telemetry-cell">
            <div class="telemetry-label">Magnetic Field & Tectonics</div>
            <div class="telemetry-val">${pl.magneticFieldGauss.toFixed(2)} G • ${(pl.tectonics * 100).toFixed(0)}%</div>
          </div>
        </div>
      `;
    }

    this.dossierContent.innerHTML = `
      ${telemetryHTML}
      <div class="instrument-box">
        <div class="instrument-header">
          <span class="instrument-title">Hertzsprung-Russell (H-R) Evolutionary Diagram</span>
          <span class="panel-badge">${star.spectralClass} (${(star.lifeFraction * 100).toFixed(0)}% MS)</span>
        </div>
        <canvas id="hr-diagram-canvas" class="instrument-canvas" width="330" height="150"></canvas>
      </div>
      <div class="instrument-box">
        <div class="instrument-header">
          <span class="instrument-title">Orbital System Architecture (${pSys.planets.length} Planets)</span>
          <span style="font-family:var(--font-mono);font-size:10px;color:var(--text-secondary)">Frost Line: ${star.frostLineAU.toFixed(2)} AU</span>
        </div>
        <div class="comp-bar-list">
          ${pSys.planets
            .map(
              (p, idx) => `
            <div class="comp-row" style="cursor:pointer" data-jump-planet="${idx}">
              <div class="comp-row-label">
                <span style="color:${idx === this.engine.activePlanetIndex ? 'var(--accent-amber)' : 'var(--text-primary)'}">
                  ${idx === this.engine.activePlanetIndex ? '▸ ' : ''}${p.name} (${p.typeLabel.split(' ')[0]})
                </span>
                <span style="color:var(--text-secondary)">${p.orbit.a.toFixed(2)} AU • ${Math.round(p.surfaceTempC)}°C</span>
              </div>
              <div class="comp-track">
                <div class="comp-fill" style="width:${Math.min(100, p.habitabilityScore * 100)}%;background:${
                p.civilization.active ? 'var(--accent-amber)' : p.biosphere.active ? 'var(--accent-emerald)' : 'var(--accent-cyan)'
              }"></div>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `;

    this.dossierContent.querySelectorAll('[data-jump-planet]').forEach((el) => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.jumpPlanet, 10);
        this.engine.selectPlanet(idx, true);
      });
    });

    this.drawHRDiagramCanvas(star);
  }

  drawHRDiagramCanvas(star) {
    const canvas = document.getElementById('hr-diagram-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
    ctx.lineWidth = 1;
    for (let x = 40; x < w; x += 55) {
      ctx.beginPath();
      ctx.moveTo(x, 10);
      ctx.lineTo(x, h - 22);
      ctx.stroke();
    }
    for (let y = 20; y < h - 20; y += 30) {
      ctx.beginPath();
      ctx.moveTo(30, y);
      ctx.lineTo(w - 10, y);
      ctx.stroke();
    }

    const grad = ctx.createLinearGradient(40, 18, w - 25, h - 28);
    grad.addColorStop(0, 'rgba(96, 165, 250, 0.35)');
    grad.addColorStop(0.45, 'rgba(253, 224, 71, 0.35)');
    grad.addColorStop(1, 'rgba(248, 113, 113, 0.35)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(45, 22);
    ctx.quadraticCurveTo(w * 0.5, h * 0.52, w - 30, h - 30);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(251, 146, 60, 0.28)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(w * 0.55, h * 0.55);
    ctx.quadraticCurveTo(w * 0.72, h * 0.25, w - 38, 28);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(147, 197, 253, 0.25)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(65, h - 48);
    ctx.lineTo(175, h - 26);
    ctx.stroke();

    const logT = Math.log10(Math.max(2500, Math.min(42000, star.tempK)));
    const minLogT = Math.log10(2500);
    const maxLogT = Math.log10(42000);
    const sx = 35 + (1 - (logT - minLogT) / (maxLogT - minLogT)) * (w - 60);

    const logL = Math.log10(Math.max(1e-4, Math.min(1e6, star.luminositySolar)));
    const sy = (h - 26) - ((logL + 4) / 10) * (h - 44);

    ctx.strokeStyle = 'rgba(229, 169, 60, 0.6)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(sx, 10);
    ctx.lineTo(sx, h - 22);
    ctx.moveTo(30, sy);
    ctx.lineTo(w - 10, sy);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = star.hexColor;
    ctx.beginPath();
    ctx.arc(sx, sy, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px "JetBrains Mono", monospace';
    const classes = ['O', 'B', 'A', 'F', 'G', 'K', 'M'];
    classes.forEach((c, i) => {
      ctx.fillText(c, 42 + i * 42, h - 7);
    });
    ctx.fillText('L☉', 6, 20);
  }

  renderClimateTab(pSys, pl) {
    if (!pl) return;
    this.dossierContent.innerHTML = `
      <div class="telemetry-grid">
        <div class="telemetry-cell">
          <div class="telemetry-label">Surface Temperature</div>
          <div class="telemetry-val highlight-amber">${pl.surfaceTempC.toFixed(1)} °C (${Math.round(pl.surfaceTempK)} K)</div>
        </div>
        <div class="telemetry-cell">
          <div class="telemetry-label">Equilibrium & Greenhouse</div>
          <div class="telemetry-val">${Math.round(pl.eqTempK)} K (+${Math.round(pl.greenhouseDeltaK)} K)</div>
        </div>
        <div class="telemetry-cell">
          <div class="telemetry-label">Surface Pressure</div>
          <div class="telemetry-val highlight-cyan">${pl.pressureAtm < 0.01 ? pl.pressureAtm.toExponential(1) : pl.pressureAtm.toFixed(2)} atm</div>
        </div>
        <div class="telemetry-cell">
          <div class="telemetry-label">Bond Albedo & Clouds</div>
          <div class="telemetry-val">${pl.albedo.toFixed(2)} • ${(pl.cloudCoverage * 100).toFixed(0)}% clouds</div>
        </div>
        <div class="telemetry-cell">
          <div class="telemetry-label">Hydrosphere / Oceans</div>
          <div class="telemetry-val">${(pl.oceanCoverage * 100).toFixed(0)}% coverage</div>
        </div>
        <div class="telemetry-cell">
          <div class="telemetry-label">Earth Similarity Index</div>
          <div class="telemetry-val highlight-emerald">${(pl.habitabilityScore * 100).toFixed(1)}%</div>
        </div>
        <div class="telemetry-cell">
          <div class="telemetry-label">Scale Height & Wind</div>
          <div class="telemetry-val">${(pl.scaleHeightKm || 8.5).toFixed(1)} km • ${pl.surfaceWindKmH || 0} km/h</div>
        </div>
        <div class="telemetry-cell">
          <div class="telemetry-label">Rotation / Tidal State</div>
          <div class="telemetry-val">${pl.isTidallyLocked ? 'Tidally Locked (1:1)' : `${pl.rotationPeriodHours.toFixed(1)} h day`}</div>
        </div>
      </div>

      <div class="instrument-box">
        <div class="instrument-header">
          <span class="instrument-title">Live Sandbox Property Editor (Real-Time Physics)</span>
          <span class="panel-badge">INTERACTIVE</span>
        </div>
        <div class="comp-bar-list">
          <div class="comp-row">
            <div class="comp-row-label">
              <span>Surface Temperature</span>
              <span style="color:var(--accent-amber)">${pl.surfaceTempC.toFixed(0)} °C</span>
            </div>
            <input id="edit-temp" class="live-editor-slider" type="range" min="-220" max="2200" step="10" value="${Math.round(pl.surfaceTempC)}" />
          </div>
          <div class="comp-row">
            <div class="comp-row-label">
              <span>Liquid Ocean / Water Level</span>
              <span style="color:var(--accent-cyan)">${Math.round(pl.oceanCoverage * 100)}%</span>
            </div>
            <input id="edit-ocean" class="live-editor-slider" type="range" min="0" max="100" step="2" value="${Math.round(pl.oceanCoverage * 100)}" />
          </div>
          <div class="comp-row">
            <div class="comp-row-label">
              <span>Atmospheric Pressure</span>
              <span style="color:var(--accent-emerald)">${pl.pressureAtm.toFixed(2)} atm</span>
            </div>
            <input id="edit-pressure" class="live-editor-slider" type="range" min="0" max="25" step="0.2" value="${Math.min(25, pl.pressureAtm).toFixed(1)}" />
          </div>
          <div class="comp-row">
            <div class="comp-row-label">
              <span>Host Star Mass (Changes All Orbits!)</span>
              <span style="color:var(--accent-amber)">${pSys.star.currentMassSolar.toFixed(2)} M☉</span>
            </div>
            <input id="edit-starmass" class="live-editor-slider" type="range" min="0.1" max="12" step="0.1" value="${Math.min(12, pSys.star.currentMassSolar).toFixed(1)}" />
          </div>
          <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:4px">
            <button id="btn-vel-down" class="icon-btn">-10% Orbit Vel</button>
            <button id="btn-vel-up" class="icon-btn">+10% Orbit Vel</button>
            <button id="btn-star-evo-inline" class="action-btn">✦ Age Star +Gyr</button>
          </div>
        </div>
      </div>

      <div class="instrument-box">
        <div class="instrument-header">
          <span class="instrument-title">Tectonic & Geophysical Regime</span>
        </div>
        <div style="font-size:11px;color:var(--text-primary);font-family:var(--font-mono)">
          ${pl.tectonicRegime || 'Active Mobile-Lid Plate Tectonics'}
        </div>
      </div>

      <div class="instrument-box">
        <div class="instrument-header">
          <span class="instrument-title">Atmospheric Absorption Spectrogram (380–780 nm)</span>
          <span class="panel-badge">${pl.biosphere.active ? 'O₂/CH₄ BIOSIGNATURE' : 'ABIOTIC'}</span>
        </div>
        <canvas id="spectrum-canvas" class="instrument-canvas" width="330" height="64"></canvas>
      </div>

      <div class="instrument-box">
        <div class="instrument-header">
          <span class="instrument-title">Atmospheric Chemical Composition</span>
        </div>
        <div class="comp-bar-list">
          ${pl.atmosphereComposition
            .map(
              (gas) => `
            <div class="comp-row">
              <div class="comp-row-label">
                <span style="color:var(--text-primary);font-weight:600">${gas.formula} <span style="color:var(--text-secondary);font-weight:400">— ${gas.name}</span></span>
                <span style="color:${gas.color}">${gas.pct.toFixed(2)}%</span>
              </div>
              <div class="comp-track">
                <div class="comp-fill" style="width:${Math.max(3, gas.pct)}%;background:${gas.color}"></div>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `;

    this.drawAbsorptionSpectrumCanvas(pl);

    const bindSlider = (id, prop, transform = (v) => v) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', (e) => {
          this.engine.editActivePlanetProperty(prop, transform(parseFloat(e.target.value)));
        });
      }
    };
    bindSlider('edit-temp', 'surfaceTempC');
    bindSlider('edit-ocean', 'oceanCoverage', (v) => v / 100);
    bindSlider('edit-pressure', 'pressureAtm');
    bindSlider('edit-starmass', 'starMassSolar');

    const btnDown = document.getElementById('btn-vel-down');
    if (btnDown) btnDown.addEventListener('click', () => this.engine.nbody.scaleAllVelocities(0.9));
    const btnUp = document.getElementById('btn-vel-up');
    if (btnUp) btnUp.addEventListener('click', () => this.engine.nbody.scaleAllVelocities(1.1));
    const btnEvo = document.getElementById('btn-star-evo-inline');
    if (btnEvo) btnEvo.addEventListener('click', () => this.engine.triggerPhenomenon('stellar_evolution_step'));
  }

  drawAbsorptionSpectrumCanvas(pl) {
    const canvas = document.getElementById('spectrum-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0.0, '#3b0764');
    grad.addColorStop(0.18, '#2563eb');
    grad.addColorStop(0.38, '#06b6d4');
    grad.addColorStop(0.55, '#22c55e');
    grad.addColorStop(0.72, '#eab308');
    grad.addColorStop(0.88, '#ef4444');
    grad.addColorStop(1.0, '#7f1d1d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h - 16);

    const bands = [];
    for (const gas of pl.atmosphereComposition) {
      if (gas.formula.includes('O₂')) {
        bands.push({ pos: 0.91, width: 5, label: 'O₂-A' }, { pos: 0.78, width: 3.5, label: 'O₂-B' });
      }
      if (gas.formula.includes('H₂O')) {
        bands.push({ pos: 0.84, width: 4, label: 'H₂O' }, { pos: 0.66, width: 2.5, label: 'H₂O' });
      }
      if (gas.formula.includes('CH₄')) {
        bands.push({ pos: 0.62, width: 4.5, label: 'CH₄' }, { pos: 0.88, width: 3.5, label: 'CH₄' });
      }
      if (gas.formula.includes('CO₂')) {
        bands.push({ pos: 0.74, width: 4, label: 'CO₂' }, { pos: 0.48, width: 2.5, label: 'CO₂' });
      }
      if (gas.formula.includes('N₂')) {
        bands.push({ pos: 0.14, width: 2.5, label: 'N₂' });
      }
      if (gas.formula.includes('Na') || gas.formula.includes('SO₂')) {
        bands.push({ pos: 0.56, width: 4, label: 'Na-D' });
      }
    }

    ctx.fillStyle = 'rgba(5, 7, 11, 0.86)';
    bands.forEach((b) => {
      const bx = b.pos * w;
      ctx.fillRect(bx - b.width * 0.5, 0, b.width, h - 16);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '8px "JetBrains Mono", monospace';
      ctx.fillText(b.label, Math.max(2, Math.min(w - 24, bx - 8)), h - 4);
      ctx.fillStyle = 'rgba(5, 7, 11, 0.86)';
    });
  }

  renderLifeTab(pSys, pl) {
    if (!pl) return;
    const bio = pl.biosphere;

    if (!bio.active) {
      this.dossierContent.innerHTML = `
        <div class="instrument-box" style="text-align:center;padding:18px 12px">
          <div class="entity-category-overline" style="color:var(--text-secondary)">ASTROBIOLOGICAL STATUS</div>
          <div style="font-size:14px;font-weight:600;margin:6px 0">${bio.stage}</div>
          <p style="color:var(--text-secondary);font-size:11px;margin-bottom:12px">
            Current thermodynamic conditions (${pl.surfaceTempC.toFixed(1)}°C, ${pl.pressureAtm.toFixed(2)} atm) do not yet host an active biosphere, or await a catalytic abiogenesis event.
          </p>
          <button id="btn-trigger-abiogenesis-inline" class="action-btn accent-emerald">
            + Catalyze Abiogenesis & Prebiotic Evolution
          </button>
        </div>
      `;
      const btn = document.getElementById('btn-trigger-abiogenesis-inline');
      if (btn) {
        btn.addEventListener('click', () => this.engine.triggerPhenomenon('abiogenesis_surge'));
      }
      return;
    }

    const activeClade = this.engine.getActiveClade() || bio.clades[0];

    this.dossierContent.innerHTML = `
      <div class="telemetry-grid">
        <div class="telemetry-cell">
          <div class="telemetry-label">Global Biomass</div>
          <div class="telemetry-val highlight-emerald">${bio.biomassGt.toLocaleString()} Gt C</div>
        </div>
        <div class="telemetry-cell">
          <div class="telemetry-label">Estimated Biodiversity</div>
          <div class="telemetry-val">${bio.speciesCountEstimate.toLocaleString()} species</div>
        </div>
        <div class="telemetry-cell">
          <div class="telemetry-label">Biochemistry & Solvent</div>
          <div class="telemetry-val" style="font-size:10px">${bio.biochemistry}</div>
        </div>
        <div class="telemetry-cell">
          <div class="telemetry-label">Primary Metabolism</div>
          <div class="telemetry-val" style="font-size:10px">${bio.energySource}</div>
        </div>
      </div>

      ${
        activeClade
          ? `
      <div class="instrument-box">
        <div class="instrument-header">
          <span class="instrument-title">Selected Specimen: ${activeClade.binomialName}</span>
          <span class="panel-badge">${activeClade.commonArchetype}</span>
        </div>
        <div style="font-size:11px;color:var(--text-secondary);display:flex;flex-direction:column;gap:4px">
          <div><strong style="color:var(--text-primary)">Symmetry & Morphology:</strong> ${activeClade.symmetry} (${activeClade.bodySegments} segments)</div>
          <div><strong style="color:var(--text-primary)">Locomotion:</strong> ${activeClade.locomotion}</div>
          <div><strong style="color:var(--text-primary)">Sensory Apparatus:</strong> ${activeClade.sensoryMode}</div>
          <div style="margin-top:4px;color:var(--accent-emerald);font-family:var(--font-mono);font-size:10px">
            Evolutionary Adaptations:
            ${activeClade.traits.map((t) => `<div style="color:var(--text-secondary)">• ${t}</div>`).join('')}
          </div>
        </div>
      </div>
      `
          : ''
      }

      <div class="instrument-box">
        <div class="instrument-header">
          <span class="instrument-title">Trophic Food Web & Phylogenetic Pyramid (Click to Inspect)</span>
        </div>
        <div class="comp-bar-list">
          ${bio.clades
            .map(
              (c, idx) => `
            <div class="comp-row" style="cursor:pointer;padding:4px;border-radius:4px;background:${
              idx === this.engine.activeCladeIndex ? 'rgba(52, 211, 153, 0.14)' : 'transparent'
            }" data-select-clade="${idx}">
              <div class="comp-row-label">
                <span style="color:var(--text-primary);font-weight:600">${c.binomialName} <span style="color:var(--text-secondary);font-weight:400">(${c.commonArchetype})</span></span>
                <span style="color:var(--accent-emerald)">${Math.round(c.biomassShare * 100)}% biomass</span>
              </div>
              <div class="comp-track">
                <div class="comp-fill" style="width:${Math.max(6, c.biomassShare * 100)}%;background:hsl(${c.hueDeg}, 80%, 55%)"></div>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `;

    this.dossierContent.querySelectorAll('[data-select-clade]').forEach((el) => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.selectClade, 10);
        this.engine.selectClade(idx, true);
      });
    });
  }

  renderCivTab(pSys, pl) {
    if (!pl) return;
    const civ = pl.civilization;

    let civSectionHTML = '';
    if (!civ.active) {
      civSectionHTML = `
        <div class="instrument-box" style="text-align:center;padding:14px 10px">
          <div class="entity-category-overline" style="color:var(--text-secondary)">XENO-SOCIOLOGICAL SCAN</div>
          <div style="font-size:13px;font-weight:600;margin:4px 0">${civ.status}</div>
          <p style="color:var(--text-secondary);font-size:11px;margin-bottom:10px">
            No artificial electromagnetic emissions or orbital megastructures detected around ${pl.name}.
          </p>
          <button id="btn-trigger-civ-inline" class="action-btn accent-amber">
            + Catalyze Cognitive Emergence & Kardashev Civilization
          </button>
        </div>
      `;
    } else {
      civSectionHTML = `
        <div class="telemetry-grid">
          <div class="telemetry-cell">
            <div class="telemetry-label">Kardashev Scale</div>
            <div class="telemetry-val highlight-amber">Type ${civ.kardashev.toFixed(2)}</div>
          </div>
          <div class="telemetry-cell">
            <div class="telemetry-label">Species & Population</div>
            <div class="telemetry-val">${civ.populationBillions} Billion</div>
          </div>
          <div class="telemetry-cell">
            <div class="telemetry-label">Installed Energy Output</div>
            <div class="telemetry-val highlight-cyan">${civ.energyPowerTW.toLocaleString()} TW</div>
          </div>
          <div class="telemetry-cell">
            <div class="telemetry-label">Cooperation / Conflict</div>
            <div class="telemetry-val highlight-emerald">${Math.round(civ.cooperationIndex * 100)}% / ${Math.round(civ.conflictRisk * 100)}%</div>
          </div>
        </div>

        <div class="instrument-box">
          <div class="instrument-header">
            <span class="instrument-title">Cultural Ethos: ${civ.ethos.name}</span>
          </div>
          <div style="font-size:11px;color:var(--text-secondary)">
            <div><strong style="color:var(--text-primary)">Dominant Species:</strong> ${civ.speciesName}</div>
            <div><strong style="color:var(--text-primary)">Governance:</strong> ${civ.ethos.governance}</div>
            <div><strong style="color:var(--text-primary)">Doctrine:</strong> ${civ.ethos.philosophy}</div>
          </div>
        </div>

        <div class="instrument-box">
          <div class="instrument-header">
            <span class="instrument-title">Technology Matrix & Orbital Megastructures</span>
          </div>
          <div class="comp-bar-list">
            ${(civ.techDomains || [])
              .map(
                (td) => `
              <div class="comp-row">
                <div class="comp-row-label">
                  <span style="color:var(--text-primary)">${td.name}</span>
                  <span style="color:var(--accent-amber)">${td.progress}%</span>
                </div>
                <div style="font-size:10px;color:var(--text-secondary);margin-bottom:2px">${td.level}</div>
                <div class="comp-track">
                  <div class="comp-fill" style="width:${td.progress}%;background:var(--accent-amber)"></div>
                </div>
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      `;
    }

    const historyList = (civ.history || []).slice().reverse();

    this.dossierContent.innerHTML = `
      ${civSectionHTML}
      <div class="instrument-box">
        <div class="instrument-header">
          <span class="instrument-title">Historical Chronicle & Evolutionary Log of ${pl.name}</span>
        </div>
        <div class="chronicle-timeline">
          ${historyList
            .map(
              (h) => `
            <div class="chronicle-entry">
              <div class="chronicle-epoch">${h.epoch}</div>
              <div class="chronicle-title">${h.title}</div>
              <div class="chronicle-detail">${h.detail}</div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `;

    const btnCiv = document.getElementById('btn-trigger-civ-inline');
    if (btnCiv) {
      btnCiv.addEventListener('click', () => this.engine.triggerPhenomenon('kardashev_breakthrough'));
    }
  }
}
