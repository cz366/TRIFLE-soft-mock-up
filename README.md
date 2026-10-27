# TRIFLE software mock-up

An interactive mock-up of the TRIFLE control and analysis software, for review with DSP scientists and managers at GSK.

- **One file:** `trifle_mockup.html` (Stage 1 plus Stage 2). Open it in Chrome or Edge. There is no install, no build step and no network access, so it works offline.
- **Simulated data only.** Every number on screen comes from a seeded simulation (mulberry32, seed 20261009) of a GSK platform Protein A run. The calculations run for real on that data. Nothing is a static screenshot.
- **TRIFLE's own view of the data.** The Run and Fraction review charts show what TRIFLE measures, not a UNICORN chromatogram: total fluorescence against time with the species that elute together, separated by their fluorescence decay (lifetime analysis, Proposed), and a Decay panel with the measured decay, the fit and each species' component. The **View** menu adds a decay map of every pulse in the run and the **AKTA traces** (UV 280, conductivity and pH, each in its own strip).
- **A simple scientist view.** The scientist sees only what is needed to run, watch and decide: one instrument status, the run details and method, the species against time, the evidence cards and the fraction decisions. Instrument settings, processing options, fit statistics, the Run log, Calibration and the data-file exports are in **Engineer view** (the switch at the foot of the navigation).
- **Verified against TRIFLE v2.0.** The v2.0 fluorescence and auto-ranging algorithms reproduce `trifle_reference_tests.json`, which is embedded in the file. Open **Engineer view → Diagnostics → Reference tests** to see each value checked (228 of 228 pass).
- **Source:** `source/` holds the parts the file is built from, the build script and the browser test suite. See `source/DEVELOPING.md`.
- **Stage 1 snapshot:** `stage1/trifle_mockup_stage1.html` is the Stage 1 build on its own, kept for comparison.
- **TRIFLE view snapshot:** `stage2/trifle_mockup_stage2_trifle_view.html` (built at the commit "Refit live when the fit degrades") is Stage 2 with the TRIFLE view and lifetime analysis, before the interface simplification.
- **Phone and hosted page.** Below 820 px wide the navigation moves into a Menu drawer and panels stack. When the page runs inside a hosting viewer, exports go through the viewer's save prompt and the Summary (PDF) button is hidden, because printing is not available there.

## Five-minute demonstration

1. **Setup.** Tick Trained user and IP agreement. Setup shows the run details, sign-in and the method from the UNICORN export (AKTA method, column, sample, run time and detector). In the mock-up, **Demo controls → AKTA run** picks the simulated run. The acquisition settings (PMT preset, auto-ranging, options, run time) are in Engineer view, and the TRIFLE delay volumes in Engineer view → Alignment.
2. **Readiness.** The checks run on their own; the header shows one instrument status ("Laser warming up", then "Instrument ready"). The laser reaches "stable (provisional)" at about 23.7 min. Confirm the PMT voltage. Under **Demo controls**, playback at 60× makes this take seconds. Engineer view adds the measured values and limits, the laser warm-up chart and the live pulse.
3. **Run.** Press **Start**. While the run is live, Pause (Continue while paused), End, Mark event and Add note take its place. Total fluorescence appears against time. After 150 blocks the lifetime analysis makes its first fit and the species appear as their own traces: host-cell proteins at the load, then mAb and aggregates (HMW) at the elution. The Decay panel follows the cursor; click the chart to pin a time. **View** adds the decay map, the AKTA traces and rulers; **Reset zoom** appears once you zoom. Run values shows the state, total fluorescence, the species at the latest block and, during elution, concentration. Evidence cards appear as rules fire: P1 (UV saturated), P2 with H1 (possible breakthrough, confirm by Protein A HPLC on FT09 and FT10), P6 (above the calibrated range) and P3 with H2 at the end; instrument cards (I2, range overruns) are collapsed under **Instrument notes**. **Demo controls → Fast-forward** finishes the run immediately.
4. **Fraction review.** Select fractions in the table or drag across the chart. The Species column gives each fraction's share of fluorescence by species: the mAb share of FT10 shows the breakthrough behind P2 and H1, and the HMW share grows across the elution, from about 2 % in E03 to over 20 % in the tail. Turn on **View → AKTA traces** to add the UV 280 columns and compare the UV 100 mAU pool with the fluorescence boundaries, which are a visual comparison only. Elution fractions inside the calibrated range show an indicative concentration. Record decisions (HPLC-SEC, Lunatic, Protein A HPLC or no action).
5. **Record.** Exports first: Summary (PDF, printed to A4; offline file only), Fraction table (CSV) and Chromatogram (PNG). Then the notebook-ready summary, with copy buttons per section, and the audit trail, collapsed at the foot. Engineer view adds Block data (CSV), Metadata (JSON), Raw waveforms (HDF5), the instrument record note, Provenance and the full instrument detail in Methods and Data quality.
6. **Engineer view.** Turn it on to see the same run as the instrument team does: every indicator in the header, the acquisition chips, Processing, sensitivity and input range, the Run log, lifetimes and scatter in the legend, the residual strip and raw pulse, the QC columns, Calibration and Diagnostics.

Other demo controls pick the simulated AKTA run (Protein A platform, AAV capture, free run, manual event marks or no AKTA data, which plots against time and has no fractions or run comparison), start before the laser is stable (rule I1) and use the old UNICORN fraction delay (rule I5, with fraction assignments marked Uncertain). The **Mock-up · simulated data** button in the header opens the About page: evaluation objectives, labels and planned integrations. In Engineer view you can simulate a fault (digitiser, filter wheel or laser), run a reproducibility check and work through **Discrepancies**.

## Stage 2 additions

| Area | Label | What it shows |
|---|---|---|
| Calibration (Engineer view) | Proposed | Step-injection calibration with purified IgG: plateau detection, unweighted, 1/x or 1/x² linear fits, linear range, "possible inner-filter onset" and a calibration record tied to a PMT preset, processing mode and expiry date. Concentration is indicative, elution fractions only, and never used for yield or recovery. Rules P6 (above calibrated range) and I7 (calibration not applicable). |
| Decay analysis | Proposed | Option A decay metric per block, a decay strip on the Run chart, a per-fraction decay column and rule P7 with hypothesis H3 (confirm by HPLC-SEC). P7 compares with the elution front, where fluorescence is at least 20 times the buffer baseline (see TRIFLE view). The option is in Processing (Engineer view); while it is off, it shows only in Engineer view. Engineer view → Decay adds a single-exponential reconvolution fit with the stored IRF, weighted residuals and χ², and the metric definition. |
| Run comparison | Proposed | Overlays the current run on archived runs on a common volume axis (0.05 mL bins), in relative mode, with per-phase integrals and a per-fraction comparison. |
| AAV template | Proposed | AAV affinity capture method (AAVX), with every volume and flow marked assumed. The lifetime analysis separates the co-eluting capsid populations and names them empty and full capsids (assumed, after the Roxijen introduction, March 2026, slide 15). It reports shares of fluorescence, not an empty-to-full particle ratio. |
| Export packaging | Proposed | Summary (PDF), printed to A4, and, in Engineer view, Raw waveforms (HDF5): the estimated file size and the planned group tree. No real HDF5 file is written. |
| Integrations | Future | Live UNICORN link, IDBS E-WorkBook transfer, automatic data storage, a language-model Questions panel and legacy .pkl conversion, each with its GSK prerequisites. None is implemented. |

## TRIFLE view and lifetime analysis (Proposed)

The charts follow the Roxijen introduction (John Hales, March 2026): a total fluorescence chromatogram with the decay-associated chromatograms of the species under it, and decay curves with the measured points, the fit and each component.

| Display | Where | What it shows |
|---|---|---|
| Species chromatograms | Run, Fraction review | Total fluorescence (primary ink) and one trace per species in V·ns, the same units, so the species add up to the total. Time axis by default (min; mL and CV still available). On the log axis only amplitudes above 2 standard errors are drawn. The legend names the species; Engineer view adds each lifetime and the scatter component. |
| Decay map | Run, Fraction review (View menu, off by default) | Every block's decay against run time: 0 to 30 ns after the window start, normalised per pixel column, 2.5 decades of log intensity on a single-hue ramp. Longer-lived species show as a taller band. Samples within 3 SD of the noise are white. The faint band near 25 ns is the stored IRF's late lobes (cable reflections), present in every pulse. |
| Decay panel | Run | The decay at the cursor, the pinned time (click the chart; **Latest** releases it), the latest block while live, or the fluorescence maximum once complete. Points: mean decay over 15 s. Lines: the fit and each species. Legend: each species' share. Engineer view adds the scatter component, the weighted residuals strip, the reduced χ², and a Decay or Pulse switch for the raw pulse with the IRF. |
| Species row, Species column | Run values, Fraction review, Record | Stacked bar and the leading species: the latest block in Run values, and the mean decay of each fraction in the table and the fraction detail. In the scientist view the shares are of the sample's species, without scatter (the buffer's background), and a block or fraction where scatter gives over half the signal reads "Background only". |
| Lifetimes tab | Engineer view → Diagnostics | Lifetimes with standard errors, the template's expected lifetimes and the simulated ones, the model-selection steps, the method, and the reduced χ² of every block. |
| Exports | Record | Block CSV: one amplitude column per species. Fraction CSV: one share column per component. Metadata JSON: lifetimes, standard errors, names, reduced χ² and model selection. The notebook summary adds a Species column and a methods line. |

**Method** (after Hales, Aoudjane, Aeppli and Dalby, *J Chromatogr A* 1641, 461968, 2021, and Uçan, Hales *et al.*, *J Chromatogr A* 1711, 464463, 2023):

1. Each block (10 pulses) contributes the mean of its 10 waveforms, baseline removed, ND-corrected and sign-flipped, over a 40 ns window from 5 ns before the IRF peak. Clipped and discarded blocks are left out.
2. Global analysis: every decay is a non-negative sum of K exponentials convolved with the stored IRF. The lifetimes are shared by the whole run; the amplitudes are free for every decay. Amplitudes against time are the decay-associated chromatograms. No elution profile is assumed and no reference decays are used.
3. The lifetimes are found by Nelder–Mead on χ², with the amplitudes solved exactly by non-negative least squares for each decay (variable projection), on 20-block bins. A bin is a noise-weighted mean of decays, so it is itself a mixture of the same species. The bins are held as their coefficients on 17 orthonormal vectors that span every IRF-convolved exponential from 0.05 to 20 ns to within 10⁻⁷, so χ² is unchanged and each evaluation is about 4 times faster.
4. The number of components is chosen by the data. Starting from one, a component is added only if χ² drops by more than 3 per bin (the number of amplitudes it adds), with lifetimes at least a factor 1.2 apart. The default run adds four components and rejects a fifth: reduced χ² 1.07.
5. The species chromatograms use the mean decay over ±7 blocks (15 s time resolution). A fraction's composition uses the mean decay of all its blocks.
6. Live, the first fit runs after 150 blocks and refits each time the data grow by 30 %, or sooner when the mean reduced χ² of the latest 30 blocks rises above 3 (at most every 120 blocks), so a new species is picked up while it elutes. Each fit starts from the previous lifetimes and runs 12 ms per tick. A final fit runs when acquisition ends, 60 ms per tick, and takes about a second or two. The Run log (Engineer view) records each change in the number of components and the final fit.
7. Components are named after the method template's expected species: the nearest expected lifetime within a factor of 1.35, each species used once. A component with no match is shown as Unassigned. Names are labels, not identification. Shares are of fluorescence, not mass, purity, yield or recovery.

**Simulation.** Species replace the single 3.5 ns lifetime of earlier builds. Each species decays as one exponential (a simplification: real proteins are multi-exponential and give more components than species). The template's expected lifetimes differ from the simulated ones on purpose, to show the naming tolerance.

| Template | Species: simulated lifetime (template's expected lifetime) | Where it appears |
|---|---|---|
| Protein A | Scatter and buffer 0.25 ns (0.3); host-cell proteins 2.2 ns (2.0); mAb (IgG1) 3.5 ns (3.6); aggregates (HMW) 5.4 ns (5.3) | Scatter is every buffer's background (readiness buffer too). HCP is the flow-through. The 4 % rise over the last CV of the load is mAb breakthrough. HMW is 2 % of the product at the front of the elution peak and rises to 27 % in the far tail. The strip peak is 60 % HMW. The buffer excess in CIP equilibration and re-equilibration is mAb carry-over. |
| AAV | Scatter and buffer 0.25 ns (0.3); lysate proteins 2.2 ns (2.0); empty capsids 3.1 ns (3.0); full capsids 4.4 ns (4.6) | Lysate in the flow-through and strip. Full capsids are 30 % of the capsid signal at the front of the elution peak and 50 % in the tail. |

Each species' total is the same as before, so total fluorescence, the calibration and the evidence rules see the same signal. Pulse shapes differ, so auto-ranging differs in detail: the default run now has a data checksum of E9F1FA72 (was E57DAA8F), with the same 13,673 blocks. Per-block timing jitter (0.047 ns) scales every lifetime of a block together. With the default run the analysis recovers 0.248, 2.194, 3.508 and 5.370 ns.

**Limits seen in the simulation.** Where one species dominates, a neighbouring lifetime picks up a small share from noise and the per-block timing jitter: about 0.5 % mAb in the Protein A load plateau (against 3.1 % in FT10, where the breakthrough is), and about 1.4 % empty capsids in the AAV lysate flow-through. Shares of a few per cent next to a large component need an offline check. Species with closer lifetimes than a factor 1.2 are not separated.

**P7.** The decay-metric rule compared the elution with the load plateau. With species, the load plateau is host-cell protein, a different species, so P7 now compares with the first 40 blocks of the elution peak. Both the reference and the windows it tests use only blocks with fluorescence at least 20 times the pre-run buffer baseline, so that prompt scatter does not move the metric. In the default run with decay analysis on, P7 fires in the elution tail (+0.34 ns, E10 and E11), and H3 points to the species composition and HPLC-SEC.

## Labels

| Label | Meaning |
|---|---|
| Existing | Implemented in the current TRIFLE Python control software, version 2.0 |
| Proposed | Designed here, not yet built or experimentally verified |
| Future | Needs further development and access to GSK systems |
| Assumed | An inference the instrument team has not confirmed |
| Development assumption | A Stage 2 modelling choice, such as a fit weighting or linearity limit, not validated |
| To verify on hardware | Read from the v2.0 source code and not yet checked on the instrument |

The Scientist view shows a tag only where it changes the conclusion. The Engineer view shows every tag.

## Assumptions

**Simulation**

- Seed 20261009, mulberry32 random streams per block and waveform. The simulated clock advances by a fixed step per tick, so two playbacks give identical data (checksum in Engineer view → Faults).
- Waveform model: the 7-term IRF from the v2.0 settings convolved with one exponential per species, weighted by each species' share of the signal (see TRIFLE view for the lifetimes), 8-bit quantisation, 600 samples at 0.2 ns. Calibration standards keep a single 3.5 ns lifetime. The IRF amplitude units are not recorded, and W is treated as σ.
- PMT presets: 400 mV has gain 1 and noise 0.2 mV; 800 mV has gain 20 and noise 1.2 mV. The 800 mV values are assumed.
- Laser warm-up: the controller reading steps down at about 18 min; "stable" means the 30 s moving median holds within the tolerance for the hold time.
- Plumbing: V1 (UV to TRIFLE) 0.20 mL, V2 (TRIFLE to fraction collector) 0.15 mL, UNICORN fraction delay 0.35 mL (0.12 mL before TRIFLE was fitted).
- Protein A method volumes and flows follow Appendix A of the Stage 1 prompt (HiScreen MabSelect PrismA, 4.657 mL CV). The 30 min NaOH hold adds time but not volume.
- AAV template: the 1 mL AAVX column, phase volumes, flows and fraction sizes are assumed.
- Archived runs (RUN-0128-01, RUN-0091-01 at 800 mV, UCL-AAV-0813) are simulated with varied seeds and peak scales, with the same species as the live run.
- Record size for the saving estimate: about 50 kB per block (10 waveforms × 600 samples × 8 bytes plus metadata).

**Thresholds** (all provisional and editable in Engineer view → Rules)

- Laser change during acquisition 2 % (I6), re-equilibration baseline 10 % (P3), range overrun counted above 90 % of the input range (I2).
- Calibration linear range: every level within 5 % of the fit; default weighting 1/x; expiry 30 days. These are development assumptions.
- Decay metric computed only where the signal uses 20 % to 90 % of the input range. P7 fires when the mean over a 0.5 mL window shifts from the elution-front reference by more than 0.2 ns and more than 3 SD, using only blocks with fluorescence at least 20 times the buffer baseline.

**Interface**

- Roles (Scientist and Engineer) are a simulated switch, not access control.
- E-WorkBook, UNICORN and data-storage connections are designs only. The Questions panel answers from fixed rules, not a language model.

## Discrepancies found

Engineer view → Diagnostics → **Discrepancies** lists each item with its v2.0 source, its effect, the resolution and the check to run on the instrument. v2.0 behaviour stays the default, and every Proposed fix is off until chosen.

1. **Rule ID clash (resolved).** The Stage 2 prompt names "Calibration not applicable" I6, but Stage 1 already uses I6 for "Laser output changed". Rule IDs are stored in card IDs, the audit trail and the exports, so they are permanent: the calibration rule is **I7**, and no ID is reused. Engineer view → Rules lists all 17 rules with their source. The Stage 2 prompt should be corrected to I7.
2. **Digitiser range mapping (to verify on hardware).** v2.0 sends range index 1 for 10 mV and uses the same index to set the range and to convert counts to volts (scope_class.py 145, 277, 391). In the PicoSDK conversion table, index 1 is 20 mV. If the driver also counts from 10 mV = 0, as public PicoSDK sources suggest, every range is one setting larger and volts are right, but the 80 % target is only 32 to 40 % of the real range. If it counts from 10 mV = 1, volts read 2 to 2.5 times high. The mock-up uses the stated ranges; Ladder and IRF has a what-if for one setting larger. Proposed: select ranges by driver name.
3. **Baseline leverage.** v2.0 takes the baseline as the mean of the first 20 ns and subtracts it over 119.8 ns (signal_class.py 52 to 61). In the low_signal reference, a filter change from OD 2 to OD 3 at 50 mV, the same signal reads 27 % low (ratio 0.730). The median baseline alone gives 1.007, the 30 to 70 ns window alone 0.940, and both together 1.032. Each reference step is one synthetic waveform, so a few per cent is noise. Both are Proposed processing options, off by default.
4. **Flat waveform in auto-ranging (to verify on hardware).** If the first 100 samples of the latest waveform sit on one count and nothing lies below them, v2.0 cannot call it no signal. Every step ties and v2.0 drops to step 1, the least sensitive, from any step (signal_attenuation.py 74, 155, 164). Simulated v2.0 runs never meet this. The Proposed block-median input did meet it on the 800 mV preset (21 drops to step 1 during equilibration), and so would v2.0 if item 2's larger ranges are real. Proposed auto-ranging now counts "nothing below the baseline" as no signal; no reference value changes.
5. **Saving interval (Proposed; to verify on hardware).** loop_measurements.py line 28 ORs the 2 s interval with the loop's own running condition, so v2.0 pickles the whole record after every block. In the simulated run that is 13,675 saves of a record that grows to about 684 MB, about 4.7 TB written in total (estimate). Proposed (Setup): save at most every 2 s, and only with new data, which would make 6,839 saves. On the instrument, log the time and size of each save over a 95 min experiment.
6. **Timeouts (resolved).** A timed-out block adds no waveforms. v2.0 re-runs auto-ranging on the previous block's last waveform, which returns the step already in use, so the range never changes; v2.0 keeps no record of the timeout. The default run has one, at block 6,500. The Run log now lists each timeout, and Auto-range opens it.
7. **Laser emission check (Proposed; to verify on hardware).** connections.py lines 87 to 88 skip the check and set laser_state = True, so v2.0 reports ready without a laser. Re-enabling it is not enough: it also passes when the block times out and returns no waveforms. Proposed (Setup or Readiness): all 10 pulses within 3 s, each at least 0.005 V; a timeout fails and Start stays disabled.

Also found (to verify on hardware): v2.0 sends the trigger threshold as 150 with the comment "Threshold is in mV" (scope_class.py 109). The ps6000a programmer's guide reads the value as ADC counts, about 2.3 mV on ±500 mV, not 0.15 V.

## Deliberate deviations from the prompts

The interface cleanup removed some text the prompts describe, where it repeated information shown elsewhere:

- The processing-mode chip is gone from the acquisition strip; the mode shows on the Processing button and in the status line.
- The scientist's header shows one instrument status ("Instrument ready", "Instrument OK", "Laser warming up" or the fault); Engineer view shows each indicator, with "Laser Stable". "stable (provisional)" stays on Readiness and in the rule text.
- The Engineer view switch has the tooltip "Simulated role", without "not access control"; the Questions caption drops "This is not a general assistant".
- Per-row label tags are shown once per section instead of on every row.
- Detail a scientist does not act on is in Engineer view only: Provenance on Record (the metadata export keeps it), the HDF5 group tree, the fraction median pulse (the Pulse box beside Prev and Next), the delay volumes in the fraction table note, the Blocks and Beam monitor rows in Run values, the I6 card's beam-monitor and controller caveats and the P7 card's IRF note (the metadata export keeps the beam-monitor and IRF notes). The fluorescence boundary level is set in Engineer view → Rules.
- TRIFLE view (this build): the Run and Fraction review charts default to time, and UV 280 is no longer a second y axis on the fluorescence panel. UV 280, conductivity and pH are behind **AKTA traces**, each in its own strip, and the fraction cuts show on the Run chart only with them (Fraction review always shows them). The Engineer-only Pulse panel is now the Pulse view of the Decay panel.
- Interface simplification (this build): the scientist view keeps only what is needed to run and decide, and everything else moved to Engineer view. Moved: the acquisition settings on Setup (a Method summary takes their place); the measured values, limits and labels on Readiness, with the laser warm-up chart and the live pulse; the acquisition chips, Processing, the Run log, sensitivity, input range and blocks in Run values, the lifetimes and scatter in the legend, the low-precision shading, the residual strip and χ² on the Run screen; the QC column in Fraction review (UV 280 columns follow View → AKTA traces); Calibration in the navigation; Block data, Metadata, HDF5 and the instrument record note on Record. The decay map, AKTA traces and rulers are in a View menu, off by default. Range-overrun (I2) and discarded-block (I3) cards are collapsed under Instrument notes on the Run screen and left out of the status line and the fraction Evidence column; the scientist's notebook summary counts them in one line. The notebook summary is concise in the scientist view (Methods: instrument, chromatography, fraction assignment, species method; Data quality: instrument summary, fraction assignment, open observations and hypotheses) and complete in Engineer view; the Metadata export always has everything. The audit trail is collapsed on Record for the scientist.
- The fraction table has no CV column; the x axis switches to CV, and the fraction CSV keeps CV_start and CV_end. Concentration cells read '–' outside elution and Above range or Below range outside the calibrated range.
