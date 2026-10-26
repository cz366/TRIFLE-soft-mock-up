# Developing the TRIFLE mock-up

`trifle_mockup.html` in the repository root is built from the parts in this folder. Edit the parts, not the built file.

## Layout

| Path | What it holds |
|---|---|
| `src/1*.css` | Styles, concatenated in name order |
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
- `check1`: the Run chart takes at least 55 % of the work area at 1440 × 900 and 1280 × 800 (currently 0.599 and 0.580).
- `check3`: "changes 39".
- `steps8`: every check prints `ok` and the script ends with "lifetimes ok": four components named scatter, HCP, mAb and HMW, each within 5 % of its simulated lifetime, with the Decay panel, toggles, fraction Species column, Lifetimes tab and Questions answer checked.
- Hosted checks: all four exports save, the PDF button is hidden, and 26 checks pass at 400 and 768 px wide.

Output, screenshots and logs go to `source/test-output/`, which git ignores.

## Screenshots

```
node source/tests/render_hd.js "$PWD/trifle_mockup.html" "$PWD/screens" 4
```

renders 34 screens at 4× (desktop 5760 × 3600, phone 1600 × 3440).
