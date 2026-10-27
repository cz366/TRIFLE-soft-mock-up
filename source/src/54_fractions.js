/* ---------- Fraction review (Validate, interpret and decide) ---------- */
(function () {
  const { $, $$, esc, el, tag } = UI, S = M.S, fmt = M.fmt, C = CH.C;
  let built = false, ov = null, zm = null, pc = null, rows = [], sel = new Set(), focus = null, sortKey = null, sortDir = 1, showShare = false, tab = 'frac', lastKey = '', flManual = null, dataKey = '', userPick = false, showMp = false;
  const mp = { x: new Float64Array(600), y: new Float64Array(600), iy: new Float64Array(600), n: 0, gen: 0 };
  for (let j = 0; j < 600; j++) mp.x[j] = j * 0.2;
  // Pool, the offline analyses, or no action (pool and analyses can combine; No action stands alone)
  const ANALYSES = [['pool', 'Pool', 'Include in the product pool'], ['sec', 'HPLC-SEC', 'Purity (monomer, HMWS, LMWS)'], ['lun', 'Lunatic', 'A280 concentration'], ['proa', 'Protein A HPLC', 'Titre'], ['none', 'No action', '']];
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
  function dec(id) { return S.decisions[id] || (S.decisions[id] = { pool: false, sec: false, lun: false, proa: false, none: false, note: '' }); }
  const decided = d => !!(d.pool || d.sec || d.lun || d.proa || d.none);
  function decText(d) { const a = ANALYSES.filter(x => d[x[0]]).map(x => x[1]); return a.length ? a.join(', ') : 'Not decided'; }
  function build() {
    const r = $('#scr-fractions'); r.classList.add('fixed'); r.style.overflow = 'auto';
    r.innerHTML = '<div class="scr-h"><h1>Fraction review</h1></div>' +
      '<div class="run-top"><div class="chips" id="frChips" style="display:none"><span>Ranges one setting larger (what-if)</span></div><div class="toolbar" id="fTools"><div class="seg sm" id="fX"><button data-v="min">min</button><button data-v="vol">mL</button><button data-v="cv">CV</button></div><div class="seg sm" id="fLog"><button data-v="0">Linear</button><button data-v="1">Log</button></div><span class="nowrap" style="display:inline-flex;align-items:center;gap:6px"><span class="lab">Drag to</span><div class="seg sm" id="fDrag"><button data-v="select" class="on">Select fractions</button><button data-v="zoom">Zoom</button></div></span><span id="fViewSlot"></span><button class="btn sm hidden" id="fReset">Reset zoom</button></div></div>' +
      '<div id="fEmpty" class="callout" style="display:none"></div>' +
      '<div class="fr-grid" id="frGrid" style="min-height:560px;grid-template-rows:minmax(0,56fr) minmax(0,44fr)">' +
      '<div class="panel" style="grid-column:1;grid-row:1"><div class="pb" style="padding:4px 8px"><div id="frOv" style="height:100%"></div></div></div>' +
      '<div class="panel fr-side" style="grid-column:2;grid-row:1"><div class="ph"><div class="ptabs" id="frTabs"><button data-v="frac" class="on">Fraction</button><button data-v="samples" title="The pool and the samples to send for offline analysis">Pool and samples <span class="cnt" id="sampCnt">0</span></button></div><span class="sp"></span><span id="frNav" class="nowrap"></span></div><div class="pb" style="padding:4px 8px;display:flex;flex-direction:column;gap:6px;overflow:hidden" id="frSide"></div></div>' +
      '<div class="panel fr-table" style="grid-column:1 / 3;grid-row:2"><div class="ph"><h3>Fractions</h3><span class="note" id="frNote"></span><span class="sp"></span><label class="chk small eng-only" title="Relative signal-area contribution only. Not equivalent to protein mass, yield or recovery."><input type="checkbox" id="frShare"> Fluorescence share</label><button class="btn sm" id="frApply" title="Copy each Suggested step into the Decision of fractions not yet decided. Each decision stays yours to change.">Apply suggestions</button></div><div class="pb tbl-wrap" style="padding:0" id="frTblWrap"><table class="tbl" id="frTbl"><thead></thead><tbody></tbody></table></div></div>' +
      '</div>';
    UI.processingButton($('#fTools')).classList.add('eng-only');
    RC.viewMenu($('#fViewSlot'), 'f', { get: () => !!(zm && zm.rulersOn), set: on => { zm.rulersOn = on; if (on) { const [a, b] = zm.xRange(); zm.rulers = [a + (b - a) * 0.4, a + (b - a) * 0.6]; } zm.invalidateOver(); zm.updateReadout(); } });
    $$('#fX button').forEach(b => b.onclick = () => { RC.view.x = b.dataset.v; sync(); ov.resetZoom(); ov.invalidate(); zoomTo(); UI.emitDirty('xmode'); });
    $$('#fLog button').forEach(b => b.onclick = () => { RC.view.log = b.dataset.v === '1'; sync(); ov.invalidate(); zm.invalidate(); });
    $$('#fDrag button').forEach(b => b.onclick = () => { ov.mode = b.dataset.v; $$('#fDrag button').forEach(x => x.classList.toggle('on', x === b)); });
    $('#fReset').onclick = () => ov.resetZoom();
    $('#frShare').onchange = e => { showShare = e.target.checked; lastKey = ''; };
    $('#frApply').onclick = applySuggestions;
    $$('#frTabs button').forEach(b => b.onclick = () => { tab = b.dataset.v; $$('#frTabs button').forEach(x => x.classList.toggle('on', x === b)); side(true); });
    ov = new CH.Chart($('#frOv'), {
      ariaLabel: 'Run overview; drag to select fractions', dragMode: 'select', rulers: [0, 1], onView: v => $('#fReset').classList.toggle('hidden', !v),
      xDomain: RC.xDomain, xTitle: RC.xTitle, panels: ovPanels(), series: ovSeries(), bands: RC.bands, fractions: RC.fracItems,
      markers: () => RC.markers(false), hatches: RC.hatches, intervals: RC.intervals, info: RC.info, legendExtras: RC.legendExtras(), liveReadout: false,
      tooltip: true, tipHead: RC.tipHead, tipExtra: RC.tipExtraAt, annotations: () => S.engineer && RC.annotations ? RC.annotations() : [], hoverInfo: () => S.engineer,
      vlines: () => poolLines(false).map(l => ({ ...l, label: null })),
      highlights: () => [...sel].map(id => fr(id)).filter(Boolean).map(f => ({ x0: RC.toX(f.a), x1: RC.toX(f.b) })),
      onSelect: (a, b) => { const va = RC.fromX(a), vb = RC.fromX(b); const hit = (S.run ? S.run.fractions : []).filter(f => (va === vb ? (va >= f.a && va < f.b) : (f.b > va && f.a < vb))).map(f => f.id); if (hit.length) { sel = new Set(hit); focus = hit[0]; selChanged(); } },
      onClick: x => { const v = RC.fromX(x), f = (S.run ? S.run.fractions : []).find(q => v >= q.a && v < q.b); if (f) { sel = new Set([f.id]); focus = f.id; selChanged(); } }
    });
    zm = new CH.Chart(el('<div style="height:100%"></div>'), mkZoomCfg());
    built = true; sync();
    M.on(ev => { if (ev === 'proc' || ev === 'run' || ev === 'series' || ev === 'lt') { ov.cfg.panels = ovPanels(); ov.setSeries(ovSeries()); zm.cfg.panels = zmPanels(); zm.setSeries(zmSeries()); ov.cfg.legendExtras = RC.legendExtras(); for (const c of [ov, zm]) { c.buildLegend(); c.relayout(); } lastKey = ''; mp.fid = null; } if (ev === 'cards' || ev === 'data') lastKey = ''; });
  }
  // overview: main panel, the decay map, UV 280 when the AKTA traces are on, and the strips that carry Proposed processing
  const OV = ['main', 'map', 'uv', 'bm', 'diff', 'decay'];
  function ovPanels() { return RC.panels().filter(p => OV.includes(p.key)); }
  function ovSeries() { return RC.seriesFor().filter(s => OV.includes(s.panel)); }
  function zmPanels() { return RC.panels().slice(0, 1).map(p => ({ ...p, yl: { ...p.yl, title: 'Fluor.', unit: 'V·ns' } })); }
  function zmSeries() { return RC.seriesFor().filter(s => s.panel === 'main').map(s => ({ ...s, legend: false })); }
  function mkZoomCfg() {
    return {
      ariaLabel: 'Selected fraction, zoomed', rulers: [0, 1], topBand: 28, marginRight: 50, liveReadout: false,
      xDomain: () => { const f = fr(focus); if (!f) return RC.xDomain(); const w = Math.max(f.b - f.a, 1.0) * 1.3; return [RC.toX(f.a - w), RC.toX(f.b + w)]; },
      xTitle: () => RC.XT[RC.view.x], panels: zmPanels(), series: zmSeries(), bands: RC.bands, fractions: RC.fracItems, info: RC.info, rulerInfo: RC.rulerInfo,
      highlights: () => { const f = fr(focus); if (!f) return []; const nb = (S.run.fractions || []).filter(q => q.id !== f.id && (Math.abs(q.a - f.b) < 1e-6 || Math.abs(q.b - f.a) < 1e-6)); return [...nb.map(q => ({ x0: RC.toX(q.a), x1: RC.toX(q.b), fill: 'rgba(91,102,112,0.08)', edge: false })), { x0: RC.toX(f.a), x1: RC.toX(f.b) }]; },
      vlines: () => poolLines(true),
      guides: () => flGuides()
    };
  }
  function fr(id) { return S.run ? S.run.fractions.find(f => f.id === id) : null; }
  // the UV pool and fluorescence boundary comparison uses AKTA data: shown with the AKTA traces or in Engineer view
  function cmpOn() { return S.engineer || RC.view.akta; }
  function poolLines(withFl) {
    const R = S.run; if (!R || R.setupSnap.source !== 'import' || !cmpOn()) return [];
    const p = M.uvPool(R), out = [];
    if (p) { out.push({ x: RC.toX(p.a), label: 'UV pool start', color: C.uv, dash: 'dash', row: 0 }); if (p.b != null) out.push({ x: RC.toX(p.b), label: 'UV pool end', color: C.uv, dash: 'dash', align: 'right', row: 0 }); }
    return out;
  }
  function flBounds() { const R = S.run; if (!R) return null; const b = M.flBounds(R, S.th.flPct); if (!b) return null; if (flManual) return { ...b, a: flManual[0] != null ? flManual[0] : b.a, b: flManual[1] != null ? flManual[1] : b.b, manual: true }; return b; }
  function flGuides() {
    const b = flBounds(); if (!b || !cmpOn()) return []; const col = M.procMode() === 'v20' ? C.v20 : C.prop, out = [];
    const mk = (k, v) => ({ id: 'fl' + k, x: RC.toX(v), color: col, dash: 'dot', label: 'Fl. ' + S.th.flPct + ' %', row: 1 + k, drag: x => { flManual = flManual || [null, null]; flManual[k] = RC.fromX(x); }, onEnd: () => { M.audit('fraction review', 'Fluorescence boundary ' + (k ? 'end' : 'start') + ' moved by hand to ' + fmt.ml(flManual[k]) + ' mL (visual comparison only).'); lastKey = ''; } });
    if (b.a != null) out.push(mk(0, b.a)); if (b.b != null) out.push(mk(1, b.b));
    return out;
  }
  function sync() { $$('#fX button').forEach(b => b.classList.toggle('on', b.dataset.v === RC.view.x)); $$('#fLog button').forEach(b => b.classList.toggle('on', (b.dataset.v === '1') === RC.view.log)); }
  function zoomTo() { if (!zm || !focus) return; zm.view = null; zm.zoomStack = []; zm.invalidate(); }
  function selChanged() { userPick = true; lastKey = ''; ov.invalidateOver(); zoomTo(); mp.fid = null; if (tab !== 'frac') { tab = 'frac'; $$('#frTabs button').forEach(x => x.classList.toggle('on', x.dataset.v === 'frac')); } side(true); }
  /* ---------- table ---------- */
  let lastFocus = null;
  const COLS = [
    { k: 'id', h: 'Fraction', v: f => f.id },
    { k: 'phase', h: 'Phase', v: f => f.phase },
    { k: 'a', h: 'Volume <span class="unit">(mL)</span>', num: true, v: f => f.a, f: f => fmt.ml(f.a) + '–' + fmt.ml(f.b) },
    { k: 'uvMean', h: 'UV 280 mean / max <span class="unit">(mAU)</span>', num: true, show: () => S.engineer || RC.view.akta, v: f => f.uvMean, f: f => fmt.mau(f.uvMean) + ' / ' + fmt.mau(f.uvMax) + (f.uvSat ? ' <span class="flag w" title="UV 280 at its 3,800 mAU ceiling">sat.</span>' : '') },
    { k: 'fMean', get h() { return 'Fluor. mean' + (S.engineer ? ' / max' : '') + ' <span class="unit">(V·ns)</span>'; }, num: true, v: f => f.fMean, f: f => fmt.sig3(f.fMean) + (S.engineer ? ' / ' + fmt.sig3(f.fMax) : '') },
    { k: 'qc', h: 'QC', wrap: true, show: () => S.engineer, v: f => f.chg + f.over + f.disc * 10 + f.laser * 10, f: f => qcFlags(f) },
    { k: 'share', h: 'Share <span class="unit">(%)</span>', num: true, opt: true, tip: 'Relative signal-area contribution only. Not equivalent to protein mass, yield or recovery.', v: f => f.share, f: f => isFinite(f.share) ? (f.share * 100).toFixed(1) : '–' },
    // Scientist view: the cards, plus the two checks that change how a fraction is read (assignment, partial)
    { k: 'cards', get h() { return S.engineer ? 'Cards' : 'Evidence'; }, wrap: true, v: f => f.linked.filter(UI.cardShown).length, f: f => f.linked.filter(UI.cardShown).join(', ') + (S.engineer ? '' : ' ' + sciFlags(f)) },
    { k: 'dec', h: 'Decision', v: f => decText(dec(f.id)), f: f => '<button class="btn sm decb" data-id="' + f.id + '" title="Choose offline analyses">' + esc(decText(dec(f.id))) + (dec(f.id).note ? ' *' : '') + '</button>' }
  ];
  function sciFlags(f) { return (f.assign === 'Uncertain' ? '<span class="flag w" title="' + esc(['Fraction assignment uncertain.', ...M.alignmentState().issues].join(' ')) + '">Uncertain</span>' : '') + (!f.complete && f.nBlocks ? '<span class="flag" title="Fraction not yet fully acquired">Partial</span>' : ''); }
  function qcFlags(f) {
    const out = [];
    if (f.chg) out.push('<span class="flag" title="' + plural(f.chg, 'sensitivity change', 'sensitivity changes') + ' inside the fraction">Sens. ×' + f.chg + '</span>');
    if (f.over) out.push('<span class="flag f" title="' + plural(f.over, 'waveform', 'waveforms') + ' above 90 % of the input range">Over ×' + f.over + '</span>');
    if (f.disc) out.push('<span class="flag w" title="' + plural(f.disc, 'discarded block', 'discarded blocks') + '">Disc. ×' + f.disc + '</span>');
    if (f.laser) out.push('<span class="flag w" title="Laser change flagged by I6 in this fraction">Laser</span>');
    if (f.lowShare > 0.5) out.push('<span class="flag w" title="' + Math.round(f.lowShare * 100) + ' % of blocks under ' + Math.round(S.th.lowPrec * 100) + ' % of the input range">Low prec.</span>');
    if (f.assign === 'Uncertain') out.push('<span class="flag w" title="' + esc(['Fraction assignment uncertain.', ...M.alignmentState().issues].join(' ')) + '">Uncertain</span>');
    if (!f.complete && f.nBlocks) out.push('<span class="flag" title="Fraction not yet fully acquired">Partial</span>');
    return out.join('');
  }
  function table() {
    const R = S.run; const cols = COLS.filter(c => (!c.opt || showShare) && (!c.show || c.show()));
    const key = JSON.stringify([R ? R.derivedN : 0, R ? R.dataGen : 0, R && R.lt ? R.lt.gen : 0, [...sel], sortKey, sortDir, showShare, COLS.map(c => c.show ? c.show() : 1), S.engineer, R ? R.rules.cards.length : 0, S.decisions, M.alignmentState().fractions, RC.view.x]);
    if (key === lastKey) return; lastKey = key;
    rows = R ? M.fractionStats(R) : [];
    if (sortKey) { const c = COLS.find(x => x.k === sortKey); rows.sort((a, b) => { const va = c.v(a), vb = c.v(b); return (va > vb ? 1 : va < vb ? -1 : 0) * sortDir; }); }
    $('#frTbl thead').innerHTML = '<tr>' + cols.map(c => '<th class="sortable' + (c.num ? ' num' : '') + '" data-k="' + c.k + '"' + (c.tip ? ' title="' + esc(c.tip) + '"' : '') + '>' + c.h.replace(/( <span class="unit">.*)?$/, (sortKey === c.k ? (sortDir > 0 ? ' ▲' : ' ▼') : '') + '$1') + '</th>').join('') + '</tr>';
    $('#frTbl tbody').innerHTML = rows.map(f => '<tr class="clickable' + (sel.has(f.id) ? ' sel' : '') + '" data-id="' + f.id + '">' + cols.map(c => '<td class="' + (c.num ? 'num' : c.wrap ? 'wrap' : '') + '">' + (c.f ? c.f(f) : esc(c.v(f))) + '</td>').join('') + '</tr>').join('') || '<tr><td colspan="12" class="muted">No fractions yet.</td></tr>';
    $$('#frTbl th').forEach(th => th.onclick = () => { if (sortKey === th.dataset.k) sortDir = -sortDir; else { sortKey = th.dataset.k; sortDir = 1; } lastKey = ''; });
    $$('#frTbl tbody tr[data-id]').forEach(tr => tr.onclick = e => {
      if (e.target.closest('.decb')) return; const id = tr.dataset.id;
      if (e.ctrlKey || e.metaKey) { if (sel.has(id)) sel.delete(id); else sel.add(id); }
      else if (e.shiftKey && focus) { const ids = rows.map(r => r.id), a = ids.indexOf(focus), b = ids.indexOf(id); sel = new Set(ids.slice(Math.min(a, b), Math.max(a, b) + 1)); }
      else sel = new Set([id]);
      focus = id; selChanged();
    });
    $$('.decb').forEach(b => b.onclick = e => { e.stopPropagation(); decisionPopover(b, b.dataset.id); });
    if (focus !== lastFocus) { lastFocus = focus; const w = $('#frTblWrap'), tr = $('#frTbl tbody tr[data-id="' + focus + '"]'); if (tr) { const r = tr.getBoundingClientRect(), wr = w.getBoundingClientRect(), hh = $('#frTbl thead').offsetHeight; if (r.top < wr.top + hh) w.scrollTop -= wr.top + hh - r.top; else if (r.bottom > wr.bottom) w.scrollTop += r.bottom - wr.bottom; } }
    const al = M.alignmentState();
    $('#frNote').innerHTML = R ? (rows.length + ' fractions · ' + (al.fractions === 'Uncertain' ? 'assignment uncertain' : 'volume-aligned<span class="eng-only"> (V1 ' + fmt.ml(S.setup.V1) + ' mL, V2 ' + fmt.ml(S.setup.V2) + ' mL)</span>')) : '';
    $('#sampCnt').textContent = Object.entries(S.decisions).filter(([k, d]) => d.sec || d.lun || d.proa).length;
  }
  // suggestions (Proposed) become decisions only for fractions the scientist has not decided
  function applySuggestions() {
    const R = S.run; if (!R || !window.LTUI) return; const done = [];
    for (const f of M.fractionStats(R)) { const g = LTUI.suggest(f); if (!g || g.k === 'buffer' || decided(dec(f.id))) continue; const d = dec(f.id); d[g.k] = true; done.push(f.id + ' ' + ANALYSES.find(a => a[0] === g.k)[1]); }
    M.audit('decision', done.length ? 'Suggestions applied (Proposed): ' + done.join(', ') + '.' : 'Suggestions applied: no undecided fraction had a suggestion.');
    lastKey = ''; side(true); UI.emitDirty();
  }
  function decisionPopover(anchor, id) {
    const d = dec(id), st = S.run && M.fractionStats(S.run).find(f => f.id === id), g = st && window.LTUI ? LTUI.suggest(st) : null;
    const c = el('<div style="width:300px"><div style="font-weight:bold;margin-bottom:4px">Decision for ' + esc(id) + '</div>' + (g && g.k !== 'buffer' ? '<div class="small sug-why"><span class="sug sug-' + g.k + '">' + esc(g.label) + '</span> suggested. ' + esc(g.why) + '</div>' : '') + ANALYSES.map(a => '<label class="opt" style="margin:3px 0"><input type="checkbox" data-a="' + a[0] + '"' + (d[a[0]] ? ' checked' : '') + '><span>' + a[1] + (a[2] ? '<span class="note">' + a[2] + '</span>' : '') + '</span></label>').join('') + '<input type="text" id="decNote" placeholder="Note (optional)" style="width:100%;margin-top:4px" value="' + esc(d.note) + '"></div>');
    $$('input[data-a]', c).forEach(i => i.onchange = () => {
      if (i.dataset.a === 'none' && i.checked) $$('input[data-a]', c).forEach(j => { if (j !== i) j.checked = false; });
      else if (i.checked) $('input[data-a=none]', c).checked = false;
      const before = decText(d); ANALYSES.forEach(a => d[a[0]] = $('input[data-a=' + a[0] + ']', c).checked);
      M.audit('decision', 'Decision for ' + id + ': ' + decText(d) + ' (was ' + before + ').'); lastKey = ''; side(true);
    });
    const ni = $('#decNote', c); ni.onchange = () => { d.note = ni.value.trim(); M.audit('decision', 'Decision note for ' + id + ': ' + (d.note || '(cleared)') + '.'); lastKey = ''; side(true); };
    UI.popover(anchor, c);
  }
  /* ---------- selected fraction and samples ---------- */
  let sideKey = '';
  function side(force) {
    const R = S.run, box = $('#frSide');
    const key = JSON.stringify([tab, focus, [...sel], S.decisions, R ? R.derivedN : 0, R && R.lt ? R.lt.gen : 0, S.engineer, RC.view.akta, R ? R.rules.cards.map(c => c.status) : 0, M.procLabel(), S.th.flPct, flManual, M.plumbing(), M.alignmentState().fractions]);
    if (!force && key === sideKey) return; sideKey = key;
    $('#frNav').innerHTML = tab === 'frac' && R && R.fractions.length ? '<label class="chk small eng-only" title="Median pulse of the fraction"><input type="checkbox" id="frMp"' + (showMp ? ' checked' : '') + '> Pulse</label> <button class="btn sm" id="frPrev" title="Previous fraction">Prev</button> <button class="btn sm" id="frNext" title="Next fraction">Next</button>' : '';
    const mpb = $('#frMp'); if (mpb) mpb.onchange = () => { showMp = mpb.checked; const g = $('.fr-detail-grid'); if (g) g.classList.toggle('show-mp', showMp); };
    if ($('#frPrev')) { const ids = R.fractions.map(f => f.id); $('#frPrev').onclick = () => { const i = Math.max(0, ids.indexOf(focus) - 1); focus = ids[i]; sel = new Set([focus]); selChanged(); }; $('#frNext').onclick = () => { const i = Math.min(ids.length - 1, ids.indexOf(focus) + 1); focus = ids[i]; sel = new Set([focus]); selChanged(); }; }
    if (tab === 'samples') { box.innerHTML = samplesHtml(); box.style.overflow = 'auto'; const cb = $('#sampCopy'); if (cb) cb.onclick = () => UI.copyText(samplesText(), cb); zm._mounted = false; return; }
    box.style.overflow = 'hidden';
    const f = fr(focus);
    if (!R || !f) { box.innerHTML = '<div class="note">Select a fraction in the table or drag across the chart.</div>'; zm._mounted = false; return; }
    const st = rows.find(r => r.id === f.id) || M.fractionStats(R).find(r => r.id === f.id), d = dec(f.id), b = flBounds(), pool = R.setupSnap.source === 'import' ? M.uvPool(R) : null;
    if (!zm._mounted) { box.innerHTML = '<div style="flex:1 1 0;min-height:150px" id="zmHost"></div><div class="fr-detail-grid' + (showMp ? ' show-mp' : '') + '" style="flex:0 1 auto;max-height:60%;min-height:0;display:grid"><div id="mpHost" class="eng-only" style="min-height:0"></div><div id="frDet" style="overflow:auto;font-size:13.5px;min-height:0"></div></div>'; $('#zmHost').append(zm.host); zm.resize(); zm._mounted = true; mountPulse(); }
    zm.invalidate();
    const cards = R.rules.cards.filter(c => c.fractions && c.fractions.includes(f.id) && UI.cardShown(c.rule));
    const shifted = Math.abs(st.ca - f.a) > 0.005 || Math.abs(st.cb - f.b) > 0.005, unc = st.assign === 'Uncertain';
    const sub = [shifted ? 'Collected liquid ' + fmt.ml(st.ca) + ' to ' + fmt.ml(st.cb) + ' mL' : '', unc ? '<span title="' + esc(M.alignmentState().issues.join(' ')) + '">Assignment uncertain</span>' : ''].filter(Boolean);
    const bnd = st.phaseKey !== (R.tpl.fractions.elPhase || 'el') || !(S.engineer || RC.view.akta) ? [] : [pool ? '<span title="UV 280 above 100 mAU">UV pool ' + fmt.ml(pool.a) + ' to ' + (pool.b != null ? fmt.ml(pool.b) : '…') + ' mL</span>' : '',
      b ? '<span title="Fluorescence ' + S.th.flPct + ' % of peak; visual comparison only">Fl. ' + S.th.flPct + ' % ' + (b.a != null ? fmt.ml(b.a) : '…') + ' to ' + (b.b != null ? fmt.ml(b.b) : '…') + ' mL' + (b.manual ? ', moved' : '') + '</span>' + (flManual ? ' <button class="link small" id="flAuto">Reset</button>' : '') : ''].filter(Boolean);
    // order: fraction, linked cards and decision, confirmations, then the visual boundary comparison for the zoom chart
    $('#frDet').innerHTML = '<div><b>' + f.id + '</b> · ' + esc(st.phase) + ' · ' + fmt.ml(f.a) + ' to ' + fmt.ml(f.b) + ' mL<span class="eng-only"> · ' + fmt.int(st.nBlocks) + ' blocks</span></div>' +
      (sub.length ? '<div class="muted">' + sub.join(' · ') + '</div>' : '') +
      (st.lt ? '<div title="' + esc(LTUI.LTIP) + '"><b>Species</b> ' + LTUI.compCell(st.lt.comps, 90, 4) + (LTUI.background(st.lt.comps) ? '' : ' <span class="muted small">share of fluorescence</span>') + '</div>' : '') +
      (() => { const g = st.lt ? LTUI.suggest(st) : null; return g && g.k !== 'buffer' ? '<div><b>Suggested</b> <span class="sug sug-' + g.k + '">' + esc(g.label) + '</span> <span class="muted small">' + esc(g.why) + '</span></div>' : ''; })() +
      '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:4px 14px">' + (cards.length ? '<span><b>' + (S.engineer ? 'Linked cards' : 'Evidence') + '</b> ' + cards.map(c => '<span class="flag" title="' + esc(c.obs && c.obs.indexOf(c.title) === 0 ? c.obs : c.title + (c.obs ? '. ' + c.obs : '')) + '">' + c.rule + (c.status !== 'open' ? ' ' + c.status : '') + '</span>').join('') + '</span>' : '') +
      '<span><b>Decision</b> <button class="btn sm" id="frDec">' + esc(decText(d)) + '</button></span></div>' + (d.note ? '<div class="small">Note: ' + esc(d.note) + '</div>' : '') +
      (cards.filter(c => c.confirm).map(c => '<div class="small">' + c.rule + ': ' + esc(c.confirm) + '</div>').join('')) +
      (bnd.length ? '<div class="muted">' + bnd.join(' · ') + '</div>' : '');
    $('#frDec').onclick = () => decisionPopover($('#frDec'), f.id);
    const fa = $('#flAuto'); if (fa) fa.onclick = () => { flManual = null; M.audit('fraction review', 'Fluorescence boundaries reset to automatic.'); zm.invalidate(); side(true); };
    updMedianPulse(f);
  }
  function mountPulse() {
    if (pc) pc.destroy();
    pc = new CH.Chart($('#mpHost'), {
      ariaLabel: 'Median pulse of the fraction', topBand: 6, marginLeft: 60, marginRight: 8, bottom: 36, liveReadout: false,
      xDomain: () => [20, 90], xTitle: () => 'ns from window start', zoom: false,
      panels: [{ key: 'main', yl: { title: 'Pulse', unit: 'V', zero: false } }],
      series: [{ key: 'mp', label: 'Median pulse', legend: false, color: M.procMode() === 'v20' ? C.v20 : C.prop, width: 1.25, panel: 'main', src: () => ({ x: mp.x, y: mp.y, n: mp.n, gen: mp.gen }), fmt: v => fmt.sig3(v) + ' V' }, { key: 'irf', label: 'IRF', legend: false, color: C.irf, dash: 'dash', width: 1, panel: 'main', src: () => ({ x: mp.x, y: mp.iy, n: mp.n, gen: mp.gen }), fmt: v => fmt.sig3(v) + ' V' }]
    });
  }
  function updMedianPulse(f) {
    const R = S.run; if (!R || mp.fid === f.id) return; mp.fid = f.id;
    const st = rows.find(r => r.id === f.id); const [ca, cb] = TR.collectedRange(f, M.plumbing()); const A = R.acq;
    const i0 = TR.lowerBound(A.u, R.derivedN, ca), i1 = TR.lowerBound(A.u, R.derivedN, cb), idx = [];
    const stepN = Math.max(1, Math.floor((i1 - i0) / 40)); for (let i = i0; i < i1; i += stepN) if (!A.disc[i]) idx.push(i);
    if (!idx.length) { mp.n = 0; mp.gen++; pc.invalidate(); return; }
    const waves = [];
    for (const i of idx) { const T = TR.T_of(TR.LADDERS[R.pmt][A.step[i] - 1].nd); for (const v of TR.regenBlock(R.acq, i)) { const b = TR.median(v, 0, 100), u = new Float64Array(600); for (let j = 0; j < 600; j++) u[j] = (v[j] - b) / T; waves.push(u); } }
    const col = new Float64Array(waves.length);
    for (let j = 0; j < 600; j++) { for (let k = 0; k < waves.length; k++) col[k] = waves[k][j]; mp.y[j] = TR.median(col, 0, waves.length); }
    const h = TR.shapeTable(R.pmt).h; let hm = 0, mn = 0; for (let j = 0; j < 600; j++) { if (h[j] < hm) hm = h[j]; if (mp.y[j] < mn) mn = mp.y[j]; }
    for (let j = 0; j < 600; j++) mp.iy[j] = h[j] / hm * mn;
    mp.n = 600; mp.gen++; pc.cfg.info = () => 'Median of ' + fmt.int(idx.length) + ' of ' + fmt.int(i1 - i0) + ' blocks · dashed: IRF';
    pc.series[0].color = M.procMode() === 'v20' ? C.v20 : C.prop; pc.invalidate();
  }
  function picked(k) { return Object.entries(S.decisions).filter(([id, d]) => d[k]).map(([id]) => id).sort(); }
  function samplesText() {
    const out = [];
    for (const [k, name] of ANALYSES.slice(0, 4)) { const ids = picked(k); if (ids.length) out.push(name + ': ' + ids.map(id => id + (S.decisions[id].note ? ' [' + S.decisions[id].note + ']' : '')).join(', ')); }
    const none = picked('none'); if (none.length) out.push('No action: ' + none.join(', '));
    return out.join('\n') || 'No samples selected yet.';
  }
  function samplesHtml() {
    const R = S.run, total = R ? R.fractions.length : 0, nDecided = Object.values(S.decisions).filter(decided).length;
    let html = '';
    for (const [k, name, what] of ANALYSES.slice(0, 4)) {
      const ids = picked(k); if (!ids.length) continue;
      html += '<div style="margin-top:8px"><b>' + name + '</b> <span class="muted small">' + what + '</span><div>' + ids.map(id => { const f = fr(id); return '<div class="small">' + id + (f ? ' · ' + fmt.ml(f.a) + ' to ' + fmt.ml(f.b) + ' mL' : '') + (S.decisions[id].note ? ' · ' + esc(S.decisions[id].note) : '') + '</div>'; }).join('') + '</div></div>';
    }
    const none = picked('none');
    if (none.length) html += '<div style="margin-top:8px"><b>No action</b><div class="small">' + none.join(', ') + '</div></div>';
    if (!html) html = '<div class="small muted">No samples selected yet.</div>';
    html += '<div style="margin-top:8px" class="small muted">' + nDecided + ' of ' + total + ' fractions decided.</div><div><button class="btn sm" id="sampCopy" style="margin-top:6px">Copy list</button></div>';
    return html;
  }
  function update(d) {
    if (!built) build();
    const R = S.run, empty = $('#fEmpty');
    if (!R) { empty.style.display = ''; empty.textContent = 'No run yet. Start a run on the Run screen.'; }
    else if (R.setupSnap.source === 'standalone') { empty.style.display = ''; empty.textContent = 'Standalone TRIFLE: no chromatography data, so no fractions.'; }
    else empty.style.display = 'none';
    $('#scr-fractions').classList.toggle('fr-none', !R || R.setupSnap.source === 'standalone');
    const wi = $('#frChips'), shift = (R ? R.setupSnap.rangeMap : S.setup.rangeMap) === 'shift'; if (wi.style.display !== (shift ? '' : 'none')) wi.style.display = shift ? '' : 'none';
    if (R && !focus && R.fractions.length) { const e = R.fractions.find(f => f.phaseKey === (R.tpl.fractions.elPhase || 'el')) || R.fractions[0]; const st = M.fractionStats(R); const best = st.filter(x => x.phaseKey === e.phaseKey && x.complete).sort((a, b) => b.fMax - a.fMax)[0]; focus = (best || e).id; sel = new Set([focus]); }
    table(); if (R && !userPick) { const best = rows.filter(x => x.phaseKey === (R.tpl.fractions.elPhase || 'el') && x.complete).sort((a, b) => b.fMax - a.fMax)[0]; if (best && best.id !== focus) { focus = best.id; sel = new Set([focus]); lastKey = ''; sideKey = ''; zoomTo(); mp.fid = null; table(); } } side(false);
    if (d.all || d.xmode) { ov.invalidateBase(); zm.invalidateBase(); }
    ov.requestDraw(); if (zm._mounted) zm.requestDraw();
  }
  UI.register('fractions', {
    show(o) { if (!built) build(); sync(); setTimeout(() => { ov.resize(); if (zm._mounted) zm.resize(); if (pc) pc.resize(); }, 0); lastKey = ''; sideKey = ''; zm._mounted = false; tab = o && o.anchor === 'samples' ? 'samples' : 'frac'; $$('#frTabs button').forEach(x => x.classList.toggle('on', x.dataset.v === tab)); table(); side(true); },
    update, samplesText, select(id) { focus = id; sel = new Set([id]); selChanged(); },
    // a beforeKey that no longer exists (the Assignment column was removed) inserts before Cards, so Decision stays last
    addCol(col, beforeKey) { let k = COLS.findIndex(c => c.k === beforeKey); if (k < 0) k = COLS.findIndex(c => c.k === 'cards'); COLS.splice(k < 0 ? COLS.length : k, 0, col); lastKey = ''; },
    refresh() { lastKey = ''; sideKey = ''; }
  });
})();
