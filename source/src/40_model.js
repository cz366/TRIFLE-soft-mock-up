/* =====================================================================
   App model: state, simulated clock, laser, readiness, run playback,
   evidence rules, fractions, audit trail. No DOM access in this section.
   ===================================================================== */
const M = (function () {
  /* ---------- number formats (14.6) ---------- */
  const nf0 = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
  const fmt = {
    sig3(v) { if (v == null || !isFinite(v)) return '–'; if (v === 0) return '0.00'; const a = Math.abs(v); if (a >= 1000) return nf0.format(Number(v.toPrecision(3))); return v.toPrecision(3); },
    ml(v) { return v == null || !isFinite(v) ? '–' : v.toFixed(2); },
    cv(v) { return v == null || !isFinite(v) ? '–' : v.toFixed(2); },
    min1(v) { return v == null || !isFinite(v) ? '–' : v.toFixed(1); },
    mau(v) { return v == null || !isFinite(v) ? '–' : nf0.format(Math.round(v)); },
    cond(v) { return v == null || !isFinite(v) ? '–' : v.toFixed(1); },
    ph(v) { return v == null || !isFinite(v) ? '–' : v.toFixed(2); },
    pct0(v) { return v == null || !isFinite(v) ? '–' : (v * 100).toFixed(0); },
    pct1(v) { return v == null || !isFinite(v) ? '–' : (v * 100).toFixed(1); },
    mv(v) { if (v == null || !isFinite(v)) return '–'; const s = (v * 1000).toFixed(2); return (/^-0\.00$/.test(s) ? '0.00' : s).replace(/^-/, '−'); },
    ns(v) { return v == null || !isFinite(v) ? '–' : v.toFixed(1); },
    clock(s) { if (s == null || !isFinite(s)) return '–'; s = Math.max(0, Math.floor(s)); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60; return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(x).padStart(2, '0'); },
    dur(min) { return min == null || !isFinite(min) ? '–' : min.toFixed(1) + ' min'; },
    int(v) { return nf0.format(v); },
    size(mb) { if (mb == null || !isFinite(mb)) return '–'; return mb < 1000 ? nf0.format(Math.round(mb)) + ' MB' : mb < 1e6 ? (mb / 1000).toFixed(1) + ' GB' : (mb / 1e6).toFixed(1) + ' TB'; },
    sig3s(v) { if (v == null || !isFinite(v)) return '–'; const t = fmt.sig3(Math.abs(v)); return (v < 0 ? '−' : v > 0 ? '+' : '') + t; }
  };

  /* ---------- simulated wall clock: laser emission starts 08:30:00 on the session date ---------- */
  const T0 = { y: 2026, mo: 10, d: 9, h: 8, mi: 30 };
  function wall(simS) { const tot = T0.h * 3600 + T0.mi * 60 + Math.floor(simS); const d = Math.floor(tot / 86400); const s = tot % 86400; return { date: '2026-10-' + String(T0.d + d).padStart(2, '0'), time: fmt.clock(s) }; }
  function stamp(simS) { const w = wall(simS); return w.date + ' ' + w.time; }

  /* ---------- state ---------- */
  const S = {
    simT: 0, speed: 10, tickMs: 100, engineer: false, fault: 'none',
    setup: {
      eln: 'ELN-SIM-2026-0142', runName: 'Protein A capture, CUB lot SIM-07', operator: 'DS',
      sample: 'mAb CUB', template: 'protA', system: 'avant', source: 'import', column: 'HiScreen MabSelect PrismA', cvMl: 4.657,
      plumbOrder: 'uv-trifle-fc', V1: 0.20, V2: 0.15, fracDelay: 0.35, fracDelayPre: 0.12, flowTrace: true,
      frac: { loadSize: 5.0, elSize: 1.0, elCollect: 12.0 },
      pmt: 400, irfFile: 400, ladderFile: 400,
      autorange: 'v20', beamPerBlock: false, save2s: false, laserCheck: false, csvJson: false,
      rangeMap: 'stated', // discrepancy 2 what-if for the next run: 'stated' (v2.0 assumption) or 'shift' (one setting larger)
      timerMin: null, trained: false, ip: false, flows: null
    },
    proc: { median: false, window: false, laser: false, compare: false },
    th: {
      laserFallPct: 20, laserHoldPct: 2, laserHoldMin: 5, laserNoStepMin: 60,
      i2Count: 2, i3Count: 3, i4V: 0.005, i5Tol: 0.05, i6Pct: 2, p2SlopePct: 2, p2PlateauPct: 1, p3Pct: 10, p4Pct: 10, p5Pct: 5,
      lowPrec: 0.20, clearS: 60, bufNoise: 0.0015, bufDrift: 0.0002, bufWander: 0.0015, darkRms: 0.0005, flPct: 5
    },
    demo: { laserEarly: false, delayNotUpdated: false },
    audit: [], laserLog: [], laser: null, readiness: null, run: null, decisions: {}, responses: {}, notes: [], exports: [],
    alignChecked: '2026-09-28', listeners: []
  };
  const TH_INFO = {
    laserFallPct: ['Laser step-down: controller reading falls by more than', '%'], laserHoldPct: ['Laser stable: reading held within', '±%'], laserHoldMin: ['Laser stable: held for at least', 'min'], laserNoStepMin: ['Laser stable with no step-down after', 'min'],
    i2Count: ['I2: waveforms above 90 % of range, more than this many of the last 10', 'count'], i3Count: ['I3: discarded blocks in 1 min, more than', 'count'], i4V: ['I4: beam monitor minimum', 'V'], i5Tol: ['I5: fraction delay tolerance', 'mL'],
    i6Pct: ['I6: laser change, more than', '%'], p2SlopePct: ['P2: fluorescence slope over the last 1 CV, more than', '% per CV'], p2PlateauPct: ['P2: plateau when the slope is below', '% per CV'], p3Pct: ['P3: buffer baseline difference from pre-run, more than', '%'], p4Pct: ['P4: Wash 2 difference from equilibration, more than', '%'], p5Pct: ['P5: beam monitor change from run start, more than', '%'],
    lowPrec: ['Low precision when input range use is below', 'fraction'], clearS: ['A condition clears after being false for', 's'], bufNoise: ['Buffer baseline noise limit', 'V·ns'], bufDrift: ['Buffer baseline drift limit', 'V·ns/min'], bufWander: ['Buffer baseline wander limit', 'V·ns'], darkRms: ['Dark block noise limit', 'V'], flPct: ['Fluorescence boundary level', '% of peak']
  };
  function emit(ev) { for (const f of S.listeners) f(ev); }
  function on(f) { S.listeners.push(f); }
  function audit(kind, text, extra) { S.audit.push({ t: S.simT, ts: stamp(S.simT), kind, text, by: S.setup.operator + (S.engineer ? ' (Engineer view)' : ''), ...(extra || {}) }); emit('audit'); }

  /* ---------- presets (versioned, with checksum: Proposed) ---------- */
  function presetInfo(pmt) {
    const lad = TR.LADDERS[pmt], irf = TR.IRF_TERMS[pmt];
    const body = 'PMT ' + pmt + '\n' + lad.map(s => s.nd + '\t' + s.range).join('\n') + '\n' + irf.map(t => t.join('\t')).join('\n');
    return { id: 'P' + pmt + '-R3', pmt, ladderFile: 'od_filters_and_ranges_' + pmt + '_mV.txt', irfFile: 'impulse_' + pmt + '_mV.txt', checksum: TR.crc32(body), steps: lad.length };
  }
  function presetCheck() {
    const s = S.setup, ok = s.irfFile === s.pmt && s.ladderFile === s.pmt;
    return { ok, msg: ok ? 'PMT, IRF and ladder match.' : 'Preset mismatch: PMT ' + s.pmt + ' mV with IRF for ' + s.irfFile + ' mV and ladder for ' + s.ladderFile + ' mV. The run is blocked.' };
  }
  // simulation noise floor and gain by PMT preset (800 mV values assumed)
  function pmtSim(pmt) { return pmt === 800 ? { gain: 20, sigma: 0.0012 } : { gain: 1, sigma: 0.0002 }; }
  function procMode() { const p = S.proc; return (p.median || p.window || p.laser) ? 'prop' : 'v20'; }
  function procLabel(m) {
    const p = S.proc; if ((m || procMode()) === 'v20') return 'v2.0 reference';
    const parts = []; if (p.median) parts.push('median baseline'); if (p.window) parts.push('30 to 70 ns window'); if (p.laser) parts.push('laser correction');
    return 'Proposed (' + parts.join(', ') + ')';
  }
  function comboIdx() { return (S.proc.median ? 1 : 0) + (S.proc.window ? 2 : 0); }

  /* ---------- method template and plumbing ---------- */
  function template() { const t = TR.cloneTemplate(S.setup.template === 'free' ? 'protA' : S.setup.template); if (S.setup.template === 'free') { t.id = 'free'; t.name = 'Free run'; t.breakthroughRule = false; } t.cv = S.setup.cvMl; if (S.setup.flows) t.phases.forEach((p, i) => { if (S.setup.flows[i]) Object.assign(p, S.setup.flows[i]); }); return t; }
  function plumbing() { const s = S.setup; return { V1: s.V1, V2: s.V2, fracDelay: S.demo.delayNotUpdated ? s.fracDelayPre : s.fracDelay }; }
  function alignmentState() {
    const s = S.setup, p = plumbing(), issues = [];
    const missing = !(isFinite(s.V1) && s.V1 >= 0) || !(isFinite(s.V2) && s.V2 >= 0);
    if (s.source === 'standalone') return { detector: 'n/a', fractions: 'n/a', issues: ['Standalone TRIFLE: no chromatography data.'], i5: false };
    if (missing) issues.push('A delay volume is missing.');
    const noFlow = s.source === 'manual' || !s.flowTrace; if (noFlow) issues.push('The flow-rate trace is missing.');
    const diff = isFinite(p.fracDelay) && !missing ? p.fracDelay - (s.V1 + s.V2) : NaN;
    const mism = isFinite(diff) && Math.abs(diff) > S.th.i5Tol + 1e-12; if (mism) issues.push('UNICORN fraction delay ' + fmt.ml(p.fracDelay) + ' mL, expected ' + fmt.ml(s.V1 + s.V2) + ' mL (tolerance ' + fmt.ml(S.th.i5Tol) + ' mL).');
    if (!isFinite(p.fracDelay)) issues.push('The UNICORN fraction delay is missing.');
    const det = (missing || noFlow) ? 'Uncertain' : 'Aligned', fr = (missing || noFlow || mism || !isFinite(p.fracDelay)) ? 'Uncertain' : 'Aligned';
    return { detector: det, fractions: fr, issues, i5: issues.length > 0, diff };
  }

  /* ---------- laser log and stability (section 7) ---------- */
  function laserUpdate() {
    const kMax = Math.floor(S.simT / TR.LASER.logS);
    while (S.laserLog.length <= kMax) S.laserLog.push(TR.laserLogEntry(S.laserLog.length, S.fault === 'laser' ? 'laser' : null));
    const th = { stepFallPct: S.th.laserFallPct, holdPct: S.th.laserHoldPct, holdMin: S.th.laserHoldMin, noStepMin: S.th.laserNoStepMin };
    const key = JSON.stringify(th);
    if (!S.laser || S.laser._th !== key) { S.laser = TR.laserStability(S.laserLog, th, null); S.laser._th = key; }
    else TR.laserStability(S.laserLog, th, S.laser);
    S.laser.last = S.laserLog.length ? S.laserLog[S.laserLog.length - 1].pd : 0;
    S.laser.tl = S.simT / 60;
    if (S.fault === 'laser') S.laser.state = 'notdetected';
    return S.laser;
  }
  function laserText(L) {
    L = L || S.laser; if (!L) return '';
    if (L.state === 'notdetected') return 'Laser not detected. The controller reading and beam monitor are at zero.';
    if (L.state === 'stable') return 'Laser stable (provisional) since ' + fmt.min1(L.stableAt) + ' min after emission start' + (L.how === 'step' ? ', after the step-down at ' + fmt.min1(L.stepAt) + ' min.' : ', with no step-down after ' + S.th.laserNoStepMin + ' min.');
    return 'Laser warming up. ' + laserDetail(L);
  }
  // The same facts without the leading state words, for panels that already show the state
  function laserDetail(L) {
    L = L || S.laser; if (!L) return '';
    if (L.state === 'notdetected') return 'The controller reading and beam monitor are at zero.';
    if (L.state === 'stable') return 'Since ' + fmt.min1(L.stableAt) + ' min' + (L.how === 'step' ? ', after the step-down at ' + fmt.min1(L.stepAt) + ' min.' : ', with no step-down after ' + S.th.laserNoStepMin + ' min.');
    if (L.stepAt != null) return 'Step-down observed at ' + fmt.min1(L.stepAt) + ' min; waiting for the reading to hold within ±' + S.th.laserHoldPct + ' % for ' + S.th.laserHoldMin + ' min.';
    return 'The reading typically steps down 14 to 25 min after emission starts.';
  }

  /* ---------- readiness (section 10) ---------- */
  // dark block noise limit in V: the threshold scaled to the preset (10 times at 800 mV)
  function darkLimit(pmt) { return S.th.darkRms * ((pmt || S.setup.pmt) === 800 ? 10 : 1); }
  // buffer limits scale with PMT gain like the dark limit (800 mV preset: 10 times)
  function bufLimits(pmt) { const k = (pmt || S.setup.pmt) === 800 ? 10 : 1; return { noise: S.th.bufNoise * k, drift: S.th.bufDrift * k, wander: S.th.bufWander * k }; }
  // limit is a getter where it follows a threshold or the preset, so the table always shows the value in use
  const RD_CHECKS = [
    { key: 'dig', name: 'Digitiser', label: 'E', limit: 'Found on USB', meaning: 'The PicoScope that records each laser pulse is connected and responds.', ifFail: 'Check the USB cable and power, then run the checks again.' },
    { key: 'wheel', name: 'Filter wheel', label: 'E', limit: 'Reaches position 6 (OD 4) and returns', meaning: 'The motorised wheel can move the neutral density filters that set the sensitivity.', ifFail: 'Check the wheel cable and power.' },
    { key: 'emit', name: 'Laser emission', label: 'P', get limit() { return '10 of 10 pulses ≥ ' + S.th.i4V + ' V within ' + TR.ACQ.timeoutS + ' s'; }, meaning: 'The beam monitor on channel D sees laser pulses. v2.0 has this check but skips it.', ifFail: 'Check that the laser controller shows emission, the shutter is open and the beam path is clear.' },
    { key: 'pmt', name: 'PMT voltage', label: 'E', limit: 'Matches the preset', meaning: 'Detector gain, set by hand on a separate supply. The software cannot read it.', ifFail: 'Set the supply to the preset value and confirm.' },
    { key: 'dark', name: 'Dark block', label: 'P', get limit() { return '≤ ' + fmt.mv(darkLimit()) + ' mV RMS'; }, meaning: 'Electronic noise with the laser blocked. High noise lowers precision at low signal.', ifFail: 'Check cable shielding and grounding; ask the instrument specialist.' },
    { key: 'buf', name: 'Buffer baseline', label: 'P', get limit() { const L = bufLimits(); return 'Noise ≤ ' + L.noise + ', drift ±' + L.drift + ' per min, wander ≤ ' + L.wander + ' V·ns'; }, meaning: 'Fluorescence of running buffer with flow on. Sets the baseline for rule P3.', ifFail: 'Flush the flow cell and repeat. Persistent drift can indicate fouling.' }
  ];
  function newReadiness() {
    return { started: false, t0: null, checks: Object.fromEntries(RD_CHECKS.map(c => [c.key, { status: 'pending', value: '', detail: '' }])), pmtConfirmed: false, acq: null, metrics: null, preBaseline: null, override: null, dark: null, emitV: null };
  }
  function readinessStart() {
    const R = S.readiness = newReadiness(); R.started = true; R.t0 = S.simT;
    R.pmtConfirmed = S._pmtConfirmed || false;
    const pmt = S.setup.pmt;
    // running buffer: scatter and buffer only, the same species as the run's buffer phases
    R.acq = TR.createAcq({ seed: TR.SEED, stream: 2, pmt, ...pmtSim(pmt), cap: 400, tEnd: 330, taus: [TR.SPECIES.protA[0].tau], signalAt: (tS) => ({ S: 0.0080 * (1 + 0.004 * TR.smoothNoise(TR.SEED + 3, (R.t0 + tS) / 60, [3.1, 7.7, 13.3])), comp: [1], E: S.fault === 'laser' ? 0 : 1, u: 0, vp: 0, phase: 0 }) });
    audit('readiness', 'Readiness checks started.');
    emit('readiness');
  }
  function readinessStep() {
    const R = S.readiness; if (!R || !R.started) return;
    const dt = S.simT - R.t0, c = R.checks, f = S.fault;
    const set = (k, status, value, detail) => { if (c[k].status !== status || c[k].value !== value) { c[k].status = status; c[k].value = value; c[k].detail = detail || ''; R.changed = true; } };
    set('dig', dt < 0.5 ? 'running' : (f === 'digitiser' ? 'fail' : 'pass'), dt < 0.5 ? '' : (f === 'digitiser' ? 'Not found' : 'PicoScope 6000 found'));
    if (f === 'digitiser') { ['wheel', 'emit', 'dark', 'buf'].forEach(k => set(k, 'blocked', 'Needs the digitiser')); return; }
    set('wheel', dt < 2.0 ? 'running' : (f === 'wheel' ? 'fail' : 'pass'), dt < 2.0 ? '' : (f === 'wheel' ? 'No response from the wheel' : 'Reached OD 4 in 0.9 s and returned'));
    // Laser emission check (Proposed, discrepancy 7): one beam monitor block on channel D. A pass takes about
    // 1 s (10 pulses at 10 Hz); with no light the block times out after 3 s and the check fails.
    if (S.setup.laserCheck) {
      const v = f === 'laser' ? 0 : 0.28 * 0.999, ok = v >= S.th.i4V;
      if (dt < (ok ? 1.0 : TR.ACQ.timeoutS)) set('emit', 'running', '');
      else { R.emitV = v; set('emit', ok ? 'pass' : 'fail', ok ? '10 of 10 pulses ≥ ' + S.th.i4V + ' V (lowest ' + v.toFixed(3) + ' V)' : '0 of 10 pulses ≥ ' + S.th.i4V + ' V within ' + TR.ACQ.timeoutS + ' s'); }
    } else set('emit', 'disabled', 'Not checked');
    set('pmt', R.pmtConfirmed ? 'pass' : 'manual', R.pmtConfirmed ? S.setup.pmt + ' mV confirmed by ' + S.setup.operator : 'Confirm ' + S.setup.pmt + ' mV on the supply');
    if (f === 'wheel') { set('dark', 'blocked', 'Needs the filter wheel'); set('buf', 'blocked', 'Needs the filter wheel'); return; }
    if (dt < 5.0) set('dark', 'running', '');
    else if (!R.dark) {
      // dark block: 10 waveforms with the laser blocked, most sensitive step
      const A = TR.createAcq({ seed: TR.SEED, stream: 3, pmt: S.setup.pmt, ...pmtSim(S.setup.pmt), signalAt: () => ({}) }), v = new Float64Array(TR.NSAMP); let ss = 0, n = 0;
      for (let w = 0; w < 10; w++) { TR.genWaveform(A, 0, w, 0, 0, 3.5, TR.LADDERS[S.setup.pmt].length, v); const m = TR.mean(v, 0, TR.NSAMP); for (let j = 0; j < TR.NSAMP; j++) { ss += (v[j] - m) * (v[j] - m); n++; } }
      R.dark = Math.sqrt(ss / n); set('dark', R.dark <= darkLimit() ? 'pass' : 'fail', fmt.mv(R.dark) + ' mV RMS');
    }
    if (c.emit.status === 'fail') { set('buf', 'blocked', 'Needs the laser'); return; }
    // buffer baseline acquisition from t = 6 s
    if (dt >= 6) {
      TR.acqStep(R.acq, dt - 6);
      const A = R.acq, need = 320;
      if (A.n < need) set('buf', 'running', Math.min(A.n, need) + ' of ' + need + ' blocks (' + fmt.min1(Math.min(A.n, need) / 60) + ' of 5.3 min)');
      else if (!R.metrics) { R.metrics = bufferMetrics(); R.changed = true; }
      if (R.metrics) { const m = R.metrics; set('buf', m.pass ? 'pass' : 'fail', 'Noise ' + fmt.sig3(m.noise) + ', drift ' + fmt.sig3s(m.drift) + ' per min, wander ' + fmt.sig3(m.wander) + ' V·ns'); }
    } else set('buf', 'pending', '');
  }
  function bufferMetrics() {
    const A = S.readiness.acq, y = fluorOf(A, 20, 320);
    const last60 = y.slice(y.length - 60), mu = last60.reduce((a, b) => a + b, 0) / 60;
    const noise = Math.sqrt(last60.reduce((a, b) => a + (b - mu) * (b - mu), 0) / 60);
    const xs = []; for (let i = 20; i < 320; i++) xs.push(A.t[i] / 60); const fit = TR.linreg(xs, y, null);
    let mx = -Infinity, mn = Infinity; for (let i = 0; i + 30 <= y.length; i++) { let s = 0; for (let k = i; k < i + 30; k++) s += y[k]; s /= 30; if (s > mx) mx = s; if (s < mn) mn = s; }
    const wander = mx - mn, th = S.th;
    return { noise, drift: fit.b, wander, mean: mu, median: TR.medianOf(y), mode: procLabel(), pass: noise <= bufLimits().noise && Math.abs(fit.b) <= bufLimits().drift && wander <= bufLimits().wander, n: y.length };
  }
  function fluorOf(A, i0, i1) { const k = comboIdx(), out = []; for (let i = i0; i < i1; i++) { if (A.disc[i]) continue; let v = A.F[k][i]; if (S.proc.laser && isFinite(A.bm[i])) v /= A.bm[i]; out.push(v); } return out; }
  function readinessSummary() {
    const R = S.readiness, L = S.laser;
    if (!R || !R.started) return { state: 'notrun', inst: false, laser: L && L.state === 'stable', text: 'Readiness checks have not been run.' };
    const req = ['dig', 'wheel', 'pmt', 'dark', 'buf'].concat(S.setup.laserCheck ? ['emit'] : []);
    const failed = req.filter(k => R.checks[k].status === 'fail');
    const inst = req.every(k => R.checks[k].status === 'pass');
    const pc = presetCheck(), signed = S.setup.trained && S.setup.ip;
    const laser = L && L.state === 'stable';
    let state, text;
    if (!pc.ok) { state = 'blocked'; text = pc.msg; }
    else if (failed.length) { state = 'fault'; text = 'Not ready: ' + failed.map(k => RD_CHECKS.find(c => c.key === k).name.toLowerCase()).join(', ') + ' failed.'; }
    else if (!inst) { state = 'checking'; text = 'Checks in progress.'; }
    else if (!signed) { state = 'signin'; text = 'Instrument ready. Tick Trained user and IP agreement on Setup.'; }
    else if (!laser) { state = 'laser'; text = laserText(); }
    else { state = 'ready'; text = 'Ready to start.'; }
    // no override while the laser is not detected: starting then would record no valid fluorescence
    return { state, inst, laser, text, ready: state === 'ready', canOverride: state === 'laser' && !(L && L.state === 'notdetected') && inst && pc.ok && signed };
  }

  /* ---------- run model ---------- */
  function newRun() {
    const s = S.setup, tpl = template(), ph = TR.buildPhases(tpl), spKey = tpl.id === 'free' ? 'protA' : tpl.id, prof = TR.buildProfile(spKey, ph, {});
    const preMin = 1.0, timer = s.timerMin || Math.ceil(ph.totalMin + preMin + 1.0);
    const align = alignmentState(), p = plumbing();
    const R = {
      id: 'RUN-' + s.eln.replace(/[^0-9A-Z]/gi, '').slice(-4) + '-01', tpl, ph, prof, preMin, timerMin: timer, cv: tpl.cv, plumbAtStart: { ...p }, V1: s.V1, setupSnap: JSON.parse(JSON.stringify(s)),
      state: 'acquiring', simStart: S.simT, laserTl0: S.simT / 60, paused: false, pausedAt: null, brkNext: false, endAt: null, endReason: null,
      akta: TR.makeAkta(ph, prof, TR.SEED, 5), aktaN: 0, notes: [], log: [], logged: new Set(), changesLogged: 0, toLogged: 0,
      // Saving (discrepancy 5): both models are counted in every run; mode is the one that drove this run.
      // n: 1 and last: 0 are the start save (start_experiment.py line 57); ref: -Infinity mirrors save_time = 0.0.
      save: { mode: s.save2s ? 'p2s' : 'v20', nData: 0, v20: { n: 1, mb: 0, last: 0 }, p2s: { n: 1, mb: 0, last: 0, ref: -Infinity, nAt: 0 } }, lastSave: 0,
      laserStableAtStart: !!(S.laser && S.laser.state === 'stable'), override: S.readiness && S.readiness.override ? S.readiness.override : null,
      readyAcq: S.readiness && S.readiness.metrics ? S.readiness.acq : null, pmt: s.pmt, preset: presetInfo(s.pmt), dataGen: 1
    };
    R.fractions = s.source === 'standalone' ? [] : TR.buildFractions(ph, s.frac.loadSize ? { loadPhase: tpl.fractions.loadPhase, loadSize: s.frac.loadSize, elPhase: tpl.fractions.elPhase, elSize: s.frac.elSize, elCollect: s.frac.elCollect } : tpl.fractions);
    const fault = S.fault, E0 = fault === 'laser' ? 0 : 1;
    R.bmStart = 0.28 * E0 * TR.laserExcitation(R.laserTl0);
    R.acq = TR.createAcq({
      seed: TR.SEED, stream: 1, pmt: s.pmt, ...pmtSim(s.pmt), pDisc: 0.00025, beamPerBlock: s.beamPerBlock, tEnd: timer * 60, tauJit: 0.047, cap: Math.ceil(timer * 60) + 50,
      taus: TR.SPECIES[spKey].map(q => q.tau), keepDecays: true,
      arMedian: s.autorange === 'prop', arSymmetric: s.autorange === 'prop', arUnscaled: s.autorange === 'prop', arFlatGuard: s.autorange === 'prop',
      rangeMap: s.rangeMap,
      signalAt: (tS) => {
        const tA = tS / 60 - preMin, vp = TR.pumpVolAt(ph, Math.max(0, tA)), u = vp - R.V1, pr = prof.at(u);
        const E = (S.fault === 'laser' ? 0 : 1) * (1 - 0.02 * Math.max(0, tA) / ph.totalMin) * TR.laserExcitation(R.laserTl0 + tS / 60);
        return { S: pr.S * (1 + 0.004 * TR.smoothNoise(TR.SEED + 3, tS / 60, [3.1, 7.7, 13.3])), tau: pr.tau, comp: pr.comp, E, u, vp, phase: TR.phaseIdxAtVol(ph, u) };
      }
    });
    const cap = R.acq.cap;
    R.x = { vol: new Float64Array(cap), cv: new Float64Array(cap), min: new Float64Array(cap), raw: new Float64Array(cap), rawMin: new Float64Array(cap), acq: new Float64Array(cap) };
    R.standalone = s.source === 'standalone';
    R.y = { v20: new Float64Array(cap), prop: new Float64Array(cap), propU: new Float64Array(cap), diff: new Float64Array(cap), bm: new Float64Array(cap), act: new Float64Array(cap), decay: new Float64Array(cap) };
    R.robust = new Uint8Array(cap); R.low = new Uint8Array(cap); R.brk = new Uint8Array(cap); R.derivedN = 0;
    R.ak = { vol: new Float64Array(R.akta.n), cv: new Float64Array(R.akta.n), min: new Float64Array(R.akta.n) };
    for (let i = 0; i < R.akta.n; i++) { R.ak.vol[i] = R.akta.v[i]; R.ak.cv[i] = R.akta.v[i] / tpl.cv; R.ak.min[i] = R.akta.t[i]; }
    R.spKey = spKey;
    for (const h of runHooks) if (h.init) h.init(R);
    R.rules = new RuleEngine(R);
    S.run = R;
    log(R, 'system', 'TRIFLE acquisition started. Experiment timer ' + timer + ' min. Filter wheel to OD 4; beam monitor block captured (' + R.bmStart.toFixed(3) + ' V).');
    if (R.override) log(R, 'system', 'Started with a readiness override. Reason: ' + R.override.reason);
    audit('run', R.id + ' started (' + procLabel() + ' processing; auto-ranging ' + (s.autorange === 'v20' ? 'v2.0 reference' : 'Proposed') + ').');
    emit('run');
    return R;
  }
  function log(R, type, text, extra) { const e = { t: S.simT - R.simStart, wall: wall(S.simT).time, type, text, ...(extra || {}) }; R.log.push(e); emit('log'); return e; }
  function runTimeS(R) { return Math.max(0, S.simT - R.simStart); }
  function aktaMin(R, tS) { return tS / 60 - R.preMin; }
  function deriveTo(R) {
    const A = R.acq, n = A.n, cv = R.cv, ph = R.ph, k = comboIdx(), lc = S.proc.laser;
    for (let i = R.derivedN; i < n; i++) {
      const u = A.u[i]; R.x.vol[i] = u; R.x.cv[i] = u / cv; R.x.raw[i] = A.vp[i];
      const tA = aktaMin(R, A.t[i]); R.x.min[i] = u >= 0 ? Math.max(TR.timeAtVol(ph, u), i ? R.x.min[i - 1] : -1e9) : tA; R.x.rawMin[i] = tA; R.x.acq[i] = A.t[i] / 60;
      deriveY(R, i, k, lc);
      R.robust[i] = A.ruse[i] >= S.th.lowPrec ? 1 : 0; R.low[i] = A.disc[i] ? 0 : (A.ruse[i] < S.th.lowPrec ? 1 : 0);
      if (R.brkNext && !A.disc[i]) { R.brk[i] = 1; R.brkNext = false; }
    }
    const from = R.derivedN; R.derivedN = n;
    for (const h of runHooks) if (h.derive) h.derive(R, from, n);
  }
  function deriveY(R, i, k, lc) {
    const A = R.acq; if (A.disc[i]) { for (const key in R.y) R.y[key][i] = NaN; return; }
    const v20 = A.F[0][i], pu = A.F[k][i], bm = A.bm[i], pc = lc && isFinite(bm) ? pu / bm : pu;
    R.y.v20[i] = v20; R.y.propU[i] = pu; R.y.prop[i] = pc; R.y.bm[i] = isFinite(bm) ? bm * 100 : NaN;
    R.y.diff[i] = v20 !== 0 ? (pc - v20) / Math.abs(v20) * 100 : NaN;
    R.y.act[i] = procMode() === 'v20' ? v20 : pc;
    const dmin = S.th.decayUseMin != null ? S.th.decayUseMin : 0.2, dmax = S.th.decayUseMax != null ? S.th.decayUseMax : 0.9;
    R.y.decay[i] = A.ruse[i] >= dmin && A.ruse[i] <= dmax ? A.decay[i] : NaN;
  }
  function rederive(R) { if (!R) return; const k = comboIdx(), lc = S.proc.laser; for (let i = 0; i < R.acq.n; i++) deriveY(R, i, k, lc); R.dataGen++; R.rules.replay(); emit('data'); }
  /* ---------- saving (discrepancy 5) ---------- */
  // Record size estimate per block: 10 waveforms x 600 samples x 8 bytes, plus metadata
  const SAVE_KB = 50;
  // Count saves for blocks from..to-1 under both models. v2.0 (loop_measurements.py line 28) saves after every
  // block once any data exist, timed-out blocks included; each save rewrites the whole record. Proposed (p2s):
  // at most every 2 s, and only when new waveforms have arrived. A save happens at the end of its block.
  function saveStep(R, from, to) {
    const A = R.acq, sv = R.save;
    for (let i = from; i < to; i++) {
      if (!A.disc[i]) sv.nData++;
      if (!sv.nData) continue; // loop_measurements.py lines 24 to 25: nothing stored yet
      const t = A.t[i] - 0.5 + (A.disc[i] ? TR.ACQ.timeoutS : 1.0), mb = sv.nData * SAVE_KB / 1000;
      sv.v20.n++; sv.v20.mb += mb; sv.v20.last = t;
      if (t - sv.p2s.ref >= TR.ACQ.saveS - 1e-9 && sv.nData > sv.p2s.nAt) { sv.p2s.n++; sv.p2s.mb += mb; sv.p2s.last = t; sv.p2s.ref = t; sv.p2s.nAt = sv.nData; }
    }
    R.lastSave = sv[sv.mode].last;
  }
  function stepRun(R) {
    if (!R || R.state === 'complete') return;
    const tS = runTimeS(R);
    if (R.state === 'acquiring') {
      const before = R.acq.n; TR.acqStep(R.acq, tS);
      if (R.acq.n !== before) {
        deriveTo(R); saveStep(R, before, R.acq.n);
        // one Run log line per timed-out block (discrepancy 6), placed at the block's time
        for (const A = R.acq; R.toLogged < A.n; R.toLogged++) {
          const i = R.toLogged; if (!A.disc[i]) continue;
          const e = log(R, 'system', 'Block ' + fmt.int(i + 1) + ' timed out after ' + TR.ACQ.timeoutS + ' s: no waveforms. Sensitivity unchanged.', { x: R.standalone ? R.acq.t[i] / 60 : R.x.vol[i], i });
          e.t = A.t[i]; e.wall = wall(R.simStart + A.t[i]).time;
        }
      }
      if (R.acq.done || tS >= R.timerMin * 60) finishRun(R, 'timer');
    }
    // AKTA export samples available up to the current AKTA time (simulated import)
    const tA = aktaMin(R, tS); R.aktaN = Math.min(R.akta.n, Math.max(0, Math.floor(tA * 60 / R.akta.dt) + 1));
    // log new sensitivity changes
    const ch = R.acq.changes;
    while (R.changesLogged < ch.length) {
      const c = ch[R.changesLogged++], st = TR.LADDERS[R.pmt], to = st[c.to - 1], fr = st[c.from - 1];
      const dir = c.to < c.from ? 'reduced' : 'increased', src = R.setupSnap.autorange === 'prop' ? 'Block median waveform' : 'Last waveform';
      const ofR = R.setupSnap.rangeMap === 'shift' ? ' % of the stated input range' : ' % of the input range';
      let why;
      if (c.guard) why = 'Nothing below the baseline, treated as no signal (Proposed).';
      else if (c.flat) why = 'Nothing below the baseline, so every step scored the same and step 1 was chosen (v2.0).';
      else if (c.noSignal) why = 'No signal above 5 SD of the baseline. ' + src + ' used ' + fmt.pct0(c.use) + ofR + '.';
      else if (c.noneEligible) why = 'No step could hold the pulse below 90 %; returned to step 1.';
      else why = src + ' used ' + fmt.pct0(c.use) + ofR + ' (' + (c.use > TR.ACQ.limit ? 'limit 90 %' : 'target 80 %') + '). Predicted use after change: ' + fmt.pct0(c.pred) + ' %.';
      const e = log(R, 'sensitivity', 'Sensitivity ' + dir + ' from step ' + c.from + ' to step ' + c.to + ' (OD ' + to.nd + ', ' + (to.range * 1000) + ' mV). ' + why, { x: R.standalone ? R.acq.t[c.i] / 60 : R.x.vol[c.i], i: c.i, short: 'Sensitivity ' + dir + ' from step ' + c.from + ' to step ' + c.to + (isFinite(c.use) ? ' at ' + fmt.pct0(c.use) + ' % of the input range' : '') + '.' });
      e.t = c.t; e.wall = wall(R.simStart + c.t).time;
    }
    R.rules.process();
  }
  function finishRun(R, reason) {
    if (R.state === 'complete') return;
    R.state = 'complete'; R.endAt = runTimeS(R); R.endReason = reason;
    // closing save (close_experiment.py line 14), in both save models
    for (const k of ['v20', 'p2s']) { const v = R.save[k]; v.n++; v.mb += R.save.nData * SAVE_KB / 1000; v.last = R.endAt; }
    R.lastSave = R.endAt;
    R.bmEnd = 0.28 * (S.fault === 'laser' ? 0 : 1) * (1 - 0.02 * Math.min(1, Math.max(0, aktaMin(R, R.endAt)) / R.ph.totalMin));
    R.aktaN = R.akta.n;
    log(R, 'system', (reason === 'timer' ? 'Experiment timer ended. ' : 'Acquisition ended by ' + S.setup.operator + '. ') + 'Filter wheel to OD 4; beam monitor block captured (' + R.bmEnd.toFixed(3) + ' V). Record saved.');
    R.rules.process(true);
    for (const h of runHooks) if (h.finish) h.finish(R);
    audit('run', R.id + ' complete: ' + fmt.int(R.acq.n) + ' blocks.');
    emit('run');
  }
  function pauseRun(R) { if (R.state !== 'acquiring') return; R.state = 'paused'; R.pausedAt = runTimeS(R); log(R, 'system', 'Acquisition paused. The AKTA run continues; TRIFLE data will have a gap.'); audit('run', 'Acquisition paused.'); emit('run'); }
  function continueRun(R) { if (R.state !== 'paused') return; R.state = 'acquiring'; const t = runTimeS(R); R.acq.tCursor = Math.max(R.acq.tCursor, t); R.brkNext = true; log(R, 'system', 'Acquisition continued after ' + fmt.min1((t - R.pausedAt) / 60) + ' min.'); audit('run', 'Acquisition continued.'); emit('run'); }
  function fastForward(R, budgetMs) { // run the simulation to the experiment timer in chunks
    const t0 = performance.now(), end = R.simStart + R.timerMin * 60;
    while (S.simT < end && performance.now() - t0 < budgetMs) { S.simT = Math.min(end, S.simT + 20); laserUpdate(); stepRun(R); if (R.state === 'paused') break; }
    return S.simT >= end || R.state !== 'acquiring';
  }

  /* ---------- evidence rules (section 11) ---------- */
  const LEVELS = { I: 'Instrument evidence', P: 'Process observation', H: 'Research hypothesis' };
  // Rule catalogue (discrepancy 1). Rule IDs are permanent: a new rule takes the next free number at its
  // level, and no ID is reused or renumbered. cond(th) gives the condition with the current thresholds.
  // The level is the first letter of the ID (LEVELS). Stage 2 pushes I7, P6, P7 and H3 (45_stage2_model.js).
  const SRC1 = 'Stage 1, section 11';
  const RULES = [
    { id: 'I1', src: SRC1, cond: () => 'Chromatography run started before laser stable (provisional).' },
    { id: 'I2', src: SRC1, cond: th => 'Input range use above 90 % on more than ' + th.i2Count + ' of the last 10 waveforms.' },
    { id: 'I3', src: SRC1, cond: th => 'More than ' + th.i3Count + ' discarded blocks in 1 min.' },
    { id: 'I4', src: SRC1, cond: th => 'Beam monitor below ' + th.i4V + ' V at run start or, with per-block capture, during the run.' },
    { id: 'I5', src: SRC1, cond: th => 'A delay volume or the flow trace is missing, or the UNICORN fraction delay differs from V1 + V2 by more than ' + th.i5Tol + ' mL.' },
    { id: 'I6', src: SRC1, cond: th => 'Laser controller reading or beam monitor changed by more than ' + th.i6Pct + ' % during acquisition.' },
    { id: 'P1', src: SRC1, cond: () => 'UV 280 saturated while fluorescence is in range.' },
    { id: 'P2', src: SRC1, cond: th => 'After the load plateau, fluorescence slope over the last 1 CV above ' + th.p2SlopePct + ' % per CV (Protein A template).' },
    { id: 'P3', src: SRC1, cond: th => 'Buffer-phase baseline differs from the pre-run baseline by more than ' + th.p3Pct + ' %.' },
    { id: 'P4', src: SRC1, cond: th => 'Wash 2 baseline differs from the equilibration baseline by more than ' + th.p4Pct + ' %.' },
    { id: 'P5', src: SRC1, cond: th => 'Beam monitor changed by more than ' + th.p5Pct + ' % from run start (per-block capture only).' },
    { id: 'H1', src: SRC1, cond: () => 'Raised with P2. Possible onset of mAb breakthrough. Confirm with Protein A HPLC on the linked flowthrough fractions.' },
    { id: 'H2', src: SRC1, cond: () => 'Raised with P3 or P4. Possible flow cell fouling or carry-over. Confirm with a buffer blank run.' }
  ];
  function ruleById(id) { return RULES.find(r => r.id === id) || null; }
  // ruleHooks extend the rule engine, fracHooks the fraction table, runHooks the run (init, derive, tick, finish)
  const ruleHooks = [], fracHooks = [], runHooks = [];
  class RuleEngine {
    constructor(R) { this.R = R; this.reset(); }
    reset() {
      this.cards = []; this.i = 0; this.st = {}; this.fired = {}; this.dq = []; this.sx = 0; this.sy = 0; this.sxx = 0; this.sxy = 0; this.plateau = null; this.phaseVals = {}; this.lastPhase = -1; this.disc = []; this.i6 = {}; this.logK = 0; this.i5At = this.i5At || 0; this.i1done = false; this.i1 = null; this.i5card = null; this.ended = {};
      for (const h of ruleHooks) if (h.reset) h.reset(this);
    }
    replay() { const keep = this.i5At; this.reset(); this.i5At = keep; this.process(this.R.state === 'complete'); }
    phaseKey(i) { const L = this.R.ph.list; return L[this.R.acq.phase[i]].key; }
    ph(i) { return this.R.standalone ? 0 : this.R.acq.phase[i]; }
    loc(u) { return this.R.standalone ? fmt.min1(u) + ' min' : fmt.ml(u) + ' mL'; }
    xAt(i) { const A = this.R.acq; return this.R.standalone ? A.t[i] / 60 : A.u[i]; }
    fracsIn(x0, x1) { const R = this.R, d = R.plumbAtStart; return R.fractions.filter(f => { const [a, b] = TR.collectedRange(f, plumbing()); return b > x0 && a < x1; }).map(f => f.id); }
    card(o) {
      const ph = this.R.ph.list[o.phaseIdx], base = o.rule + '-' + (ph ? ph.key : 'run');
      this.fired[base] = (this.fired[base] || 0) + 1; o.id = base + '-' + this.fired[base];
      o.level = o.rule[0]; o.levelName = LEVELS[o.level]; o.phase = this.R.standalone ? 'Run' : (ph ? ph.name : ''); o.mode = procLabel(); o.features = o.features || [];
      const r = S.responses[o.id]; o.status = r ? r.status : 'open'; o.note = r ? r.note : '';
      this.cards.push(o);
      if (!this.R.logged.has(o.id)) { this.R.logged.add(o.id); log(this.R, 'card', o.rule + ' ' + o.levelName.toLowerCase() + ': ' + o.title + '.', { x: o.x0, card: o.id }); }
      emit('cards'); return o;
    }
    // condition tracking: fires once per phase unless the condition clears (false for clearS) and returns
    cond(key, on, i, mk) {
      const st = this.st[key] || (this.st[key] = { on: false, offSince: null, phase: -1, card: null }), A = this.R.acq, ph = this.ph(i);
      if (on) {
        st.offSince = null;
        if (!st.on && (st.phase !== ph || st.cleared)) { st.card = mk(); st.phase = ph; st.cleared = false; }
        st.on = true; return st.card;
      }
      if (st.on) { st.on = false; st.offSince = A.t[i]; }
      if (st.offSince != null && A.t[i] - st.offSince >= S.th.clearS) { st.cleared = true; st.offSince = null; }
      return null;
    }
    process(final) {
      const R = this.R, A = R.acq, n = R.derivedN, th = S.th, tpl = R.tpl, L = R.ph.list;
      // I1: chromatography run started before laser stable (provisional)
      if (!this.i1done && n > 0) {
        this.i1done = true;
        if (!R.laserStableAtStart) this.i1 = this.card({ rule: 'I1', phaseIdx: A.phase[0], title: 'Run started before laser stable', obs: '', x0: this.xAt(0), x1: this.xAt(0), fractions: [], features: [{ name: 'Laser controller log reading', label: 'P' }], action: 'Treat early data with caution; repeat the affected part if it matters for the decision.' });
        if (R.bmStart < th.i4V) this.card({ rule: 'I4', phaseIdx: A.phase[0], title: 'Laser not detected', obs: 'Beam monitor block at run start read ' + R.bmStart.toFixed(3) + ' V (minimum ' + th.i4V + ' V).', x0: A.u[0], x1: A.u[0], fractions: [], action: 'Check the laser controller shows emission and the beam path is clear. Fluorescence recorded now is not valid.' });
      }
      if (this.i1) {
        const L2 = S.laser, now = R.laserTl0 + runTimeS(R) / 60;
        if (L2 && L2.stableAt != null && L2.stableAt <= now) { const tS = (L2.stableAt - R.laserTl0) * 60; let j = TR.lowerBound(A.t, A.n, tS); j = Math.min(Math.max(0, j), A.n - 1); this.i1.obs = 'The run started ' + fmt.min1((L2.stableAt - R.laserTl0)) + ' min before the laser was stable. Data before ' + (R.standalone ? fmt.min1(A.t[j] / 60) + ' min' : fmt.ml(A.u[j]) + ' mL') + ' may include laser warm-up.'; this.i1.x1 = this.xAt(j); this.i1.fractions = R.standalone ? [] : this.fracsIn(-1, A.u[j]); }
        else this.i1.obs = 'Data until the laser is stable may include laser warm-up.';
      }
      // I5: alignment and fraction assignment (setting state; placed at the block where it last changed)
      const al = alignmentState();
      if (al.i5 && !R.standalone && !this.i5card && n > this.i5At) {
        const fr = R.fractions.map(f => f.id);
        this.i5card = this.card({ rule: 'I5', phaseIdx: A.phase[Math.min(this.i5At, n - 1)], title: al.detector === 'Uncertain' ? 'Alignment uncertain' : 'Fraction assignment uncertain', obs: al.issues.join(' '), x0: A.u[Math.min(this.i5At, n - 1)], x1: A.u[Math.min(this.i5At, n - 1)], fractions: fr, action: al.detector === 'Uncertain' ? 'Enter the missing delay volume or import the flow trace.' : 'Set the UNICORN fraction delay to ' + fmt.ml(S.setup.V1 + S.setup.V2) + ' mL for future runs. For this run, treat fraction links near cuts as uncertain.' });
      }
      for (const h of ruleHooks) if (h.pre) h.pre(this, n);
      for (let i = this.i; i < n; i++) {
        const ph = this.ph(i), pk = R.standalone ? 'run' : L[ph].key, disc = A.disc[i], u = R.standalone ? A.t[i] / 60 : A.u[i], y = R.y.act[i];
        // phase change bookkeeping (P3/P4 evaluate at the end of a phase)
        if (this.lastPhase !== -1 && ph !== this.lastPhase && !R.standalone) this.endPhase(this.lastPhase, i);
        this.lastPhase = ph;
        if (!disc && isFinite(y)) (this.phaseVals[ph] || (this.phaseVals[ph] = [])).push(i);
        // I2: input range overrun
        if (!disc) this.cond('I2', A.nOver[i] > th.i2Count, i, () => {
          const d = A.decision[i], st = TR.LADDERS[R.pmt][A.step[i] - 1];
          return this.card({ rule: 'I2', phaseIdx: ph, title: 'Input range overrun', obs: 'Input range use above 90 % on ' + A.nOver[i] + ' of the last 10 waveforms at ' + this.loc(u) + ' (step ' + A.step[i] + ', OD ' + st.nd + ', ' + st.range * 1000 + ' mV). ' + (d && d !== A.step[i] ? 'Sensitivity changed to step ' + d + (isFinite(A.predUse[i]) ? ' (predicted use ' + fmt.pct0(A.predUse[i]) + ' %)' : '') : 'Sensitivity not yet changed') + '.', x0: u, x1: u, fractions: this.fracsIn(u - 0.01, u + 0.01), action: 'Values in clipped waveforms are underestimated. Check the affected fractions before relying on their maximum.' });
        });
        // I3: discarded blocks
        if (disc) this.disc.push(A.t[i]); while (this.disc.length && A.t[i] - this.disc[0] > 60) this.disc.shift();
        this.cond('I3', this.disc.length > th.i3Count, i, () => this.card({ rule: 'I3', phaseIdx: ph, title: 'Discarded blocks', obs: this.disc.length + ' blocks discarded in the last minute at ' + this.loc(u) + ' (limit ' + th.i3Count + ').', x0: u, x1: u, fractions: this.fracsIn(u - 0.5, u + 0.01), action: 'Check the laser and the trigger cable on channel D.' }));
        // I4: beam monitor below minimum (per-block capture)
        if (!disc && isFinite(A.bmV[i])) this.cond('I4', A.bmV[i] < th.i4V, i, () => this.card({ rule: 'I4', phaseIdx: ph, title: 'Laser not detected', obs: 'Beam monitor ' + A.bmV[i].toFixed(3) + ' V at ' + this.loc(u) + ' (minimum ' + th.i4V + ' V).', x0: u, x1: u, fractions: this.fracsIn(u - 0.01, u + 0.01), features: [{ name: 'Beam monitor with every block', label: 'P' }], action: 'Check laser emission. Fluorescence recorded without excitation is not valid.' }));
        // I6: beam monitor change (per-block capture)
        if (!disc && isFinite(A.bm[i])) this.i6beam(i);
        // P1: UV 280 saturated while fluorescence in range
        if (!disc && R.setupSnap.source !== 'manual' && R.setupSnap.source !== 'standalone') {
          const uv = TR.aktaAtVol(R.akta, 'uv', u), on = uv >= 3799.5 && A.ruseMax[i] <= TR.ACQ.limit;
          const c = this.cond('P1', on, i, () => this.card({ rule: 'P1', phaseIdx: ph, title: 'UV 280 saturated, fluorescence in range', obs: '', x0: u, x1: u, fractions: [], maxUse: 0, features: [{ name: 'Imported UNICORN result export', label: 'E' }] }));
          if (c && on) { c.x1 = u; c.maxUse = Math.max(c.maxUse, A.ruseMax[i]); c.fractions = this.fracsIn(c.x0, c.x1); c.obs = 'UV 280 was at its 3,800 mAU ceiling from ' + fmt.ml(c.x0) + ' to ' + fmt.ml(c.x1) + ' mL while fluorescence stayed within the input range (maximum use ' + fmt.pct0(c.maxUse) + ' %).'; }
        }
        // P2 and H1: fluorescence slope after the load plateau (Protein A template only)
        if (tpl.breakthroughRule && pk === 'load' && !disc && isFinite(y)) this.p2(i, u, y, ph);
        // P5: beam monitor changed from run start (per-block capture)
        for (const h of ruleHooks) if (h.block) h.block(this, i, ph, u, y, disc);
        if (!disc && isFinite(A.bm[i])) { const ref = R.bmRef || (R.bmRef = A.bm[i]); const ch = Math.abs(A.bm[i] / ref - 1) * 100; this.cond('P5', ch > th.p5Pct, i, () => this.card({ rule: 'P5', phaseIdx: ph, title: 'Beam monitor changed from run start', obs: 'Beam monitor ' + fmt.pct1(A.bm[i] / ref) + ' % of its run-start value at ' + this.loc(u) + ' (limit ±' + th.p5Pct + ' %).', x0: u, x1: u, fractions: this.fracsIn(u - 0.01, u + 0.01), features: [{ name: 'Beam monitor with every block', label: 'P' }] })); }
      }
      this.i = n;
      if (final && this.lastPhase !== -1 && n && !R.standalone) this.endPhase(this.lastPhase, n);
      for (const h of ruleHooks) if (h.post) h.post(this, final);
      this.i6ctl();
    }
    p2(i, u, y, ph) {
      const R = this.R, th = S.th, cv = R.cv, dq = this.dq;
      dq.push(i); this.sx += u; this.sy += y; this.sxx += u * u; this.sxy += u * y;
      while (dq.length && u - R.acq.u[dq[0]] > cv) { const j = dq.shift(), uj = R.acq.u[j], yj = R.y.act[j]; this.sx -= uj; this.sy -= yj; this.sxx -= uj * uj; this.sxy -= uj * yj; }
      const n = dq.length; if (n < 30 || u - R.acq.u[dq[0]] < cv * 0.98) return;
      const b = (n * this.sxy - this.sx * this.sy) / (n * this.sxx - this.sx * this.sx), m = this.sy / n, slope = b * cv / m * 100;
      if (!this.plateau && Math.abs(slope) < th.p2PlateauPct && u > R.ph.list[ph].v0 + 2 * cv) this.plateau = { u, level: m };
      if (!this.plateau) return;
      const c = this.cond('P2', slope > th.p2SlopePct, i, () => {
        const x0 = R.acq.u[dq[0]], fr = this.fracsIn(x0, u);
        const p = this.card({ rule: 'P2', phaseIdx: ph, title: 'Fluorescence rising after the load plateau', obs: '', x0, x1: u, fractions: fr, maxSlope: slope, plateau: this.plateau.level });
        this.card({ rule: 'H1', phaseIdx: ph, linkedTo: p.id, title: 'Possible onset of mAb breakthrough', obs: 'Total fluorescence cannot separate mAb from HCP; the mAb component of the lifetime analysis can. Check it over the same interval.', x0, x1: u, fractions: fr, features: [{ name: 'Lifetime analysis', label: 'P' }], confirm: 'Protein A HPLC on ' + (fr.length ? rangeIds(fr) : 'the linked flowthrough fractions') + '.' });
        return p;
      });
      if (c) { if (slope > c.maxSlope) c.maxSlope = slope; c.x1 = u; c.fractions = this.fracsIn(c.x0, c.x1); c.obs = 'Fluorescence slope ' + c.maxSlope.toFixed(1) + ' % per CV over the last 1 CV of the load (' + fmt.ml(c.x0) + ' to ' + fmt.ml(c.x1) + ' mL), after a plateau at ' + fmt.sig3(c.plateau) + ' V·ns. Limit ' + th.p2SlopePct + ' % per CV.'; const h = this.cards.find(k => k.linkedTo === c.id); if (h) { h.fractions = c.fractions; h.x1 = c.x1; h.confirm = 'Protein A HPLC on ' + rangeIds(c.fractions) + '.'; } }
    }
    lastCvMedian(ph) {
      const R = this.R, idx = this.phaseVals[ph]; if (!idx || !idx.length) return null;
      const uEnd = R.acq.u[idx[idx.length - 1]], v = []; let u0 = uEnd;
      for (let k = idx.length - 1; k >= 0; k--) { const j = idx[k]; if (uEnd - R.acq.u[j] > R.cv) break; v.push(R.y.act[j]); u0 = R.acq.u[j]; }
      return v.length >= 20 ? { med: TR.medianOf(v), u0, u1: uEnd, n: v.length } : null;
    }
    endPhase(ph, i) {
      const R = this.R, L = R.ph.list, p = L[ph], th = S.th; if (this.ended[ph]) return; this.ended[ph] = true;
      for (const h of ruleHooks) if (h.endPhase) h.endPhase(this, ph, i);
      const tplPh = R.tpl.phases.find(q => q.key === p.key);
      // P3: buffer-phase baseline versus the pre-run baseline (readiness)
      if (tplPh && tplPh.buffer && R.readyAcq) {
        const m = this.lastCvMedian(ph); const ref = TR.medianOf(fluorOf(R.readyAcq, 20, 320));
        if (m && isFinite(ref) && ref > 0) {
          const d = (m.med / ref - 1) * 100;
          if (Math.abs(d) > th.p3Pct) { const c = this.card({ rule: 'P3', phaseIdx: ph, title: p.name + ' baseline differs from pre-run baseline', obs: 'Median of the last 1 CV (' + fmt.ml(m.u0) + ' to ' + fmt.ml(m.u1) + ' mL) is ' + fmt.sig3(m.med) + ' V·ns, ' + Math.abs(d).toFixed(1) + ' % ' + (d > 0 ? 'above' : 'below') + ' the pre-run baseline of ' + fmt.sig3(ref) + ' V·ns (limit ' + th.p3Pct + ' %).', x0: m.u0, x1: m.u1, fractions: this.fracsIn(m.u0, m.u1) }); this.hyp2(c, ph); }
        }
      }
      // P4: Wash 2 versus equilibration
      if (p.key === 'w2') {
        const eq = L.findIndex(q => q.key === 'eq'), a = this.lastCvMedian(ph), b = this.lastCvMedian(eq);
        if (a && b) { const d = (a.med / b.med - 1) * 100; if (Math.abs(d) > th.p4Pct) { const c = this.card({ rule: 'P4', phaseIdx: ph, title: 'Wash 2 baseline differs from equilibration', obs: 'Wash 2 baseline ' + fmt.sig3(a.med) + ' V·ns is ' + Math.abs(d).toFixed(1) + ' % ' + (d > 0 ? 'above' : 'below') + ' the equilibration baseline ' + fmt.sig3(b.med) + ' V·ns (limit ' + th.p4Pct + ' %).', x0: a.u0, x1: a.u1, fractions: [] }); this.hyp2(c, ph); } }
      }
    }
    hyp2(c, ph) { this.card({ rule: 'H2', phaseIdx: ph, linkedTo: c.id, title: 'Possible flow cell fouling or carry-over', obs: '', x0: c.x0, x1: c.x1, fractions: c.fractions, confirm: 'Run a buffer blank and compare its baseline with the pre-run baseline.' }); }
    i6beam(i) {
      const R = this.R, A = R.acq, s = this.i6.bm || (this.i6.bm = { vals: [], on: false, card: null });
      s.vals.push(A.bm[i]); if (s.vals.length > 360) s.vals.shift(); if (s.vals.length < 360 || i % 10) return;
      const m1 = TR.medianOf(s.vals.slice(-60)), m5 = TR.medianOf(s.vals.slice(0, 300)), d = (m1 / m5 - 1) * 100;
      this.i6change('bm', Math.abs(d) > S.th.i6Pct, this.xAt(Math.max(0, i - 60)), this.xAt(i), A.phase[i], { m5, m1 }, [{ name: 'Beam monitor with every block', label: 'P' }]);
    }
    i6ctl() {
      const R = this.R, A = R.acq; if (!A.n) return;
      const k0 = Math.ceil(R.laserTl0 * 60 / TR.LASER.logS), kNow = Math.min(S.laserLog.length - 1, Math.floor((R.laserTl0 * 60 + A.t[A.n - 1]) / TR.LASER.logS));
      for (let k = Math.max(this.logK, k0, 144); k <= kNow; k++) {
        const w = S.laserLog.slice(k - 143, k + 1).map(e => e.pd), m1 = TR.medianOf(w.slice(-24)), m5 = TR.medianOf(w.slice(0, 120)), d = (m1 / m5 - 1) * 100;
        const tS = k * TR.LASER.logS - R.laserTl0 * 60; let j = Math.min(A.n - 1, TR.lowerBound(A.t, A.n, tS)), j0 = Math.min(A.n - 1, TR.lowerBound(A.t, A.n, tS - 60));
        this.i6change('ctl', Math.abs(d) > S.th.i6Pct, this.xAt(j0), this.xAt(j), A.phase[j], { m5, m1 }, [{ name: 'Laser controller log reading', label: 'P' }]);
      }
      this.logK = Math.max(this.logK, kNow + 1);
    }
    i6change(src, on, x0, u, ph, lv, feats) {
      const s = this.i6[src + 'S'] || (this.i6[src + 'S'] = { on: false, card: null });
      if (on && !s.on) { s.ref = lv.m5; s.card = this.card({ rule: 'I6', phaseIdx: ph, title: 'Laser output changed', obs: '', x0, x1: u, fractions: this.fracsIn(x0, u), features: feats, src, eng: [' Beam monitor: captured at start and end only (v2.0).', ' A controller change is not validated as an excitation change.'], action: 'Treat fluorescence in this interval as possibly affected by the laser. A controller change is not validated as an excitation change.' }); }
      if (s.card && (on || s.on)) {
        const c = s.card, R = this.R; if (on) { c.x1 = u; c.to = lv.m1; } c.fractions = this.fracsIn(c.x0, c.x1);
        const d = (c.to / s.ref - 1) * 100;
        const detail = src === 'ctl' ? 'Laser controller reading ' + fmt.sig3(s.ref) + ' to ' + fmt.sig3(c.to) + ' mW as logged (' + sgnF(d, 0) + ' %).' : 'Beam monitor ' + sgnF(d, 1) + ' % (1 min median against the previous 5 min).';
        const other = src === 'ctl' ? (R.setupSnap.beamPerBlock ? ' Beam monitor over the same interval: ' + bmChange(R, c.x0, c.x1) + '.' : ' Beam monitor: captured at start and end only (v2.0).') : '';
        c.obs = 'Laser output changed between ' + (R.standalone ? fmt.min1(c.x0) + ' and ' + fmt.min1(c.x1) + ' min' : fmt.ml(c.x0) + ' and ' + fmt.ml(c.x1) + ' mL') + (on ? ' (ongoing)' : '') + '. ' + detail + other;
      }
      s.on = on;
    }
  }
  function sgnF(d, dp) { return (d > 0 ? '+' : d < 0 ? '−' : '') + Math.abs(d).toFixed(dp); }
  function bmChange(R, x0, x1) { const A = R.acq, xs = R.standalone ? A.t : A.u, k = R.standalone ? 60 : 1; const i0 = Math.max(0, TR.lowerBound(xs, A.n, x0 * k) - 30), i1 = Math.min(A.n - 1, TR.lowerBound(xs, A.n, x1 * k) + 30); const a = A.bm[i0], b = A.bm[i1]; return isFinite(a) && isFinite(b) ? sgnF((b / a - 1) * 100, 1) + ' %' : 'not captured'; }
  function rangeIds(ids) {
    if (!ids.length) return 'none'; if (ids.length <= 3) return ids.join(', ');
    const groups = {}; ids.forEach(id => { const p = id.replace(/\d+$/, ''); (groups[p] || (groups[p] = [])).push(id); });
    return Object.values(groups).map(g => g.length > 2 ? g[0] + ' to ' + g[g.length - 1] : g.join(', ')).join('; ');
  }
  function cardRespond(card, status, note) {
    S.responses[card.id] = { status, note: note || '', t: S.simT }; card.status = status; card.note = note || '';
    audit('card', card.rule + ' card ' + (status === 'accepted' ? 'accepted' : 'dismissed') + (note ? ': ' + note : '') + '.', { card: card.id });
    if (S.run) log(S.run, 'card', card.rule + ' card ' + status + ' by ' + S.setup.operator + (note ? ' (' + note + ')' : '') + '.', { card: card.id });
    emit('cards');
  }

  /* ---------- fractions (section 10, Fraction review) ---------- */
  function fractionStats(R) {
    if (!R) return [];
    const A = R.acq, n = R.derivedN, K = R.akta, al = alignmentState(), p = plumbing(), cards = R.rules.cards, out = [];
    const phaseInt = {};
    for (const f of R.fractions) {
      const [ca, cb] = TR.collectedRange(f, p);
      const i0 = TR.lowerBound(A.u, n, ca), i1 = TR.lowerBound(A.u, n, cb);
      let sum = 0, cnt = 0, mx = -Infinity, chg = 0, over = 0, disc = 0, low = 0, integ = 0, prevU = null, prevY = null;
      for (let i = i0; i < i1; i++) {
        if (A.disc[i]) { disc++; continue; }
        const y = R.y.act[i]; sum += y; cnt++; if (y > mx) mx = y; over += A.nOver[i]; if (R.low[i]) low++;
        if (i > i0 && A.step[i] !== A.step[i - 1]) chg++;
        if (prevU != null) integ += (A.u[i] - prevU) * (y + prevY) / 2; prevU = A.u[i]; prevY = y;
      }
      const imp = R.setupSnap.source === 'import', k0 = imp ? TR.lowerBound(K.v, R.aktaN, ca) : 0, k1 = imp ? TR.lowerBound(K.v, R.aktaN, cb) : 0; let us = 0, uc = 0, umx = -Infinity;
      for (let k = k0; k < k1; k++) { us += K.uv[k]; uc++; if (K.uv[k] > umx) umx = K.uv[k]; }
      const laser = cards.filter(c => c.rule === 'I6' && c.x1 >= ca && c.x0 <= cb).length;
      const linked = cards.filter(c => c.fractions && c.fractions.includes(f.id)).map(c => c.rule);
      const st = { ...f, ca, cb, cvA: f.a / R.cv, cvB: f.b / R.cv, nBlocks: cnt, fMean: cnt ? sum / cnt : NaN, fMax: cnt ? mx : NaN, uvMean: uc ? us / uc : NaN, uvMax: uc ? umx : NaN, uvSat: umx >= 3799.5, chg, over, disc, low, lowShare: cnt ? low / cnt : 0, laser, assign: al.fractions === 'Uncertain' ? 'Uncertain' : 'Aligned', integ, linked: [...new Set(linked)], complete: R.aktaN && K.v[R.aktaN - 1] >= cb && n && A.u[n - 1] >= cb };
      for (const h of fracHooks) h(st, R, i0, i1);
      out.push(st);
    }
    // share of integrated fluorescence within each phase (relative signal area only)
    const L = R.ph.list;
    for (const key of new Set(out.map(f => f.phaseKey))) {
      const ph = L.find(q => q.key === key), i0 = TR.lowerBound(A.u, n, ph.v0), i1 = TR.lowerBound(A.u, n, ph.v1); let tot = 0, pu = null, py = null;
      for (let i = i0; i < i1; i++) { if (A.disc[i]) continue; const y = R.y.act[i]; if (pu != null && A.u[i] > pu) tot += (A.u[i] - pu) * (y + py) / 2; pu = A.u[i]; py = y; }
      for (const f of out) if (f.phaseKey === key) f.share = tot > 0 ? f.integ / tot : NaN;
    }
    return out;
  }
  function uvPool(R) {
    const K = R.akta, el = R.ph.list.find(p => p.key === (R.tpl.fractions.elPhase || 'el')); if (!el) return null;
    let a = null, b = null; const n = R.aktaN;
    for (let k = 1; k < n; k++) {
      if (K.v[k] < el.v0 || K.v[k] > el.v1) continue;
      if (a == null && K.uv[k - 1] < 100 && K.uv[k] >= 100) a = K.v[k - 1] + (100 - K.uv[k - 1]) / (K.uv[k] - K.uv[k - 1]) * (K.v[k] - K.v[k - 1]);
      if (a != null && K.uv[k - 1] >= 100 && K.uv[k] < 100) b = K.v[k - 1] + (K.uv[k - 1] - 100) / (K.uv[k - 1] - K.uv[k]) * (K.v[k] - K.v[k - 1]);
    }
    return a != null ? { a, b, complete: b != null } : null;
  }
  function flBounds(R, pct) {
    const A = R.acq, n = R.derivedN, el = R.ph.list.find(p => p.key === (R.tpl.fractions.elPhase || 'el')); if (!el) return null;
    const i0 = TR.lowerBound(A.u, n, el.v0), i1 = TR.lowerBound(A.u, n, el.v1); let mx = -Infinity, im = -1;
    for (let i = i0; i < i1; i++) { const y = R.y.act[i]; if (R.robust[i] && y > mx) { mx = y; im = i; } }
    if (im < 0) return null; const lvl = mx * pct / 100; let a = null, b = null;
    for (let i = im; i >= i0; i--) if (R.y.act[i] < lvl) { a = A.u[i]; break; }
    for (let i = im; i < i1; i++) if (R.y.act[i] < lvl) { b = A.u[i]; break; }
    return { a, b, max: mx, at: A.u[im], lvl };
  }

  /* ---------- notes and events ---------- */
  function addNote(R, kind, text, at) {
    const A = R.acq, i = Math.max(0, at != null && at >= 0 ? Math.min(at, A.n - 1) : A.n - 1), u = A.n ? A.u[i] : 0;
    const k = R.notes.filter(x => x.kind === kind).length + 1, id = (kind === 'note' ? 'N' : 'E') + k;
    const nt = { id, kind, text, x: u, t: at != null && at >= 0 && A.n ? A.t[i] : runTimeS(R) }; nt.wall = wall(R.simStart + nt.t).time;
    R.notes.push(nt); log(R, kind === 'note' ? 'note' : 'event', (kind === 'note' ? 'Note ' : 'Event ') + id + ' at ' + (R.standalone ? fmt.min1(nt.t / 60) + ' min' : fmt.ml(u) + ' mL') + ': ' + text, { x: R.standalone ? nt.t / 60 : u });
    audit(kind, (kind === 'note' ? 'Note ' : 'Event ') + id + ' added: ' + text); emit('notes'); return nt;
  }

  /* ---------- clock tick ---------- */
  function tick(dtS) {
    S.simT += dtS; laserUpdate(); readinessStep();
    if (S.run) { stepRun(S.run); for (const h of runHooks) if (h.tick) h.tick(S.run); }
  }

  return {
    S, fmt, wall, stamp, pmtSim, emit, on, audit, TH_INFO, presetInfo, presetCheck, procMode, procLabel, comboIdx, template, plumbing, alignmentState,
    laserUpdate, laserText, laserDetail, RD_CHECKS, darkLimit, bufLimits, readinessStart, readinessStep, readinessSummary, bufferMetrics, fluorOf, newRun, log, runTimeS, aktaMin, deriveTo, rederive, stepRun, finishRun, pauseRun, continueRun, fastForward,
    SAVE_KB, saveStep, LEVELS, RULES, ruleById, ruleHooks, fracHooks, runHooks, cardRespond, fractionStats, uvPool, flBounds, addNote, tick, rangeIds
  };
})();
