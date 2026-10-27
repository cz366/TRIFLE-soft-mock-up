/* =====================================================================
   Stage 2 UI: Calibration, Run comparison, Integrations, decay display,
   AAV template, export packaging, Engineer additions.
   ===================================================================== */
(function () {
  const { $, $$, esc, el, tag } = UI, S = M.S, fmt = M.fmt, C = CH.C;
  const DEV = '<span class="tag" data-scope="always" title="Not validated">Development assumption</span>';

  /* ---------- Run and Fraction review additions ---------- */
  UI.procExtras.push({ key: 'decay', label: 'Decay-shape analysis (research display)', html: () => '<div' + (S.proc.decay ? '' : ' class="eng-only"') + '><hr style="border:0;border-top:1px solid var(--border);margin:6px 0"><label class="chk"><input type="checkbox" data-k="decay"> Decay-shape analysis ' + tag('P', S.proc.decay ? 'always' : 'engineer') + '</label><div class="small muted" style="margin-left:22px">Research display, not validated. Adds the decay strip and rule P7.</div></div>', onChange: () => { if (S.run) { S.run.dataGen++; S.run.rules.replay(); } } });
  RC.extraPanels.push(() => [{ key: 'decay', px: 46, hidden: () => !S.proc.decay, yl: { title: 'Decay metric', short: 'Decay', unit: 'ns', zero: false, minSpan: 0.4 } }]);
  RC.extraSeries.push(() => { const ref = S2.decayRef(S.run), info = S2.irfInfo(S.run ? S.run.pmt : S.setup.pmt); return [{ key: 'decay', label: 'Decay metric', color: C.decay, width: 1, panel: 'decay', src: ref ? RC.trifle('decay') : () => null, fmt: v => v.toFixed(2) + ' ns', visible: !!S.proc.decay, legend: !!S.proc.decay, tag: 'Proposed', tagScope: 'always', tip: (ref ? 'Elution front ' + ref.mean.toFixed(2) + ' ± ' + ref.sd.toFixed(2) + ' ns SD' : 'SD pending') + '; IRF ' + info.fwhmNs.toFixed(1) + ' ns FWHM; sampling 0.2 ns. Intensity-weighted mean delay after the IRF peak, 0 to 20 ns, on the block median waveform. Computed only where input range use is between ' + Math.round(S.th.decayUseMin * 100) + ' and ' + Math.round(S.th.decayUseMax * 100) + ' %. Research display only.' }]; });
  RC.extraInfo.push((r, i) => { let s = ''; const pk = r.ph.list[r.acq.phase[i]].key, k = S2.conc(r.y.act[i], r, pk); if (k.state !== 'na' && k.state !== 'mixed') s += ' · ' + (k.state === 'in' ? S2.concText(r.y.act[i], r, pk) : 'concentration ' + S2.concText(r.y.act[i], r, pk).toLowerCase()); const ref = S2.decayRef(r); if (S.proc.decay && ref && isFinite(r.y.decay[i])) s += ' · decay ' + r.y.decay[i].toFixed(2) + ' ± ' + ref.sd.toFixed(2) + ' ns'; return s; });
  RC.runRows.push((R, i, row) => {
    let h = ''; if (!(i >= 0) || !R.derivedN) return h;
    const st = S2.status(R);
    if (!st.none) { const pk = R.ph.list[R.acq.phase[i]].key, k = S2.conc(R.y.act[i], R, pk); if (k.state !== 'mixed') h += row('Concentration', st.ok ? 'mg/mL' : '', st.ok ? (k.state === 'in' ? '<span title="Indicative">' + fmt.sig3(k.c) + '</span>' : k.state === 'above' || k.state === 'below' ? '<span title="Outside the calibrated linear range; fluorescence is relative only">' + esc(S2.concText(R.y.act[i], R, pk)) + '</span>' : esc(S2.concText(R.y.act[i], R, pk))) + ' ' + tag('P', 'always') : '<span class="state warn" style="font-weight:normal">Calibration not applicable</span>'); }
    if (S.proc.decay) { const ref = S2.decayRef(R), v = R.y.decay[i], info = S2.irfInfo(R.pmt); h += row('Decay metric', 'ns', ref ? (isFinite(v) ? v.toFixed(2) + ' <span class="muted" style="font-weight:normal" title="IRF ' + info.fwhmNs.toFixed(1) + ' ns FWHM; 0.2 ns sampling">± ' + ref.sd.toFixed(2) + ' SD</span>' : '–') : '<span class="muted" style="font-weight:normal">SD not yet measured</span>'); }
    return h;
  });
  function addFrCols() {
    const fr = UI.screen('fractions'); if (!fr || !fr.addCol) return;
    fr.addCol({ k: 'conc', h: 'Concentration <span class="unit">(mg/mL)</span>', num: true, show: () => S2.status(S.run).ok, tip: 'Indicative. Elution fractions only, where the whole fraction is inside the calibrated linear range.', v: f => typeof f.conc === 'number' ? f.conc : -1, f: f => f.conc == null ? '–' : typeof f.conc === 'number' ? fmt.sig3(f.conc) + (f.concPartBelow ? ' <span class="flag" title="Part of the fraction is below the calibrated range">part below</span>' : '') : '<span class="muted small" title="Outside the calibrated linear range; fluorescence is relative only">' + esc(f.conc) + '</span>' }, 'qc');
    fr.addCol({ k: 'decay', h: 'Decay <span class="unit">(ns ± SD)</span>', num: true, show: () => !!S.proc.decay && !!S2.decayRef(S.run), get tip() { return 'Research display only. Mean of the block decay metric over the fraction. IRF ' + S2.irfInfo(S.run ? S.run.pmt : S.setup.pmt).fwhmNs.toFixed(1) + ' ns FWHM; 0.2 ns sampling.'; }, v: f => f.decay, f: f => { const ref = S2.decayRef(S.run); return S.proc.decay && ref && isFinite(f.decay) ? f.decay.toFixed(2) + ' <span class="muted">± ' + ref.sd.toFixed(2) + '</span>' : '–'; } }, 'assign');
  }
  /* ---------- Calibration screen (Proposed) ---------- */
  let calBuilt = false, cAcq = null, cFit = null, cur = null, calKey = '';
  const pts = { x: new Float64Array(6), y: new Float64Array(6), ylo: new Float64Array(6), yhi: new Float64Array(6), open: new Uint8Array(6), n: 6 };
  const fitLine = { x: new Float64Array(2), y: new Float64Array(2), n: 2 }, extLine = { x: new Float64Array(2), y: new Float64Array(2), n: 2 };
  const res = { x: new Float64Array(6), y: new Float64Array(6), n: 6 }, band = { x: Float64Array.from([0, 10.5]), yp: new Float64Array(2), ym: new Float64Array(2), n: 2 };
  function calBuild() {
    const r = $('#scr-calibration');
    r.innerHTML = '<div class="scr-h"><h1>Calibration</h1>' + tag('P', 'always') + '<span class="sp"></span><span class="note">Indicative concentration inside the linear range only</span></div>' +
      '<div class="grid2 cal-grid"><div class="stack">' +
      '<div class="panel"><div class="ph"><h3>Standard and acquisition</h3></div><div class="pb"><div class="form s2-form">' +
      '<label class="l" for="calMat">Standard</label><select id="calMat"><option value="IgG">Purified IgG (default)</option><option value="BSA">BSA (weak surrogate)</option></select>' +
      '<label class="l">Levels</label><div class="small">' + S2.LEVELS.join(', ') + ' mg/mL; ' + S2.SCHED.on + ' min each, ' + S2.SCHED.off + ' min buffer between</div>' +
      '<label class="l">PMT preset and processing</label><div class="small" id="calPre"></div><div class="full" id="calMatNote"></div></div>' +
      '<div style="height:240px;margin-top:6px" id="calAcqChart"></div><div class="note">Drag a window edge on the chart to adjust a plateau.</div></div></div>' +
      '<div class="panel"><div class="ph"><h3>Plateaus</h3><span class="sp"></span><button class="btn sm" id="calAuto">Reset windows to automatic</button></div><div class="pb tbl-wrap" style="padding:0"><table class="tbl" id="calTbl"><thead><tr><th class="num">Level <span class="unit">(mg/mL)</span></th><th class="num">Window <span class="unit">(min)</span></th><th class="num">Mean <span class="unit">(V·ns)</span></th><th class="num">CV <span class="unit">(%)</span></th><th class="num">Departure <span class="unit">(%)</span></th><th>Linear range</th></tr></thead><tbody></tbody></table></div></div>' +
      '</div><div class="stack">' +
      '<div class="panel"><div class="ph"><h3>Fit</h3><span class="sp"></span>' + DEV + '</div><div class="pb"><div class="form s2-form">' +
      '<label class="l" for="calModel">Fit model</label><div class="inl"><select id="calModel"><option value="unweighted">Unweighted linear</option><option value="1/x">1/x weighted linear (default)</option><option value="1/x2">1/x² weighted linear</option></select></div>' +
      '<label class="l" for="calCrit" title="The linear range is the largest set of the lowest levels whose departures from the fit are all within this limit.">Linear range criterion</label><div class="inl"><input type="number" id="calCrit" min="1" max="20" step="0.5" style="width:70px"> % departure from the fit</div></div>' +
      '<div id="calFitSum" class="small" style="margin:6px 0"></div><div style="height:450px" id="calFitChart"></div></div></div>' +
      '</div></div>' +
      '<div class="panel" style="margin-top:12px"><div class="ph"><h3>Calibration record</h3></div><div class="pb" id="calRec"></div></div>';
    $('#calMat').onchange = e => { S.cal.material = e.target.value; M.audit('calibration', 'Calibration standard set to ' + S2.MAT[e.target.value].name + '.'); calKey = ''; mountAcq(); };
    $('#calModel').onchange = e => { S.cal.model = e.target.value; M.audit('calibration', 'Calibration fit model set to ' + e.target.selectedOptions[0].textContent + ' (development assumption).'); calKey = ''; };
    $('#calCrit').onchange = e => { const v = parseFloat(e.target.value); if (v > 0) { M.audit('threshold', 'Calibration linear range criterion changed from ' + S.th.calDepPct + ' to ' + v + ' %.'); S.th.calDepPct = v; calKey = ''; } };
    $('#calAuto').onclick = () => { delete S.cal.windows[S.cal.material + S.setup.pmt]; M.audit('calibration', 'Plateau windows reset to automatic.'); calKey = ''; };
    cFit = new CH.Chart($('#calFitChart'), {
      ariaLabel: 'Calibration fit', topBand: 18, marginRight: 12, liveReadout: false, zoom: true,
      xDomain: () => [0, 10.5], xTitle: () => 'Concentration (mg/mL)',
      panels: [{ key: 'main', yl: { title: 'Plateau mean', unit: 'V·ns' } }, { key: 'res', px: 72, yl: { title: 'Residual', short: 'Residual', unit: '%', sym: true, symMin: 8, zero: false } }],
      bands: () => cur && cur.fit.n ? [{ x0: cur.fit.lo, x1: cur.fit.hi, label: 'Linear range', fill: 'rgba(47,125,79,0.07)' }] : [],
      vlines: () => cur && cur.fit.onset ? [{ x: cur.fit.onset, label: 'Inner-filter onset', color: C.warn, dash: 'dash', align: 'right' }] : [],
      series: [
        { key: 'fit', label: 'Fit', color: C.v20, width: 1.25, panel: 'main', src: () => fitLine, fmt: v => fmt.sig3(v) + ' V·ns' },
        { key: 'ext', label: 'Fit extended', color: C.v20, dash: 'dot', width: 1, panel: 'main', src: () => extLine, fmt: v => fmt.sig3(v) + ' V·ns' },
        { key: 'pts', label: 'Plateau mean ± SD', tip: 'Plateau mean ± SD; open markers are outside the linear range', color: C.text, mode: 'points', panel: 'main', src: () => pts },
        { key: 'res', label: 'Residual', color: C.text, mode: 'points', panel: 'res', src: () => res, legend: false },
        { key: 'bp', label: 'Criterion', color: C.irf, dash: 'dash', width: 1, panel: 'res', src: () => ({ x: band.x, y: band.yp, n: 2 }), legend: false },
        { key: 'bm', label: 'Criterion', color: C.irf, dash: 'dash', width: 1, panel: 'res', src: () => ({ x: band.x, y: band.ym, n: 2 }), legend: false }
      ]
    });
    calBuilt = true; mountAcq();
  }
  let acqData = null;
  function mountAcq() {
    if (cAcq) cAcq.destroy();
    cur = S2.current(); const sim = cur.sim; acqData = { x: sim.t, y: cur.y, n: sim.acq.n, gen: Math.random() };
    cAcq = new CH.Chart($('#calAcqChart'), {
      ariaLabel: 'Calibration acquisition', topBand: 16, marginRight: 12, liveReadout: false,
      xDomain: () => [0, sim.sch.total], xTitle: () => 'Time (min)',
      panels: [{ key: 'main', yl: { title: 'Fluorescence', unit: 'V·ns', log: () => true, minLog: -2 } }],
      bands: () => cur.pl.map(p => ({ x0: p.w[0], x1: p.w[1], label: p.c + ' mg/mL', short: String(p.c), fill: 'rgba(27,54,93,0.07)' })),
      series: [{ key: 'f', label: 'Fluorescence, ' + M.procLabel(), color: M.procMode() === 'v20' ? C.v20 : C.prop, dash: M.procMode() === 'v20' ? null : 'dash', width: 1, panel: 'main', src: () => ({ ...acqData, gen: calKey }), robust: null, fmt: v => fmt.sig3(v) + ' V·ns' }],
      guides: () => cur.pl.flatMap((p, k) => [0, 1].map(j => ({ id: 'w' + k + j, x: p.w[j], color: C.accent, dash: 'dash', drag: v => { const key = S.cal.material + S.setup.pmt, W = S.cal.windows[key] || (S.cal.windows[key] = cur.pl.map(q => q.w.slice())); W[k][j] = v; }, onEnd: () => { M.audit('calibration', 'Plateau window for ' + p.c + ' mg/mL adjusted by hand.'); calKey = ''; } })))
    });
  }
  function calRender() {
    const key = JSON.stringify([S.cal.material, S.cal.model, S.th.calDepPct, S.cal.windows, M.procLabel(), S.setup.pmt, S.cal.activeId, S.cal.records.length, !!S.run]);
    if (key === calKey) return; calKey = key;
    cur = S2.current(); acqData.y = cur.y;
    $('#calMat').value = S.cal.material; $('#calModel').value = S.cal.model; $('#calCrit').value = S.th.calDepPct;
    $('#calPre').innerHTML = esc(M.presetInfo(S.setup.pmt).id) + ' (PMT ' + S.setup.pmt + ' mV); ' + esc(M.procLabel());
    $('#calMatNote').innerHTML = S.cal.material === 'BSA' ? '<div class="callout warn">BSA is a weak surrogate for IgG. Its extinction coefficient is 0.667 against about 1.4 to 1.6 mL/mg/cm for IgG, and it has fewer tryptophans and a different size. Indicative mAb concentrations from a BSA calibration are not reliable.</div>' : '';
    const f = cur.fit;
    $('#calTbl tbody').innerHTML = cur.pl.map((p, k) => '<tr><td class="num">' + p.c + '</td><td class="num" title="' + p.n + ' blocks">' + p.w[0].toFixed(2) + '–' + p.w[1].toFixed(2) + (p.manual ? ' <span class="flag">by hand</span>' : '') + '</td><td class="num">' + fmt.sig3(p.mean) + '</td><td class="num">' + (p.cv * 100).toFixed(2) + '</td><td class="num">' + S2.sgn(f.dep[k], 2) + '</td><td>' + (f.n && k < f.n ? 'Inside' : (f.onset === p.c ? '<span class="state warn" style="font-weight:normal">Possible inner-filter onset</span>' : 'Outside')) + '</td></tr>').join('');
    for (let k = 0; k < 6; k++) { const p = cur.pl[k]; pts.x[k] = p.c; pts.y[k] = p.mean; pts.ylo[k] = p.mean - p.mean * p.cv; pts.yhi[k] = p.mean + p.mean * p.cv; pts.open[k] = f.n && k < f.n ? 0 : 1; res.x[k] = p.c; res.y[k] = f.dep[k]; }
    if (f.n) { fitLine.x[0] = 0; fitLine.x[1] = f.hi; fitLine.y[0] = f.a; fitLine.y[1] = f.a + f.b * f.hi; extLine.x[0] = f.hi; extLine.x[1] = 10.5; extLine.y[0] = f.a + f.b * f.hi; extLine.y[1] = f.a + f.b * 10.5; }
    band.yp.fill(S.th.calDepPct); band.ym.fill(-S.th.calDepPct);
    $('#calFitSum').innerHTML = f.n ? 'Linear from <b>' + f.lo + ' to ' + f.hi + ' mg/mL</b> (' + f.n + ' levels within ' + S.th.calDepPct + ' %). Slope ' + fmt.sig3(f.b) + ' V·ns per mg/mL; intercept ' + fmt.sig3(f.a) + ' V·ns.' : '<span class="state fault">No linear range demonstrated with this criterion.</span>';
    cFit.invalidate(); cAcq.cfg.series[0].label = 'Fluorescence, ' + M.procLabel(); cAcq.buildLegend(); cAcq.invalidate();
    // records
    const st = S2.status(S.run), recs = S.cal.records;
    $('#calRec').innerHTML = '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Active</th><th>ID</th><th>Date</th><th>Material</th><th>PMT preset</th><th>Processing mode</th><th class="num">Linear range <span class="unit">(mg/mL)</span></th><th>Expiry</th></tr></thead><tbody>' +
      recs.map(r => '<tr><td><input type="radio" name="calAct" value="' + r.id + '"' + (r.id === S.cal.activeId ? ' checked' : '') + '></td><td>' + r.id + '</td><td>' + r.date + '</td><td title="Standard lot ' + esc(r.lot) + '">' + esc(r.materialName) + '</td><td>' + r.presetId + '</td><td class="wrap">' + esc(r.mode) + '</td><td class="num">' + (r.fit.n ? r.fit.lo + '–' + r.fit.hi : 'none') + '</td><td>' + r.expiry + '</td></tr>').join('') +
      '<tr><td><input type="radio" name="calAct" value=""' + (!S.cal.activeId ? ' checked' : '') + '></td><td colspan="7" class="muted">No calibration: fluorescence relative only</td></tr></tbody></table></div>' +
      '<div style="margin-top:8px">' + (st.none ? UI.stateHtml('na', 'No calibration active') : st.ok ? UI.stateHtml('ok', 'Applicable to ' + (S.run ? 'this run' : 'the current setup')) : UI.stateHtml('warn', 'Calibration not applicable') + ' <span class="small">' + esc(cap(st.reasons.join('; '))) + '. Rule I7.</span>') + '</div>' +
      '<div class="toolbar" style="margin-top:8px"><button class="btn" id="calSave"' + (f.n ? '' : ' disabled') + '>Save as calibration record</button></div>';
    $$('input[name=calAct]').forEach(rb => rb.onchange = () => { S.cal.activeId = rb.value || null; M.audit('calibration', rb.value ? 'Calibration ' + rb.value + ' made active.' : 'No calibration active.'); calChanged(); });
    $('#calSave').onclick = () => { const rec = S2.makeRecord(cur, S2.today()); S.cal.activeId = rec.id; M.audit('calibration', 'Calibration record ' + rec.id + ' saved (' + rec.materialName + ', ' + rec.presetId + ', ' + rec.mode + ', linear ' + rec.fit.lo + ' to ' + rec.fit.hi + ' mg/mL) and made active.'); calChanged(); };
  }
  const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
  function calChanged() { calKey = ''; const R = S.run; if (R) { if (R.state !== 'complete') R.rules.s2.i7At = R.derivedN; R.rules.replay(); } M.emit('cards'); UI.emitDirty(); const fr = UI.screen('fractions'); if (fr && fr.refresh) fr.refresh(); }
  M.on(ev => { if (ev === 'proc') { calKey = ''; if (S.run && S.run.state !== 'complete') { S.run.rules.s2.i7At = S.run.derivedN; } } });
  UI.register('calibration', { show() { if (!calBuilt) calBuild(); setTimeout(() => { cAcq.resize(); cFit.resize(); }, 0); calKey = ''; calRender(); }, update() { calRender(); } });

  /* ---------- Run comparison (Proposed) ---------- */
  let cmpBuilt = false, cmpChart = null, sel = new Set(), refId = null, xMode = 'vol', relForce = false, cmpKey = '', loading = false;
  const STY = [{ c: C.v20, d: null }, { c: '#1F2933', d: 'dash' }, { c: '#6B7785', d: 'dot' }, { c: '#8C96A0', d: 'dashdot' }];
  function views() {
    const out = []; if (S.run) out.push({ key: S.run.id, v: () => S2.runView(S.run), def: null });
    for (const d of S2.ARCHIVE) out.push({ key: d.id, def: d, v: () => { const a = S2.archive[d.id]; return a && a.done ? S2.runView(a) : null; } });
    return out;
  }
  function compat(entry) {
    const live = S.run; if (!live) return { ok: false, why: 'no current run' };
    const tplId = live.tpl.id === 'free' ? 'protA' : live.tpl.id, dt = entry.def ? entry.def.tpl : tplId;
    if (dt !== tplId) return { ok: false, why: 'different method template' };
    return { ok: true };
  }
  function cmpBuild() {
    const r = $('#scr-comparison');
    r.innerHTML = '<div class="scr-h"><h1>Run comparison</h1>' + tag('P', 'always') + '<span class="sp"></span><div class="toolbar"><div class="seg sm" id="cmpX" title="x axis"><button data-v="vol" class="on">mL</button><button data-v="cv">CV</button></div><label class="chk small"><input type="checkbox" id="cmpRel"> Relative mode</label><button class="btn sm" id="cmpReset">Reset zoom</button></div></div>' +
      '<div class="grid2 cmp-grid"><div class="stack"><div class="panel"><div class="ph"><h3>Runs</h3><span class="sp"></span><span class="note">Up to 4, same method template</span></div><div class="pb" id="cmpRuns"></div></div><div id="cmpLoad"></div><div id="cmpNote"></div></div>' +
      '<div class="panel"><div class="pb" style="height:470px"><div id="cmpChart" style="height:100%"></div></div></div></div>' +
      '<div class="panel" style="margin-top:12px"><div class="ph"><h3>Per-fraction comparison</h3><span class="sp"></span><span class="note">Share of elution-phase integrated fluorescence (relative, not yield)</span></div><div class="pb tbl-wrap" style="padding:0" id="cmpTbl"></div></div>';
    $$('#cmpX button').forEach(b => b.onclick = () => { xMode = b.dataset.v; $$('#cmpX button').forEach(x => x.classList.toggle('on', x === b)); cmpKey = ''; cmpChart.resetZoom(); });
    $('#cmpRel').onchange = e => { relForce = e.target.checked; M.audit('comparison', 'Relative mode ' + (relForce ? 'on' : 'off') + '.'); cmpKey = ''; };
    $('#cmpReset').onclick = () => cmpChart.resetZoom();
    cmpChart = new CH.Chart($('#cmpChart'), {
      ariaLabel: 'Run comparison overlay', topBand: 16, liveReadout: false,
      xDomain: () => { const v = S.run ? S.run.ph.totalVol : 165; return xMode === 'cv' ? [-0.2, (v + 1) / (S.run ? S.run.cv : 4.657)] : [-1, v + 1]; },
      xTitle: () => xMode === 'cv' ? 'Column volumes (CV)' : 'Volume (mL)',
      panels: [{ key: 'main', yl: { title: 'Fluorescence', unit: () => 'x', log: false } }, { key: 'diff', px: 90, yl: { title: 'Difference', short: 'Difference', unit: '', sym: true, symMin: 0.5, zero: false } }],
      bands: () => { if (!S.run) return []; const k = xMode === 'cv' ? 1 / S.run.cv : 1; return S.run.ph.list.map(p => ({ x0: p.v0 * k, x1: p.v1 * k, label: p.name, short: p.short })); },
      series: []
    });
    cmpBuilt = true;
  }
  function ensureArchives() {
    if (loading) return; const need = S2.ARCHIVE.filter(d => !(S2.archive[d.id] && S2.archive[d.id].done));
    if (!need.length) return; loading = true;
    const d = need[0], a = S2.startArchived(d);
    const step = () => { const done = S2.stepArchived(a, 40); $('#cmpLoad').innerHTML = '<div class="callout small">Loading archived run ' + esc(d.id) + ': ' + Math.round(Math.min(1, a.acq.tCursor / a.tEnd) * 100) + ' %</div>'; if (done) { loading = false; cmpKey = ''; $('#cmpLoad').innerHTML = ''; ensureArchives(); } else setTimeout(step, 0); };
    step();
  }
  function cmpRender() {
    const none = !!(S.run && S.run.standalone); $('#scr-comparison').classList.toggle('cmp-none', none);
    if (none) { if (cmpKey !== 'none') { cmpKey = 'none'; $('#cmpRuns').innerHTML = '<div class="note">Standalone TRIFLE: no chromatography data, so no run comparison.</div>'; $('#cmpNote').innerHTML = ''; } return; }
    ensureArchives();
    const entries = views();
    if (!sel.size && S.run) { sel.add(S.run.id); const e = entries.find(x => x.def && compat(x).ok); if (e) sel.add(e.key); refId = S.run.id; }
    const vs = entries.filter(e => sel.has(e.key)).map(e => ({ e, v: e.v() })).filter(x => x.v);
    const presets = new Set(vs.map(x => x.v.pmt)), modes = new Set(vs.map(x => x.v.procKey));
    const mustRel = presets.size > 1 || modes.size > 1, rel = mustRel || relForce;
    const key = JSON.stringify([[...sel], refId, xMode, rel, vs.length, S.run ? S.run.derivedN : 0, M.procLabel(), loading]);
    if (key === cmpKey) return; cmpKey = key;
    // run list
    $('#cmpRuns').innerHTML = !S.run ? '<div class="note">Start a run to compare it with archived runs.</div>' : entries.map((e, k) => {
      const c = compat(e), a = e.def ? S2.archive[e.def.id] : null, v = e.v(), ready = !!v, isSel = sel.has(e.key), idx = [...sel].indexOf(e.key);
      const sty = idx >= 0 ? STY[idx % 4] : null;
      return '<div class="opt" style="margin-bottom:8px' + (c.ok ? '' : ';color:var(--text2)') + '"><input type="checkbox" data-k="' + e.key + '"' + (isSel ? ' checked' : '') + (c.ok && ready ? '' : ' disabled') + '><span style="flex:1"><b>' + esc(e.key) + '</b> ' + (sty ? '<span class="ch-sw ' + (sty.d || 'solid') + '" style="border-top-color:' + sty.c + ';vertical-align:middle"></span>' : '') + '<span class="note">' + esc(e.def ? e.def.name + ', ' + e.def.date + '; PMT ' + e.def.pmt + ' mV; ' + e.def.mode : 'This run; PMT ' + S.run.pmt + ' mV; ' + M.procLabel()) + (c.ok ? '' : '. Not comparable: ' + c.why + '.') + (e.def && !ready && c.ok ? ' Loading.' : '') + '</span></span><label class="small" title="Reference for the difference trace"><input type="radio" name="cmpRef" value="' + e.key + '"' + (refId === e.key ? ' checked' : '') + (isSel ? '' : ' disabled') + '> reference</label></div>';
    }).join('');
    $$('#cmpRuns input[type=checkbox]').forEach(cb => cb.onchange = () => { if (cb.checked) { if (sel.size >= 4) { cb.checked = false; return; } sel.add(cb.dataset.k); } else { sel.delete(cb.dataset.k); if (refId === cb.dataset.k) refId = [...sel][0] || null; } M.audit('comparison', 'Run ' + cb.dataset.k + (cb.checked ? ' added to' : ' removed from') + ' the comparison.'); cmpKey = ''; });
    $$('#cmpRuns input[name=cmpRef]').forEach(rb => rb.onchange = () => { refId = rb.value; M.audit('comparison', 'Reference run set to ' + refId + '.'); cmpKey = ''; });
    $('#cmpRel').checked = rel; $('#cmpRel').disabled = mustRel;
    $('#cmpNote').innerHTML = mustRel ? '<div class="callout warn small">Relative mode only. The selected runs differ in ' + [presets.size > 1 ? 'PMT preset' : '', modes.size > 1 ? 'processing mode' : ''].filter(Boolean).join(' and ') + ', so absolute fluorescence is not comparable.</div>' : '';
    // series
    const ref = vs.find(x => x.e.key === refId), refB = ref ? S2.binned(ref.v, xMode, rel) : null, series = [];
    vs.forEach((x, k) => {
      const sty = STY[[...sel].indexOf(x.e.key) % 4], b = S2.binned(x.v, xMode, rel);
      series.push({ key: 's' + k, label: x.e.key + (x.e.key === refId ? ' (reference)' : ''), color: sty.c, dash: sty.d, width: 1.25, panel: 'main', src: () => ({ ...b, gen: cmpKey }), fmt: v => rel ? v.toFixed(1) + ' %' : fmt.sig3(v) + ' V·ns' });
      if (refB && x.e.key !== refId) { const d = { x: b.x, y: new Float64Array(b.n), n: b.n }; for (let i = 0; i < b.n; i++) d.y[i] = b.y[i] - refB.y[i]; series.push({ key: 'd' + k, label: x.e.key + ' minus reference', color: sty.c, dash: sty.d, width: 1, panel: 'diff', src: () => ({ ...d, gen: cmpKey }), fmt: v => S2.sgn(v, rel ? 1 : 3) + (rel ? ' points' : ' V·ns'), legend: false }); }
    });
    cmpChart.cfg.panels[0].yl = rel ? { title: 'Fluorescence', unit: '% of own elution maximum' } : { title: 'Fluorescence', unit: 'V·ns, ND-corrected' };
    cmpChart.cfg.panels[1].yl = { title: 'Difference from reference', short: 'Difference', unit: rel ? '% points' : 'V·ns', sym: true, symMin: rel ? 2 : 0.05, zero: false };
    cmpChart.setSeries(series); cmpChart.relayout();
    // table
    const fc = vs.map(x => ({ id: x.e.key, fc: S2.fracCompare(x.v), el: x.v.live && S.run.state !== 'complete' && !(x.v.n && x.v.u[x.v.n - 1] >= (x.v.ph.list.find(p => p.key === 'el') || { v1: -Infinity }).v1) ? NaN : S2.phaseIntegral(x.v, 'el'), lp: S2.loadPlateau(x.v), v: x.v }));
    const refFc = fc.find(x => x.id === refId);
    const ids = vs.length ? vs[0].v.fractions.filter(f => f.phaseKey === 'el').map(f => f.id) : [];
    const pl = (n, one, many) => n + ' ' + (n === 1 ? one : many);
    const flag = q => [q.chg ? '<span class="flag" title="' + pl(q.chg, 'sensitivity change', 'sensitivity changes') + ' inside the fraction">Sens. ×' + q.chg + '</span>' : '', q.over ? '<span class="flag f" title="' + pl(q.over, 'waveform', 'waveforms') + ' above 90 % of the input range">Over ×' + q.over + '</span>' : '', q.disc ? '<span class="flag w" title="' + pl(q.disc, 'discarded block', 'discarded blocks') + '">Disc. ×' + q.disc + '</span>' : ''].join('') || '';
    const diffPct = (a, b) => isFinite(a) && isFinite(b) && b ? ' <span class="muted">(' + S2.sgn((a / b - 1) * 100, 1) + ' %)</span>' : '';
    $('#cmpTbl').innerHTML = !vs.length ? '<div class="note" style="padding:8px 12px">' + (S.run ? 'Select runs to compare.' : 'Start a run to compare.') + '</div>' : '<table class="tbl"><thead><tr><th>Fraction</th>' + fc.map(x => '<th class="num">' + esc(x.id) + ' <span class="unit">(%)</span></th><th>QC</th>').join('') + '</tr></thead><tbody>' +
      ids.map(id => '<tr><td>' + id + '</td>' + fc.map(x => { const q = x.fc[id]; return q && isFinite(q.share) ? '<td class="num">' + (q.share * 100).toFixed(1) + '</td><td>' + flag(q) + '</td>' : '<td class="num">–</td><td></td>'; }).join('') + '</tr>').join('') +
      (rel ? '' : '<tr><td class="wrap"><b>Elution total</b> <span class="unit muted">(V·ns·mL)</span></td>' + fc.map(x => '<td class="num">' + (x.el > 0 ? fmt.sig3(x.el) : '–') + '</td><td>' + (x.id !== refId && refFc ? diffPct(x.el, refFc.el) : '') + '</td>').join('') + '</tr>' +
      '<tr><td class="wrap"><b>Load plateau</b> <span class="unit muted">(V·ns, median)</span></td>' + fc.map(x => '<td class="num">' + fmt.sig3(x.lp) + '</td><td>' + (x.id !== refId && refFc ? diffPct(x.lp, refFc.lp) : '') + '</td>').join('') + '</tr>') + '</tbody></table>';
  }
  UI.register('comparison', { show() { if (!cmpBuilt) cmpBuild(); setTimeout(() => cmpChart.resize(), 0); cmpKey = ''; cmpRender(); }, update() { cmpRender(); } });

  /* ---------- Integrations (Future) ---------- */
  // Future integrations, listed on the About page
  window.INTEGRATIONS_HTML = () => {
    const rows = [['Live UNICORN link', 'Phase, flow and fraction events in real time', 'GSK IT approval, UNICORN interface access, validation'], ['IDBS E-WorkBook transfer', 'Push the summary and attachments to an experiment ID', 'IDBS API access, permissions, record structure agreement'], ['Data storage', 'Automatic upload to the agreed GSK repository, replacing the manual SharePoint step', 'Storage location, retention policy'], ['Language-model Questions panel', 'Free-text answers about runs', 'Defined data access, permissions, provenance of every answer, GSK approval'], ['Legacy .pkl conversion', 'Convert v2.0 pickle records to CSV and JSON', 'An isolated, trusted environment, because opening a pickle can execute code embedded in it']];
    return '<div class="panel"><div class="ph"><h3>Integrations</h3>' + tag('F', 'always') + '</div><div class="pb"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Integration</th><th>Purpose</th><th>Prerequisites</th></tr></thead><tbody>' + rows.map(r => '<tr><td class="wrap"><b>' + esc(r[0]) + '</b></td><td class="wrap">' + esc(r[1]) + '</td><td class="wrap">' + esc(r[2]) + '</td></tr>').join('') + '</tbody></table></div></div></div>';
  };

  /* ---------- Record: export packaging ---------- */
  // slot: before the scientist's exports; eng: with the Engineer view data files
  window.REC_STAGE2 = (slot, eng) => {
    slot.innerHTML = ''; eng.innerHTML = '';
    const pdf = el('<button class="btn offline-only" title="Opens the print dialog. Choose Save as PDF (A4).">Summary (PDF)</button>'), pdfTag = el(tag('P')), h5 = el('<button class="btn"' + (S.run ? '' : ' disabled') + '>Raw waveforms (HDF5)…</button>');
    pdfTag.classList.add('offline-only');
    pdf.onclick = () => { REC.logExport(REC.fileBase() + '_summary.pdf (print)'); setTimeout(() => window.print(), 50); };
    h5.onclick = () => hdf5Dialog();
    slot.append(pdf, pdfTag); eng.append(h5, el(tag('P')));
  };
  function hdf5Dialog() {
    const R = S.run, n = R.acq.n, disc = R.acq.disc.subarray(0, n).reduce((a, b) => a + b, 0), wf = (n - disc) * 10, bytes = wf * 600 * 2 + wf * 96 + (n - disc) * 64 + 64 * 1024;
    const mb = bytes / 1048576;
    const tree = ['/', '├─ attributes: settings snapshot, preset ' + M.presetInfo(R.pmt).id + ', checksum,', '│              software versions, labels', '├─ irf/  (7 Gaussian terms per preset; A, W, T)', '├─ beam_monitor/  start and end blocks' + (R.setupSnap.beamPerBlock ? ', and one per block' : ''), '└─ blocks/', '   ├─ block_000001/', '   │  ├─ attributes: time_s, step, nd_od, range_V, pmt_mV, timestamp', '   │  └─ waveform_01 … waveform_10  int16[600]', '   │     attributes: nd_od, range_V, pmt_preset, timestamp', '   ├─ …', '   └─ block_' + String(n).padStart(6, '0') + '/'].join('\n');
    UI.modal('Raw waveforms (HDF5)', '<p class="small">' + tag('P', 'always') + ' Planned file structure and size. No file is written.</p><pre class="eng-only" style="font-size:12.5px;background:#F7F8F9;border:1px solid var(--border);padding:8px;overflow:auto">' + esc(tree) + '</pre><table class="tbl"><tbody><tr><td>Blocks</td><td class="num">' + fmt.int(n - disc) + ' (' + disc + ' discarded, not written)</td></tr><tr><td>Waveforms</td><td class="num">' + fmt.int(wf) + '</td></tr><tr><td>Samples per waveform</td><td class="num">600 × int16 (2 bytes)</td></tr><tr><td>Estimated size</td><td class="num" title="Includes about 96 bytes of attributes per waveform, 64 bytes per block and 64 kB of settings"><b>' + mb.toFixed(1) + ' MB</b> uncompressed</td></tr></tbody></table>', [{ label: 'Close', primary: true }]);
    M.audit('export', 'HDF5 structure viewed (estimated ' + mb.toFixed(1) + ' MB; no file written).');
  }

  /* ---------- Engineer additions ---------- */
  ENG.addTab('fit', 'Decay', 'wf');
  let fitBlock = null, fc = null;
  window.ENG_EXTRA = {
    defs: { html: () => {
      const info = S2.irfInfo(S.setup.pmt), ref = S2.decayRef(S.run);
      return '<div class="panel" style="max-width:820px"><div class="ph"><h3>Decay metric</h3>' + tag('P', 'always') + '<span class="tag" data-scope="always">Research display</span></div><div class="pb small">' +
        '<p><b>Definition.</b> Intensity-weighted mean delay after the IRF peak (' + info.peakNs.toFixed(1) + ' ns from window start), Σ (t − t<sub>peak</sub>) I(t) / Σ I(t) over 0 to 20 ns, with I(t) = −(v(t) − b) on the block median waveform and b its median baseline.</p>' +
        '<p>Computed only where input range use is between ' + Math.round(S.th.decayUseMin * 100) + ' and ' + Math.round(S.th.decayUseMax * 100) + ' %.</p>' +
        '<p><b>Precision.</b> Block-to-block SD over the first 40 valid blocks of the elution peak, which are also the P7 reference. The load plateau is host-cell protein, a different species, so it is not used. ' + (ref ? 'This run: ' + ref.mean.toFixed(3) + ' ± ' + ref.sd.toFixed(3) + ' ns from ' + fmt.int(ref.n) + ' blocks.' : 'Measured once the elution peak is acquired with decay analysis on.') + ' IRF ' + info.fwhmNs.toFixed(2) + ' ns FWHM; sampling interval 0.2 ns.</p>' +
        '<p><b>Rule P7</b> fires only when a shift exceeds ' + S.th.decaySdMult + ' × SD and ' + S.th.decayThrNs + ' ns. Linked hypothesis H3 suggests HPLC-SEC.</p></div></div>';
    } },
    fit: { html: () => {
      const R = S.run; if (!R || !R.acq.n) return '<div class="note">Start a run to fit a block.</div>';
      const A = R.acq; if (fitBlock == null) { let best = 0, bi = A.n - 1; for (let i = 0; i < A.n; i++) if (!A.disc[i] && A.ruse[i] > 0.3 && A.ruse[i] < 0.9 && R.y.v20[i] > best) { best = R.y.v20[i]; bi = i; } fitBlock = bi; }
      let i = Math.min(A.n - 1, fitBlock); while (i > 0 && A.disc[i]) i--;
      fc = S2.reconFit(TR.medianWave(TR.regenBlock(A, i)), R.pmt); fc.block = i;
      return '<div class="toolbar" style="margin-bottom:8px"><label class="small">Block <input type="number" id="fitBlk" min="1" max="' + A.n + '" value="' + (i + 1) + '" style="width:90px"></label><span class="note">' + fmt.ml(A.u[i]) + ' mL, ' + esc(R.ph.list[A.phase[i]].name) + ', range use ' + fmt.pct0(A.ruse[i]) + ' %.</span>' + tag('P', 'always') + '</div>' +
        '<div class="grid2 fit-grid"><div style="height:420px" id="fitChart"></div><div class="stack"><table class="tbl"><thead><tr><th>Parameter</th><th class="num">Value</th></tr></thead><tbody><tr><td>τ, single exponential</td><td class="num"><b>' + fc.tau.toFixed(3) + ' ± ' + fc.sigTau.toFixed(3) + ' ns</b></td></tr><tr><td>Amplitude A</td><td class="num">' + fc.A.toPrecision(4) + '</td></tr><tr><td title="Close to 1 for a good fit">χ² (reduced)</td><td class="num">' + fc.chi2r.toFixed(2) + '</td></tr><tr><td>Points in fit range</td><td class="num">' + fc.N + '</td></tr><tr><td>Fit range</td><td class="num">' + (fc.i0 * 0.2).toFixed(1) + ' to ' + (fc.i1 * 0.2).toFixed(1) + ' ns</td></tr><tr><td>IRF width</td><td class="num">' + fc.fwhm.toFixed(2) + ' ns FWHM ' + tag('A', 'always') + '</td></tr><tr><td>Noise σ per sample</td><td class="num">' + (fc.sd * 1000).toFixed(3) + ' mV</td></tr></tbody></table>' +
        '<div class="note">Single exponential convolved with the stored IRF for the run\'s preset. τ uncertainty from Δχ² = 1.</div></div></div>';
    }, mount: () => {
      $('#engBody').insertAdjacentHTML('beforeend', '<div style="margin-top:12px">' + window.ENG_EXTRA.defs.html() + '</div>');
      const host = $('#fitChart'); if (!host || !fc) return;
      const x = new Float64Array(600); for (let j = 0; j < 600; j++) x[j] = j * 0.2;
      const pos = a => Float64Array.from(a, v => v > 0 ? v : NaN), hm = Math.min(...fc.irf), dmax = Math.max(...fc.data);
      const irfS = Float64Array.from(fc.irf, v => v / hm * dmax);
      const ch = new CH.Chart(host, { ariaLabel: 'Reconvolution fit', topBand: 14, marginRight: 12, liveReadout: false, xDomain: () => [30, 75], xTitle: () => 'Time from window start (ns)',
        panels: [{ key: 'main', yl: { title: 'Intensity', unit: 'V', log: () => true, minLog: -6 } }, { key: 'res', px: 90, yl: { title: 'Weighted residual', short: 'Residual', unit: 'σ', sym: true, symMin: 3, zero: false } }],
        bands: () => [{ x0: fc.i0 * 0.2, x1: fc.i1 * 0.2, label: 'Fit range', fill: 'rgba(27,54,93,0.05)' }],
        series: [{ key: 'd', label: 'Data (block median)', color: C.v20, width: 1, panel: 'main', src: () => ({ x, y: pos(fc.data), n: 600 }), fmt: v => v.toExponential(2) + ' V' }, { key: 'irf', label: 'IRF', color: C.irf, dash: 'dash', width: 1, panel: 'main', src: () => ({ x, y: pos(irfS), n: 600 }), fmt: v => v.toExponential(2) }, { key: 'f', label: 'Fit, τ ' + fc.tau.toFixed(2) + ' ns', color: C.prop, width: 1.25, panel: 'main', src: () => ({ x, y: fc.fit, n: 600 }), fmt: v => v.toExponential(2) + ' V' }, { key: 'r', label: 'Weighted residuals', color: C.text2, width: 1, panel: 'res', src: () => ({ x, y: fc.res, n: 600 }), fmt: v => v.toFixed(2) + ' σ' }] });
      $('#fitBlk').onchange = e => { fitBlock = (+e.target.value || 1) - 1; UI.screen('engineer').show(); };
    } }
  };

  /* ---------- Setup additions for the AAV template ---------- */
  const aavNoted = new WeakSet();
  M.on(ev => { const R = S.run; if (ev === 'run' && R && R.tpl.id === 'aav' && !aavNoted.has(R)) { aavNoted.add(R); M.log(R, 'system', 'AAV affinity capture template. The lifetime analysis names co-eluting components empty and full capsids (assumed); it reports shares of fluorescence, not an empty-to-full particle ratio.'); } });

  /* ---------- Questions panel additions ---------- */
  Q.addIntent((q, ctx) => {
    const R = ctx.run, rm = q.match(/\b([iph])([1-9])\b/);
    if (rm && M.ruleById((rm[1] + rm[2]).toUpperCase())) return null; // rule questions go to the rule catalogue
    if (/concentration|mg\/ml|calibrat|indicative/.test(q)) {
      const st = S2.status(R); if (st.none) return { text: 'No calibration is active, so fluorescence is relative only. A calibration from purified IgG step injections converts fluorescence to an indicative concentration inside its linear range.', source: 'Calibration screen' };
      if (!st.ok) return { text: 'Calibration ' + st.rec.id + ' does not apply to this run, so no concentration is shown (rule I7). Reason: ' + cap(st.reasons.join('; ')) + '.', source: 'Calibration record ' + st.rec.id + '; rule I7' };
      return { text: 'Calibration ' + st.rec.id + ' (' + st.rec.materialName + ', ' + st.rec.presetId + ', ' + st.rec.mode + ') is linear from ' + st.rec.fit.lo + ' to ' + st.rec.fit.hi + ' mg/mL. Indicative concentrations are shown only in elution and inside that range. Elsewhere fluorescence is relative only, and rule P6 lists the fractions above the range. Yield and recovery are not computed from fluorescence.', source: 'Calibration record ' + st.rec.id + '; rule P6' };
    }
    if (/decay metric|decay-shape|decay shape|tryptophan environment|conformation|\bp7\b/.test(q)) {
      if (!S.proc.decay) return { text: 'Decay-shape analysis is off. Switch it on under Processing in Engineer view to show the decay metric and rule P7. It is a Proposed research display and cannot identify a cause.', source: 'Processing options; rule P7' };
      const p7 = R ? R.rules.cards.find(c => c.rule === 'P7') : null, ref = S2.decayRef(R), info = S2.irfInfo(R ? R.pmt : S.setup.pmt);
      const def = 'The decay metric is the intensity-weighted mean delay after the IRF peak, over 0 to 20 ns of the block median waveform. It is computed where input range use is ' + Math.round(S.th.decayUseMin * 100) + ' to ' + Math.round(S.th.decayUseMax * 100) + ' %.';
      if (p7) return { text: def + ' ' + p7.obs + ' Research hypothesis H3 is a possible change in tryptophan environment. Confirm with HPLC-SEC on ' + M.rangeIds(p7.fractions) + '.', source: 'Engineer view: Decay; card ' + p7.id + '; H3' };
      return { text: def + ' No P7 observation so far.' + (ref ? ' The elution-front reference is ' + ref.mean.toFixed(2) + ' ± ' + ref.sd.toFixed(2) + ' ns (SD), with IRF ' + info.fwhmNs.toFixed(1) + ' ns FWHM and 0.2 ns sampling.' : '') + ' P7 fires only when the shift exceeds ' + S.th.decaySdMult + ' × SD and ' + S.th.decayThrNs + ' ns.', source: 'Engineer view: Decay; rule P7' };
    }
    if (/capsid|\bempty\b.*\bfull\b|\bfull\b.*\bempty\b/.test(q)) return { text: 'In the AAV template the lifetime analysis can separate co-eluting capsid populations by their fluorescence decay, and names the components empty and full capsids from the template\'s expected lifetimes (assumed, not validated). It reports shares of fluorescence, not an empty-to-full particle ratio: a full capsid does not give the same fluorescence as an empty one. Confirm with AUC, cryo-EM or AEX.', source: 'AAV affinity capture template; lifetime analysis (Proposed)' };
    if (/compar|earlier run|previous run|other run/.test(q)) return { text: 'Run comparison overlays up to 4 runs of the same method template, aligned by volume, with a difference trace against a reference run and a per-fraction table. Runs with different PMT presets or processing modes are compared in relative mode only.', source: 'Procedure: Run comparison' };
    return null;
  });
  window.Q_EXTRA_CHIPS = { fractions: ['What concentration is shown?'], calibration: ['What concentration is shown?'], comparison: ['How are runs compared?', 'Can I trust the elution peak?'] };

  /* ---------- wiring ---------- */
  setTimeout(() => { addFrCols(); S2.initRecord(); UI.emitDirty(); }, 0);
})();
