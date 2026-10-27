# TRIFLE software mock-up: project notes

Interactive single-file mock-up of the TRIFLE control and analysis software (in-line time-resolved intrinsic fluorescence on an AKTA), for review with DSP scientists and managers at GSK. Simulated data only; the v2.0 algorithms and the lifetime analysis run for real on it.

## Working on it

- Edit the parts in `source/src/`, never `trifle_mockup.html` directly. Rebuild with `bash source/build.sh`.
- Test with `bash source/run_suite.sh` (Node, Playwright, Chromium; about 8 minutes). Every script must end "no console errors". Expected values are listed in `source/DEVELOPING.md`; when a deliberate change moves them (checksum, sensitivity-change count), update `run_suite.sh`, `DEVELOPING.md` and `README.md` together.
- Screenshots: `node source/tests/render_hd.js "$PWD/trifle_mockup.html" <outdir> 4` (36 screens, desktop and phone).
- Commit the rebuilt `trifle_mockup.html` with its sources. Keep `README.md` in step with the behaviour.

## Versions

- `stage1/trifle_mockup_stage1.html`: Stage 1 build.
- `stage2/trifle_mockup_stage2_trifle_view.html` (built at the commit "Refit live when the fit degrades"): Stage 2 with the TRIFLE view and lifetime analysis, before the interface simplification.
- `trifle_mockup.html`: current build, with the simplified scientist view.

## Decisions to keep

- **TRIFLE view, not UNICORN.** Charts show total fluorescence against time with species chromatograms from the lifetime analysis, the decay map (on by default: it is how TRIFLE data look when plotted, the user insists on it) and a Decay panel, after the Roxijen introduction (John Hales, March 2026). UV 280, conductivity and pH sit behind an "AKTA traces" toggle, each in its own strip; never a second y axis.
- **The sample's story on screen.** Buffer reads flat (scientist species drawn at zero where scatter > 50 %, y axis at least 0.2 V·ns). When the sample arrives, detected species appear as filled peaks; co-elution (both ≥ 2 % for 1 min) shows in the tooltip (labels and bars Engineer view only, "for now"). Fraction review suggests Pool / HPLC-SEC / Protein A HPLC / no action (Proposed; limits poolPct 95, exclPct 20, breakPct 2 in Rules); the scientist decides (Apply suggestions fills undecided fractions only). Traces: 2 px, species with a 12 % wash; hover dots and one tooltip.
- **Naming:** Protein A product is "Monomer" (mAb monomer) and HMW is dimer and larger; GSK downstream targets proteins and mAbs. AAV is out of scope for now: Engineer view only.
- **Final version** reads species with a multivariate fit (Future); the displays, detection and suggestions must stay algorithm-agnostic (they consume per-block amplitudes).
- **Lifetime analysis (Proposed)** after Hales et al., J Chromatogr A 1641, 461968 (2021): global lifetimes shared by the run, non-negative amplitudes per block, number of components chosen by chi-squared, no peak model and no reference decays. Names come from the template's expected lifetimes (assumed). Shares are fluorescence, not mass or purity.
- **Simulation species:** Protein A: scatter 0.25 ns, HCP 2.2, mAb 3.5, HMW 5.4; AAV: scatter 0.25, lysate 2.2, empty 3.1, full 4.4. Totals unchanged from the single-lifetime model.
- **P7** compares with the elution front (blocks at least 20 times the buffer baseline), not the load plateau.
- **AAV:** components may be named empty and full capsids (assumed); never an empty-to-full particle ratio.
- **Rule IDs are permanent;** labels Existing / Proposed / Future / Assumed / Development assumption / To verify on hardware.
- **Scientist view is minimal; Engineer view has everything.** Scientist: one header status, Setup run details, sign-in and a Method summary, Readiness check and status, the Run chart at full height with species by name (no lifetimes, no scatter, no peak labels or co-elution bars) and the Decay panel beside it; no Run values or Evidence panel (the user finds them redundant with the chart): open observations are the status-line warning, which opens them with Accept/Dismiss, Fraction review without QC (UV columns only with AKTA traces), Record with three exports, a concise notebook summary and a collapsed audit trail. AKTA traces and rulers live in a View menu, off by default (the decay map is there too, but on). Engineer-only: Run values, Evidence panel, peak labels and co-elution bars, acquisition settings, chips, Processing, Run log, sensitivity and input range, residuals and χ², Calibration, Block data, Metadata, HDF5, Provenance. Scientist species shares exclude scatter; over half scatter reads "Buffer only". Conventions in `source/DEVELOPING.md`.
- **Colours:** species follow the species (product blue #2A78D6, impurity orange #EB6834, flow-through aqua #1BAF7A, scatter grey #8C96A0); total fluorescence in primary ink.

## The user's preferences

- Wants TRIFLE's own data presentation (species against time, decays, whole run) as in the Roxijen deck.
- Wants a simple, beautiful, professional interface: the scientist sees only what is needed to run and decide; instrument detail lives in Engineer view.
- The goal of the screen: a sample runs, TRIFLE detects the species or peaks (e.g. monomer and dimer in a CUB), they appear, and the scientist decides what to pool and what to test offline. Bolder, slightly bigger charts, tasteful on hover.
- Plain British English in the interface, short sentences, units in brackets.

## Environment notes

- Cloud sessions here cannot reach journal sites or PubMed (network policy); the algorithm was taken from the published abstracts.
- Source kit was handed over as `TRIFLE_source_kit.zip`; it is now `source/`.
