/* =====================================================================
   Stage 2 model: calibration (Proposed), decay-shape analysis (Proposed,
   research hypothesis only), run comparison (Proposed). No DOM access.
   ===================================================================== */
window.STAGE2 = true;
const S2 = (function () {
  const S = M.S, fmt = M.fmt;
  Object.assign(S.th, { calDepPct: 5, calExpiryDays: 30, decayThrNs: 0.2, decaySdMult: 3, decayUseMin: 0.20, decayUseMax: 0.90, decayWinMl: 0.5 });
  Object.assign(M.TH_INFO, {
    calDepPct: ['Calibration linear range: largest departure from the fit', '%'], calExpiryDays: ['Calibration expires after', 'days'],
    decayThrNs: ['P7: decay metric shift larger than', 'ns'], decaySdMult: ['P7: shift larger than this multiple of the elution-front SD', '× SD'],
    decayUseMin: ['Decay metric computed only above this input range use', 'fraction'], decayUseMax: ['Decay metric computed only below this input range use', 'fraction'], decayWinMl: ['P7: comparison window', 'mL']
  });
  // Stage 2 rules in the catalogue (discrepancy 1). The Stage 2 prompt names "Calibration not applicable" I6;
  // I6 is already the Stage 1 laser-change rule, so it is I7 here. IDs are never reused or renumbered.
  M.RULES.push(
    { id: 'I7', src: 'Stage 2, section 1', cond: th => 'The active calibration does not apply: different PMT preset or processing mode, older than ' + th.calExpiryDays + ' days, or no demonstrated linear range.' },
    { id: 'P6', src: 'Stage 2, section 1', cond: () => 'Fluorescence above the calibrated linear range within a fraction.' },
    { id: 'P7', src: 'Stage 2, section 2.3', cond: th => 'Decay metric over ' + th.decayWinMl + ' mL shifted from the elution-front reference by more than ' + th.decayThrNs + ' ns and ' + th.decaySdMult + ' × SD, where fluorescence is at least 20 times the buffer baseline (decay analysis on).' },
    { id: 'H3', src: 'Stage 2, section 2.3', cond: () => 'Raised with P7. Possible change in tryptophan environment. Confirm with HPLC-SEC on the linked fractions.' }
  );
  S.proc.decay = false;
  function sgn(d, dp) { return (d > 0 ? '+' : d < 0 ? '−' : '') + Math.abs(d).toFixed(dp); }
  function addDays(date, n) { const d = new Date(date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function today() { return M.wall(S.simT).date; }

  /* ---------- calibration (section 1) ---------- */
  const LEVELS = [0.1, 0.5, 1, 2, 5, 10];
  const SCHED = { pre: 3, on: 4, off: 2, edge: 0.12 };
  const MAT = {
    IgG: { name: 'Purified IgG', k: 1.0, eps: 1.4, lot: 'SIM-IgG-0425', note: 'Default standard.' },
    BSA: { name: 'BSA', k: 0.25, eps: 0.667, lot: 'SIM-BSA-0611', note: 'Weak surrogate for IgG: extinction coefficient 0.667 against about 1.4 to 1.6 mL/mg/cm, fewer tryptophans and a different size.' }
  };
  function schedule() { const steps = []; let t = SCHED.pre; for (const c of LEVELS) { steps.push({ c, t0: t, t1: t + SCHED.on }); t += SCHED.on + SCHED.off; } return { steps, total: t }; }
  const sims = {};
  function simulate(material, pmt) {
    const key = material + pmt; if (sims[key]) return sims[key];
    const sch = schedule(), m = MAT[material], kF = 0.471 * m.k, a = 0.03 * m.eps / 1.4;
    const acq = TR.createAcq({
      seed: TR.SEED, stream: (material === 'IgG' ? 40 : 50) + (pmt === 800 ? 1 : 0), pmt, ...M.pmtSim(pmt), cap: Math.ceil(sch.total * 60) + 20, tEnd: sch.total * 60,
      signalAt: tS => { const t = tS / 60; let c = 0; for (const s of sch.steps) c += s.c * (TR.sig((t - s.t0) / SCHED.edge) - TR.sig((t - s.t1) / SCHED.edge)); const g = c > 1e-9 ? (1 - Math.exp(-a * c)) / (a * c) : 1; return { S: 0.0080 * (1 + 0.004 * TR.smoothNoise(TR.SEED + 5, t, [3.1, 7.7])) + kF * c * g, tau: 3.5, E: 1, u: t, vp: 0, phase: 0, c }; }
    });
    TR.acqStep(acq, 1e9);
    return (sims[key] = { material, pmt, acq, sch, t: Float64Array.from(acq.t.subarray(0, acq.n), x => x / 60) });
  }
  function fluor(sim) { const A = sim.acq, k = M.comboIdx(), y = new Float64Array(A.n); for (let i = 0; i < A.n; i++) y[i] = A.disc[i] ? NaN : A.F[k][i]; return y; }
  function plateaus(sim, y, windows) {
    const A = sim.acq, t = sim.t, n = A.n, out = [];
    const sm = new Float64Array(n); for (let i = 0; i < n; i++) { let s = 0, c = 0; for (let k = Math.max(0, i - 2); k <= Math.min(n - 1, i + 2); k++) if (y[k] === y[k]) { s += y[k]; c++; } sm[i] = c ? s / c : NaN; }
    const edge = (tc, dir) => { let best = tc, bv = 0; for (let i = 5; i < n - 5; i++) { if (Math.abs(t[i] - tc) > 1) continue; const d = (sm[i + 5] - sm[i - 5]) * dir; if (d > bv) { bv = d; best = t[i]; } } return best; };
    sim.sch.steps.forEach((s, k) => {
      const rise = edge(s.t0, 1), fall = edge(s.t1, -1), auto = [rise + 0.8, fall - 0.3], w = windows && windows[k] ? windows[k] : auto;
      const v = []; for (let i = 0; i < n; i++) if (t[i] >= w[0] && t[i] <= w[1] && y[i] === y[i]) v.push(y[i]);
      const mean = v.reduce((a, b) => a + b, 0) / v.length, sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) * (b - mean), 0) / Math.max(1, v.length - 1));
      out.push({ c: s.c, rise, fall, auto, w, manual: !!(windows && windows[k]), n: v.length, mean, sd, cv: sd / mean });
    });
    return out;
  }
  function weights(model, x) { return x.map(c => model === 'unweighted' ? 1 : model === '1/x' ? 1 / c : 1 / (c * c)); }
  function fit(pl, model, crit) {
    const x = pl.map(p => p.c), y = pl.map(p => p.mean); let best = null;
    for (let n = x.length; n >= 3; n--) {
      const f = TR.linreg(x.slice(0, n), y.slice(0, n), weights(model, x.slice(0, n)));
      const dep = x.slice(0, n).map((c, i) => (y[i] - (f.a + f.b * c)) / (f.a + f.b * c) * 100);
      if (Math.max(...dep.map(Math.abs)) <= crit) { best = { a: f.a, b: f.b, n }; break; }
    }
    if (!best) { const f = TR.linreg(x.slice(0, 3), y.slice(0, 3), weights(model, x.slice(0, 3))); best = { a: f.a, b: f.b, n: 0 }; }
    const dep = x.map((c, i) => (y[i] - (best.a + best.b * c)) / (best.a + best.b * c) * 100);
    return { a: best.a, b: best.b, n: best.n, lo: best.n ? x[0] : null, hi: best.n ? x[best.n - 1] : null, onset: best.n && best.n < x.length ? x[best.n] : null, dep, model, crit, yLo: best.n ? best.a + best.b * x[0] : null, yHi: best.n ? best.a + best.b * x[best.n - 1] : null };
  }
  const cal = S.cal = { material: 'IgG', model: '1/x', windows: {}, records: [], activeId: null, seq: 7 };
  function current() {
    const sim = simulate(cal.material, S.setup.pmt), y = fluor(sim), pl = plateaus(sim, y, cal.windows[cal.material + S.setup.pmt]);
    return { sim, y, pl, fit: fit(pl, cal.model, S.th.calDepPct), material: cal.material, pmt: S.setup.pmt, mode: M.procLabel() };
  }
  function procKey() { return JSON.stringify([S.proc.median, S.proc.window, S.proc.laser]); }
  function makeRecord(cur, date, id) {
    const pi = M.presetInfo(cur.pmt), m = MAT[cur.material];
    const rec = { id: id || ('CAL-P' + cur.pmt + '-' + String(++cal.seq).padStart(4, '0')), date, material: cur.material, materialName: m.name, lot: m.lot, pmt: cur.pmt, presetId: pi.id, mode: cur.mode, procKey: procKey(), expiry: addDays(date, S.th.calExpiryDays), fit: cur.fit, levels: cur.pl.map(p => p.c), means: cur.pl.map(p => p.mean), cvs: cur.pl.map(p => p.cv) };
    cal.records.push(rec); return rec;
  }
  function active() { return cal.records.find(r => r.id === cal.activeId) || null; }
  function status(R) {
    const rec = active(); if (!rec) return { ok: false, none: true, reasons: ['No calibration selected.'] };
    const pmt = R ? R.pmt : S.setup.pmt, reasons = [];
    if (rec.pmt !== pmt) reasons.push('PMT preset differs (calibration ' + rec.presetId + ', run ' + M.presetInfo(pmt).id + ')');
    if (rec.procKey !== procKey()) reasons.push('processing mode differs (calibration ' + rec.mode + ', run ' + M.procLabel() + ')');
    if (today() > rec.expiry) reasons.push('expired on ' + rec.expiry);
    if (!rec.fit.n) reasons.push('no demonstrated linear range');
    return { ok: reasons.length === 0, rec, reasons };
  }
  function conc(F, R, phaseKey) {
    const st = status(R); if (!st.ok || !isFinite(F)) return { state: 'na', st };
    if (phaseKey && phaseKey !== 'el') return { state: 'mixed', st };
    const f = st.rec.fit, c = (F - f.a) / f.b;
    return { state: c > f.hi ? 'above' : c < f.lo ? 'below' : 'in', c, st };
  }
  function concText(F, R, phaseKey) {
    const k = conc(F, R, phaseKey); if (k.state === 'na') return k.st.none ? '' : 'Calibration not applicable';
    if (k.state === 'mixed') return '–';
    if (k.state === 'above') return 'Above range'; if (k.state === 'below') return 'Below range';
    return fmt.sig3(k.c) + ' mg/mL (indicative)';
  }
  function initRecord() {
    const keep = S.proc.median || S.proc.window || S.proc.laser;
    const cur0 = { ...current(), mode: 'v2.0 reference' };
    if (!keep) { const r = makeRecord(cur0, '2026-10-02', 'CAL-P400-0007'); cal.activeId = r.id; }
  }

  /* ---------- decay-shape analysis (section 2) ---------- */
  const irf = {}; function irfInfo(pmt) { return irf[pmt] || (irf[pmt] = TR.irfStats(TR.irfCurve(TR.IRF_TERMS[pmt]))); }
  // Optional reconvolution fit (Engineer view): single exponential convolved with the stored IRF; A solved linearly.
  function reconFit(v, pmt) {
    const h = TR.irfCurve(TR.IRF_TERMS[pmt]), st = irfInfo(pmt), b = TR.median(v, 0, 100), d = new Float64Array(600);
    for (let j = 0; j < 600; j++) d[j] = -(v[j] - b);
    let sd = TR.pstd(v, 0, 100); const q = (Math.max(...v) - Math.min(...v)) / 254; sd = Math.max(sd, q / Math.sqrt(12), 1e-7);
    const i0 = Math.max(0, st.peakIdx - 10), i1 = Math.min(599, st.peakIdx + 100), tmp = new Float64Array(600);
    const model = tau => { TR.convExp(h, tau, tmp); const m = new Float64Array(600); for (let j = 0; j < 600; j++) m[j] = -tmp[j]; return m; };
    const sig = new Float64Array(600); for (let j = 0; j < 600; j++) sig[j] = Math.sqrt(sd * sd + (0.006 * Math.abs(d[j])) * (0.006 * Math.abs(d[j])));
    const chi = tau => { const m = model(tau); let sdm = 0, smm = 0; for (let j = i0; j <= i1; j++) { const w = 1 / (sig[j] * sig[j]); sdm += w * d[j] * m[j]; smm += w * m[j] * m[j]; } const A = sdm / smm; let c2 = 0; for (let j = i0; j <= i1; j++) { const r = (d[j] - A * m[j]) / sig[j]; c2 += r * r; } return { c2, A, m }; };
    let lo = 0.8, hi = 8, g = (Math.sqrt(5) - 1) / 2, x1 = hi - g * (hi - lo), x2 = lo + g * (hi - lo), f1 = chi(x1).c2, f2 = chi(x2).c2;
    for (let k = 0; k < 60; k++) { if (f1 < f2) { hi = x2; x2 = x1; f2 = f1; x1 = hi - g * (hi - lo); f1 = chi(x1).c2; } else { lo = x1; x1 = x2; f1 = f2; x2 = lo + g * (hi - lo); f2 = chi(x2).c2; } }
    const tau = (lo + hi) / 2, best = chi(tau), hh = 0.01, cp = chi(tau + hh).c2, cm = chi(tau - hh).c2, curv = (cp - 2 * best.c2 + cm) / (hh * hh);
    const N = i1 - i0 + 1, res = new Float64Array(600).fill(NaN), fitv = new Float64Array(600).fill(NaN);
    for (let j = i0; j <= i1; j++) { fitv[j] = best.A * best.m[j]; res[j] = (d[j] - fitv[j]) / sig[j]; }
    return { tau, sigTau: curv > 0 ? Math.sqrt(2 / curv) : NaN, A: best.A, chi2: best.c2, chi2r: best.c2 / (N - 2), N, i0, i1, sd, data: d, fit: fitv, res, irf: h, irfPeak: st.peakNs, fwhm: st.fwhmNs };
  }
  function decayRef(R) { return R && R.rules && R.rules.s2d ? R.rules.s2d.ref : null; }

  /* ---------- rules I7, P6, P7 and H3 ---------- */
  M.ruleHooks.push({
    reset(E) { E.s2 = { i7: null, p6: {}, i7At: E.s2 ? E.s2.i7At : 0 }; E.s2d = { vals: [], ref: null, win: [], sum: 0, buf: null }; },
    pre(E, n) {
      const R = E.R; if (R.standalone || !n) return;
      const st = status(R), at = Math.min(E.s2.i7At || 0, n - 1);
      if (!st.ok && !st.none && !E.s2.i7 && n > (E.s2.i7At || 0)) E.s2.i7 = E.card({ rule: 'I7', phaseIdx: E.ph(at), title: 'Calibration not applicable', obs: 'Calibration ' + st.rec.id + ': ' + st.reasons.join('; ') + '. Fluorescence is relative only.', x0: R.acq.u[at], x1: R.acq.u[at], fractions: [], features: [{ name: 'Calibration to mg/mL', label: 'P' }], action: 'Use a calibration made with the same PMT preset and processing mode, within its expiry date.' });
    },
    block(E, i, ph, u, y, disc) {
      const R = E.R; if (disc || R.standalone) return;
      // P6: fluorescence above the calibrated linear range within a collected fraction
      const k = conc(y, R, R.ph.list[ph].key);
      if (k.state === 'above') {
        const f = R.fractions.find(q => { const [a, b] = TR.collectedRange(q, M.plumbing()); return u >= a && u < b; });
        if (f) {
          let c = E.s2.p6[ph]; const fit = k.st.rec.fit;
          if (!c) c = E.s2.p6[ph] = E.card({ rule: 'P6', phaseIdx: ph, title: 'Fluorescence above the calibrated range', obs: '', x0: u, x1: u, fractions: [], max: 0, features: [{ name: 'Calibration ' + k.st.rec.id, label: 'P' }] });
          if (!c.fractions.includes(f.id)) c.fractions.push(f.id); c.x1 = u; c.max = Math.max(c.max, y);
          c.obs = 'Fluorescence exceeded the calibrated linear range (to ' + fmt.ml(fit.hi) + ' mg/mL, ' + fmt.sig3(fit.yHi) + ' V·ns) in ' + M.rangeIds(c.fractions) + ', up to ' + fmt.sig3(c.max) + ' V·ns.';
        }
      }
      // P7: decay metric shift (research display; only when decay analysis is on)
      if (!S.proc.decay) return;
      const v = R.y.decay[i]; if (!isFinite(v)) return;
      // Reference: the first 40 valid metrics of the elution peak. The load plateau is host-cell protein, a
      // different species, so it cannot serve as the product's reference (lifetime analysis). Only blocks with
      // fluorescence at least 20 times the buffer baseline count, so that prompt scatter does not move the metric.
      const L = R.ph.list, pk = L[ph].key, d = E.s2d, elKey = R.tpl.fractions.elPhase || 'el';
      if (d.buf == null) { const ref = R.readyAcq ? TR.medianOf(M.fluorOf(R.readyAcq, 20, 320)) : NaN; d.buf = isFinite(ref) && ref > 0 ? ref : 0.008; }
      if (!(y >= 20 * d.buf)) return;
      if (!d.ref) {
        if (pk !== elKey) return; d.vals.push([u, v]); if (d.vals.length < 40) return;
        const w = d.vals.map(x => x[1]), mean = w.reduce((a, b) => a + b, 0) / w.length, sd = Math.sqrt(w.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (w.length - 1));
        d.ref = { mean, sd, n: w.length, u0: d.vals[0][0], u1: d.vals[d.vals.length - 1][0] }; setTimeout(() => M.emit('series'), 0); return;
      }
      d.win.push([u, v]); d.sum += v; while (d.win.length && u - d.win[0][0] > S.th.decayWinMl) d.sum -= d.win.shift()[1];
      if (d.win.length < 20) return;
      const m = d.sum / d.win.length, shift = m - d.ref.mean, unc = Math.sqrt(d.ref.sd * d.ref.sd / d.win.length + d.ref.sd * d.ref.sd / d.ref.n);
      const lim = Math.max(S.th.decaySdMult * d.ref.sd, S.th.decayThrNs), on = Math.abs(shift) > lim, x0 = d.win[0][0];
      const card = E.cond('P7', on, i, () => {
        const fr = E.fracsIn(x0, u), info = irfInfo(R.pmt);
        const p = E.card({ rule: 'P7', phaseIdx: ph, title: 'Decay metric changed', obs: '', x0, x1: u, fractions: fr, shift, unc, features: [{ name: 'Decay-shape analysis (research display)', label: 'P' }] });
        E.card({ rule: 'H3', phaseIdx: ph, linkedTo: p.id, title: 'Possible change in tryptophan environment', obs: 'Possible change in tryptophan environment, for example conformational change at low pH, or aggregates eluting with the product. The decay metric alone does not identify the cause; the species composition of the linked fractions (lifetime analysis) shows which component grows.', x0, x1: u, fractions: fr, confirm: 'HPLC-SEC on ' + (fr.length ? M.rangeIds(fr) : 'the linked fractions') + '.' });
        return p;
      });
      if (card && on) {
        if (Math.abs(shift) >= Math.abs(card.shift)) { card.shift = shift; card.unc = unc; card.x0 = x0; card.x1 = u; card.fractions = E.fracsIn(x0, u); }
        const info = irfInfo(R.pmt);
        card.obs = 'Decay metric changed by ' + sgn(card.shift, 2) + ' ± ' + card.unc.toFixed(2) + ' ns between the ' + fmt.ml(card.x0) + ' to ' + fmt.ml(card.x1) + ' mL window and the elution-front reference (' + fmt.ml(d.ref.u0) + ' to ' + fmt.ml(d.ref.u1) + ' mL, ' + d.ref.mean.toFixed(2) + ' ± ' + d.ref.sd.toFixed(2) + ' ns SD). IRF about ' + info.fwhmNs.toFixed(1) + ' ns FWHM; sampling 0.2 ns.'; card.eng = [' IRF about ' + info.fwhmNs.toFixed(1) + ' ns FWHM; sampling 0.2 ns.'];
        const h = E.cards.find(c => c.linkedTo === card.id); if (h) { h.fractions = card.fractions; h.x0 = card.x0; h.x1 = card.x1; h.confirm = 'HPLC-SEC on ' + (card.fractions.length ? M.rangeIds(card.fractions) : 'the linked fractions') + '.'; }
      }
    },
  });
  M.fracHooks.push((st, R, i0, i1) => {
    // indicative concentration only where the whole fraction is inside the linear range; decay metric mean
    const s = status(R), prod = st.phaseKey === 'el'; let cs = 0, cn = 0, above = false, below = false, ds = 0, dn = 0;
    for (let i = i0; i < i1; i++) {
      const y = R.y.act[i]; if (!(y === y)) continue;
      if (s.ok && prod) { const k = conc(y, R); if (k.state === 'above') above = true; else if (k.state === 'below') below = true; else { cs += k.c; cn++; } }
      const dv = R.y.decay[i]; if (isFinite(dv)) { ds += dv; dn++; }
    }
    st.conc = !s.ok ? (s.none ? null : 'Calibration not applicable') : !prod ? null : above ? 'Above range' : below && !cn ? 'Below range' : cn ? (cs / cn) : null;
    st.concPartBelow = s.ok && below && cn > 0; st.decay = dn >= 5 ? ds / dn : NaN; st.decayN = dn;
  });

  /* ---------- run comparison (section 3) ---------- */
  const ARCHIVE = [
    { id: 'RUN-0128-01', name: 'Earlier run', eln: 'ELN-SIM-2026-0128', date: '2026-09-24', tpl: 'protA', pmt: 400, mode: 'v2.0 reference', stream: 11, mods: { kF: 0.471 * 0.94, loadScale: 1.03 }, note: 'Simulated: elution integrated fluorescence 6 % lower, load plateau 3 % higher.' },
    { id: 'RUN-0091-01', name: 'Development run', eln: 'ELN-SIM-2026-0091', date: '2026-08-14', tpl: 'protA', pmt: 800, mode: 'v2.0 reference', stream: 12, mods: {}, note: 'Different PMT preset: relative comparison only.' },
    { id: 'UCL-AAV-0813', name: 'AAVX crude AAV, 3.6 mL', eln: 'UCL-SIM-2026-0813', date: '2026-08-13', tpl: 'aav', pmt: 400, mode: 'v2.0 reference', stream: 13, mods: { varSeed: 19, peakScale: 0.9 }, note: 'Simulated UCL AAV capture run: different lysate lot, elution peak 10 % lower.' }
  ];
  const archive = {};
  function startArchived(def) {
    if (archive[def.id]) return archive[def.id];
    const tpl = TR.cloneTemplate(def.tpl), ph = TR.buildPhases(tpl), prof = TR.buildProfile(def.tpl, ph, def.mods), pre = 1, V1 = 0.20, tEnd = Math.ceil(ph.totalMin + 2) * 60;
    const acq = TR.createAcq({ seed: TR.SEED, stream: def.stream, pmt: def.pmt, ...M.pmtSim(def.pmt), pDisc: 0.00025, tauJit: 0.047, tEnd, cap: tEnd + 50, taus: TR.SPECIES[def.tpl].map(q => q.tau),
      signalAt: tS => { const tA = tS / 60 - pre, vp = TR.pumpVolAt(ph, Math.max(0, tA)), u = vp - V1, pr = prof.at(u); return { S: pr.S * (1 + 0.004 * TR.smoothNoise(TR.SEED + 3 + def.stream, tS / 60, [3.1, 7.7, 13.3])), tau: pr.tau, comp: pr.comp, E: 1 - 0.02 * Math.max(0, tA) / ph.totalMin, u, vp, phase: TR.phaseIdxAtVol(ph, u) }; } });
    return (archive[def.id] = { def, tpl, ph, acq, tEnd, done: false, cv: tpl.cv, fractions: TR.buildFractions(ph, tpl.fractions) });
  }
  function stepArchived(a, budgetMs) { const t0 = performance.now(); while (!a.done && performance.now() - t0 < budgetMs) { TR.acqStep(a.acq, Math.min(a.tEnd, a.acq.tCursor + 120)); if (a.acq.done || a.acq.tCursor >= a.tEnd - 1) a.done = true; } return a.done; }
  // A uniform record for the live run or an archived run
  function runView(r) {
    if (!r) return null;
    if (r.def) { const A = r.acq, y = new Float64Array(A.n); for (let i = 0; i < A.n; i++) y[i] = A.disc[i] ? NaN : A.F[0][i]; return { id: r.def.id, name: r.def.name, date: r.def.date, eln: r.def.eln, tpl: r.tpl, ph: r.ph, cv: r.cv, pmt: r.def.pmt, mode: r.def.mode, procKey: '[false,false,false]', u: A.u, y, n: A.n, A, fractions: r.fractions, plumb: { V1: 0.20, V2: 0.15, fracDelay: 0.35 }, note: r.def.note }; }
    return { id: r.id, name: 'This run', date: today(), eln: r.setupSnap.eln, tpl: r.tpl, ph: r.ph, cv: r.cv, pmt: r.pmt, mode: M.procLabel(), procKey: procKey(), u: r.acq.u, y: r.y.act, n: r.derivedN, A: r.acq, fractions: r.fractions, plumb: M.plumbing(), live: true };
  }
  const BIN = 0.05;
  function binned(v, xMode, rel) {
    const lo = -1, nb = Math.ceil((v.ph.totalVol + 2) / BIN), s = new Float64Array(nb), c = new Float64Array(nb);
    for (let i = 0; i < v.n; i++) { const y = v.y[i]; if (!(y === y)) continue; const b = Math.floor((v.u[i] - lo) / BIN); if (b >= 0 && b < nb) { s[b] += y; c[b]++; } }
    const x = new Float64Array(nb), y = new Float64Array(nb);
    let norm = 1; if (rel) { const el = v.ph.list.find(p => p.key === 'el'); let mx = 0; for (let b = 0; b < nb; b++) { const xv = lo + (b + 0.5) * BIN; if (c[b] && xv >= el.v0 && xv < el.v1) mx = Math.max(mx, s[b] / c[b]); } norm = mx > 0 ? 100 / mx : 1; }
    for (let b = 0; b < nb; b++) { const xv = lo + (b + 0.5) * BIN; x[b] = xMode === 'cv' ? xv / v.cv : xv; y[b] = c[b] ? s[b] / c[b] * norm : NaN; }
    return { x, y, n: nb };
  }
  function phaseIntegral(v, key) { const p = v.ph.list.find(q => q.key === key); if (!p) return NaN; let tot = 0, pu = null, py = null; for (let i = 0; i < v.n; i++) { const u = v.u[i], y = v.y[i]; if (u < p.v0 || u >= p.v1 || !(y === y)) continue; if (pu != null && u > pu) tot += (u - pu) * (y + py) / 2; pu = u; py = y; } return tot; }
  function loadPlateau(v) { const p = v.ph.list.find(q => q.key === 'load'); if (!p) return NaN; const vals = []; for (let i = 0; i < v.n; i++) { const u = v.u[i]; if (u > p.v0 + 0.3 * p.vol && u < p.v1 - 0.25 * p.vol && v.y[i] === v.y[i]) vals.push(v.y[i]); } return TR.medianOf(vals); }
  function fracCompare(v) {
    const el = v.ph.list.find(q => q.key === 'el'), tot = phaseIntegral(v, 'el'), out = {};
    for (const f of v.fractions.filter(q => q.phaseKey === 'el')) {
      const [a, b] = TR.collectedRange(f, v.plumb); let integ = 0, pu = null, py = null, over = 0, chg = 0, disc = 0, prevStep = null;
      for (let i = 0; i < v.n; i++) { const u = v.u[i]; if (u < a || u >= b) continue; if (v.A.disc[i]) { disc++; continue; } const y = v.y[i]; if (pu != null && u > pu) integ += (u - pu) * (y + py) / 2; pu = u; py = y; over += v.A.nOver[i]; if (prevStep != null && v.A.step[i] !== prevStep) chg++; prevStep = v.A.step[i]; }
      out[f.id] = { share: tot > 0 && pu != null ? integ / tot : NaN, over, chg, disc };
    }
    return out;
  }

  return { LEVELS, MAT, SCHED, schedule, simulate, current, fit, makeRecord, active, status, conc, concText, procKey, initRecord, cal, irfInfo, reconFit, decayRef, ARCHIVE, startArchived, stepArchived, runView, binned, phaseIntegral, loadPlateau, fracCompare, archive, today, addDays, sgn };
})();
