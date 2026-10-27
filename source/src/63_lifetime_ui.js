/* =====================================================================
   Lifetime analysis UI (Proposed): species on the chromatograms, the
   composition row in Run values, the fraction composition column and
   the Engineer view Lifetimes tab.
   ===================================================================== */
(function () {
  const { $, $$, esc, el, tag } = UI, S = M.S, fmt = M.fmt, C = CH.C;
  const LTIP = 'Lifetime analysis (Proposed): every block decay is fitted as a non-negative sum of exponentials convolved with the stored IRF. The lifetimes are shared by the whole run and found from the data; the amplitudes are free for every block. No elution profile is assumed and no reference decays are used. Component names come from the method template\'s expected species (assumed).';
  // display order: the product first, then the other species from the longest expected lifetime down
  function order(lib) { return lib.map((s, m) => m).sort((a, b) => (lib[b].product ? 1 : 0) - (lib[a].product ? 1 : 0) || lib[b].exp - lib[a].exp); }
  const GAP = { vol: 1.0, cv: 0.25, min: 1.0, acq: 1.0 }, MODE = { vol: 1, cv: 2, min: 3, acq: 4 };
  // species amounts in the legend and readout: below 0.001 V·ns reads as such, not as a long run of zeros
  const amt = v => (v < 0.001 ? '< 0.001' : fmt.sig3(v)) + ' V·ns';
  function src(m) {
    return () => {
      const R = S.run; if (!R || !R.lt || !R.lt.fit) return null; const lt = R.lt, mode = RC.sa() ? 'acq' : RC.view.x, lg = RC.view.log;
      return { x: R.x[mode], y: m < 0 ? (lg ? lt.otherSig : lt.other) : (lg ? lt.sig[m] : lt.amp[m]), n: lt.n, brk: R.brk, maxGap: GAP[mode], gen: lt.gen * 80 + MODE[mode] * 2 + (lg ? 1 : 0) };
    };
  }
  /* ---------- species on Run and Fraction review ---------- */
  RC.extraSeries.push(() => {
    const R = S.run; if (!R || !R.lt) return [];
    const comps = LTM.components(R), lib = R.lt.lib, out = [];
    for (const m of order(lib)) {
      const c = comps.find(q => q.m === m); if (!c) continue;
      // Scientist view: species names; the lifetimes and the scatter background are Engineer view detail
      const sc = c.key === 'sc';
      out.push({ key: 'lt_' + c.key, label: c.short + (S.engineer ? ', ' + c.tau.toFixed(2) + ' ns' : ''), visible: S.engineer || !sc, legend: S.engineer || !sc, tip: c.name + ': decay-associated chromatogram, lifetime ' + c.tau.toFixed(2) + ' ns (template expects about ' + c.exp + ' ns). Mean decay over 15 s. On the log axis only amplitudes above 2 standard errors are drawn. Proposed.', color: c.color, width: c.key === 'sc' ? 1 : 1.6, panel: 'main', src: src(m), fmt: amt });
    }
    const other = comps.filter(c => c.m < 0);
    if (other.length) out.push({ key: 'lt_other', label: S.engineer ? 'Unassigned, ' + other.map(c => c.tau.toFixed(2)).join(', ') + ' ns' : 'Unassigned species', tip: 'A component with no expected species of a similar lifetime in the method template. It may be a new species, or may resolve as more of the run is fitted.', color: LTM.COLORS.other, width: 1.4, panel: 'main', src: src(-1), fmt: amt });
    return out;
  });
  const baseExtras = RC.legendExtras;
  RC.legendExtras = () => { const R = S.run, st = LTM.state(R); const ex = baseExtras(); if (st === 'none') return ex; const word = { waiting: 'waiting for signal', fitting: 'first fit running', live: 'updating', finalising: 'final fit running', final: 'final' }[st]; return [{ html: '<span class="ch-ll">' + (S.engineer ? 'Species: lifetime analysis, ' + word : 'Species by lifetime analysis' + (st === 'final' ? '' : ', ' + word)) + '</span> ' + tag('P', 'always'), tip: LTIP }, ...ex]; };
  RC.extraInfo.push((r, i) => { const a = LTM.ampsAt(r, i); if (!a) return ''; const top = a.comps.filter(c => c.share >= 0.01).sort((x, y) => y.share - x.share).slice(0, 3); return top.length ? ' · ' + top.map(c => c.short + ' ' + fmt.pct0(c.share) + ' %').join(', ') : ''; });

  /* ---------- composition: stacked bar plus the leading species ---------- */
  function compBar(comps, w) {
    const tot = comps.reduce((s, c) => s + Math.max(0, c.a), 0); if (!(tot > 0)) return '';
    const segs = comps.filter(c => c.a > 0).sort((a, b) => (b.product ? 1 : 0) - (a.product ? 1 : 0) || b.a - a.a);
    return '<span class="lt-bar" style="width:' + (w || 90) + 'px" title="' + esc(segs.map(c => c.name + ' ' + pct(c.a / tot) + ' %').join('; ')) + '">' + segs.map(c => '<span style="flex:' + (c.a / tot).toFixed(4) + ' 1 0;background:' + c.color + '"></span>').join('') + '</span>';
  }
  function pct(f) { return f >= 0.1 ? (f * 100).toFixed(0) : (f * 100).toFixed(1); }
  function compText(comps, n) { const tot = comps.reduce((s, c) => s + Math.max(0, c.a), 0); if (!(tot > 0)) return ''; return comps.filter(c => c.a / tot >= 0.005).sort((a, b) => b.a - a.a).slice(0, n || 4).map(c => c.short + ' ' + pct(c.a / tot) + ' %').join(' · '); }
  // Scientist view: the sample's species only. Scatter is the buffer's background, not fluorescence; where it gives
  // over half the signal the composition reads as background only
  function shown(comps) { return S.engineer ? comps : comps.filter(c => c.key !== 'sc'); }
  function background(comps) { const tot = comps.reduce((s, c) => s + Math.max(0, c.a), 0), sc = comps.find(c => c.key === 'sc'); return !S.engineer && !!sc && tot > 0 && sc.a / tot > 0.5; }
  function compCell(comps, w, n, cls) { return background(comps) ? '<span class="muted">Background only</span>' : '<span class="lt-cell' + (cls ? ' ' + cls : '') + '">' + compBar(shown(comps), w) + '<span>' + esc(compText(shown(comps), n)) + '</span></span>'; }
  window.LTUI = { compBar, compText, compCell, shown, background, LTIP };
  RC.runRows.push((R, i, row) => {
    const st = LTM.state(R); if (st === 'none') return '';
    const a = LTM.ampsAt(R, R.lt.n - 1), muted = t => '<span class="muted" style="font-weight:normal">' + t + '</span>';
    if (!a) return row('Species', '', muted(st === 'waiting' ? 'Lifetime analysis after 150 blocks' : 'Fitting lifetimes…'));
    if (background(a.comps)) return row('Species', '', muted('Background only'));
    return row('Species', '', '<span class="lt-cell wrap" title="Latest block, 15 s window">' + compBar(shown(a.comps), 56) + '<span>' + esc(compText(shown(a.comps), 2)) + '</span></span>');
  });
  function addFrCol() {
    const fr = UI.screen('fractions'); if (!fr || !fr.addCol) return;
    fr.addCol({ k: 'lt', h: 'Species <span class="unit">(lifetime analysis)</span>', tip: 'Share of the fraction\'s fluorescence in each species, from the mean decay of its blocks. Relative signal only: not mass, purity, yield or recovery. Proposed.', show: () => !!(S.run && S.run.lt && S.run.lt.fit), v: f => f.lt ? (f.lt.comps.find(c => c.product) || { share: -1 }).share : -1, f: f => f.lt ? compCell(f.lt.comps, 64, 2) : '–' }, 'qc');
  }

  /* ---------- Engineer view: Lifetimes ---------- */
  ENG.addTab('lt', 'Lifetimes', 'wf');
  let chiChart = null;
  const prev = window.ENG_EXTRA || {};
  window.ENG_EXTRA = Object.assign(prev, {
    lt: {
      html: () => {
        const R = S.run; if (!R || !R.lt) return '<div class="note">Start a run to see the lifetime analysis.</div>';
        const lt = R.lt, st = LTM.state(R), comps = LTM.components(R), lib = lt.lib, f = lt.fit;
        const stTxt = { waiting: 'Waiting for ' + fmt.int(150) + ' blocks', fitting: 'First fit running', live: 'Updating during the run', finalising: 'Final fit running', final: 'Final fit over the whole run' }[st];
        const sim = '<span class="tag" data-scope="always" title="Simulation parameter; a real run has no such column">Simulation</span>';
        const comp = !f ? '<div class="note">' + esc(stTxt) + '.</div>' : '<table class="tbl"><thead><tr><th>Component</th><th class="num">τ <span class="unit">(ns)</span></th><th class="num">SE <span class="unit">(ns)</span></th><th>Named as</th><th class="num">Expected <span class="unit">(ns)</span></th><th class="num">Simulated <span class="unit">(ns)</span> ' + sim + '</th></tr></thead><tbody>' +
          comps.map(c => '<tr><td><span class="ch-sw" style="border-top-color:' + c.color + '"></span> ' + (c.k + 1) + '</td><td class="num"><b>' + c.tau.toFixed(3) + '</b></td><td class="num">' + (isFinite(c.se) ? (c.se >= 0.001 ? c.se.toFixed(3) : '< 0.001') : '–') + '</td><td>' + esc(c.name) + '</td><td class="num">' + (isFinite(c.exp) ? c.exp : '–') + '</td><td class="num">' + (c.m >= 0 ? lib[c.m].tau : '–') + '</td></tr>').join('') + '</tbody></table>';
        const hist = !f ? '' : '<table class="tbl" style="margin-top:8px"><thead><tr><th class="num">Components</th><th class="num">Reduced χ²</th><th class="num">χ² drop</th><th class="num">Needed</th><th>Result</th><th>Lifetimes <span class="unit">(ns)</span></th></tr></thead><tbody>' +
          f.hist.map(h => '<tr><td class="num">' + h.K + '</td><td class="num">' + h.chi2r.toFixed(3) + '</td><td class="num">' + (h.gain != null ? fmt.int(Math.round(h.gain)) : '–') + '</td><td class="num">' + (h.gain != null ? fmt.int(TR.LT.gain * f.nBins) : '–') + '</td><td>' + (h.gain == null ? 'Start' : h.accepted ? 'Added' : 'Rejected') + '</td><td class="wrap">' + h.taus.map(t => t.toFixed(2)).join(', ') + '</td></tr>').join('') + '</tbody></table>';
        return '<div class="grid2 lt-grid"><div class="stack"><div class="panel"><div class="ph"><h3>Global lifetimes</h3>' + tag('P', 'always') + '<span class="sp"></span><span class="note">' + esc(stTxt) + '</span></div><div class="pb">' + comp +
          (f ? '<div class="small" style="margin-top:6px">Reduced χ² ' + f.chi2r.toFixed(3) + ' over ' + fmt.int(f.nBins) + ' bins of ' + LTM.PER + ' blocks (' + fmt.int(f.n) + ' blocks). SE from the curvature of χ², amplitudes profiled out, scaled by the reduced χ².</div>' : '') + '</div></div>' +
          '<div class="panel"><div class="ph"><h3>Number of components</h3></div><div class="pb">' + (hist || '<div class="note">After the first fit.</div>') + '<div class="small" style="margin-top:6px">A component is added only if χ² drops by more than ' + TR.LT.gain + ' per bin, the number of amplitudes it adds, and lifetimes stay at least a factor ' + TR.LT.sep + ' apart. ' + LTM.PER + '-block bins: the model is linear in the amplitudes, so a bin is itself a mixture of the same decays.</div></div></div></div>' +
          '<div class="stack"><div class="panel"><div class="ph"><h3>Method</h3></div><div class="pb small"><p>' + esc(LTIP) + '</p><p><b>Decay window.</b> ' + TR.LTN + ' samples (' + (TR.LTN * TR.DX).toFixed(0) + ' ns at ' + TR.DX + ' ns) from 5 ns before the IRF peak. Each block contributes the mean of its 10 waveforms, baseline removed and ND-corrected; clipped and discarded blocks are left out.</p><p><b>Amplitudes.</b> Exact non-negative least squares on the mean decay over ±' + LTM.H + ' blocks (15 s), so the chromatograms have 15 s time resolution and are in V·ns, the same units as total fluorescence. A fraction\'s composition uses the mean decay of all its blocks.</p><p><b>Live.</b> The first fit runs after 150 blocks, then each time the data grow by 30 %, or sooner when the mean reduced χ² of the latest 30 blocks rises above 3 (at most every 120 blocks), a few milliseconds per tick, starting from the previous lifetimes. A final fit runs when acquisition ends.</p><p><b>Reference.</b> Hales, Aoudjane, Aeppli and Dalby, Proof-of-concept analytical instrument for label-free optical deconvolution of protein species in a mixture, J Chromatogr A 1641, 461968 (2021); Uçan, Hales et al., J Chromatogr A 1711, 464463 (2023).</p></div></div>' +
          '<div class="panel"><div class="ph"><h3>Fit quality per block</h3></div><div class="pb" style="height:220px"><div id="ltChi" style="height:100%"></div></div></div></div></div>';
      },
      mount: () => {
        const R = S.run, host = $('#ltChi'); if (!R || !R.lt || !host) return;
        if (chiChart) chiChart.destroy();
        chiChart = new CH.Chart(host, {
          ariaLabel: 'Reduced chi-squared of each block\'s fit', topBand: 18, marginRight: 12, liveReadout: false,
          xDomain: () => [0, Math.max(1, R.x.acq[Math.max(0, R.derivedN - 1)])], xTitle: () => 'Time from TRIFLE start (min)',
          bands: () => R.standalone ? [] : R.ph.list.map(p => ({ x0: R.x.acq[Math.min(R.derivedN - 1, TR.lowerBound(R.x.min, R.derivedN, p.t0))] || 0, x1: R.x.acq[Math.min(R.derivedN - 1, TR.lowerBound(R.x.min, R.derivedN, p.t1))] || 0, label: p.name, short: p.short })),
          panels: [{ key: 'main', yl: { title: 'Reduced χ²', unit: '', log: () => true, minLog: -1 } }],
          series: [{ key: 'chi', label: 'Reduced χ², 15 s window', color: C.text, width: 1, panel: 'main', src: () => ({ x: R.x.acq, y: R.lt.chi, n: R.lt.n, gen: R.lt.gen }), fmt: v => v.toFixed(2) }]
        });
      }
    }
  });

  /* ---------- Questions panel ---------- */
  Q.addIntent((q, ctx) => {
    if (!/species|co-?elut|lifetime|decay map|\bcomponents?\b|aggregat|\bhmw\b|composition|deconvol|amplitude/.test(q)) return null;
    const R = ctx.run, src = 'Lifetime analysis (Proposed); Engineer view: Lifetimes';
    if (!R || !R.lt) return { text: 'Start a run. The lifetime analysis fits every block\'s fluorescence decay and separates species that elute together, without assuming a peak shape or using reference decays.', source: src };
    if (!R.lt.fit) return { text: 'The lifetime analysis has not fitted yet. The first global fit runs after 150 blocks; until then only total fluorescence is shown.', source: src };
    const comps = LTM.components(R), el = (R.tpl.fractions.elPhase || 'el'), st = M.fractionStats(R).filter(f => f.phaseKey === el && f.lt && f.complete && (f.lt.comps.find(c => c.product) || { share: 0 }).share >= 0.5);
    const prod = comps.find(c => c.product), imp = comps.filter(c => !c.product && c.key !== 'sc').map(c => ({ c, sh: st.map(f => ({ id: f.id, v: (f.lt.comps.find(x => x.k === c.k) || {}).share })).filter(x => isFinite(x.v)) })).filter(x => x.sh.length).sort((a, b) => Math.max(...b.sh.map(x => x.v)) - Math.max(...a.sh.map(x => x.v)))[0];
    let tail = '';
    if (imp && prod) { const lo = imp.sh.reduce((a, b) => b.v < a.v ? b : a), hi = imp.sh.reduce((a, b) => b.v > a.v ? b : a); tail = ' In the elution fractions where the product gives at least half the fluorescence, ' + imp.c.short + ' goes from ' + (lo.v * 100).toFixed(1) + ' % (' + lo.id + ') to ' + (hi.v * 100).toFixed(1) + ' % (' + hi.id + ') of fluorescence.'; }
    return { text: 'The lifetime analysis ' + (LTM.state(R) === 'final' ? '' : '(still updating) ') + 'fits every block\'s decay with lifetimes shared by the whole run and finds ' + comps.length + ' components: ' + comps.map(c => c.tau.toFixed(2) + ' ns (' + (c.m >= 0 ? c.name : 'unassigned') + ')').join(', ') + '. Each component\'s amplitude against time is drawn on the Run chart; the Decay panel shows the fit at any time.' + tail + ' Shares are fluorescence, not mass or purity; names come from the template (assumed).' + (R.spKey === 'aav' ? ' Confirm capsid content offline.' : ' Confirm aggregates with HPLC-SEC.'), source: src };
  });
  window.Q_EXTRA_CHIPS = window.Q_EXTRA_CHIPS || {};
  window.Q_EXTRA_CHIPS.run = (window.Q_EXTRA_CHIPS.run || []).concat(['Which species are co-eluting?']);
  window.Q_EXTRA_CHIPS.fractions = ['Which species are co-eluting?'].concat(window.Q_EXTRA_CHIPS.fractions || []);

  /* ---------- wiring ---------- */
  // refresh the Lifetimes tab after a refit; other Engineer tabs are left alone (they may hold an input being edited)
  M.on(ev => { const on = document.querySelector('#engTabs button.on'); if (ev === 'lt' && UI.cur() === 'engineer' && on && on.dataset.v === 'lt') UI.screen('engineer').show(); });
  setTimeout(() => { addFrCol(); UI.emitDirty(); }, 0);
})();
