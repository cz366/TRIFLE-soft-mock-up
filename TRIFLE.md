# TRIFLE software mock-up: project notes

Interactive single-file mock-up of the TRIFLE control and analysis software (in-line time-resolved intrinsic fluorescence on an AKTA), for review with DSP scientists and managers at GSK. Simulated data only; the v2.0 algorithms and the lifetime analysis run for real on it.

## Working on it

- Edit the parts in `source/src/`, never `trifle_mockup.html` directly. Rebuild with `bash source/build.sh`.
- Test with `bash source/run_suite.sh` (Node, Playwright, Chromium; about 8 minutes). Every script must end "no console errors". Expected values are listed in `source/DEVELOPING.md`; when a deliberate change moves them (checksum, sensitivity-change count), update `run_suite.sh`, `DEVELOPING.md` and `README.md` together.
- Screenshots: `node source/tests/render_hd.js "$PWD/trifle_mockup.html" <outdir> 4` (34 screens, desktop and phone).
- Commit the rebuilt `trifle_mockup.html` with its sources. Keep `README.md` in step with the behaviour.

## Versions

- `stage1/trifle_mockup_stage1.html`: Stage 1 build.
- `stage2/trifle_mockup_stage2_trifle_view.html`, git tag `v2-trifle-view`: Stage 2 with the TRIFLE view and lifetime analysis, before the interface simplification.
- `trifle_mockup.html`: current build.

## Decisions to keep

- **TRIFLE view, not UNICORN.** Charts show total fluorescence against time with species chromatograms from the lifetime analysis, a decay map and a Decay panel, after the Roxijen introduction (John Hales, March 2026). UV 280, conductivity and pH sit behind an "AKTA traces" toggle, each in its own strip; never a second y axis.
- **Lifetime analysis (Proposed)** after Hales et al., J Chromatogr A 1641, 461968 (2021): global lifetimes shared by the run, non-negative amplitudes per block, number of components chosen by chi-squared, no peak model and no reference decays. Names come from the template's expected lifetimes (assumed). Shares are fluorescence, not mass or purity.
- **Simulation species:** Protein A: scatter 0.25 ns, HCP 2.2, mAb 3.5, HMW 5.4; AAV: scatter 0.25, lysate 2.2, empty 3.1, full 4.4. Totals unchanged from the single-lifetime model.
- **P7** compares with the elution front (blocks at least 20 times the buffer baseline), not the load plateau.
- **AAV:** components may be named empty and full capsids (assumed); never an empty-to-full particle ratio.
- **Rule IDs are permanent;** labels Existing / Proposed / Future / Assumed / Development assumption / To verify on hardware.
- **Colours:** species follow the species (product blue #2A78D6, impurity orange #EB6834, flow-through aqua #1BAF7A, scatter grey #8C96A0); total fluorescence in primary ink.

## The user's preferences

- Wants TRIFLE's own data presentation (species against time, decays, whole run) as in the Roxijen deck.
- Wants a simple, beautiful, professional interface: the scientist sees only what is needed to run and decide; instrument detail lives in Engineer view.
- Plain British English in the interface, short sentences, units in brackets.

## Environment notes

- Cloud sessions here cannot reach journal sites or PubMed (network policy); the algorithm was taken from the published abstracts.
- Source kit was handed over as `TRIFLE_source_kit.zip`; it is now `source/`.
