# TRIFLE software mock-up

An interactive mock-up of the control and analysis software for TRIFLE, an in-line time-resolved intrinsic fluorescence detector fitted to an AKTA. It was built for review with DSP scientists and managers at GSK.

Everything on screen comes from simulated data, but the calculations are real: the TRIFLE v2.0 fluorescence and auto-ranging algorithms, and a lifetime analysis that separates the species eluting together.

## Getting started

Open `trifle_mockup.html` in Chrome or Edge. It is a single file with no install and no network access, so it works offline. Below 820 px wide the navigation moves into a menu and the panels stack. Inside a hosting viewer, exports go through the viewer's save dialog and Summary (PDF) is hidden.

The data come from a seeded simulation (mulberry32, seed 20261009) of a platform Protein A run, so every playback is identical.

- `source/` holds the parts the file is built from, the build script and the browser tests. See `source/DEVELOPING.md`.
- `stage1/` and `stage2/` keep two earlier builds for comparison: Stage 1 on its own, and Stage 2 with the TRIFLE view before the interface was simplified (built at the commit "Refit live when the fit degrades").

## What it shows

**The data as TRIFLE sees it.** The Run and Fraction review charts plot total fluorescence against time, with each species drawn as its own trace, separated by its fluorescence decay. Under the chart, the decay map shows every pulse in the run, and the Decay panel shows the measured decay at any point with the fit and each species. UV 280, conductivity and pH are under View → AKTA traces, each in its own strip.

**From detection to decision.** While only buffer passes, the traces lie flat. When the sample arrives, each species appears as a filled peak: host-cell proteins (HCP) in the load, then the mAb monomer and HMW (dimer and larger) in the elution. Hovering shows every value and which species co-elute at that point. In Fraction review, each fraction gets a suggested next step (pool, HPLC-SEC, Protein A HPLC or no action) for the scientist to confirm.

**Two views.** The scientist view shows only what is needed to run, watch and decide. Engineer view, switched on at the foot of the navigation, adds the instrument settings, processing options, fit statistics, run log, evidence panel, calibration, data exports and diagnostics. The switch is a simulated role, not access control.

**Checked against TRIFLE v2.0.** The v2.0 algorithms reproduce all 228 values in `trifle_reference_tests.json`, which is embedded in the file. See Engineer view → Diagnostics → Reference tests.

## Five-minute walkthrough

1. **Setup.** Tick Trained user and IP agreement. Setup shows the run details and the method from the UNICORN export. Demo controls → AKTA run picks the simulated run. Acquisition settings and delay volumes are in Engineer view.
2. **Readiness.** The checks run on their own. The header reads "Laser warming up" until the laser is stable (provisional) at about 23.7 min, then "Instrument ready". Confirm the PMT voltage. Playback at 60× (Demo controls) makes this take seconds.
3. **Run.** Press Start. The chart fills the screen with the Decay panel beside it. After 150 blocks the first fit runs and the species appear. Hover for values, or click to pin the decay at a time. When a rule fires, the latest observation shows in the status line at the bottom; click it to read all open observations and accept or dismiss them with a note. This run raises P1 (UV saturated), P2 with H1 (possible breakthrough: confirm by Protein A HPLC on FT09 and FT10), P6 (above the calibrated range) and P3 with H2 at the end. Demo controls → Fast-forward finishes the run.
4. **Fraction review.** The Species column gives each fraction's share of fluorescence. The HMW share rises from about 2 % in E03 to over 20 % in the tail, and the monomer share in FT10 shows the breakthrough. The Suggested column proposes pooling E02 to E05, HPLC-SEC on E06 to E09 to find the pool edge, no action on E10 to E12 and Protein A HPLC on FT10. Apply suggestions copies these into any fraction not yet decided, and Pool and samples lists the result.
5. **Record.** Export the Summary (PDF), Fraction table (CSV) and Chromatogram (PNG), and copy the notebook-ready summary section by section. Engineer view adds Block data (CSV), Metadata (JSON) and the HDF5 size estimate.
6. **Engineer view.** Turn it on to see the same run in full: every header indicator, processing, run values, the run log, evidence cards, peak labels, lifetimes, residuals, QC columns, calibration and diagnostics.

The other demo controls start before the laser is stable (rule I1), use the old UNICORN fraction delay (rule I5) or pick another AKTA run: a free run, manual event marks or no AKTA data. AAV capture is in Engineer view only, as AAV is out of scope for now. The "Mock-up · simulated data" button in the header opens the About page with the evaluation objectives, labels and planned integrations.

## Stage 2 features

| Area | Label | What it does |
|---|---|---|
| Calibration (Engineer view) | Proposed | Step-injection calibration with purified IgG: plateau detection, unweighted, 1/x or 1/x² fits, linear range and possible inner-filter onset, saved against a PMT preset, processing mode and expiry date. Concentration is indicative, for elution fractions only, and never used for yield or recovery. Rules P6 and I7. |
| Decay analysis | Proposed | A decay metric per block and per fraction, and rule P7 with hypothesis H3 (confirm by HPLC-SEC). P7 compares the elution with its own front, using only blocks at least 20 times the buffer baseline. Switched on under Processing (Engineer view). Engineer view → Decay adds a single-exponential fit with residuals. |
| Run comparison | Proposed | Overlays this run on archived runs on a common volume axis, with per-phase totals and a per-fraction comparison. |
| AAV template (Engineer view) | Proposed | AAVX affinity capture, with all volumes and flows assumed. Components are named empty and full capsids (assumed). Shares are of fluorescence, not an empty-to-full particle ratio. |
| Export packaging | Proposed | Summary (PDF) on A4, and an HDF5 size estimate with its planned layout. No HDF5 file is written. |
| Integrations | Future | A multivariate readout algorithm, a live UNICORN link, IDBS E-WorkBook transfer, automatic data storage, a language-model Questions panel and legacy .pkl conversion. None is built. |

## Lifetime analysis (Proposed)

The charts follow the Roxijen introduction (John Hales, March 2026): total fluorescence with the decay-associated chromatogram of each species, and decay curves showing the data, the fit and each component. The method follows Hales, Aoudjane, Aeppli and Dalby, *J Chromatogr A* 1641, 461968 (2021), and Uçan, Hales *et al.*, *J Chromatogr A* 1711, 464463 (2023).

1. Each block of 10 pulses gives one decay: the mean waveform, baseline removed and ND-corrected, over 40 ns from 5 ns before the IRF peak.
2. Every decay is fitted as a non-negative sum of exponentials convolved with the stored IRF. The lifetimes are shared by the whole run; the amplitudes vary from block to block. No peak shape is assumed and no reference decays are used.
3. Lifetimes are found by Nelder–Mead on χ², with the amplitudes solved exactly by non-negative least squares, on 20-block bins compressed onto 17 basis vectors (about four times faster, with χ² unchanged).
4. The data choose the number of components. One is added only if χ² falls by more than 3 per bin and the lifetimes stay at least a factor 1.2 apart. The default run takes four and rejects a fifth (reduced χ² 1.07).
5. The traces use the mean decay over ±7 blocks, giving 15 s resolution. A fraction uses the mean decay of all its blocks.
6. During the run, the first fit comes after 150 blocks, then the fit is repeated as the data grow, or sooner if it gets worse, so a new species is picked up while it elutes. A final fit runs at the end.
7. Components are named after the method template's expected species (the nearest lifetime within a factor of 1.35). Names are labels, not identification, and shares are of fluorescence, not mass or purity.

Each simulated species decays as a single exponential. This is a simplification: real proteins give more components than species.

| Template | Simulated lifetime (template's expected) | Where it appears |
|---|---|---|
| Protein A | Scatter and buffer 0.25 ns (0.3); HCP 2.2 ns (2.0); mAb monomer 3.5 ns (3.6); HMW 5.4 ns (5.3) | HCP in the flow-through, monomer breakthrough over the last CV of the load, HMW from 2 % of the product at the front of the elution to 27 % in the tail, and 60 % HMW in the strip. |
| AAV | Scatter 0.25 ns (0.3); lysate 2.2 ns (2.0); empty capsids 3.1 ns (3.0); full capsids 4.4 ns (4.6) | Full capsids from 30 % of the capsid signal at the front of the elution to 50 % in the tail. |

The default run recovers 0.248, 2.194, 3.508 and 5.370 ns. Its data checksum is E9F1FA72 over 13,673 blocks.

Where one species dominates, a neighbouring lifetime picks up a small share from noise: about 0.5 % monomer in the load plateau, against 3.1 % in FT10 where the breakthrough is. Shares of a few per cent next to a large peak need an offline check, and species whose lifetimes are closer than a factor of 1.2 are not separated.

The final version will replace this analysis with a multivariate fit. The traces, detection and suggestions only use the species amplitudes, so they carry over unchanged.

## Detection and suggestions (Proposed)

These limits are development assumptions. The fraction limits can be changed in Engineer view → Rules.

- **Buffer only:** scatter gives over half the signal. Species are drawn at zero there.
- **Species detected:** a stretch where a species stays above 5 % of its own maximum and gives at least 5 % of the sample's fluorescence. Engineer view labels each one at its apex.
- **Co-elution:** two species each give at least 2 % of the sample's fluorescence for a minute or more. The default run finds HCP with monomer at the end of the load, and monomer with HMW across the elution peak and in the strip.
- **Suggestions,** from a fraction's shares with scatter left out: in the elution, pool at 95 % product or more, HPLC-SEC while the main impurity stays under 20 %, and no action above that; in the load, Protein A HPLC at 2 % product or more.

## Labels

| Label | Meaning |
|---|---|
| Existing | In the current TRIFLE control software, v2.0 |
| Proposed | Designed here, not yet built or verified |
| Future | Needs further development and access to GSK systems |
| Assumed | Not yet confirmed by the instrument team |
| Development assumption | A modelling choice, such as a fit weighting or linearity limit, not validated |
| To verify on hardware | Read from the v2.0 source code, not yet checked on the instrument |

The scientist view shows a label only where it changes the conclusion; Engineer view shows them all. Rule IDs never change and are never reused.

## Assumptions

- The simulated clock advances by a fixed step, so two playbacks give identical data (checksum in Engineer view → Faults).
- Waveforms: the 7-term IRF from the v2.0 settings convolved with one exponential per species, 8-bit, 600 samples at 0.2 ns. Calibration standards use a single 3.5 ns lifetime. The IRF amplitude units are not recorded, and W is taken as σ.
- PMT presets: 400 mV (gain 1, noise 0.2 mV) and 800 mV (gain 20, noise 1.2 mV, assumed).
- Laser: the controller reading steps down at about 18 min. Stable means the 30 s moving median holds within tolerance for the hold time.
- Plumbing: UV to TRIFLE 0.20 mL, TRIFLE to fraction collector 0.15 mL, UNICORN fraction delay 0.35 mL (0.12 mL before TRIFLE was fitted).
- Protein A method: HiScreen MabSelect PrismA, 4.657 mL CV. The 30 min NaOH hold adds time but not volume. The AAV column, volumes, flows and fraction sizes are assumed.
- Archived runs for comparison are simulated with other seeds and peak sizes.
- Thresholds are provisional and editable in Engineer view → Rules: laser change 2 % (I6), re-equilibration baseline 10 % (P3), range overrun above 90 % of the input range (I2), calibration linear range within 5 % (1/x weighting, 30-day expiry), and a P7 shift of more than 0.2 ns and 3 SD.
- Connections to E-WorkBook, UNICORN and data storage are designs only. The Questions panel answers from fixed rules, not a language model.

## Issues found in TRIFLE v2.0

Engineer view → Diagnostics → Discrepancies lists each issue with its source, effect, resolution and the check to run on the instrument. v2.0 behaviour stays the default, and every proposed fix is off until chosen.

1. **Digitiser range mapping (to verify on hardware).** v2.0 sends range index 1 for 10 mV and uses that index both to set the range and to convert counts to volts (scope_class.py 145, 277, 391). In the PicoSDK table, index 1 is 20 mV. If the driver counts from 10 mV = 0, every range is one setting larger: volts are right, but the 80 % target is only 32 to 40 % of the real range. If it counts from 10 mV = 1, volts read 2 to 2.5 times high. Proposed: select ranges by name.
2. **Baseline leverage.** v2.0 takes the baseline as the mean of the first 20 ns and subtracts it over the whole 119.8 ns (signal_class.py 52 to 61). In the low-signal reference, a filter change from OD 2 to OD 3 at 50 mV reads 27 % low. A median baseline gives 1.007, a 30 to 70 ns window 0.940, and both together 1.032. Both are proposed options, off by default.
3. **Flat waveform in auto-ranging (to verify on hardware).** If the first 100 samples sit on one count with nothing below them, v2.0 cannot recognise that there is no signal and drops to the least sensitive step (signal_attenuation.py 74, 155, 164). Proposed auto-ranging treats this as no signal.
4. **Saving interval (to verify on hardware).** Because of loop_measurements.py line 28, v2.0 saves the whole record after every block: in the simulated run, 13,675 saves of a record that grows to about 684 MB, about 4.7 TB written in total. Proposed: save at most every 2 s, and only when there is new data (6,839 saves). On the instrument, log the time and size of each save over a 95 min run.
5. **Timeouts.** A timed-out block adds no waveforms, and v2.0 keeps no record of it. The default run has one, at block 6,500, and the run log now lists each one.
6. **Laser emission check (to verify on hardware).** connections.py lines 87 to 88 skip the check and set laser_state = True, so v2.0 reports ready without a laser. Proposed: all 10 pulses within 3 s, each at least 0.005 V; a timeout fails and Start stays disabled.
7. **Trigger threshold (to verify on hardware).** v2.0 sends 150 with the comment "Threshold is in mV" (scope_class.py 109). The ps6000a guide reads the value as ADC counts, about 2.3 mV on ±500 mV.
