# TRIFLE software mock-up

An interactive mock-up of the TRIFLE control and analysis software, for review with DSP scientists and managers at GSK.

- **One file:** `trifle_mockup.html`. Open it in Chrome or Edge. There is no install, no build step and no network access, so it works offline.
- **Simulated data only.** Every number on screen comes from a seeded simulation (mulberry32, seed 20261009) of a GSK platform Protein A run. The calculations run for real on that data. Nothing is a static screenshot.
- **Verified against TRIFLE v2.0.** The v2.0 fluorescence and auto-ranging algorithms reproduce `trifle_reference_tests.json`, which is embedded in the file. Open **Engineer view → Diagnostics → Reference tests** to see each value checked.

## Five-minute demonstration

1. **Setup.** Tick the two sign-in statements. The defaults are the GSK Protein A platform method on an ÄKTA avant 150, with an imported UNICORN result export (simulated).
2. **Readiness.** The checks run on their own. The laser warm-up panel shows the controller reading stepping down at about 18 min and reaching "stable (provisional)" at about 23.7 min. Confirm the PMT voltage. Under **Demo controls**, playback at 60× makes this take seconds.
3. **Run.** Press **Start**. Fluorescence, UV 280, conductivity and pH appear against volume. Evidence cards appear as rules fire: P1 (UV saturated), P2 with H1 (possible breakthrough, confirm by Protein A HPLC on FT09 and FT10), I2 (range overruns) and P3 with H2 at the end. **Fast-forward to run end** finishes the run immediately.
4. **Fraction review.** Select fractions in the table or drag across the chart. Compare the UV 100 mAU pool with the fluorescence boundaries, which are a visual comparison only. Record decisions (SEC, Lunatic, Protein A HPLC or no action).
5. **Record.** Copy the notebook-ready sections and export CSV, JSON and PNG files. The audit trail lists every change.

Other demo controls start the ÄKTA run before the laser is stable (rule I1) and leave the UNICORN fraction delay at its pre-TRIFLE value (rule I5, with fraction assignments marked Uncertain). In Engineer view you can simulate a fault (digitiser, filter wheel or laser) and run a reproducibility check.

## Labels

| Label | Meaning |
|---|---|
| Existing (v2.0) | Implemented in the current TRIFLE Python control software, version 2.0 |
| Proposed | Designed here, not yet built or experimentally verified |
| Future (GSK integration) | Needs further development and access to GSK systems |
| assumed | An inference the instrument team has not confirmed |

The Scientist view shows a tag only where it changes the conclusion. The Engineer view shows every tag.
