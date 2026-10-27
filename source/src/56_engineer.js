/* ---------- Engineer view: essential diagnostics (simulated role) ---------- */
const ENG = (function () {
  const { $, $$, esc, el, tag } = UI, S = M.S, fmt = M.fmt, C = CH.C;
  let built = false, tab = 'tests', charts = {}, corrupt = false, alignBefore = true, guides = null, wfSel = { block: null, wf: 10 }, arBlock = null, testRes = null, repro = null, discSel = 1, discAt = 0;
  // Stage 2 inserts its tabs with addTab(key, label, afterKey)
  const TABS = [['tests', 'Reference tests'], ['align', 'Alignment'], ['ar', 'Auto-range'], ['wf', 'Waveforms'], ['ladder', 'Ladder and IRF'], ['laser', 'Laser log'], ['th', 'Rules'], ['changes', 'Changes'], ['disc', 'Discrepancies'], ['faults', 'Faults']];
  /* ---------- reference tests: the same functions that process the simulated run ---------- */
  function runTests() {
    const R = JSON.parse(document.getElementById('ref-tests').textContent);
    const lad = TR.LADDERS[400], tol = R.conventions.tolerance, out = [];
    const exp = v => corrupt && typeof v === 'number' && v !== 0 ? v * 1.0001 : v;
    function cmp(caseId, mode, key, e, g) {
      e = exp(e);
      let pass, diff = '';
      if (typeof e === 'number') { const d = Math.abs(e - g); pass = d <= tol.absolute_V || d <= tol.relative * Math.abs(e); diff = d; }
      else if (Array.isArray(e)) { pass = Array.isArray(g) && g.length === e.length && e.every((x, i) => x === null ? g[i] === null : (typeof x === 'number' ? Math.abs(x - g[i]) <= tol.absolute_V || Math.abs(x - g[i]) <= tol.relative * Math.abs(x) : x === g[i])); diff = pass ? 0 : 'mismatch'; }
      else { pass = e === g; diff = pass ? 0 : 'differs'; }
      out.push({ caseId, mode, key, e, g, diff, pass });
    }
    for (const c of R.cases) {
      const v = TR.countsToVolts(c.counts, c.range_V);
      const a = TR.tfcV20(v, c.transmission), b = TR.autorange(v, c.step, c.blocks_completed, lad, {}), p = TR.tfcProposed(v, c.transmission, TR.WIN0, TR.WIN1), q = TR.autorange(v, c.step, c.blocks_completed, lad, { symmetric: true, unscaled: true, flatGuard: true });
      for (const k in c.expected_v20.tfc) cmp(c.id, 'v2.0 reference', k, c.expected_v20.tfc[k], a[k]);
      for (const k in c.expected_v20.autorange) cmp(c.id, 'v2.0 reference', 'autorange.' + k, c.expected_v20.autorange[k], b[k]);
      for (const k in c.expected_proposed.tfc) cmp(c.id, 'Proposed', k, c.expected_proposed.tfc[k], p[k]);
      for (const k in c.expected_proposed.autorange) cmp(c.id, 'Proposed', 'autorange.' + k, c.expected_proposed.autorange[k], q[k]);
    }
    for (const t of R.filter_transitions) {
      const vals = [];
      t.waveforms.forEach((w, k) => {
        const v = TR.countsToVolts(w.counts, w.range_V), a = TR.tfcV20(v, w.transmission), p = TR.tfcProposed(v, w.transmission, TR.WIN0, TR.WIN1);
        for (const key in w.expected_v20) cmp(t.id + ' (step ' + w.step + ')', 'v2.0 reference', key, w.expected_v20[key], a[key]);
        for (const key in w.expected_proposed) cmp(t.id + ' (step ' + w.step + ')', 'Proposed', key, w.expected_proposed[key], p[key]);
        vals.push([a.display_fluorescence_V_ns, p.window_30_70ns_display_fluorescence_V_ns]);
      });
      cmp(t.id, 'v2.0 reference', 'ratio_v20', t.ratio_v20, vals[1][0] / vals[0][0]);
      cmp(t.id, 'Proposed', 'ratio_proposed_window', t.ratio_proposed_window, vals[1][1] / vals[0][1]);
    }
    return { rows: out, pass: out.filter(r => r.pass).length, total: out.length, data: R };
  }
  function showVal(v) { if (v === null || v === undefined) return 'null'; if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toPrecision(12); if (Array.isArray(v)) return '[' + v.map(showVal).join(', ') + ']'; return String(v); }
  function testsHtml() {
    const r = testRes, ok = r.pass === r.total, tol = r.data.conventions.tolerance;
    const about = 'Cases from trifle_reference_tests.json, run at startup in v2.0 reference and Proposed modes. Tolerance: relative ' + tol.relative + ' or absolute ' + tol.absolute_V + ' V; decisions must match exactly.';
    return (ok ? '<div class="note" style="margin-bottom:8px">' + about + ' The run is processed by these same functions.</div>'
      : '<div class="callout fault" style="margin-bottom:8px">' + UI.stateHtml('fault', (r.total - r.pass) + ' of ' + r.total + ' reference values fail') + ' A failure means the algorithm differs from v2.0. Do not use processed data until it is resolved. <span class="small">' + about + '</span></div>') +
      '<label class="chk small" style="margin-bottom:6px"><input type="checkbox" id="tCorrupt"' + (corrupt ? ' checked' : '') + '> Show the failure state (demo)</label>' +
      '<div class="tbl-wrap" style="max-height:520px"><table class="tbl"><thead><tr><th>Case</th><th>Mode</th><th>Value</th><th>Result</th><th class="num">Expected</th><th class="num">Computed</th><th class="num">Difference</th></tr></thead><tbody>' +
      r.rows.map(x => '<tr><td>' + esc(x.caseId) + '</td><td>' + esc(x.mode) + '</td><td class="wrap" style="overflow-wrap:anywhere;min-width:120px">' + esc(x.key) + '</td><td class="' + (x.pass ? 'pass' : 'fail') + '">' + (x.pass ? 'Pass' : 'Fail') + '</td><td class="num wrap" style="max-width:260px">' + esc(showVal(x.e)) + '</td><td class="num wrap" style="max-width:260px">' + esc(showVal(x.g)) + '</td><td class="num">' + (typeof x.diff === 'number' ? x.diff.toExponential(1) : esc(x.diff)) + '</td></tr>').join('') + '</tbody></table></div>';
  }
  /* ---------- alignment check ---------- */
  function alignData() {
    const R = S.run; if (!R) return null;
    const lp = R.ph.list.find(p => p.key === 'load'); if (!lp) return null;
    const A = R.acq, K = R.akta, x0 = lp.v0, x1 = lp.v0 + 6;
    const ui0 = TR.lowerBound(K.v, R.aktaN, x0), ui1 = TR.lowerBound(K.v, R.aktaN, x1);
    if (ui1 - ui0 < 10) return null;
    let uvMax = 0; for (let k = ui0; k < ui1; k++) uvMax = Math.max(uvMax, K.uv[k]);
    const uv = { x: new Float64Array(ui1 - ui0), y: new Float64Array(ui1 - ui0), n: ui1 - ui0 }; for (let k = ui0; k < ui1; k++) { uv.x[k - ui0] = K.v[k]; uv.y[k - ui0] = K.uv[k] / uvMax * 100; }
    const key = alignBefore ? 'vp' : 'u', i0 = TR.lowerBound(A[key], A.n, x0), i1 = TR.lowerBound(A[key], A.n, x1);
    let fmax = 0, f0 = Infinity; for (let i = i0; i < i1; i++) if (!A.disc[i]) { fmax = Math.max(fmax, R.y.act[i]); f0 = Math.min(f0, R.y.act[i]); }
    const fl = { x: new Float64Array(i1 - i0), y: new Float64Array(i1 - i0), n: i1 - i0 }; for (let i = i0; i < i1; i++) { fl.x[i - i0] = A[key][i]; fl.y[i - i0] = A.disc[i] ? NaN : (R.y.act[i] - f0) / (fmax - f0) * 100; }
    const half = d => { for (let k = 1; k < d.n; k++) if (d.y[k - 1] < 50 && d.y[k] >= 50) return d.x[k - 1] + (50 - d.y[k - 1]) / (d.y[k] - d.y[k - 1]) * (d.x[k] - d.x[k - 1]); return null; };
    return { uv, fl, x0, x1, uvHalf: half(uv), flHalf: half(fl) };
  }
  function alignHtml() {
    const s = S.setup, p = M.plumbing(), al = M.alignmentState();
    return '<div class="eng-align"><div><div class="toolbar" style="margin-bottom:6px"><div class="seg sm" id="alBA"><button data-v="1"' + (alignBefore ? ' class="on"' : '') + '>Before alignment</button><button data-v="0"' + (!alignBefore ? ' class="on"' : '') + '>After alignment</button></div><span class="note">Drag the two guides onto the UV and fluorescence fronts at the start of the load.</span></div><div style="height:330px" id="alChart"></div></div>' +
      '<div><h3 style="margin-bottom:6px">Delay volumes</h3><table class="tbl" style="margin-bottom:6px"><thead><tr><th>Delay volume</th><th class="num">mL</th></tr></thead><tbody><tr><td title="Used for detector alignment">V1, UV to TRIFLE</td><td class="num">' + '<input id="eV1" type="number" step="0.01" min="0" value="' + fmt.ml(s.V1) + '" style="width:84px"' + (S.run ? ' disabled' : '') + '>' + '</td></tr><tr><td title="Used for fraction assignment">V2, TRIFLE to collector</td><td class="num">' + '<input id="eV2" type="number" step="0.01" min="0" value="' + fmt.ml(s.V2) + '" style="width:84px"' + (S.run ? ' disabled' : '') + '>' + '</td></tr><tr><td>V1 + V2</td><td class="num">' + fmt.ml(s.V1 + s.V2) + '</td></tr><tr><td title="Used for fraction cuts in UNICORN">UNICORN fraction delay</td><td class="num">' + '<input id="eFd" type="number" step="0.01" min="0" value="' + fmt.ml(p.fracDelay) + '" style="width:84px"' + (S.run || S.demo.delayNotUpdated ? ' disabled' : '') + '>' + '</td></tr></tbody></table><div class="note" style="margin-bottom:8px">Set when TRIFLE is plumbed in; simulation values. Locked during a run. Tolerance ' + fmt.ml(S.th.i5Tol) + ' mL.</div>' +
      '<div id="alOffset" class="callout"></div><div class="note" style="margin-top:8px">Alignment needs re-checking only when the tubing changes. Last checked ' + S.alignChecked + '. <button class="link small" id="alRec">Record a check today</button></div>' +
      (al.issues.length ? '<div class="note" style="margin-top:6px">Fraction assignment: ' + esc(al.fractions) + '. ' + esc(al.issues.join(' ')) + '</div>' : '') + '</div></div>';
  }
  function mountAlign() {
    const d = alignData(); const host = $('#alChart'); if (!host) return;
    if (!d) { host.innerHTML = '<div class="note">Start a run and acquire past the start of the load to see the fronts.</div>'; return; }
    guides = guides && guides.before === alignBefore ? guides : { before: alignBefore, g1: d.uvHalf || d.x0 + 1, g2: d.flHalf || d.x0 + 1.2 };
    charts.al = new CH.Chart(host, {
      ariaLabel: 'Alignment check', topBand: 8, marginRight: 12, xDomain: () => [d.x0, d.x1], xTitle: () => 'Volume (mL)' + (alignBefore ? ', TRIFLE at acquisition volume' : ', TRIFLE aligned by V1'),
      panels: [{ key: 'main', yl: { title: 'Front height', unit: '% of plateau', fixed: [-5, 130] } }],
      series: [{ key: 'uv', label: 'UV 280 front', color: C.uv, width: 1.25, panel: 'main', src: () => d.uv, fmt: v => v.toFixed(0) + ' %' }, { key: 'fl', label: 'Fluorescence front', color: M.procMode() === 'v20' ? C.v20 : C.prop, width: 1.25, panel: 'main', src: () => d.fl, fmt: v => v.toFixed(0) + ' %' }],
      guides: () => [{ id: 'g1', x: guides.g1, color: C.uv, dash: 'dash', label: 'UV', row: 1, drag: v => { guides.g1 = v; }, onDrag: offset }, { id: 'g2', x: guides.g2, color: C.v20, dash: 'dash', label: 'Fluorescence', row: 2, drag: v => { guides.g2 = v; }, onDrag: offset }]
    });
    offset();
    function offset() { const o = guides.g2 - guides.g1, b = $('#alOffset'); if (!b) return; b.innerHTML = 'Offset implied by the guides: <b>' + fmt.ml(o) + ' mL</b>. Entered V1: <b>' + fmt.ml(S.setup.V1) + ' mL</b>. ' + (alignBefore ? (Math.abs(o - S.setup.V1) <= 0.05 ? 'Consistent within 0.05 mL.' : 'Differs from V1 by ' + fmt.ml(Math.abs(o - S.setup.V1)) + ' mL. Check the tubing and V1.') : (Math.abs(o) <= 0.05 ? 'After alignment the fronts coincide within 0.05 mL.' : 'Residual offset after alignment. Check V1.')); }
  }
  /* ---------- auto-range decision trace ---------- */
  function lastGood(A, i) { let j = i - 1; while (j >= 0 && A.disc[j]) j--; return j; }
  function arHtml() {
    const R = S.run; if (!R || !R.acq.n) return '<div class="note">Start a run to see the decision trace for each block.</div>';
    const A = R.acq, prop = R.setupSnap.autorange === 'prop', ch = A.changes.slice(-200), lad = TR.LADDERS[R.pmt];
    // Latest skips timed-out blocks; a timed-out block opens when it is selected explicitly
    let i = arBlock == null ? A.n - 1 : Math.min(A.n - 1, Math.max(0, arBlock)); if (arBlock == null) while (i > 0 && A.disc[i]) i--;
    const to = !!A.disc[i], j = to ? lastGood(A, i) : i;
    const bar = '<div class="toolbar" style="margin-bottom:8px"><label class="small">Block <input type="number" id="arBlk" min="1" max="' + A.n + '" value="' + (i + 1) + '" style="width:90px"></label><button class="btn sm" id="arLatest">Latest</button><select id="arCh" style="height:22px" class="small"><option value="">Jump to a sensitivity change…</option>' + ch.map(c => '<option value="' + c.i + '">Block ' + (c.i + 1) + ': step ' + c.from + ' to step ' + c.to + ' at ' + fmt.ml(A.u[c.i]) + ' mL</option>').join('') + '</select><span class="note">Acquisition mode: ' + (prop ? 'Proposed (median of the block\'s 10 waveforms)' : 'v2.0 reference (latest single waveform)') + '</span></div>';
    const toRows = to ? '<tr><td>Block ' + fmt.int(i + 1) + '</td><td colspan="2">Timed out after ' + TR.ACQ.timeoutS + ' s: no waveforms</td></tr>' : '';
    const toNote = to ? '<div class="note" style="margin-top:6px">v2.0 keeps no record of a timeout. It shows only as an extra ' + TR.ACQ.timeoutS + ' s between timestamps.</div>' : '';
    if (to && j < 0) return bar + '<table class="tbl" style="max-width:560px"><tbody>' + toRows + '<tr><td>Auto-ranging</td><td colspan="2">No earlier waveform; nothing to re-run.</td></tr></tbody></table>' + toNote;
    const waves = TR.regenBlock(A, j), input = prop ? TR.medianWave(waves) : waves[9];
    const bc = to ? A.bc[i] : A.bc[i] + 1, d = TR.autorange(input, A.step[j], bc, lad, { symmetric: prop, unscaled: prop, flatGuard: prop });
    const cs = lad[A.step[j] - 1];
    let rowsH = '';
    if (d.allowed_steps) d.allowed_steps.forEach((k, n) => { const st = lad[k - 1]; rowsH += '<tr' + (k === d.decision_step ? ' class="sel"' : '') + '><td>' + k + '</td><td>OD ' + st.nd + '</td><td class="num">' + TR.ND_T_SHOWN[String(st.nd)] + '</td><td class="num">' + st.range * 1000 + '</td><td class="num">' + (d.use ? (d.use[n] * 100).toFixed(1) : '–') + '</td><td>' + (d.eligible ? (d.eligible[n] ? 'Yes' : 'No') : (d.no_signal ? 'Not scored' : '–')) + '</td><td class="num">' + (d.scores && d.scores[n] != null ? d.scores[n].toFixed(5) : '–') + '</td></tr>'; });
    const dec = d.decision_step === 'no change' ? 'no change' : 'step ' + d.decision_step;
    const why = !d.evaluated ? '' : d.none_eligible ? 'none eligible: step 1' : d.no_signal ? 'most sensitive allowed' : 'lowest score (0.80 − u)²';
    return bar + '<div class="eng-split">' +
      '<div><div class="tbl-wrap"><table class="tbl" id="arIn"><tbody>' + toRows +
      (to ? '<tr><td>Auto-ranging</td><td colspan="2">Re-runs on the ' + (prop ? 'block median' : 'last waveform') + ' of block ' + fmt.int(j + 1) + ' (step ' + A.step[j] + ')</td></tr>' : '') +
      '<tr><td>Blocks completed before this decision</td><td class="num">' + fmt.int(bc) + '</td><td>' + (d.evaluated ? 'more than 5: evaluated' : '5 or fewer: no change') + '</td></tr>' +
      (to ? '' : '<tr><td>Current step</td><td class="num">' + A.step[i] + '</td><td>OD ' + cs.nd + ', ' + cs.range * 1000 + ' mV</td></tr>') +
      '<tr><td>b, median of first 100 samples</td><td class="num">' + (d.b_median_V * 1000).toFixed(4) + '</td><td>mV</td></tr>' +
      '<tr><td>s, SD of first 100 samples</td><td class="num">' + (d.s_V * 1000).toFixed(4) + '</td><td>mV</td></tr>' +
      '<tr><td>T, transmission of current filter</td><td class="num">' + d.T.toPrecision(5) + '</td><td></td></tr>' +
      '<tr><td>m = min((waveform − b) / T)</td><td class="num">' + (d.m_unattenuated_V * 1000).toPrecision(5) + '</td><td>mV, unattenuated</td></tr>' +
      '<tr><td>No-signal test</td><td class="num">' + (d.no_signal == null ? '–' : d.no_signal ? 'No signal' : 'Signal') + '</td><td></td></tr>' +
      (d.guard || d.flat ? '<tr><td>Flat waveform</td><td class="num">m = 0</td><td class="wrap">' + (d.guard ? 'Nothing below the baseline. Treated as no signal (Proposed).' : 'Nothing below the baseline. Every step scores 0.64; step 1 wins (v2.0).') + '</td></tr>' : '') +
      (to ? '<tr><td>Result</td><td class="num"><b>' + (d.evaluated ? 'step ' + d.decision_step : 'no change') + '</b></td><td>' + (d.evaluated ? 'the step already in use' : '5 or fewer blocks') + '</td></tr>'
        : '<tr><td>Decision</td><td class="num"><b>' + dec + '</b></td><td>' + why + '</td></tr>') +
      '</tbody></table></div><div class="note" style="margin-top:6px">' + (prop ? 'No signal if −5s/T < m < 5s/T, or m = 0.' : 'No signal if (b − 5s)/T < m < (b + 5s)/T, or m > 0.') + '</div>' + toNote + '</div>' +
      '<div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Step</th><th>Filter</th><th class="num">T</th><th class="num">Range <span class="unit">(mV)</span></th><th class="num">Predicted use <span class="unit">(%)</span></th><th>Eligible</th><th class="num">Score</th></tr></thead><tbody>' + (rowsH || '<tr><td colspan="7" class="muted">Not evaluated.</td></tr>') + '</tbody></table></div><div class="note" style="margin-top:6px">Eligible when (p + ' + (prop ? 'b' : 'b × T_k') + ') > −range and use < 0.90, with p = m × T_k. Ties go to the less sensitive step.</div></div></div>';
  }
  /* ---------- raw waveforms ---------- */
  function wfHtml() {
    const R = S.run; if (!R || !R.acq.n) return '<div class="note">Start a run to view any block and waveform.</div>';
    const A = R.acq; let i = wfSel.block == null ? A.n - 1 : Math.min(A.n - 1, wfSel.block); while (i > 0 && A.disc[i]) i--; wfSel.cur = i;
    const waves = TR.regenBlock(A, i), lad = TR.LADDERS[R.pmt], st = lad[A.step[i] - 1], T = TR.T_of(st.nd);
    const rows = waves.map((v, k) => { const a = TR.tfcV20(v, T), p = TR.tfcProposed(v, T, TR.WIN0, TR.WIN1); let mn = Infinity; for (const x of v) mn = Math.min(mn, x); return '<tr' + (k + 1 === wfSel.wf ? ' class="sel"' : '') + ' data-w="' + (k + 1) + '" class="clickable"><td>' + (k + 1) + '</td><td class="num">' + fmt.mv(TR.mean(v, 0, 100)) + '</td><td class="num">' + fmt.mv(TR.median(v, 0, 100)) + '</td><td class="num">' + fmt.mv(mn) + '</td><td class="num">' + fmt.sig3(a.display_fluorescence_V_ns) + '</td><td class="num">' + fmt.sig3(p.display_fluorescence_V_ns) + '</td><td class="num">' + fmt.sig3(p.window_30_70ns_display_fluorescence_V_ns) + '</td></tr>'; }).join('');
    return '<div class="toolbar" style="margin-bottom:8px"><label class="small">Block <input type="number" id="wfBlk" min="1" max="' + A.n + '" value="' + (i + 1) + '" style="width:90px"></label><button class="btn sm" id="wfLatest">Latest</button><span class="note">Step ' + A.step[i] + ' (OD ' + st.nd + ', ' + st.range * 1000 + ' mV), ' + fmt.ml(A.u[i]) + ' mL, ' + esc(R.ph.list[A.phase[i]].name) + '. 600 samples at 0.2 ns, 8-bit, channel B.</span></div>' +
      '<div style="height:300px;margin-bottom:10px" id="wfChart"></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Waveform</th><th class="num">Mean base <span class="unit">(mV)</span></th><th class="num">Median base <span class="unit">(mV)</span></th><th class="num">Minimum <span class="unit">(mV)</span></th><th class="num">v2.0 <span class="unit">(V·ns)</span></th><th class="num">Proposed, full window <span class="unit">(V·ns)</span></th><th class="num">Proposed, 30 to 70 ns <span class="unit">(V·ns)</span></th></tr></thead><tbody id="wfRows">' + rows + '</tbody></table></div>';
  }
  function mountWf() {
    const R = S.run, host = $('#wfChart'); if (!R || !host) return;
    const A = R.acq, i = wfSel.cur, waves = TR.regenBlock(A, i), v = waves[wfSel.wf - 1] || waves[9], d = { x: new Float64Array(600), y: new Float64Array(600), n: 600 };
    for (let j = 0; j < 600; j++) { d.x[j] = j * 0.2; d.y[j] = v[j] * 1000; }
    charts.wf = new CH.Chart(host, { ariaLabel: 'Raw waveform', topBand: 14, marginRight: 12, xDomain: () => [0, 119.8], xTitle: () => 'Time from window start (ns)', liveReadout: false, panels: [{ key: 'main', yl: { title: 'Signal', unit: 'mV', zero: false, minSpan: 0.5 } }], bands: () => [{ x0: 0, x1: 20, label: 'Baseline', fill: '#E8ECEF' }, { x0: 30, x1: 70, label: 'Proposed window', fill: 'rgba(166,75,42,0.06)' }], series: [{ key: 'w', label: 'Block ' + (i + 1) + ', waveform ' + wfSel.wf, color: C.v20, width: 1.25, panel: 'main', src: () => d, fmt: x => x.toFixed(2) + ' mV' }] });
  }
  /* ---------- ladder and IRF ---------- */
  function ladderHtml() {
    const s = S.setup, lad = TR.LADDERS[s.pmt], cur = S.run && S.run.acq.n ? S.run.acq.cur : null, st = TR.irfStats(TR.irfCurve(TR.IRF_TERMS[s.pmt])), lock = !!S.run, pc = M.presetCheck();
    return '<div class="eng-split"><div><h3 style="margin-bottom:6px">Sensitivity ladder, PMT ' + s.pmt + ' mV ' + tag('E') + '</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Step</th><th>ND filter</th><th class="num">T (measured)</th><th class="num">Wheel position</th><th class="num">Input range <span class="unit">(mV)</span></th></tr></thead><tbody>' +
      lad.map(x => '<tr' + (x.step === cur ? ' class="sel"' : '') + '><td>' + x.step + (x.step === cur ? ' <span class="muted small">(current)</span>' : '') + '</td><td>OD ' + x.nd + '</td><td class="num">' + TR.ND_T_SHOWN[String(x.nd)] + '</td><td class="num">' + TR.WHEEL_POS[String(x.nd)] + '</td><td class="num">' + x.range * 1000 + '</td></tr>').join('') + '</tbody></table></div>' +
      '<div class="form" style="margin-top:10px"><label class="l" for="irfF">IRF file in use</label><select id="irfF"' + (lock ? ' disabled' : '') + '><option value="400"' + (s.irfFile === 400 ? ' selected' : '') + '>impulse_400_mV.txt</option><option value="800"' + (s.irfFile === 800 ? ' selected' : '') + '>impulse_800_mV.txt</option></select><label class="l" for="ladF">Ladder file in use</label><select id="ladF"' + (lock ? ' disabled' : '') + '><option value="400"' + (s.ladderFile === 400 ? ' selected' : '') + '>od_filters_and_ranges_400_mV.txt</option><option value="800"' + (s.ladderFile === 800 ? ' selected' : '') + '>od_filters_and_ranges_800_mV.txt</option></select><div class="full ' + (pc.ok ? 'note' : 'callout fault') + '">' + esc(pc.msg) + '</div>' +
      '<label class="l" for="rngMap">Real input range</label><select id="rngMap"' + (lock ? ' disabled' : '') + '><option value="stated"' + (s.rangeMap !== 'shift' ? ' selected' : '') + '>As stated (v2.0 assumption)</option><option value="shift"' + (s.rangeMap === 'shift' ? ' selected' : '') + '>One setting larger (what-if)</option></select><div class="full note">Set before Start. With one setting larger, the simulated digitiser uses the next larger range, and v2.0 still scores against the stated range. ' + tag('H', 'always') + '</div></div></div>' +
      '<div><h3 style="margin-bottom:6px">Impulse response, PMT ' + s.pmt + ' mV ' + tag('E') + '</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Term</th><th class="num">A <span class="unit">(V, assumed)</span></th><th class="num">W <span class="unit">(ns, as σ, assumed)</span></th><th class="num">T <span class="unit">(ns from window start)</span></th></tr></thead><tbody>' +
      TR.IRF_TERMS[s.pmt].map((t, k) => '<tr><td>' + (k + 1) + '</td><td class="num">' + t[0].toPrecision(5) + '</td><td class="num">' + t[1].toPrecision(5) + '</td><td class="num">' + t[2].toPrecision(5) + '</td></tr>').join('') + '</tbody></table></div>' +
      '<div class="note" style="margin:6px 0">The terms sum to a negative pulse at ' + fmt.ns(st.peakNs) + ' ns (FWHM ' + st.fwhmNs.toFixed(2) + ' ns) with a positive ring at ' + fmt.ns(st.ringNs) + ' ns. The units of A are not recorded, so compare shape only. v2.0 does not use the IRF in its analysis.</div><div style="height:220px" id="irfChart"></div></div></div>';
  }
  function mountIrf() {
    const host = $('#irfChart'); if (!host) return; const h = TR.irfCurve(TR.IRF_TERMS[S.setup.pmt]), d = { x: new Float64Array(600), y: h, n: 600 }; for (let j = 0; j < 600; j++) d.x[j] = j * 0.2;
    charts.irf = new CH.Chart(host, { ariaLabel: 'IRF', topBand: 6, marginRight: 12, xDomain: () => [25, 70], xTitle: () => 'Time from window start (ns)', liveReadout: false, panels: [{ key: 'main', yl: { title: 'IRF', unit: 'V', zero: false } }], series: [{ key: 'irf', label: 'IRF (sum of 7 Gaussian terms)', color: C.irf, dash: 'dash', width: 1.25, panel: 'main', src: () => d, fmt: x => x.toPrecision(3) + ' V' }] });
  }
  /* ---------- laser log viewer ---------- */
  function laserHtml() {
    const log = S.laserLog, last = log.slice(-60).reverse();
    return '<div class="note" style="margin-bottom:6px">' + tag('P', 'always') + ' Laser controller log from the vendor software over RS-232, one line every 2.5 s. v2.0 does not read it. ' + esc(M.laserText()) + '</div>' +
      '<div class="tbl-wrap" style="max-height:480px"><table class="tbl"><thead><tr><th>Time</th><th class="num">t <span class="unit">(s)</span></th><th class="num">Diode temp <span class="unit">(°C)</span></th><th class="num">Crystal temp <span class="unit">(°C)</span></th><th class="num">Case temp <span class="unit">(°C)</span></th><th class="num">Diode current <span class="unit">(as logged)</span></th><th class="num">Photodetector <span class="unit">(mW, as logged)</span></th></tr></thead><tbody>' +
      last.map(e => '<tr><td>' + M.wall(e.k * 2.5).time + '</td><td class="num">' + (e.k * 2.5).toFixed(0) + '</td><td class="num">' + e.ld.toFixed(2) + '</td><td class="num">' + e.nlo.toFixed(2) + '</td><td class="num">' + e.caseT.toFixed(2) + '</td><td class="num">' + e.cur.toFixed(2) + '</td><td class="num">' + e.pd.toFixed(1) + '</td></tr>').join('') + '</tbody></table></div><div class="note" style="margin-top:6px">Latest 60 of ' + fmt.int(log.length) + ' lines.</div>';
  }
  /* ---------- Changes (Proposed) ---------- */
  function changesHtml() {
    const s = S.setup, p = S.proc, on = v => v ? UI.stateHtml('ok', 'On') : '<span class="muted">Off</span>';
    const rows = [
      ['Auto-ranging input', 'Latest single waveform', 'Median of the block\'s 10 waveforms, same scoring', on(s.autorange === 'prop'), 'Acquisition'],
      ['No-signal test', '(b − 5s)/T < m < (b + 5s)/T, or m > 0', '−5s/T < m < 5s/T, or m = 0 (nothing below the baseline)', on(s.autorange === 'prop'), 'Acquisition'],
      ['Baseline scaling in scoring', 'b × T_k (comment says it should not)', 'b not scaled, treated as electronic', on(s.autorange === 'prop'), 'Acquisition'],
      ['Baseline for fluorescence', 'Mean', 'Median, one definition everywhere', on(p.median), 'Processing'],
      ['Integration window', 'Whole 120 ns window', '30 to 70 ns (samples 150 to 350)', on(p.window), 'Processing'],
      ['Laser correction', 'None', 'Divide by beam monitor area relative to run start (simulated; PicoScope configuration is Future work)', on(p.laser), 'Processing'],
      ['Beam monitor capture', 'Start and end of each experiment', 'With every block on channel D', on(s.beamPerBlock), 'Acquisition'],
      ['Saving', 'After every block (loop_measurements.py line 28)', 'At most every 2 s, as configured, and only with new data', on(s.save2s), 'Acquisition'],
      ['Laser emission check', 'Skipped (laser_state = True, connections.py line 88)', 'At Readiness, 10 of 10 pulses ≥ ' + S.th.i4V + ' V within ' + TR.ACQ.timeoutS + ' s. A timeout fails.', on(s.laserCheck), 'Readiness'],
      ['Settings', 'Tab-delimited files, hard-coded paths and serial numbers', 'Versioned presets with ID and checksum, device discovery', UI.stateHtml('ok', 'On (' + M.presetInfo(s.pmt).id + ')'), 'Setup'],
      ['Data format', 'Pickle', 'CSV plus JSON metadata, written alongside', on(s.csvJson), 'Record'],
      ['Laser controller log', 'Not read', 'Read for warm-up and monitoring', UI.stateHtml('ok', 'On'), 'Readiness, Run']
    ];
    return '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Area</th><th>v2.0 reference</th><th>Proposed option</th><th>Current setting</th><th>Applies to</th></tr></thead><tbody>' + rows.map(r => '<tr><td>' + r[0] + '</td><td class="wrap">' + esc(r[1]) + '</td><td class="wrap">' + esc(r[2]) + '</td><td>' + r[3] + '</td><td>' + r[4] + '</td></tr>').join('') + '</tbody></table></div>';
  }
  /* ---------- rules and thresholds (discrepancy 1) ---------- */
  const TH_GROUPS = [
    ['Laser stability', ['laserFallPct', 'laserHoldPct', 'laserHoldMin', 'laserNoStepMin']],
    ['All rules', ['clearS']],
    ['Instrument rules', ['i2Count', 'i3Count', 'i4V', 'i5Tol', 'i6Pct']],
    ['Process rules', ['p2SlopePct', 'p2PlateauPct', 'p3Pct', 'p4Pct', 'p5Pct']],
    ['Precision and baselines', ['lowPrec', 'bufNoise', 'bufDrift', 'bufWander', 'darkRms', 'flPct']],
    ['Calibration', ['calDepPct', 'calExpiryDays']],
    ['Decay and P7', ['decayThrNs', 'decaySdMult', 'decayWinMl', 'decayUseMin', 'decayUseMax']],
    ['Fraction suggestions (Proposed)', ['poolPct', 'exclPct', 'breakPct']]
  ];
  // Rules in level order (I, P, H), then by number
  function ruleRows() {
    return M.RULES.slice().sort((a, b) => 'IPH'.indexOf(a.id[0]) - 'IPH'.indexOf(b.id[0]) || parseInt(a.id.slice(1), 10) - parseInt(b.id.slice(1), 10))
      .map(r => '<tr><td><b>' + esc(r.id) + '</b></td><td>' + esc(M.LEVELS[r.id[0]] || '') + '</td><td class="wrap">' + esc(r.cond(S.th)) + '</td><td class="wrap">' + esc(r.src + (r.note ? '. ' + r.note : '')) + '</td></tr>').join('');
  }
  function thHtml() {
    const keys = Object.keys(M.TH_INFO), used = new Set(), groups = [];
    for (const [g, ks] of TH_GROUPS) { const k = ks.filter(x => M.TH_INFO[x]); k.forEach(x => used.add(x)); if (k.length) groups.push([g, k]); }
    const rest = keys.filter(k => !used.has(k)); if (rest.length) groups.push(['Other', rest]);
    const row = k => { const [lab, unit] = M.TH_INFO[k]; return '<tr><td class="wrap">' + esc(lab) + '</td><td class="num"><input type="number" data-th="' + k + '" value="' + S.th[k] + '" step="any" style="width:110px;height:22px" aria-label="' + esc(lab) + '"></td><td>' + esc(unit) + '</td></tr>'; };
    return '<h3 style="margin-bottom:6px">Rules</h3><div class="tbl-wrap"><table class="tbl" id="ruleTbl"><thead><tr><th>ID</th><th>Level</th><th>Condition (current thresholds)</th><th>Source</th></tr></thead><tbody id="ruleRows">' + ruleRows() + '</tbody></table></div>' +
      '<div class="note" style="margin:6px 0 16px">Rule IDs are permanent. A new rule takes the next free number at its level, and no ID is reused or renumbered.</div>' +
      '<h3 style="margin-bottom:6px">Thresholds</h3><div class="note" style="margin-bottom:6px">Provisional defaults. Changing a value re-evaluates the evidence rules for the current run.</div>' +
      '<div class="tbl-wrap" style="max-width:720px"><table class="tbl"><thead><tr><th>Threshold</th><th class="num">Value</th><th>Unit</th></tr></thead><tbody>' +
      groups.map(([g, ks]) => '<tr class="grp"><td colspan="3">' + esc(g) + '</td></tr>' + ks.map(row).join('')).join('') + '</tbody></table></div>';
  }
  /* ---------- discrepancies to verify ---------- */
  // Item 3: the two reference transitions under the four combinations of baseline and window
  function levRatios() {
    return testRes.data.filter_transitions.map(t => {
      const v = t.waveforms.map(w => { const x = TR.countsToVolts(w.counts, w.range_V), a = TR.tfcV20(x, w.transmission), p = TR.tfcProposed(x, w.transmission, TR.WIN0, TR.WIN1); return [a.display_fluorescence_V_ns, p.display_fluorescence_V_ns, TR.tfcMeanWindow(x, w.transmission, TR.WIN0, TR.WIN1), p.window_30_70ns_display_fluorescence_V_ns]; });
      return { id: t.id, steps: t.waveforms.map(w => w.step), r: [0, 1, 2, 3].map(k => v[1][k] / v[0][k]) };
    });
  }
  // Item 3: error per block against the simulated signal, split by input range use; blocks with a waveform above 90 % left out.
  // The table shows the median absolute error: the few start-up blocks at OD 4 (T = 1e-4) would dominate an RMS.
  function levScatter(R) {
    const A = R.acq, g = A.o.gain || 1, lo = [[], [], [], []], hi = [[], [], [], []];
    for (let i = 0; i < R.derivedN; i++) {
      if (A.disc[i] || A.nOver[i] > 0) continue;
      const t = A.S[i] * A.E[i] * g; if (!(t > 0)) continue;
      const G = A.ruse[i] < S.th.lowPrec ? lo : hi; for (let k = 0; k < 4; k++) G[k].push(A.F[k][i] / t - 1);
    }
    const rms = a => a.length ? Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length) : NaN;
    const med = a => { if (!a.length) return NaN; const b = Float64Array.from(a, Math.abs).sort(), h = b.length >> 1; return b.length % 2 ? b[h] : (b[h - 1] + b[h]) / 2; };
    return { lo: lo.map(med), hi: hi.map(med), rmsLo: lo.map(rms), rmsHi: hi.map(rms), nLo: lo[0].length, nHi: hi[0].length };
  }
  // Item 4: 120 buffer blocks from step 1 on the 800 mV preset at the assumed noise, under four auto-ranging variants
  function flatCheck() {
    if (flatCheck.c) return flatCheck.c;
    const med = { arMedian: true, arSymmetric: true, arUnscaled: true };
    flatCheck.c = [['v2.0', {}], ['v2.0, ranges one setting larger (item 2)', { rangeMap: 'shift' }], ['Block median, no guard', med], ['Proposed', { ...med, arFlatGuard: true }]].map(([label, o]) => {
      let at1 = 0, back = 0, end1 = 0, n = 0; const runs = 10;
      for (let k = 0; k < runs; k++) {
        const A = TR.createAcq({ seed: TR.SEED, stream: 60 + k, pmt: 800, ...M.pmtSim(800), cap: 120, ...o, signalAt: () => ({ S: 0.0080, tau: 3.5, E: 1, u: 0, vp: 0, phase: 0 }) });
        TR.acqStep(A, 1e6); n = A.n;
        for (let i = 0; i < A.n; i++) if (A.step[i] === 1) at1++;
        if (A.changes.some(c => c.to === 1 && c.from > 1)) back++;
        if (A.step[A.n - 1] === 1) end1++;
      }
      return { label, at1: Math.round(at1 / runs), back, end1, runs, n };
    });
    return flatCheck.c;
  }
  function firstTimeout(R) { const A = R.acq; for (let i = 0; i < A.n; i++) if (A.disc[i]) return i; return -1; }
  function timeouts(R) { const A = R.acq, out = []; for (let i = 0; i < A.n; i++) if (A.disc[i]) out.push(i); return out; }
  function listBlocks(ix) { const s = ix.slice(0, 5).map(i => fmt.int(i + 1)); const t = s.length > 1 ? s.slice(0, -1).join(', ') + ' and ' + s[s.length - 1] : s[0]; return t + (ix.length > 5 ? ' and ' + (ix.length - 5) + ' more' : ''); }
  // One state chip per row; the To verify on hardware tag sits on each item's instrument check
  const onOff = v => v === 2 || v === true ? UI.stateHtml('ok', 'Proposed: on') : v === 1 ? UI.stateHtml('warn', 'Proposed: partly on') : UI.stateHtml('na', 'Proposed: off');
  const H = () => tag('H', 'always'), src = (t, plain) => '<div class="disc-src' + (plain ? ' plain' : '') + '">' + t + '</div>', p = t => '<p>' + t + '</p>';
  const ol = items => '<ol>' + items.map(t => '<li>' + t + '</li>').join('') + '</ol>';
  const noRun = t => '<p class="muted">' + t + '</p>';
  // Discrepancies: one entry per item feeds both the summary row and the detail panel
  const DISC = [
    {
      n: 1, title: 'Rule ID clash', v20: 'Not in v2.0. The Stage 2 prompt gives I6 to a second rule.', src: 'Stage 2 prompt, section 1; Stage 1, section 11', plain: true,
      effect: () => 'One ID for two rules would make cards, responses and exports ambiguous.', res: 'Calibration not applicable is I7. No ID is reused.',
      status: () => UI.stateHtml('ok', 'Resolved'), e: false, p: false, h: false,
      detail: () => ({
        v20: p('Not in v2.0, which has no rule IDs. The Stage 2 prompt (section 1) gives I6 to Calibration not applicable. Stage 1 (section 11) already uses I6 for Laser output changed.'),
        effect: p('Rule IDs are stored in card IDs (for example I6-load-1), responses, the audit trail and the JSON and CSV exports. One ID for two rules would make those records ambiguous.'),
        res: p('Calibration not applicable is I7; P6, P7 and H3 are unchanged. The Stage 2 prompt is to be corrected.') + '<button class="btn sm" id="discGoTh">Open Rules</button>',
        check: p('None needed.')
      })
    },
    {
      n: 2, title: 'Digitiser range mapping', v20: 'Index 1 sent for 10 mV. One index sets the range and converts to volts.', src: 'scope_class.py 145, 277, 391',
      effect: () => 'Either each range is one setting larger, with the 80 % target at 32 to 40 % of the real range, or volts read 2 to 2.5 times high.', res: 'Select ranges by driver name. What-if in Ladder and IRF.',
      status: () => UI.stateHtml('warn', 'To verify on hardware'), e: true, p: true, h: true,
      detail: R => {
        const pmt = R ? R.pmt : S.setup.pmt, lad = TR.LADDERS[pmt], rs = [...new Set(lad.map(x => x.range))].sort((a, b) => b - a), mv = v => (v * 1000).toPrecision(2);
        let live = '';
        if (R && R.derivedN) {
          const A = R.acq, n = R.derivedN; let low = 0, est = 0;
          for (let i = 0; i < n; i++) { low += R.low[i]; if (A.disc[i]) continue; const r = lad[A.step[i] - 1].range; if (A.ruse[i] * r / TR.realRange(r, 'shift') < S.th.lowPrec) est++; }
          const pc = x => (x / n * 100).toFixed(1), lp = Math.round(S.th.lowPrec * 100);
          live = R.setupSnap.rangeMap === 'shift' ? p('This run used ranges one setting larger (what-if), and ' + pc(low) + ' % of its blocks are under ' + lp + ' % of range.')
            : p('This run: ' + pc(low) + ' % of blocks are under ' + lp + ' % of range. With ranges one setting larger it would be about ' + pc(est) + ' %.');
        }
        return {
          v20: p('v2.0 sends range index 1 for 10 mV, 2 for 20 mV and so on (scope_class.py, lines 391 to 414). The same index sets the scope range (line 147) and converts counts to volts with the PicoSDK adc2mV function (line 277). In that function\'s table, index 1 is 20 mV.'),
          effect: '<table class="tbl" id="rngTbl"><thead><tr><th class="num">Stated range <span class="unit">(mV)</span></th><th class="num">If one setting larger <span class="unit">(mV)</span></th><th class="num">80 % target becomes</th><th class="num">One count <span class="unit">(mV)</span></th></tr></thead><tbody>' +
            rs.map(r => { const q = TR.realRange(r, 'shift'); return '<tr><td class="num">' + r * 1000 + '</td><td class="num">' + q * 1000 + '</td><td class="num">' + Math.round(80 * r / q) + ' %</td><td class="num">' + mv(r / 127) + ' to ' + mv(q / 127) + '</td></tr>'; }).join('') + '</tbody></table>' + live +
            p('If the driver counts from 10 mV = 0, volts are right but each pulse uses less of the real range. If it counts from 10 mV = 1, ranges are as stated but volts read 2 to 2.5 times high. Public PicoSDK sources, not supplied here, put 10 mV at 0, which points to the first case.'),
          res: p('Select each range by its driver name, for example PICO_10MV, and convert counts with a table keyed by the same name. Store the name with every waveform. To see the effect here, set Real input range before Start.') + '<button class="btn sm" id="discGoLadder">Open Ladder and IRF</button>',
          check: ol(['On the instrument PC, read the 10 mV entry of the installed picosdk range enum and the first entry of channelInputRanges in picosdk/functions.py. If both put 10 mV at 0, every v2.0 range is one setting larger and volts are right.',
            'In existing v2.0 records, opened in a trusted environment, compare fluorescence either side of each change between 50, 20 and 10 mV at one filter. A 25 % step at changes to or from 20 mV means volts are wrong.',
            'To confirm, keep the laser running so the scope triggers, feed channel B a −15 mV DC level checked with a multimeter, and record one block at the 10 mV setting. A reading of −15 mV means the real range is 20 mV. A flat −20 mV means the range is as stated and volts are 2 times high.'])
        };
      }
    },
    {
      n: 3, title: 'Baseline leverage', v20: 'Mean of the first 20 ns subtracted over 119.8 ns.', src: 'signal_class.py 52 to 61',
      effect: () => { const t = levRatios().find(x => x.id === 'low_signal') || levRatios()[0]; return 'In the ' + t.id + ' reference the same signal reads ' + Math.round((1 - t.r[0]) * 100) + ' % low after a filter step (ratio ' + t.r[0].toFixed(3) + ').'; },
      res: 'Median baseline and 30 to 70 ns window, under Processing.',
      status: () => onOff((S.proc.median ? 1 : 0) + (S.proc.window ? 1 : 0)), e: true, p: true, h: true,
      detail: R => {
        const lr = levRatios().sort((a, b) => (a.id === 'low_signal' ? 0 : 1) - (b.id === 'low_signal' ? 0 : 1)), lp = Math.round(S.th.lowPrec * 100), sc = R && R.derivedN ? levScatter(R) : null;
        const runRow = (lab, arr) => '<tr><td class="wrap">' + lab + '</td>' + (sc ? arr.map(x => '<td class="num">' + (isFinite(x) ? (x * 100).toFixed(1) : '–') + '</td>').join('') : '<td colspan="4" class="muted">Start a run to fill this row.</td>') + '</tr>';
        return {
          v20: p('The baseline is the mean of the first 100 samples, 0 to 20 ns (signal_class.py, line 52). It is subtracted across all 600 samples, 119.8 ns (lines 55 to 61), so an error of 0.1 count in the baseline moves the area by 12 counts·ns.'),
          effect: '<div class="tbl-wrap"><table class="tbl" id="levTbl"><thead><tr><th></th><th class="num">v2.0</th><th class="num">Median baseline</th><th class="num">30 to 70 ns window</th><th class="num">Both (Proposed)</th></tr></thead><tbody>' +
            lr.map(t => '<tr><td class="wrap">' + esc(t.id) + ', step ' + t.steps[1] + ' against step ' + t.steps[0] + '</td>' + t.r.map(x => '<td class="num">' + x.toFixed(3) + '</td>').join('') + '</tr>').join('') +
            runRow('This run, ' + (sc ? fmt.int(sc.nLo) + ' ' : '') + 'blocks under ' + lp + ' % of range: median error (%)', sc && sc.lo) + runRow('This run, ' + (sc ? fmt.int(sc.nHi) + ' ' : '') + 'other blocks: median error (%)', sc && sc.hi) + '</tbody></table></div>' +
            p('Ratios should be 1. Each reference step is one synthetic waveform with 1 count RMS noise, so a few per cent either way is noise. At step 4 the first 100 samples average −0.24 counts, which over 119.8 ns removes 29 of the pulse\'s 102 counts·ns.') +
            p('Run rows: median absolute error per block against the simulated signal, leaving out blocks with a waveform above 90 %.'),
          res: p('The median baseline and the 30 to 70 ns window are under Processing on Run and Fraction review, off by default. Compare overlays v2.0 and Proposed with a difference trace.'),
          check: ol(['Block the beam to the flow cell but keep the beam monitor lit, so the scope still triggers. Record 100 blocks at each input range. The mean over 0 to 20 ns, 30 to 70 ns and 80 to 120 ns should agree within 0.1 count. If the baseline sits a fraction of a count off zero with noise under one count, the median snaps to a whole count and only the window helps.',
            'Record a steady standard at two adjacent steps, 100 blocks each, holding each step with a one-line ladder file. Discard the first 6 blocks, because v2.0 leaves the wheel at OD 4 until its first decision. The Proposed ratio should be within 2 % (provisional).'])
        };
      }
    },
    {
      n: 4, title: 'Flat waveform in auto-ranging', v20: 'Nothing below the baseline and s = 0. Every step ties and step 1 wins.', src: 'signal_attenuation.py 74, 155, 164',
      effect: () => 'Drops to step 1 from any step. Seen on the 800 mV preset with a block median input.', res: 'Proposed auto-ranging counts m = 0 as no signal.',
      status: R => onOff((R ? R.setupSnap.autorange : S.setup.autorange) === 'prop'), e: true, p: true, h: true,
      detail: () => {
        const fc = flatCheck(), n = fc[0].n;
        return {
          v20: p('If the first 100 samples of the latest waveform sit on one count (s = 0) and nothing lies below them (m = 0), the no-signal band (b − 5s)/T to (b + 5s)/T is empty, because its bounds are strict (signal_attenuation.py, lines 74 to 79). The test m > 0 (line 155) can never pass. Every allowed step then scores 0.64 and step 1 wins (line 164), from whatever step v2.0 is on.'),
          effect: p('A waveform with no visible pulse is flat in 74 % of cases at 0.15 counts RMS noise, 1 % at 0.2 counts and almost never from 0.25 counts. Assumed noise at 500 mV on the 800 mV preset is 0.30 counts, or 0.15 counts if ranges are one setting larger (item 2). A median of 10 waveforms has far less noise, so a block median input is flat in about 95 % of such blocks.') +
            '<div class="tbl-wrap"><table class="tbl" id="flatTbl"><caption class="note">Simulated buffer, PMT 800 mV preset, assumed noise: ' + fc[0].runs + ' runs of ' + n + ' blocks from step 1.</caption><thead><tr><th>Auto-ranging</th><th class="num">Blocks at step 1 (mean)</th><th class="num">Runs that return to step 1</th><th class="num">Runs ending at step 1</th></tr></thead><tbody>' +
            fc.map(r => '<tr><td>' + esc(r.label) + '</td><td class="num">' + r.at1 + '</td><td class="num">' + r.back + ' of ' + r.runs + '</td><td class="num">' + r.end1 + ' of ' + r.runs + '</td></tr>').join('') + '</tbody></table></div>',
          res: p('Proposed auto-ranging also counts a waveform with nothing below its baseline (m = 0) as no signal and moves two steps more sensitive. Every reference case has m below 0, so no reference value changes.'),
          check: ol(['In existing v2.0 records, opened in a trusted environment, count waveforms whose first 100 samples sit on one count with nothing below, and look for drops to step 1 that clipping does not explain.',
            'On each preset, at step 1, block the beam to the flow cell and keep the beam monitor lit. Record 100 blocks and report the noise in counts. Under 0.25 counts RMS means v2.0 is exposed. Repeat once item 2 is settled.'])
        };
      }
    },
    {
      n: 5, title: 'Saving interval', v20: 'v2.0 behaviour: saves after every block; configured interval 2 s not applied.', src: 'loop_measurements.py 28; acquisition.txt 8',
      effect: R => {
        if (!R) return 'Start a run to count saves.';
        const sv = R.save, v = sv.v20, q = sv.p2s;
        return sv.mode === 'p2s' ? 'This run: ' + fmt.int(q.n) + ' saves at 2 s, ' + fmt.size(q.mb) + ' written. v2.0 would make ' + fmt.int(v.n) + '.'
          : 'This run: ' + fmt.int(v.n) + ' saves, ' + fmt.size(v.mb) + ' written. The 2 s interval would make ' + fmt.int(q.n) + '.';
      },
      res: 'Save at most every 2 s, and only with new data.',
      status: R => onOff(R ? R.save.mode === 'p2s' : S.setup.save2s), e: true, p: true, h: true,
      detail: R => {
        let eff = noRun('Start a run to count saves.');
        if (R) {
          const sv = R.save, v = sv.v20, q = sv.p2s, rec = fmt.size(sv.nData * M.SAVE_KB / 1000);
          eff = (sv.mode === 'p2s'
            ? p('This run: ' + fmt.int(q.n) + ' saves at the 2 s interval; v2.0 would make ' + fmt.int(v.n) + '. At an estimated ' + M.SAVE_KB + ' kB per block the record is ' + rec + ', and ' + fmt.size(q.mb) + ' is written over the run (' + fmt.size(v.mb) + ' in v2.0), because each save rewrites the whole record.')
            : p('This run: ' + fmt.int(v.n) + ' saves; the 2 s interval would make ' + fmt.int(q.n) + '. At an estimated ' + M.SAVE_KB + ' kB per block the record is ' + rec + ', and ' + fmt.size(v.mb) + ' is written over the run (' + fmt.size(q.mb) + ' at 2 s), because each save rewrites the whole record.')) +
            p('A crash during a save can leave an unreadable file. Save time is not simulated, so the block rate does not slow.');
        }
        return {
          v20: p('Saves after every block; the configured 2 s interval is not applied. The save test ORs the interval with the loop\'s own running condition, so the whole record is pickled again after every block, timed-out blocks included.') + src('loop_measurements.py, line 28; pickle_functions.py, lines 5 to 8; acquisition.txt, line 8'),
          effect: eff,
          res: p('Save at most every 2 s, and only when new waveforms have arrived. Appending only new blocks to the file would stop the growth (not simulated).') + '<button class="btn sm" id="discGoSetup">Open Setup</button>',
          check: p('Log the time and file size of each save over a 95 min experiment, and compare the block interval at the start and the end.')
        };
      }
    },
    {
      n: 6, title: 'Timed-out blocks', v20: 'No waveforms. Auto-ranging re-runs on the previous waveform, and nothing is logged.', src: 'loop_measurements.py 22 to 37',
      effect: R => { const k = R ? timeouts(R).length : -1; return 'None on data or range; about 3 s lost each.' + (k < 0 ? '' : ' This run: ' + k + (k === 1 ? ' timeout.' : ' timeouts.')); }, res: 'Auto-ranging needs no change. Proposed: log each timeout in the Run log.',
      status: () => UI.stateHtml('ok', 'Resolved'), e: true, p: true, h: true,
      detail: R => {
        let eff = p('The inputs are those of the previous decision, so it returns the step already in use and the range does not change. Each timeout costs about 3 s and leaves no record.');
        if (!R) eff += noRun('Start a run to count timeouts.');
        else { const ix = timeouts(R); eff += p(ix.length ? 'This run: ' + ix.length + (ix.length === 1 ? ' timeout, block ' : ' timeouts, blocks ') + listBlocks(ix) + '.' : 'This run: no timeouts.'); if (ix.length) eff += '<button class="btn sm" id="discGoAr">Open block ' + fmt.int(ix[0] + 1) + ' in Auto-range</button>'; }
        return {
          v20: p('After 3 s without a complete block the scope returns no waveforms (scope_class.py, lines 230 to 235 and 331 to 333). The loop still saves and runs auto-ranging (loop_measurements.py, lines 28 to 37). Auto-ranging reads the last stored waveform, from the previous block, with that waveform\'s step (signal_modelling.py, line 81; signal_attenuation.py, lines 56 to 62).'),
          effect: eff,
          res: p('Auto-ranging needs no change. Proposed: each timeout is logged in the Run log; v2.0 logs nothing. The block CSV already flags it as discarded, and rule I3 fires above ' + S.th.i3Count + ' in a minute.'),
          check: p('Early in a buffer run, unplug the channel D cable for 15 s. Expect 4 or 5 timeouts and no range change. Later in a run fewer fit, because v2.0 re-saves the whole record after every block (item 5).')
        };
      }
    },
    {
      n: 7, title: 'Laser emission check', v20: 'Check skipped and laser_state set to True. If re-enabled, a timed-out block still passes.', src: 'connections.py 68 to 73, 87 to 88',
      effect: () => 'With no light on channel D, v2.0 starts, records no fluorescence and shows no message.', res: 'At Readiness, all 10 pulses within 3 s, each ≥ ' + S.th.i4V + ' V.',
      status: () => onOff(S.setup.laserCheck), e: true, p: true, h: true,
      detail: () => ({
        v20: p('The check is commented out and laser_state is set to True, so v2.0 reports ready without a laser. If re-enabled, it still passes when the block times out and returns no waveforms.') + src('connections.py, lines 68 to 73 and 87 to 88; scope_class.py, lines 230 to 235'),
        effect: p('With no light on channel D, which is also the trigger, every block times out after 3 s. A 95 min experiment would then make about 1,800 attempts, record no fluorescence and show no message (estimate). If noise triggers the scope instead, noise is stored as data.'),
        res: p('At Readiness, all 10 pulses must arrive within 3 s and reach ' + S.th.i4V + ' V. A timeout fails and Start stays disabled.') + '<button class="btn sm" id="discGoReady">Open Readiness</button>',
        check: p('Laser off, and laser on with the beam blocked before the beam monitor, must both fail. Record whether blocks time out or the scope triggers on noise. In the same session, check the trigger level (note below).')
      })
    }
  ];
  function discHtml() {
    const R = S.run, it = DISC.find(x => x.n === discSel) || DISC[0], d = it.detail(R);
    const blk = (h, t, body) => '<div class="disc-b"><h4>' + h + (t ? ' ' + t : '') + '</h4>' + body + '</div>';
    return '<div class="note" style="margin-bottom:8px">Found by comparing the v2.0 source, trifle_reference_tests.json and the specification. v2.0 behaviour stays the default, and Proposed options are off until chosen.</div>' +
      '<div class="tbl-wrap"><table class="tbl" id="discTbl"><thead><tr><th class="num">#</th><th>Item</th><th>v2.0 behaviour and source</th><th>Effect</th><th>Resolution</th><th>Status</th></tr></thead><tbody>' +
      DISC.map(x => '<tr' + (x.n === it.n ? ' class="sel"' : '') + '><td class="num dn">' + x.n + '</td><td class="wrap" data-h="Item ' + x.n + '"><button class="link" data-n="' + x.n + '"' + (x.n === it.n ? ' aria-current="true"' : '') + '>' + esc(x.title) + '</button></td><td class="wrap" data-h="v2.0 behaviour and source">' + esc(x.v20) + src(esc(x.src), x.plain) + '</td><td class="wrap" data-h="Effect">' + esc(x.effect(R)) + '</td><td class="wrap" data-h="Resolution">' + esc(x.res) + '</td><td data-h="Status">' + x.status(R) + '</td></tr>').join('') + '</tbody></table></div>' +
      '<div id="discDetail" class="panel" style="margin-top:12px"><div class="ph"><h3>' + it.n + '. ' + esc(it.title) + '</h3></div><div class="pb"><div class="disc-d">' +
      blk('v2.0 behaviour', it.e ? tag('E', 'always') : '', d.v20) + blk('Effect', '', d.effect) + blk('Resolution', it.p ? tag('P', 'always') : '', d.res) + blk('Check on the instrument', it.h ? H() : '', d.check) + '</div></div></div>' +
      '<div class="note disc-foot"><b>Trigger threshold.</b> v2.0 sends 150 with the comment "Threshold is in mV" (scope_class.py, lines 108 to 109). The ps6000a programmer\'s guide reads the value as ADC counts, about 2.3 mV on ±500 mV, not 0.15 V. ' + H() + '</div>' +
      '<div class="note disc-foot">A quadratic fit of recent pulse minima was abandoned during v2.0 development because it failed when the signal changed by orders of magnitude. It is not reintroduced.</div>';
  }
  /* ---------- faults and reproducibility ---------- */
  function faultsHtml() {
    const R = S.run;
    return '<div class="grid2"><div class="panel"><div class="ph"><h3>Simulate a fault (demo)</h3></div><div class="pb stack" style="gap:6px">' +
      [['none', 'None'], ['digitiser', 'Digitiser not found'], ['wheel', 'Filter wheel not responding'], ['laser', 'Laser not detected']].map(([k, l]) => '<label class="chk"><input type="radio" name="fault" value="' + k + '"' + (S.fault === k ? ' checked' : '') + '> ' + l + '</label>').join('') +
      '<div class="note">The fault shows in the header, Readiness and Run, and Start stays blocked. With Laser not detected, v2.0 skips the emission check and reports ready. With the Proposed check on, Readiness fails.</div></div></div>' +
      '<div class="panel"><div class="ph"><h3>Reproducibility</h3></div><div class="pb">' + (R ? '<div>Run data checksum after ' + fmt.int(R.acq.n) + ' blocks: <b>' + TR.fnv([R.acq.F[0], R.acq.F[3]], R.acq.n) + '</b></div><button class="btn sm" id="repro" style="margin-top:6px">Re-simulate and compare</button><div id="reproOut" class="small" style="margin-top:6px">' + (repro || '') + '</div><div class="note" style="margin-top:6px">Seed ' + TR.SEED + ' (mulberry32).</div>' : '<div class="note">Start a run to compute its data checksum.</div>') + '</div></div></div>';
  }
  function reproCheck() {
    const R = S.run, n = R.acq.n, o = { ...R.acq.o, cap: n + 10 };
    const B = TR.createAcq(o); TR.acqStep(B, R.acq.t[n - 1] + 0.6);
    const a = TR.fnv([R.acq.F[0], R.acq.F[3]], n), b = TR.fnv([B.F[0], B.F[3]], Math.min(n, B.n));
    repro = 'Re-simulated ' + fmt.int(B.n) + ' blocks: checksum ' + b + '. ' + (a === b && B.n === n ? UI.stateHtml('ok', 'Identical') : UI.stateHtml('fault', 'Different'));
    M.audit('engineer', 'Reproducibility check: ' + (a === b ? 'identical' : 'different') + ' (' + a + ').');
  }
  /* ---------- frame ---------- */
  function build() {
    const r = $('#scr-engineer');
    r.innerHTML = '<div class="scr-h"><h1>Diagnostics</h1><span class="sp"></span><span class="note" id="engTestSum"></span></div><div class="subtabs" id="engTabs">' + TABS.map(([k, l]) => '<button data-v="' + k + '">' + l + '</button>').join('') + '</div><div id="engBody"></div>';
    $$('#engTabs button').forEach(b => b.onclick = () => { tab = b.dataset.v; render(); });
    built = true;
  }
  function render() {
    if (!built) build();
    for (const k in charts) { try { charts[k].destroy(); } catch (e) { } } charts = {};
    $$('#engTabs button').forEach(b => b.classList.toggle('on', b.dataset.v === tab));
    const body = $('#engBody');
    const f = { tests: testsHtml, align: alignHtml, ar: arHtml, wf: wfHtml, ladder: ladderHtml, laser: laserHtml, changes: changesHtml, th: thHtml, disc: discHtml, faults: faultsHtml }[tab] || (() => (window.ENG_EXTRA && window.ENG_EXTRA[tab] ? window.ENG_EXTRA[tab].html() : ''));
    body.innerHTML = f();
    if (tab === 'tests') { $('#tCorrupt').onchange = e => { corrupt = e.target.checked; testRes = runTests(); M.audit('engineer', 'Reference test failure demo ' + (corrupt ? 'on' : 'off') + '.'); render(); }; }
    if (tab === 'align') { mountAlign();
      const setVol = (k, id, label) => { const inp = $(id); if (!inp) return; inp.onchange = () => { const v = parseFloat(inp.value); if (!(v >= 0) || S.run) { render(); return; } const old = S.setup[k]; if (old === v) return; S.setup[k] = v; M.audit('setting', label + ' changed from ' + fmt.ml(old) + ' to ' + fmt.ml(v) + ' mL.'); UI.emitDirty(); render(); }; };
      setVol('V1', '#eV1', 'V1 (UV to TRIFLE)'); setVol('V2', '#eV2', 'V2 (TRIFLE to collector)'); setVol('fracDelay', '#eFd', 'UNICORN fraction delay'); $$('#alBA button').forEach(b => b.onclick = () => { alignBefore = b.dataset.v === '1'; guides = null; render(); }); $('#alRec').onclick = () => { S.alignChecked = M.wall(S.simT).date; M.audit('engineer', 'Alignment check recorded; guides imply ' + fmt.ml(guides ? guides.g2 - guides.g1 : NaN) + ' mL against V1 ' + fmt.ml(S.setup.V1) + ' mL.'); render(); }; }
    if (tab === 'ar' && S.run) { const b = $('#arBlk'); if (b) b.onchange = e => { arBlock = (+e.target.value || 1) - 1; render(); }; const l = $('#arLatest'); if (l) l.onclick = () => { arBlock = null; render(); }; const c = $('#arCh'); if (c) c.onchange = e => { if (e.target.value !== '') { arBlock = +e.target.value; render(); } }; }
    if (tab === 'wf' && S.run) { mountWf(); $('#wfBlk').onchange = e => { wfSel.block = (+e.target.value || 1) - 1; render(); }; $('#wfLatest').onclick = () => { wfSel.block = null; render(); }; $$('#wfRows tr').forEach(tr => tr.onclick = () => { wfSel.wf = +tr.dataset.w; wfSel.block = wfSel.cur; render(); }); }
    if (tab === 'ladder') {
      mountIrf(); const i = $('#irfF'), l = $('#ladF'), rm = $('#rngMap');
      if (i) i.onchange = () => { S.setup.irfFile = +i.value; M.audit('engineer', 'IRF file set to impulse_' + i.value + '_mV.txt.'); render(); };
      if (l) l.onchange = () => { S.setup.ladderFile = +l.value; M.audit('engineer', 'Ladder file set to od_filters_and_ranges_' + l.value + '_mV.txt.'); render(); };
      if (rm) rm.onchange = () => { if (S.run) return; S.setup.rangeMap = rm.value === 'shift' ? 'shift' : 'stated'; M.audit('engineer', S.setup.rangeMap === 'shift' ? 'Real input range set to one setting larger (what-if).' : 'Real input range set back to as stated.'); UI.renderChips(); UI.emitDirty(); render(); };
    }
    if (tab === 'th') $$('[data-th]').forEach(inp => inp.onchange = () => { const k = inp.dataset.th, v = parseFloat(inp.value); if (!isFinite(v)) { inp.value = S.th[k]; return; } const old = S.th[k]; S.th[k] = v; M.audit('threshold', M.TH_INFO[k][0] + ' ' + v + ' ' + M.TH_INFO[k][1] + ' (was ' + old + ').'); if (S.run) { M.rederive(S.run); } S.laser = null; M.laserUpdate(); UI.emitDirty(); const rr = $('#ruleRows'); if (rr) rr.innerHTML = ruleRows(); });
    if (tab === 'disc') {
      $$('#discTbl [data-n]').forEach(b => b.onclick = () => { discSel = +b.dataset.n; render(); const d = $('#discDetail'); if (d && d.getBoundingClientRect().top > innerHeight - 160) d.scrollIntoView({ block: 'start' }); });
      const go = (id, f) => { const b = $(id); if (b) b.onclick = f; };
      go('#discGoTh', () => { tab = 'th'; render(); });
      go('#discGoLadder', () => { tab = 'ladder'; render(); });
      go('#discGoAr', () => { const i = S.run ? firstTimeout(S.run) : -1; if (i < 0) return; tab = 'ar'; arBlock = i; render(); });
      go('#discGoSetup', () => UI.go('setup'));
      go('#discGoReady', () => UI.go('readiness'));
      discAt = performance.now();
    }
    if (tab === 'faults') { $$('input[name=fault]').forEach(rb => rb.onchange = () => { S.fault = rb.value; M.audit('engineer', 'Fault simulation: ' + rb.parentElement.textContent.trim() + '.'); S.laser = null; S.laserLog.length = 0; S.laserGen = (S.laserGen || 0) + 1; M.laserUpdate(); if (S.readiness && !S.run) M.readinessStart(); UI.emitDirty(); }); const rp = $('#repro'); if (rp) rp.onclick = () => { reproCheck(); render(); }; }
    if (window.ENG_EXTRA && window.ENG_EXTRA[tab] && window.ENG_EXTRA[tab].mount) window.ENG_EXTRA[tab].mount();
    sum();
  }
  function sum() { const ok = testRes.pass === testRes.total; $('#engTestSum').innerHTML = ok ? UI.stateHtml('ok', 'Reference tests ' + testRes.pass + ' of ' + testRes.total + ' pass') : UI.stateHtml('fault', 'Reference tests: ' + (testRes.total - testRes.pass) + ' fail'); }
  // Insert a tab after afterKey when given (Stage 2 tabs sit beside the related Stage 1 tabs), otherwise at the end
  function addTab(k, label, afterKey) {
    const old = TABS.findIndex(t => t[0] === k); if (old >= 0) TABS.splice(old, 1);
    const at = afterKey ? TABS.findIndex(t => t[0] === afterKey) : -1;
    if (at >= 0) TABS.splice(at + 1, 0, [k, label]); else TABS.push([k, label]);
    built = false;
  }
  testRes = runTests();
  UI.register('engineer', {
    show() { render(); },
    update() {
      if (tab === 'laser' && S.laserLog.length % 24 === 0 && S.laserLog.length !== render._n) { render._n = S.laserLog.length; render(); }
      // live counts on the Discrepancies tab while acquiring, at most every 5 s
      else if (tab === 'disc' && S.run && S.run.state === 'acquiring' && performance.now() - discAt > 5000) render();
    }
  });
  return { runTests, results: () => testRes, addTab, levRatios, levScatter, flatCheck, DISC };
})();
