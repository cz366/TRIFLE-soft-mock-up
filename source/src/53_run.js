/* ---------- shared chromatogram configuration (Run and Fraction review) ---------- */
const RC = (function () {
  const S = M.S, fmt = M.fmt, C = CH.C, { esc } = UI;
  const view = { x: 'vol', log: false };
  const extraSeries = [], extraPanels = [], extraInfo = [], runRows = [];
  const XT = { vol: 'Volume (mL)', cv: 'Column volumes (CV)', min: 'Time (min)' };
  function R() { return S.run; }
  function sa() { const r = R(); return r ? !!r.standalone : S.setup.source === 'standalone'; }
  function toX(v) { const r = R(); if (!r) return v; if (view.x === 'cv') return v / r.cv; if (view.x === 'min') return TR.timeAtVol(r.ph, v); return v; }
  function fromX(x) { const r = R(); if (!r) return x; if (view.x === 'cv') return x * r.cv; if (view.x === 'min') return TR.pumpVolAt(r.ph, x); return x; }
  function xDomain() {
    const r = R(), tpl = r ? r.tpl : M.template(), ph = r ? r.ph : TR.buildPhases(tpl);
    if (sa()) return [0, r ? r.timerMin : (S.setup.timerMin || Math.ceil(ph.totalMin + 2))];
    if (view.x === 'min') return [-1, (r ? r.timerMin : ph.totalMin + 2) - 1];
    const v = [-1, ph.totalVol + 1]; return view.x === 'cv' ? [v[0] / tpl.cv, v[1] / tpl.cv] : v;
  }
  function bands() {
    const r = R(), tpl = r ? r.tpl : M.template(), ph = r ? r.ph : TR.buildPhases(tpl); if (S.setup.source === 'standalone' && !r) return [];
    if (r && r.setupSnap.source === 'standalone') return [];
    const out = [];
    for (const p of ph.list) {
      if (view.x === 'min') { out.push({ x0: p.t0, x1: p.tPump, label: p.name, short: p.short }); if (p.hold) out.push({ x0: p.tPump, x1: p.t1, label: 'Hold, no flow', short: 'Hold' }); }
      else { const k = view.x === 'cv' ? 1 / tpl.cv : 1; out.push({ x0: p.v0 * k, x1: p.v1 * k, label: p.name, short: p.short }); }
    }
    return out;
  }
  function fracItems() {
    const r = R(); if (!r || !r.fractions.length) return null; const al = M.alignmentState();
    return { items: r.fractions.map(f => ({ id: f.id, a: toX(f.a), b: toX(f.b) })), uncertain: al.fractions === 'Uncertain' };
  }
  function trifle(key) {
    return () => { const r = R(); if (!r) return null; return { x: r.x[sa() ? 'acq' : view.x], y: r.y[key], n: r.derivedN, robust: r.robust, low: r.low, brk: r.brk, maxGap: { vol: 1.0, cv: 0.25, min: 1.0 }[view.x], gen: r.dataGen * 10 + ({ vol: 1, cv: 2, min: 3 }[view.x]) }; };
  }
  function akta(key) { return () => { const r = R(); if (!r || r.setupSnap.source !== 'import') return null; return { x: r.ak[view.x], y: r.akta[key], n: r.aktaN, gen: { vol: 1, cv: 2, min: 3 }[view.x] }; }; }
  function seriesFor(opts) {
    const p = M.procMode(), lc = S.proc.laser, cmp = S.proc.compare, r = R(), bmOn = r ? r.setupSnap.beamPerBlock : S.setup.beamPerBlock, imp = (r ? r.setupSnap.source : S.setup.source) === 'import';
    const ff = v => fmt.sig3(v) + ' V·ns';
    const list = [
      { key: 'v20', label: 'Fluorescence, v2.0 reference', color: C.v20, width: 1.25, panel: 'main', src: trifle('v20'), fmt: ff, visible: p === 'v20' || cmp, shade: true },
      { key: 'prop', label: 'Fluorescence, Proposed' + (lc ? ' (corrected)' : ''), color: C.prop, dash: 'dash', width: 1.25, panel: 'main', src: trifle('prop'), fmt: ff, visible: p === 'prop', legend: p === 'prop' },
      { key: 'propU', label: 'Fluorescence, Proposed, uncorrected', color: C.prop, width: 0.9, panel: 'main', src: trifle('propU'), fmt: ff, visible: p === 'prop' && lc, legend: p === 'prop' && lc },
      { key: 'uv', label: 'UV 280', color: C.uv, width: 1.25, panel: 'main', side: 'r', src: akta('uv'), fmt: v => fmt.mau(v) + ' mAU', visible: imp, legend: imp },
      { key: 'cond', label: 'Conductivity', color: C.cond, width: 1, panel: 'cond', src: akta('cond'), fmt: v => fmt.cond(v) + ' mS/cm', visible: imp, legend: imp },
      { key: 'ph', label: 'pH', color: C.ph, width: 1, panel: 'ph', src: akta('ph'), fmt: v => fmt.ph(v), visible: imp, legend: imp },
      { key: 'bm', label: 'Beam monitor', color: C.beam, width: 1, panel: 'bm', src: trifle('bm'), fmt: v => v.toFixed(1) + ' %', visible: bmOn, legend: bmOn, tag: 'Proposed', tagScope: lc ? 'always' : 'engineer' },
      { key: 'diff', label: 'Difference, Proposed minus v2.0', color: C.diff, width: 1, panel: 'diff', src: trifle('diff'), fmt: v => UI.sgn(v, 1) + ' %', visible: cmp && p === 'prop', legend: cmp && p === 'prop' }
    ];
    if (opts && opts.extra) list.push(...opts.extra);
    for (const f of extraSeries) list.push(...f());
    return list;
  }
  function panels(extraStrips) {
    const r = () => R();
    const bmOn = () => (r() ? r().setupSnap.beamPerBlock : S.setup.beamPerBlock);
    const imp = () => (r() ? r().setupSnap.source : S.setup.source) === 'import';
    const out = [
      { key: 'main', yl: { title: 'Fluorescence', unit: 'V·ns, ND-corrected', log: () => view.log, minLog: -3 }, yr: (r() ? r().setupSnap.source : S.setup.source) === 'import' ? { title: 'UV 280', unit: 'mAU', fixed: [0, 4000] } : null },
      { key: 'cond', px: 46, hidden: () => !imp(), yl: { title: 'Conductivity', short: 'Cond.', unit: 'mS/cm', fixed: [0, 100], tickFmt: v => v.toFixed(0) } },
      { key: 'ph', px: 46, hidden: () => !imp(), yl: { title: 'pH', short: 'pH', unit: '', fixed: [0, 14] } },
      { key: 'bm', px: 46, hidden: () => !bmOn(), yl: { title: 'Beam monitor', short: 'Beam mon.', unit: '%', fixed: [96, 102] } },
      { key: 'diff', px: 46, hidden: () => !(S.proc.compare && M.procMode() === 'prop'), yl: { title: 'Difference', short: 'Difference', unit: '%', sym: true, symMin: 5, zero: false } }
    ];
    if (extraStrips) out.push(...extraStrips);
    for (const f of extraPanels) out.push(...f());
    return out;
  }
  function markers(withTicks) {
    const r = R(); if (!r) return [];
    if (sa()) return r.notes.map(n => ({ kind: 'note', x: n.t / 60, label: n.id, text: n.id + ': ' + n.text }));
    const out = [];
    if (withTicks) for (const c of r.acq.changes) { if (c.i >= r.derivedN) break; out.push({ kind: 'tick', x: r.x[sa() ? 'acq' : view.x][c.i], color: C.v20, text: 'Sensitivity step ' + c.from + ' to ' + c.to + ' at ' + fmt.ml(r.x.vol[c.i]) + ' mL' }); }
    for (const n of r.notes) out.push({ kind: 'note', x: toX(n.x), label: n.id, text: (n.kind === 'note' ? 'Note ' : 'Event ') + n.id + ' at ' + fmt.ml(n.x) + ' mL (' + n.wall + '): ' + n.text });
    return out;
  }
  function hatches() { const r = R(), al = M.alignmentState(); if (!r || al.detector !== 'Uncertain') return []; const d = xDomain(); return [{ x0: d[0], x1: d[1] }]; }
  function intervals() {
    const r = R(); if (!r) return [];
    return r.rules.cards.filter(c => c.rule === 'I6' || (c.rule === 'I1' && c.x1 > c.x0)).map(c => ({ x0: toX(c.x0), x1: toX(c.x1), label: c.rule === 'I6' ? 'I6 laser change' : 'I1 warm-up', color: C.warn }));
  }
  function info(x) {
    const r = R(); if (x == null || !r) return '';
    if (sa()) return fmt.min1(x) + ' min from TRIFLE start';
    const v = fromX(x), ph = r.ph.list[TR.phaseIdxAtVol(r.ph, v)], t = view.x === 'min' ? x : TR.timeAtVol(r.ph, v);
    const f = r.fractions.find(q => v >= q.a && v < q.b);
    let s = fmt.ml(v) + ' mL · ' + fmt.cv(v / r.cv) + ' CV · ' + fmt.min1(t) + ' min · ' + ph.name + (f ? ' · ' + f.id : '');
    if (view.x === 'min') { const hp = r.ph.list.find(p => p.hold && x >= p.tPump && x < p.t1); if (hp) return 'Hold, no flow · ' + fmt.min1(x) + ' min · ' + fmt.ml(hp.v1) + ' mL'; }
    const i = TR.lowerBound(r.x.vol, r.derivedN, v); if (i < r.derivedN && Math.abs(r.x.vol[i] - v) < 0.2) { const A = r.acq; s += S.engineer ? ' · step ' + A.step[i] + (isFinite(A.ruse[i]) ? ' · range use ' + fmt.pct0(A.ruse[i]) + ' %' : ' · discarded block') + (r.low[i] ? ' (low precision)' : '') : (r.low[i] ? ' · low precision' : ''); for (const f of extraInfo) s += f(r, i); }
    return s;
  }
  function rulerInfo(a, b) {
    const r = R(); if (!r) return '';
    if (sa()) { const xa = Math.min(a, b), xb = Math.max(a, b), i0 = TR.lowerBound(r.x.acq, r.derivedN, xa), i1 = TR.lowerBound(r.x.acq, r.derivedN, xb); let s = 0, n = 0; for (let i = i0; i < i1; i++) { const y = r.y.act[i]; if (y === y) { s += y; n++; } } return 'R1 ' + fmt.min1(xa) + ', R2 ' + fmt.min1(xb) + ' min · Δ ' + fmt.min1(xb - xa) + ' min · mean ' + (n ? fmt.sig3(s / n) + ' V·ns' : '–'); }
    const va = fromX(Math.min(a, b)), vb = fromX(Math.max(a, b)), ta = TR.timeAtVol(r.ph, va), tb = TR.timeAtVol(r.ph, vb);
    const A = r.acq, i0 = TR.lowerBound(r.x.vol, r.derivedN, va), i1 = TR.lowerBound(r.x.vol, r.derivedN, vb); let s = 0, n = 0;
    for (let i = i0; i < i1; i++) { const y = r.y.act[i]; if (y === y) { s += y; n++; } }
    return 'R1 ' + fmt.ml(va) + ', R2 ' + fmt.ml(vb) + ' mL · Δ ' + fmt.ml(vb - va) + ' mL, ' + fmt.min1(tb - ta) + ' min · mean ' + (n ? fmt.sig3(s / n) + ' V·ns' : '–');
  }
  function legendExtras() { return [{ html: '<span class="ch-sw box" style="background:rgba(183,121,31,0.12);border:1px solid rgba(183,121,31,0.5)"></span><span class="ch-ll">Low precision</span>', tip: 'Pulse fills under ' + Math.round(S.th.lowPrec * 100) + ' % of the input range (provisional). Not used for the y-axis autoscale; values beyond the axis are marked at its edge.' }]; }
  function xTitle() { return sa() ? 'Time from TRIFLE start (min)' : XT[view.x]; }
  return { extraSeries, extraPanels, extraInfo, runRows, view, XT, xTitle, sa, toX, fromX, xDomain, bands, fracItems, trifle, akta, seriesFor, panels, markers, hatches, intervals, info, rulerInfo, legendExtras };
})();

/* ---------- Run (Acquire and Validate) ---------- */
(function () {
  const { $, $$, esc, el, tag } = UI, S = M.S, fmt = M.fmt, C = CH.C;
  let chart = null, pulseChart = null, built = false, engLaid = null, logFilter = 'all', logN = 0, cardsKey = '', pulseLog = false, highlight = null, expanded = false, narrowTab = 'log';
  const pulse = { x: new Float64Array(600), y: new Float64Array(600), ly: new Float64Array(600), iy: new Float64Array(600), liy: new Float64Array(600), n: 0, gen: 0, blk: -1 };
  for (let j = 0; j < 600; j++) pulse.x[j] = j * 0.2;
  function build() {
    const r = $('#scr-run'); r.classList.add('fixed');
    r.innerHTML = '<div class="scr-h"><h1>Run</h1><div class="chips acq-chips"></div><span class="sp"></span>' +
      '<button class="btn primary" id="rStart">Start</button><button class="btn" id="rPause">Pause</button><button class="btn" id="rCont">Continue</button><button class="btn" id="rEnd">End</button><span class="sep"></span><button class="btn" id="rMark">Mark event</button><button class="btn" id="rNote">Add note</button></div>' +
      '<div class="run-top">' +
      '<div class="toolbar" id="rTools"><div class="seg sm" id="rX" role="group" aria-label="X-axis units"><button data-v="vol">mL</button><button data-v="cv">CV</button><button data-v="min">min</button></div><div class="seg sm" id="rLog"><button data-v="0">Linear</button><button data-v="1">Log</button></div><label class="chk small"><input type="checkbox" id="rRul"> Rulers</label><button class="btn sm" id="rReset" title="Right-click the chart to undo one zoom step">Reset zoom</button><button class="btn sm" id="rExp" title="Esc exits the expanded view">Expand chart</button></div><span class="note" id="rCtlNote"></span></div>' +
      '<div class="panel run-chart expand-target"><div class="pb"><div id="runChart" style="flex:1;min-height:0"></div></div></div>' +
      '<div class="run-bottom" id="runBottom">' +
      '<div class="panel"><div class="ph"><h3>Run values</h3></div><div class="pb" id="runValues"></div></div>' +
      '<div class="panel eng-only" id="pulsePanel"><div class="ph"><h3>Pulse</h3><span class="sp"></span><div class="seg sm" id="rPLog"><button data-v="0" class="on">Linear</button><button data-v="1">Log</button></div></div><div class="pb" style="padding:2px 4px"><div id="runPulse" style="height:100%"></div></div></div>' +
      '<div class="panel" id="logPanel"><div class="ph"><h3>Run log</h3><span class="sp"></span><select id="rLogF" class="small" style="height:22px" aria-label="Filter run log"><option value="all">All entries</option><option value="sensitivity">Sensitivity</option><option value="laser">Laser</option><option value="alignment">Alignment</option><option value="note">Notes and events</option><option value="card">Cards</option><option value="system">System</option></select></div><div class="pb log" id="runLog"></div></div>' +
      '<div class="panel" id="cardPanel"><div class="ph"><h3>Evidence</h3><span class="cnt" id="cardCnt">0</span></div><div class="pb" id="runCards"><div class="cards"></div></div></div>' +
      '</div>';
    UI.processingButton($('#rTools'));
    $('#rStart').onclick = start; $('#rPause').onclick = () => { M.pauseRun(S.run); UI.emitDirty(); };
    $('#rCont').onclick = () => { M.continueRun(S.run); UI.emitDirty(); };
    $('#rEnd').onclick = endRun; $('#rMark').onclick = () => noteDlg('event'); $('#rNote').onclick = () => noteDlg('note');
    $$('#rX button').forEach(b => b.onclick = () => { RC.view.x = b.dataset.v; syncSeg(); chart.resetZoom(); chart.invalidate(); UI.emitDirty('xmode'); });
    $$('#rLog button').forEach(b => b.onclick = () => { RC.view.log = b.dataset.v === '1'; syncSeg(); chart.invalidate(); });
    $$('#rPLog button').forEach(b => b.onclick = () => { pulseLog = b.dataset.v === '1'; $$('#rPLog button').forEach(x => x.classList.toggle('on', x === b)); pulseChart.invalidate(); });
    $('#rRul').onchange = e => { chart.rulersOn = e.target.checked; if (chart.rulersOn) { const R = S.run, xs = R && R.derivedN ? R.x[RC.sa() ? 'acq' : RC.view.x] : null, [a, b0] = chart.xRange(), b = xs ? Math.min(b0, xs[R.derivedN - 1]) : b0, h = Math.max((b - a) * 0.1, 20 * (b0 - a) / chart.pw), r0 = Math.max(a, (a + b) / 2 - h); chart.rulers = [r0, r0 + 2 * h]; } chart.invalidateOver(); chart.updateReadout(); };
    $('#rReset').onclick = () => chart.resetZoom();
    $('#rExp').onclick = toggleExpand;
    $('#rLogF').onchange = e => { logFilter = e.target.value; logN = -1; };
    chart = new CH.Chart($('#runChart'), {
      ariaLabel: 'Chromatogram with TRIFLE fluorescence and AKTA traces', rulers: [0, 1], rulerColor: C.v20,
      xDomain: RC.xDomain, xTitle: RC.xTitle, panels: RC.panels(), series: RC.seriesFor(), bands: RC.bands, fractions: RC.fracItems,
      markers: () => RC.markers(true), hatches: RC.hatches, intervals: RC.intervals, info: RC.info, rulerInfo: RC.rulerInfo, legendExtras: RC.legendExtras(),
      highlights: () => highlight ? [{ x0: RC.toX(highlight[0]), x1: RC.toX(highlight[1]) }] : []
    });
    pulseChart = new CH.Chart($('#runPulse'), {
      ariaLabel: 'Latest pulse', topBand: 12, marginRight: 8, marginLeft: 46, bottom: 32, liveReadout: false,
      xDomain: () => [0, 119.8], xTitle: () => 'ns from window start',
      panels: [{ key: 'main', yl: { title: 'Signal', unit: 'mV', log: () => pulseLog, zero: false, minLog: -2, minSpan: 0.5 } }],
      bands: () => { const b = [{ x0: 0, x1: 20, label: 'Baseline', fill: '#E8ECEF' }]; if (S.proc.window) b.push({ x0: 30, x1: 70, label: 'Window (Proposed)', fill: 'rgba(166,75,42,0.07)' }); return b; },
      series: [
        { key: 'wf', label: 'Pulse', tip: 'Waveform 10 of the latest block', color: C.v20, width: 1.25, panel: 'main', src: () => ({ x: pulse.x, y: pulseLog ? pulse.ly : pulse.y, n: pulse.n, gen: pulse.gen * 2 + (pulseLog ? 1 : 0) }), fmt: v => v.toFixed(2) + ' mV' },
        { key: 'irf', label: 'IRF', color: C.irf, dash: 'dash', width: 1, panel: 'main', src: () => ({ x: pulse.x, y: pulseLog ? pulse.liy : pulse.iy, n: pulse.n, gen: pulse.gen * 2 + (pulseLog ? 1 : 0) }), fmt: v => v.toFixed(2) + ' mV' }
      ]
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && expanded) toggleExpand(); });
    window.addEventListener('resize', layoutBottom);
    built = true; syncSeg(); layoutBottom();
    M.on(ev => { if (ev === 'proc' || ev === 'run' || ev === 'series' || ev === 'setup') { chart.cfg.panels = RC.panels(); chart.setSeries(RC.seriesFor()); chart.cfg.legendExtras = RC.legendExtras(); chart.buildLegend(); chart.relayout(); pulse.blk = -1; } if (ev === 'cards') cardsKey = ''; if (ev === 'notes') chart.invalidateBase(); if (ev === 'setup') syncSeg(); });
  }
  function layoutBottom() { const rb = $('#runBottom'); if (!rb) return; const w = rb.getBoundingClientRect().width; if (!w) return; const narrow = w < (S.engineer ? 1200 : 980); rb.classList.toggle('narrow', narrow); $('#cardPanel').style.display = narrow && narrowTab === 'log' ? 'none' : ''; $('#logPanel').style.display = narrow && narrowTab === 'cards' ? 'none' : ''; ensureTabs(narrow); }
  function ensureTabs(narrow) {
    for (const id of ['logPanel', 'cardPanel']) {
      const ph = $('#' + id + ' .ph'); let t = $('.ptabs', ph);
      if (narrow && !t) { t = el('<div class="ptabs"><button data-v="log">Run log</button><button data-v="cards">Evidence</button></div>'); ph.prepend(t); $$('button', t).forEach(b => b.onclick = () => { narrowTab = b.dataset.v; layoutBottom(); }); }
      if (!narrow && t) { t.remove(); t = null; }
      if (t) { $$('button', t).forEach(b => b.classList.toggle('on', b.dataset.v === narrowTab)); $('h3', ph).style.display = 'none'; } else $('h3', ph).style.display = '';
    }
  }
  function syncSeg() { $$('#rX button').forEach(b => { b.classList.toggle('on', b.dataset.v === RC.view.x && !RC.sa()); b.disabled = RC.sa(); }); $$('#rLog button').forEach(b => b.classList.toggle('on', (b.dataset.v === '1') === RC.view.log)); }
  function toggleExpand() { expanded = !expanded; $('#work').classList.toggle('expanded', expanded); $('#rExp').textContent = expanded ? 'Exit expanded (Esc)' : 'Expand chart'; $('#scr-run .run-top').classList.add('expand-target'); $('#scr-run .run-top').style.display = ''; setTimeout(() => chart.resize(), 0); }
  async function start() {
    const sm = M.readinessSummary(), pc = M.presetCheck();
    if (S.fault !== 'none') { await UI.modal('Cannot start', '<p>' + esc({ digitiser: 'Digitiser not found. Check the USB cable and power, then run the readiness checks again.', wheel: 'Filter wheel not responding. Check its cable and power, then run the readiness checks again.', laser: 'Laser not detected. Check the laser controller and the beam path.' }[S.fault]) + '</p>', [{ label: 'Close', primary: true }]); return; }
    if (!pc.ok) { await UI.modal('Preset mismatch', '<p>' + esc(pc.msg) + '</p><p>Choose a matching preset on Setup.</p>', [{ label: 'Close', primary: true }]); return; }
    if (!sm.ready) {
      if (S.demo.laserEarly && sm.canOverride) { if (!S.readiness.override) { S.readiness.override = { reason: 'Demo control: AKTA run started before the laser was stable.', by: S.setup.operator, t: S.simT }; M.audit('override', 'Readiness override recorded: ' + S.readiness.override.reason); } }
      else if (!(S.readiness && S.readiness.override && sm.canOverride)) return;
    }
    const R = M.newRun(); RC.view.x = R.standalone ? 'vol' : (RC.view.x || 'vol'); syncSeg(); chart.resetZoom(); UI.emitDirty();
  }
  async function endRun() {
    const R = S.run; if (!R || R.state === 'complete') return;
    const r = await UI.modal('End acquisition', '<p>End TRIFLE acquisition now? The AKTA run continues and the record is saved.</p>', [{ label: 'Cancel', value: false }, { label: 'End acquisition', value: true, primary: true }]);
    if (r.value) { M.finishRun(R, 'user'); UI.emitDirty(); }
  }
  function noteDlg(kind) {
    const R = S.run; if (!R) return; const at = R.acq.n - 1;
    const c = el('<form style="width:320px"><div style="font-weight:bold;margin-bottom:4px">' + (kind === 'note' ? 'Add note' : 'Mark event') + '</div><div class="small muted" style="margin-bottom:6px">At ' + (R.standalone ? fmt.min1((at >= 0 ? R.acq.t[at] : 0) / 60) + ' min' : fmt.ml(at >= 0 ? R.acq.u[at] : 0) + ' mL') + '.</div><div class="inl" style="display:flex;gap:6px"><input type="text" id="ntText" style="flex:1" placeholder="' + (kind === 'note' ? 'Note' : 'Event, for example sample change') + '"><button class="btn primary" type="submit">Add</button></div></form>');
    c.onsubmit = e => { e.preventDefault(); const t = $('#ntText', c).value.trim(); if (!t) return; M.addNote(R, kind, t, at); chart.invalidateBase(); UI.closePopover(); };
    UI.popover($(kind === 'note' ? '#rNote' : '#rMark'), c); setTimeout(() => $('#ntText', c).focus(), 0);
  }
  function controls() {
    const R = S.run, sm = M.readinessSummary(), st = R ? R.state : 'idle';
    const canStart = !R && S.fault === 'none' && M.presetCheck().ok && (sm.ready || (sm.canOverride && ((S.readiness && S.readiness.override) || S.demo.laserEarly)));
    $('#rStart').disabled = !canStart; $('#rPause').disabled = st !== 'acquiring'; $('#rCont').disabled = st !== 'paused';
    const live = st === 'acquiring' || st === 'paused'; $('#rStart').classList.toggle('hidden', !!R); $('#rPause').classList.toggle('hidden', st !== 'acquiring'); $('#rCont').classList.toggle('hidden', st !== 'paused'); for (const q of ['#rEnd', '#rMark', '#rNote', '#scr-run .scr-h .sep']) $(q).classList.toggle('hidden', !live); $('#rEnd').disabled = !(st === 'acquiring' || st === 'paused');
    $('#rMark').disabled = $('#rNote').disabled = !R || st === 'complete';
    let note = '';
    if (!R) note = sm.ready ? '' : canStart ? (S.readiness && S.readiness.override ? 'Override recorded. ' : 'Laser not yet stable. ') + 'I1 will flag early data.' : sm.text;
    else if (st === 'complete') note = R.standalone ? 'Open the Record next.' : 'Review the fractions next.';
    else if (UI.isFF()) note = 'Fast-forwarding.';
    const ne = $('#rCtlNote'); if (ne.textContent !== note) { ne.textContent = note; ne.title = note; }
  }
  function updPulse() {
    const R = S.run, A = R && R.acq; if (!A || !A.n) return;
    let i = A.n - 1; while (i > 0 && A.disc[i]) i--;
    if (pulse.blk === i || (UI.isFF() && pulse.blk >= 0 && i - pulse.blk < 600)) return; pulse.blk = i;
    const w = TR.regenBlock(A, i); if (!w.length) return; const v = w[9], b = TR.median(v, 0, 100);
    let mn = Infinity; for (let j = 0; j < 600; j++) { pulse.y[j] = v[j] * 1000; if (v[j] < mn) mn = v[j]; }
    const h = TR.shapeTable(R.pmt).h; let hm = 0; for (let j = 0; j < 600; j++) if (h[j] < hm) hm = h[j];
    for (let j = 0; j < 600; j++) { pulse.iy[j] = (h[j] / hm) * (mn - b) * 1000 + b * 1000; pulse.ly[j] = -(v[j] - b) * 1000; pulse.liy[j] = (h[j] / hm) * -(mn - b) * 1000; }
    pulse.n = 600; pulse.gen++;
    pulseChart.cfg.info = () => 'Block ' + fmt.int(i + 1) + ' · baseline ' + fmt.mv(b) + ' mV';
    pulseChart.invalidate();
  }
  function rangeBar(use, flag) {
    const u = Math.max(0, Math.min(1.05, use || 0)), over = use > TR.ACQ.limit;
    return '<div class="rbwrap">' + (flag || '') + '<div class="rangebar" title="Input range use: target 80 %, limit 90 %"><div class="fill' + (over ? ' over' : '') + '" style="width:' + (u / 1.05 * 100).toFixed(1) + '%"></div><div class="mk" style="left:' + (0.8 / 1.05 * 100).toFixed(1) + '%" title="Target 80 %"></div><div class="mk lim" style="left:' + (0.9 / 1.05 * 100).toFixed(1) + '%" title="Limit 90 %"></div></div><b>' + (isFinite(use) ? fmt.pct0(use) + ' %' : '–') + '</b></div>';
  }
  function runValues() {
    const R = S.run, box = $('#runValues');
    if (!R) { const h = '<div class="note">No run yet.</div>'; if (box._h !== h) { box.innerHTML = h; box._h = h; } return; }
    const A = R.acq, n = R.derivedN; let i = n - 1; while (i > 0 && A.disc[i]) i--;
    const tS = R.state === 'complete' ? R.endAt : M.runTimeS(R), tA = M.aktaMin(R, tS);
    const ph = tA < 0 ? null : R.ph.list[TR.phaseIdxAtTime(R.ph, tA)];
    const vp = TR.pumpVolAt(R.ph, Math.max(0, tA));
    const lad = TR.LADDERS[R.pmt], st = lad[A.cur - 1], al = M.alignmentState(), disc = A.disc.subarray(0, n).reduce((a, b) => a + b, 0);
    const sys = R.state === 'complete' ? 'Complete. Acquisition time ' + fmt.clock(R.endAt) + '.' : R.state === 'paused' ? (R.standalone ? 'Paused.' : 'Paused. The AKTA run continues.') : R.standalone ? 'Acquiring. ' + fmt.min1(tS / 60) + ' min in.' : (tA < 0 ? 'Acquiring buffer. AKTA run starts in ' + fmt.min1(-tA) + ' min.' : (tA > R.ph.totalMin ? 'Acquiring after the AKTA method ended.' : 'Acquiring. ' + ph.name + (ph.hold && tA >= ph.tPump ? ', hold, no flow' : ', ' + fmt.ml(vp - ph.v0) + ' mL in') + '.'));
    const row = (k2, u, v) => '<tr><td class="k">' + k2 + (u ? ' <span class="un">(' + u + ')</span>' : '') + '</td><td class="v">' + v + '</td></tr>';
    const fl = n && i >= 0 ? R.y.act[i] : NaN, use = n ? A.ruse[i] : NaN;
    const html = '<div class="sysstate">' + esc(sys) + '</div><table class="rv">' +
      row('Fluorescence', 'V·ns', fmt.sig3(fl)) +
      row('Sensitivity', '', '<span title="OD ' + st.nd + ', ' + st.range * 1000 + ' mV">' + A.cur + ' of ' + lad.length + '</span>') +
      row('Input range', '', rangeBar(use, use < S.th.lowPrec ? '<span class="flag w" title="Pulse under ' + Math.round(S.th.lowPrec * 100) + ' % of the input range (provisional)">Low precision</span>' : use > TR.ACQ.limit ? '<span class="flag f">Above 90 % limit</span>' : '')) +
      row('Blocks', '', fmt.int(n - disc) + ' (' + fmt.int(disc) + ' discarded)').replace('<tr>', '<tr class="eng-only">') +
      (R.setupSnap.beamPerBlock ? row('Beam monitor', '% of start', n ? fmt.pct1(A.bm[i] / (R.bmRef || A.bm[i])) : '–').replace('<tr>', '<tr class="eng-only">') : '') +
      (al.detector === 'n/a' ? '' : row('Alignment', '', esc(al.detector === 'Aligned' && al.fractions === 'Uncertain' ? 'Fractions uncertain' : al.detector))) + RC.runRows.map(f => f(R, i, row)).join('') + '</table>';
    if (box._h !== html) { box.innerHTML = html; box._h = html; }
  }
  const LOGTYPES = { sensitivity: 'Sens.', laser: 'Laser', alignment: 'Align.', note: 'Note', event: 'Event', card: 'Card', system: 'System' };
  function runLog() {
    const R = S.run, box = $('#runLog'); if (!R) { if (logN !== 0) { box.innerHTML = '<div class="note">No entries yet.</div>'; logN = 0; } return; }
    if (logN === R.log.length) return;
    const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 30;
    const start = logN <= 0 ? 0 : logN; if (logN <= 0) box.innerHTML = '';
    const frag = document.createDocumentFragment();
    for (let k = start; k < R.log.length; k++) {
      const e = R.log[k]; if (logFilter !== 'all' && !(e.type === logFilter || (logFilter === 'note' && e.type === 'event') || (logFilter === 'laser' && e.card && /I1|I4|I6/.test(e.text)))) continue;
      const d = el('<div class="log-e"><span class="t">' + e.wall + '</span><span><span class="k">' + (LOGTYPES[e.type] || e.type) + '</span>' + esc(e.short || e.text) + '</span></div>');
      if (e.x != null) { d.style.cursor = 'pointer'; d.title = (e.short ? e.text + ' ' : '') + 'Click to show on chart.'; d.onclick = () => showOnChart(e.x - 0.3, e.x + 0.3); }
      frag.append(d);
    }
    box.append(frag); logN = R.log.length;
    const none = box.querySelector(':scope > .note'); if (box.querySelector('.log-e')) { if (none) none.remove(); } else if (!none) box.innerHTML = '<div class="note">No entries of this type yet.</div>';
    if (atBottom || start === 0) box.scrollTop = box.scrollHeight;
  }
  function showOnChart(a, b) {
    const R = S.run; if (!R) return; if (b - a < 0.6) { const m = (a + b) / 2; a = m - 0.3; b = m + 0.3; }
    highlight = [a, b]; const pad = Math.max(1.5, (b - a) * 0.6);
    chart.setView([RC.toX(a - pad), RC.toX(b + pad)]); chart.invalidateOver();
    setTimeout(() => { highlight = null; chart.invalidateOver(); }, 6000);
  }
  function cardsHtml(cards, opts) {
    // group repeated cards of one rule within one phase; hypotheses follow their observation
    const groups = [], byKey = {};
    for (const c of cards) {
      if (c.linkedTo) continue;
      const key = c.rule + '|' + c.phase;
      if (byKey[key] && c.rule !== 'P2' && c.rule !== 'P3' && c.rule !== 'P4') byKey[key].items.push(c); else { const g = { key, items: [c] }; byKey[key] = g; groups.push(g); }
    }
    let html = '';
    for (const g of groups.slice().reverse()) {
      const c = g.items[g.items.length - 1], nOpen = g.items.filter(x => x.status === 'open').length;
      html += cardHtml(c, g.items.length > 1 ? g.items : null, nOpen, opts);
      for (const h of cards.filter(x => x.linkedTo && g.items.some(y => y.id === x.linkedTo))) html += cardHtml(h, null, h.status === 'open' ? 1 : 0, opts, true);
    }
    return html || '<div class="note">No evidence cards.</div>';
  }
  function cardHtml(c, group, nOpen, opts, linked) {
    const feats = (c.features || []).map(f => esc(f.name) + ' ' + tag(f.label, f.label === 'P' || f.label === 'F' ? 'always' : 'engineer')).join('; ');
    const resp = c.status !== 'open' ? '<span class="resp">' + (c.status === 'accepted' ? 'Accepted' : 'Dismissed') + ' by ' + esc(S.setup.operator) + (c.note ? ': ' + esc(c.note) : '') + '</span>' : '';
    const ids = group ? group.map(x => x.id) : [c.id], tx = s => (c.eng || []).reduce((h, e) => h.replace(esc(e), '<span class="eng-only">' + esc(e) + '</span>'), esc(s));
    return '<div class="ecard lv-' + c.level + (linked ? ' linked' : '') + (nOpen ? '' : ' done') + '" data-ids="' + ids.join(',') + '">' +
      '<div class="eh"><span class="rid" title="' + esc(M.ruleById(c.rule) ? M.ruleById(c.rule).cond(S.th) : '') + '">' + c.rule + '</span><span class="lvl">' + esc(c.levelName) + (c.linkedTo ? ', from ' + c.linkedTo.split('-')[0] : '') + '</span><span class="lvl">· ' + esc(c.phase) + '</span>' + (group ? '<span class="cnt" title="Repeated in this phase after the condition cleared">' + group.length + '×</span>' : '') + '</div>' +
      '<div>' + (c.obs && c.obs.indexOf(c.title) === 0 ? '<b>' + esc(c.title) + '</b>' + tx(c.obs.slice(c.title.length)) : '<b>' + esc(c.title) + '.</b> ' + tx(c.obs)) + '</div>' +
      (group ? '<div class="meta">Also at ' + group.slice(0, -1).map(x => S.run && S.run.standalone ? fmt.min1(x.x0) + ' min' : fmt.ml(x.x0) + ' mL').join(', ') + '.</div>' : '') +
      '<div class="meta">' + (c.fractions && c.fractions.length ? 'Fractions: ' + esc(M.rangeIds(c.fractions)) + ' · ' : '') + '<button class="link small" data-show="' + c.x0 + ',' + c.x1 + '">Show on chart</button> · Processing: ' + esc(c.mode) + (feats ? ' · Relies on: ' + feats : '') + '</div>' +
      (c.confirm ? '<div class="meta"><b>Suggested confirmation:</b> ' + esc(c.confirm) + '</div>' : '') + (c.action ? '<div class="meta"><b>Suggested action:</b> ' + tx(c.action) + '</div>' : '') +
      '<div class="acts">' + (nOpen ? '<input type="text" placeholder="Note (optional)" aria-label="Response note"><button class="btn sm" data-r="accepted">Accept</button><button class="btn sm" data-r="dismissed">Dismiss</button>' : resp) + '</div></div>';
  }
  function wireCards(box, rerender) {
    $$('[data-show]', box).forEach(b => b.onclick = () => { const [a, c] = b.dataset.show.split(',').map(Number); if (UI.cur() !== 'run' && rerender && rerender.show) rerender.show(a, c); else showOnChart(a, c); });
    $$('.ecard', box).forEach(cd => $$('[data-r]', cd).forEach(b => b.onclick = () => {
      const note = $('input', cd).value.trim(), ids = cd.dataset.ids.split(',');
      for (const c of S.run.rules.cards) if (ids.includes(c.id) && c.status === 'open') M.cardRespond(c, b.dataset.r, note);
    }));
  }
  function runCards() {
    const R = S.run, box = $('#runCards'); const cards = R ? R.rules.cards : [];
    const key = JSON.stringify(cards.map(c => [c.id, c.status, c.obs, c.fractions && c.fractions.length]));
    if (key === cardsKey) return; cardsKey = key;
    $('#cardCnt').textContent = cards.filter(c => c.status === 'open').length;
    const focused = document.activeElement && box.contains(document.activeElement) && document.activeElement.tagName === 'INPUT';
    if (focused) { cardsKey = ''; return; }
    box.innerHTML = '<div class="cards">' + cardsHtml(cards) + '</div>'; wireCards(box);
  }
  function update(d) {
    if (!built) build();
    if (engLaid !== S.engineer) { engLaid = S.engineer; layoutBottom(); }
    controls(); runValues(); runLog(); runCards(); updPulse(); UI.renderChips();
    if (d.all || d.xmode) { chart.invalidateBase(); }
    if (S.run) { if (S.run.acq.changes.length !== chart._nch || S.run.rules.cards.length !== chart._ncards) { chart._nch = S.run.acq.changes.length; chart._ncards = S.run.rules.cards.length; chart.invalidateBase(); } }
    chart.requestDraw();
  }
  UI.register('run', { show() { if (!built) build(); setTimeout(() => { chart.resize(); pulseChart.resize(); layoutBottom(); }, 0); logN = -1; cardsKey = ''; }, update, hide() { if (expanded) toggleExpand(); }, cardsHtml, wireCards, chart: () => chart });
})();
