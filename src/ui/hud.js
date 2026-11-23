/**
 * PARALLAX — Scientific Observatory HUD & Telemetry Controller
 * Manages:
 * - Hierarchical Cosmic Breadcrumb navigation
 * - Continuous Logarithmic Scale Slider & 7 Scale Level Presets
 * - Context-Sensitive Spatial Catalog (Superclusters, Galaxies, Stars, Planets, Landmarks, Clades)
 * - 4-Tab Scientific Dossier (Fisica/H-R Diagram, Atmosfera/Spettroscopia, Biosfera/Rete Trofica, Civiltà/Storia)
 * - Multi-Scale Temporal Control Dock & Causal Phenomenon Simulators
 */

import { SCALE_LEVELS } from '../universe/generator.js';
import { TIME_SCALES } from '../simulation/engine.js';
import { formatLogScale, planckBlackbodyRGB, rgbToHex } from '../math/prng.js';

export class ObservatoryHUD {
  constructor(engine, renderer, soundscape) {
    this.engine = engine;
    this.renderer = renderer;
    this.soundscape = soundscape;

    this.activeTab = 'physics'; // 'physics' | 'climate' | 'life' | 'civ'
    this.zenMode = false;

    this.cacheDOM();
    this.bindEvents();
    this.renderScalePresets();
    this.renderTimeControls();
    this.refreshAll();

    this.engine.onChange((_eng, reason) => {
      if (reason === 'select_planet' || reason === 'scanner_lock') {
        this.soundscape.playTelemetryPing(660, 0.14);
      } else if (reason === 'phenomenon') {
        this.soundscape.playTelemetryPing(440, 0.22);
      }
      this.refreshAll();
    });
  }

  cacheDOM() {
    this.hudLayer = document.getElementById('hud-layer');
    this.breadcrumbContainer = document.getElementById('cosmic-breadcrumb');
    this.seedInput = document.getElementById('seed-input');
    this.btnApplySeed = document.getElementById('btn-apply-seed');
    this.btnSetiScanner = document.getElementById('btn-seti-scanner');
    this.btnBookmark = document.getElementById('btn-bookmark');
    this.btnAudio = document.getElementById('btn-audio');
    this.btnZen = document.getElementById('btn-zen');

    // Left Panel
    this.scaleMetricBig = document.getElementById('scale-metric-big');
    this.scaleExponentTag = document.getElementById('scale-exponent-tag');
    this.scaleSlider = document.getElementById('scale-slider');
    this.scalePresetsContainer = document.getElementById('scale-presets-grid');
    this.catalogHeaderTitle = document.getElementById('catalog-header-title');
    this.catalogCountBadge = document.getElementById('catalog-count-badge');
    this.catalogListContainer = document.getElementById('catalog-list-container');

    // Right Dossier Panel
    this.entityOverline = document.getElementById('entity-category-overline');
    this.entityMainTitle = document.getElementById('entity-main-title');
    this.entityCatalogCode = document.getElementById('entity-catalog-code');
    this.dossierTabBtns = document.querySelectorAll('.dossier-tab-btn');
    this.dossierContent = document.getElementById('dossier-content-scroll');

    // Bottom Temporal Dock
    this.epochTimeVal = document.getElementById('epoch-time-val');
    this.timePillsContainer = document.getElementById('time-speed-pills');
    this.liveTickerText = document.getElementById('live-ticker-text');
    this.btnPhenomStar = document.getElementById('btn-phenom-star');
    this.btnPhenomImpact = document.getElementById('btn-phenom-impact');
    this.btnPhenomBio = document.getElementById('btn-phenom-bio');
    this.btnPhenomCiv = document.getElementById('btn-phenom-civ');
  }

  bindEvents() {
    this.btnApplySeed.addEventListener('click', () => {
      const val = this.seedInput.value.trim() || `PARALLAX-${Math.floor(Math.random() * 9000 + 1000)}`;
      this.seedInput.value = val;
      this.engine.resetUniverse(val);
    });

    this.seedInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.engine.resetUniverse(this.seedInput.value);
      }
    });

    this.btnSetiScanner.addEventListener('click', () => {
      this.engine.scanAndJumpToNextBiosignature();
    });

    this.btnBookmark.addEventListener('click', () => {
      const bm = this.engine.addBookmark();
      this.soundscape.playTelemetryPing(780, 0.12);
      this.liveTickerText.textContent = `[SEGNALIBRO SALVATO] ${bm.title} (${bm.scaleLabel})`;
    });

    this.btnAudio.addEventListener('click', () => {
      const on = this.soundscape.toggle();
      this.btnAudio.textContent = on ? 'AUDIO: ON' : 'AUDIO: OFF';
      this.btnAudio.classList.toggle('accent-emerald', on);
      if (on) this.soundscape.playTelemetryPing(520, 0.18);
    });

    this.btnZen.addEventListener('click', () => {
      this.toggleZenMode();
    });

    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'h' || e.key === 'H') {
        this.toggleZenMode();
      } else if (e.key === ' ') {
        e.preventDefault();
        this.engine.setTimeScale(this.engine.timeScaleIndex === 0 ? 4 : 0);
      } else if (e.key >= '1' && e.key <= '7') {
        this.engine.flyToScale(parseInt(e.key, 10) - 1);
      }
    });

    // Continuous logarithmic scale slider (inverted so top/right = zoom in or standard)
    this.scaleSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.engine.setTargetLogScale(val);
    });

    // Dossier Tabs
    this.dossierTabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.activeTab = btn.dataset.tab;
        this.dossierTabBtns.forEach((b) => b.classList.toggle('active', b === btn));
        this.renderDossierContent();
      });
    });

    // Causal Phenomenon Simulation Triggers
    this.btnPhenomStar.addEventListener('click', () => {
      this.engine.triggerPhenomenon('stellar_evolution_step');
    });
    this.btnPhenomImpact.addEventListener('click', () => {
      this.engine.triggerPhenomenon('asteroid_impact');
    });
    this.btnPhenomBio.addEventListener('click', () => {
      this.engine.triggerPhenomenon('abiogenesis_surge');
    });
    this.btnPhenomCiv.addEventListener('click', () => {
      this.engine.triggerPhenomenon('kardashev_breakthrough');
    });
  }

  toggleZenMode() {
    this.zenMode = !this.zenMode;
    this.hudLayer.classList.toggle('zen-mode', this.zenMode);
    this.btnZen.textContent = this.zenMode ? 'HUD: ZEN' : 'HUD: FULL';
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

  /**
   * Lightweight per-frame telemetry update (scale slider readout & cosmic epoch clock)
   */
  updateFrameTelemetry() {
    const logS = this.engine.currentLogScale;
    this.scaleMetricBig.textContent = formatLogScale(logS);
    this.scaleExponentTag.textContent = `10^${logS.toFixed(2)} m • ${this.renderer.fps} FPS`;
    if (document.activeElement !== this.scaleSlider) {
      this.scaleSlider.value = logS.toFixed(2);
    }

    const totalGyr = this.engine.baseCosmicEpochGyr + this.engine.elapsedYears / 1e9;
    this.epochTimeVal.textContent = `${totalGyr.toFixed(4)} Gyr (+${this.engine.formatElapsedCosmicTime()})`;

    // Highlight active scale preset if scale crossed boundary
    const activeLvl = this.engine.getActiveScaleLevel();
    if (this._lastActiveLevelId !== activeLvl.id) {
      this._lastActiveLevelId = activeLvl.id;
      this.refreshAll();
    }

    const star = this.engine.getActivePlanetarySystem()?.star;
    this.soundscape.updateScaleTone(logS, star ? star.tempK : 5778);
  }

  refreshAll() {
    this.seedInput.value = this.engine.universeSeed;
    const activeLvl = this.engine.getActiveScaleLevel();

    // Update scale preset active state
    this.scalePresetsContainer.querySelectorAll('.scale-preset-btn').forEach((btn) => {
      const idx = parseInt(btn.dataset.scaleIndex, 10);
      btn.classList.toggle('active', idx === activeLvl.index);
    });

    // Update time pills active state
    this.timePillsContainer.querySelectorAll('.time-pill-btn').forEach((btn) => {
      const idx = parseInt(btn.dataset.timeIndex, 10);
      btn.classList.toggle('active', idx === this.engine.timeScaleIndex);
    });

    // Update live event ticker
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
      { label: 'COSMO', level: 0, sub: sc.catalogId },
      { label: gal.name.replace('Galassia ', ''), level: 1, sub: gal.morphology.code },
      { label: 'SETTORE', level: 2, sub: `${this.engine.stellarSector.systems.length} stelle` },
      { label: sys.name, level: 3, sub: sys.star.spectralClass },
      { label: pl ? pl.name : 'Pianeta', level: 4, sub: pl ? `${pl.orbit.a.toFixed(2)} AU` : '' },
      { label: lm ? lm.name.split(' ')[0] : 'Superficie', level: 5, sub: pl && pl.biosphere.active ? 'Biosfera' : 'Orizzonte' }
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
      // List Superclusters
      const list = this.engine.cosmicWeb.superclusters;
      this.catalogHeaderTitle.textContent = 'Superammassi Cosmici';
      this.catalogCountBadge.textContent = `${list.length} nodi`;

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
      // List Galaxies in Supercluster
      const list = this.engine.galaxies;
      this.catalogHeaderTitle.textContent = 'Catalogo Galattico';
      this.catalogCountBadge.textContent = `${list.length} galassie`;

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
      // List Star Systems in Sector
      const list = this.engine.stellarSector.systems;
      this.catalogHeaderTitle.textContent = 'Sistemi Stellari nel Settore';
      this.catalogCountBadge.textContent = `${list.length} sistemi`;

      list.forEach((sys, idx) => {
        let tagText = sys.star.spectralClass;
        let tagClass = 'neutral';
        if (sys.hasCivilization) {
          tagText = 'CIVILTÀ';
          tagClass = 'civ';
        } else if (sys.hasBiosphere) {
          tagText = 'BIOSFERA';
          tagClass = 'bio';
        }

        const item = this.createCatalogRow({
          name: sys.name,
          sub: `${sys.catalogId} • ${Math.round(sys.star.tempK)} K • ${sys.planetCount} pianeti`,
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
      // List Planets in Active Star System
      const pSys = this.engine.getActivePlanetarySystem();
      const list = pSys.planets;
      this.catalogHeaderTitle.textContent = `Corpi Orbitali (${pSys.name})`;
      this.catalogCountBadge.textContent = `${list.length} pianeti`;

      list.forEach((pl, idx) => {
        let tagText = `${pl.orbit.a.toFixed(2)} AU`;
        let tagClass = 'neutral';
        if (pl.civilization.active) {
          tagText = `K-${pl.civilization.kardashev.toFixed(2)}`;
          tagClass = 'civ';
        } else if (pl.biosphere.active) {
          tagText = 'VITA';
          tagClass = 'bio';
        }

        const item = this.createCatalogRow({
          name: pl.name,
          sub: `${pl.typeLabel} • ${Math.round(pl.surfaceTempC)}°C • ${pl.moons.length} lune`,
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
      // Scale 5 & 6: List Surface Landmarks & Evolved Biosphere Clades on Active Planet
      const pl = this.engine.getActivePlanet();
      if (!pl) return;
      this.catalogHeaderTitle.textContent = `Siti & Cladi su ${pl.name}`;
      const totalItems = pl.landmarks.length + (pl.biosphere.clades ? pl.biosphere.clades.length : 0);
      this.catalogCountBadge.textContent = `${totalItems} elementi`;

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
      this.entityOverline.textContent = `STRUTTURA COSMOLOGICA • ${sc.dominantMorphology}`;
      this.entityMainTitle.textContent = sc.name;
      this.entityCatalogCode.textContent = sc.catalogId;
    } else if (activeLvl.index === 1) {
      this.entityOverline.textContent = `GALASSIA • ${gal.morphology.label}`;
      this.entityMainTitle.textContent = gal.name;
      this.entityCatalogCode.textContent = `${gal.catalogId} (${gal.morphology.code})`;
    } else if (activeLvl.index === 2 || activeLvl.index === 3) {
      this.entityOverline.textContent = `SISTEMA STELLARE • ${pSys.star.phase}`;
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

  /**
   * TAB 1: ASTROPHYSICS, GEOPHYSICS & DYNAMIC HERTZSPRUNG-RUSSELL DIAGRAM
   */
  renderPhysicsTab(activeLvl, sc, gal, pSys, pl) {
    const star = pSys.star;

    let telemetryHTML = '';
    if (activeLvl.index === 0) {
      telemetryHTML = `
        <div class="telemetry-grid">
          <div class="telemetry-cell">
            <div class="telemetry-label">Massa Totale Viriale</div>
            <div class="telemetry-val highlight-amber">10<sup>${sc.massLogSolar.toFixed(2)}</sup> M☉</div>
          </div>
          <div class="telemetry-cell">
            <div class="telemetry-label">Redshift Cosmologico</div>
            <div class="telemetry-val highlight-cyan">z = ${sc.redshift.toFixed(4)}</div>
          </div>
          <div class="telemetry-cell">
            <div class="telemetry-label">Galassie Censite</div>
            <div class="telemetry-val">${sc.galaxyCount.toLocaleString()}</div>
          </div>
          <div class="telemetry-cell">
            <div class="telemetry-label">Frazione Materia Oscura</div>
            <div class="telemetry-val">${(sc.darkMatterFraction * 100).toFixed(1)}%</div>
          </div>
          <div class="telemetry-cell">
            <div class="telemetry-label">Estensione Lineare</div>
            <div class="telemetry-val">${sc.spanMpc.toFixed(1)} Mpc</div>
          </div>
          <div class="telemetry-cell">
            <div class="telemetry-label">Temp. Gas ICM X-Ray</div>
            <div class="telemetry-val">${(sc.icmTempKelvin / 1e6).toFixed(1)} MK</div>
          </div>
        </div>
      `;
    } else if (activeLvl.index === 1) {
      telemetryHTML = `
        <div class="telemetry-grid">
          <div class="telemetry-cell">
            <div class="telemetry-label">Classificazione Hubble</div>
            <div class="telemetry-val highlight-amber">${gal.morphology.code}</div>
          </div>
          <div class="telemetry-cell">
            <div class="telemetry-label">Diametro Disco</div>
            <div class="telemetry-val highlight-cyan">${Math.round(gal.diameterLy).toLocaleString()} ly</div>
          </div>
          <div class="telemetry-cell">
            <div class="telemetry-label">Popolazione Stellare</div>
            <div class="telemetry-val">~${gal.starCountBillions.toFixed(0)} Miliardi</div>
          </div>
          <div class="telemetry-cell">
            <div class="telemetry-label">Buco Nero Centrale</div>
            <div class="telemetry-val">${(gal.smbh.massSolar / 1e6).toFixed(2)}×10⁶ M☉</div>
          </div>
          <div class="telemetry-cell">
            <div class="telemetry-label">Età Media Galattica</div>
            <div class="telemetry-val">${gal.ageGyr.toFixed(2)} Gyr</div>
          </div>
          <div class="telemetry-cell">
            <div class="telemetry-label">Metallicità Media</div>
            <div class="telemetry-val">[Fe/H] ${gal.metallicityFeH >= 0 ? '+' : ''}${gal.metallicityFeH.toFixed(2)}</div>
          </div>
        </div>
      `;
    } else {
      telemetryHTML = `
        <div class="telemetry-grid">
          <div class="telemetry-cell">
            <div class="telemetry-label">Stella Madre (${star.spectralClass})</div>
            <div class="telemetry-val" style="color:${star.hexColor}">${Math.round(star.tempK)} K • ${star.currentMassSolar.toFixed(2)} M☉</div>
          </div>
          <div class="telemetry-cell">
            <div class="telemetry-label">Luminosità & Raggio</div>
            <div class="telemetry-val">${star.luminositySolar < 0.01 ? star.luminositySolar.toExponential(1) : star.luminositySolar.toFixed(2)} L☉ • ${star.radiusSolar < 0.05 ? star.radiusSolar.toFixed(4) : star.radiusSolar.toFixed(2)} R☉</div>
          </div>
          <div class="telemetry-cell">
            <div class="telemetry-label">Età / Vita Seq. Princ.</div>
            <div class="telemetry-val">${pSys.currentAgeGyr.toFixed(2)} / ${star.msLifetimeGyr.toFixed(2)} Gyr</div>
          </div>
          <div class="telemetry-cell">
            <div class="telemetry-label">Zona Abitabile (CHZ)</div>
            <div class="telemetry-val highlight-emerald">${star.hzInnerAU.toFixed(2)} – ${star.hzOuterAU.toFixed(2)} AU</div>
          </div>
          <div class="telemetry-cell">
            <div class="telemetry-label">${pl.name} (Massa/Raggio)</div>
            <div class="telemetry-val highlight-cyan">${pl.massEarths.toFixed(2)} M⊕ • ${Math.round(pl.radiusKm).toLocaleString()} km</div>
          </div>
          <div class="telemetry-cell">
            <div class="telemetry-label">Gravità & Vel. Fuga</div>
            <div class="telemetry-val">${pl.gravityG.toFixed(2)} g • ${pl.escapeVelocityKmS.toFixed(1)} km/s</div>
          </div>
          <div class="telemetry-cell">
            <div class="telemetry-label">Semiasse & Periodo</div>
            <div class="telemetry-val">${pl.orbit.a.toFixed(3)} AU • ${pl.orbit.periodYears.toFixed(2)} yr</div>
          </div>
          <div class="telemetry-cell">
            <div class="telemetry-label">Campo Magnetico & Tettonica</div>
            <div class="telemetry-val">${pl.magneticFieldGauss.toFixed(2)} G • ${(pl.tectonics * 100).toFixed(0)}%</div>
          </div>
        </div>
      `;
    }

    this.dossierContent.innerHTML = `
      ${telemetryHTML}
      <div class="instrument-box">
        <div class="instrument-header">
          <span class="instrument-title">Diagramma Evolutivo Hertzsprung-Russell (H-R)</span>
          <span class="panel-badge">${star.spectralClass} (${(star.lifeFraction * 100).toFixed(0)}% MS)</span>
        </div>
        <canvas id="hr-diagram-canvas" class="instrument-canvas" width="330" height="150"></canvas>
      </div>
      <div class="instrument-box">
        <div class="instrument-header">
          <span class="instrument-title">Architettura Orbitale del Sistema (${pSys.planets.length} Pianeti)</span>
          <span style="font-family:var(--font-mono);font-size:10px;color:var(--text-secondary)">Limite Neve: ${star.frostLineAU.toFixed(2)} AU</span>
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

    // Background grid
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

    // Main Sequence diagonal band (Hot/Luminous top-left -> Cool/Dim bottom-right)
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

    // Red Giant Branch curve
    ctx.strokeStyle = 'rgba(251, 146, 60, 0.28)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(w * 0.55, h * 0.55);
    ctx.quadraticCurveTo(w * 0.72, h * 0.25, w - 38, 28);
    ctx.stroke();

    // White Dwarf cooling sequence (bottom-left)
    ctx.strokeStyle = 'rgba(147, 197, 253, 0.25)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(65, h - 48);
    ctx.lineTo(175, h - 26);
    ctx.stroke();

    // Map active star (tempK: 40000 -> 2500 left-to-right; log10(L): -4 -> +6 bottom-to-top)
    const logT = Math.log10(Math.max(2500, Math.min(42000, star.tempK)));
    const minLogT = Math.log10(2500);
    const maxLogT = Math.log10(42000);
    const sx = 35 + (1 - (logT - minLogT) / (maxLogT - minLogT)) * (w - 60);

    const logL = Math.log10(Math.max(1e-4, Math.min(1e6, star.luminositySolar)));
    const sy = (h - 26) - ((logL + 4) / 10) * (h - 44);

    // Crosshair on active star
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

    // Spectral Class Axis Labels
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px "JetBrains Mono", monospace';
    const classes = ['O', 'B', 'A', 'F', 'G', 'K', 'M'];
    classes.forEach((c, i) => {
      ctx.fillText(c, 42 + i * 42, h - 7);
    });
    ctx.fillText('L☉', 6, 20);
  }

  /**
   * TAB 2: ATMOSPHERIC SPECTROSCOPY, CLIMATE & HABITABILITY
   */
  renderClimateTab(pSys, pl) {
    if (!pl) return;
    this.dossierContent.innerHTML = `
      <div class="telemetry-grid">
        <div class="telemetry-cell">
          <div class="telemetry-label">Temperatura Superficiale</div>
          <div class="telemetry-val highlight-amber">${pl.surfaceTempC.toFixed(1)} °C (${Math.round(pl.surfaceTempK)} K)</div>
        </div>
        <div class="telemetry-cell">
          <div class="telemetry-label">Temp. Equilibrio & Serra</div>
          <div class="telemetry-val">${Math.round(pl.eqTempK)} K (+${Math.round(pl.greenhouseDeltaK)} K)</div>
        </div>
        <div class="telemetry-cell">
          <div class="telemetry-label">Pressione Atmosferica</div>
          <div class="telemetry-val highlight-cyan">${pl.pressureAtm < 0.01 ? pl.pressureAtm.toExponential(1) : pl.pressureAtm.toFixed(2)} atm</div>
        </div>
        <div class="telemetry-cell">
          <div class="telemetry-label">Albedo Bond & Nubi</div>
          <div class="telemetry-val">${pl.albedo.toFixed(2)} • ${(pl.cloudCoverage * 100).toFixed(0)}% nubi</div>
        </div>
        <div class="telemetry-cell">
          <div class="telemetry-label">Idrosfera / Oceani</div>
          <div class="telemetry-val">${(pl.oceanCoverage * 100).toFixed(0)}% copertura</div>
        </div>
        <div class="telemetry-cell">
          <div class="telemetry-label">Indice Similarità ESI</div>
          <div class="telemetry-val highlight-emerald">${(pl.habitabilityScore * 100).toFixed(1)}%</div>
        </div>
      </div>

      <div class="instrument-box">
        <div class="instrument-header">
          <span class="instrument-title">Spettrogramma di Assorbimento Atmosferico (380–780 nm)</span>
          <span class="panel-badge">${pl.biosphere.active ? 'BIOFIRMA O₂/CH₄' : 'ABIOTICO'}</span>
        </div>
        <canvas id="spectrum-canvas" class="instrument-canvas" width="330" height="64"></canvas>
      </div>

      <div class="instrument-box">
        <div class="instrument-header">
          <span class="instrument-title">Composizione Chimica dell'Atmosfera</span>
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
  }

  drawAbsorptionSpectrumCanvas(pl) {
    const canvas = document.getElementById('spectrum-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Continuous optical rainbow continuum (380nm violet -> 760nm deep red)
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

    // Draw dark Fraunhofer & molecular absorption bands based on actual gas composition!
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

  /**
   * TAB 3: BIOSPHERE, EVOLUTIONARY CLADES & TROPHIC FOOD WEB
   */
  renderLifeTab(pSys, pl) {
    if (!pl) return;
    const bio = pl.biosphere;

    if (!bio.active) {
      this.dossierContent.innerHTML = `
        <div class="instrument-box" style="text-align:center;padding:18px 12px">
          <div class="entity-category-overline" style="color:var(--text-secondary)">STATO ASTROBIOLOGICO</div>
          <div style="font-size:14px;font-weight:600;margin:6px 0">${bio.stage}</div>
          <p style="color:var(--text-secondary);font-size:11px;margin-bottom:12px">
            Le condizioni termodinamiche attuali (${pl.surfaceTempC.toFixed(1)}°C, ${pl.pressureAtm.toFixed(2)} atm) non ospitano ancora una biosfera attiva, oppure attendono un evento catalitico di abiogenesi.
          </p>
          <button id="btn-trigger-abiogenesis-inline" class="action-btn accent-emerald">
            + Catalizza Abiogenesi & Evoluzione Prebiotica
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
          <div class="telemetry-label">Biomassa Globale</div>
          <div class="telemetry-val highlight-emerald">${bio.biomassGt.toLocaleString()} Gt C</div>
        </div>
        <div class="telemetry-cell">
          <div class="telemetry-label">Biodiversità Stimata</div>
          <div class="telemetry-val">${bio.speciesCountEstimate.toLocaleString()} specie</div>
        </div>
        <div class="telemetry-cell">
          <div class="telemetry-label">Biochimica & Solvente</div>
          <div class="telemetry-val" style="font-size:10px">${bio.biochemistry}</div>
        </div>
        <div class="telemetry-cell">
          <div class="telemetry-label">Metabolismo Primario</div>
          <div class="telemetry-val" style="font-size:10px">${bio.energySource}</div>
        </div>
      </div>

      ${
        activeClade
          ? `
      <div class="instrument-box">
        <div class="instrument-header">
          <span class="instrument-title">Esemplare Selezionato: ${activeClade.binomialName}</span>
          <span class="panel-badge">${activeClade.commonArchetype}</span>
        </div>
        <div style="font-size:11px;color:var(--text-secondary);display:flex;flex-direction:column;gap:4px">
          <div><strong style="color:var(--text-primary)">Simmetria & Morfologia:</strong> ${activeClade.symmetry} (${activeClade.bodySegments} metameri)</div>
          <div><strong style="color:var(--text-primary)">Locomozione:</strong> ${activeClade.locomotion}</div>
          <div><strong style="color:var(--text-primary)">Apparato Sensoriale:</strong> ${activeClade.sensoryMode}</div>
          <div style="margin-top:4px;color:var(--accent-emerald);font-family:var(--font-mono);font-size:10px">
            Adattamenti Evolutivi:
            ${activeClade.traits.map((t) => `<div style="color:var(--text-secondary)">• ${t}</div>`).join('')}
          </div>
        </div>
      </div>
      `
          : ''
      }

      <div class="instrument-box">
        <div class="instrument-header">
          <span class="instrument-title">Rete Trofica & Piramide Filogenetica (Clicca per Ispezionare)</span>
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
                <span style="color:var(--accent-emerald)">${Math.round(c.biomassShare * 100)}% biomassa</span>
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

  /**
   * TAB 4: CIVILIZATION, KARDASHEV TECHNOSPHERE & HISTORICAL CHRONICLE
   */
  renderCivTab(pSys, pl) {
    if (!pl) return;
    const civ = pl.civilization;

    let civSectionHTML = '';
    if (!civ.active) {
      civSectionHTML = `
        <div class="instrument-box" style="text-align:center;padding:14px 10px">
          <div class="entity-category-overline" style="color:var(--text-secondary)">SCANSIONE XENO-SOCIOLOGICA</div>
          <div style="font-size:13px;font-weight:600;margin:4px 0">${civ.status}</div>
          <p style="color:var(--text-secondary);font-size:11px;margin-bottom:10px">
            Nessuna emissione artificiale o megastruttura orbitale rilevata su ${pl.name}.
          </p>
          <button id="btn-trigger-civ-inline" class="action-btn accent-amber">
            + Catalizza Emergenza Cognitiva & Civiltà Kardashev
          </button>
        </div>
      `;
    } else {
      civSectionHTML = `
        <div class="telemetry-grid">
          <div class="telemetry-cell">
            <div class="telemetry-label">Scala di Kardashev</div>
            <div class="telemetry-val highlight-amber">Tipo ${civ.kardashev.toFixed(2)}</div>
          </div>
          <div class="telemetry-cell">
            <div class="telemetry-label">Specie & Popolazione</div>
            <div class="telemetry-val">${civ.populationBillions} Mld</div>
          </div>
          <div class="telemetry-cell">
            <div class="telemetry-label">Potenza Energetica</div>
            <div class="telemetry-val highlight-cyan">${civ.energyPowerTW.toLocaleString()} TW</div>
          </div>
          <div class="telemetry-cell">
            <div class="telemetry-label">Cooperazione / Conflitto</div>
            <div class="telemetry-val highlight-emerald">${Math.round(civ.cooperationIndex * 100)}% / ${Math.round(civ.conflictRisk * 100)}%</div>
          </div>
        </div>

        <div class="instrument-box">
          <div class="instrument-header">
            <span class="instrument-title">Modello Culturale: ${civ.ethos.name}</span>
          </div>
          <div style="font-size:11px;color:var(--text-secondary)">
            <div><strong style="color:var(--text-primary)">Specie Dominante:</strong> ${civ.speciesName}</div>
            <div><strong style="color:var(--text-primary)">Governance:</strong> ${civ.ethos.governance}</div>
            <div><strong style="color:var(--text-primary)">Dottrina:</strong> ${civ.ethos.philosophy}</div>
          </div>
        </div>

        <div class="instrument-box">
          <div class="instrument-header">
            <span class="instrument-title">Matrice Tecnologica & Megastrutture Orbitali</span>
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
          <span class="instrument-title">Cronaca Storica & Registro Evolutivo di ${pl.name}</span>
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
