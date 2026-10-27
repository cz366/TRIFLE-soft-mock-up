/* ---------- shared chromatogram configuration (Run and Fraction review) ---------- */
const RC = (function () {
  const S = M.S, fmt = M.fmt, C = CH.C, { esc } = UI;
  // TRIFLE view by default: time axis, the species chromatogram and the decay map of the whole run. The AKTA traces
  // (which belong to UNICORN) are one click away in the View menu.
  const view = { x: 'min', log: false, akta: false, map: true };
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
    const p = M.procMode(), lc = S.proc.laser, cmp = S.proc.compare, r = R(), bmOn = r ? r.setupSnap.beamPerBlock : S.setup.beamPerBlock, imp = (r ? r.setupSnap.source : S.setup.source) === 'import', ak = imp && view.akta;
    const ff = v => fmt.sig3(v) + ' V·ns', tot = 'Total fluorescence';
    // total fluorescence in primary ink, like the species it is the sum of; UV 280 has its own strip (one y axis per panel)
    const list = [
      { key: 'v20', label: tot + (p === 'v20' && !cmp ? '' : ', v2.0 reference'), tip: 'Total fluorescence, ND-corrected: the integral of each pulse (v2.0 reference processing)', color: C.text, width: 2, z: 2, panel: 'main', src: trifle('v20'), fmt: ff, visible: p === 'v20' || cmp, shade: S.engineer },
      { key: 'prop', label: tot + ', Proposed' + (lc ? ' (corrected)' : ''), color: C.text, dash: 'dash', width: 2, z: 2, panel: 'main', src: trifle('prop'), fmt: ff, visible: p === 'prop', legend: p === 'prop' },
      { key: 'propU', label: tot + ', Proposed, uncorrected', color: C.cond, width: 0.9, panel: 'main', src: trifle('propU'), fmt: ff, visible: p === 'prop' && lc, legend: p === 'prop' && lc },
      { key: 'uv', label: 'UV 280', color: C.uv, width: 1.25, panel: 'uv', src: akta('uv'), fmt: v => fmt.mau(v) + ' mAU', visible: ak, legend: ak },
      { key: 'cond', label: 'Conductivity', color: C.cond, width: 1, panel: 'cond', src: akta('cond'), fmt: v => fmt.cond(v) + ' mS/cm', visible: ak, legend: ak },
      { key: 'ph', label: 'pH', color: C.ph, width: 1, panel: 'ph', src: akta('ph'), fmt: v => fmt.ph(v), visible: ak, legend: ak },
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
    const imp = () => (r() ? r().setupSnap.source : S.setup.source) === 'import', ak = () => imp() && view.akta;
    const out = [
      // scientist view: the axis spans at least 0.2 V·ns, so buffer reads as a flat line near zero, not as magnified noise
      { key: 'main', yl: { title: 'Fluorescence', unit: S.engineer ? 'V·ns, ND-corrected' : 'V·ns', log: () => view.log, minLog: -3, minTop: () => S.engineer ? null : 0.2 } },
      { key: 'map', px: 64, hidden: () => !view.map || !(r() && r().acq.dw), yl: { title: 'Decay map', short: 'Decay map', unit: 'ns', fixed: [0, 30], zero: false, tickFmt: v => v.toFixed(0) }, draw: mapDraw },
      { key: 'uv', px: 46, hidden: () => !ak(), yl: { title: 'UV 280', short: 'UV 280', unit: 'mAU', fixed: [0, 4000], tickFmt: v => v.toFixed(0) } },
      { key: 'cond', px: 46, hidden: () => !ak(), yl: { title: 'Conductivity', short: 'Cond.', unit: 'mS/cm', fixed: [0, 100], tickFmt: v => v.toFixed(0) } },
      { key: 'ph', px: 46, hidden: () => !ak(), yl: { title: 'pH', short: 'pH', unit: '', fixed: [0, 14] } },
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
    return r.rules.cards.filter(c => c.rule === 'I6' || (c.rule === 'I1' && c.x1 > c.x0)).map(c => ({ x0: toX(c.x0), x1: toX(c.x1), label: c.rule === 'I6' ? 'I6 laser change' : 'I1 warm-up', color: C.warn }))
      .concat(api.coelution ? api.coelution() : []);
  }
  // nearest block to a chart x; the tooltip heading names the time, volume and fraction there
  function idxAt(x) { const r = R(); if (!r || !r.derivedN || x == null) return null; const xs = r.x[sa() ? 'acq' : view.x], n = r.derivedN; let i = Math.min(n - 1, TR.lowerBound(xs, n, x)); if (i > 0 && Math.abs(xs[i - 1] - x) <= Math.abs(xs[i] - x)) i--; return i; }
  function tipHead(x) {
    const r = R(); if (!r || x == null) return ''; if (sa()) return fmt.min1(x) + ' min from TRIFLE start';
    const v = fromX(x), t = view.x === 'min' ? x : TR.timeAtVol(r.ph, v), f = r.fractions.find(q => v >= q.a && v < q.b);
    return fmt.min1(t) + ' min · ' + fmt.ml(v) + ' mL' + (f ? ' · ' + f.id : '');
  }
  function tipExtraAt(x) { return api.tipExtra ? api.tipExtra(idxAt(x)) : ''; }
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
  /* ---------- decay map: every block's decay, normalised per pixel column, log intensity ---------- */
  // Sequential blue ramp (one hue, light to dark); the lightest step recedes to the white chart surface.
  // A sample below 3 SD of its column's noise is white, and a column fades towards white when its peak is near
  // the noise, so low-signal phases do not look like data. Zoomed in, a column between blocks shows the nearest.
  const LUT = (() => { const st = ['#FFFFFF', '#CDE2FB', '#9EC5F4', '#6DA7EC', '#3987E5', '#256ABF', '#184F95', '#0D366B'].map(h => [1, 3, 5].map(k => parseInt(h.substr(k, 2), 16))), out = new Uint8ClampedArray(256 * 3);
    for (let i = 0; i < 256; i++) { const t = i / 255 * (st.length - 1), k = Math.min(st.length - 2, Math.floor(t)), f = t - k; for (let c = 0; c < 3; c++) out[i * 3 + c] = Math.round(st[k][c] * (1 - f) + st[k + 1][c] * f); }
    return out; })();
  const MAP_NS = 30, MAP_DECADES = 2.5, mapY = new Float64Array(TR.LTN);
  function mapDraw(ctx, p, ch, c0, c1) {
    const r = R(); if (!r || !r.acq.dw) return;
    const A = r.acq, n = r.derivedN, xs = r.x[sa() ? 'acq' : view.x], L = TR.LTN, w = Math.max(1, Math.floor(p.w)), h = Math.max(1, Math.floor(p.h));
    let m = ch._map; if (!m || m.w !== w || m.h !== h) { const off = document.createElement('canvas'); off.width = w; off.height = h; m = ch._map = { w, h, off, octx: off.getContext('2d'), img: new ImageData(w, h) }; }
    const img = m.img.data; c1 = Math.min(c1, w - 1); if (c1 < c0) return;
    for (let c = c0; c <= c1; c++) {
      const xa = ch.pxToX(p.x + c), xb = ch.pxToX(p.x + c + 1); let ia = TR.lowerBound(xs, n, xa), ib = TR.lowerBound(xs, n, xb);
      if (ib === ia && ia > 0 && ia < n) { const xm = (xa + xb) / 2; if (xm - xs[ia - 1] < xs[ia] - xm) ia--; ib = ia + 1; }
      // only discarded or clipped blocks here: use the nearest usable block within 10 blocks
      if (ib > ia && ib - ia <= 10) { let ok = false; for (let i = ia; i < ib; i++) if (!A.disc[i] && !A.clip[i]) { ok = true; break; } if (!ok) for (let d = 1; d <= 10; d++) { if (ib - 1 + d < n && !A.disc[ib - 1 + d] && !A.clip[ib - 1 + d]) { ia = ib - 1 + d; ib = ia + 1; break; } if (ia - d >= 0 && !A.disc[ia - d] && !A.clip[ia - d]) { ia -= d; ib = ia + 1; break; } } }
      mapY.fill(0); let cnt = 0, v2 = 0;
      for (let i = ia; i < ib; i++) { if (A.disc[i] || A.clip[i]) continue; const o = i * L; for (let s = 0; s < L; s++) mapY[s] += A.dw[o + s]; v2 += A.dsd[i] * A.dsd[i]; cnt++; }
      let mx = 0; for (let s = 0; s < L; s++) if (mapY[s] > mx) mx = mapY[s];
      const sd = Math.sqrt(v2), conf = cnt && mx > 0 ? Math.min(1, Math.max(0, (mx / sd - 4) / 20)) : 0;
      for (let row = 0; row < h; row++) {
        const k = (row * w + c) * 4; let t = 0;
        if (conf > 0) { const s = Math.min(L - 1, Math.round((1 - (row + 0.5) / h) * MAP_NS / TR.DX)), v = mapY[s] / mx; t = mapY[s] > 3 * sd ? Math.min(1, Math.max(0, 1 + Math.log10(v) / MAP_DECADES)) * conf : 0; }
        const q = Math.round(t * 255) * 3; img[k] = LUT[q]; img[k + 1] = LUT[q + 1]; img[k + 2] = LUT[q + 2]; img[k + 3] = 255;
      }
    }
    m.octx.putImageData(m.img, 0, 0, c0, 0, c1 - c0 + 1, h);
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(m.off, c0, 0, c1 - c0 + 1, h, p.x + c0, p.y, c1 - c0 + 1, h); ctx.restore();
  }
  function legendExtras() { if (!S.engineer) return []; return [{ html: '<span class="ch-sw box" style="background:rgba(183,121,31,0.12);border:1px solid rgba(183,121,31,0.5)"></span><span class="ch-ll">Low precision</span>', tip: 'Pulse fills under ' + Math.round(S.th.lowPrec * 100) + ' % of the input range (provisional). Not used for the y-axis autoscale; values beyond the axis are marked at its edge.' }]; }
  function xTitle() { return sa() ? 'Time from TRIFLE start (min)' : XT[view.x]; }
  // View menu shared by Run and Fraction review: optional layers and tools, kept off the toolbar.
  // rul: { get, set } for the screen's rulers. The button shows how many options are on.
  function viewMenu(host, id, rul) {
    const b = UI.el('<button class="btn sm" id="' + id + 'View" title="Decay map, AKTA traces and rulers">View <span class="vm-n"></span>▾</button>');
    const count = () => { const n = (view.map ? 1 : 0) + (view.akta ? 1 : 0) + (rul.get() ? 1 : 0); UI.$('.vm-n', b).textContent = n ? '(' + n + ') ' : ''; };
    b.onclick = () => {
      const c = UI.el('<div class="view-menu"><label class="opt"><input type="checkbox" id="' + id + 'Map" data-vk="map"><span>Decay map<span class="note">Every decay against time, normalised per column</span></span></label>' +
        '<label class="opt"><input type="checkbox" id="' + id + 'Ak" data-vk="akta"><span>AKTA traces<span class="note">UV 280, conductivity, pH and fraction cuts from UNICORN</span></span></label>' +
        '<label class="opt"><input type="checkbox" id="' + id + 'Rul"><span>Rulers<span class="note">Two draggable lines with the interval between them</span></span></label></div>');
      UI.$$('input[data-vk]', c).forEach(cb => { cb.checked = !!view[cb.dataset.vk]; cb.onchange = () => { view[cb.dataset.vk] = cb.checked; count(); M.emit('series'); UI.emitDirty(); }; });
      const r = UI.$('#' + id + 'Rul', c); r.checked = !!rul.get(); r.onchange = () => { rul.set(r.checked); count(); };
      UI.popover(b, c);
    };
    host.append(b); count(); M.on(ev => { if (ev === 'series') count(); });
    return b;
  }
  // annotations (detected peaks), coelution and tipExtra (by block) are supplied by the lifetime analysis UI
  const api = { extraSeries, extraPanels, extraInfo, runRows, view, XT, xTitle, sa, toX, fromX, xDomain, bands, fracItems, trifle, akta, seriesFor, panels, markers, hatches, intervals, info, rulerInfo, legendExtras, mapDraw, viewMenu, idxAt, tipHead, tipExtraAt, annotations: null, coelution: null, tipExtra: null };
  return api;
})();

/* ---------- Run (Acquire and Validate) ---------- */
(function () {
  const { $, $$, esc, el, tag } = UI, S = M.S, fmt = M.fmt, C = CH.C;
  let chart = null, pulseChart = null, built = false, engLaid = null, logFilter = 'all', logN = 0, cardsKey = '', pulseLog = false, highlight = null, expanded = false, narrowTab = 'log';
  // Decay panel: the block under the cursor, else the pinned block, else the latest (live) or the fluorescence maximum (complete)
  let decChart = null, decPane = 'decay', pin = null, hov = null, decKey = '', decAt = 0, decSer = '', apex = { gen: -1, i: -1 };
  const LTN = TR.LTN, dec = { x: new Float64Array(LTN), y: new Float64Array(LTN), f: new Float64Array(LTN), r: new Float64Array(LTN), c: [], n: 0, gen: 0, d: null };
  for (let s = 0; s < LTN; s++) dec.x[s] = s * TR.DX;
  const pulse = { x: new Float64Array(600), y: new Float64Array(600), ly: new Float64Array(600), iy: new Float64Array(600), liy: new Float64Array(600), n: 0, gen: 0, blk: -1 };
  for (let j = 0; j < 600; j++) pulse.x[j] = j * 0.2;
  function build() {
    const r = $('#scr-run'); r.classList.add('fixed');
    r.innerHTML = '<div class="scr-h"><h1>Run</h1><div class="chips acq-chips eng-only"></div><span class="sp"></span>' +
      '<button class="btn primary" id="rStart">Start</button><button class="btn" id="rPause">Pause</button><button class="btn" id="rCont">Continue</button><button class="btn" id="rEnd">End</button><span class="sep"></span><button class="btn" id="rMark">Mark event</button><button class="btn" id="rNote">Add note</button></div>' +
      '<div class="run-top">' +
      '<div class="toolbar" id="rTools"><div class="seg sm" id="rX" role="group" aria-label="X-axis units"><button data-v="min">min</button><button data-v="vol">mL</button><button data-v="cv">CV</button></div><div class="seg sm" id="rLog"><button data-v="0">Linear</button><button data-v="1">Log</button></div><span id="rViewSlot"></span><button class="btn sm hidden" id="rReset" title="Right-click the chart to undo one zoom step">Reset zoom</button><button class="btn sm" id="rExp" title="Esc exits the expanded view">Expand chart</button></div><span class="note" id="rCtlNote"></span></div>' +
      '<div class="panel run-chart expand-target"><div class="pb"><div id="runChart" style="flex:1;min-height:0"></div></div></div>' +
      '<div class="run-bottom" id="runBottom">' +
      '<div class="panel"><div class="ph"><h3>Run values</h3></div><div class="pb" id="runValues"></div></div>' +
      '<div class="panel" id="decPanel"><div class="ph"><h3>Decay</h3><span class="note" id="decWhen"></span><span class="sp"></span><button class="btn sm" id="decLatest" style="display:none" title="Follow the latest block again">Latest</button><div class="seg sm eng-only" id="rDecV" title="Species decay or the raw pulse"><button data-v="decay" class="on">Decay</button><button data-v="pulse">Pulse</button></div><div class="seg sm" id="rPLog"><button data-v="0" class="on">Linear</button><button data-v="1">Log</button></div></div><div class="pb" style="padding:2px 4px;overflow:hidden"><div id="runDecay" style="height:100%"></div><div id="runPulse" style="height:100%;display:none"></div></div></div>' +
      '<div class="panel eng-only" id="logPanel"><div class="ph"><h3>Run log</h3><span class="sp"></span><select id="rLogF" class="small" style="height:22px" aria-label="Filter run log"><option value="all">All entries</option><option value="sensitivity">Sensitivity</option><option value="laser">Laser</option><option value="alignment">Alignment</option><option value="note">Notes and events</option><option value="card">Cards</option><option value="system">System</option></select></div><div class="pb log" id="runLog"></div></div>' +
      '<div class="panel" id="cardPanel"><div class="ph"><h3>Evidence</h3><span class="cnt" id="cardCnt">0</span></div><div class="pb" id="runCards"><div class="cards"></div></div></div>' +
      '</div>';
    UI.processingButton($('#rTools')).classList.add('eng-only');
    RC.viewMenu($('#rViewSlot'), 'r', { get: () => !!(chart && chart.rulersOn), set: setRulers });
    $('#rStart').onclick = start; $('#rPause').onclick = () => { M.pauseRun(S.run); UI.emitDirty(); };
    $('#rCont').onclick = () => { M.continueRun(S.run); UI.emitDirty(); };
    $('#rEnd').onclick = endRun; $('#rMark').onclick = () => noteDlg('event'); $('#rNote').onclick = () => noteDlg('note');
    $$('#rX button').forEach(b => b.onclick = () => { RC.view.x = b.dataset.v; syncSeg(); chart.resetZoom(); chart.invalidate(); UI.emitDirty('xmode'); });
    $$('#rLog button').forEach(b => b.onclick = () => { RC.view.log = b.dataset.v === '1'; syncSeg(); chart.invalidate(); });
    $$('#rPLog button').forEach(b => b.onclick = () => { pulseLog = b.dataset.v === '1'; $$('#rPLog button').forEach(x => x.classList.toggle('on', x === b)); pulseChart.invalidate(); decKey = ''; });
    $$('#rDecV button').forEach(b => b.onclick = () => { decPane = b.dataset.v; showPane(); });
    $('#decLatest').onclick = () => { pin = null; chart.invalidateBase(); decKey = ''; };
    $('#rReset').onclick = () => chart.resetZoom();
    $('#rExp').onclick = toggleExpand;
    $('#rLogF').onchange = e => { logFilter = e.target.value; logN = -1; };
    chart = new CH.Chart($('#runChart'), {
      ariaLabel: 'Chromatogram with TRIFLE fluorescence and AKTA traces', rulers: [0, 1], rulerColor: C.v20,
      xDomain: RC.xDomain, xTitle: RC.xTitle, panels: RC.panels(), series: RC.seriesFor(), bands: RC.bands, fractions: RC.fracItems,
      markers: () => RC.markers(true), hatches: RC.hatches, intervals: RC.intervals, info: RC.info, rulerInfo: RC.rulerInfo, legendExtras: RC.legendExtras(),
      tooltip: true, tipHead: RC.tipHead, tipExtra: RC.tipExtraAt, annotations: () => RC.annotations ? RC.annotations() : [], hoverInfo: () => S.engineer,
      liveIndex: () => { const R = S.run; return R && R.lt && R.lt.fit ? R.lt.n - 1 : null; },
      highlights: () => highlight ? [{ x0: RC.toX(highlight[0]), x1: RC.toX(highlight[1]) }] : [],
      // fraction cuts come from UNICORN: shown with the AKTA traces; Fraction review always shows them
      fractions: () => RC.view.akta ? RC.fracItems() : null,
      vlines: () => { const R = S.run; return R && pin != null && pin < R.derivedN ? [{ x: R.x[RC.sa() ? 'acq' : RC.view.x][pin], color: C.accent, dash: 'solid', label: 'Decay', align: 'left' }] : []; },
      onView: v => $('#rReset').classList.toggle('hidden', !v),
      onHover: x => { const i = x == null ? null : blockAt(x); if (i !== hov) { hov = i; decKey = ''; } },
      onClick: x => { const i = blockAt(x); if (i != null) { pin = i; chart.invalidateBase(); decKey = ''; } }
    });
    decChart = new CH.Chart($('#runDecay'), {
      ariaLabel: 'Fluorescence decay with its species components', topBand: 8, marginRight: 8, marginLeft: 58, bottom: 32, liveReadout: false,
      xDomain: () => [0, 32], xTitle: () => 'Time (ns)',
      panels: [{ key: 'main', yl: { title: 'Decay', unit: 'V', log: () => pulseLog, zero: true, minLog: -5 } }, { key: 'res', px: 34, hidden: () => !S.engineer, yl: { title: 'Weighted residual', short: 'Residual', unit: 'σ', sym: true, symMin: 3, zero: false } }],
      series: decSeries(), info: () => decInfo()
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
    M.on(ev => { if (ev === 'proc' || ev === 'run' || ev === 'series' || ev === 'setup' || ev === 'lt') { chart.cfg.panels = RC.panels(); chart.setSeries(RC.seriesFor()); chart.cfg.legendExtras = RC.legendExtras(); chart.buildLegend(); chart.relayout(); pulse.blk = -1; decKey = ''; syncSeg(); } if (ev === 'run' && S.run && S.run.state === 'acquiring' && S.run.derivedN === 0) { pin = null; hov = null; } if (ev === 'cards') cardsKey = ''; if (ev === 'notes') chart.invalidateBase(); if (ev === 'setup') syncSeg(); });
  }
  function setRulers(on) { chart.rulersOn = on; if (on) { const R = S.run, xs = R && R.derivedN ? R.x[RC.sa() ? 'acq' : RC.view.x] : null, [a, b0] = chart.xRange(), b = xs ? Math.min(b0, xs[R.derivedN - 1]) : b0, h = Math.max((b - a) * 0.1, 20 * (b0 - a) / chart.pw), r0 = Math.max(a, (a + b) / 2 - h); chart.rulers = [r0, r0 + 2 * h]; } chart.invalidateOver(); chart.updateReadout(); }
  // Scientist view: Run values, Decay and Evidence. Engineer view adds the Run log, tabbed with Evidence when narrow.
  function layoutBottom() { const rb = $('#runBottom'); if (!rb) return; const w = rb.getBoundingClientRect().width; if (!w) return; const narrow = S.engineer && w < 1200; rb.classList.toggle('narrow', narrow); $('#cardPanel').style.display = narrow && narrowTab === 'log' ? 'none' : ''; $('#logPanel').style.display = narrow && narrowTab === 'cards' ? 'none' : ''; ensureTabs(narrow); }
  function ensureTabs(narrow) {
    for (const id of ['logPanel', 'cardPanel']) {
      const ph = $('#' + id + ' .ph'); let t = $('.ptabs', ph);
      if (narrow && !t) { t = el('<div class="ptabs"><button data-v="log">Run log</button><button data-v="cards">Evidence</button></div>'); ph.prepend(t); $$('button', t).forEach(b => b.onclick = () => { narrowTab = b.dataset.v; layoutBottom(); }); }
      if (!narrow && t) { t.remove(); t = null; }
      if (t) { $$('button', t).forEach(b => b.classList.toggle('on', b.dataset.v === narrowTab)); $('h3', ph).style.display = 'none'; } else $('h3', ph).style.display = '';
    }
  }
  function syncSeg() { $$('#rX button').forEach(b => { b.classList.toggle('on', b.dataset.v === RC.view.x && !RC.sa()); b.disabled = RC.sa(); }); $$('#rLog button').forEach(b => b.classList.toggle('on', (b.dataset.v === '1') === RC.view.log)); }
  /* ---------- Decay panel ---------- */
  function showPane() {
    if (!S.engineer) decPane = 'decay';
    $$('#rDecV button').forEach(b => b.classList.toggle('on', b.dataset.v === decPane));
    $('#runDecay').style.display = decPane === 'decay' ? '' : 'none'; $('#runPulse').style.display = decPane === 'pulse' ? '' : 'none';
    setTimeout(() => { (decPane === 'decay' ? decChart : pulseChart).resize(); }, 0); decKey = '';
  }
  // nearest block that has data to an x position of the main chart
  function blockAt(x) {
    const R = S.run; if (!R || !R.derivedN) return null; const xs = R.x[RC.sa() ? 'acq' : RC.view.x], n = R.derivedN;
    let i = Math.min(n - 1, TR.lowerBound(xs, n, x)); if (i > 0 && Math.abs(xs[i - 1] - x) <= Math.abs(xs[i] - x)) i--;
    for (let d = 0; d < 6; d++) { if (i + d < n && !R.acq.disc[i + d]) return i + d; if (i - d >= 0 && !R.acq.disc[i - d]) return i - d; }
    return null;
  }
  function apexBlock(R) {
    if (apex.gen === R.dataGen * 1e7 + R.derivedN) return apex.i; let mx = -Infinity, im = -1;
    for (let i = 0; i < R.derivedN; i++) { const y = R.y.act[i]; if (R.robust[i] && y > mx) { mx = y; im = i; } }
    apex = { gen: R.dataGen * 1e7 + R.derivedN, i: im }; return im;
  }
  function shownBlock(R) {
    if (hov != null && hov < R.derivedN) return { i: hov, why: 'Cursor' };
    if (pin != null && pin < R.derivedN) return { i: pin, why: 'Pinned' };
    if (R.state === 'complete') { const i = apexBlock(R); if (i >= 0) return { i, why: 'Fluorescence maximum' }; }
    const lt = R.lt, i = lt && lt.fit ? lt.n - 1 : R.derivedN - 1 - LTM.H; return { i: Math.max(0, i), why: 'Latest' };
  }
  function decSeries() {
    // scatter is background: its component is Engineer view detail
    const comps = dec.d ? dec.d.comps.filter(c => S.engineer || c.key !== 'sc') : [], tot = comps.reduce((s, c) => s + Math.max(0, c.a), 0), sh = c => (c.a > 0 && tot > 0 ? ' ' + (c.a / tot * 100).toFixed(c.a / tot < 0.1 ? 1 : 0) + ' %' : ' 0 %');
    const pos = a => pulseLog ? Float64Array.from(a, v => v > 0 ? v : NaN) : a;
    return [
      { key: 'd', label: 'Data', tip: 'Mean decay of the blocks in the 15 s window, ND-corrected', mode: 'points', shape: 'dot', size: 3, color: '#8C96A0', panel: 'main', src: () => dec.n ? { x: dec.x, y: pos(dec.y), n: dec.n } : null },
      ...(dec.d && dec.d.fit ? [{ key: 'f', label: 'Fit', tip: 'Sum of the components', color: C.text, width: 2, panel: 'main', src: () => ({ x: dec.x, y: pos(dec.f), n: dec.n, gen: dec.gen * 2 + (pulseLog ? 1 : 0) }), fmt: v => fmt.sig3(v) + ' V' }] : []),
      ...comps.map(c => ({ key: 'c' + c.key, label: c.short + sh(c), tip: c.name + (S.engineer ? ', τ ' + c.tau.toFixed(2) + ' ns' : '') + ': ' + fmt.sig3(c.a) + ' V·ns', color: c.color, width: 2, panel: 'main', src: () => dec.c[c.k] ? { x: dec.x, y: pos(dec.c[c.k]), n: dec.n, gen: dec.gen * 2 + (pulseLog ? 1 : 0) } : null, fmt: v => fmt.sig3(v) + ' V' })),
      ...(dec.d && dec.d.fit ? [{ key: 'r', label: 'Residual', legend: false, mode: 'points', shape: 'dot', size: 2, color: '#8C96A0', panel: 'res', src: () => ({ x: dec.x, y: dec.r, n: dec.n }) }] : [])
    ];
  }
  function decInfo() {
    const R = S.run, d = dec.d; if (!R || !d) return R ? 'No decay yet.' : '';
    const A = R.acq, i = d.i, f = R.fractions.find(q => A.u[i] >= q.a && A.u[i] < q.b), lt = R.lt;
    const where = R.standalone ? fmt.min1(A.t[i] / 60) + ' min' : fmt.min1(R.x.min[i]) + ' min · ' + fmt.ml(A.u[i]) + ' mL' + (f ? ' · ' + f.id : '');
    const st = LTM.state(R), fitTxt = d.fit ? (S.engineer ? ' · χ²ᵣ ' + d.chi2r.toFixed(2) : '') : st === 'waiting' ? ' · species after ' + fmt.int(150) + ' blocks' : st === 'fitting' ? ' · first species fit running' : '';
    return where + fitTxt + (S.engineer ? ' · block ' + fmt.int(i + 1) + ', ' + d.nBlocks + ' blocks averaged' : '');
  }
  function updDecay() {
    const R = S.run; if (!R || !R.acq.dw) { if (dec.n) { dec.n = 0; dec.d = null; decChart.setSeries(decSeries()); } $('#decWhen').textContent = ''; return; }
    const sb = shownBlock(R), key = sb.i + '|' + (R.lt ? R.lt.gen : 0) + '|' + pulseLog + '|' + sb.why + '|' + S.engineer;
    $('#decLatest').style.display = pin != null ? '' : 'none';
    if (key === decKey) return;
    // the latest block moves every tick while live: refresh at most 4 times a second
    if (sb.why === 'Latest' && decKey && performance.now() - decAt < 250) return;
    decKey = key; decAt = performance.now();
    const d = LTM.decayAt(R, sb.i); dec.d = d; dec.gen++;
    if (!d) { dec.n = 0; } else {
      dec.n = LTN; dec.y = d.y; if (d.fit) { dec.f = d.fit; dec.r = d.res; } dec.c = d.comps.map(c => c.y);
    }
    $('#decWhen').textContent = sb.why === 'Cursor' ? '' : sb.why;
    const sig = JSON.stringify(decSeries().map(s => [s.key, s.label]));
    if (sig !== decSer) { decSer = sig; decChart.setSeries(decSeries()); } else decChart.invalidate();
  }
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
    // Engineer view rows: instrument state the scientist does not act on
    const eng = h => h.replace('<tr>', '<tr class="eng-only">');
    const row = (k2, u, v) => '<tr><td class="k">' + k2 + (u ? ' <span class="un">(' + u + ')</span>' : '') + '</td><td class="v">' + v + '</td></tr>';
    const fl = n && i >= 0 ? R.y.act[i] : NaN, use = n ? A.ruse[i] : NaN;
    const html = '<div class="sysstate">' + esc(sys) + '</div><table class="rv">' +
      row('Total fluorescence', 'V·ns', fmt.sig3(fl)) +
      eng(row('Sensitivity', '', '<span title="OD ' + st.nd + ', ' + st.range * 1000 + ' mV">' + A.cur + ' of ' + lad.length + '</span>')) +
      eng(row('Input range', '', rangeBar(use, use < S.th.lowPrec ? '<span class="flag w" title="Pulse under ' + Math.round(S.th.lowPrec * 100) + ' % of the input range (provisional)">Low precision</span>' : use > TR.ACQ.limit ? '<span class="flag f">Above 90 % limit</span>' : ''))) +
      row('Blocks', '', fmt.int(n - disc) + ' (' + fmt.int(disc) + ' discarded)').replace('<tr>', '<tr class="eng-only">') +
      (R.setupSnap.beamPerBlock ? row('Beam monitor', '% of start', n ? fmt.pct1(A.bm[i] / (R.bmRef || A.bm[i])) : '–').replace('<tr>', '<tr class="eng-only">') : '') +
      (al.detector === 'n/a' || (!S.engineer && al.detector === 'Aligned' && al.fractions === 'Aligned') ? '' : row('Alignment', '', esc(al.detector === 'Aligned' && al.fractions === 'Uncertain' ? 'Fractions uncertain' : al.detector))) + RC.runRows.map(f => f(R, i, row)).join('') + '</table>';
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
      '<div class="meta">' + (c.fractions && c.fractions.length ? 'Fractions: ' + esc(M.rangeIds(c.fractions)) + ' · ' : '') + '<button class="link small" data-show="' + c.x0 + ',' + c.x1 + '">Show on chart</button><span class="eng-only"> · Processing: ' + esc(c.mode) + (feats ? ' · Relies on: ' + feats : '') + '</span></div>' +
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
  // Scientist view: process observations and hypotheses first; instrument evidence collapses into one line
  let instOpen = false;
  function runCards() {
    const R = S.run, box = $('#runCards'); const cards = R ? R.rules.cards : [];
    const key = JSON.stringify([S.engineer, cards.map(c => [c.id, c.status, c.obs, c.fractions && c.fractions.length])]);
    if (key === cardsKey) return; cardsKey = key;
    const focused = document.activeElement && box.contains(document.activeElement) && document.activeElement.tagName === 'INPUT';
    if (focused) { cardsKey = ''; return; }
    if (S.engineer) { $('#cardCnt').textContent = cards.filter(c => c.status === 'open').length; box.innerHTML = '<div class="cards">' + cardsHtml(cards) + '</div>'; wireCards(box); return; }
    const main = cards.filter(c => c.level !== 'I'), inst = cards.filter(c => c.level === 'I');
    $('#cardCnt').textContent = main.filter(c => c.status === 'open').length;
    const byRule = {}; inst.forEach(c => { byRule[c.rule] = (byRule[c.rule] || 0) + 1; });
    const instHtml = inst.length ? '<details class="inst-notes"' + (instOpen ? ' open' : '') + '><summary>Instrument notes <span class="cnt">' + inst.filter(c => c.status === 'open').length + '</span> <span class="note">' + Object.keys(byRule).map(k => k + (byRule[k] > 1 ? ' ×' + byRule[k] : '')).join(', ') + '</span></summary><div class="cards">' + cardsHtml(inst) + '</div></details>' : '';
    box.innerHTML = '<div class="cards">' + (main.length ? cardsHtml(main) : '<div class="note">No process observations.</div>') + instHtml + '</div>'; wireCards(box);
    const d = $('.inst-notes', box); if (d) d.ontoggle = () => { instOpen = d.open; };
  }
  function update(d) {
    if (!built) build();
    if (engLaid !== S.engineer) { engLaid = S.engineer; layoutBottom(); showPane(); }
    controls(); runValues(); runLog(); runCards(); if (decPane === 'pulse') updPulse(); else updDecay(); UI.renderChips();
    if (d.all || d.xmode) { chart.invalidateBase(); }
    if (S.run) { if (S.run.acq.changes.length !== chart._nch || S.run.rules.cards.length !== chart._ncards) { chart._nch = S.run.acq.changes.length; chart._ncards = S.run.rules.cards.length; chart.invalidateBase(); } }
    chart.requestDraw();
  }
  UI.register('run', { show() { if (!built) build(); setTimeout(() => { chart.resize(); pulseChart.resize(); decChart.resize(); layoutBottom(); }, 0); logN = -1; cardsKey = ''; decKey = ''; syncSeg(); }, update, hide() { if (expanded) toggleExpand(); }, cardsHtml, wireCards, chart: () => chart, decayBlock: () => dec.d ? dec.d.i : null });
})();
