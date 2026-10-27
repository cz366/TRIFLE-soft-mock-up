/* =====================================================================
   TRIFLE lifetime analysis for the run (Proposed): global lifetimes,
   decay-associated chromatograms named after the template's expected
   species, and species composition over any block range. No DOM access.
   Method after Hales et al., J Chromatogr A 1641, 461968 (2021).
   ===================================================================== */
const LTM = (function () {
  const S = M.S, fmt = M.fmt, L = TR.LTN;
  const H = 7;    // chromatograms use the mean decay over ±7 blocks: 15 s time resolution
  const PER = 20; // blocks per bin in the global fit
  // first global fit after 150 blocks, then each time the data grow by 30 %, or sooner when the fit degrades
  // (MISFIT), at most once every REFIT blocks
  const FIRST = 150, GROW = 1.3, MISFIT = 3, REFIT = 120;
  // Species colours follow the species, never their rank: product blue, impurity orange, flow-through aqua,
  // scatter neutral grey (validated categorical slots 1 to 3; see README)
  const COLORS = { sc: '#8C96A0', hcp: '#1BAF7A', mab: '#2A78D6', hmw: '#EB6834', empty: '#EB6834', full: '#2A78D6', other: '#6250D6' };
  const ybuf = new Float64Array(L), abuf = new Float64Array(TR.LT.kMax);
  // a block (or fraction) is buffer only when scatter gives over half its signal
  const BUFFER = 0.5;
  // detection (Proposed; development assumptions): a species region is where its amplitude stays above 5 % of its
  // own run maximum (gaps up to 20 blocks bridged, at least 10 blocks long) and it gives at least 5 % of the sample
  // fluorescence somewhere in the region; it is labelled at its apex. Two species co-elute where both give at least
  // 2 % for 60 blocks (1 min) or more, stretches of the same pair under 2 min apart counting as one
  const DET = { rel: 0.05, apexShare: 0.05, gap: 20, minLen: 10, coShare: 0.02, coMin: 60, coGap: 120 };

  function init(R) {
    const cap = R.acq.cap, sp = TR.SPECIES[R.spKey || 'protA'];
    // amp: amplitudes (V·ns) per expected species; sig: the same, but 0 where an amplitude is under 2 standard
    // errors (the log display, where noise around zero would otherwise look like signal); show: sig, and 0 for
    // every species while only buffer passes (buf: scatter over half the signal), so the traces are flat until
    // the sample reaches the flow cell
    const nan = () => new Float64Array(cap).fill(NaN);
    R.lt = { lib: sp, sc: sp.findIndex(q => q.key === 'sc'), fit: null, B: null, assign: [], amp: sp.map(nan), sig: sp.map(nan), show: sp.map(nan), other: nan(), otherSig: nan(), otherShow: nan(), buf: new Uint8Array(cap), chi: new Float32Array(cap), n: 0, gen: 1, job: null, nextFit: FIRST, lastStart: 0, fits: 0, kLogged: 0, feat: null };
  }
  // Mean decay over blocks j0..j1 (inclusive) that are neither discarded nor clipped; v is the mean noise variance
  function meanDecay(R, j0, j1, out) {
    const A = R.acq; out.fill(0); let c = 0, v = 0;
    for (let j = j0; j <= j1; j++) { if (A.disc[j] || A.clip[j]) continue; const o = j * L; for (let s = 0; s < L; s++) out[s] += A.dw[o + s]; v += A.dsd[j] * A.dsd[j]; c++; }
    if (c) for (let s = 0; s < L; s++) out[s] /= c;
    return { c, v: c ? v / (c * c) : NaN };
  }
  // Amplitudes for blocks i0..i1-1 from the decay window around each block (blocks up to nAvail-1 exist)
  function compute(R, i0, i1, nAvail) {
    const lt = R.lt, A = R.acq, B = lt.B; if (!B) return;
    const K = B.K, a = abuf.subarray(0, K), sp = lt.amp, sg = lt.sig, sh = lt.show;
    for (let i = i0; i < i1; i++) {
      for (let s = 0; s < sp.length; s++) sp[s][i] = sg[s][i] = sh[s][i] = NaN; lt.other[i] = lt.otherSig[i] = lt.otherShow[i] = NaN; lt.buf[i] = 0;
      if (A.disc[i]) continue;
      const m = meanDecay(R, Math.max(0, i - H), Math.min(nAvail - 1, i + H), ybuf); if (!m.c) continue;
      const rss = TR.ltFitDecay(B, ybuf, 0, a);
      for (let s = 0; s < sp.length; s++) sp[s][i] = sg[s][i] = 0; lt.other[i] = lt.otherSig[i] = 0;
      for (let k = 0; k < K; k++) {
        const s = lt.assign[k], ok = a[k] > 2 * Math.sqrt(m.v * B.dInv[k]);
        if (s >= 0) { sp[s][i] += a[k]; if (ok) sg[s][i] += a[k]; } else { lt.other[i] += a[k]; if (ok) lt.otherSig[i] += a[k]; }
      }
      lt.chi[i] = rss / (m.v * (L - K));
      let tot = lt.other[i]; for (let s = 0; s < sp.length; s++) tot += sp[s][i];
      const buf = lt.sc >= 0 && tot > 0 && sp[lt.sc][i] > BUFFER * tot; lt.buf[i] = buf ? 1 : 0;
      for (let s = 0; s < sp.length; s++) sh[s][i] = buf ? 0 : sg[s][i]; lt.otherShow[i] = buf ? 0 : lt.otherSig[i];
    }
  }
  function finalN(R) { return R.state === 'complete' ? R.derivedN : Math.max(0, R.derivedN - H); }
  function derive(R) { const lt = R.lt; if (!lt || !lt.B) return; const nf = finalN(R); if (nf > lt.n) { compute(R, lt.n, nf, R.derivedN); lt.n = nf; } }
  // the latest 30 blocks' mean reduced chi-squared: above 3, the current lifetimes no longer describe the data
  function misfit(R) { const lt = R.lt; let s = 0, c = 0; for (let i = Math.max(0, lt.n - 30); i < lt.n; i++) { const v = lt.chi[i]; if (v > 0) { s += v; c++; } } return c >= 10 && s / c > MISFIT; }
  function startJob(R, final) {
    const lt = R.lt, n = R.derivedN, bins = TR.ltBins(R.acq, 0, n, PER);
    lt.nextFit = Math.max(n + FIRST, Math.ceil(n * GROW)); lt.lastStart = n;
    if (bins.n < 5) return;
    lt.job = { gen: TR.ltGlobalGen(R.pmt, bins, lt.fit ? lt.fit.taus : null), bins, n, final };
  }
  function stepJob(R, budgetMs) {
    const lt = R.lt, t0 = performance.now();
    while (lt.job && performance.now() - t0 < budgetMs) {
      const r = lt.job.gen.next(); if (!r.done) continue;
      const job = lt.job; lt.job = null; apply(R, r.value, job);
      if (R.state === 'complete' && !job.final) startJob(R, true);
    }
  }
  function apply(R, res, job) {
    const lt = R.lt, se = TR.ltErrors(R.pmt, job.bins, res.taus, res.chi2r);
    lt.fit = { ...res, se, n: job.n, final: job.final, at: S.simT }; lt.fits++;
    lt.B = TR.ltBasis(R.pmt, res.taus); lt.assign = TR.ltAssign(res.taus, lt.lib);
    const nf = finalN(R); compute(R, 0, nf, R.derivedN); lt.n = nf; lt.gen++;
    if (res.taus.length !== lt.kLogged || job.final) {
      lt.kLogged = res.taus.length;
      M.log(R, 'system', 'Lifetime analysis' + (job.final ? ', final fit' : '') + ': ' + res.taus.length + ' component' + (res.taus.length > 1 ? 's' : '') + ', ' + res.taus.map((t, k) => t.toFixed(2) + ' ns' + (lt.assign[k] >= 0 ? ' (' + lt.lib[lt.assign[k]].short + ')' : '')).join(', ') + '; reduced χ² ' + res.chi2r.toFixed(2) + ' over ' + fmt.int(res.nBins) + ' bins.', { short: 'Lifetime analysis: ' + res.taus.length + ' component' + (res.taus.length > 1 ? 's' : '') + (job.final ? ' (final fit)' : '') + '.' });
    }
    M.emit('lt');
  }
  M.runHooks.push({
    init,
    derive(R) { derive(R); },
    tick(R) {
      const lt = R.lt; if (!lt) return;
      if (!lt.job && R.state === 'acquiring' && (R.derivedN >= lt.nextFit || (lt.fit && R.derivedN - lt.lastStart >= REFIT && misfit(R)))) startJob(R, false);
      if (lt.job) stepJob(R, R.state === 'complete' ? 60 : 12);
    },
    finish(R) { const lt = R.lt; if (!lt) return; derive(R); if (!lt.job) startJob(R, true); }
  });

  /* ---------- reading the analysis ---------- */
  function state(R) {
    const lt = R && R.lt; if (!lt) return 'none';
    if (!lt.fit) return lt.job ? 'fitting' : 'waiting';
    return lt.fit.final ? 'final' : (lt.job && lt.job.final ? 'finalising' : 'live');
  }
  // Components with their names, colours and lifetimes, in lifetime order
  function components(R) {
    const lt = R && R.lt; if (!lt || !lt.fit) return [];
    return lt.fit.taus.map((t, k) => { const m = lt.assign[k], sp = m >= 0 ? lt.lib[m] : null; return { k, m, key: sp ? sp.key : 'other', name: sp ? sp.name : 'Unassigned component', short: sp ? sp.short : 'Unassigned', tau: t, se: lt.fit.se[k], exp: sp ? sp.exp : NaN, color: COLORS[sp ? sp.key : 'other'], product: !!(sp && sp.product) }; });
  }
  // Species amplitudes at block i (V·ns), for the species the analysis has found
  function ampsAt(R, i) {
    const lt = R && R.lt; if (!lt || !lt.fit || !(i >= 0) || i >= lt.n) return null;
    const out = components(R).map(c => ({ ...c, a: c.m >= 0 ? lt.amp[c.m][i] : lt.other[i] })), tot = out.reduce((s, c) => s + (c.a || 0), 0);
    if (!out.length || !(tot === tot)) return null;
    out.forEach(c => { c.share = tot > 0 ? c.a / tot : NaN; }); return { comps: out, total: tot, chi2r: lt.chi[i] };
  }
  // Decomposition of the mean decay over blocks i0..i1-1, e.g. a fraction (amplitudes in V·ns and shares)
  function composition(R, i0, i1) {
    const lt = R && R.lt; if (!lt || !lt.B || i1 <= i0) return null;
    const m = meanDecay(R, i0, i1 - 1, ybuf); if (!m.c) return null;
    const K = lt.B.K, a = abuf.subarray(0, K); TR.ltFitDecay(lt.B, ybuf, 0, a);
    const comps = components(R).map(c => ({ ...c, a: a[c.k] })), tot = comps.reduce((s, c) => s + c.a, 0);
    comps.forEach(c => { c.share = tot > 0 ? c.a / tot : NaN; });
    return { comps, total: tot, n: m.c };
  }
  // The decay behind block i's amplitudes: data (mean over the window), fit, each component and the residuals
  function decayAt(R, i) {
    const lt = R && R.lt, A = R && R.acq; if (!lt || !A || !A.dw || !(i >= 0) || i >= R.derivedN || A.disc[i]) return null;
    const y = new Float64Array(L), m = meanDecay(R, Math.max(0, i - H), Math.min(R.derivedN - 1, i + H), y); if (!m.c) return null;
    const out = { i, y, nBlocks: m.c, sigma: Math.sqrt(m.v), j0: TR.ltJ0(R.pmt), comps: [], fit: null, res: null, chi2r: NaN };
    if (!lt.B) return out;
    const K = lt.B.K, a = new Float64Array(K), rss = TR.ltFitDecay(lt.B, y, 0, a), g = lt.B.g, fit = new Float64Array(L), res = new Float64Array(L);
    out.comps = components(R).map(c => { const v = new Float64Array(L); for (let s = 0; s < L; s++) { v[s] = a[c.k] * g[c.k * L + s]; fit[s] += v[s]; } return { ...c, a: a[c.k], y: v }; });
    for (let s = 0; s < L; s++) res[s] = (y[s] - fit[s]) / out.sigma;
    out.fit = fit; out.res = res; out.chi2r = rss / (m.v * (L - K)); out.total = a.reduce((s, v) => s + v, 0);
    return out;
  }
  // Detected species regions (peaks, each with its apex) and co-elution stretches, from the displayed amplitudes
  function features(R) {
    const lt = R && R.lt; if (!lt || !lt.fit) return { peaks: [], coel: [] };
    const key = lt.gen * 1e7 + lt.n; if (lt.feat && lt.feat.key === key) return lt.feat;
    const n = lt.n, lib = lt.lib, ms = lib.map((q, m) => m).filter(m => m !== lt.sc && lt.assign.includes(m)), tot = new Float64Array(n);
    for (let i = 0; i < n; i++) { let t = 0; for (const m of ms) { const v = lt.show[m][i]; if (v > 0) t += v; } tot[i] = t; }
    const runs = (ok, gap) => { const out = []; let a = -1, last = -1e9; for (let i = 0; i < n; i++) if (ok(i)) { if (a < 0 || i - last > gap) { if (a >= 0) out.push([a, last + 1]); a = i; } last = i; } if (a >= 0) out.push([a, last + 1]); return out; };
    const peaks = [], coel = [];
    for (const m of ms) {
      const y = lt.show[m]; let mx = 0; for (let i = 0; i < n; i++) if (y[i] > mx) mx = y[i]; if (!(mx > 0)) continue;
      for (const [a, b] of runs(i => y[i] >= DET.rel * mx, DET.gap)) {
        if (b - a < DET.minLen) continue; let ia = a, share = 0; for (let i = a; i < b; i++) { if (y[i] > y[ia]) ia = i; if (tot[i] > 0 && y[i] / tot[i] > share) share = y[i] / tot[i]; }
        if (share < DET.apexShare) continue;
        peaks.push({ m, key: lib[m].key, short: lib[m].short, name: lib[m].name, i0: a, i1: b, ia, h: y[ia], share });
      }
    }
    for (let x = 0; x < ms.length; x++) for (let z = x + 1; z < ms.length; z++) {
      const a = ms[x], b = ms[z], ya = lt.show[a], yb = lt.show[b];
      const ok = i => tot[i] > 0 && ya[i] >= DET.coShare * tot[i] && yb[i] >= DET.coShare * tot[i];
      // stretches that qualify on their own (gaps up to 20 blocks bridged, at least 1 min), then those of the pair
      // under 2 min apart joined, so one co-elution reads as one
      const segs = []; for (const g of runs(ok, DET.gap)) { if (g[1] - g[0] < DET.coMin) continue; const last = segs[segs.length - 1]; if (last && g[0] - last[1] < DET.coGap) last[1] = g[1]; else segs.push(g); }
      for (const [i0, i1] of segs) { let sa = 0, sb = 0; for (let i = i0; i < i1; i++) { sa += ya[i] > 0 ? ya[i] : 0; sb += yb[i] > 0 ? yb[i] : 0; }
        const minor = sa < sb ? a : b, ym = lt.show[minor]; let lo = 1, hi = 0;
        for (let i = i0; i < i1; i++) if (ok(i)) { const f = ym[i] / tot[i]; if (f < lo) lo = f; if (f > hi) hi = f; }
        coel.push({ a, b, i0, i1, minor, lo, hi, label: lib[a].short + ' + ' + lib[b].short, minorShort: lib[minor].short });
      }
    }
    return (lt.feat = { key, peaks, coel, tot });
  }
  // Composition of every fraction (Fraction review, Record exports)
  M.fracHooks.push((st, R, i0, i1) => { st.lt = composition(R, i0, i1); });

  return { H, PER, COLORS, BUFFER, DET, state, components, ampsAt, composition, decayAt, meanDecay, features };
})();
