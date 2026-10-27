/* =====================================================================
   TRIFLE engine: constants, v2.0 reference algorithms, Proposed options,
   simulator, laser model, rules. No DOM access in this section.
   ===================================================================== */
'use strict';
const TR = (function () {
  const SEED = 20261009;
  const DX = 0.2, NSAMP = 600, NBASE = 100, WIN0 = 150, WIN1 = 350;

  /* ---------- Appendix A constants (values as held in the v2.0 settings files) ---------- */
  const ND_T = { '0': 1.0, '0.5': 0.3703741409502376, '1': 0.14222121227813234, '2': 0.019836693142437436, '3': 0.003137406565978116, '4': 0.0003341469948531312 };
  const ND_T_SHOWN = { '0': '1.0', '0.5': '0.37037', '1': '0.14222', '2': '0.019837', '3': '0.0031374', '4': '0.00033415' };
  const WHEEL_POS = { '0': 1, '0.5': 2, '1': 3, '2': 4, '3': 5, '4': 6 };
  const ND_LIST = [0, 0.5, 1, 2, 3, 4];
  function T_of(od) { return ND_T[String(od)]; }
  function mkLadder(pairs) { return pairs.map((p, i) => ({ step: i + 1, nd: p[0], range: p[1] })); }
  const LADDERS = {
    400: mkLadder([[4, 0.05], [4, 0.02], [4, 0.01], [3, 0.05], [3, 0.02], [3, 0.01], [2, 0.05], [2, 0.02], [2, 0.01], [1, 0.05], [0.5, 0.05], [0, 0.05], [0, 0.02], [0, 0.01]]),
    800: mkLadder([[4, 0.5], [4, 0.2], [4, 0.1], [3, 0.5], [3, 0.2], [3, 0.1], [2, 0.5], [2, 0.2], [2, 0.1], [1, 0.5], [0.5, 0.5], [0, 0.5], [0, 0.2], [0, 0.1], [0, 0.05], [0, 0.02], [0, 0.01]])
  };
  const IRF_TERMS = {
    400: [[-4.420736659218496, 1.3032260740679031, 41.01768378895019], [4.296090133896167, 1.2824777297963208, 41.04370079956293], [0.015852379475102214, 0.9300235970144776, 47.29198813572496], [0.018103236250674525, 1.94130919603782, 52.082910077721664], [-0.008871698700425026, 1.205809565783635, 53.82006503098577], [0.0003225651572529071, 0.7129370337109115, 57.04115593214956], [-0.0036776660861604703, 1.658251805777962, 59.43634407628329]],
    800: [[-34.073402605469425, 0.7849043806496785, 38.53085319044025], [31.74007228296262, 0.7708253695198644, 38.54514677686627], [2.450686832471071, 1.5712691933322345, 45.628125055290404], [12.287574642560427, 2.5945229842580977, 49.43259424733974], [-24.732167258854613, 3.8292622788430486, 50.436440575905365], [10.110590553186661, 3.0861781447199435, 53.1416393665365], [-0.17653173511653272, 1.3424717613124661, 57.28365551133022]]
  };
  const ACQ = { repHz: 10, wfPerBlock: 10, timeoutS: 3.0, sigBefore: 50, sigAfter: 70, bmBefore: 30, bmAfter: 70, trigV: 0.15, bmRangeV: 0.5, bmMinV: 0.005, wheelS: 0.3, saveS: 2.0, minBlocks: 5, nsd: 5, target: 0.80, limit: 0.90 };
  // PicoScope 6000 input ranges (50 ohm), in order. Discrepancy 2: v2.0 sends index 1 for 10 mV.
  const RANGES_V = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5];
  // Real input range of a stated range: unchanged ('stated'), or one setting larger ('shift', what-if)
  function realRange(r, map) { if (map !== 'shift') return r; const i = RANGES_V.indexOf(r); return i < 0 ? r : RANGES_V[Math.min(i + 1, RANGES_V.length - 1)]; }

  /* ---------- deterministic random numbers (mulberry32, seed 20261009) ---------- */
  function mulberry32(a) {
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return (t ^ t >>> 14) >>> 0; };
  }
  function hash(a, b, c, d) { // integer mix used to derive per-block and per-waveform mulberry32 seeds
    let h = (a | 0) ^ Math.imul(b | 0, 0x9E3779B1) ^ Math.imul((c | 0) + 0x632BE5AB, 0x85EBCA77) ^ Math.imul((d | 0) + 0x1B873593, 0xC2B2AE3D);
    h ^= h >>> 16; h = Math.imul(h, 0x7feb352d); h ^= h >>> 15; h = Math.imul(h, 0x846ca68b); h ^= h >>> 16; return h >>> 0;
  }
  // Gaussian table: 65536 quantiles of N(0,1), indexed by the top 16 bits of a mulberry32 draw
  function invNorm(p) { // Acklam's rational approximation
    const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
    const pl = 0.02425; let q, r;
    if (p < pl) { q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    if (p > 1 - pl) { q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    q = p - 0.5; r = q * q; return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  const GTAB = new Float64Array(65536);
  for (let i = 0; i < 65536; i++) GTAB[i] = invNorm((i + 0.5) / 65536);
  function gauss(rng) { return GTAB[rng() >>> 16]; }
  function unif(rng) { return rng() / 4294967296; }

  /* ---------- numerical helpers shared by tests and the simulated run ---------- */
  function trapz(y, i0, i1, dx) { let s = 0; for (let i = i0; i < i1; i++) s += dx * (y[i] + y[i + 1]) / 2.0; return s; }
  function trapzConst(b, i0, i1, dx) { let s = 0; const t = dx * (b + b) / 2.0; for (let i = i0; i < i1; i++) s += t; return s; }
  function mean(y, i0, n) { let s = 0; for (let i = i0; i < i0 + n; i++) s += y[i]; return s / n; }
  const _medBuf = new Float64Array(NSAMP);
  function select(a, n, k) { // k-th smallest (0-based) by quickselect; same value as sorting
    let lo = 0, hi = n - 1;
    while (hi > lo) {
      const pv = a[(lo + hi) >> 1]; let i = lo, j = hi;
      while (i <= j) { while (a[i] < pv) i++; while (a[j] > pv) j--; if (i <= j) { const t = a[i]; a[i] = a[j]; a[j] = t; i++; j--; } }
      if (k <= j) hi = j; else if (k >= i) lo = i; else return a[k];
    }
    return a[k];
  }
  function median(y, i0, n) { // for an even count, mean of the two middle values
    const a = n <= NSAMP ? _medBuf : new Float64Array(n);
    for (let i = 0; i < n; i++) a[i] = y[i0 + i];
    const h = n >> 1;
    if (n % 2) return select(a, n, h);
    const hiV = select(a, n, h); let loV = -Infinity; for (let i = 0; i < h; i++) if (a[i] > loV) loV = a[i];
    return (loV + hiV) / 2;
  }
  function pstd(y, i0, n) { const m = mean(y, i0, n); let s = 0; for (let i = i0; i < i0 + n; i++) { const d = y[i] - m; s += d * d; } return Math.sqrt(s / n); }
  function countsToVolts(counts, rangeV) { const k = rangeV / 127, v = new Float64Array(counts.length); for (let i = 0; i < counts.length; i++) v[i] = counts[i] * k; return v; }
  function medianOf(arr) { const a = Float64Array.from(arr.filter(v => isFinite(v))); if (!a.length) return NaN; a.sort(); const h = a.length >> 1; return a.length % 2 ? a[h] : (a[h - 1] + a[h]) / 2; }

  /* ---------- 5.3 Fluorescence per waveform, v2.0 reference (Signal.calculate_baseline_and_TFC / T) ---------- */
  function tfcV20(v, T) {
    const n = v.length;
    const b = mean(v, 0, NBASE);
    const total = trapz(v, 0, n - 1, DX);
    const baseArea = trapzConst(b, 0, n - 1, DX);
    const tmb = total - baseArea;
    const nd = tmb / T;
    return { baseline_area_V_ns: baseArea, total_area_V_ns: total, total_minus_baseline_V_ns: tmb, nd_corrected_V_ns: nd, display_fluorescence_V_ns: -nd };
  }
  /* ---------- 6.2 Proposed fluorescence: median baseline; optional integration window ---------- */
  function tfcProposed(v, T, w0, w1) {
    const n = v.length;
    const b = median(v, 0, NBASE);
    const nd = (trapz(v, 0, n - 1, DX) - trapzConst(b, 0, n - 1, DX)) / T;
    const ndw = (trapz(v, w0, w1, DX) - trapzConst(b, w0, w1, DX)) / T;
    return { baseline_median_V: b, nd_corrected_V_ns: nd, display_fluorescence_V_ns: -nd, window_30_70ns_display_fluorescence_V_ns: -ndw };
  }
  // Mean baseline over the Proposed window (used when only the window option is on)
  function tfcMeanWindow(v, T, w0, w1) { const b = mean(v, 0, NBASE); return -(trapz(v, w0, w1, DX) - trapzConst(b, w0, w1, DX)) / T; }

  /* ---------- 5.2 Auto-ranging (signal_attenuation.calculate_optimal_range_and_nd_filter) ---------- */
  // opt.symmetric: Proposed no-signal test; opt.unscaled: Proposed baseline not scaled by T_k;
  // opt.flatGuard: Proposed, nothing below the baseline (m = 0) counts as no signal (discrepancy 4)
  function autorange(v, step, blocksCompleted, ladder, opt) {
    opt = opt || {};
    const minBlocks = opt.minBlocks != null ? opt.minBlocks : ACQ.minBlocks, nsd = opt.nsd != null ? opt.nsd : ACQ.nsd;
    const target = opt.target != null ? opt.target : ACQ.target, limit = opt.limit != null ? opt.limit : ACQ.limit;
    const b = median(v, 0, NBASE), s = pstd(v, 0, NBASE);
    const T = T_of(ladder[step - 1].nd);
    let m = Infinity;
    for (let i = 0; i < v.length; i++) { const u = (v[i] - b) / T; if (u < m) m = u; }
    const out = { evaluated: false, b_median_V: b, s_V: s, m_unattenuated_V: m, T: T, no_signal: null, allowed_steps: null, scores: null, use: null, eligible: null, none_eligible: null, decision_step: 'no change', predicted_use: null, flat: false, guard: false };
    if (blocksCompleted <= minBlocks) return out;
    out.evaluated = true;
    const hi = Math.min(step + 2, ladder.length);
    const allowed = []; for (let k = 1; k <= hi; k++) allowed.push(k);
    out.allowed_steps = allowed;
    const dev = nsd * s;
    const band = opt.symmetric ? (-dev / T < m && m < dev / T) : ((b - dev) / T < m && m < (b + dev) / T);
    const flat = m >= 0; // nothing below the baseline; m > 0 cannot occur, because b is a median of the same waveform
    out.flat = flat && !band;
    if (band || m > 0 || (opt.flatGuard && flat)) { out.no_signal = true; out.guard = !band && flat && !!opt.flatGuard; out.none_eligible = false; out.decision_step = hi; return out; }
    out.no_signal = false;
    const scores = [], uses = [], elig = []; let best = -1, bestScore = Infinity;
    for (const k of allowed) {
      const Tk = T_of(ladder[k - 1].nd), rk = ladder[k - 1].range;
      const p = m * Tk, u = -p / rk;
      const bterm = opt.unscaled ? b : b * Tk;
      uses.push(u);
      if (p + bterm > -rk && u < limit) { const sc = (target - u) * (target - u); scores.push(sc); elig.push(true); if (sc < bestScore) { bestScore = sc; best = k; } }
      else { scores.push(null); elig.push(false); }
    }
    out.scores = scores; out.use = uses; out.eligible = elig;
    if (best < 0) { out.none_eligible = true; out.decision_step = 1; }
    else { out.none_eligible = false; out.decision_step = best; out.predicted_use = uses[best - 1]; }
    return out;
  }

  /* ---------- IRF and simulated pulse shapes ---------- */
  function irfCurve(terms) { const y = new Float64Array(NSAMP); for (let i = 0; i < NSAMP; i++) { const t = i * DX; let s = 0; for (const [A, W, T] of terms) s += A * Math.exp(-((t - T) * (t - T)) / (2 * W * W)); y[i] = s; } return y; }
  function irfStats(y) {
    let mn = 0, im = 0; for (let i = 0; i < y.length; i++) if (y[i] < mn) { mn = y[i]; im = i; }
    let a = im, b = im; while (a > 0 && y[a - 1] < mn / 2) a--; while (b < y.length - 1 && y[b + 1] < mn / 2) b++;
    // interpolated half-maximum crossings
    const xa = (a - 1) + (mn / 2 - y[a - 1]) / (y[a] - y[a - 1]), xb = b + (mn / 2 - y[b]) / (y[b + 1] - y[b]);
    let rp = 0, ir = im; for (let i = im; i < y.length; i++) if (y[i] > rp) { rp = y[i]; ir = i; }
    return { peakIdx: im, peakNs: im * DX, fwhmNs: (xb - xa) * DX, ringNs: ir * DX, ringRel: rp / -mn };
  }
  // Recursive discrete convolution of the IRF with exp(-t/tau), dt = 0.2 ns
  function convExp(h, tau, out) { const n = h.length, y = out || new Float64Array(n), a = Math.exp(-DX / tau); let p = 0; for (let i = 0; i < n; i++) { p = p * a + h[i] * DX; y[i] = p; } return y; }
  const shapeCache = {};
  function shapeTable(pmt) { // unit-area negative pulses for tau 2.50 to 4.50 ns in 0.01 ns steps
    if (shapeCache[pmt]) return shapeCache[pmt];
    const h = irfCurve(IRF_TERMS[pmt]), nT = 201, tab = new Float64Array(nT * NSAMP), tmp = new Float64Array(NSAMP);
    for (let k = 0; k < nT; k++) {
      convExp(h, 2.5 + k * 0.01, tmp); const area = trapz(tmp, 0, NSAMP - 1, DX);
      for (let i = 0; i < NSAMP; i++) tab[k * NSAMP + i] = tmp[i] / Math.abs(area);
    }
    shapeCache[pmt] = { tab, h, stats: irfStats(h) }; return shapeCache[pmt];
  }
  function shapeFor(pmt, tau, out) {
    const st = shapeTable(pmt), x = Math.min(200, Math.max(0, (tau - 2.5) / 0.01)), k = Math.floor(Math.min(199, x)), f = x - k;
    for (let i = 0; i < NSAMP; i++) out[i] = st.tab[k * NSAMP + i] * (1 - f) + st.tab[(k + 1) * NSAMP + i] * f;
    return out;
  }
  // Unit-area negative pulse for any lifetime: the IRF convolved with exp(-t/tau), computed directly
  function unitShape(pmt, tau, out) {
    const h = shapeTable(pmt).h; convExp(h, tau, out); const k = 1 / Math.abs(trapz(out, 0, NSAMP - 1, DX));
    for (let i = 0; i < NSAMP; i++) out[i] *= k;
    return out;
  }

  /* ---------- simulated species (read only by the simulator) ---------- */
  // Each species decays as one exponential convolved with the IRF. Real proteins are multi-exponential;
  // one lifetime per species is a simulation simplification. tau is the simulated lifetime (assumed). The
  // lifetime analysis never reads tau: it estimates its own lifetimes from the data. exp is the method
  // template's expected lifetime (assumed), used only to name the components the analysis finds.
  const SPECIES = {
    protA: [
      { key: 'sc', name: 'Scatter and buffer', short: 'Scatter', tau: 0.25, exp: 0.3 },
      { key: 'hcp', name: 'Host-cell proteins', short: 'HCP', tau: 2.2, exp: 2.0 },
      { key: 'mab', name: 'mAb monomer', short: 'Monomer', tau: 3.5, exp: 3.6, product: true },
      { key: 'hmw', name: 'HMW aggregates, dimer and larger', short: 'HMW', tau: 5.4, exp: 5.3 }],
    aav: [
      { key: 'sc', name: 'Scatter and buffer', short: 'Scatter', tau: 0.25, exp: 0.3 },
      { key: 'hcp', name: 'Lysate proteins', short: 'Lysate', tau: 2.2, exp: 2.0 },
      { key: 'empty', name: 'Empty capsids', short: 'Empty', tau: 3.1, exp: 3.0 },
      { key: 'full', name: 'Full capsids', short: 'Full', tau: 4.4, exp: 4.6, product: true }]
  };

  /* ---------- method templates and the phase model (8.2, 13, Appendix A) ---------- */
  const TEMPLATES = {
    protA: {
      id: 'protA', name: 'Protein A platform', label: 'Existing', column: 'HiScreen MabSelect PrismA', cv: 4.657, voidMl: 1.40, primeMl: 20,
      phases: [
        { key: 'eq', name: 'Equilibration', short: 'Equil.', cv: 2, flow: 0.93, buffer: true },
        { key: 'load', name: 'Load (CUB)', short: 'Load', ml: 47.52, flow: 0.78 },
        { key: 'w1', name: 'Wash 1 (caprylate)', short: 'Wash 1', cv: 5, flow: 0.78 },
        { key: 'w2', name: 'Wash 2', short: 'Wash 2', cv: 3, flow: 0.93, buffer: true },
        { key: 'el', name: 'Elution (pH 3.6)', short: 'Elution', cv: 5, flow: 0.78 },
        { key: 'strip', name: 'Strip (pH 2.6)', short: 'Strip', cv: 3, flow: 0.93 },
        { key: 'cipeq', name: 'CIP equilibration', short: 'CIP eq.', cv: 1, flow: 0.93, buffer: true },
        { key: 'naoh', name: '0.5 M NaOH, 30 min hold', short: 'NaOH', cv: 3, flow: 0.93, holdMin: 30 },
        { key: 'reeq', name: 'Re-equilibration', short: 'Re-equil.', cv: 3, flow: 0.93, buffer: true }],
      fractions: { loadPhase: 'load', loadSize: 5.0, elPhase: 'el', elSize: 1.0, elCollect: 12.0 },
      breakthroughRule: true, sample: 'mAb CUB'
    },
    aav: {
      id: 'aav', name: 'AAV affinity capture (AAVX)', label: 'Proposed', column: 'AAVX affinity column, 1 mL', cv: 1.0, voidMl: 0.35, primeMl: 0,
      phases: [
        { key: 'eq', name: 'Equilibration', short: 'Equil.', cv: 5, flow: 0.5, buffer: true, assumed: true },
        { key: 'load', name: 'Load (crude lysate)', short: 'Load', ml: 3.6, flow: 0.25, assumedFlow: true },
        { key: 'w1', name: 'Wash', short: 'Wash', cv: 10, flow: 0.5, assumed: true },
        { key: 'el', name: 'Elution (low pH)', short: 'Elution', cv: 8, flow: 0.5, assumed: true },
        { key: 'strip', name: 'Strip or CIP', short: 'Strip/CIP', cv: 10, flow: 0.5, assumed: true },
        { key: 'reeq', name: 'Re-equilibration', short: 'Re-equil.', cv: 7.3, flow: 0.5, buffer: true, assumed: true }],
      fractions: { loadPhase: 'load', loadSize: 1.0, elPhase: 'el', elSize: 0.5, elCollect: 6.0, assumed: true },
      breakthroughRule: false, sample: 'AAV crude lysate'
    }
  };
  function cloneTemplate(id) { return JSON.parse(JSON.stringify(TEMPLATES[id])); }
  function buildPhases(tpl) {
    let v = 0, t = 0; const out = [];
    for (const p of tpl.phases) {
      const vol = p.ml != null ? p.ml : p.cv * tpl.cv;
      const pump = vol / p.flow, hold = p.holdMin || 0;
      out.push({ key: p.key, name: p.name, short: p.short, vol, flow: p.flow, cv: vol / tpl.cv, res: tpl.cv / p.flow, v0: v, v1: v + vol, t0: t, tPump: t + pump, t1: t + pump + hold, hold, buffer: !!p.buffer, assumed: !!p.assumed });
      v += vol; t += pump + hold;
    }
    return { list: out, totalVol: v, totalMin: t, pumpMin: out.reduce((s, p) => s + (p.tPump - p.t0), 0), holdMin: out.reduce((s, p) => s + p.hold, 0), cv: tpl.cv };
  }
  function pumpVolAt(ph, tMin) {
    const L = ph.list; if (tMin <= 0) return 0;
    for (const p of L) { if (tMin < p.t1) { return tMin < p.tPump ? p.v0 + p.flow * (tMin - p.t0) : p.v1; } }
    return ph.totalVol;
  }
  function flowAt(ph, tMin) { for (const p of ph.list) if (tMin < p.t1) return tMin < p.tPump && tMin >= p.t0 ? p.flow : (tMin < p.t0 ? 0 : 0); return 0; }
  function timeAtVol(ph, v) { // earliest time at which the cumulative volume reaches v
    if (v <= 0) return 0;
    for (const p of ph.list) if (v <= p.v1) return p.t0 + (v - p.v0) / p.flow;
    return ph.totalMin;
  }
  function phaseIdxAtVol(ph, v) { const L = ph.list; for (let i = 0; i < L.length; i++) if (v < L[i].v1) return i; return L.length - 1; }
  function phaseIdxAtTime(ph, tMin) { const L = ph.list; for (let i = 0; i < L.length; i++) if (tMin < L[i].t1) return i; return L.length - 1; }

  /* ---------- simulated process profiles (functions of the UV-referenced volume) ---------- */
  function sig(z) { return 1 / (1 + Math.exp(-z)); }
  function smoothNoise(seed, x, periods) { // deterministic slow variation, zero mean, unit-ish amplitude
    let s = 0; const r = mulberry32(seed);
    for (const P of periods) { const ph = unif(r) * 2 * Math.PI; s += Math.sin(2 * Math.PI * x / P + ph); }
    return s / Math.sqrt(periods.length / 2);
  }
  function peakShape(mu, sg, tau, h, n) { // Gaussian convolved with exponential tail, peak normalised to 1
    const y = new Float64Array(n), a = Math.exp(-h / tau); let p = 0, m = 0;
    for (let j = 0; j < n; j++) { const x = j * h; p = p * a + Math.exp(-0.5 * ((x - mu) / sg) * ((x - mu) / sg)) * h; y[j] = p; if (p > m) m = p; }
    for (let j = 0; j < n; j++) y[j] /= m; return { y, h, n };
  }
  function lookup(sh, x) { if (x <= 0) return 0; const j = x / sh.h; const k = Math.floor(j); if (k >= sh.n - 1) return sh.y[sh.n - 1] * Math.exp(-(x - (sh.n - 1) * sh.h) / 1.0); const f = j - k; return sh.y[k] * (1 - f) + sh.y[k + 1] * f; }
  const IF_A = 0.030; // inner-filter coefficient (simulation parameter, per mg/mL)
  function innerFilter(c) { return c <= 1e-9 ? 1 : (1 - Math.exp(-IF_A * c)) / (IF_A * c); }

  function buildProfile(tplId, ph, mods) {
    mods = mods || {};
    const L = ph.list, P = k => L.find(p => p.key === k), cv = ph.cv;
    const res = { S: 0, Sbg: 0, Sft: 0, Smab: 0, Sstrip: 0, conc: 0, tau: 3.5, uv: 0, uvTrue: 0, cond: 0, ph: 0 }, TS = SPECIES[tplId].map(s => s.tau);
    if (tplId === 'protA') {
      const Vv = 1.40, kF = mods.kF || 0.471, cMax = 25.0;
      const bg = { eq: 0.0080, load: 0.0080, w1: 0.0088, w2: 0.00824, el: 0.00784, strip: 0.00784, cipeq: 0.00808, naoh: 0.0090, reeq: 0.00920 };
      const cond = { eq: 15.6, load: 13.1, w1: 31.0, w2: 15.6, el: 1.9, strip: 2.7, cipeq: 15.6, naoh: 93.0, reeq: 15.6 };
      const pH = { eq: 7.40, load: 7.05, w1: 7.50, w2: 7.40, el: 3.60, strip: 2.60, cipeq: 7.40, naoh: 13.10, reeq: 7.40 };
      const uvb = { eq: 1.5, load: 1.5, w1: 2.0, w2: 1.5, el: 1.0, strip: 1.0, cipeq: 1.5, naoh: 4.0, reeq: 1.5 };
      const pLoad = P('load'), pW1 = P('w1'), pEl = P('el'), pStrip = P('strip');
      const xFront = pLoad.v0 + Vv + 0.5, xEnd = pW1.v0 + Vv, ftA = 0.40 * (mods.loadScale || 1);
      const el = peakShape(2.4, 0.30, 1.70, 0.005, 4000);
      // elution peak edges at 100 mAU, used for the decay-shape simulation
      const lvl = 100 / (280 * cMax); let ea = -1, eb = -1; for (let j = 0; j < el.n; j++) if (el.y[j] >= lvl) { if (ea < 0) ea = j; eb = j; }
      const xA = pEl.v0 + ea * el.h, xB = pEl.v0 + eb * el.h;
      const elScale = mods.elutionScale || 1;
      function blend(tab, x, w) { let v = tab[L[0].key]; for (let i = 1; i < L.length; i++) v += (tab[L[i].key] - tab[L[i - 1].key]) * sig((x - (L[i].v0 + Vv)) / w); return v; }
      // species split (sums to the same totals): the 4 % rise over the last CV of the load is mAb breakthrough;
      // the buffer excess in CIP equilibration and re-equilibration is mAb carry-over; HMW rises from 2 % to 27 %
      // of the product across the elution peak; the strip peak is mostly aggregate
      const carry = { eq: 0, load: 0, w1: 0, w2: 0, el: 0, strip: 0, cipeq: 0.00008, naoh: 0, reeq: 0.0012 };
      res.comp = [0, 0, 0, 0];
      res.at = function (x) {
        const Sbg = blend(bg, x, 0.25), Sco = Math.max(0, blend(carry, x, 0.25));
        const xl = Math.min(x, xEnd), base = ftA * sig((xl - xFront) / 0.35), bt = base * 0.04 * Math.min(1, Math.max(0, (xl - (pW1.v0 - cv)) / cv));
        let lev = base + bt;
        if (x < pLoad.v0 + Vv - 2) lev = 0;
        const tail = x > xEnd ? Math.exp(-(x - xEnd) / 2.6) : 1, Sft = lev * tail, Sbt = lev > 0 ? bt * tail : 0;
        const uvFt = (x < pLoad.v0 + Vv - 2 ? 0 : 3950 * sig((Math.min(x, xEnd) - xFront) / 0.35)) * (x > xEnd ? Math.exp(-(x - xEnd) / 1.9) : 1);
        const c = cMax * elScale * lookup(el, x - pEl.v0);
        const Smab = kF * c * innerFilter(c);
        const gs = Math.exp(-0.5 * ((x - (pStrip.v0 + Vv + 0.6)) / 0.55) ** 2);
        const Sstrip = 0.15 * gs;
        res.Sbg = Sbg; res.Sft = Sft; res.Smab = Smab; res.Sstrip = Sstrip; res.conc = c;
        res.S = Sbg + Sft + Smab + Sstrip;
        const w = Math.min(1, Math.max(0, (x - xA) / (xB - xA))), fH = 0.02 + 0.25 * w * w;
        const cp = res.comp; cp[0] = Sbg - Sco; cp[1] = Sft - Sbt; cp[2] = Sco + Sbt + Smab * (1 - fH) + 0.4 * Sstrip; cp[3] = Smab * fH + 0.6 * Sstrip;
        res.tau = (cp[0] * TS[0] + cp[1] * TS[1] + cp[2] * TS[2] + cp[3] * TS[3]) / res.S;
        res.uvTrue = blend(uvb, x, 0.3) + uvFt + 280 * c + 160 * gs;
        res.uv = Math.min(3800, res.uvTrue);
        res.cond = blend(cond, x, 0.35); res.ph = blend(pH, x, 0.6);
        return res;
      };
      res.elutionEdges = [xA, xB];
    } else { // AAV affinity capture (Stage 2; volumes and flows assumed)
      const Vv = 0.35;
      const bg = { eq: 0.0080, load: 0.0080, w1: 0.0083, el: 0.0079, strip: 0.0090, reeq: 0.0083 };
      const cond = { eq: 16.0, load: 18.5, w1: 45.0, el: 4.5, strip: 60.0, reeq: 16.0 };
      const pH = { eq: 7.40, load: 7.20, w1: 7.40, el: 3.00, strip: 12.80, reeq: 7.40 };
      const uvb = { eq: 1.0, load: 1.0, w1: 1.5, el: 1.0, strip: 3.0, reeq: 1.0 };
      const pLoad = P('load'), pW1 = P('w1'), pEl = P('el'), pStrip = P('strip');
      const xFront = pLoad.v0 + Vv + 0.15, xEnd = pW1.v0 + Vv;
      const el = peakShape(0.9, 0.12, 0.45, 0.002, 6000);
      function blend(tab, x, w) { let v = tab[L[0].key]; for (let i = 1; i < L.length; i++) v += (tab[L[i].key] - tab[L[i - 1].key]) * sig((x - (L[i].v0 + Vv)) / w); return v; }
      res.comp = [0, 0, 0, 0];
      res.at = function (x) {
        const Sbg = blend(bg, x, 0.08);
        const varF = 1 + 0.15 * smoothNoise(SEED + (mods.varSeed || 7), x, [0.31, 0.53, 0.87, 1.4]);
        let lev = 2.4 * varF * sig((Math.min(x, xEnd) - xFront) / 0.08);
        if (x < pLoad.v0) lev = 0;
        const Sft = lev * (x > xEnd ? Math.exp(-(x - xEnd) / 0.7) : 1);
        const uvFt = (x < pLoad.v0 ? 0 : 5000 * varF * sig((Math.min(x, xEnd) - xFront) / 0.08)) * (x > xEnd ? Math.exp(-(x - xEnd) / 0.5) : 1);
        const pk = lookup(el, x - (pEl.v0 + Vv));
        const Smab = 0.95 * (mods.peakScale || 1) * pk;
        const gs = Math.exp(-0.5 * ((x - (pStrip.v0 + Vv + 0.4)) / 0.3) ** 2);
        const Sstrip = 0.08 * gs;
        res.Sbg = Sbg; res.Sft = Sft; res.Smab = Smab; res.Sstrip = Sstrip; res.conc = 0;
        res.S = Sbg + Sft + Smab + Sstrip;
        // species split: full capsids elute slightly later than empty ones (30 % of capsids at the front, 50 % in the tail)
        const fF = 0.30 + 0.20 * sig((x - (pEl.v0 + Vv + 0.95)) / 0.12), cp = res.comp;
        cp[0] = Sbg; cp[1] = Sft + Sstrip; cp[2] = Smab * (1 - fF); cp[3] = Smab * fF;
        res.tau = (cp[0] * TS[0] + cp[1] * TS[1] + cp[2] * TS[2] + cp[3] * TS[3]) / res.S;
        res.uvTrue = blend(uvb, x, 0.1) + uvFt + 480 * pk + 60 * gs;
        res.uv = Math.min(3800, res.uvTrue);
        res.cond = blend(cond, x, 0.1); res.ph = blend(pH, x, 0.2);
        return res;
      };
      res.elutionEdges = null;
    }
    return res;
  }

  /* ---------- laser model (section 7; simulated) ---------- */
  const LASER = { rise: 0.15, early: 45.0, late: 21.0, stepAt: 18.0, stepW: 0.12, cvEarly: 0.006, cvLate: 0.009, logS: 2.5 };
  function laserLevel(tl) { if (tl <= 0) return 0; const r = 1 - Math.exp(-tl / LASER.rise); return r * (LASER.early + (LASER.late - LASER.early) * sig((tl - LASER.stepAt) / LASER.stepW)); }
  function laserLogEntry(k, fault) { // k-th log line of the controller log (every 2.5 s from emission start)
    const tl = k * LASER.logS / 60, r = mulberry32(hash(SEED, 0x1A5E, k, 0));
    const lvl = laserLevel(tl), cv = tl < LASER.stepAt ? LASER.cvEarly : LASER.cvLate;
    const pd = fault === 'laser' ? 0 : Math.max(0, lvl * (1 + cv * gauss(r)));
    const caseT = 25.0 + 5.6 * (1 - Math.exp(-tl / 22)) + 0.05 * gauss(r);
    return { k, tl, pd, ld: 36.6 + 0.02 * gauss(r), nlo: 32.92 + 0.01 * gauss(r), caseT, cur: 4.85 };
  }
  function laserExcitation(tlMin) { return tlMin <= 0 ? 0 : 1 - Math.exp(-tlMin / LASER.rise); }
  // Laser stable (provisional): the step-down has been observed and the reading has since held, or no step
  // has occurred by the no-step limit and the reading has held. "Held" means every 30 s moving median in the
  // last holdMin minutes lies within ±holdPct % of the median of that window. Incremental over the log.
  function laserStability(entries, th, st) {
    st = st || { k: 0, early: NaN, earlyVals: [], stepAt: null, stableAt: null, how: null, med30: [] };
    const win = Math.round(30 / LASER.logS), holdN = Math.round(th.holdMin * 60 / LASER.logS);
    for (; st.k < entries.length; st.k++) {
      const i = st.k, e = entries[i];
      if (e.tl >= 1 && e.tl <= 3) st.earlyVals.push(e.pd);
      if (e.tl > 3 && !isFinite(st.early) && st.earlyVals.length >= 10) st.early = medianOf(st.earlyVals);
      const m30 = i + 1 >= win ? medianOf(entries.slice(i - win + 1, i + 1).map(x => x.pd)) : NaN;
      st.med30.push(m30);
      if (st.stableAt != null) continue;
      if (st.stepAt == null && isFinite(st.early) && m30 < st.early * (1 - th.stepFallPct / 100)) st.stepAt = e.tl;
      const j0 = i - holdN + 1; if (j0 < win) continue;
      const startOk = st.stepAt != null ? entries[j0].tl >= st.stepAt : e.tl >= th.noStepMin;
      if (!startOk) continue;
      const m = medianOf(entries.slice(j0, i + 1).map(x => x.pd)); let ok = m > 0.5;
      for (let j = j0; j <= i && ok; j++) if (Math.abs(st.med30[j] - m) > m * th.holdPct / 100) ok = false;
      if (ok) { st.stableAt = e.tl; st.how = st.stepAt != null ? 'step' : 'nostep'; }
    }
    const last = entries.length ? entries[entries.length - 1].pd : 0;
    st.state = !entries.length || (last < 0.5 && entries[entries.length - 1].tl > 1) ? 'off' : (st.stableAt != null ? 'stable' : 'warming');
    return st;
  }

  /* ---------- acquisition simulator (5.1 loop on simulated waveforms) ---------- */
  // signalAt(tSec) -> {S, tau, E, u, vp, phase}; all randomness from (seed, stream, block, waveform)
  function createAcq(o) {
    const cap = o.cap || 16000, A = {
      o, cap, n: 0, tCursor: o.t0 || 0, cur: o.startStep || 1, blocksCompleted: 0, done: false, lastWave: null, lastMed: null,
      t: new Float64Array(cap), vp: new Float64Array(cap), u: new Float64Array(cap), phase: new Int8Array(cap), step: new Int8Array(cap), disc: new Uint8Array(cap),
      F: [new Float64Array(cap), new Float64Array(cap), new Float64Array(cap), new Float64Array(cap)],
      ruse: new Float32Array(cap), ruseMax: new Float32Array(cap), nOver: new Uint8Array(cap), bm: new Float32Array(cap), bmV: new Float32Array(cap),
      S: new Float32Array(cap), E: new Float32Array(cap), tau: new Float32Array(cap), predUse: new Float32Array(cap), noSig: new Uint8Array(cap), evald: new Uint8Array(cap),
      decision: new Int8Array(cap), bc: new Int32Array(cap), decay: new Float32Array(cap), changes: []
    };
    A.ladder = LADDERS[o.pmt];
    A.buf = new Float64Array(10 * NSAMP); A.shape = new Float64Array(NSAMP); A.med = new Float64Array(NSAMP); A.lastWave = new Float64Array(NSAMP); A.lastMed = new Float64Array(NSAMP); A.hasLast = false;
    A.irfPeak = shapeTable(o.pmt).stats.peakIdx;
    // o.taus: one lifetime per simulated species; signalAt then also returns comp, the signal of each species
    A.K = o.taus ? o.taus.length : 0;
    if (A.K) { A.comp = new Float32Array(cap * A.K); A.tj = new Float32Array(cap); A.ush = new Float64Array(NSAMP); }
    // o.keepDecays: keep each block's decay (mean of its 10 waveforms) for the lifetime analysis
    if (o.keepDecays) { A.dw = new Float32Array(cap * LTN); A.dsd = new Float32Array(cap); A.clip = new Uint8Array(cap); A.mw = new Float64Array(NSAMP); A.ltJ0 = ltJ0(o.pmt); }
    return A;
  }
  // Pulse shape of block i of a multi-species acquisition: species fractions times their unit pulses.
  // Every lifetime is scaled by the block's timing jitter tj.
  function mixShape(A, i, out) {
    const K = A.K, ts = A.o.taus, tmp = A.ush; out.fill(0);
    for (let k = 0; k < K; k++) { const f = A.comp[i * K + k]; if (!(f > 0)) continue; unitShape(A.o.pmt, ts[k] * A.tj[i], tmp); for (let j = 0; j < NSAMP; j++) out[j] += f * tmp[j]; }
    return out;
  }
  function genWaveform(A, i, w, S, E, tau, step, out, shapeBuf) {
    // rq: real input range; equals the stated range unless o.rangeMap is 'shift' (discrepancy 2 what-if)
    const o = A.o, st = A.ladder[step - 1], T = T_of(st.nd), rq = realRange(st.range, o.rangeMap), inv = 127 / rq, k = rq / 127;
    // mulberry32 inlined for speed; sequence identical to mulberry32(hash(seed, stream, block, waveform + 1))
    let a = hash(o.seed, o.stream, i, w + 1), t;
    a = a + 0x6D2B79F5 | 0; t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    const amp = S * E * T * (1 + 0.01 * GTAB[((t ^ t >>> 14) >>> 0) >>> 16]) * (o.gain || 1);
    const sh = shapeBuf || shapeFor(o.pmt, tau, A.shape), sd = o.sigma || 0.0002;
    for (let j = 0; j < NSAMP; j++) {
      a = a + 0x6D2B79F5 | 0; t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      const x = (amp * sh[j] + sd * GTAB[((t ^ t >>> 14) >>> 0) >>> 16]) * inv;
      let c = ((x + 128.5) | 0) - 128; // floor(x + 0.5), i.e. round to nearest; exact for x >= -128.5, clamped below
      if (c > 127) c = 127; else if (c < -127) c = -127;
      out[j] = c * k;
    }
    return out;
  }
  function median10(buf, j) { // median across the 10 waveforms of a block at sample j
    const a = median10.a; for (let w = 0; w < 10; w++) a[w] = buf[w * NSAMP + j];
    for (let x = 1; x < 10; x++) { const v = a[x]; let y = x - 1; while (y >= 0 && a[y] > v) { a[y + 1] = a[y]; y--; } a[y + 1] = v; }
    return (a[4] + a[5]) / 2;
  }
  median10.a = new Float64Array(10);
  function decayMetric(med, iPk) { // Option A: intensity-weighted mean delay after the IRF peak, 0 to 20 ns
    const b = median(med, 0, NBASE); let num = 0, den = 0;
    for (let i = iPk; i <= iPk + 100; i++) { const I = -(med[i] - b); num += (i - iPk) * DX * I; den += I; }
    return den > 0 ? num / den : NaN;
  }
  function acqStep(A, tUntil) {
    const o = A.o; let made = 0;
    while (!A.done && A.tCursor + 1.0 <= tUntil) {
      if (A.n >= A.cap || (o.tEnd != null && A.tCursor >= o.tEnd)) { A.done = true; break; }
      const i = A.n, rb = mulberry32(hash(o.seed, o.stream, i, 0));
      const tMid = A.tCursor + 0.5, sg = o.signalAt(tMid, i);
      const disc = (o.pDisc || 0) > 0 && unif(rb) < o.pDisc;
      let tauB;
      if (A.K) { // species fractions and timing jitter are stored first, so regenBlock rebuilds the same pulse
        const K = A.K, c = sg.comp, jit = (o.tauJit || 0) * gauss(rb); let s = 0, tm = 0;
        for (let k = 0; k < K; k++) s += Math.max(0, c[k]);
        for (let k = 0; k < K; k++) A.comp[i * K + k] = s > 0 ? Math.max(0, c[k]) / s : (k === 0 ? 1 : 0);
        A.tj[i] = 1 + jit / 3.5;
        for (let k = 0; k < K; k++) tm += A.comp[i * K + k] * o.taus[k] * A.tj[i];
        tauB = tm;
      } else tauB = sg.tau + (o.tauJit || 0) * gauss(rb);
      A.t[i] = tMid; A.vp[i] = sg.vp || 0; A.u[i] = sg.u || 0; A.phase[i] = sg.phase || 0; A.S[i] = sg.S; A.E[i] = sg.E; A.tau[i] = tauB;
      A.step[i] = A.cur; A.bc[i] = A.blocksCompleted;
      if (disc) { // timed-out block: no waveforms; v2.0 re-decides on the same last waveform (no change)
        A.disc[i] = 1; for (let f = 0; f < 4; f++) A.F[f][i] = NaN; A.ruse[i] = NaN; A.ruseMax[i] = NaN; A.bm[i] = NaN; A.bmV[i] = NaN; A.decay[i] = NaN; A.predUse[i] = NaN; A.decision[i] = 0;
        if (A.dw) A.dsd[i] = NaN;
        A.n++; made++; A.tCursor += ACQ.timeoutS; continue;
      }
      const st = A.ladder[A.cur - 1], T = T_of(st.nd), range = st.range, rq = realRange(range, o.rangeMap);
      const sh = A.K ? mixShape(A, i, A.shape) : shapeFor(o.pmt, tauB, A.shape);
      let f0 = 0, f1 = 0, f2 = 0, f3 = 0, ru = 0, ruMax = 0, over = 0, clip = false;
      for (let w = 0; w < 10; w++) {
        const v = A.buf.subarray(w * NSAMP, (w + 1) * NSAMP);
        genWaveform(A, i, w, sg.S, sg.E, tauB, A.cur, v, sh);
        const a = tfcV20(v, T), p = tfcProposed(v, T, WIN0, WIN1);
        f0 += a.display_fluorescence_V_ns; f1 += p.display_fluorescence_V_ns; f2 += tfcMeanWindow(v, T, WIN0, WIN1); f3 += p.window_30_70ns_display_fluorescence_V_ns;
        let mn = Infinity; for (let j = 0; j < NSAMP; j++) if (v[j] < mn) mn = v[j];
        if (mn <= -rq * (1 - 1e-9)) clip = true;
        const use = (p.baseline_median_V - mn) / rq; ru += use; if (use > ruMax) ruMax = use; if (use > ACQ.limit) over++;
      }
      A.F[0][i] = f0 / 10; A.F[1][i] = f1 / 10; A.F[2][i] = f2 / 10; A.F[3][i] = f3 / 10;
      A.ruse[i] = ru / 10; A.ruseMax[i] = ruMax; A.nOver[i] = over;
      if (A.dw) { // block decay: mean of the 10 waveforms, baseline removed, ND-corrected, positive; per-sample noise SD
        const m = A.mw, o0 = i * LTN, j0 = A.ltJ0;
        for (let j = 0; j < NSAMP; j++) { let s = 0; for (let w = 0; w < 10; w++) s += A.buf[w * NSAMP + j]; m[j] = s / 10; }
        const b = mean(m, 0, NBASE), q = rq / 127 / Math.sqrt(120); // quantisation floor for a mean of 10 waveforms
        for (let j = 0; j < LTN; j++) A.dw[o0 + j] = -(m[j0 + j] - b) / T;
        A.dsd[i] = Math.max(pstd(m, 0, NBASE), q) / T; A.clip[i] = clip ? 1 : 0;
      }
      for (let j = 0; j < NSAMP; j++) A.med[j] = median10(A.buf, j);
      A.decay[i] = A.ruse[i] >= 0.05 ? decayMetric(A.med, A.irfPeak) : NaN;
      if (o.beamPerBlock) { const bmRel = sg.E * (1 + 0.003 * gauss(rb)); A.bm[i] = bmRel; A.bmV[i] = 0.28 * bmRel; } else { A.bm[i] = NaN; A.bmV[i] = NaN; }
      A.blocksCompleted++;
      A.lastWave.set(A.buf.subarray(9 * NSAMP, 10 * NSAMP)); A.lastMed.set(A.med); A.hasLast = true;
      const input = o.arMedian ? A.lastMed : A.lastWave;
      // auto-ranging scores against the stated range (v2.0's own view), whatever o.rangeMap is
      const d = autorange(input, A.cur, A.blocksCompleted, A.ladder, { symmetric: !!o.arSymmetric, unscaled: !!o.arUnscaled, flatGuard: !!o.arFlatGuard });
      A.evald[i] = d.evaluated ? 1 : 0; A.noSig[i] = d.no_signal ? 1 : 0; A.predUse[i] = d.predicted_use != null ? d.predicted_use : NaN;
      let dur = 1.0;
      if (d.evaluated) {
        A.decision[i] = d.decision_step;
        if (d.decision_step !== A.cur) {
          const lastUse = -d.m_unattenuated_V * d.T / range;
          A.changes.push({ i, t: tMid + 0.5, from: A.cur, to: d.decision_step, use: lastUse, pred: d.predicted_use, noSignal: d.no_signal, noneEligible: d.none_eligible, guard: !!d.guard, flat: !!d.flat });
          if (A.ladder[d.decision_step - 1].nd !== st.nd) dur += ACQ.wheelS;
          A.cur = d.decision_step;
        }
      } else A.decision[i] = 0;
      A.n++; made++; A.tCursor += dur;
    }
    return made;
  }
  function regenBlock(A, i) { // regenerate the 10 waveforms of block i, identical to acquisition
    const out = []; if (A.disc[i]) return out;
    const sh = A.K ? mixShape(A, i, new Float64Array(NSAMP)) : shapeFor(A.o.pmt, A.tau[i], new Float64Array(NSAMP));
    for (let w = 0; w < 10; w++) out.push(genWaveform(A, i, w, A.S[i], A.E[i], A.tau[i], A.step[i], new Float64Array(NSAMP), sh));
    return out;
  }
  function medianWave(waves) { const buf = new Float64Array(10 * NSAMP); waves.forEach((w, k) => buf.set(w, k * NSAMP)); const m = new Float64Array(NSAMP); for (let j = 0; j < NSAMP; j++) m[j] = median10(buf, j); return m; }

  /* ---------- TRIFLE lifetime analysis (Proposed; after Hales et al., J Chromatogr A 1641, 461968, 2021) ---------- */
  // Global analysis: every block decay is a non-negative sum of K exponentials convolved with the stored IRF.
  // The lifetimes are shared by the whole run and the amplitudes are free for every block, so the amplitudes
  // against time are decay-associated chromatograms. No elution profile is assumed and no reference decays
  // are used; the number of components is chosen by the data.
  const LTN = 200; // decay window: 200 samples (40 ns) from 5 ns before the IRF peak
  const LT = { min: 0.05, max: 20, sep: 1.2, gain: 3, kMax: 5, seeds: [0.3, 1.0, 2.0, 4.5, 7.0] };
  function ltJ0(pmt) { return Math.max(0, shapeTable(pmt).stats.peakIdx - 25); }
  function invSmall(M, n) { // Gauss-Jordan inverse with partial pivoting; null when (nearly) singular
    const a = Float64Array.from(M), inv = new Float64Array(n * n); let scale = 0;
    for (let i = 0; i < n; i++) { inv[i * n + i] = 1; scale = Math.max(scale, Math.abs(a[i * n + i])); }
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(a[r * n + c]) > Math.abs(a[p * n + c])) p = r;
      const pv = a[p * n + c]; if (!(Math.abs(pv) > 1e-10 * scale)) return null;
      if (p !== c) for (let k = 0; k < n; k++) { let t = a[p * n + k]; a[p * n + k] = a[c * n + k]; a[c * n + k] = t; t = inv[p * n + k]; inv[p * n + k] = inv[c * n + k]; inv[c * n + k] = t; }
      for (let k = 0; k < n; k++) { a[c * n + k] /= pv; inv[c * n + k] /= pv; }
      for (let r = 0; r < n; r++) { if (r === c) continue; const f = a[r * n + c]; if (f) for (let k = 0; k < n; k++) { a[r * n + k] -= f * a[c * n + k]; inv[r * n + k] -= f * inv[c * n + k]; } }
    }
    return inv;
  }
  // Basis: unit-area decays (1/ns) for the given lifetimes on the decay window, their Gram matrix and the
  // inverse of the Gram matrix on every subset of components (for the exact non-negative solve)
  function ltBasis(pmt, taus) {
    const K = taus.length, j0 = ltJ0(pmt), g = new Float64Array(K * LTN), tmp = new Float64Array(NSAMP), G = new Float64Array(K * K);
    for (let k = 0; k < K; k++) { unitShape(pmt, taus[k], tmp); for (let j = 0; j < LTN; j++) g[k * LTN + j] = -tmp[j0 + j]; }
    for (let a = 0; a < K; a++) for (let b = a; b < K; b++) { let s = 0; for (let j = 0; j < LTN; j++) s += g[a * LTN + j] * g[b * LTN + j]; G[a * K + b] = G[b * K + a] = s; }
    const subs = [];
    for (let m = 1; m < (1 << K); m++) {
      const idx = []; for (let k = 0; k < K; k++) if (m >> k & 1) idx.push(k);
      const n = idx.length, sub = new Float64Array(n * n); for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) sub[r * n + c] = G[idx[r] * K + idx[c]];
      const inv = invSmall(sub, n); if (inv) subs.push({ idx, inv, n });
    }
    // diagonal of the inverse Gram matrix: amplitude variance per unit sample variance (unconstrained)
    const Gi = invSmall(G, K), dInv = new Float64Array(K); for (let k = 0; k < K; k++) dInv[k] = Gi ? Gi[k * K + k] : NaN;
    return { pmt, K, taus: taus.slice(), g, G, subs, j0, dInv, p: new Float64Array(K), x: new Float64Array(K) };
  }
  // Non-negative least squares, exact for small K: the solution equals the unconstrained solution on its own
  // support, so the best support with all amplitudes positive is the answer. Returns a'Ga - 2a'p.
  function ltSolve(B, p, out) {
    let best = 0; out.fill(0); const x = B.x;
    for (const s of B.subs) {
      const n = s.n, idx = s.idx, inv = s.inv; let ok = true, f = 0;
      for (let r = 0; r < n; r++) { let v = 0; for (let c = 0; c < n; c++) v += inv[r * n + c] * p[idx[c]]; if (!(v > 0)) { ok = false; break; } x[r] = v; f -= v * p[idx[r]]; }
      if (ok && f < best) { best = f; out.fill(0); for (let r = 0; r < n; r++) out[idx[r]] = x[r]; }
    }
    return best;
  }
  // Amplitudes (V·ns) of the decay y[o0 .. o0 + LTN); returns the residual sum of squares (V²)
  function ltFitDecay(B, y, o0, out) {
    const K = B.K, g = B.g, p = B.p; let yy = 0; p.fill(0);
    for (let j = 0; j < LTN; j++) { const v = y[o0 + j]; yy += v * v; for (let k = 0; k < K; k++) p[k] += g[k * LTN + j] * v; }
    return Math.max(0, yy + ltSolve(B, p, out));
  }
  // Bins for the global fit: noise-weighted means of consecutive block decays. The model is linear in the
  // amplitudes, so a bin is itself a non-negative mixture of the same decays. Discarded and clipped blocks,
  // and blocks for which skip(i) is true, are left out. w is the inverse noise variance of each bin.
  function ltBins(A, i0, i1, per, skip) {
    const nb = Math.max(0, Math.ceil((i1 - i0) / per)), y = new Float64Array(nb * LTN), w = new Float64Array(nb), at = new Int32Array(nb), nBl = new Int32Array(nb); let n = 0;
    for (let b = 0; b < nb; b++) {
      const a = i0 + b * per, e = Math.min(i1, a + per), o = n * LTN; let sw = 0, c = 0;
      for (let i = a; i < e; i++) {
        if (A.disc[i] || A.clip[i] || (skip && skip(i))) continue; const s = A.dsd[i]; if (!(s > 0)) continue;
        const wi = 1 / (s * s), oi = i * LTN; sw += wi; c++; for (let j = 0; j < LTN; j++) y[o + j] += wi * A.dw[oi + j];
      }
      if (sw > 0) { for (let j = 0; j < LTN; j++) y[o + j] /= sw; w[n] = sw; at[n] = a; nBl[n] = c; n++; } else for (let j = 0; j < LTN; j++) y[o + j] = 0;
    }
    return { n, y, w, at, nBl };
  }
  // Compression for the global fit. Every candidate decay (any lifetime from LT.min to LT.max) lies, to 1e-6, in
  // the span of a few orthonormal vectors U, found by Gram-Schmidt with pivoting over a dense lifetime grid. A bin
  // is then kept as its coefficients c = U'y and its y'y; g'y = (U'g)'c is exact for g in the span, so chi-squared
  // is unchanged and each evaluation costs K x M instead of K x 200 per bin.
  const ltDictCache = {};
  function ltDict(pmt) {
    if (ltDictCache[pmt]) return ltDictCache[pmt];
    const j0 = ltJ0(pmt), tmp = new Float64Array(NSAMP), cols = [], U = [];
    for (let k = 0; k <= 160; k++) { unitShape(pmt, LT.min * Math.pow(LT.max / LT.min, k / 160), tmp); const c = new Float64Array(LTN); for (let j = 0; j < LTN; j++) c[j] = -tmp[j0 + j]; cols.push(c); }
    const nrm = c => { let s = 0; for (let j = 0; j < LTN; j++) s += c[j] * c[j]; return Math.sqrt(s); }, scale = Math.max(...cols.map(nrm));
    const orth = (q, c) => { let d = 0; for (let j = 0; j < LTN; j++) d += q[j] * c[j]; for (let j = 0; j < LTN; j++) c[j] -= d * q[j]; };
    while (U.length < 40) {
      let bi = -1, bn = 0; cols.forEach((c, i) => { const v = nrm(c); if (v > bn) { bn = v; bi = i; } });
      if (bi < 0 || bn < 1e-7 * scale) break;
      const q = Float64Array.from(cols[bi]); for (const u of U) orth(u, q); const qn = nrm(q); for (let j = 0; j < LTN; j++) q[j] /= qn;
      U.push(q); for (const c of cols) orth(q, c);
    }
    const flat = new Float64Array(U.length * LTN); U.forEach((u, m) => flat.set(u, m * LTN));
    return (ltDictCache[pmt] = { U: flat, M: U.length });
  }
  function ltCompress(bins, pmt) {
    const D = ltDict(pmt), M = D.M, c = new Float64Array(bins.n * M), yy = new Float64Array(bins.n);
    for (let b = 0; b < bins.n; b++) { const o = b * LTN; let s = 0; for (let j = 0; j < LTN; j++) s += bins.y[o + j] * bins.y[o + j]; yy[b] = s; for (let m = 0; m < M; m++) { let v = 0; const om = m * LTN; for (let j = 0; j < LTN; j++) v += D.U[om + j] * bins.y[o + j]; c[b * M + m] = v; } }
    bins.cmp = { pmt, M, c, yy, U: D.U }; return bins;
  }
  function ltChi2(bins, B) {
    const K = B.K, a = new Float64Array(K); let c2 = 0;
    if (!bins.cmp || bins.cmp.pmt !== B.pmt) { for (let b = 0; b < bins.n; b++) c2 += bins.w[b] * ltFitDecay(B, bins.y, b * LTN, a); return c2; }
    const { M, c, yy, U } = bins.cmp, h = new Float64Array(K * M), p = B.p;
    for (let k = 0; k < K; k++) for (let m = 0; m < M; m++) { let v = 0; for (let j = 0; j < LTN; j++) v += U[m * LTN + j] * B.g[k * LTN + j]; h[k * M + m] = v; }
    for (let b = 0; b < bins.n; b++) {
      const o = b * M; for (let k = 0; k < K; k++) { let v = 0; for (let m = 0; m < M; m++) v += h[k * M + m] * c[o + m]; p[k] = v; }
      c2 += bins.w[b] * Math.max(0, yy[b] + ltSolve(B, p, a));
    }
    return c2;
  }
  // Nelder-Mead as a generator that yields after every evaluation, so a long fit can run in slices
  function* nmGen(f, x0, step, iters) {
    const n = x0.length; let P = [x0.slice()]; for (let k = 0; k < n; k++) { const x = x0.slice(); x[k] += step; P.push(x); }
    let F = []; for (const p of P) { F.push(f(p)); yield; }
    for (let it = 0; it < iters; it++) {
      const ord = F.map((v, i) => i).sort((a, b) => F[a] - F[b]); P = ord.map(i => P[i]); F = ord.map(i => F[i]);
      if (F[n] - F[0] <= 1e-9 * Math.abs(F[0]) + 1e-12) break;
      const c = new Array(n).fill(0); for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) c[k] += P[i][k] / n;
      const pt = t => c.map((v, k) => v + t * (P[n][k] - v));
      const xr = pt(-1), fr = f(xr); yield;
      if (fr < F[0]) { const xe = pt(-2), fe = f(xe); yield; if (fe < fr) { P[n] = xe; F[n] = fe; } else { P[n] = xr; F[n] = fr; } }
      else if (fr < F[n - 1]) { P[n] = xr; F[n] = fr; }
      else {
        const xc = fr < F[n] ? pt(-0.5) : pt(0.5), fc = f(xc); yield;
        if (fc < Math.min(fr, F[n])) { P[n] = xc; F[n] = fc; }
        else for (let i = 1; i <= n; i++) { P[i] = P[i].map((v, k) => P[0][k] + 0.5 * (v - P[0][k])); F[i] = f(P[i]); yield; }
      }
    }
    let b = 0; for (let i = 1; i <= n; i++) if (F[i] < F[b]) b = i;
    return { x: P[b], f: F[b] };
  }
  function runGen(g) { let r; do r = g.next(); while (!r.done); return r.value; }
  function nelderMead(f, x0, step, iters) { return runGen(nmGen(f, x0, step, iters)); }
  // chi-squared as a function of log lifetimes, amplitudes solved for every bin (variable projection)
  function ltObjective(pmt, bins) {
    return u => {
      const t = u.map(Math.exp).sort((a, b) => a - b);
      if (t[0] < LT.min || t[t.length - 1] > LT.max) return 1e300;
      for (let k = 1; k < t.length; k++) if (t[k] / t[k - 1] < LT.sep) return 1e300;
      return ltChi2(bins, ltBasis(pmt, t));
    };
  }
  // Global lifetime fit. From the previous lifetimes (or one component at 3 ns), a component is added while it
  // lowers chi-squared by more than LT.gain times the number of amplitudes it adds (one per bin). A generator:
  // ltGlobal runs it to the end; the run model steps it a few milliseconds at a time.
  function* ltGlobalGen(pmt, bins, prev, opt) {
    opt = opt || {}; const kMax = opt.kMax || LT.kMax, iters = opt.iters || 160;
    if (!bins.cmp) ltCompress(bins, pmt);
    const f = ltObjective(pmt, bins);
    const dof = k => bins.n * LTN - bins.n * k - k;
    function* fit(t0, it) { const r = yield* nmGen(f, t0.map(Math.log), 0.12, it); return { taus: r.x.map(Math.exp).sort((a, b) => a - b), chi2: r.f }; }
    let cur = yield* fit(prev && prev.length ? prev : [3.0], iters);
    const hist = [{ K: cur.taus.length, chi2: cur.chi2, chi2r: cur.chi2 / dof(cur.taus.length), taus: cur.taus, accepted: true }];
    while (cur.taus.length < kMax) {
      let best = null;
      for (const s of LT.seeds) {
        if (cur.taus.some(t => Math.abs(Math.log(t / s)) < 0.3)) continue;
        const r = yield* fit(cur.taus.concat([s]), 50); if (r.chi2 < 1e299 && (!best || r.chi2 < best.chi2)) best = r;
      }
      if (!best) break;
      best = yield* fit(best.taus, iters);
      const gain = cur.chi2 - best.chi2, ok = gain > LT.gain * bins.n;
      hist.push({ K: best.taus.length, chi2: best.chi2, chi2r: best.chi2 / dof(best.taus.length), taus: best.taus, gain, accepted: ok });
      if (!ok) break;
      cur = best;
    }
    return { taus: cur.taus, chi2: cur.chi2, chi2r: cur.chi2 / dof(cur.taus.length), dof: dof(cur.taus.length), nBins: bins.n, hist };
  }
  function ltGlobal(pmt, bins, prev, opt) { return runGen(ltGlobalGen(pmt, bins, prev, opt)); }
  // Standard errors of the lifetimes from the curvature of chi-squared (amplitudes profiled out), scaled by
  // the reduced chi-squared
  function ltErrors(pmt, bins, taus, chi2r) {
    const K = taus.length, c = t => ltChi2(bins, ltBasis(pmt, t)), h = taus.map(t => t * 0.004), f0 = c(taus), H = new Float64Array(K * K);
    const at = (d) => c(taus.map((t, k) => t + (d[k] || 0)));
    for (let a = 0; a < K; a++) for (let b = a; b < K; b++) {
      let v;
      if (a === b) { const d = []; d[a] = h[a]; const fp = at(d); d[a] = -h[a]; v = (fp - 2 * f0 + at(d)) / (h[a] * h[a]); }
      else { const d = []; d[a] = h[a]; d[b] = h[b]; const fpp = at(d); d[b] = -h[b]; const fpm = at(d); d[a] = -h[a]; const fmm = at(d); d[b] = h[b]; const fmp = at(d); v = (fpp - fpm - fmp + fmm) / (4 * h[a] * h[b]); }
      H[a * K + b] = H[b * K + a] = v / 2;
    }
    const inv = invSmall(H, K); return taus.map((t, k) => inv && inv[k * K + k] > 0 ? Math.sqrt(inv[k * K + k] * Math.max(1, chi2r)) : NaN);
  }
  // Name each component after the template's expected species: nearest expected lifetime within a factor of
  // 1.35, each species used once. A name is a label for the reader, not an identification.
  function ltAssign(taus, lib) {
    const pairs = []; taus.forEach((t, k) => lib.forEach((s, m) => { const d = Math.abs(Math.log(t / s.exp)); if (d < Math.log(1.35)) pairs.push([d, k, m]); }));
    pairs.sort((a, b) => a[0] - b[0]); const out = taus.map(() => -1), used = new Set();
    for (const [, k, m] of pairs) if (out[k] < 0 && !used.has(m)) { out[k] = m; used.add(m); }
    return out;
  }

  /* ---------- chromatography (simulated AKTA result export) ---------- */
  function makeAkta(ph, prof, seed, dtS) {
    dtS = dtS || 5; const n = Math.floor(ph.totalMin * 60 / dtS) + 1;
    const A = { n, dt: dtS, t: new Float64Array(n), v: new Float64Array(n), flow: new Float32Array(n), uv: new Float32Array(n), cond: new Float32Array(n), ph: new Float32Array(n), phase: new Int8Array(n), uvTrue: new Float32Array(n) };
    for (let i = 0; i < n; i++) {
      const tMin = i * dtS / 60, v = pumpVolAt(ph, tMin), r = mulberry32(hash(seed, 0xA47A, i, 0)), p = prof.at(v);
      A.t[i] = tMin; A.v[i] = v; A.flow[i] = flowAt(ph, tMin); A.phase[i] = phaseIdxAtTime(ph, tMin);
      A.uvTrue[i] = p.uvTrue + 0.3 * gauss(r); A.uv[i] = Math.min(3800, A.uvTrue[i]);
      A.cond[i] = p.cond + 0.03 * gauss(r); A.ph[i] = p.ph + 0.005 * gauss(r);
    }
    return A;
  }
  function lowerBound(arr, n, x) { let lo = 0, hi = n; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < x) lo = m + 1; else hi = m; } return lo; }
  function aktaAtVol(K, key, v) { const i = Math.min(K.n - 1, lowerBound(K.v, K.n, v)); return K[key][i]; }

  /* ---------- fractions and the two volume mappings (8.3) ---------- */
  function buildFractions(ph, fr) {
    const out = [], L = ph.list, lp = L.find(p => p.key === fr.loadPhase), ep = L.find(p => p.key === fr.elPhase);
    if (lp) { let a = lp.v0, k = 1; while (a < lp.v1 - 1e-9) { const b = Math.min(lp.v1, a + fr.loadSize); out.push({ id: 'FT' + String(k).padStart(2, '0'), phaseKey: lp.key, phase: lp.short, a, b }); a = b; k++; } }
    if (ep) { let a = ep.v0, k = 1; const end = Math.min(ep.v1, ep.v0 + fr.elCollect); while (a < end - 1e-9) { const b = Math.min(end, a + fr.elSize); out.push({ id: 'E' + String(k).padStart(2, '0'), phaseKey: ep.key, phase: ep.short, a, b }); a = b; k++; } }
    return out;
  }
  // Physical collected range in UV-referenced volume: UNICORN cuts at [a, b] assuming its configured delay D;
  // liquid actually reaching the outlet passed the UV monitor at [a + D - (V1 + V2), b + D - (V1 + V2)].
  function collectedRange(f, plumb) { const d = plumb.fracDelay - (plumb.V1 + plumb.V2); return [f.a + d, f.b + d]; }

  /* ---------- statistics ---------- */
  function linreg(xs, ys, ws) {
    let sw = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (let i = 0; i < xs.length; i++) { const w = ws ? ws[i] : 1; sw += w; sx += w * xs[i]; sy += w * ys[i]; sxx += w * xs[i] * xs[i]; sxy += w * xs[i] * ys[i]; }
    const den = sw * sxx - sx * sx, b = (sw * sxy - sx * sy) / den, a = (sy - b * sx) / sw; return { a, b };
  }
  function fnv(arrs, n) { // FNV-1a over float data, used as a data checksum for reproducibility
    let h = 0x811c9dc5; const f = new Float64Array(1), u8 = new Uint8Array(f.buffer);
    for (const a of arrs) for (let i = 0; i < n; i++) { f[0] = a[i]; for (let k = 0; k < 8; k++) { h ^= u8[k]; h = Math.imul(h, 0x01000193); } }
    return (h >>> 0).toString(16).toUpperCase().padStart(8, '0');
  }
  function crc32(str) { let c, crc = 0xFFFFFFFF; for (let n = 0; n < str.length; n++) { c = (crc ^ str.charCodeAt(n)) & 0xFF; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xEDB88320 : c >>> 1; crc = (crc >>> 8) ^ c; } return ((crc ^ 0xFFFFFFFF) >>> 0).toString(16).toUpperCase().padStart(8, '0'); }

  return {
    SEED, DX, NSAMP, NBASE, WIN0, WIN1, ND_T, ND_T_SHOWN, WHEEL_POS, ND_LIST, T_of, LADDERS, IRF_TERMS, ACQ, RANGES_V, realRange, LASER, TEMPLATES,
    mulberry32, hash, gauss, unif, trapz, trapzConst, mean, median, pstd, medianOf, countsToVolts, tfcV20, tfcProposed, tfcMeanWindow, autorange,
    irfCurve, irfStats, convExp, shapeTable, shapeFor, cloneTemplate, buildPhases, pumpVolAt, flowAt, timeAtVol, phaseIdxAtVol, phaseIdxAtTime,
    buildProfile, innerFilter, laserLevel, laserLogEntry, laserExcitation, laserStability, createAcq, acqStep, genWaveform, regenBlock, medianWave, decayMetric,
    makeAkta, aktaAtVol, lowerBound, buildFractions, collectedRange, linreg, fnv, crc32, smoothNoise, sig,
    SPECIES, unitShape, mixShape, LTN, LT, ltJ0, invSmall, ltBasis, ltSolve, ltFitDecay, ltBins, ltDict, ltCompress, ltChi2, nelderMead, runGen, ltGlobalGen, ltGlobal, ltErrors, ltAssign
  };
})();

