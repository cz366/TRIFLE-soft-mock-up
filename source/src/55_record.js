/* ---------- Record ---------- */
const REC = (function () {
  const { $, $$, esc, el, tag } = UI, S = M.S, fmt = M.fmt;
  let built = false, purpose = null, lastKey = '';
  const LV = { I: 0, P: 1, H: 2 };
  const ruleOrder = (a, b) => LV[a[0]] - LV[b[0]] || +a.slice(1) - +b.slice(1);
  const stop = t => /[.!?]$/.test(t) ? t : t + '.';
  // One line per card in Data quality. Hypotheses carry their title (their observation does not repeat it) and the confirmation.
  function cardLine(c, withPhase) {
    const head = c.rule + (withPhase && c.phase ? ', ' + c.phase : '') + (c.status !== 'open' ? ', ' + c.status : '');
    const obs = c.obs || '', parts = [];
    if (c.linkedTo || !obs) { if (obs.indexOf(c.title) !== 0) parts.push(stop(c.title)); }
    if (obs) parts.push(obs);
    if (c.confirm) parts.push('Confirm: ' + c.confirm);
    if (c.note) parts.push('Note: ' + stop(c.note));
    return head + ': ' + parts.join(' ');
  }
  // Each hypothesis follows the observation it comes from; it names its phase only when that observation is not listed.
  function cardLines(list) {
    const ids = new Set(list.map(c => c.id)), out = [];
    list.filter(c => !c.linkedTo || !ids.has(c.linkedTo)).forEach(c => {
      out.push(cardLine(c, true));
      list.filter(h => h.linkedTo === c.id).forEach(h => out.push(cardLine(h, false)));
    });
    return out;
  }
  function resultsHead(showAssign) {
    return [['Fraction'], ['Phase'], ['Volume', 'mL'], ['UV 280 mean / max', 'mAU'], ['Fluor. mean / max', 'V·ns']].concat(showAssign ? [['Assignment']] : [], [['Cards']]);
  }
  function sections() {
    const R = S.run, s = R ? R.setupSnap : S.setup, al = M.alignmentState(), p = M.plumbing(), pi = M.presetInfo(s.pmt);
    const tpl = R ? R.tpl : M.template(), ph = R ? R.ph : TR.buildPhases(tpl), src = s.source;
    const out = {};
    out.purpose = purpose != null ? purpose : (src === 'standalone' ? 'Monitor ' + s.sample + ' (' + s.runName + ') with TRIFLE total fluorescence, without AKTA data.' : 'Monitor the ' + tpl.name + ' run of ' + s.sample + ' (' + s.runName + ') with TRIFLE total fluorescence and identify fractions for offline analysis.');
    out.methods = [
      'Instrument: TRIFLE (pulsed UV laser, 10 Hz; PMT; six-position ND filter wheel; PicoScope 6000 series, 8-bit, 0.2 ns sampling). Software: TRIFLE mock-up, simulated data.',
      'Preset: ' + pi.id + ' (PMT ' + s.pmt + ' mV, checksum ' + pi.checksum + '; ' + pi.ladderFile + ', ' + pi.irfFile + ').',
      ...(s.rangeMap === 'shift' ? ['Input ranges simulated one setting larger than stated (what-if, to verify on hardware).'] : []),
      'Auto-ranging: ' + (s.autorange === 'v20' ? 'v2.0 reference' : 'Proposed (block median input, corrected no-signal test, baseline not scaled)') + '. Processing: ' + M.procLabel() + '.',
      'Chromatography: ' + (src === 'standalone' ? 'none (standalone TRIFLE)' : (s.system === 'avant' ? 'AKTA avant 150' : 'AKTA pure') + ', method ' + tpl.name + '; ' + ({ import: 'phases and fractions from the imported UNICORN result export', manual: 'phases from manual event marks' }[src])) + '.',
      ...(src === 'standalone' ? ['Alignment: not used (standalone TRIFLE, time axis).'] : [
        'Delay volumes: V1 (UV to TRIFLE) ' + fmt.ml(s.V1) + ' mL, V2 (TRIFLE to collector) ' + fmt.ml(s.V2) + ' mL, UNICORN fraction delay ' + fmt.ml(p.fracDelay) + ' mL.',
        'Alignment method: ' + (src === 'manual' || !s.flowTrace ? 'delay volumes applied in the volume domain, without a flow trace.' : 'cumulative volume from the integrated AKTA flow trace; delay volumes applied in the volume domain.')
      ])
    ].join('\n');
    if (R) {
      const st = M.fractionStats(R), showAssign = st.some(f => f.assign === 'Uncertain');
      out.resultsHead = resultsHead(showAssign);
      out.resultsTable = st.map(f => [f.id, f.phase, fmt.ml(f.a) + '-' + fmt.ml(f.b), fmt.mau(f.uvMean) + ' / ' + fmt.mau(f.uvMax) + (f.uvSat ? ' (sat.)' : ''), fmt.sig3(f.fMean) + ' / ' + fmt.sig3(f.fMax)].concat(showAssign ? [f.assign] : [], [f.linked.join(' ')]));
      out.results = R.id + ': ' + fmt.int(R.acq.n) + ' blocks over ' + fmt.min1((R.state === 'complete' ? R.endAt : M.runTimeS(R)) / 60) + ' min. Fluorescence is relative (V·ns, ND-corrected); no recovery or purity is derived.' +
        (st.length ? '\n' + out.resultsHead.map(h => h[0] + (h[1] ? ' (' + h[1] + ')' : '')).join('  ') + '\n' + out.resultsTable.map(r => r.join('  ').trimEnd()).join('\n') : '');
      const A = R.acq, n = R.derivedN; let disc = 0, over = 0, low = 0; for (let i = 0; i < n; i++) { disc += A.disc[i]; over += A.nOver[i]; low += R.low[i]; }
      const cards = R.rules.cards, byRule = {}; cards.forEach(c => { byRule[c.rule] = (byRule[c.rule] || 0) + 1; });
      const nOpen = cards.filter(c => c.status === 'open').length;
      const open = cardLines(cards.filter(c => c.status === 'open' && c.level !== 'I'));
      const noted = cardLines(cards.filter(c => c.status !== 'open' && c.note));
      out.quality = [
        'Blocks: ' + fmt.int(n - disc) + ' recorded, ' + disc + ' discarded (' + (disc === 1 ? 'timeout' : 'timeouts') + '). Waveforms above 90 % of the input range: ' + fmt.int(over) + '. Low-precision blocks (under ' + Math.round(S.th.lowPrec * 100) + ' % of range): ' + (n ? (low / n * 100).toFixed(0) : 0) + ' %.',
        'Sensitivity changes: ' + R.acq.changes.length + '.',
        'Laser: ' + (R.laserStableAtStart ? 'stable (provisional) at run start.' : 'not stable at run start; see I1.') + (R.override ? ' Readiness override: ' + stop(R.override.reason) : ''),
        'Pre-run buffer baseline: ' + (R.readyAcq ? 'measured at Readiness.' : 'not measured; rule P3 not evaluated.'),
        'Alignment: detector ' + al.detector.toLowerCase() + ', fraction assignment ' + al.fractions.toLowerCase() + '.' + (al.issues.length ? ' ' + al.issues.join(' ') : ''),
        'Evidence cards: ' + (cards.length ? cards.length + ', ' + (nOpen || 'none') + ' open. ' + Object.keys(byRule).sort(ruleOrder).map(k => k + (byRule[k] > 1 ? ' ×' + byRule[k] : '')).join(', ') + '.' : 'none.'),
        'Open observations and hypotheses:' + (open.length ? '' : ' none.'), ...open,
        ...(noted.length ? ['Closed with a note:', ...noted] : [])
      ].join('\n');
    } else { out.results = 'No run recorded yet.'; out.quality = 'No run recorded yet.'; out.resultsTable = []; out.resultsHead = resultsHead(false); }
    out.decisions = samples();
    out.attachments = [
      ...(src === 'standalone' ? [] : ['UNICORN result report']),
      'TRIFLE block data: ' + fileBase() + '_blocks.csv',
      ...(src === 'standalone' ? [] : ['TRIFLE fraction table: ' + fileBase() + '_fractions.csv']),
      'TRIFLE metadata, settings and audit trail: ' + fileBase() + '_metadata.json',
      'Chromatogram figure: ' + fileBase() + '_chromatogram.png',
      ...(src === 'standalone' ? [] : ['HPLC-SEC, Lunatic and Protein A HPLC results for the fractions in section 5'])
    ].join('\n');
    return out;
  }
  function samples() { const f = UI.screen('fractions'); return f && f.samplesText ? f.samplesText() : ''; }
  function runChart() { const r = UI.screen('run'); return r && r.chart ? r.chart() : null; }
  function fileBase() { return (S.setup.eln || 'TRIFLE').replace(/[^A-Za-z0-9_-]/g, '_') + '_' + (S.run ? S.run.id : 'norun'); }
  function build() {
    const r = $('#scr-record');
    r.innerHTML = '<div class="scr-h"><h1>Record</h1></div>' +
      '<div class="grid2 rec-grid"><div class="stack"><div class="panel"><div class="ph"><h3>Exports</h3></div><div class="pb stack" style="gap:8px" id="recExports"></div></div>' +
      '<div class="panel eng-only"><div class="ph"><h3>Provenance</h3></div><div class="pb" id="recProv"></div></div></div>' +
      '<div class="panel"><div class="ph"><h3>Notebook-ready summary</h3><span class="sp"></span><button class="btn sm" id="recCopyAll">Copy all</button></div><div class="pb" id="recBody"></div></div></div>' +
      '<div class="panel" style="margin-top:12px"><div class="ph"><h3>Audit trail</h3></div><div class="pb tbl-wrap" style="padding:0;max-height:360px"><table class="tbl" id="recAudit"><thead><tr><th>Time</th><th>Type</th><th>Entry</th><th>By</th></tr></thead><tbody></tbody></table></div></div>';
    built = true;
    $('#recCopyAll').onclick = e => UI.copyText(allText(), e.target);
  }
  function allText() { const s = sections(); return ['1. Purpose', s.purpose, '', '2. Methods', s.methods, '', '3. Results', s.results, '', '4. Data quality', s.quality, '', '5. Fraction decisions', s.decisions, '', '6. Attachments', s.attachments].join('\n'); }
  function render() {
    const R = S.run, s = sections();
    const key = JSON.stringify([R ? R.derivedN : 0, R ? R.state : '', R ? R.rules.cards.map(c => c.status + c.obs.length) : 0, S.decisions, M.procLabel(), purpose, S.audit.length]);
    if (key === lastKey) return; lastKey = key;
    const thead = s.resultsHead.map((h, k) => '<th' + (k >= 2 && k <= 4 ? ' class="num"' : '') + '>' + esc(h[0]) + (h[1] ? ' <span class="unit">(' + esc(h[1]) + ')</span>' : '') + '</th>').join('');
    const sec3 = (s, fig) => '<div class="rec-sec"><div class="rh"><h3>3. Results</h3><span class="sp"></span><button class="btn sm" data-copy="3">Copy</button></div>' + fig + '<div class="rec-text">' + esc(s.results.split('\n')[0]) + '</div>' + (s.resultsTable.length ? '<div class="tbl-wrap" style="margin-top:6px"><table class="tbl"><thead><tr>' + thead + '</tr></thead><tbody>' + s.resultsTable.map(r => '<tr>' + r.map((c, k) => '<td' + (k >= 2 && k <= 4 ? ' class="num"' : '') + '>' + esc(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>' : '') + '</div>';
    const sec = (n, title, text, extra) => '<div class="rec-sec"><div class="rh"><h3>' + n + '. ' + title + '</h3><span class="sp"></span><button class="btn sm" data-copy="' + n + '">Copy</button></div>' + (extra || '') + '<div class="rec-text">' + esc(text) + '</div></div>';
    let fig = '';
    const rc = runChart();
    if (R && rc && rc.W) { try { fig = '<img class="rec-fig" alt="Chromatogram with TRIFLE fluorescence and UV 280" style="width:100%;border:1px solid var(--border);margin-bottom:6px" src="' + rc.toPNG(R.id + ', ' + M.procLabel()) + '">'; } catch (e) { fig = ''; } }
    $('#recBody').innerHTML = '<div class="rec-print-only" style="border-bottom:1px solid #999;margin-bottom:8px;padding-bottom:4px"><b>TRIFLE notebook-ready summary</b><br>' + esc((R ? R.setupSnap : S.setup).eln + ' · ' + (R ? R.id : 'no run') + ' · ' + (R ? R.setupSnap : S.setup).runName + ' · printed ' + M.stamp(S.simT) + ' · TRIFLE mock-up, simulated data') + '</div>' +
      '<div class="rec-sec"><div class="rh"><h3>1. Purpose</h3><span class="sp"></span><button class="btn sm" data-copy="1">Copy</button></div><textarea id="recPurpose" rows="2" style="width:100%">' + esc(s.purpose) + '</textarea></div>' +
      sec(2, 'Methods', s.methods) + sec3(s, fig) + sec(4, 'Data quality', s.quality) + sec(5, 'Fraction decisions', s.decisions) + sec(6, 'Attachments', s.attachments);
    $('#recPurpose').onchange = e => { purpose = e.target.value; M.audit('record', 'Purpose edited.'); };
    $$('[data-copy]', $('#recBody')).forEach(b => b.onclick = () => { const k = +b.dataset.copy, t = [null, sections().purpose, s.methods, s.results, s.quality, s.decisions, s.attachments][k]; UI.copyText(t, b); M.audit('record', 'Section ' + k + ' copied.'); });
    exportsPanel(); prov(); audit();
  }
  function exportsPanel() {
    const R = S.run, dis = R ? '' : ' disabled', csv = (R ? R.setupSnap : S.setup).csvJson;
    const box = $('#recExports');
    box.innerHTML = '<div class="toolbar"><button class="btn" id="exBlocks"' + dis + '>Block data (CSV)</button><button class="btn" id="exFr"' + (R && R.fractions.length ? '' : ' disabled') + '>Fraction table (CSV)</button><button class="btn" id="exJson">Metadata (JSON)</button><button class="btn" id="exPng"' + dis + '>Chromatogram (PNG)</button><span id="exStage2"></span></div>' +
      '<div class="callout small"><b>Instrument record</b> ' + tag('E') + ' Run folder (.pkl and settings). Move it to SharePoint, then delete the local copy.' + (csv ? ' CSV and JSON metadata are written alongside. ' + tag('P') : '') + '</div>';
    if (R) { $('#exBlocks').onclick = () => exportBlocks(); $('#exFr').onclick = () => exportFractions(); $('#exPng').onclick = () => exportPng(); }
    $('#exJson').onclick = () => exportJson();
    if (window.REC_STAGE2) window.REC_STAGE2($('#exStage2'));
  }
  function logExport(name) { S.exports.push({ name, ts: M.stamp(S.simT) }); M.audit('export', 'Exported ' + name + '.'); if (S.run) M.log(S.run, 'system', 'Exported ' + name + '.'); }
  // On the hosted page a save resolves false when it fails or is declined; only a completed save is logged.
  function saved(name, result) { Promise.resolve(result).then(ok => { if (ok !== false) logExport(name); }, () => { if (UI.notice) UI.notice('Could not save ' + name + '.', 'warn'); }); }
  function exportBlocks() {
    const R = S.run, A = R.acq, n = R.derivedN, lad = TR.LADDERS[R.pmt], k = M.comboIdx();
    const fr = R.fractions, p = M.plumbing();
    const lines = ['block,time_min,akta_time_min,volume_mL,CV,phase,fraction,fluor_v20_Vns,fluor_proposed_Vns,fluor_proposed_corrected_Vns,step,nd_od,range_mV,range_use_pct,waveforms_over_90pct,beam_monitor_rel,flags'];
    for (let i = 0; i < n; i++) {
      const u = A.u[i], f = fr.find(q => { const [a, b] = TR.collectedRange(q, p); return u >= a && u < b; });
      const st = lad[A.step[i] - 1], flags = [A.disc[i] ? 'discarded' : '', R.low[i] ? 'low_precision' : '', A.nOver[i] > 2 ? 'overrun' : ''].filter(Boolean).join('|');
      const pr = A.F[k][i], pc = isFinite(A.bm[i]) ? pr / A.bm[i] : NaN;
      lines.push([i + 1, (A.t[i] / 60).toFixed(4), M.aktaMin(R, A.t[i]).toFixed(4), u.toFixed(4), (u / R.cv).toFixed(4), '"' + R.ph.list[A.phase[i]].name + '"', f ? f.id : '', num(A.F[0][i]), num(pr), num(pc), A.step[i], st.nd, st.range * 1000, isFinite(A.ruse[i]) ? (A.ruse[i] * 100).toFixed(1) : '', A.disc[i] ? '' : A.nOver[i], isFinite(A.bm[i]) ? A.bm[i].toFixed(5) : '', flags].join(','));
    }
    const name = fileBase() + '_blocks.csv'; saved(name, UI.download(name, lines.join('\n'), 'text/csv'));
  }
  function num(v) { return isFinite(v) ? v.toPrecision(8) : ''; }
  function exportFractions() {
    const R = S.run, st = M.fractionStats(R);
    const lines = ['fraction,phase,volume_start_mL,volume_end_mL,collected_start_mL,collected_end_mL,CV_start,CV_end,uv280_mean_mAU,uv280_max_mAU,uv_saturated,fluor_mean_Vns,fluor_max_Vns,processing,sensitivity_changes,waveforms_over_90pct,discarded_blocks,laser_flags,low_precision_share,assignment,share_of_integrated_fluorescence_pct,cards,decision,decision_note'];
    for (const f of st) { const d = S.decisions[f.id] || {}; lines.push([f.id, f.phase, f.a.toFixed(3), f.b.toFixed(3), f.ca.toFixed(3), f.cb.toFixed(3), f.cvA.toFixed(3), f.cvB.toFixed(3), isFinite(f.uvMean) ? f.uvMean.toFixed(1) : '', isFinite(f.uvMax) ? f.uvMax.toFixed(1) : '', f.uvSat, num(f.fMean), num(f.fMax), '"' + M.procLabel() + '"', f.chg, f.over, f.disc, f.laser, f.lowShare.toFixed(3), f.assign, isFinite(f.share) ? (f.share * 100).toFixed(2) : '', '"' + f.linked.join(' ') + '"', '"' + [['sec', 'HPLC-SEC'], ['lun', 'Lunatic'], ['proa', 'Protein A HPLC'], ['none', 'No action']].filter(k => d[k[0]]).map(k => k[1]).join('; ') + '"', '"' + (d.note || '').replace(/"/g, "'") + '"'].join(',')); }
    const name = fileBase() + '_fractions.csv'; saved(name, UI.download(name, lines.join('\n'), 'text/csv'));
  }
  function exportJson() {
    const R = S.run;
    const meta = {
      generator: 'TRIFLE mock-up (simulated data)', instrument: 'TRIFLE', exported: M.stamp(S.simT), seed: TR.SEED,
      labels: { Existing: 'Implemented in the current TRIFLE Python control software, version 2.0', Proposed: 'Designed here, not yet built or experimentally verified', Future: 'Needs further development and access to GSK systems' },
      versions: { trifle: '2.0 (reference algorithms)', mockup: 'Stage ' + (window.STAGE2 ? '2' : '1') },
      setup: R ? R.setupSnap : S.setup, processing: { mode: M.procLabel(), options: S.proc }, thresholds_provisional: S.th, preset: M.presetInfo((R ? R.setupSnap : S.setup).pmt),
      alignment: M.alignmentState(), plumbing: M.plumbing(), run: R ? { id: R.id, blocks: R.acq.n, state: R.state, timer_min: R.timerMin, data_checksum: TR.fnv([R.acq.F[0], R.acq.F[3]], R.acq.n), laser_stable_at_start: R.laserStableAtStart, override: R.override, cards: R.rules.cards.map(c => ({ id: c.id, rule: c.rule, level: c.levelName, phase: c.phase, title: c.title, observation: c.obs, fractions: c.fractions, processing: c.mode, status: c.status, note: c.note, confirm: c.confirm || null })), notes: R.notes } : null,
      decisions: S.decisions, audit_trail: S.audit, exports: S.exports
    };
    const name = fileBase() + '_metadata.json'; saved(name, UI.download(name, JSON.stringify(meta, null, 2), 'application/json'));
  }
  function exportPng() { const rc = runChart(); if (!rc || !rc.W) { UI.go('run'); return; } const name = fileBase() + '_chromatogram.png'; saved(name, UI.downloadDataUrl(name, rc.toPNG(S.run.id + ', ' + M.procLabel()))); }
  function prov() {
    const R = S.run, s = R ? R.setupSnap : S.setup, p = M.plumbing(), pi = M.presetInfo(s.pmt), src = s.source;
    const fig = R ? 'Raw blocks 1 to ' + fmt.int(R.acq.n) + ' (block waveforms regenerated from seed ' + TR.SEED + '); processing ' + M.procLabel() + (src === 'standalone' ? '' : '; alignment V1 ' + fmt.ml(s.V1) + ' mL, V2 ' + fmt.ml(s.V2) + ' mL, fraction delay ' + fmt.ml(p.fracDelay) + ' mL') + '; preset ' + pi.id + '.' + ({ import: ' AKTA traces, phases and fractions from the UNICORN result export.', manual: ' Phases from manual event marks.' }[src] || '') : 'No run.';
    const table = !R ? 'No run.' : !R.fractions.length ? 'No fractions.' : 'As the chromatogram figure' + (src === 'import' ? ', plus UV statistics over each fraction\'s collected liquid.' : '.');
    $('#recProv').innerHTML = '<table class="tbl"><thead><tr><th>Item</th><th>Derived from</th></tr></thead><tbody>' +
      '<tr><td>Chromatogram figure</td><td class="wrap small">' + esc(fig) + '</td></tr>' +
      '<tr><td>Fraction table</td><td class="wrap small">' + esc(table) + '</td></tr>' +
      '<tr><td>Data quality</td><td class="wrap small">Evidence rules and thresholds, readiness checks and the run log.</td></tr>' +
      '<tr><td>Fraction decisions</td><td class="wrap small">Scientist decisions in Fraction review, with notes; audit trail.</td></tr></tbody></table>';
  }
  function audit() {
    const tb = $('#recAudit tbody'); if (tb._n === S.audit.length) return; tb._n = S.audit.length;
    tb.innerHTML = S.audit.slice().reverse().map(a => '<tr><td class="nowrap">' + esc(a.ts) + '</td><td>' + esc(a.kind) + '</td><td class="wrap">' + esc(a.text) + '</td><td>' + esc(a.by) + '</td></tr>').join('') || '<tr><td colspan="4" class="muted">No entries yet.</td></tr>';
  }
  let lastT = 0;
  UI.register('record', { show() { if (!built) build(); lastKey = ''; render(); lastT = performance.now(); }, update() { if (!built) build(); if (performance.now() - lastT < 2000) return; lastT = performance.now(); render(); } });
  return { sections, allText, fileBase, logExport };
})();
