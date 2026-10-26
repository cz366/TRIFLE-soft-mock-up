/* =====================================================================
   Chart module: Canvas 2D, own code. Three stacked layers (base, data,
   overlay). Data are bucketed per pixel column (min, max, first, last),
   so appending a block only updates and redraws the affected columns.
   ===================================================================== */
const CH = (function () {
  const C = {
    v20: '#2E6E78', prop: '#A64B2A', uv: '#6B7785', cond: '#8C96A0', ph: '#4F5B66', beam: '#5E4B7C', irf: '#8C96A0',
    grid: '#E6E9EC', axis: '#9AA3AC', text: '#1F2933', text2: '#5B6670', band1: '#EEF0F2', band2: '#F7F8F9', frac: '#B8C0C8',
    accent: '#1B365D', ok: '#2F7D4F', warn: '#B7791F', fault: '#B42318', diff: '#5B6670', decay: '#6B5B3E'
  };
  const FONT = '13px Arial, "Liberation Sans", sans-serif', FONT_S = '12px Arial, "Liberation Sans", sans-serif';
  function nice(span, n) { const raw = span / Math.max(1, n), p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p; }
  function ticks(a, b, n) { if (!(b > a)) return []; const st = nice(b - a, n), out = []; for (let v = Math.ceil(a / st - 1e-9) * st; v <= b + st * 1e-9; v += st) out.push(Math.abs(v) < st * 1e-9 ? 0 : v); return out; }
  // y ticks for a panel h px tall: fewer ticks until labels sit at least 16 px apart
  function yTicks(a, b, n, h) { let t = ticks(a, b, n); while (n > 1 && t.length > 2 && h * (t[1] - t[0]) / (b - a) < 16) { n--; t = ticks(a, b, n); } return t; }
  function tickFmt(v, st) { const d = Math.max(0, -Math.floor(Math.log10(st) + 1e-9)); return v.toFixed(Math.min(6, d)); }
  // decade ticks; on a panel h px tall, every k-th decade so that labels sit at least 14 px apart
  function logTicks(a, b, h) { const out = [], k = h ? Math.max(1, Math.ceil(14 / (h / Math.max(1e-9, b - a)))) : 1; for (let e = Math.floor(a); e <= Math.ceil(b); e++) if (e >= a - 1e-9 && e <= b + 1e-9 && ((e % k) + k) % k === 0) out.push(e); return out; }
  function supExp(e) { const v = Math.pow(10, e); return Math.abs(e) <= 3 ? (e < 0 ? v.toFixed(-e) : String(v)) : '1e' + e; }
  function lb(arr, n, x) { let lo = 0, hi = n; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < x) lo = m + 1; else hi = m; } return lo; }
  function dashFor(s, w) { if (s === 'dash') return [5, 3]; if (s === 'dot') return [1.5, 2.5]; if (s === 'dashdot') return [6, 2.5, 1.5, 2.5]; return []; }

  class Chart {
    constructor(host, cfg) {
      this.host = host; this.cfg = cfg;
      host.classList.add('chart');
      host.innerHTML = '<div class="ch-legend" role="list"></div><div class="ch-info"></div><div class="ch-plot"><canvas class="ch-base"></canvas><canvas class="ch-data"></canvas><canvas class="ch-over" tabindex="0" aria-label="' + (cfg.ariaLabel || 'Chart') + '"></canvas></div>';
      this.legendEl = host.querySelector('.ch-legend'); this.infoEl = host.querySelector('.ch-info'); this.plotEl = host.querySelector('.ch-plot');
      [this.cBase, this.cData, this.cOver] = host.querySelectorAll('canvas');
      this.xBase = cfg.xBase || null; this.view = null; this.zoomStack = []; this.cursorX = null; this.dragging = null;
      this.rulers = cfg.rulers ? cfg.rulers.slice() : null; this.rulersOn = !!cfg.rulersOn;
      this.mode = cfg.dragMode || 'zoom'; this.ylZoom = null;
      this.hoverKey = null; this.dirtyAll = true; this.baseDirty = true; this.overDirty = true; this.yl = null;
      this.series = cfg.series; this.series.forEach(s => { s.b = null; if (s.visible == null) s.visible = true; });
      this.buildLegend();
      this.bindEvents();
      this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(this.plotEl);
      this.resize();
    }
    destroy() { this.ro.disconnect(); }
    setSeries(series) { this.series = series; series.forEach(s => { s.b = null; if (s.visible == null) s.visible = true; }); this.buildLegend(); this.invalidate(); }
    buildLegend() {
      const el = this.legendEl; el.innerHTML = '';
      for (const s of this.series) {
        if (s.legend === false) continue;
        const it = document.createElement('span'); it.className = 'ch-li' + (s.visible ? '' : ' off'); it.setAttribute('role', 'listitem'); it.tabIndex = 0;
        it.title = (s.tip || s.label) + (s.toggle === false ? '' : '. Click to show or hide.');
        const sw = document.createElement('span'); sw.className = 'ch-sw ' + (s.dash || 'solid'); sw.style.borderTopColor = s.color; if (s.mode === 'points') { sw.className = 'ch-sw pt' + (s.shape === 'dot' ? ' dot' : ''); sw.style.background = s.color; }
        const lab = document.createElement('span'); lab.className = 'ch-ll'; lab.textContent = s.label;
        const val = document.createElement('span'); val.className = 'ch-lv'; s._valEl = val;
        it.append(sw, lab, val); if (s.tag) { const tg = document.createElement('span'); tg.className = 'tag'; tg.dataset.scope = s.tagScope || 'always'; tg.textContent = s.tag; it.append(tg); }
        if (s.toggle !== false) {
          it.addEventListener('click', () => { s.visible = !s.visible; it.classList.toggle('off', !s.visible); if (s.onToggle) s.onToggle(s.visible); this.invalidate(); });
          it.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); it.click(); } });
        }
        it.addEventListener('mouseenter', () => { this.hoverKey = s.key; this.dataFull = true; this.requestDraw(); });
        it.addEventListener('mouseleave', () => { this.hoverKey = null; this.dataFull = true; this.requestDraw(); });
        el.append(it);
      }
      for (const ex of (this.cfg.legendExtras || [])) { const it = document.createElement('span'); it.className = 'ch-li static'; it.innerHTML = ex.html; it.title = ex.tip || ''; el.append(it); }
    }
    /* ---------- geometry ---------- */
    resize() {
      const r = this.plotEl.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      if (r.width < 10 || r.height < 10) return;
      this.W = Math.floor(r.width); this.H = Math.floor(r.height); this.dpr = dpr;
      for (const c of [this.cBase, this.cData, this.cOver]) { c.width = Math.floor(this.W * dpr); c.height = Math.floor(this.H * dpr); c.style.width = this.W + 'px'; c.style.height = this.H + 'px'; }
      this.layout(); this.invalidate();
    }
    layout() {
      const cfg = this.cfg, W = this.W, H = this.H, gap = 6;
      const ml = cfg.marginLeft || 70, mr = cfg.panels.some(p => p.yr) ? (cfg.marginRight || 62) : 14, top = cfg.topBand != null ? cfg.topBand : 32, bottom = cfg.bottom || 36;
      const vis = cfg.panels.filter(p => !(p.hidden && p.hidden()));
      const gaps = Math.max(0, vis.length - 1) * gap, avail = H - top - bottom - gaps, want = vis.filter(p => p.px).reduce((s, p) => s + p.px, 0);
      const k = want > avail / 2 ? avail / 2 / want : 1, stripH = p => Math.max(24, Math.floor(p.px * k));
      const mainH = Math.max(40, avail - vis.filter(p => p.px).reduce((s, p) => s + stripH(p), 0));
      let y = top; this.panels = [];
      for (const p of vis) { const h = p.px ? stripH(p) : mainH; this.panels.push({ cfg: p, key: p.key, x: ml, y, w: W - ml - mr, h }); y += h + gap; }
      this.px0 = ml; this.pw = W - ml - mr; this.top = top; this.bottomY = H - bottom;
      for (const s of this.series) s.b = null;
    }
    relayout() { this.layout(); this.invalidate(); }
    panelOf(key) { return this.panels.find(p => p.key === key); }
    xFull() { return this.cfg.xDomain(); }
    xRange() { return this.view || this.xFull(); }
    xToPx(x) { const [a, b] = this.xRange(); return this.px0 + (x - a) / (b - a) * this.pw; }
    pxToX(px) { const [a, b] = this.xRange(); return a + (px - this.px0) / this.pw * (b - a); }
    invalidate() { this.dirtyAll = true; this.baseDirty = true; this.overDirty = true; this.requestDraw(); }
    invalidateBase() { this.baseDirty = true; this.requestDraw(); }
    invalidateOver() { this.overDirty = true; this.requestDraw(); }
    requestDraw() { if (this._raf) return; this._raf = requestAnimationFrame(() => { this._raf = 0; this.draw(); }); }
    setView(v, push) { if (push !== false) this.zoomStack.push(this.view); this.view = v; this.invalidate(); if (this.cfg.onView) this.cfg.onView(v); }
    resetZoom() { this.zoomStack = []; this.view = null; this.ylZoom = null; this.invalidate(); if (this.cfg.onView) this.cfg.onView(null); }
    popZoom() { if (!this.zoomStack.length) { this.ylZoom = null; this.view = null; } else { this.view = this.zoomStack.pop(); if (!this.view) this.ylZoom = null; } this.invalidate(); if (this.cfg.onView) this.cfg.onView(this.view); }
    /* ---------- bucketing ---------- */
    newBuckets() { const W = Math.max(1, this.pw); return { n: 0, cnt: new Int32Array(W), min: new Float64Array(W), max: new Float64Array(W), minPos: new Float64Array(W).fill(Infinity), maxPos: new Float64Array(W).fill(-Infinity), first: new Float64Array(W), last: new Float64Array(W), rmin: new Float64Array(W).fill(Infinity), rmax: new Float64Array(W).fill(-Infinity), brk: new Uint8Array(W), lowN: new Int32Array(W), pend: true, lastCol: -1 }; }
    bucket(s, b, from, to, d) {
      const W = this.pw, [a, c1] = this.xRange(), sx = W / (c1 - a); let dmin = Infinity, dmax = -Infinity;
      for (let i = from; i < to; i++) {
        const x = d.x[i], y = d.y[i];
        if (d.brk && d.brk[i]) b.pend = true;
        if (d.maxGap && i > 0 && x - d.x[i - 1] > d.maxGap) b.pend = true;
        if (!(x >= a && x <= c1)) { if (x > c1) { b.n = to; return [dmin, dmax]; } b.pend = true; continue; }
        if (y !== y || y === undefined) { b.pend = true; continue; }
        let c = Math.floor((x - a) * sx); if (c >= W) c = W - 1; if (c < 0) c = 0;
        if (b.cnt[c] === 0) { b.first[c] = y; b.min[c] = y; b.max[c] = y; b.brk[c] = b.pend ? 1 : 0; }
        else { if (y < b.min[c]) b.min[c] = y; if (y > b.max[c]) b.max[c] = y; if (b.pend && b.lastCol !== c) b.brk[c] = 1; }
        if (y > 0) { if (y < b.minPos[c]) b.minPos[c] = y; if (y > b.maxPos[c]) b.maxPos[c] = y; }
        const rob = !d.robust || d.robust[i];
        if (rob) { if (y < b.rmin[c]) b.rmin[c] = y; if (y > b.rmax[c]) b.rmax[c] = y; }
        if (d.low && d.low[i]) b.lowN[c]++;
        b.last[c] = y; b.cnt[c]++; b.lastCol = c; b.pend = false;
        if (c < dmin) dmin = c; if (c > dmax) dmax = c;
      }
      b.n = to; return [dmin, dmax];
    }
    updateBuckets(full) {
      let d0 = Infinity, d1 = -Infinity;
      for (const s of this.series) {
        if (s.mode === 'points') continue;
        const d = s.src(); if (!d) { s.b = null; continue; }
        if (full || !s.b || d.n < s.b.n || d.gen !== s._gen) { s.b = this.newBuckets(); s._gen = d.gen; this.bucket(s, s.b, 0, d.n, d); if (!full) this._needFull = true; continue; }
        if (d.n > s.b.n) { const [a, b] = this.bucket(s, s.b, s.b.n, d.n, d); if (s.visible) { if (a < d0) d0 = a; if (b > d1) d1 = b; } }
      }
      return [d0, d1];
    }
    /* ---------- y scales ---------- */
    yScale(p, side) {
      const pc = p.cfg, ax = side === 'l' ? pc.yl : pc.yr; if (!ax) return null;
      if (side === 'l' && p === this.panels[0] && this.ylZoom) return { lin: !this.isLog(ax), a: this.ylZoom[0], b: this.ylZoom[1], ax };
      const log = this.isLog(ax);
      if (ax.fixed) { const f = typeof ax.fixed === 'function' ? ax.fixed() : ax.fixed; return log ? { lin: false, a: Math.log10(f[0]), b: Math.log10(f[1]), ax } : { lin: true, a: f[0], b: f[1], ax }; }
      let lo = Infinity, hi = -Infinity, loP = Infinity, hiP = -Infinity, rlo = Infinity, rhi = -Infinity;
      for (const s of this.series) {
        if (!s.visible || s.panel !== p.key || (s.side || 'l') !== side) continue;
        if (s.mode === 'points') { const d = s.src(); if (!d) continue; for (let i = 0; i < d.n; i++) { const y = d.y[i]; if (y < lo) lo = y; if (y > hi) hi = y; if (y > 0) { if (y < loP) loP = y; if (y > hiP) hiP = y; } if (d.yhi && d.yhi[i] > hi) hi = d.yhi[i]; } rlo = lo; rhi = hi; continue; }
        const b = s.b; if (!b) continue;
        for (let c = 0; c < b.cnt.length; c++) { if (!b.cnt[c]) continue; if (b.min[c] < lo) lo = b.min[c]; if (b.max[c] > hi) hi = b.max[c]; if (b.minPos[c] < loP) loP = b.minPos[c]; if (b.maxPos[c] > hiP) hiP = b.maxPos[c]; if (b.rmin[c] < rlo) rlo = b.rmin[c]; if (b.rmax[c] > rhi) rhi = b.rmax[c]; }
      }
      if (rhi > rlo) { lo = rlo; hi = rhi; }
      else if (side === 'l' && p === this.panels[0]) { const v = []; for (const s of this.series) if (s.visible && s.panel === p.key && (s.side || 'l') === 'l' && s.b && s.mode !== 'points') for (let c = 0; c < s.b.cnt.length; c++) if (s.b.cnt[c]) v.push(s.b.last[c]); if (v.length >= 3) { v.sort((a, b) => a - b); const m = v[v.length >> 1], d = v.map(x => Math.abs(x - m)).sort((a, b) => a - b)[v.length >> 1] || Math.abs(m) * 0.1 || 1e-6, w = v.filter(x => Math.abs(x - m) <= 10 * d); lo = w[0]; hi = w[w.length - 1]; } }
      if (log) {
        if (!(hiP > 0)) return { lin: false, a: -3, b: 1, ax };
        let a = Math.floor(Math.log10(Math.max(loP, hiP * 1e-6))), b = Math.ceil(Math.log10(hiP * 1.05));
        if (ax.minLog != null) a = Math.max(a, ax.minLog); if (b <= a) b = a + 1;
        return { lin: false, a, b, ax };
      }
      if (!(hi >= lo)) { lo = ax.def ? ax.def[0] : 0; hi = ax.def ? ax.def[1] : 1; }
      if (ax.zero !== false) { lo = Math.min(0, lo); }
      if (ax.sym) { const m = Math.max(Math.abs(lo), Math.abs(hi), ax.symMin || 0); lo = -m; hi = m; }
      if (hi - lo < (ax.minSpan || 1e-9)) { const m = (hi + lo) / 2, h = (ax.minSpan || 1e-6) / 2; lo = m - h; hi = m + h; }
      const span = hi - lo, st = nice(span * 1.08, 5); let a = Math.floor((lo - (ax.zero !== false && lo >= 0 ? 0 : span * 0.04)) / st) * st, b2 = Math.ceil((hi + span * 0.06) / st) * st;
      if (ax.zero !== false && lo >= 0) a = 0;
      return { lin: true, a, b: b2, ax };
    }
    isLog(ax) { return typeof ax.log === 'function' ? ax.log() : !!ax.log; }
    yToPx(p, sc, y) { const v = sc.lin ? y : (y > 0 ? Math.log10(y) : -Infinity); return p.y + p.h - (v - sc.a) / (sc.b - sc.a) * p.h; }
    /* ---------- drawing ---------- */
    draw() {
      if (!this.W) return;
      let full = this.dirtyAll; this.dirtyAll = false;
      const [d0, d1] = this.updateBuckets(full);
      // y scales; a change forces a full redraw of the data layer
      const scales = this.panels.map(p => ({ l: this.yScale(p, 'l'), r: this.yScale(p, 'r') }));
      const key = JSON.stringify(scales.map(s => [s.l && [s.l.a, s.l.b, s.l.lin], s.r && [s.r.a, s.r.b, s.r.lin]]));
      if (key !== this._scaleKey) { this._scaleKey = key; full = true; this.baseDirty = true; }
      this.scales = scales;
      if (this.dataFull || this._needFull) { full = true; this.dataFull = false; this._needFull = false; }
      if (this.baseDirty) { this.drawBase(); this.baseDirty = false; }
      if (full) this.drawData(0, this.pw - 1, true);
      else if (d1 >= d0) this.drawData(Math.max(0, d0 - 2), Math.min(this.pw - 1, d1 + 1), false);
      this.drawOver();
      this.updateReadout();
      if (this.cfg.afterDraw) this.cfg.afterDraw(this);
    }
    drawBase() {
      const ctx = this.cBase.getContext('2d'), dpr = this.dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, this.W, this.H);
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, this.W, this.H);
      const [xa, xb] = this.xRange(), cfg = this.cfg;
      // phase bands
      const bands = cfg.bands ? cfg.bands() : [];
      for (const p of this.panels) {
        ctx.save(); ctx.beginPath(); ctx.rect(p.x, p.y, p.w, p.h); ctx.clip();
        bands.forEach((bd, k) => { const x0 = this.xToPx(bd.x0), x1 = this.xToPx(bd.x1); ctx.fillStyle = bd.fill || (k % 2 ? C.band2 : C.band1); ctx.fillRect(x0, p.y, x1 - x0, p.h); });
        if (!bands.length) { ctx.fillStyle = '#FFFFFF'; ctx.fillRect(p.x, p.y, p.w, p.h); }
        ctx.restore();
      }
      ctx.font = FONT_S; ctx.textBaseline = 'middle';
      // phase labels in the top band
      if (this.top >= 14) {
        let lastEnd = -1e9; ctx.textAlign = 'left';
        bands.forEach(bd => {
          const x0 = Math.max(this.px0, this.xToPx(bd.x0)), x1 = Math.min(this.px0 + this.pw, this.xToPx(bd.x1)); if (x1 - x0 < 6) return;
          let t = bd.label; let w = ctx.measureText(t).width; if (w > x1 - x0 - 6 && bd.short) { t = bd.short; w = ctx.measureText(t).width; }
          if (w > x1 - x0 - 6) return;
          const lx = Math.max(x0 + 3, (x0 + x1) / 2 - w / 2); if (lx < lastEnd) return;
          ctx.fillStyle = C.text2; ctx.fillText(t, lx, 8); lastEnd = lx + w + 10;
        });
      }
      // grid and axes per panel
      const sc = this.scales || this.panels.map(p => ({ l: this.yScale(p, 'l'), r: this.yScale(p, 'r') }));
      const xt = ticks(xa, xb, Math.max(3, Math.floor(this.pw / 90))), xst = xt.length > 1 ? xt[1] - xt[0] : 1;
      this.panels.forEach((p, pi) => {
        const s = sc[pi];
        ctx.strokeStyle = C.grid; ctx.lineWidth = 1; ctx.beginPath();
        for (const v of xt) { const x = Math.round(this.xToPx(v)) + 0.5; ctx.moveTo(x, p.y); ctx.lineTo(x, p.y + p.h); }
        if (s.l) { const yt = s.l.lin ? yTicks(s.l.a, s.l.b, p.cfg.px ? 2 : Math.max(3, Math.floor(p.h / 45)), p.h) : logTicks(s.l.a, s.l.b, p.h); for (const v of yt) { const y = Math.round(p.y + p.h - (v - s.l.a) / (s.l.b - s.l.a) * p.h) + 0.5; ctx.moveTo(p.x, y); ctx.lineTo(p.x + p.w, y); } }
        ctx.stroke();
        ctx.strokeStyle = C.axis; ctx.strokeRect(p.x + 0.5, p.y + 0.5, p.w - 1, p.h - 1);
        // left axis labels
        ctx.fillStyle = C.text2; ctx.font = FONT_S; ctx.textBaseline = 'middle';
        if (s.l) {
          const n = p.cfg.px ? 2 : Math.max(3, Math.floor(p.h / 45)), yt = s.l.lin ? yTicks(s.l.a, s.l.b, n, p.h) : logTicks(s.l.a, s.l.b, p.h), st = yt.length > 1 ? yt[1] - yt[0] : 1;
          ctx.textAlign = 'right';
          for (const v of yt) { const y = p.y + p.h - (v - s.l.a) / (s.l.b - s.l.a) * p.h; if (p.cfg.px && y < p.y + 6) continue; ctx.fillText(s.l.lin ? (s.l.ax.tickFmt ? s.l.ax.tickFmt(v) : tickFmt(v, st)) : supExp(v), p.x - 4, Math.min(p.y + p.h - 5, Math.max(p.y + 5, y))); }
          ctx.save(); ctx.fillStyle = C.text; ctx.textAlign = 'center';
          if (!p.cfg.px) { let t = s.l.ax.title + (s.l.ax.unit ? ' (' + s.l.ax.unit + ')' : '') + (s.l.lin ? '' : ', log'); if (ctx.measureText(t).width > 2 * (p.y + p.h / 2) - 4) t = s.l.ax.title + (s.l.ax.unit ? ' (' + s.l.ax.unit.split(',')[0] + ')' : '') + (s.l.lin ? '' : ', log'); ctx.translate(12, p.y + p.h / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(t, 0, 0); }
          ctx.restore();
        }
        if (s.r) {
          const yt = s.r.lin ? yTicks(s.r.a, s.r.b, Math.max(3, Math.floor(p.h / 45)), p.h) : logTicks(s.r.a, s.r.b, p.h), st = yt.length > 1 ? yt[1] - yt[0] : 1;
          ctx.textAlign = 'left'; ctx.fillStyle = C.text2;
          for (const v of yt) { const y = p.y + p.h - (v - s.r.a) / (s.r.b - s.r.a) * p.h; ctx.fillText(s.r.lin ? tickFmt(v, st) : supExp(v), p.x + p.w + 4, Math.min(p.y + p.h - 5, Math.max(p.y + 5, y))); }
          ctx.save(); ctx.fillStyle = C.text; ctx.textAlign = 'center'; ctx.translate(this.W - 8, p.y + p.h / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(s.r.ax.title + (s.r.ax.unit ? ' (' + s.r.ax.unit + ')' : ''), 0, 0); ctx.restore();
        }
      });
      // fraction boundaries and IDs (second row of the top band)
      const fr = cfg.fractions ? cfg.fractions() : null, main = this.panels[0];
      if (fr && fr.items.length && main) {
        ctx.save(); ctx.beginPath(); ctx.rect(main.x, 0, main.w, main.y + main.h); ctx.clip();
        ctx.strokeStyle = C.frac; ctx.lineWidth = 1; ctx.beginPath();
        for (const f of fr.items) for (const v of [f.a, f.b]) { const x = Math.round(this.xToPx(v)) + 0.5; ctx.moveTo(x, main.y - 12); ctx.lineTo(x, main.y + main.h); }
        ctx.stroke();
        if (fr.uncertain) { this.hatch(ctx, main.x, main.y - 13, main.w, 12, 'rgba(91,102,112,0.45)'); }
        ctx.font = FONT_S; ctx.fillStyle = C.text2; ctx.textAlign = 'center';
        for (const stride of [1, 2, 5, 10]) {
          const w = fr.items.length > 1 ? Math.min(...fr.items.slice(0, -1).map(f => this.xToPx(f.b) - this.xToPx(f.a))) : 999;
          if (w * stride >= 26 || stride === 10) {
            let lastR = -1e9; fr.items.forEach((f, k) => { const num = parseInt(f.id.replace(/\D/g, ''), 10); if (stride > 1 && num !== 1 && num % stride !== 0) return; const x = (this.xToPx(f.a) + this.xToPx(f.b)) / 2, tw = ctx.measureText(f.id).width; if (x < main.x - 5 || x > main.x + main.w + 5 || x - tw / 2 < lastR + 6) return; ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x - tw / 2 - 2, main.y - 12, tw + 4, 12); ctx.fillStyle = C.text2; ctx.fillText(f.id, x, main.y - 6); lastR = x + tw / 2; });
            break;
          }
        }
        ctx.restore();
      }
      // reference lines (pool boundaries, etc.)
      const vl = cfg.vlines ? cfg.vlines() : [];
      for (const L of vl) {
        const x = Math.round(this.xToPx(L.x)) + 0.5; if (x < main.x || x > main.x + main.w) continue;
        ctx.save(); ctx.strokeStyle = L.color || C.text2; ctx.setLineDash(dashFor(L.dash || 'dash')); ctx.lineWidth = L.width || 1; ctx.beginPath(); ctx.moveTo(x, main.y); ctx.lineTo(x, main.y + main.h); ctx.stroke(); ctx.restore();
      }
      // hatched intervals (alignment uncertain) and interval bars (laser change)
      for (const h of (cfg.hatches ? cfg.hatches() : [])) { const x0 = Math.max(main.x, this.xToPx(h.x0)), x1 = Math.min(main.x + main.w, this.xToPx(h.x1)); if (x1 > x0) for (const p of this.panels) this.hatch(ctx, x0, p.y, x1 - x0, p.h, 'rgba(91,102,112,0.28)'); }
      let ivRow = 0;
      for (const iv of (cfg.intervals ? cfg.intervals() : [])) {
        const x0 = Math.max(main.x, this.xToPx(iv.x0)), x1 = Math.min(main.x + main.w, Math.max(this.xToPx(iv.x1), this.xToPx(iv.x0) + 2)); if (x1 <= main.x || x0 >= main.x + main.w) continue;
        ctx.fillStyle = iv.color || C.warn; ctx.fillRect(x0, main.y + 1 + ivRow * 16, x1 - x0, 3); ivRow = (ivRow + 1) % 3;
      }
      // x axis
      const yAx = this.bottomY; ctx.strokeStyle = C.axis; ctx.beginPath(); ctx.moveTo(this.px0, yAx + 0.5); ctx.lineTo(this.px0 + this.pw, yAx + 0.5); ctx.stroke();
      ctx.fillStyle = C.text2; ctx.textAlign = 'center'; ctx.font = FONT_S; ctx.textBaseline = 'top';
      for (const v of xt) { const x = this.xToPx(v); ctx.beginPath(); ctx.moveTo(Math.round(x) + 0.5, yAx); ctx.lineTo(Math.round(x) + 0.5, yAx + 4); ctx.stroke(); ctx.fillText(cfg.xTickFmt ? cfg.xTickFmt(v) : tickFmt(v, xst), x, yAx + 6); }
      ctx.fillStyle = C.text; ctx.font = FONT; ctx.fillText(cfg.xTitle(), this.px0 + this.pw / 2, yAx + 17);
      // markers on the x axis: sensitivity ticks and note/event markers
      this.markerHits = []; this.markerLabels = []; let mEnd = -1e9, mRow = 0;
      for (const m of (cfg.markers ? cfg.markers() : []).slice().sort((a, b) => a.x - b.x)) {
        const x = this.xToPx(m.x); if (x < this.px0 - 1 || x > this.px0 + this.pw + 1) continue;
        if (m.kind === 'tick') { ctx.strokeStyle = m.color || C.v20; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(Math.round(x) + 0.5, yAx - 5); ctx.lineTo(Math.round(x) + 0.5, yAx); ctx.stroke(); this.markerHits.push({ x, y0: yAx - 6, y1: yAx + 2, text: m.text }); }
        else { ctx.font = FONT_S; const tw = ctx.measureText(m.label || '').width; mRow = x - tw / 2 < mEnd ? mRow + 1 : 0; mEnd = x + tw / 2 + 3; const ly = yAx - 10 - mRow * 13; ctx.fillStyle = m.color || C.text; ctx.beginPath(); ctx.moveTo(x, yAx - 9); ctx.lineTo(x - 4, yAx - 1); ctx.lineTo(x + 4, yAx - 1); ctx.closePath(); ctx.fill(); this.markerLabels.push({ x, y: ly, label: m.label || '', color: m.color || C.text }); this.markerHits.push({ x, y0: ly - 12, y1: yAx + 2, text: m.text }); }
      }
      ctx.textBaseline = 'alphabetic';
    }
    hatch(ctx, x, y, w, h, color) {
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.beginPath();
      for (let k = -h; k < w; k += 7) { ctx.moveTo(x + k, y + h); ctx.lineTo(x + k + h, y); } ctx.stroke(); ctx.restore();
    }
    drawData(c0, c1, full) {
      const ctx = this.cData.getContext('2d'), dpr = this.dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (full) ctx.clearRect(0, 0, this.W, this.H);
      else ctx.clearRect(this.px0 + c0, 0, c1 - c0 + 1, this.H);
      this.panels.forEach((p, pi) => {
        ctx.save(); ctx.beginPath(); ctx.rect(p.x + (full ? 0 : c0), p.y, full ? p.w : c1 - c0 + 1, p.h); ctx.clip();
        // panels that paint their own content (decay map) draw the changed pixel columns first
        if (p.cfg.draw) p.cfg.draw(ctx, p, this, full ? 0 : c0, full ? this.pw - 1 : c1);
        // low-precision shading (warning colour at 12 % opacity), drawn from the shading series
        for (const s of this.series) {
          if (!s.shade || !s.b || s.panel !== p.key) continue;
          ctx.fillStyle = 'rgba(183,121,31,0.12)';
          for (let c = c0; c <= c1; c++) if (s.b.cnt[c] && s.b.lowN[c] * 2 >= s.b.cnt[c]) ctx.fillRect(p.x + c, p.y, 1, p.h);
        }
        for (const side of ['l', 'r']) {
          const sc = this.scales[pi][side]; if (!sc) continue;
          // drawing order follows the legend unless a series sets z (higher draws later, on top)
          const ordered = this.series.filter(s => s.visible && s.panel === p.key && (s.side || 'l') === side && !s.shadeOnly).sort((a, b) => (a.z || 0) - (b.z || 0));
          for (const s of ordered) {
            if (s.mode === 'points') { this.drawPoints(ctx, p, sc, s); continue; }
            const b = s.b; if (!b) continue;
            const hover = this.hoverKey === s.key;
            ctx.strokeStyle = s.color; ctx.lineWidth = (s.width || 1.25) * (hover ? 2 : 1); ctx.setLineDash(dashFor(s.dash)); ctx.lineJoin = 'round';
            ctx.beginPath();
            let started = false, start = c0;
            // walk back to the previous filled column to connect the line
            for (let c = c0 - 1; c >= 0 && c >= c0 - 4000; c--) if (b.cnt[c]) { start = c; break; }
            const Y = v => this.yToPx(p, sc, sc.lin ? v : v);
            for (let c = start; c <= c1; c++) {
              if (!b.cnt[c]) continue;
              let mn = b.min[c], mx = b.max[c], fi = b.first[c], la = b.last[c];
              if (!sc.lin) { if (!(b.maxPos[c] > 0)) { started = false; continue; } mn = b.minPos[c]; mx = b.maxPos[c]; fi = fi > 0 ? fi : mn; la = la > 0 ? la : mn; }
              const x = p.x + c + 0.5, yf = Y(fi), yl = Y(la), ymn = Y(mn), ymx = Y(mx);
              if (!started || b.brk[c]) { ctx.moveTo(x, yf); started = true; } else ctx.lineTo(x, yf);
              if (b.cnt[c] > 1) { ctx.lineTo(x, ymn); ctx.lineTo(x, ymx); ctx.lineTo(x, yl); }
            }
            ctx.stroke(); ctx.setLineDash([]);
            // off-scale indicators
            ctx.fillStyle = s.color;
            for (let c = c0; c <= c1; c++) { if (!b.cnt[c]) continue; const hi = sc.lin ? b.max[c] : Math.log10(b.maxPos[c]), lo = sc.lin ? b.min[c] : (b.minPos[c] < Infinity ? Math.log10(b.minPos[c]) : sc.a); if (hi > sc.b) ctx.fillRect(p.x + c, p.y, 1, 3); if (sc.lin && lo < sc.a) ctx.fillRect(p.x + c, p.y + p.h - 3, 1, 3); }
          }
        }
        ctx.restore();
      });
    }
    drawPoints(ctx, p, sc, s) {
      const d = s.src(); if (!d) return; ctx.fillStyle = s.color; ctx.strokeStyle = s.color; ctx.lineWidth = 1;
      const r = (s.size || 6) / 2;
      for (let i = 0; i < d.n; i++) {
        const x = this.xToPx(d.x[i]), y = this.yToPx(p, sc, d.y[i]); if (!isFinite(y)) continue;
        if (d.ylo) { const a = this.yToPx(p, sc, d.ylo[i]), b = this.yToPx(p, sc, d.yhi[i]); ctx.beginPath(); ctx.moveTo(x + 0.5, a); ctx.lineTo(x + 0.5, b); ctx.stroke(); }
        const open = d.open && d.open[i];
        if (s.shape === 'dot') { ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); if (open) ctx.stroke(); else ctx.fill(); }
        else if (open) ctx.strokeRect(x - r, y - r, 2 * r, 2 * r); else ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
      }
    }
    drawOver() {
      const ctx = this.cOver.getContext('2d'), dpr = this.dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, this.W, this.H);
      const main = this.panels[0]; if (!main) return; const top = main.y, bot = this.panels[this.panels.length - 1].y + this.panels[this.panels.length - 1].h;
      // highlighted ranges (selection, linked rows)
      for (const h of (this.cfg.highlights ? this.cfg.highlights() : [])) {
        const x0 = Math.max(main.x, this.xToPx(h.x0)), x1 = Math.min(main.x + main.w, this.xToPx(h.x1)); if (x1 <= x0) continue;
        ctx.fillStyle = h.fill || 'rgba(27,54,93,0.10)'; ctx.fillRect(x0, top, x1 - x0, bot - top);
        if (h.edge !== false) { ctx.strokeStyle = 'rgba(27,54,93,0.55)'; ctx.lineWidth = 1; ctx.strokeRect(Math.round(x0) + 0.5, top + 0.5, Math.round(x1 - x0), bot - top - 1); }
      }
      // draggable lines (rulers, guides, fluorescence boundaries): lines first, then every label above them, then the handles
      const dls = this.dragLines().map(g => ({ g, x: Math.round(this.xToPx(g.x)) + 0.5 })).filter(d => d.x >= main.x && d.x <= main.x + main.w);
      for (const { g, x } of dls) { ctx.strokeStyle = g.color; ctx.lineWidth = 1; ctx.setLineDash(dashFor(g.dash)); ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bot); ctx.stroke(); ctx.setLineDash([]); }
      this.drawLabels(ctx);
      for (const { g, x } of dls) { ctx.fillStyle = g.color; ctx.fillRect(x - 4, top - 1, 8, 7); }
      for (const { g, x } of dls) {
        if (g.label) { ctx.font = FONT_S; ctx.textBaseline = 'top'; const tw = ctx.measureText(g.label).width, flip = (g.flip && x - 6 - tw >= main.x) || x + 6 + tw > main.x + main.w, lx = flip ? x - 6 - tw : x + 6, ly = top + 1 + (g.row || 0) * 11; ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(lx - 1, ly - 1, tw + 2, 13); ctx.fillStyle = g.color; ctx.textAlign = 'left'; ctx.fillText(g.label, lx, ly); }
      }
      if (this.cursorX != null && !this.dragging) { const x = Math.round(this.xToPx(this.cursorX)) + 0.5; ctx.strokeStyle = 'rgba(31,41,51,0.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bot); ctx.stroke(); }
      if (this.dragging && (this.dragging.kind === 'zoom' || this.dragging.kind === 'select')) {
        const d = this.dragging, x0 = Math.min(d.x0, d.x1), x1 = Math.max(d.x0, d.x1), y0 = d.kind === 'zoom' ? Math.min(d.y0, d.y1) : top, y1 = d.kind === 'zoom' ? Math.max(d.y0, d.y1) : bot;
        ctx.fillStyle = 'rgba(27,54,93,0.08)'; ctx.fillRect(x0, y0, x1 - x0, y1 - y0); ctx.strokeStyle = C.accent; ctx.lineWidth = 1; ctx.strokeRect(x0 + 0.5, y0 + 0.5, x1 - x0, y1 - y0);
      }
      ctx.textBaseline = 'alphabetic';
    }
    // labels drawn above the traces with a backing: interval labels, strip titles, marker and reference-line labels (also on the PNG, without drag lines)
    drawLabels(ctx, noDrag) {
      const main = this.panels[0]; if (!main) return;
      let ivRow = 0; ctx.font = FONT_S; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      for (const iv of (this.cfg.intervals ? this.cfg.intervals() : [])) { const x0 = Math.max(main.x, this.xToPx(iv.x0)); if (this.xToPx(iv.x1) < main.x || x0 >= main.x + main.w) continue; const y = main.y + 11 + ivRow * 16, tw = ctx.measureText(iv.label).width; ctx.fillStyle = 'rgba(255,255,255,0.88)'; ctx.fillRect(x0 + 1, y - 7, tw + 4, 14); ctx.fillStyle = iv.color || C.warn; ctx.fillText(iv.label, x0 + 3, y); ivRow = (ivRow + 1) % 3; }
      const tbox = [], hit = (b, list) => list.find(t => b[0] < t[2] && b[2] > t[0] && b[1] < t[3] && b[3] > t[1]);
      for (const p of this.panels) { const ax = p.cfg.yl; if (!p.cfg.px || !ax) continue; const t = (ax.short || ax.title) + (ax.unit ? ' (' + ax.unit + ')' : ''); ctx.font = FONT_S; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; const tw = ctx.measureText(t).width; ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(p.x + 2, p.y + 2, tw + 8, 16); ctx.fillStyle = C.text2; ctx.fillText(t, p.x + 6, p.y + 4); tbox.push([p.x + 2, p.y + 2, p.x + tw + 10, p.y + 18]); }
      const placed = [];
      for (const m of (this.markerLabels || [])) {
        ctx.font = FONT_S; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; const tw = ctx.measureText(m.label).width, box = y => [m.x - tw / 2 - 2, y - 13, m.x + tw / 2 + 2, y]; let y = m.y;
        for (let k = 0; k < 4; k++) { const t = hit(box(y), tbox), q = !t && hit(box(y), placed); if (!t && !q) break; y = t ? t[1] - 1 : q[1]; }
        placed.push(box(y)); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(m.x - tw / 2 - 2, y - 13, tw + 4, 13); ctx.fillStyle = m.color; ctx.fillText(m.label, m.x, y);
      }
      const drag = noDrag ? [] : this.dragLines();
      for (const L of (this.cfg.vlines ? this.cfg.vlines() : [])) { if (!L.label) continue; const x = Math.round(this.xToPx(L.x)) + 0.5; if (x < main.x || x > main.x + main.w) continue; ctx.font = FONT_S; ctx.textBaseline = 'middle'; const tw = ctx.measureText(L.label).width, right = L.align === 'right' ? x - 3 - tw >= main.x : L.align !== 'left' && x + 3 + tw > main.x + main.w, hits = a => drag.filter(g => { const v = this.xToPx(g.x); return v + 5 > a - 1 && v - 5 < a + tw + 1; }); let lx = right ? x - 3 - tw : x + 3, y = main.y + 8 + (L.row || 0) * 12; const h0 = L.row ? [] : hits(lx); if (h0.length) { const alt = right ? x + 3 : x - 3 - tw; if (alt >= main.x && alt + tw <= main.x + main.w && !hits(alt).length) lx = alt; else y = main.y + 8 + 12 * (1 + Math.max(...h0.map(g => g.row || 0))); } ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(lx - 1, y - 7, tw + 2, 14); ctx.fillStyle = L.color || C.text2; ctx.textAlign = 'left'; ctx.fillText(L.label, lx, y); }
    }
    dragLines() {
      const out = [];
      if (this.rulers && this.rulersOn) this.rulers.forEach((x, k) => out.push({ id: 'r' + k, x, color: this.cfg.rulerColor || C.v20, dash: 'solid', label: 'R' + (k + 1), flip: this.rulers[k] < this.rulers[1 - k], drag: v => { this.rulers[k] = v; } }));
      for (const g of (this.cfg.guides ? this.cfg.guides() : [])) out.push(g);
      return out;
    }
    /* ---------- readout bar ---------- */
    valueAt(s, x) {
      const d = s.src(); if (!d || !d.n) return null;
      if (s.mode === 'points') return null;
      let i = lb(d.x, d.n, x); if (i >= d.n) i = d.n - 1; if (i > 0 && Math.abs(d.x[i - 1] - x) <= Math.abs(d.x[i] - x)) i--;
      const [a, b] = this.xRange(), tol = (b - a) / this.pw * 6; if (Math.abs(d.x[i] - x) > Math.max(tol, s.tol || 0)) return null;
      return { i, y: d.y[i] };
    }
    updateReadout() {
      const live = this.cursorX == null;
      for (const s of this.series) {
        if (!s._valEl) continue;
        if (!s.visible) { s._valEl.textContent = ''; continue; }
        let v = null;
        if (live) { if (this.cfg.liveReadout === false) { s._valEl.textContent = ''; continue; } const d = s.src(); if (d && d.n && s.mode !== 'points') { let i = d.n - 1; while (i > 0 && !(d.y[i] === d.y[i])) i--; v = { i, y: d.y[i] }; } }
        else v = this.valueAt(s, this.cursorX);
        s._valEl.textContent = v && v.y === v.y ? (s.fmt ? s.fmt(v.y, v.i) : String(v.y)) : (s.mode === 'points' ? '' : '–');
      }
      let info = '';
      if (this.hoverMarker) info = this.hoverMarker;
      else if (this.cfg.info) info = this.cfg.info(this.cursorX, this);
      if (this.rulers && this.rulersOn && this.cfg.rulerInfo) info = this.cfg.rulerInfo(this.rulers[0], this.rulers[1]) + (info ? '   |   ' + info : '');
      this.infoEl.textContent = info || ' ';
    }
    /* ---------- interaction ---------- */
    bindEvents() {
      const el = this.cOver;
      const pos = e => { const r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
      el.addEventListener('mousemove', e => {
        const [x, y] = pos(e);
        if (this.dragging) {
          const d = this.dragging;
          if (d.kind === 'line') { const v = this.pxToX(Math.max(this.px0, Math.min(this.px0 + this.pw, x))); d.line.drag(v); if (d.line.onDrag) d.line.onDrag(v); this.overDirty = true; this.updateReadout(); this.drawOver(); return; }
          if (d.kind === 'pan') { const [a, b] = d.v0, dx = (x - d.x0) / this.pw * (b - a); this.view = [a - dx, b - dx]; this.invalidate(); return; }
          d.x1 = Math.max(this.px0, Math.min(this.px0 + this.pw, x)); d.y1 = y; this.drawOver(); return;
        }
        const inPlot = x >= this.px0 && x <= this.px0 + this.pw && y >= 0 && y <= this.H;
        this.cursorX = inPlot ? this.pxToX(x) : null;
        this.hoverMarker = null;
        for (const m of (this.markerHits || [])) if (Math.abs(x - m.x) <= 4 && y >= m.y0 && y <= m.y1) { this.hoverMarker = m.text; break; }
        const near = this.dragLines().find(g => Math.abs(this.xToPx(g.x) - x) <= 4);
        el.style.cursor = near ? 'ew-resize' : (this.mode === 'select' ? 'text' : 'crosshair');
        this.drawOver(); this.updateReadout();
        if (this.cfg.onHover) this.cfg.onHover(this.cursorX);
      });
      el.addEventListener('mouseleave', () => { if (!this.dragging) { this.cursorX = null; this.hoverMarker = null; this.drawOver(); this.updateReadout(); if (this.cfg.onHover) this.cfg.onHover(null); } });
      el.addEventListener('mousedown', e => {
        if (e.button !== 0) return; const [x, y] = pos(e); el.focus();
        const near = this.dragLines().find(g => Math.abs(this.xToPx(g.x) - x) <= 4);
        if (near) { this.dragging = { kind: 'line', line: near }; }
        else if (e.shiftKey && this.cfg.zoom !== false) this.dragging = { kind: 'pan', x0: x, v0: this.xRange().slice() };
        else if (x >= this.px0 && x <= this.px0 + this.pw) this.dragging = { kind: this.mode === 'select' ? 'select' : (this.cfg.zoom === false ? 'none' : 'zoom'), x0: x, y0: y, x1: x, y1: y };
        const up = ev => {
          window.removeEventListener('mouseup', up);
          const d = this.dragging; this.dragging = null; if (!d) return;
          if (d.kind === 'line') { if (d.line.onEnd) d.line.onEnd(d.line.x); this.updateReadout(); this.drawOver(); return; }
          if (d.kind === 'zoom' && Math.abs(d.x1 - d.x0) > 5) {
            const a = this.pxToX(Math.min(d.x0, d.x1)), b = this.pxToX(Math.max(d.x0, d.x1));
            const main = this.panels[0], s0 = this.scales[0].l;
            if (Math.abs(d.y1 - d.y0) > 12 && s0 && s0.lin && d.y0 >= main.y && d.y0 <= main.y + main.h) {
              const ya = s0.a + (main.y + main.h - Math.max(d.y0, d.y1)) / main.h * (s0.b - s0.a), yb = s0.a + (main.y + main.h - Math.min(d.y0, d.y1)) / main.h * (s0.b - s0.a);
              this.ylZoom = [ya, yb];
            }
            this.setView([a, b]);
          } else if (d.kind === 'select') {
            const a = this.pxToX(Math.min(d.x0, d.x1)), b = this.pxToX(Math.max(d.x0, d.x1));
            if (this.cfg.onSelect) this.cfg.onSelect(a, Math.abs(d.x1 - d.x0) > 3 ? b : a);
          } else if (d.kind === 'zoom' && this.cfg.onClick) this.cfg.onClick(this.pxToX(d.x0));
          this.drawOver();
        };
        window.addEventListener('mouseup', up);
      });
      el.addEventListener('contextmenu', e => { if (this.cfg.zoom === false) return; e.preventDefault(); this.popZoom(); });
      el.addEventListener('keydown', e => {
        if (e.key === 'Escape' && (this.view || this.ylZoom)) { this.resetZoom(); e.stopPropagation(); }
      });
    }
    toPNG(title) {
      const out = document.createElement('canvas'), dpr = this.dpr, titleH = 26, items = []; let lx = 8, lrow = 0; { const mc = out.getContext('2d'); mc.font = FONT; for (const s of this.series) { if (!s.visible || s.legend === false) continue; const w = 30 + mc.measureText(s.label).width; if (lx > 8 && lx + w > this.cBase.width / dpr - 8) { lx = 8; lrow++; } items.push({ s, x: lx, y: titleH + lrow * 20 }); lx += w; } } const legendH = 22 + lrow * 20;
      out.width = this.cBase.width; out.height = this.cBase.height + (legendH + titleH) * dpr; const ctx = out.getContext('2d');
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, out.width, out.height); ctx.scale(dpr, dpr);
      ctx.fillStyle = C.text; ctx.font = 'bold 13px Arial, "Liberation Sans", sans-serif'; ctx.fillText(title || '', 8, 17);
      ctx.font = FONT;
      for (const { s, x, y } of items) { ctx.strokeStyle = s.color; ctx.lineWidth = s.width || 1.25; ctx.setLineDash(dashFor(s.dash)); ctx.beginPath(); ctx.moveTo(x, y + 9); ctx.lineTo(x + 18, y + 9); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = C.text; ctx.fillText(s.label, x + 22, y + 13); }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const oy = (legendH + titleH) * dpr; ctx.drawImage(this.cBase, 0, oy); ctx.drawImage(this.cData, 0, oy);
      ctx.setTransform(dpr, 0, 0, dpr, 0, oy); this.drawLabels(ctx, true);
      return out.toDataURL('image/png');
    }
  }
  return { Chart, C, ticks, nice, dashFor };
})();
