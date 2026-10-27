// Stage 1 self-check: layout, demo controls, Proposed processing, alternate sources.
module.exports = async (page, shot) => {
  const out = [];
  const measure = async (tag) => {
    const m = await page.evaluate(() => {
      const w = document.getElementById('work').getBoundingClientRect(), c = document.querySelector('#scr-run .run-chart').getBoundingClientRect(), s = document.getElementById('scr-run');
      return { work: w.height, chart: c.height, ratio: c.height / w.height, scroll: s.scrollHeight - s.clientHeight, docScroll: document.documentElement.scrollHeight - innerHeight, font: getComputedStyle(document.body).fontFamily };
    });
    out.push(tag + ' ' + JSON.stringify(m));
  };
  await page.waitForTimeout(400);
  await page.click('#engSwitch'); await page.click('#sTrained'); await page.click('#sIp'); await page.click('#sBm');
  await page.click('#speedSeg button[data-v="60"]');
  await page.click('#demoEarly');
  await page.click('[data-go=readiness]'); await page.waitForTimeout(9000);
  const pmt = await page.$('#pmtChk'); if (pmt) await pmt.click();
  await page.waitForTimeout(500); await shot('30_ready_early');
  await page.click('[data-go=run]'); await page.waitForTimeout(300);
  await page.click('#rStart'); await page.waitForTimeout(6000);
  await page.click('#rNote'); await page.fill('#ntText', 'Sample bag 2 connected'); await page.click('.popover .btn.primary');
  await page.click('#rPause'); await page.waitForTimeout(2500); await page.click('#rCont');
  await page.click('#demoDelay'); await page.waitForTimeout(500);
  await measure('1440x900 run'); await shot('31_run_early');
  await page.click('#demoFF'); await page.waitForTimeout(10000);
  // Proposed processing with compare and laser correction
  await page.click('#rTools .btn.sm >> text=Processing');
  for (const k of ['median', 'window', 'laser', 'compare']) await page.click('.popover input[data-k=' + k + ']');
  await page.mouse.click(700, 40); await page.waitForTimeout(800); await shot('32_run_proposed');
  await page.click('#rLog button[data-v="1"]'); await page.click('#rX button[data-v=min]'); await page.waitForTimeout(800); await shot('33_run_log_min');
  await page.click('#rX button[data-v=vol]'); await page.click('#rLog button[data-v="0"]');
  await page.click('#rView'); await page.click('#rRul'); await page.mouse.click(700, 40); await page.click('#rExp'); await page.waitForTimeout(800); await shot('34_expanded');
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  // Evidence tab on narrow
  await page.click('.nav[data-go=fractions]'); await page.waitForTimeout(1500); await shot('35_fr_uncertain');
  await page.setViewportSize({ width: 1280, height: 800 }); await page.click('[data-go=run]'); await page.waitForTimeout(1200);
  await measure('1280x800 run'); await shot('36_run_1280');
  await page.click('.nav[data-go=fractions]'); await page.waitForTimeout(1200); await shot('37_fr_1280');
  const cards = await page.evaluate(() => M.S.run.rules.cards.map(c => c.id + ': ' + c.obs).join('\n'));
  out.push(cards);
  console.log(out.join('\n'));
};
