/* ---------- Readiness (Validate) ---------- */
(function () {
  const { $, $$, esc, el, tag } = UI, S = M.S, fmt = M.fmt, C = CH.C;
  let laserChart = null, pulseChart = null, built = false, lastKey = '', pulseLog = false;
  const bm = { x: new Float64Array(2000), y: new Float64Array(2000), n: 0, lastK: -1 };
  const lz = { x: new Float64Array(20000), y: new Float64Array(20000), n: 0 };
  const pulse = { x: new Float64Array(600), y: new Float64Array(600), n: 0, ix: new Float64Array(600), iy: new Float64Array(600), gen: 0 };
  for (let j = 0; j < 600; j++) { pulse.x[j] = j * 0.2; pulse.ix[j] = j * 0.2; }
  function build() {
    const r = $('#scr-readiness');
    r.innerHTML = '<div class="scr-h"><h1>Readiness</h1><span class="sp"></span><button class="btn" id="rdRun">Run checks</button><button class="btn primary" id="rdGo">Go to Run</button></div>' +
      '<div class="ready-banner" id="rdBanner"></div>' +
      '<div class="panel" style="margin-top:12px"><div class="ph"><h3>Instrument checks</h3></div><div class="pb" style="padding:0"><div class="tbl-wrap"><table class="tbl" id="rdTbl"><thead><tr><th style="width:22%">Check</th><th>Status</th><th class="eng-only">Measured</th><th class="eng-only" style="width:30%">Limit</th><th class="eng-only">Label</th></tr></thead><tbody></tbody></table></div></div></div>' +
      '<div class="grid2 rd-lower" style="margin-top:12px"><div class="stack eng-only">' +
      
      '<div class="panel"><div class="ph"><h3>Live pulse preview</h3><span class="sp"></span><div class="seg sm" id="rdPLog"><button data-v="0" class="on">Linear</button><button data-v="1">Log</button></div></div><div class="pb"><div style="height:220px" id="rdPulse"></div></div></div>' +
      '</div><div class="stack"><div class="panel"><div class="ph"><h3>Laser</h3><span class="sp"></span>' + tag('P') + '</div><div class="pb"><div id="lzState" class="small" style="min-height:22px"></div><div class="eng-only" style="margin-top:6px"><div style="height:270px" id="lzChart"></div><div class="note" style="margin-top:4px">A stable controller reading does not confirm stable UV output.</div></div></div></div>' +
      '</div></div>';
    $('#rdRun').onclick = () => { M.readinessStart(); UI.emitDirty(); };
    $('#rdGo').onclick = () => UI.go('run');
    $$('#rdPLog button').forEach(b => b.onclick = () => { pulseLog = b.dataset.v === '1'; $$('#rdPLog button').forEach(x => x.classList.toggle('on', x === b)); pulseChart.invalidate(); });
    laserChart = new CH.Chart($('#lzChart'), {
      ariaLabel: 'Laser warm-up chart', topBand: 6, marginRight: 12, liveReadout: true,
      xDomain: () => [0, Math.max(30, Math.ceil((S.simT / 60 + 2) / 5) * 5)], xTitle: () => 'Time since laser emission started (min)',
      panels: [{ key: 'main', yl: { title: 'Controller reading', unit: 'mW', fixed: [0, 50] } }, { key: 'bm', px: 56, yl: { title: 'Beam monitor', short: 'Beam mon.', unit: 'V', fixed: () => S.fault === 'laser' ? [0, 0.30] : [0.26, 0.30] } }],
      series: [
        { key: 'ctl', label: 'Laser controller reading', color: C.beam, dash: 'dot', width: 1.2, panel: 'main', src: () => lz, fmt: v => fmt.sig3(v) + ' mW' },
        { key: 'bm', label: 'Beam monitor', color: C.beam, width: 1, panel: 'bm', src: () => bm, fmt: v => v.toFixed(3) + ' V' }
      ],
      vlines: () => { const L = S.laser, out = []; if (L && L.stepAt != null) out.push({ x: L.stepAt, label: 'Step-down observed', color: C.text2, dash: 'dash', align: 'right' }); if (L && L.stableAt != null) out.push({ x: L.stableAt, label: 'Stable (provisional)', color: C.ok, dash: 'dash', row: 1 }); return out; },
      info: x => x == null ? '' : 'Emission time ' + fmt.min1(x) + ' min'
    });
    pulseChart = new CH.Chart($('#rdPulse'), {
      ariaLabel: 'Live pulse preview', topBand: 14, marginRight: 12, liveReadout: false,
      xDomain: () => [0, 119.8], xTitle: () => 'Time from window start (ns)',
      panels: [{ key: 'main', yl: { title: 'Signal', unit: 'mV', log: () => pulseLog, zero: false, minLog: -2, minSpan: 0.5 } }],
      bands: () => [{ x0: 0, x1: 20, label: 'Baseline', fill: '#E8ECEF' }],
      series: [
        { key: 'wf', label: 'Latest pulse', color: C.v20, width: 1.25, panel: 'main', src: () => ({ x: pulse.x, y: pulseLog ? pulse.ly : pulse.y, n: pulse.n, gen: pulse.gen + (pulseLog ? 0.5 : 0) }), fmt: v => v.toFixed(2) + ' mV' },
        { key: 'irf', label: 'IRF', color: C.irf, dash: 'dash', width: 1, panel: 'main', src: () => ({ x: pulse.ix, y: pulseLog ? pulse.liy : pulse.iy, n: pulse.n ? 600 : 0, gen: pulse.gen + (pulseLog ? 0.5 : 0) }), fmt: v => v.toFixed(2) + ' mV' }
      ]
    });
    built = true;
  }
  function updLaser() {
    const log = S.laserLog;
    if (lz.gen !== (S.laserGen || 0)) { lz.gen = S.laserGen || 0; lz.n = 0; bm.n = 0; bm.lastK = -1; if (laserChart) laserChart.invalidate(); }
    for (let k = lz.n; k < log.length && k < lz.x.length; k++) { lz.x[k] = log[k].tl; lz.y[k] = log[k].pd; lz.n = k + 1; }
    // beam monitor captured every 10 s during warm-up (simulated readiness captures)
    const kMax = Math.floor(S.simT / 10);
    for (let k = bm.lastK + 1; k <= kMax && bm.n < bm.x.length; k++) { const tl = k * 10 / 60, r = TR.mulberry32(TR.hash(TR.SEED, 0xBEA, k, 0)); bm.x[bm.n] = tl; bm.y[bm.n] = S.fault === 'laser' ? 0 : 0.28 * TR.laserExcitation(tl) * (1 + 0.003 * TR.gauss(r)); bm.n++; bm.lastK = k; }
  }
  function updPulse() {
    const R = S.readiness, A = R && R.acq; if (!A || !A.n) return;
    let i = A.n - 1; while (i > 0 && A.disc[i]) i--;
    if (pulse.blk === i) return; pulse.blk = i;
    const w = TR.regenBlock(A, i); if (!w.length) return; const v = w[9];
    const b = TR.median(v, 0, 100); let mn = Infinity; for (let j = 0; j < 600; j++) { pulse.y[j] = v[j] * 1000; if (v[j] < mn) mn = v[j]; }
    const h = TR.shapeTable(S.setup.pmt).h; let hm = 0; for (let j = 0; j < 600; j++) if (h[j] < hm) hm = h[j];
    pulse.ly = pulse.ly || new Float64Array(600); pulse.liy = pulse.liy || new Float64Array(600);
    for (let j = 0; j < 600; j++) { pulse.iy[j] = (h[j] / hm) * (mn - b) * 1000 + b * 1000; pulse.ly[j] = -(v[j] - b) * 1000; pulse.liy[j] = (h[j] / hm) * -(mn - b) * 1000; }
    pulse.n = 600; pulse.gen++;
    const nSteps = TR.LADDERS[S.setup.pmt].length;
    pulseChart.cfg.info = () => 'Block ' + (i + 1) + '; step ' + A.step[i] + ' of ' + nSteps + '; input range use ' + fmt.pct0(A.ruse[i]) + ' %';
    pulseChart.invalidate();
  }
  const STATUS = { pending: ['na', 'Pending'], running: ['na', 'Running'], pass: ['ok', 'Pass'], fail: ['fault', 'Fail'], manual: ['warn', 'Confirm'], disabled: ['na', 'Off'], blocked: ['na', 'Blocked'] };
  function renderTable() {
    const R = S.readiness, tb = $('#rdTbl tbody');
    const key = JSON.stringify([R && R.checks, S.setup.laserCheck, S.engineer, !!S.run]); if (key === lastKey) return; lastKey = key;
    tb.innerHTML = M.RD_CHECKS.map(c => {
      const st = R ? R.checks[c.key] : { status: 'pending', value: '' }; const [k, t] = STATUS[st.status];
      // the status cell carries what the scientist acts on: the PMT confirmation and, on a failure, the fix
      let val = esc(st.value || ''), stc = UI.stateHtml(k, t);
      if (c.key === 'pmt' && R && st.status === 'manual') stc = '<label class="chk"><input type="checkbox" id="pmtChk"> ' + esc(st.value) + '</label>';
      if (c.key === 'emit' && !S.setup.laserCheck && st.status !== 'blocked') val = S.run ? 'Not checked' : 'Not checked <button class="link small" id="enEmit">Turn on</button>';
      if (st.status === 'fail') stc += '<div class="small rd-fix">' + esc(c.ifFail) + '</div>';
      const engRow = c.key === 'emit' && st.status === 'disabled';
      return '<tr' + (engRow ? ' class="eng-only"' : '') + '><td class="wrap" title="' + esc(c.meaning) + '"><b>' + esc(c.name) + '</b></td><td class="wrap">' + stc + '</td><td class="wrap eng-only">' + val + '</td><td class="wrap eng-only">' + esc(c.limit) + '</td><td class="eng-only">' + tag(c.label, 'engineer') + '</td></tr>';
    }).join('');
    const pc = $('#pmtChk'); if (pc) pc.onchange = () => { if (pc.checked) { S._pmtConfirmed = true; if (S.readiness) S.readiness.pmtConfirmed = true; M.audit('readiness', 'PMT voltage ' + S.setup.pmt + ' mV confirmed on the supply.'); lastKey = ''; } };
    const ee = $('#enEmit'); if (ee) ee.onclick = () => { S.setup.laserCheck = true; M.audit('setting', 'Laser emission check enabled (Proposed).'); lastKey = ''; };
  }
  function renderBanner() {
    const sm = M.readinessSummary(), b = $('#rdBanner'), R = S.readiness;
    const noLaser = sm.state === 'laser' && S.laser && S.laser.state === 'notdetected';
    const kind = { ready: 'ok', fault: 'fault', blocked: 'fault', laser: noLaser ? 'fault' : 'warn', signin: 'warn', checking: 'na', notrun: 'na' }[sm.state];
    const big = { ready: 'Ready to start', fault: 'Not ready', blocked: 'Run blocked', laser: noLaser ? 'Laser not detected' : 'Laser warming up', signin: 'Sign-in needed', checking: 'Checking', notrun: 'Not checked' }[sm.state];
    const failed = sm.text.replace(/^Not ready: /, '');
    const detail = { fault: failed.charAt(0).toUpperCase() + failed.slice(1), blocked: sm.text.replace(/ The run is blocked\.$/, ''), laser: noLaser ? 'Check the laser controller, shutter and beam path.' : 'Instrument checks passed.', signin: 'Instrument checks passed. Tick Trained user and IP agreement on Setup.', checking: R && R.checks.pmt.status === 'manual' ? 'Confirm the PMT voltage in the checks table.' : '' }[sm.state] || '';
    const html = S.run ? '<span class="big">' + UI.stateHtml('na', S.run.state === 'complete' ? 'Run complete' : 'Run in progress') + '</span><span class="small">Checks as recorded before Start.</span>' : '<span class="big">' + UI.stateHtml(kind, big) + '</span>' + (detail ? '<span class="small">' + esc(detail) + '</span>' : '') + '<span class="sp" style="flex:1"></span>' +
      (R && R.override && sm.state === 'laser' ? '<span class="small muted">Override recorded: ' + esc(R.override.reason) + '</span>' : (sm.canOverride ? '<button class="btn" id="rdOverride">Start before laser stable…</button>' : ''));
    if (b.innerHTML !== html) { b.innerHTML = html; const o = $('#rdOverride'); if (o) o.onclick = () => override(); }
    $('#rdRun').textContent = R && R.started ? 'Run checks again' : 'Run checks';
    $('#rdRun').disabled = !!S.run;
  }
  function override(reason) {
    const rec = r => { S.readiness.override = { reason: r, by: S.setup.operator, t: S.simT }; M.audit('override', 'Readiness override recorded: ' + r); UI.emitDirty(); };
    if (reason) { rec(reason); return true; }
    const c = el('<form style="width:340px"><div style="font-weight:bold;margin-bottom:4px">Override readiness</div><div class="small" style="margin-bottom:6px">The laser is still warming up. Starting now raises rule I1 and flags the early data. Record the reason.</div><textarea id="ovReason" rows="3" style="width:100%" placeholder="Reason"></textarea><div style="display:flex;justify-content:flex-end;margin-top:6px"><button class="btn primary" type="submit">Record override</button></div></form>');
    c.onsubmit = e => { e.preventDefault(); const t = $('#ovReason', c).value.trim(); if (t.length < 3) return; rec(t); UI.closePopover(); };
    UI.popover($('#rdOverride'), c); setTimeout(() => $('#ovReason', c).focus(), 0); return false;
  }
  function update() {
    if (!built) build();
    updLaser(); renderTable(); renderBanner(); updPulse();
    const L = S.laser; $('#lzState').innerHTML = (L ? UI.stateHtml(L.state === 'stable' ? 'ok' : L.state === 'notdetected' ? 'fault' : 'warn', L.state === 'stable' ? 'Laser stable (provisional)' : L.state === 'notdetected' ? 'Laser not detected' : 'Warming up') + ' ' + esc(M.laserDetail(L)) + ' ' : '') + '<span class="muted">Emission time ' + fmt.min1(S.simT / 60) + ' min.</span>';
    laserChart.requestDraw(); if (Math.floor(S.simT / 60) !== laserChart._lastMin) { laserChart._lastMin = Math.floor(S.simT / 60); laserChart.invalidate(); }
  }
  UI.register('readiness', { show() { if (!built) build(); lastKey = ''; laserChart.invalidate(); pulseChart.invalidate(); if (!S.readiness && !S.run) { M.readinessStart(); } }, update, override, build: () => { if (!built) build(); } });
  // keep the laser data current even when the screen is hidden
  M.on(ev => { if (ev === 'tick' && built) updLaser(); });
})();
