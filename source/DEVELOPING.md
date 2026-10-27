# Developing the TRIFLE mock-up

`trifle_mockup.html` in the repository root is built from the parts in this folder. Edit the parts, not the built file.

## Layout

| Path | What it holds |
|---|---|
| `src/1*.css` | Styles, concatenated in name order; `14_simple.css` holds the scientist-view layout |
| `src/15_body.html` | Page skeleton (header, rail, screens, status line) |
| `src/20_engine.js` | Simulation (species and their decays) and the v2.0 algorithms (fluorescence, auto-ranging); the lifetime analysis maths (basis decays, non-negative least squares, global fit) |
| `src/30_chart.js` | Canvas charts |
| `src/40_model.js`, `src/45_stage2_model.js` | Run state, readiness, evidence rules, Stage 2 models |
| `src/46_lifetime.js` | Lifetime analysis for a run: refits during and after acquisition, species chromatograms, fraction composition |
| `src/5*.js`, `src/6*.js` | Screens: Setup, Readiness, Run (with the decay map and Decay panel), Fraction review, Record, Engineer, Questions, Stage 2, lifetime analysis (`63_lifetime_ui.js`) |
| `src/70_hosted.js` | Exports and toasts when the page runs inside a hosting viewer |
| `src/90_boot.js` | Navigation and start-up |
| `reference/trifle_reference_tests.json` | v2.0 reference values, embedded in the page and checked in Engineer view |
| `tests/` | Headless browser tests and the screenshot renderer |

## Scientist view and Engineer view

The scientist view shows only what is needed to run and decide; the Engineer view (`body.eng`) shows everything.

- `.eng-only` hides an element in the scientist view; `.sci-only` hides it in the Engineer view (a simpler stand-in, such as the one header status or the Setup Method summary).
- Code that renders text or table columns reads `S.engineer`, and its cache key must include it, because the switch emits `series`, `cards` and a dirty frame but does not rebuild screens.
- `UI.cardShown(rule)` leaves the housekeeping cards (I2, I3) out of the scientist's status line and fraction Evidence column.
- `tag(k)` shows a label tag in the Engineer view only; `tag(k, 'always')` shows it in both.
- Chart options (all opt-in, `30_chart.js`): series `fill` (area wash opacity), `tipLabel`, `inTip`; cfg `tooltip` with `tipHead` and `tipExtra`, `annotations` (direct labels), `liveIndex` (one block for every legend value), `hoverInfo`, and axis `minTop`. Intervals share one layout for bars and labels; a label that fits no row is left to the tooltip.
- Detection (`LTM.features`) and suggestions (`LTUI.suggest`) read the per-block amplitudes only, so a different readout algorithm can feed them.
- `RC.viewMenu` holds the optional chart layers (decay map, on by default; AKTA traces) and rulers for Run and Fraction review. Its checkboxes exist only while the menu is open, so tests open `#rView` (or `#fView`) first.
- Tests that use an Engineer control (Processing, acquisition settings, Calibration, Block data, Metadata, HDF5) click `#engSwitch` first.

## Build

```
bash source/build.sh                       # writes trifle_mockup.html in the repository root
ARTIFACT=1 bash source/build.sh out.html   # hosted variant, without doctype, html, head or body tags
```

## Test

Needs Node with Playwright and Chromium.

```
bash source/run_suite.sh
```

It builds both variants, runs every test script and prints pass or FAIL for each. Expected results:

- Every script ends with "no console errors".
- `steps7`: "final checksum E9F1FA72 13673" and "Reference tests 228 of 228 pass". This test runs on its own, because its checksum depends on fast-forward finishing within its wait; a busy machine can change it.
- `check1`: the Run chart takes at least 55 % of the work area at 1440 × 900 and 1280 × 800 (currently 0.628 and 0.605).
- `check3`: "changes 39".
- `steps8`: every check prints `ok` and the script ends with "lifetimes ok": four components named scatter, HCP, monomer and HMW, each within 5 % of its simulated lifetime, with buffer drawn flat, the peaks (HCP, Monomer, HMW) and the Monomer + HMW co-elution detected, the hover tooltip, the scientist and Engineer legends, the Decay panel, the View menu (AKTA traces, decay map), the fraction Species column, the suggestions (Pool E03, HPLC-SEC E08, no action E11, Protein A HPLC FT10) and Apply suggestions, the Lifetimes tab and the Questions answers (co-eluting species, which fractions to pool) checked.
- Hosted checks: the scientist sees Fraction table and Chromatogram (the PDF button is hidden), Engineer view adds Block data and Metadata, all four save, and 28 checks pass at 400 and 768 px wide.

Output, screenshots and logs go to `source/test-output/`, which git ignores.

## Screenshots

```
node source/tests/render_hd.js "$PWD/trifle_mockup.html" "$PWD/screens" 4
```

renders 35 screens at 4× (desktop 5760 × 3600, phone 1600 × 3440).
