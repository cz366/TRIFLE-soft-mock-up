// High-resolution screenshots of the TRIFLE mock-up for review with colleagues.
// Usage: node render_hd.js <html> <outdir> [scale]
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/node22/lib/node_modules/playwright'); } })();
const path = require('path'), fs = require('fs');
const file = process.argv[2], out = process.argv[3], SCALE = +(process.argv[4] || 4);
fs.mkdirSync(out, { recursive: true });
const errs = [];

async function session(browser, W, H, fn) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE });
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await page.goto('file://' + file);
  await page.waitForTimeout(1000);
  // full-height capture for screens that scroll; viewport capture otherwise
  const shot = async (name, tall) => {
    await page.mouse.move(W - 2, H - 2);
    let h = H;
    if (tall) {
      h = await page.evaluate(() => { const s = document.querySelector('.screen.active'); if (!s) return 0; s.scrollTop = 0; return s.classList.contains('fixed') ? 0 : s.scrollHeight; });
      h = h + 72 > H ? Math.min(Math.floor(16000 / SCALE), h + 80) : H;
      if (h !== H) { await page.setViewportSize({ width: W, height: h }); await page.waitForTimeout(700); }
    }
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, name + '.png') });
    if (h !== H) { await page.setViewportSize({ width: W, height: H }); await page.waitForTimeout(400); }
    console.log('shot', name, W + 'x' + h, '@' + SCALE + 'x');
  };
  const vol = () => page.evaluate(() => { const R = M.S.run; return R && R.acq.n ? R.x.vol[R.acq.n - 1] : 0; });
  const until = (fnStr, ms) => page.waitForFunction('(' + fnStr + ')()', null, { timeout: ms || 600000, polling: 250 });
  await fn(page, shot, until, vol);
  await ctx.close();
}

async function toReady(page, until) {
  await page.click('#sTrained'); await page.click('#sIp');
  await page.click('#speedSeg button[data-v="60"]');
  await page.click('[data-go=readiness]');
}
async function confirmReady(page, until) {
  await until('() => M.S.laser && M.S.laser.state === "stable" && !!document.querySelector("#pmtChk")');
  await page.click('#pmtChk');
  await until('() => M.readinessSummary().state === "ready"');
  await page.waitForTimeout(600);
}

(async () => {
  const browser = await chromium.launch({ args: ['--disable-background-networking', '--disable-component-update', '--no-first-run'] });

  // Desktop, 1440 x 900
  if (!process.env.PHONE_ONLY) await session(browser, 1440, 900, async (page, shot, until, vol) => {
    await page.click('#sTrained'); await page.click('#sIp'); await page.waitForTimeout(300);
    await shot('01_setup');
    await page.click('#speedSeg button[data-v="60"]');
    await page.click('[data-go=readiness]'); await page.waitForTimeout(5000);
    await shot('02_readiness_laser_warming_up');
    await confirmReady(page, until);
    await shot('03_readiness_ready_to_start');
    await page.click('[data-go=run]'); await page.waitForTimeout(500);
    await page.click('#rStart');
    await until('() => { const R = M.S.run; return R && R.state === "acquiring" && TR.pumpVolAt(R.ph, Math.max(0, M.aktaMin(R, M.runTimeS(R)))) > 46; }');
    await shot('04_run_acquiring_load');
    await until('() => { const R = M.S.run; return R && R.state === "acquiring" && TR.pumpVolAt(R.ph, Math.max(0, M.aktaMin(R, M.runTimeS(R)))) > 100.6; }');
    await shot('05_run_elution_evidence_cards');
    await page.click('#rView'); await page.waitForTimeout(400);
    await shot('06_run_view_menu');
    await page.keyboard.press('Escape'); await page.mouse.click(700, 40); await page.waitForTimeout(300);
    await page.click('#demoFF');
    await until('() => M.S.run && M.S.run.state === "complete" && !UI.isFF()');
    await page.waitForTimeout(1500);
    await shot('07_run_complete');
    await until('() => LTM.state(M.S.run) === "final"', 60000); await page.waitForTimeout(800);
    await shot('07b_run_species_final');
    await page.click('#rExp'); await page.waitForTimeout(800);
    await shot('08_run_chart_expanded');
    await page.click('#rExp'); await page.waitForTimeout(500);
    { // zoom into the elution and pin the decay in the tail
      const box = await page.$eval('#runChart .ch-over', c => { const r = c.getBoundingClientRect(); return { x: r.left, y: r.top }; });
      const xs = await page.evaluate(() => { const ch = UI.screen('run').chart(), el = M.S.run.ph.list.find(p => p.key === 'el'); return [ch.xToPx(el.t0 + 1.5), ch.xToPx(el.t0 + 9), ch.xToPx(el.t0 + 7)]; });
      await page.mouse.move(box.x + xs[0], box.y + 120); await page.mouse.down(); await page.mouse.move(box.x + xs[1], box.y + 120, { steps: 5 }); await page.mouse.up(); await page.waitForTimeout(600);
      await page.mouse.click(box.x + xs[2], box.y + 200); await page.click('#rPLog button[data-v="1"]'); await page.waitForTimeout(600);
      await shot('08b_run_elution_decay_pinned');
      await page.click('#rPLog button[data-v="0"]'); await page.click('#decLatest'); await page.click('#rReset'); await page.waitForTimeout(300);
      const viewOpt = async id => { await page.click('#rView'); await page.click(id); await page.mouse.click(700, 40); await page.waitForTimeout(400); };
      await viewOpt('#rAk'); await viewOpt('#rMap'); await shot('08c_run_akta_traces_and_decay_map'); await viewOpt('#rAk'); await viewOpt('#rMap');
    }

    await page.click('.nav[data-go=fractions]'); await page.waitForTimeout(1500);
    await page.click('#frTbl tbody tr[data-id="FT09"]'); await page.waitForTimeout(800);
    await shot('09_fraction_review_load_FT09');
    await page.click('#frTbl tbody tr[data-id="E05"]'); await page.waitForTimeout(800);
    await shot('10_fraction_review_elution_E05');
    await page.click('.decb[data-id="FT09"]'); await page.waitForTimeout(400);
    await shot('11_fraction_decision');
    await page.click('.popover input[data-a=proa]'); await page.mouse.click(5, 5); await page.waitForTimeout(400);
    await page.click('#frTabs button[data-v=samples]'); await page.waitForTimeout(500);
    await shot('12_samples_to_send');
    await page.click('#frTabs button[data-v=frac]'); await page.waitForTimeout(300);

    await page.click('[data-go=record]'); await page.waitForTimeout(1500);
    await shot('13_record_full_page', true);
    await page.click('[data-go=comparison]'); await page.waitForTimeout(9000);
    await shot('16_run_comparison', true);
    await page.click('#hMock'); await page.waitForTimeout(500);
    await shot('17_about_this_mock_up', true);

    await page.click('[data-go=run]'); await page.waitForTimeout(600);
    await page.click('#qOpen'); await page.waitForTimeout(300);
    await page.fill('#qIn', 'Can I trust the elution peak?'); await page.press('#qIn', 'Enter'); await page.waitForTimeout(600);
    await shot('18_questions_panel');
    await page.click('#qCollapse'); await page.waitForTimeout(300);

    // Engineer view: the HDF5 estimate, Calibration, the run with the pulse and the Engineer tabs
    await page.click('#engSwitch'); await page.waitForTimeout(400);
    await page.click('[data-go=record]'); await page.waitForTimeout(1200);
    await page.click('text=Raw waveforms (HDF5)…'); await page.waitForTimeout(400);
    await shot('14_record_hdf5_estimate');
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    await page.click('[data-go=calibration]'); await page.waitForTimeout(1500);
    await shot('15_calibration', true);
    await page.click('[data-go=run]'); await page.waitForTimeout(1200);
    await shot('19_engineer_run_with_pulse');
    await page.click('.nav[data-go=engineer]'); await page.waitForTimeout(800);
    const tabs = [['tests', '20_engineer_reference_tests'], ['align', '21_engineer_alignment'], ['ar', '22_engineer_auto_range'], ['wf', '23_engineer_waveforms'], ['th', '24_engineer_rules'], ['disc', '25_engineer_discrepancies'], ['lt', '26_engineer_lifetimes']];
    for (const [k, name] of tabs) {
      const b = await page.$('#engTabs button[data-v=' + k + ']'); if (!b) { console.log('no tab', k); continue; }
      await b.click(); await page.waitForTimeout(900); await shot(name, true);
    }
  });

  // Phone, 400 x 860
  await session(browser, 400, 860, async (page, shot, until) => {
    await shot('30_phone_setup');
    await page.click('#mMenu'); await page.waitForTimeout(400);
    await shot('31_phone_menu');
    await page.click('.nav[data-go=setup]'); await page.waitForTimeout(300);
    await page.click('#sTrained'); await page.click('#sIp');
    await page.click('#mMenu'); await page.waitForTimeout(300); await page.click('#speedSeg button[data-v="60"]'); await page.keyboard.press('Escape');
    await page.evaluate(() => UI.go('readiness')); await page.waitForTimeout(500);
    await confirmReady(page, until);
    await page.evaluate(() => UI.go('run')); await page.waitForTimeout(500);
    await page.click('#rStart');
    await until('() => { const R = M.S.run; return R && R.state === "acquiring" && TR.pumpVolAt(R.ph, Math.max(0, M.aktaMin(R, M.runTimeS(R)))) > 100.6; }');
    await page.click('#mMenu'); await page.waitForTimeout(300); await page.click('#demoFF'); await page.keyboard.press('Escape');
    await until('() => M.S.run && M.S.run.state === "complete" && !UI.isFF()');
    await page.waitForTimeout(1200);
    await page.keyboard.press('Escape');
    await page.evaluate(() => UI.go('run')); await page.waitForTimeout(1200);
    await shot('32_phone_run');
    await page.evaluate(() => UI.go('fractions')); await page.waitForTimeout(1500);
    await shot('33_phone_fraction_review');
    await page.evaluate(() => UI.go('record')); await page.waitForTimeout(1200);
    await shot('34_phone_record');
  });

  await browser.close();
  console.log(errs.length ? errs.join('\n') : 'no console errors');
})();
