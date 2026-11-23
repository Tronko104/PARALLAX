# PARALLAX — A Universe Beyond Observation

**PARALLAX** è un simulatore d'universo procedurale, virtualmente infinito, persistente e multi-scala con rendering volumetrico e raymarching in **WebGL2 / GLSL**.

L'obiettivo di PARALLAX è offrire un'esperienza astrofisica ed esplorativa continua, coerente e scientificamente credibile che attraversa **26 ordini di grandezza spaziali** ($10^{25.5}\text{ m} \rightarrow 10^{0}\text{ m}$) e scale temporali che vanno dal tempo reale fino a miliardi di anni di evoluzione cosmica.

---

## Architettura Multi-Scala (7 Livelli Continui)

1. **Cosmo (`10^25 m` — Scala Cosmologica)**
   - Rete cosmica (*Cosmic Web*) con filamenti di materia oscura e barionica, superammassi galattici, nodi gravitazionali, vuoti cosmici ($\delta < -0.7$) e redshift cosmologico ($z$).
2. **Galassie (`10^21 m` — Scala Galattica)**
   - Classificazione morfologica di Hubble: Spirali Grand-Design (`SA(s)bc`), Spirali Barrate (`SB(r)b`), Spirali Flocculente (`SA(s)c`), Ellittiche Giganti (`E2`), Lenticolari (`S0`) e Irregolari Starburst (`Irr-I`).
   - Buco nero supermassiccio centrale (`SMBH`), bande di polveri interstellari, regioni HII di formazione stellare ($H\alpha$ / $[O\,\text{III}]$) e gradiente di metallicità `[Fe/H]`.
3. **Settore Stellare & Stelle (`10^17 m` — Scala Stellare)**
   - Classi spettrali `O, B, A, F, G, K, M` con emissione di corpo nero di Planck, protostelle T-Tauri, stelle di Sequenza Principale, Subgiganti, Giganti Rosse, Supergiganti, Nebulose Planetarie, Nane Bianche (`DA`), Stelle di Neutroni / Pulsar (`PSR`) e Buchi Neri Stellari (`BH`) con lensing gravitazionale e disco di accrescimento relativistico.
4. **Sistemi Planetari (`10^12 m` — Scala Orbitale)**
   - Dinamica kepleriana 3D esatta ($M = E - e \sin E$ risolta via Newton-Raphson), Zona Abitabile Circumstellare (`CHZ`), limite della neve (*Frost Line*), fasce di asteroidi, comete con doppia coda (polveri e ioni) e sistemi multi-lunari.
5. **Pianeti (`10^7 m` — Scala Globale)**
   - Globo 3D raymarched con topografia multifrattale FBM/Ridge, tettonica a placche, batimetria oceanica con riflessione speculare di Fresnel, vulcani attivi, calotte polari dinamiche, nubi volumetriche con ombre proiettate, anelli planetari con divisione di Cassini e scattering atmosferico fisico di Rayleigh/Mie.
6. **Superficie & Vita (`10^3 m` — Orizzonte Planetario ed Ecosistemi)**
   - Discesa continua attraverso l'atmosfera fino al paesaggio 3D raymarched in tempo reale (montagne, oceani animati, ciclo giorno/notte, anelli e stella madre nel cielo).
   - **Simulazione Astrobiologica**: abiogenesi, biochimica, pigmenti fotosintetici adattati allo spettro della stella madre, piramide trofica, cladi filogenetici, morfologia biomeccanica procedurale ed eventi di estinzione/speciazione.
7. **Civiltà (`10^0 m` — Tecnosfera & Xeno-Sociologia)**
   - Emergenza cognitiva, scala di Kardashev ($K \in [0.15, 2.50]$), ethos culturale, luci urbane notturne sul globo, megastrutture orbitali (Anelli Orbitali, Ascensori Spaziali, Sciami di Dyson) e **Cronaca Storica Universale** persistente.

---

## Struttura del Progetto

```text
PARALLAX/
├── index.html                  # Entry point dell'osservatorio scientifico
├── package.json                # Configurazione progetto e script
├── scripts/
│   └── bundle_artifact.js      # Compilatore bundle standalone zero-dipendenze
├── dist/
│   └── index.html              # Versione standalone autocontenuta
└── src/
    ├── main.js                 # Bootstrapper e loop temporale/grafico
    ├── styles/
    │   └── index.css           # Design system scientifico (Vanilla CSS)
    ├── math/
    │   └── prng.js             # Hash gerarchico deterministico, FBM 3D, Planck & Keplero
    ├── universe/
    │   └── generator.js        # Generatore astrofisico, geologico, biologico e civiltà
    ├── simulation/
    │   └── engine.js           # Motore temporale multi-scala, persistenza ed eventi causali
    ├── renderer/
    │   ├── shaders.js          # Shader GLSL WebGL2 volumetrici e raymarching
    │   └── webgl_renderer.js   # Pipeline WebGL2 + proiezione vettoriale 3D e picking spaziale
    ├── audio/
    │   └── soundscape.js       # Sintetizzatore WebAudio procedurale Deep Space
    └── ui/
        └── hud.js              # Interfaccia telemetrica, Diagramma H-R, Spettrometro e Cronaca
```

## Avvio Locale

```bash
npm run dev
# Oppure:
python3 -m http.server 4173
```
