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
  // Scientist view: the detected species only, flat while buffer passes. Engineer view: every amplitude (linear) or
  // those above 2 standard errors (log).
  function src(m) {
    return () => {
      const R = S.run; if (!R || !R.lt || !R.lt.fit) return null; const lt = R.lt, mode = RC.sa() ? 'acq' : RC.view.x, lg = RC.view.log, sci = !S.engineer;
      const y = m < 0 ? (sci ? lt.otherShow : lg ? lt.otherSig : lt.other) : (sci ? lt.show[m] : lg ? lt.sig[m] : lt.amp[m]);
      return { x: R.x[mode], y, n: lt.n, brk: R.brk, maxGap: GAP[mode], gen: lt.gen * 80 + MODE[mode] * 2 + (lg ? 1 : 0) + (sci ? 0.5 : 0) };
    };
  }
  function xs(R) { return R.x[RC.sa() ? 'acq' : RC.view.x]; }
  // detected peaks, labelled at their apex (Run and Fraction review overview)
  RC.annotations = () => {
    const R = S.run; if (!R || !R.lt || !R.lt.fit) return [];
    const x = xs(R), comps = LTM.components(R);
    return LTM.features(R).peaks.map(p => ({ x: x[p.ia], y: p.h, label: p.short, color: (comps.find(c => c.m === p.m) || {}).color || LTM.COLORS[p.key] }));
  };
  // co-elution stretches: a bar and label at the top of the chart
  RC.coelution = () => {
    const R = S.run; if (!R || !R.lt || !R.lt.fit) return [];
    const x = xs(R); return LTM.features(R).coel.map(c => ({ x0: x[c.i0], x1: x[Math.max(c.i0, c.i1 - 1)], label: 'Co-eluting: ' + c.label, color: C.accent }));
  };
  // the co-elution, if any, at block i
  function coAt(R, i) { return R && R.lt && R.lt.fit ? LTM.features(R).coel.find(c => i >= c.i0 && i < c.i1) || null : null; }
  /* ---------- species on Run and Fraction review ---------- */
  RC.extraSeries.push(() => {
    const R = S.run; if (!R || !R.lt) return [];
    const comps = LTM.components(R), lib = R.lt.lib, out = [];
    for (const m of order(lib)) {
      const c = comps.find(q => q.m === m); if (!c) continue;
      // Scientist view: species names; the lifetimes and the scatter background are Engineer view detail
      const sc = c.key === 'sc';
      out.push({ key: 'lt_' + c.key, label: c.short + (S.engineer ? ', ' + c.tau.toFixed(2) + ' ns' : ''), tipLabel: c.short, visible: S.engineer || !sc, legend: S.engineer || !sc, tip: c.name + ': decay-associated chromatogram, lifetime ' + c.tau.toFixed(2) + ' ns (template expects about ' + c.exp + ' ns). Mean decay over 15 s. ' + (S.engineer ? 'On the log axis only amplitudes above 2 standard errors are drawn.' : 'Drawn where the species is detected (above 2 standard errors) and flat while only buffer passes.') + ' Proposed.', color: c.color, width: sc ? 1.25 : 2, fill: sc ? 0 : 0.12, panel: 'main', src: src(m), fmt: amt });
    }
    const other = comps.filter(c => c.m < 0);
    if (other.length) out.push({ key: 'lt_other', label: S.engineer ? 'Unassigned, ' + other.map(c => c.tau.toFixed(2)).join(', ') + ' ns' : 'Unassigned species', tipLabel: 'Unassigned', tip: 'A component with no expected species of a similar lifetime in the method template. It may be a new species, or may resolve as more of the run is fitted.', color: LTM.COLORS.other, width: 1.75, fill: 0.08, panel: 'main', src: src(-1), fmt: amt });
    return out;
  });
  const baseExtras = RC.legendExtras;
  RC.legendExtras = () => { const R = S.run, st = LTM.state(R); const ex = baseExtras(); if (st === 'none') return ex; const word = { waiting: 'waiting for signal', fitting: 'first fit running', live: 'updating', finalising: 'final fit running', final: 'final' }[st]; return [{ html: '<span class="ch-ll">' + (S.engineer ? 'Species: lifetime analysis, ' + word : 'Species by lifetime analysis' + (st === 'final' ? '' : ', ' + word)) + '</span> ' + tag('P', 'always'), tip: LTIP }, ...ex]; };
  RC.extraInfo.push((r, i) => { const a = LTM.ampsAt(r, i); if (!a) return ''; if (background(a.comps)) return ' · Buffer only'; const cs = shown(a.comps), t = cs.reduce((s, c) => s + Math.max(0, c.a), 0); const top = cs.map(c => ({ c, f: t > 0 ? Math.max(0, c.a) / t : 0 })).filter(x => x.f >= 0.01).sort((x, y) => y.f - x.f).slice(0, 3); return top.length ? ' · ' + top.map(x => x.c.short + ' ' + fmt.pct0(x.f) + ' %').join(', ') : ''; });
  // tooltip footer on the Run chart: buffer, or the species co-eluting at the cursor
  RC.tipExtra = i => { const R = S.run; if (!R || !R.lt || !R.lt.fit || i == null || i >= R.lt.n) return ''; if (R.lt.buf[i]) return 'Buffer only'; const c = coAt(R, i); return c ? 'Co-eluting: ' + c.label : ''; };

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
  function isBuffer(comps) { const tot = comps.reduce((s, c) => s + Math.max(0, c.a), 0), sc = comps.find(c => c.key === 'sc'); return !!sc && tot > 0 && sc.a / tot > LTM.BUFFER; }
  function background(comps) { return !S.engineer && isBuffer(comps); }
  function compCell(comps, w, n, cls) { return background(comps) ? '<span class="muted">Buffer only</span>' : '<span class="lt-cell' + (cls ? ' ' + cls : '') + '">' + compBar(shown(comps), w) + '<span>' + esc(compText(shown(comps), n)) + '</span></span>'; }
  /* ---------- suggested next step for a fraction (Proposed; provisional limits in Engineer view → Rules) ---------- */
  // From the fraction's species shares of the sample fluorescence (scatter left out). Elution: Pool when the product
  // gives at least poolPct; HPLC-SEC to confirm the pool edge while the main impurity stays under exclPct; leave out
  // above that. Load: Protein A HPLC where the product gives at least breakPct (breakthrough). Shares are fluorescence,
  // not mass, so each suggestion is a candidate for the scientist to confirm.
  const SUG = { pool: 'Pool', sec: 'HPLC-SEC', proa: 'Protein A HPLC', none: 'No action', buffer: 'Buffer only' };
  function suggest(f) {
    const R = S.run; if (!R || !f || !f.lt || !f.complete) return null;
    const comps = f.lt.comps; if (isBuffer(comps)) return { k: 'buffer', label: SUG.buffer, why: 'Scatter gives over half the signal: no sample in this fraction.' };
    const cs = comps.filter(c => c.key !== 'sc'), tot = cs.reduce((s, c) => s + Math.max(0, c.a), 0); if (!(tot > 0)) return null;
    const pc = cs.find(c => c.product), p = pc ? Math.max(0, pc.a) / tot : 0, imp = cs.filter(c => !c.product).map(c => ({ c, f: Math.max(0, c.a) / tot })).sort((a, b) => b.f - a.f)[0];
    const th = S.th, sh = x => pct(x) + ' %', fx = R.tpl.fractions;
    if (f.phaseKey === (fx.elPhase || 'el') && pc) {
      if (p * 100 >= th.poolPct) return { k: 'pool', label: SUG.pool, why: pc.short + ' ' + sh(p) + (imp ? ', ' + imp.c.short + ' ' + sh(imp.f) : '') + ' of the sample fluorescence (Pool at ' + th.poolPct + ' % or more).' };
      if (imp && imp.f * 100 >= th.exclPct) return { k: 'none', label: SUG.none, why: imp.c.short + ' ' + sh(imp.f) + ' of the sample fluorescence (' + th.exclPct + ' % or more): rich in ' + imp.c.short + ', leave out of the pool.' };
      return { k: 'sec', label: SUG.sec, why: (imp ? imp.c.short + ' ' + sh(imp.f) : pc.short + ' ' + sh(p)) + ' co-eluting with the product: confirm the pool edge by HPLC-SEC.' };
    }
    if (f.phaseKey === fx.loadPhase && pc && p * 100 >= th.breakPct) return { k: 'proa', label: SUG.proa, why: pc.short + ' ' + sh(p) + ' of the flow-through fluorescence (' + th.breakPct + ' % or more): possible breakthrough, confirm the titre.' };
    return null;
  }
  window.LTUI = { compBar, compText, compCell, shown, background, isBuffer, suggest, SUG, LTIP };
  RC.runRows.push((R, i, row) => {
    const st = LTM.state(R); if (st === 'none') return '';
    const a = LTM.ampsAt(R, R.lt.n - 1), muted = t => '<span class="muted" style="font-weight:normal">' + t + '</span>';
    if (!a) return row('Species', '', muted(st === 'waiting' ? 'Lifetime analysis after 150 blocks' : 'Fitting lifetimes…'));
    if (background(a.comps)) return row('Species', '', muted('Buffer only'));
    const co = coAt(R, R.lt.n - 1);
    return row('Species', '', '<span class="lt-cell wrap" title="Latest block, 15 s window">' + compBar(shown(a.comps), 56) + '<span>' + esc(compText(shown(a.comps), 2)) + '</span></span>') +
      row('Co-eluting', '', co ? esc(co.label) : muted('None'));
  });
  function addFrCol() {
    const fr = UI.screen('fractions'); if (!fr || !fr.addCol) return;
    fr.addCol({ k: 'lt', h: 'Species <span class="unit">(lifetime analysis)</span>', tip: 'Share of the fraction\'s fluorescence in each species, from the mean decay of its blocks. Relative signal only: not mass, purity, yield or recovery. Proposed.', show: () => !!(S.run && S.run.lt && S.run.lt.fit), v: f => f.lt ? (f.lt.comps.find(c => c.product) || { share: -1 }).share : -1, f: f => f.lt ? compCell(f.lt.comps, 64, 2) : '–' }, 'qc');
    fr.addCol({ k: 'sug', h: 'Suggested ' + tag('P', 'always'), tip: 'A next step from the species shares (Proposed; provisional limits in Engineer view → Rules): Pool, HPLC-SEC to confirm the pool edge, leave out, or Protein A HPLC on the flow-through. Shares are fluorescence, not mass, so confirm before pooling.', show: () => !!(S.run && S.run.lt && S.run.lt.fit), v: f => { const g = suggest(f); return g ? ['pool', 'sec', 'proa', 'none', 'buffer'].indexOf(g.k) : 9; }, f: f => { const g = suggest(f); return g && g.k !== 'buffer' ? '<span class="sug sug-' + g.k + '" title="' + esc(g.why) + '">' + esc(g.label) + '</span>' : ''; } }, 'cards');
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
          '<div class="stack"><div class="panel"><div class="ph"><h3>Method</h3></div><div class="pb small"><p>' + esc(LTIP) + '</p><p><b>Decay window.</b> ' + TR.LTN + ' samples (' + (TR.LTN * TR.DX).toFixed(0) + ' ns at ' + TR.DX + ' ns) from 5 ns before the IRF peak. Each block contributes the mean of its 10 waveforms, baseline removed and ND-corrected; clipped and discarded blocks are left out.</p><p><b>Amplitudes.</b> Exact non-negative least squares on the mean decay over ±' + LTM.H + ' blocks (15 s), so the chromatograms have 15 s time resolution and are in V·ns, the same units as total fluorescence. A fraction\'s composition uses the mean decay of all its blocks.</p><p><b>Live.</b> The first fit runs after 150 blocks, then each time the data grow by 30 %, or sooner when the mean reduced χ² of the latest 30 blocks rises above 3 (at most every 120 blocks), a few milliseconds per tick, starting from the previous lifetimes. A final fit runs when acquisition ends.</p><p><b>Final version.</b> A multivariate fit of the decays will replace this analysis for the readout (Future). The species traces, the peak and co-elution detection and the fraction suggestions take its amplitudes unchanged.</p><p><b>Detection (Proposed).</b> Buffer only where scatter gives over half the signal; there every species is drawn at zero. A species region is where its amplitude stays above ' + Math.round(LTM.DET.rel * 100) + ' % of its run maximum (gaps up to ' + LTM.DET.gap + ' blocks bridged), labelled at its apex when it gives at least ' + Math.round(LTM.DET.apexShare * 100) + ' % of the sample fluorescence somewhere in it. Two species co-elute where both give at least ' + Math.round(LTM.DET.coShare * 100) + ' % for ' + LTM.DET.coMin + ' blocks or more (stretches under ' + LTM.DET.coGap + ' blocks apart count as one).</p><p><b>Reference.</b> Hales, Aoudjane, Aeppli and Dalby, Proof-of-concept analytical instrument for label-free optical deconvolution of protein species in a mixture, J Chromatogr A 1641, 461968 (2021); Uçan, Hales et al., J Chromatogr A 1711, 464463 (2023).</p></div></div>' +
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
  // fraction IDs in run order, consecutive ones as a range: E02 to E05, E07
  function ranges(ids, all) { const ix = ids.map(id => all.indexOf(id)).sort((a, b) => a - b), out = []; for (let k = 0; k < ix.length; k++) { let j = k; while (j + 1 < ix.length && ix[j + 1] === ix[j] + 1) j++; out.push(j > k ? all[ix[k]] + ' to ' + all[ix[j]] : all[ix[k]]); k = j; } return out.join(', '); }
  Q.addIntent((q, ctx) => {
    if (!/\bpool|which fractions (should|to)|suggest|what (should|do) i (test|send)/.test(q)) return null;
    const R = ctx.run, src = 'Fraction review: Suggested (Proposed; limits in Engineer view → Rules)';
    if (!R || !R.lt || !R.lt.fit) return { text: 'After the lifetime analysis has fitted the run, Fraction review suggests for each fraction whether to pool it, confirm it by HPLC-SEC, take no action or, on the flow-through, check it by Protein A HPLC.', source: src };
    const st = M.fractionStats(R), all = st.map(f => f.id), by = {}; st.forEach(f => { const g = suggest(f); if (g) (by[g.k] = by[g.k] || []).push(f.id); });
    const th = S.th, part = [];
    if (by.pool) part.push('pool ' + ranges(by.pool, all) + ' (product at least ' + th.poolPct + ' % of the sample fluorescence)');
    if (by.sec) part.push('confirm ' + ranges(by.sec, all) + ' by HPLC-SEC before deciding the pool edge');
    if (by.none) part.push('no action on ' + ranges(by.none, all) + ' (an impurity at ' + th.exclPct + ' % or more)');
    if (by.proa) part.push('check ' + ranges(by.proa, all) + ' by Protein A HPLC for breakthrough');
    if (!part.length) return { text: 'No fraction has a suggestion yet' + (R.state === 'complete' ? '.' : ': fractions are suggested once fully collected.'), source: src };
    return { text: 'Suggested from the species shares' + (LTM.state(R) === 'final' ? '' : ' (still updating)') + ': ' + part.join('; ') + '. Shares are fluorescence, not mass, so confirm before pooling. Apply suggestions in Fraction review copies them into the decisions of undecided fractions; each stays yours to change.', source: src };
  });
  Q.addIntent((q, ctx) => {
    if (!/species|co-?elut|lifetime|decay map|\bcomponents?\b|aggregat|\bhmw\b|composition|deconvol|amplitude/.test(q)) return null;
    const R = ctx.run, src = 'Lifetime analysis (Proposed); Engineer view: Lifetimes';
    if (!R || !R.lt) return { text: 'Start a run. The lifetime analysis fits every block\'s fluorescence decay and separates species that elute together, without assuming a peak shape or using reference decays.', source: src };
    if (!R.lt.fit) return { text: 'The lifetime analysis has not fitted yet. The first global fit runs after 150 blocks; until then only total fluorescence is shown.', source: src };
    const comps = LTM.components(R), el = (R.tpl.fractions.elPhase || 'el'), st = M.fractionStats(R).filter(f => f.phaseKey === el && f.lt && f.complete && (f.lt.comps.find(c => c.product) || { share: 0 }).share >= 0.5);
    const prod = comps.find(c => c.product), imp = comps.filter(c => !c.product && c.key !== 'sc').map(c => ({ c, sh: st.map(f => ({ id: f.id, v: (f.lt.comps.find(x => x.k === c.k) || {}).share })).filter(x => isFinite(x.v)) })).filter(x => x.sh.length).sort((a, b) => Math.max(...b.sh.map(x => x.v)) - Math.max(...a.sh.map(x => x.v)))[0];
    let tail = '';
    if (imp && prod) { const lo = imp.sh.reduce((a, b) => b.v < a.v ? b : a), hi = imp.sh.reduce((a, b) => b.v > a.v ? b : a); tail = ' In the elution fractions where the product gives at least half the fluorescence, ' + imp.c.short + ' goes from ' + (lo.v * 100).toFixed(1) + ' % (' + lo.id + ') to ' + (hi.v * 100).toFixed(1) + ' % (' + hi.id + ') of fluorescence.'; }
    const xm = R.x.min, co = LTM.features(R).coel.map(c => c.label + ' from ' + fmt.min1(xm[c.i0]) + ' to ' + fmt.min1(xm[c.i1 - 1]) + ' min (' + c.minorShort + ' ' + pct(c.lo) + ' to ' + pct(c.hi) + ' %)');
    return { text: 'The lifetime analysis ' + (LTM.state(R) === 'final' ? '' : '(still updating) ') + 'fits every block\'s decay with lifetimes shared by the whole run and finds ' + comps.length + ' components: ' + comps.map(c => c.tau.toFixed(2) + ' ns (' + (c.m >= 0 ? c.name : 'unassigned') + ')').join(', ') + '. Each component\'s amplitude against time is drawn on the Run chart; the Decay panel shows the fit at any time.' + (co.length ? ' Co-eluting: ' + co.join('; ') + '.' : '') + tail + ' Shares are fluorescence, not mass or purity; names come from the template (assumed).' + (R.spKey === 'aav' ? ' Confirm capsid content offline.' : ' Confirm aggregates with HPLC-SEC.'), source: src };
  });
  window.Q_EXTRA_CHIPS = window.Q_EXTRA_CHIPS || {};
  window.Q_EXTRA_CHIPS.run = (window.Q_EXTRA_CHIPS.run || []).concat(['Which species are co-eluting?']);
  window.Q_EXTRA_CHIPS.fractions = ['Which fractions should I pool?', 'Which species are co-eluting?'].concat(window.Q_EXTRA_CHIPS.fractions || []);

  /* ---------- wiring ---------- */
  // refresh the Lifetimes tab after a refit; other Engineer tabs are left alone (they may hold an input being edited)
  M.on(ev => { const on = document.querySelector('#engTabs button.on'); if (ev === 'lt' && UI.cur() === 'engineer' && on && on.dataset.v === 'lt') UI.screen('engineer').show(); });
  setTimeout(() => { addFrCol(); UI.emitDirty(); }, 0);
})();
