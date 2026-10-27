/* ---------- What this prototype is testing ---------- */
(function () {
  const { $, esc } = UI;
  const ROWS = [
    ['Faster access to useful measurements', 'Live acquisition and chromatogram', 'Time from acquisition to an interpretable result'],
    ['Better fraction investigation', 'Fraction review with evidence cards', 'Whether prioritised fractions match offline analytical findings'],
    ['Resolve species that elute together', 'Lifetime analysis: species chromatograms, Decay panel and decay map (Proposed)', 'Agreement of species shares with HPLC-SEC, Protein A HPLC or capsid assays on the same fractions'],
    ['Fewer unnecessary offline analyses', 'Evidence-led suggestions for confirmation', 'Samples tested per run and what they found'],
    ['Improved reproducibility', 'Presets, readiness checks, QC flags', 'Repeatability and frequency of invalid runs'],
    ['Improved data availability', 'Structured export tied to experiment ID', 'Time to transfer and retrieve run data'],
    ['Easier operator adoption', 'Guided workflow and Questions panel', 'Training time and task completion']
  ];
  const LABELS = [
    ['E', 'Implemented in the current TRIFLE Python control software, version 2.0.'],
    ['P', 'Designed here, not yet built or experimentally verified.'],
    ['F', 'Needs further development and access to GSK systems.'],
    ['A', 'An inference the instrument team has not confirmed.'],
    ['H', 'Read from the v2.0 source code and not yet checked on the instrument.'],
    ['D', 'A Stage 2 modelling choice, such as a fit weighting or linearity limit, not validated.']
  ];
  function build() {
    $('#scr-testing').innerHTML = '<div class="scr-h"><h1>About this mock-up</h1></div><div class="stack" style="max-width:1040px">' +
      '<p class="muted" style="margin:0">Every number comes from a seeded simulation. The v2.0 calculations run for real on that data.</p>' +
      '<div class="panel"><div class="ph"><h3>What this mock-up is testing</h3></div><div class="pb"><p style="margin:0 0 8px">Evaluation objectives for a future GSK assessment. These are not results.</p><div class="tbl-wrap"><table class="tbl"><thead><tr><th class="nosort">GSK objective</th><th class="nosort">Prototype feature</th><th class="nosort">Evidence to collect</th></tr></thead><tbody>' + ROWS.map(r => '<tr><td class="wrap">' + esc(r[0]) + '</td><td class="wrap">' + esc(r[1]) + '</td><td class="wrap">' + esc(r[2]) + '</td></tr>').join('') + '</tbody></table></div></div></div>' +
      '<div class="panel"><div class="ph"><h3>Labels</h3></div><div class="pb"><table class="tbl lbl-tbl"><tbody>' + LABELS.map(([k, t]) => '<tr><td>' + UI.tag(k, 'always') + '</td><td class="wrap">' + esc(t) + '</td></tr>').join('') + '</tbody></table></div></div>' + (window.INTEGRATIONS_HTML ? window.INTEGRATIONS_HTML() : '') + '</div>';
  }
  UI.register('testing', { show() { build(); } });
})();

/* ---------- Questions panel ---------- */
const Q = (function () {
  const { $, $$, esc, el } = UI, S = M.S, fmt = M.fmt;
  const OUT = 'The Questions panel cannot answer that. Ask the instrument specialist.';
  const GLOSSARY = {
    'sensitivity step': ['Sensitivity step', 'A ladder position: a neutral density filter, which dims the light by a known factor, combined with a digitiser input range. The software picks the step that keeps the pulse near 80 % of range, so signals of very different size stay measurable. Readings are corrected for the step in use.'],
    'input range use': ['Input range use', 'How much of the digitiser\'s measuring window the latest pulse fills. Above 90 % risks clipping. Under 20 % is shaded as low precision.'],
    'fluorescence': ['Fluorescence (V·ns, ND-corrected)', 'Light emitted mainly by tryptophan in proteins after each laser pulse, integrated over the pulse and corrected for the filter in use. It is relative and gives no concentration without calibration.'],
    'beam monitor': ['Beam monitor', 'TRIFLE\'s own photodiode reading of each laser pulse. It is separate from the laser controller\'s internal reading.'],
    'laser warm-up': ['Laser warm-up', 'The period after switch-on during which the laser controller\'s reading can change. Wait for \"stable (provisional)\" before starting a run. The software keeps watching afterwards.'],
    'instrument response': ['Instrument response (IRF)', 'The shape the detector records for an extremely short flash. It is drawn as a dashed reference on pulse views.'],
    'inner-filter': ['Inner-filter effect', 'At high concentration the sample absorbs so much light that fluorescence stops rising in proportion to concentration.'],
    'pmt': ['PMT', 'The light detector. Its gain is set by a control voltage, with presets of 400 or 800 mV, on a separate supply.'],
    'baseline': ['Baseline', 'The signal before the pulse arrives, subtracted from every waveform. v2.0 uses the mean of the first 100 samples; Proposed uses the median.'],
    'rapid block': ['Rapid block', 'Ten laser pulses captured together, about one second of data.'],
    'auto-rang': ['Auto-ranging', 'After each rapid block the software chooses the sensitivity step for the next one, aiming for about 80 % of the input range and avoiding more than 90 %. Proposed auto-ranging uses the block median waveform, a corrected no-signal test and an unscaled baseline.'],
    'trained user': ['Trained user', 'Confirms you are trained to use this instrument. Needed before Start.'],
    'ip agreement': ['IP agreement', 'Confirms IP arrangements are in place for collaborative work. Needed before Start.'],
    'alignment': ['Alignment', 'Matching TRIFLE data to the AKTA run by volume, allowing for the tubing volume between the two detectors (V1).'],
    'fraction assignment': ['Fraction assignment', 'Which collected fraction a stretch of TRIFLE signal ended up in. It depends on the tubing volume to the fraction collector (V2) and on the delay volume set in UNICORN.'],
    'low precision': ['Low precision', 'Stretches where the pulse fills under 20 % of the input range. There a small baseline error has a large effect on fluorescence. The Proposed 30 to 70 ns window reduces this.'],
    'evidence level': ['Evidence levels', 'Instrument evidence: findings about the measurement itself. Process observation: a measured change that warrants attention, stated without interpretation. Research hypothesis: a possible process explanation that needs offline confirmation, always linked to the observation it comes from.']
  };
  const CHIPS = {
    setup: ['What does auto-ranging do?', 'What is the IP agreement?', 'What is the difference between v2.0 and Proposed processing?'],
    readiness: ['Is the laser ready?', 'What is the buffer baseline?', 'What does a beam monitor measure?'],
    run: ['Why did the sensitivity change?', 'Is the column breaking through?', 'Why does fluorescence not follow the UV during the load?', 'Is the laser ready?'],
    fractions: ['Can I trust the elution peak?', 'Which fractions have flags?', 'What does "Research hypothesis" mean?', 'Is the column breaking through?'],
    record: ['How do I put this run into my notebook?', 'Which fractions have flags?', 'What is the difference between v2.0 and Proposed processing?'],
    engineer: ['What is low precision?', 'What is the instrument response?', 'What is the difference between v2.0 and Proposed processing?'],
    testing: ['How do I put this run into my notebook?', 'What does "Research hypothesis" mean?']
  };
  const extra = [];
  function addIntent(fn) { extra.push(fn); }
  function words(s) { return s.split(/\s+/).filter(Boolean).length; }
  function limit(text) { if (words(text) <= 120) return text; const parts = text.split(/(?<=\.)\s+/); let out = ''; for (const p of parts) { if (words(out + ' ' + p) > 118) break; out += (out ? ' ' : '') + p; } return out; }
  function A(text, source) { return { text: limit(text), source }; }
  function runTimeOf(e) { return e.t / 60; }
  // Deterministic local engine. Draws only on the glossary, procedures, run state and logs, and the evidence rules.
  // Replacing answerQuestion with a hosted language model is a future integration: it would need defined
  // data access, permissions, provenance of every answer, and GSK approval.
  function answerQuestion(text, context) {
    const q = text.toLowerCase().trim(), R = context.run;
    for (const fn of extra) { const r = fn(q, context); if (r) return r; }
    if (/\b(weather|news|stock|price|recipe|joke|football|email|password|who is|capital of|translate)\b/.test(q)) return A(OUT, 'Scope of the Questions panel');
    // rule lookup
    const rm = q.match(/\b([iph])([1-9])\b/), id = rm ? (rm[1] + rm[2]).toUpperCase() : null, rule = id && M.ruleById(id);
    if (rule) {
      const cs = R ? R.rules.cards.filter(c => c.rule === id) : [], last = cs[cs.length - 1];
      const fired = last ? ' It fired ' + (cs.length > 1 ? cs.length + ' times' : 'once') + ' in this run. Latest card: ' + (last.obs && last.obs.indexOf(last.title) === 0 ? [last.obs] : [last.title, last.obs]).filter(Boolean).map(t => t.replace(/\.?$/, '.')).join(' ') : ' It has not fired in this run.';
      return A('Rule ' + id + '. ' + rule.cond(S.th) + (rule.note ? ' ' + rule.note : '') + fired, 'Rule catalogue, ' + id + (last ? '; card ' + last.id : ''));
    }
    if (/sensitiv|\bstep\b|filter change|range change/.test(q) && /why|when|chang/.test(q)) {
      if (!R) return A('No run yet. During a run, each sensitivity change is logged with the range use that caused it. ' + GLOSSARY['sensitivity step'][1], 'Glossary: Sensitivity step');
      const ch = R.log.filter(e => e.type === 'sensitivity'); if (!ch.length) return A('The sensitivity has not changed in this run so far.', 'Run log');
      const mm = q.match(/(\d+(?:\.\d+)?)\s*(min|minutes|ml|mL)?/), unit = mm && mm[2] ? mm[2].toLowerCase() : 'min';
      let e = ch[ch.length - 1], note = '';
      if (mm) {
        const v = parseFloat(mm[1]); const key = unit.startsWith('m') && unit !== 'min' && unit !== 'minutes' ? 'x' : 't';
        const val = key === 'x' ? v : v * 60; e = ch.reduce((b, c) => Math.abs((key === 'x' ? c.x : c.t) - val) < Math.abs((key === 'x' ? b.x : b.t) - val) ? c : b, ch[0]);
        const off = key === 'x' ? Math.abs(e.x - v) : Math.abs(e.t / 60 - v);
        if (off > (key === 'x' ? 1 : 1.5)) note = 'There was no sensitivity change at ' + v + ' ' + (key === 'x' ? 'mL' : 'min') + '. The nearest was at ';
        else note = '';
      }
      return A((note || 'At ') + e.wall + ' (run time ' + fmt.min1(runTimeOf(e)) + ' min, ' + fmt.ml(e.x).replace('-', '−') + ' mL): ' + e.text + ' Auto-ranging aims for 80 % of the input range and avoids more than 90 %.', 'Run log entry ' + e.wall + '; glossary: Sensitivity step');
    }
    if (/break ?through|breaking through|breakthrough/.test(q)) {
      if (R && !R.tpl.breakthroughRule) return A('Rule P2 and hypothesis H1 apply to mAb Protein A templates only. This run uses ' + R.tpl.name + '.', 'Rules P2, H1; method template');
      const p2 = R ? R.rules.cards.filter(c => c.rule === 'P2') : [], h1 = R ? R.rules.cards.find(c => c.rule === 'H1') : null;
      if (p2.length) return A('Possibly, but not confirmed. Rule P2: ' + p2[0].obs + ' H1 is a research hypothesis that mAb breakthrough may be starting. Total fluorescence cannot separate mAb from HCP. Confirm with ' + h1.confirm.replace(/\.$/, '') + '.', 'Cards ' + p2[0].id + ', ' + h1.id);
      return A('No P2 observation in this run' + (R ? ' so far' : '') + '. P2 watches the fluorescence slope over the last 1 CV after the load plateau (limit 2 % per CV). Total fluorescence cannot separate mAb from HCP; the monomer component of the lifetime analysis can (Proposed). Confirm breakthrough with Protein A HPLC on the flowthrough fractions.', 'Rules P2 and H1');
    }
    if (/trust|reliab|confiden/.test(q) && /peak|elution/.test(q) || /can i trust/.test(q)) {
      if (!R) return A('No run yet. After a run, the answer uses the elution fractions\' QC: range overruns, sensitivity changes, discarded blocks, laser flags and alignment.', 'Fraction table QC');
      const st = M.fractionStats(R).filter(f => f.phaseKey === (R.tpl.fractions.elPhase || 'el') && f.nBlocks), pk = st.filter(f => f.fMax > 0.2 * Math.max(...st.map(x => x.fMax || 0)));
      if (!pk.length) return A('The elution peak has not been acquired yet.', 'Run state');
      const over = pk.reduce((a, f) => a + f.over, 0), chg = pk.reduce((a, f) => a + f.chg, 0), disc = pk.reduce((a, f) => a + f.disc, 0), las = pk.reduce((a, f) => a + f.laser, 0), sat = pk.filter(f => f.uvSat).map(f => f.id), al = M.alignmentState();
      return A('As a relative signal, mostly. In the peak fractions ' + pk[0].id + ' to ' + pk[pk.length - 1].id + ', ' + over + ' waveforms exceeded 90 % of the input range and the sensitivity changed ' + chg + ' times; clipped waveforms read low (see I2 cards). Discarded blocks: ' + disc + '. Laser flags: ' + las + '. Fraction assignment: ' + al.fractions + '. UV 280 is saturated in ' + (sat.length ? sat.join(', ') : 'none') + ', where fluorescence is the in-range signal. Fluorescence is not proportional to concentration at high absorbance (inner-filter effect) and gives no concentration without calibration.', 'Fraction table QC; rules I2, P1; glossary: Inner-filter effect');
    }
    if (/(follow|track|match|differ|same).*(uv|280)|(uv|280).*(follow|differ)/.test(q)) {
      const p1 = R ? R.rules.cards.find(c => c.rule === 'P1' && /Load/.test(c.phase)) : null, p2 = R ? R.rules.cards.find(c => c.rule === 'P2') : null;
      return A((p1 ? 'During the load, ' + p1.obs + ' ' : 'During the load UV 280 usually sits at its ceiling while fluorescence stays in range. ') + 'A flat UV trace carries no information. UV 280 responds to every absorber at 280 nm. Fluorescence comes mainly from tryptophan, and in the flowthrough it is mostly HCP and media.' + (p2 ? ' The late fluorescence rise is P2.' : '') + ' Fluorescence cannot tell mAb from HCP.', (p1 ? 'Card ' + p1.id : 'Rule P1') + '; glossary: Fluorescence');
    }
    if (/laser/.test(q) && /(ready|stable|warm|ok|step)/.test(q)) {
      const L = S.laser; return A(M.laserText() + ' Latest controller reading ' + fmt.sig3(L ? L.last : 0) + ' mW as logged at ' + fmt.min1(S.simT / 60) + ' min after emission started. A stable controller reading does not confirm stable UV output.', 'Laser controller log (Proposed); thresholds: fall ' + S.th.laserFallPct + ' %, hold ±' + S.th.laserHoldPct + ' % for ' + S.th.laserHoldMin + ' min');
    }
    if (/(v2|v 2|2\.0|reference).*(proposed)|(proposed).*(v2|2\.0|reference)|processing mode|difference between/.test(q)) {
      return A('v2.0 reference: mean of the first 100 samples (20 ns) as baseline, subtracted across the whole 119.8 ns window, no laser correction. Proposed processing: median baseline, an optional 30 to 70 ns window that reduces baseline leverage, and optional correction by the beam monitor. Proposed auto-ranging uses the block median waveform, a corrected no-signal test and an unscaled baseline. Current processing: ' + M.procLabel() + '. Use Compare on Run to overlay both.', 'Engineer view: Changes; setting: processing mode');
    }
    if (/(which|what).*(fraction).*(flag|qc|problem)|flags/.test(q)) {
      if (!R) return A('No run yet.', 'Run state');
      const st = M.fractionStats(R).filter(f => f.chg || f.over || f.disc || f.laser || f.lowShare > 0.5 || f.assign === 'Uncertain');
      if (!st.length) return A('No fraction has a QC flag so far.', 'Fraction table QC');
      const desc = st.slice(0, 10).map(f => f.id + ' (' + [f.over ? f.over + ' over 90 %' : '', f.chg ? f.chg + ' sensitivity change' + (f.chg > 1 ? 's' : '') : '', f.disc ? f.disc + ' discarded' : '', f.laser ? 'laser change' : '', f.lowShare > 0.5 ? 'low precision' : '', f.assign === 'Uncertain' ? 'assignment uncertain' : ''].filter(Boolean).join(', ') + ')');
      return A(st.length + ' fractions have flags: ' + desc.join('; ') + (st.length > 10 ? '; and ' + (st.length - 10) + ' more' : '') + '.', 'Fraction table QC (' + M.procLabel() + ')');
    }
    if (/hypothesis|evidence level|process observation|instrument evidence/.test(q)) return A(GLOSSARY['evidence level'][1] + ' A hypothesis card always names the offline confirmation, for example Protein A HPLC for H1. The software advises only; you decide.', 'Glossary: Evidence levels');
    if (/notebook|e-?workbook|idbs|record this|export|attach/.test(q)) return A('Open Record. Copy the six sections (purpose, methods, results, data quality, fraction decisions, attachments) into your E-WorkBook experiment, or use Copy all. Export the block data, fraction table, metadata and chromatogram, and attach them with the UNICORN report and the offline results. Direct transfer to IDBS is a future integration.', 'Procedure: Record');
    if (/\bv1\b|\bv2\b|delay volume|fraction delay|align/.test(q)) {
      const al = M.alignmentState(), s = S.setup;
      return A('V1 (UV to TRIFLE, ' + fmt.ml(s.V1) + ' mL) places TRIFLE signals on the UNICORN chromatogram by volume. V2 (TRIFLE to collector, ' + fmt.ml(s.V2) + ' mL) and the UNICORN fraction delay (' + fmt.ml(M.plumbing().fracDelay) + ' mL) decide which fraction the liquid reached. Alignment: ' + al.detector + '; fraction assignment: ' + al.fractions + '. ' + (al.issues.join(' ')), 'Engineer view: Alignment; rule I5');
    }
    if (/buffer baseline|pre-run baseline|noise|drift|wander/.test(q)) {
      const m = S.readiness && S.readiness.metrics; return A('The buffer baseline is measured at Readiness with flow on: noise is the RMS of fluorescence over 60 blocks, drift the slope over 5 min, wander the peak-to-peak of a 30-block moving mean.' + (m ? ' Measured: noise ' + fmt.sig3(m.noise) + ' V·ns, drift ' + fmt.sig3s(m.drift) + ' V·ns per min, wander ' + fmt.sig3(m.wander) + ' V·ns; pre-run baseline ' + fmt.sig3(m.median) + ' V·ns.' : ' It has not been measured yet.') + ' Rule P3 compares buffer phases with it.', 'Readiness: buffer baseline');
    }
    for (const k in GLOSSARY) { const words2 = k.split(' '); if (q.includes(k) || (words2.length === 1 && new RegExp('\\b' + k).test(q)) || (k === 'instrument response' && /\birf\b/.test(q)) || (k === 'inner-filter' && /inner.?filter/.test(q))) return A(GLOSSARY[k][0] + ': ' + GLOSSARY[k][1], 'Glossary: ' + GLOSSARY[k][0]); }
    if (/(what|how).*(happening|status|doing)|where are we/.test(q)) {
      if (!R) return A('No run yet. ' + M.readinessSummary().text, 'Run state');
      return A(R.id + ' is ' + R.state + (R.state === 'complete' ? '. Acquisition time ' + fmt.clock(R.endAt) : ' at ' + fmt.clock(M.runTimeS(R))) + ', sensitivity step ' + R.acq.cur + '. Open evidence cards: ' + R.rules.cards.filter(c => c.status === 'open').length + '.', 'Run state');
    }
    return A(OUT, 'Scope of the Questions panel');
  }
  function init() {
    const p = $('#qpanel');
    p.innerHTML = '<button class="q-tab" id="qOpen" aria-label="Open Questions panel">Questions</button><div class="q-body"><div class="q-head"><div class="row"><h2>Questions</h2><button class="btn sm" id="qCollapse" aria-label="Collapse Questions panel">Hide</button></div><div class="q-cap">Answers come from this run\'s data, the glossary and the rules.</div></div><div class="q-chips" id="qChips"></div><div class="q-log" id="qLog" aria-live="polite"></div><form class="q-form" id="qForm"><input type="text" id="qIn" placeholder="Ask about this run or the instrument" aria-label="Question"><button class="btn primary" type="submit">Ask</button></form></div>';
    $('#qCollapse').onclick = () => collapse(true); $('#qOpen').onclick = () => collapse(false);
    $('#qForm').onsubmit = e => { e.preventDefault(); const t = $('#qIn').value.trim(); if (t) { ask(t); $('#qIn').value = ''; } };
    chips();
    let last = null;
    setInterval(() => { const c = UI.cur(); if (c !== last) { last = c; chips(); } }, 300);
  }
  function chips() { const c = UI.cur() || 'setup', list = (CHIPS[c] || []).concat(window.Q_EXTRA_CHIPS && window.Q_EXTRA_CHIPS[c] ? window.Q_EXTRA_CHIPS[c] : []); $('#qChips').innerHTML = list.map(t => '<button class="chip" type="button">' + esc(t) + '</button>').join(''); $$('#qChips .chip').forEach(b => b.onclick = () => ask(b.textContent)); }
  function ask(t) {
    const log = $('#qLog'), r = answerQuestion(t, { run: S.run, screen: UI.cur(), S });
    log.append(el('<div class="q-msg q">' + esc(t) + '</div>'));
    log.append(el('<div class="q-msg a">' + esc(r.text) + '<div class="src">Source: ' + esc(r.source) + '</div></div>'));
    log.scrollTop = log.scrollHeight;
    M.audit('question', 'Question asked: "' + t + '". Source: ' + r.source + '.');
  }
  function collapse(v) { $('#qpanel').classList.toggle('collapsed', v); setTimeout(() => window.dispatchEvent(new Event('resize')), 0); }
  return { init, collapse, answerQuestion, addIntent, OUT };
})();
