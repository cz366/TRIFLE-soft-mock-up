/* =====================================================================
   UI core: helpers, frame, header, navigation, status line, modal.
   ===================================================================== */
const UI = (function () {
  const S = M.S, fmt = M.fmt;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
  const TAGS = { E: 'Existing', P: 'Proposed', F: 'Future', A: 'Assumed', S: 'simulated', H: 'To verify on hardware', D: 'Development assumption' };
  // Display rule (section 0): engineer-scope tags only in the Engineer view; 'always' tags where a Proposed
  // setting affects displayed data or a card, and on Future controls.
  function tag(k, scope) { return '<span class="tag' + (k === 'F' ? ' fut' : '') + '" data-scope="' + (scope || 'engineer') + '">' + TAGS[k] + '</span>'; }
  // Input range overruns (I2) and discarded blocks (I3) are instrument housekeeping: Engineer view only
  function cardShown(rule) { return M.S.engineer || (rule !== 'I2' && rule !== 'I3'); }
  function sgn(d, dp) { return (d > 0 ? '+' : d < 0 ? '−' : '') + Math.abs(d).toFixed(dp == null ? 1 : dp); }
  function stateHtml(kind, text) { return '<span class="state ' + kind + '"><span class="dot ' + kind + '"></span>' + esc(text) + '</span>'; }

  /* ---------- screens and navigation ---------- */
  const screens = {};
  let current = null;
  function register(key, obj) { screens[key] = obj; }
  function go(key, opts) {
    if (!screens[key]) return;
    if (current && screens[current].hide) screens[current].hide();
    $$('.screen').forEach(s => s.classList.remove('active'));
    $('#scr-' + key).classList.add('active');
    current = key; document.getElementById('work').classList.remove('expanded');
    if (screens[key].show) screens[key].show(opts || {});
    navKey = ''; markNav(); renderChips(); emitDirty();
  }
  // One lit rail item. Fraction review and Samples to send share a screen; its side tab decides which is lit.
  let navKey = '';
  function markNav() {
    if (current === navKey) return; navKey = current;
    $$('#rail .nav').forEach(n => n.classList.toggle('active', n.dataset.go === current));
  }
  function cur() { return current; }
  function screen(k) { return screens[k]; }

  /* ---------- dirty flags and frame loop ---------- */
  const dirty = { all: true };
  function emitDirty(k) { dirty[k || 'all'] = true; }
  function frame() {
    try {
      renderHeader(); renderStatus(); markNav();
      const ak = document.getElementById('demoAkta'); if (ak) ak.disabled = !!S.run;
      if (current && screens[current].update) screens[current].update(dirty);
      if (current) sortAll(document.getElementById('scr-' + current));
      for (const k in dirty) delete dirty[k];
    } catch (e) { console.error(e); }
    requestAnimationFrame(frame);
  }

  /* ---------- header ---------- */
  let hdrCache = '';
  function indicators() {
    const L = S.laser, f = S.fault, s = S.setup, R = S.run;
    const out = [];
    let ls = ['off', 'Off'];
    if (f === 'laser' || (L && L.state === 'notdetected')) ls = ['fault', 'Not detected']; else if (L && L.state === 'stable') ls = ['ok', 'Stable']; else if (L && L.state === 'warming') ls = ['warn', 'Warming up'];
    out.push(['Laser', ls]);
    const bm = f === 'laser' ? ['fault', 'Below 0.005 V'] : (s.beamPerBlock ? ['ok', 'Every block'] : ['ok', 'Start and end']);
    out.push(['Beam monitor', bm]);
    const wheelOd = R && R.acq.n && R.state !== 'complete' ? TR.LADDERS[R.pmt][R.acq.cur - 1].nd : 4;
    out.push(['Filter wheel', f === 'wheel' ? ['fault', 'Not responding'] : ['ok', 'OD ' + wheelOd + ', position ' + TR.WHEEL_POS[String(wheelOd)]]]);
    out.push(['Digitiser', f === 'digitiser' ? ['fault', 'Not found'] : ['ok', 'Connected']]);
    return out;
  }
  function renderHeader() {
    const R = S.run, ind = indicators();
    const st = !R ? (M.readinessSummary().ready ? 'Ready' : 'Idle') : ({ acquiring: 'Acquiring', paused: 'Paused', complete: 'Complete' }[R.state]);
    const el2 = R ? fmt.clock(R.state === 'complete' ? R.endAt : M.runTimeS(R)) : '00:00:00';
    const key = JSON.stringify([ind, st, el2, S.engineer, S.setup.operator, window.innerWidth < 1240]);
    if (key === hdrCache) return; hdrCache = key;
    const compact = window.innerWidth < 1240, SHORT = { 'Beam monitor': 'Beam mon.', 'Filter wheel': 'Wheel', Chromatography: 'AKTA', 'Start and end': 'Start/end', 'UNICORN import': 'Import' };
    // Scientist view: one instrument status; Engineer view: every connection
    const bad = ind.find(([, [k]]) => k === 'fault'), warm = ind.find(([lab, [k]]) => lab === 'Laser' && k === 'warn'), off = ind.find(([lab, [k]]) => lab === 'Laser' && k === 'off');
    const agg = bad ? ['fault', bad[0] + ' ' + bad[1][1].toLowerCase()] : warm ? ['warn', 'Laser warming up'] : off ? ['off', 'Laser off'] : ['ok', R ? 'Instrument OK' : 'Instrument ready'];
    $('#hConn').innerHTML = '<span class="ind sci-only" title="' + esc(ind.map(([lab, [, t]]) => lab + ': ' + t).join('; ')) + '"><span class="dot ' + agg[0] + '"></span>' + esc(agg[1]) + '</span>' +
      ind.map(([lab, [k, t]]) => '<span class="ind eng-only" title="' + esc(lab + ': ' + t) + '"><span class="dot ' + k + '"></span><span class="lab">' + esc(compact && SHORT[lab] ? SHORT[lab] : lab) + '</span> ' + esc(compact ? (SHORT[t] || t.replace(/, position \d/, '')) : t) + '</span>').join('');
    $('#hState').innerHTML = '<span class="muted">Run</span> <span class="h-state">' + st + '</span>';
    $('#hElapsed').innerHTML = '<span class="muted" title="Elapsed acquisition time">Elapsed</span> ' + el2;
    $('#hUser').textContent = S.setup.operator;
  }

  /* ---------- status line ---------- */
  let stCache = '';
  function latestWarning() {
    const R = S.run; if (S.fault !== 'none') return { digitiser: 'Digitiser not found.', wheel: 'Filter wheel not responding.', laser: 'Laser not detected.' }[S.fault];
    const pc = M.presetCheck(); if (!pc.ok) return pc.msg;
    if (!R) { const al = M.alignmentState(); return al.i5 ? al.issues[0] : ''; }
    // range overruns and discarded blocks (I2, I3) are handled by the instrument: Engineer view only
    const open = R.rules.cards.filter(c => c.status === 'open' && (c.level === 'I' || c.level === 'P') && cardShown(c.rule));
    if (!open.length) return '';
    const c = open[open.length - 1]; return c.rule + ' ' + c.title;
  }
  function renderStatus() {
    const R = S.run, al = M.alignmentState();
    const step = R && R.acq.n && R.state !== 'complete' ? R.acq.cur : null, nst = TR.LADDERS[S.setup.pmt].length;
    const save = R && R.lastSave != null ? M.wall(R.simStart + R.lastSave).time + (R.save && R.save.mode === 'p2s' ? ' (every 2 s)' : '') : '–';
    const w = latestWarning();
    const key = [M.procLabel(), al.detector, al.fractions, step, save, w, S.engineer].join('|');
    if (key === stCache) return; stCache = key;
    // processing, alignment and sensitivity are Engineer view detail; an alignment problem reaches the scientist as a warning
    $('#status').innerHTML = '<span class="eng-only">Processing: <b>' + esc(M.procLabel()) + '</b></span>' +
      (al.detector === 'n/a' ? '' : '<span class="eng-only">Alignment: <b>' + esc(al.detector) + '</b>' + (al.fractions === 'Uncertain' && al.detector !== 'Uncertain' ? '; fractions <b>uncertain</b>' : '') + '</span>') +
      (step ? '<span class="eng-only">Sensitivity: <b>step ' + step + ' of ' + nst + '</b></span>' : '') +
      (R ? '<span>Last save: <b>' + esc(save) + '</b></span>' : '') +
      (w ? '<span class="st-warn" title="' + esc(w) + '">Warning: ' + esc(w) + '</span>' : '<span class="muted">No open warnings</span>');
  }

  /* ---------- acquisition chips (read-only, 14.3) ---------- */
  function renderChips() {
    const R = S.run, s = S.setup, lad = TR.LADDERS[s.pmt], step = R && R.acq.n ? R.acq.cur : 1, st = lad[step - 1];
    const rangeMap = R ? R.setupSnap.rangeMap : s.rangeMap; // discrepancy 2 what-if, fixed for the run
    const html = '<span>PMT ' + s.pmt + ' mV</span><span>10 Hz</span><span>Auto-range ' + (s.autorange === 'v20' ? 'v2.0' : 'Proposed') + '</span>' +
      (rangeMap === 'shift' ? '<span>Ranges one setting larger (what-if)</span>' : '');
    $$('.acq-chips').forEach(e => { if (e.innerHTML !== html) e.innerHTML = html; });
  }

  /* ---------- modal (blocking faults and End only) and popover ---------- */
  function modal(title, bodyHtml, buttons) {
    return new Promise(res => {
      const root = $('#modal-root');
      const bd = el('<div class="backdrop"><div class="modal" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><div class="mh">' + esc(title) + '</div><div class="mb">' + bodyHtml + '</div><div class="mf"></div></div></div>');
      const mf = $('.mf', bd);
      buttons.forEach(b => { const btn = el('<button class="btn' + (b.primary ? ' primary' : '') + '">' + esc(b.label) + '</button>'); btn.onclick = () => { const v = b.value; if (b.validate && !b.validate(bd)) return; root.innerHTML = ''; res({ value: v, el: bd }); }; mf.append(btn); });
      root.innerHTML = ''; root.append(bd);
      const first = $('input,textarea,select', bd) || $('.btn.primary', bd) || $('.btn', bd); if (first) first.focus();
      bd.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); root.innerHTML = ''; res({ value: null, el: bd }); } });
      // keep values readable after close
      res.el = bd;
    });
  }
  let pop = null;
  function popover(anchor, contentEl, onClose) {
    closePopover(); const r = anchor.getBoundingClientRect(); pop = el('<div class="popover"></div>'); pop.append(contentEl); document.body.append(pop);
    const w = pop.offsetWidth, h = pop.offsetHeight; pop.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left)) + 'px';
    pop.style.top = (r.bottom + 4 + h > window.innerHeight - 8 ? Math.max(8, r.top - h - 4) : r.bottom + 4) + 'px';
    pop._onClose = onClose; const me = pop, onKey = e => { if (e.key === 'Escape' && pop === me) { closePopover(); const a = anchor.isConnected ? anchor : anchor.id ? document.getElementById(anchor.id) : anchor.dataset && anchor.dataset.id ? document.querySelector('.decb[data-id="' + anchor.dataset.id + '"]') : null; if (a && a.focus) a.focus(); } }; document.addEventListener('keydown', onKey); pop._off = () => document.removeEventListener('keydown', onKey);
    setTimeout(() => document.addEventListener('mousedown', outside), 0);
    function outside(e) { if (pop && !pop.contains(e.target) && e.target !== anchor) { closePopover(); document.removeEventListener('mousedown', outside); } }
  }
  function closePopover() { if (pop) { if (pop._onClose) pop._onClose(); pop._off(); pop.remove(); pop = null; } }

  /* ---------- downloads (Blob, no network) ---------- */
  function download(name, text, type) {
    const blob = text instanceof Blob ? text : new Blob([text], { type: type || 'text/plain' }); const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function downloadDataUrl(name, url) { const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); }
  function copyText(text, btn) {
    const done = () => { if (btn) { const t = btn.textContent; btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = t; }, 1200); } };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => fallback());
    else fallback();
    function fallback() { const ta = document.createElement('textarea'); ta.value = text; document.body.append(ta); ta.select(); try { document.execCommand('copy'); } catch (e) { } ta.remove(); done(); }
  }

  /* ---------- processing popover (shared by Run and Fraction review) ---------- */
  function processingButton(host) {
    const b = el('<button class="btn sm">Processing: <b class="pl"></b> ▾</button>');
    const upd = () => { $('.pl', b).textContent = M.procMode() === 'v20' ? 'v2.0 reference' : 'Proposed'; };
    b.onclick = () => {
      const p = S.proc, canLaser = S.run ? S.run.setupSnap.beamPerBlock : S.setup.beamPerBlock;
      // One Proposed tag for the three processing options (shown in the Scientist view when any is on)
      const PROP = ['median', 'window', 'laser'], anyOn = () => PROP.some(k => S.proc[k]);
      const c = el('<div style="width:300px"><div class="small muted" style="margin-bottom:6px">All off is the v2.0 reference. You can change these after acquisition.</div>' +
        '<div class="proc-grp"><div class="proc-gh">' + tag('P', anyOn() ? 'always' : 'engineer') + '</div>' +
        '<label class="chk"><input type="checkbox" data-k="median"> Median baseline</label>' +
        '<label class="chk"><input type="checkbox" data-k="window"> Integration window 30 to 70 ns</label>' +
        '<label class="chk"><input type="checkbox" data-k="laser"' + (canLaser ? '' : ' disabled') + '> Laser correction by beam monitor</label>' + (canLaser ? '' : '<div class="small muted" style="margin-left:22px">Needs the beam monitor captured with every block (Setup).</div>') + '</div>' +
        '<label class="chk proc-cmp"><input type="checkbox" data-k="compare"> Compare with v2.0 reference</label>' + procExtras.map(x => x.html()).join('') + '</div>');
      $$('input', c).forEach(i => {
        i.checked = !!p[i.dataset.k];
        i.onchange = () => {
          setProc(i.dataset.k, i.checked); upd();
          const t = PROP.includes(i.dataset.k) ? $('.proc-gh .tag', c) : i.parentElement.querySelector('.tag');
          if (t) t.dataset.scope = (PROP.includes(i.dataset.k) ? anyOn() : i.checked) ? 'always' : 'engineer';
        };
      });
      popover(b, c);
    };
    upd(); host.append(b); M.on(ev => { if (ev === 'proc') upd(); });
    return b;
  }
  const procExtras = [];
  function setProc(k, v) {
    const ex = procExtras.find(x => x.key === k); if (ex) { S.proc[k] = v; M.audit('setting', ex.label + (v ? ' on' : ' off') + '.'); ex.onChange && ex.onChange(v); M.emit('proc'); emitDirty(); return; }
    S.proc[k] = v;
    M.audit('setting', 'Processing ' + ({ median: 'median baseline', window: '30 to 70 ns window', laser: 'laser correction', compare: 'compare view' }[k]) + (v ? ' on' : ' off') + '. Mode: ' + M.procLabel() + '.');
    if (S.run && k !== 'compare') M.rederive(S.run);
    if (S.readiness && S.readiness.metrics && k !== 'compare') S.readiness.metrics = M.bufferMetrics();
    M.emit('proc'); emitDirty();
  }

  /* ---------- left rail and frame wiring ---------- */
  function buildRail(items) {
    const rail = $('#rail'); rail.innerHTML = '';
    let group = null;
    for (const it of items) {
      if (it.group != null) { group = el('<div class="rail-group' + (it.eng ? ' eng-only' : '') + '">' + (it.group ? '<div class="rail-h">' + esc(it.group) + '</div>' : '') + '</div>'); rail.append(group); continue; }
      const b = el('<button class="nav' + (it.eng ? ' eng-only' : '') + '" data-go="' + it.key + '"' + (it.anchor ? ' data-anchor="' + it.anchor + '"' : '') + '><span>' + esc(it.label) + '</span>' + (it.tag ? it.tag : '') + '</button>');
      b.onclick = () => { go(it.key, it.anchor ? { anchor: it.anchor } : {}); };
      (group || rail).append(b);
    }
    const foot = el('<div class="rail-foot"></div>');
    const sw = el('<label class="switch" title="Simulated role"><input type="checkbox" id="engSwitch"><span>Engineer view</span></label>');
    foot.append(sw);
    const demo = el('<div class="demo-box" aria-label="Demo controls"><div class="demo-h">Demo controls</div>' +
      '<div class="seg sm" id="speedSeg" role="group" aria-label="Playback speed"><button data-v="1">1×</button><button data-v="10">10×</button><button data-v="60">60×</button></div>' +
      '<label class="demo-sel" title="In use, the AKTA run comes from the UNICORN export">AKTA run<select id="demoAkta">' + Object.keys(window.AKTA_RUNS || {}).map(k => '<option value="' + k + '">' + esc(window.AKTA_RUNS[k]) + '</option>').join('') + '</select></label>' +
      '<label title="Allows Start before the laser is stable (rule I1)"><input type="checkbox" id="demoEarly"> Start before laser stable</label>' +
      '<label title="Uses the UNICORN fraction delay from before TRIFLE was fitted (rule I5)"><input type="checkbox" id="demoDelay"> Old fraction delay</label>' +
      '<div class="demo-btns"><button class="btn sm" id="demoFF" title="Simulates the rest of the run immediately">Fast-forward</button>' +
      '<button class="btn sm" id="demoReset" title="Restarts the mock-up from the beginning">Restart</button></div></div>');
    foot.append(demo); rail.append(foot);
    $('#engSwitch').onchange = e => { S.engineer = e.target.checked; document.body.classList.toggle('eng', S.engineer); M.audit('role', 'Simulated role switched to ' + (S.engineer ? 'Engineer' : 'Scientist') + ' view.'); if (!S.engineer && (current === 'engineer' || current === 'calibration')) go('run'); M.emit('series'); M.emit('cards'); emitDirty(); };
    $$('#speedSeg button').forEach(b => b.onclick = () => { S.speed = +b.dataset.v; $$('#speedSeg button').forEach(x => x.classList.toggle('on', x === b)); M.audit('demo', 'Playback speed ' + S.speed + '×.'); });
    $$('#speedSeg button').forEach(x => x.classList.toggle('on', +x.dataset.v === S.speed));
    $('#demoEarly').onchange = e => { S.demo.laserEarly = e.target.checked; M.audit('demo', 'Demo control: start before laser stable ' + (e.target.checked ? 'on' : 'off') + '.'); emitDirty(); };
    const ak = $('#demoAkta'); if (ak) { ak.value = window.aktaRunKey ? window.aktaRunKey() : ak.value; ak.onchange = () => { if (!(window.setAktaRun && window.setAktaRun(ak.value))) ak.value = window.aktaRunKey(); }; }
    $('#hMock').onclick = () => go('testing');
    $('#demoDelay').onchange = e => { setDelayDemo(e.target.checked); };
    $('#demoFF').onclick = () => fastForwardUI();
    $('#demoReset').onclick = () => { const c = el('<div style="width:260px"><div class="small" style="margin-bottom:6px">Restart from the beginning? The run, decisions and audit trail are cleared.</div><button class="btn primary sm" id="rsGo">Restart</button></div>'); popover($('#demoReset'), c); $('#rsGo', c).onclick = () => location.reload(); };
  }
  function setDelayDemo(on) {
    S.demo.delayNotUpdated = on; const d = $('#demoDelay'); if (d) d.checked = on;
    M.audit('demo', 'Demo control: old fraction delay ' + (on ? 'on (' + fmt.ml(S.setup.fracDelayPre) + ' mL)' : 'off (' + fmt.ml(S.setup.fracDelay) + ' mL)') + '.');
    settingChangedDuringRun();
  }
  function settingChangedDuringRun() {
    const R = S.run; if (R) { R.rules.i5At = R.derivedN; R.rules.replay(); M.log(R, 'alignment', M.alignmentState().i5 ? 'Alignment settings changed: ' + M.alignmentState().issues.join(' ') : 'Alignment settings changed: fraction assignment aligned.'); }
    M.emit('cards'); emitDirty();
  }
  let ffRunning = false;
  function fastForwardUI() {
    const R = S.run;
    if (!R) { const c = el('<div class="small">Start a run first.</div>'); popover($('#demoFF'), c); return; }
    if (R.state !== 'acquiring' || ffRunning) return;
    ffRunning = true; M.audit('demo', 'Demo control: fast-forward to run end.');
    const step = () => { const done = M.fastForward(R, 30); emitDirty(); if (!done && R.state === 'acquiring') setTimeout(step, 0); else ffRunning = false; };
    step();
  }
  function isFF() { return ffRunning; }

  // generic click-to-sort for compact tables (numbers sort numerically)
  function sortable(table) {
    if (!table || table._sortable) return; table._sortable = true;
    table.addEventListener('click', e => {
      const th = e.target.closest('th'); if (!th || !table.tHead || !table.tHead.contains(th) || th.classList.contains('nosort')) return;
      const idx = [...th.parentElement.children].indexOf(th), dir = th.dataset.dir === 'asc' ? -1 : 1;
      [...th.parentElement.children].forEach(x => { delete x.dataset.dir; x.textContent = x.textContent.replace(/ [▲▼]$/, ''); });
      th.dataset.dir = dir > 0 ? 'asc' : 'desc'; th.textContent += dir > 0 ? ' ▲' : ' ▼';
      const val = tr => { const t = (tr.children[idx] ? tr.children[idx].textContent : '').trim(); const n = parseFloat(t.replace(/[,\u2212]/g, m => m === ',' ? '' : '-')); return isFinite(n) && /^[\u2212+-]?[\d.,]/.test(t) ? n : t.toLowerCase(); };
      const rows = [...table.tBodies[0].rows]; rows.sort((a, b) => { const x = val(a), y = val(b); return (x > y ? 1 : x < y ? -1 : 0) * dir; }); rows.forEach(r => table.tBodies[0].append(r));
    });
    table.tHead && [...table.tHead.querySelectorAll('th')].forEach(th => { if (!th.classList.contains('nosort')) { th.classList.add('sortable'); th.title = th.title || 'Click to sort'; } });
  }
  function sortAll(root) { (root || document).querySelectorAll('table.tbl').forEach(t => { if (t.id !== 'frTbl') sortable(t); }); }
  return { cardShown, procExtras, sortable, sortAll, $, $$, esc, el, tag, TAGS, sgn, stateHtml, register, go, cur, screen, emitDirty, frame, modal, popover, closePopover, download, downloadDataUrl, copyText, processingButton, setProc, buildRail, renderChips, setDelayDemo, settingChangedDuringRun, isFF, indicators };
})();
