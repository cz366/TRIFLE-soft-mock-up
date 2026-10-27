/* ---------- Setup: TRIFLE's own settings only ---------- */
(function () {
  const { $, $$, esc, el, tag } = UI, S = M.S, fmt = M.fmt;
  const root = () => $('#scr-setup');
  const AAV_NAME = 'AAVX capture, crude AAV 3.6 mL'; let preAavName = null;
  function locked() { return !!S.run; }
  // readable names for coded values in the audit trail
  const NAMES = { autorange: { v20: 'v2.0 reference', prop: 'Proposed' } };
  function set(path, val, label, unit) {
    const parts = path.split('.'); let o = S.setup; for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
    const k = parts[parts.length - 1], old = o[k]; if (old === val) return; o[k] = val;
    const show = v => typeof v === 'boolean' ? (v ? 'on' : 'off') : (typeof v === 'number' && unit === 'mL' ? fmt.ml(v) : (NAMES[path] && NAMES[path][v]) || String(v));
    M.audit('setting', (label || path) + ' changed from ' + show(old) + ' to ' + show(val) + (unit ? ' ' + unit : '') + '.');
    render(); UI.emitDirty();
  }

  // The AKTA run TRIFLE watches comes from the UNICORN export, not from Setup.
  // In the mock-up a demo control picks which simulated AKTA run is used.
  const AKTA_RUNS = { 'protA|import': 'Protein A platform', 'free|import': 'Free run', 'protA|manual': 'Manual event marks', 'protA|standalone': 'No AKTA data' };
  // AAV is out of scope for GSK downstream for now: offered in the Engineer view only
  if (window.STAGE2) AKTA_RUNS['aav|import'] = 'AAV capture (Engineer view)';
  window.AKTA_RUNS = AKTA_RUNS;
  window.aktaRunKey = () => { const k = S.setup.template + '|' + S.setup.source; return AKTA_RUNS[k] ? k : 'protA|import'; };
  window.setAktaRun = function (v) {
    if (S.run || !AKTA_RUNS[v]) return false;
    const [tplKey, source] = v.split('|'), s = S.setup, t = TR.TEMPLATES[tplKey === 'free' ? 'protA' : tplKey];
    s.flows = null; s.cvMl = t.cv; s.column = t.column; s.frac = { loadSize: t.fractions.loadSize, elSize: t.fractions.elSize, elCollect: t.fractions.elCollect };
    if (tplKey === 'aav') { if (s.template !== 'aav') preAavName = s.runName; s.system = 'pure'; s.sample = 'AAV crude lysate'; s.runName = AAV_NAME; }
    else { s.system = 'avant'; if (s.sample === 'AAV crude lysate') s.sample = 'mAb CUB'; if (s.runName === AAV_NAME && preAavName) s.runName = preAavName; }
    s.template = tplKey; s.source = source; s.flowTrace = true; s.timerMin = null;
    M.audit('demo', 'Simulated AKTA run: ' + AKTA_RUNS[v] + '.');
    render(); UI.emitDirty(); M.emit('setup');
    return true;
  };

  function build() {
    const r = root();
    r.innerHTML = '<div class="scr-h"><h1>Setup</h1><span class="sp"></span><span id="setupLock" class="note"></span><button class="btn primary" id="toReady">Continue to Readiness</button></div>' +
      '<div class="grid2 setup-grid"><div class="stack" id="setupL"></div><div class="stack" id="setupR"></div></div>';
    $('#toReady').onclick = () => UI.go('readiness');
    render();
  }
  function render() {
    const s = S.setup, L = $('#setupL'), Rt = $('#setupR'); if (!L) return;
    const lock = locked(), dis = lock ? ' disabled' : '';
    $('#setupLock').textContent = lock ? 'Locked for this run.' : ''; $('#toReady').classList.toggle('hidden', lock);
    const ph = TR.buildPhases(M.template()), pi = M.presetInfo(s.pmt), pc = M.presetCheck(), lad = TR.LADDERS[s.pmt];
    L.innerHTML =
      '<div class="panel"><div class="ph"><h3>Run details</h3></div><div class="pb form">' +
      '<label class="l" for="sEln">Experiment ID</label><input id="sEln" type="text" value="' + esc(s.eln) + '"' + dis + '>' +
      '<label class="l" for="sRun">Run name</label><input id="sRun" type="text" value="' + esc(s.runName) + '"' + dis + '>' +
      '<label class="l" for="sOp">Operator</label><input id="sOp" type="text" value="' + esc(s.operator) + '" maxlength="4" style="width:90px"' + dis + '>' +
      '</div></div>' +
      '<div class="panel"><div class="ph"><h3>Sign-in</h3></div><div class="pb stack" style="gap:8px">' +
      '<label class="chk" title="I am a trained user of this instrument"><input type="checkbox" id="sTrained"' + (s.trained ? ' checked' : '') + dis + '> Trained user</label>' +
      '<label class="chk" title="IP arrangements are in place for collaborative work"><input type="checkbox" id="sIp"' + (s.ip ? ' checked' : '') + dis + '> IP agreement</label>' +
      '</div></div>';
    // Scientist view: what TRIFLE will watch, read-only. The acquisition settings are in the Engineer view.
    const tplName = s.source === 'standalone' ? 'No AKTA data (TRIFLE only, time axis)' : M.template().name + (s.source === 'manual' ? ', manual event marks' : '');
    Rt.innerHTML =
      '<div class="panel sci-only"><div class="ph"><h3>Method</h3><span class="sp"></span><span class="note">From the UNICORN export</span></div><div class="pb form">' +
      '<label class="l">AKTA method</label><div>' + esc(tplName) + '</div>' +
      (s.source === 'standalone' ? '' : '<label class="l">Column</label><div>' + esc(s.column) + '</div>') +
      '<label class="l">Sample</label><div>' + esc(s.sample) + '</div>' +
      '<label class="l">Run time</label><div>' + (s.timerMin || Math.ceil(ph.totalMin + 2)) + ' min</div>' +
      '<label class="l">Detector</label><div>PMT ' + s.pmt + ' mV <span class="note">set on the PMT supply</span></div>' +
      '</div></div>' +
      '<div class="panel eng-only"><div class="ph"><h3>Acquisition</h3><span class="sp"></span>' + tag('P') + '</div><div class="pb form">' +
      '<label class="l">PMT voltage</label><div class="inl"><div class="seg" id="sPmt">' + [400, 800].map(v => '<button data-v="' + v + '" class="' + (s.pmt === v ? 'on' : '') + '"' + dis + '>' + v + ' mV</button>').join('') + '</div><span class="note">Set on the PMT supply ' + tag('E') + '</span></div>' +
      '<label class="l">Preset</label><div><b>' + pi.id + '</b> <span class="muted small eng-only">checksum ' + pi.checksum + '</span></div>' +
      '<label class="l eng-only">Loads</label><div class="small eng-only">IRF ' + esc('impulse_' + s.irfFile + '_mV.txt') + '<br>Ladder ' + esc('od_filters_and_ranges_' + s.ladderFile + '_mV.txt') + ', ' + lad.length + ' steps</div>' +
      (pc.ok ? '' : '<div class="full callout fault">' + esc(pc.msg) + '</div>') +
      '<label class="l">Auto-ranging</label><div class="inl" style="gap:14px">' +
      '<label class="chk"><input type="radio" name="ar" value="v20"' + (s.autorange === 'v20' ? ' checked' : '') + dis + '> v2.0 ' + tag('E') + '</label>' +
      '<label class="chk" title="Block median input, corrected no-signal test, baseline not scaled"><input type="radio" name="ar" value="prop"' + (s.autorange === 'prop' ? ' checked' : '') + dis + '> Proposed</label></div>' +
      '<label class="l" style="align-self:start;padding-top:2px">Options</label><div class="stack" style="gap:6px">' +
      '<label class="chk"><input type="checkbox" id="sBm"' + (s.beamPerBlock ? ' checked' : '') + dis + '> Beam monitor every block ' + tag('P', s.beamPerBlock ? 'always' : 'engineer') + '</label>' +
      '<label class="chk"><input type="checkbox" id="sSave"' + (s.save2s ? ' checked' : '') + dis + '> Save every 2 s ' + tag('P') + '</label>' +
      '<label class="chk"><input type="checkbox" id="sEmit"' + (s.laserCheck ? ' checked' : '') + dis + '> Laser emission check ' + tag('P') + '</label>' +
      '<label class="chk"><input type="checkbox" id="sCsv"' + (s.csvJson ? ' checked' : '') + dis + '> CSV and JSON export ' + tag('P') + '</label></div>' +
      '<label class="l" for="sTimer">Run time (min)</label><div class="inl"><input id="sTimer" type="number" step="1" min="1" value="' + (s.timerMin || Math.ceil(ph.totalMin + 2)) + '" style="width:100px"' + dis + '>' + (s.source === 'standalone' ? '' : '<span class="note">AKTA method ' + fmt.min1(ph.totalMin) + ' min</span>') + '</div>' +
      '</div></div>';
    wire();
  }
  function num(id) { const v = parseFloat($(id).value); return isFinite(v) ? v : NaN; }
  function wire() {
    $('#sEln').onchange = e => set('eln', e.target.value.trim(), 'Experiment ID');
    $('#sRun').onchange = e => set('runName', e.target.value.trim(), 'Run name');
    $('#sOp').onchange = e => set('operator', e.target.value.trim().toUpperCase() || 'DS', 'Operator');
    $$('#sPmt button').forEach(b => b.onclick = () => { const v = +b.dataset.v; S.setup.irfFile = v; S.setup.ladderFile = v; set('pmt', v, 'PMT preset', 'mV'); });
    $$('input[name=ar]').forEach(r => r.onchange = () => set('autorange', r.value, 'Auto-ranging'));
    $('#sBm').onchange = e => { set('beamPerBlock', e.target.checked, 'Beam monitor every block'); if (!e.target.checked && S.proc.laser) UI.setProc('laser', false); };
    $('#sSave').onchange = e => set('save2s', e.target.checked, 'Save every 2 s');
    $('#sEmit').onchange = e => set('laserCheck', e.target.checked, 'Laser emission check');
    $('#sCsv').onchange = e => set('csvJson', e.target.checked, 'CSV and JSON export');
    $('#sTimer').onchange = () => { const v = num('#sTimer'); if (v > 0) set('timerMin', v, 'Run time', 'min'); };
    const signIn = (k, what) => e => { S.setup[k] = e.target.checked; M.audit('setting', 'Sign-in: ' + what + (e.target.checked ? ' confirmed.' : ' withdrawn.')); render(); UI.emitDirty(); };
    $('#sTrained').onchange = signIn('trained', 'trained user');
    $('#sIp').onchange = signIn('ip', 'IP agreement');
  }
  UI.register('setup', { show() { if (!$('#setupL')) build(); else render(); }, build, render });
  M.on(ev => { if ((ev === 'run' || ev === 'setup') && UI.cur() === 'setup') render(); });
})();
