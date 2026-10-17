# TRIFLE software mock-up

An interactive mock-up of the TRIFLE control and analysis software, for review with DSP scientists and managers at GSK.

- **One file:** `trifle_mockup.html` (Stage 1 plus Stage 2). Open it in Chrome or Edge. There is no install, no build step and no network access, so it works offline.
- **Simulated data only.** Every number on screen comes from a seeded simulation (mulberry32, seed 20261009) of a GSK platform Protein A run. The calculations run for real on that data. Nothing is a static screenshot.
- **Verified against TRIFLE v2.0.** The v2.0 fluorescence and auto-ranging algorithms reproduce `trifle_reference_tests.json`, which is embedded in the file. Open **Engineer view → Diagnostics → Reference tests** to see each value checked (228 of 228 pass).
- **Stage 1 snapshot:** `stage1/trifle_mockup_stage1.html` is the Stage 1 build on its own, kept for comparison.
- **Phone and hosted page.** Below 820 px wide the navigation moves into a Menu drawer and panels stack. When the page runs inside a hosting viewer, exports go through the viewer's save prompt and the PDF button is hidden, because printing is not available there.

## Five-minute demonstration

1. **Setup.** Tick Trained user and IP agreement. Setup holds only TRIFLE's own settings: run details, sign-in and acquisition (PMT preset, auto-ranging, options, run time). The AKTA method, phases and fractions come from the UNICORN export; in the mock-up, **Demo controls → AKTA run** picks the simulated run. The TRIFLE delay volumes are instrument configuration, in Engineer view → Alignment check.
2. **Readiness.** The checks run on their own. The laser warm-up panel shows the controller reading stepping down at about 18 min and reaching "stable (provisional)" at about 23.7 min. Confirm the PMT voltage. Under **Demo controls**, playback at 60× makes this take seconds.
3. **Run.** Press **Start**. Fluorescence, UV 280, conductivity and pH appear against volume. Evidence cards appear as rules fire: P1 (UV saturated), P2 with H1 (possible breakthrough, confirm by Protein A HPLC on FT09 and FT10), I2 (range overruns), P6 (above the calibrated range) and P3 with H2 at the end. **Fast-forward to run end** finishes the run immediately.
4. **Fraction review.** Select fractions in the table or drag across the chart. Compare the UV 100 mAU pool with the fluorescence boundaries, which are a visual comparison only. Elution fractions inside the calibrated range show an indicative concentration. Record decisions (SEC, Lunatic, Protein A HPLC or no action).
5. **Record.** Copy the notebook-ready sections and export CSV, JSON and PNG files, or print an A4 PDF (offline file only). The audit trail lists every change.

Other demo controls pick the simulated AKTA run (Protein A platform, AAV capture, free run, manual event marks or no AKTA data), start before the laser is stable (rule I1) and use the old UNICORN fraction delay (rule I5, with fraction assignments marked Uncertain). The **Mock-up · simulated data** button in the header opens the About page: evaluation objectives, labels and planned integrations. In Engineer view you can simulate a fault (digitiser, filter wheel or laser), run a reproducibility check and work through **Discrepancies to verify**.

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
| Assumed | An inference the instrument team has not confirmed |
| Development assumption, not validated | A Stage 2 modelling choice, such as a fit weighting or linearity limit |
| To verify on hardware | A v2.0 behaviour or fix that needs a bench check on the instrument |

The Scientist view shows a tag only where it changes the conclusion. The Engineer view shows every tag.

## Assumptions

**Simulation**

- Seed 20261009, mulberry32 random streams per block and waveform. The simulated clock advances by a fixed step per tick, so two playbacks give identical data (checksum in Engineer view, Faults and reproducibility).
- Waveform model: the 7-term IRF from the v2.0 settings convolved with a single exponential (τ about 3.5 ns), 8-bit quantisation, 600 samples at 0.2 ns. The IRF amplitude units are not recorded, and W is treated as σ.
- PMT presets: 400 mV has gain 1 and noise 0.2 mV; 800 mV has gain 20 and noise 1.2 mV. The 800 mV values are assumed.
- Laser warm-up: the controller reading steps down at about 18 min; "stable" means the 30 s moving median holds within the tolerance for the hold time.
- Plumbing: V1 (UV to TRIFLE) 0.20 mL, V2 (TRIFLE to fraction collector) 0.15 mL, UNICORN fraction delay 0.35 mL (0.12 mL before TRIFLE was fitted).
- Protein A method volumes and flows follow Appendix A of the Stage 1 prompt (HiScreen MabSelect PrismA, 4.657 mL CV). The 30 min NaOH hold adds time but not volume.
- AAV template: the 1 mL AAVX column, phase volumes, flows and fraction sizes are assumed.
- Archived runs (RUN-0128-01, RUN-0091-01 at 800 mV, UCL-AAV-0813) are simulated with varied seeds and peak scales.
- Record size for the saving estimate: about 50 kB per block (10 waveforms × 600 samples × 8 bytes plus metadata).

**Thresholds** (all provisional and editable in Engineer view → Rules and thresholds)

- Laser change during acquisition 2 % (I6), re-equilibration baseline 10 % (P3), range overrun counted above 90 % of the input range (I2).
- Calibration linear range: every level within 5 % of the fit; default weighting 1/x; expiry 30 days. These are development assumptions.
- Decay metric computed only where the signal uses 20 % to 90 % of the input range. P7 fires when the mean over a 0.5 mL window shifts from the load-plateau reference by more than 0.2 ns and more than 3 SD.

**Interface**

- Roles (Scientist and Engineer) are a simulated switch, not access control.
- E-WorkBook, UNICORN and data-storage connections are designs only. The Questions panel answers from fixed rules, not a language model.

## Discrepancies found

Engineer view → Diagnostics → **Discrepancies to verify** lists each item with its v2.0 source, its effect, the resolution and the check to run on the instrument. v2.0 behaviour stays the default, and every Proposed fix is off until chosen.

1. **Rule ID clash (resolved).** The Stage 2 prompt names "Calibration not applicable" I6, but Stage 1 already uses I6 for "Laser output changed". Rule IDs are stored in card IDs, the audit trail and the exports, so they are permanent: the calibration rule is **I7**, and no ID is reused. Engineer view → Rules and thresholds lists all 17 rules with their source. The Stage 2 prompt should be corrected to I7.
2. **Digitiser range mapping (to verify on hardware).** v2.0 sends range index 1 for 10 mV and uses the same index to set the range and to convert counts to volts (scope_class.py 145, 277, 391). In the PicoSDK conversion table, index 1 is 20 mV. If the driver also counts from 10 mV = 0, as public PicoSDK sources suggest, every range is one setting larger and volts are right, but the 80 % target is only 32 to 40 % of the real range. If it counts from 10 mV = 1, volts read 2 to 2.5 times high. The mock-up uses the stated ranges; Ladder and IRF has a what-if for one setting larger. Proposed: select ranges by driver name.
3. **Baseline leverage.** v2.0 takes the baseline as the mean of the first 20 ns and subtracts it over 119.8 ns (signal_class.py 52 to 61). In the low_signal reference, a filter change from OD 2 to OD 3 at 50 mV, the same signal reads 27 % low (ratio 0.730). The median baseline alone gives 1.007, the 30 to 70 ns window alone 0.940, and both together 1.032. Each reference step is one synthetic waveform, so a few per cent is noise. Both are Proposed processing options, off by default.
4. **Flat waveform in auto-ranging (to verify on hardware).** If the first 100 samples of the latest waveform sit on one count and nothing lies below them, v2.0 cannot call it no signal. Every step ties and v2.0 drops to step 1, the least sensitive, from any step (signal_attenuation.py 74, 155, 164). Simulated v2.0 runs never meet this. The Proposed block-median input did meet it on the 800 mV preset (21 drops to step 1 during equilibration), and so would v2.0 if item 2's larger ranges are real. Proposed auto-ranging now counts "nothing below the baseline" as no signal; no reference value changes.
5. **Saving interval (Proposed; to verify on hardware).** loop_measurements.py line 28 ORs the 2 s interval with the loop's own running condition, so v2.0 pickles the whole record after every block. In the simulated run that is 13,675 saves of a record that grows to about 684 MB, about 4.7 TB written in total (estimate). Proposed (Setup): save at most every 2 s, and only with new data, which would make 6,839 saves. On the instrument, log the time and size of each save over a 95 min experiment.
6. **Timeouts (resolved).** A timed-out block adds no waveforms. v2.0 re-runs auto-ranging on the previous block's last waveform, which returns the step already in use, so the range never changes; v2.0 keeps no record of the timeout. The default run has one, at block 6,500. The Run log now lists each timeout, and Auto-range trace opens it.
7. **Laser emission check (Proposed; to verify on hardware).** connections.py lines 87 to 88 skip the check and set laser_state = True, so v2.0 reports ready without a laser. Re-enabling it is not enough: it also passes when the block times out and returns no waveforms. Proposed (Setup or Readiness): all 10 pulses within 3 s, each at least 0.005 V; a timeout fails and Start stays disabled.

Also found (to verify on hardware): v2.0 sends the trigger threshold as 150 with the comment "Threshold is in mV" (scope_class.py 109). The ps6000a programmer's guide reads the value as ADC counts, about 2.3 mV on ±500 mV, not 0.15 V.

## Deliberate deviations from the prompts

The interface cleanup removed some text the prompts describe, where it repeated information shown elsewhere:

- The processing-mode chip is gone from the acquisition strip; the mode shows on the Processing button and in the status line.
- The header shows "Laser Stable"; "stable (provisional)" stays on Readiness and in the rule text.
- The Engineer switch reads "Simulated role" without "not access control"; the Questions caption drops "This is not a general assistant".
- Per-row label tags are shown once per section instead of on every row.
