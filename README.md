# TRIFLE software mock-up

An interactive mock-up of the TRIFLE control and analysis software, for review with DSP scientists and managers at GSK.

- **One file:** `trifle_mockup.html` (Stage 1 plus Stage 2). Open it in Chrome or Edge. There is no install, no build step and no network access, so it works offline.
- **Simulated data only.** Every number on screen comes from a seeded simulation (mulberry32, seed 20261009) of a GSK platform Protein A run. The calculations run for real on that data. Nothing is a static screenshot.
- **Verified against TRIFLE v2.0.** The v2.0 fluorescence and auto-ranging algorithms reproduce `trifle_reference_tests.json`, which is embedded in the file. Open **Engineer view → Diagnostics → Reference tests** to see each value checked (228 of 228 pass).
- **Stage 1 snapshot:** `stage1/trifle_mockup_stage1.html` is the Stage 1 build on its own, kept for comparison.

## Five-minute demonstration

1. **Setup.** Tick the two sign-in statements. The defaults are the GSK Protein A platform method on an AKTA avant 150, with an imported UNICORN result export (simulated).
2. **Readiness.** The checks run on their own. The laser warm-up panel shows the controller reading stepping down at about 18 min and reaching "stable (provisional)" at about 23.7 min. Confirm the PMT voltage. Under **Demo controls**, playback at 60× makes this take seconds.
3. **Run.** Press **Start**. Fluorescence, UV 280, conductivity and pH appear against volume. Evidence cards appear as rules fire: P1 (UV saturated), P2 with H1 (possible breakthrough, confirm by Protein A HPLC on FT09 and FT10), I2 (range overruns), P6 (above the calibrated range) and P3 with H2 at the end. **Fast-forward to run end** finishes the run immediately.
4. **Fraction review.** Select fractions in the table or drag across the chart. Compare the UV 100 mAU pool with the fluorescence boundaries, which are a visual comparison only. Elution fractions inside the calibrated range show an indicative concentration. Record decisions (SEC, Lunatic, Protein A HPLC or no action).
5. **Record.** Copy the notebook-ready sections and export CSV, JSON and PNG files, or print an A4 PDF. The audit trail lists every change.

Other demo controls start the AKTA run before the laser is stable (rule I1) and leave the UNICORN fraction delay at its pre-TRIFLE value (rule I5, with fraction assignments marked Uncertain). In Engineer view you can simulate a fault (digitiser, filter wheel or laser) and run a reproducibility check.

## Stage 2 additions

| Area | Label | What it shows |
|---|---|---|
| Calibration | Proposed | Step-injection calibration with purified IgG: plateau detection, unweighted, 1/x or 1/x² linear fits, linear range, "possible inner-filter onset" and a calibration record tied to a PMT preset, processing mode and expiry date. Concentration is indicative, elution fractions only, and never used for yield or recovery. Rules P6 (above calibrated range) and I7 (calibration not applicable). |
| Decay analysis | Proposed | Option A decay metric per block, a decay strip on the Run chart, a per-fraction decay column and rule P7 with hypothesis H3 (confirm by HPLC-SEC). Engineer view adds a reconvolution fit with the stored IRF, weighted residuals and χ². |
| Run comparison | Proposed | Overlays the current run on archived runs on a common volume axis (0.05 mL bins), in relative mode, with per-phase integrals and a per-fraction comparison. |
| AAV template | Proposed | AAV affinity capture method (AAVX), with every volume and flow marked assumed. Empty and full capsid assessment is not a TRIFLE output. |
| Export packaging | Proposed | A4 PDF summary (print) and the HDF5 raw-waveform structure with an estimated file size. No real HDF5 file is written. |
| Integrations | Future (GSK integration) | Live UNICORN link, IDBS E-WorkBook transfer, automatic data storage, a language-model Questions panel and legacy .pkl conversion, each with its GSK prerequisites. None is implemented. |

## Labels

| Label | Meaning |
|---|---|
| Existing (v2.0) | Implemented in the current TRIFLE Python control software, version 2.0 |
| Proposed | Designed here, not yet built or experimentally verified |
| Future (GSK integration) | Needs further development and access to GSK systems |
| assumed | An inference the instrument team has not confirmed |
| Development assumption, not validated | A Stage 2 modelling choice, such as a fit weighting or linearity limit |

The Scientist view shows a tag only where it changes the conclusion. The Engineer view shows every tag.

## Assumptions

**Simulation**

- Seed 20261009, mulberry32 random streams per block and waveform; the simulated clock advances by a fixed step per tick, so two playbacks give identical data (checksum shown in Engineer view).
- Waveform model: 7-term Gaussian IRF from the v2.0 settings convolved with a single exponential (τ about 3.5 ns), 8-bit quantisation, 600 samples at 0.2 ns. The IRF amplitude units are not recorded, and W is treated as σ.
- PMT presets: 400 mV has gain 1 and noise 0.2 mV; 800 mV has gain 20 and noise 1.2 mV. The 800 mV values are assumed.
- Laser warm-up: controller reading about 45 then steps down to about 21 at 18 min; "stable" means the 30 s moving median holds within the provisional tolerance for the hold time.
- Plumbing: V1 (UV to TRIFLE) 0.20 mL, V2 (TRIFLE to fraction collector) 0.15 mL, UNICORN fraction delay 0.35 mL (0.12 mL before TRIFLE was fitted).
- Protein A method volumes and flows follow the platform method in the Stage 1 prompt, Appendix A (HiScreen MabSelect PrismA, 4.657 mL CV); the 30 min NaOH hold adds time but not volume.
- AAV template: 1 mL AAVX column, phase volumes, flows and fraction sizes are all assumed.
- Archived runs (RUN-0128-01, RUN-0091-01 at 800 mV, UCL-AAV-0813) are simulated with varied seeds and peak scales.

**Thresholds** (all provisional and editable in Engineer view → Thresholds)

- Laser change during acquisition 2 % (I6), re-equilibration baseline 10 % (P3), range overrun counted above 90 % of the input range (I2).
- Calibration linear range: every level within 5 % of the fit; default weighting 1/x; expiry 30 days. These are development assumptions.
- Decay metric computed only where the signal uses 20 % to 90 % of the input range; P7 fires when the mean over a 0.5 mL window shifts from the load-plateau reference by more than 0.2 ns and more than 3 SD of that plateau.

**Interface**

- Roles (Scientist and Engineer) are a simulated switch, not access control.
- E-WorkBook, UNICORN and data-storage connections are shown as designs only; the Questions panel answers from fixed rules, not a language model.

## Discrepancies found

1. **Rule ID clash.** The Stage 2 prompt names the calibration-applicability rule I6, but Stage 1 already uses I6 for "laser output changed during acquisition". The mock-up keeps Stage 1's I6 and uses **I7** for calibration not applicable.
2. **Digitiser range mapping (to verify on hardware).** v2.0 maps 10 mV to PicoScope range index 1; the PicoSDK Python wrapper's table puts 20 mV at index 1. Recorded volts stay correct, but if the hardware enum starts at 10 mV = 0, every ladder range is one setting larger than stated. The mock-up uses the nominal ranges, as v2.0 does.
3. **Baseline leverage.** v2.0 estimates the baseline from the first 20 ns but subtracts it over the whole 119.8 ns window. In the low_signal reference transition the same signal reads 27 % lower at the less sensitive step (ratio 0.730); the Proposed 30 to 70 ns window gives 1.032.
4. **Auto-ranging corner case.** With a noise-free 800 mV simulation the v2.0 no-signal test sees s = 0 and m = 0 and the range stays at step 1. A noise floor of 1.2 mV avoids this; it is v2.0 behaviour and worth a hardware check.
5. **Saving interval.** The configured 2 s save interval is not applied; the save condition ORs with the loop condition, so the full record is re-saved after every block.
6. **Timeouts.** A timed-out block adds no waveforms, but auto-ranging still runs on the previous last waveform.
7. **Laser emission check.** The v2.0 check is disabled, so "Laser not detected" still passes in v2.0; the Proposed check fails it.
