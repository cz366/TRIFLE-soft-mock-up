module.exports = async (page, shot) => {
  const dir = process.env.TOUR || 'narrow';
  const ov = async () => page.evaluate(() => ({ docW: document.documentElement.scrollWidth, vw: innerWidth, bodyW: document.body.scrollWidth, wide: [...document.querySelectorAll('.screen.active *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 1 && !e.closest('.tbl-wrap,.pb,.h-conn,#status,canvas') ; }).slice(0, 6).map(e => e.tagName + '.' + e.className + '#' + e.id + ' r=' + Math.round(e.getBoundingClientRect().right)) }));
  await page.waitForTimeout(800); await page.screenshot({ path: dir + '/n01_setup.png' }); console.log('setup', JSON.stringify(await ov()));
  await page.click('#mMenu'); await page.waitForTimeout(300); await page.screenshot({ path: dir + '/n02_menu.png' });
  await page.click('#speedSeg button[data-v="60"]'); await page.keyboard.press('Escape');
  await page.evaluate(() => { document.querySelector('#sTrained').click(); document.querySelector('#sIp').click(); });
  await page.click('#mMenu'); await page.click('.nav[data-go=readiness]'); await page.waitForTimeout(29000);
  const pmt = await page.$('#pmtChk'); if (pmt) await pmt.click(); await page.waitForTimeout(500);
  await page.screenshot({ path: dir + '/n03_ready.png' }); console.log('ready', JSON.stringify(await ov()));
  await page.click('#mMenu'); await page.click('.nav[data-go=run]'); await page.waitForTimeout(400);
  await page.click('#rStart'); await page.waitForTimeout(3000);
  await page.evaluate(() => document.querySelector('#demoFF').click()); await page.waitForTimeout(10000);
  await page.screenshot({ path: dir + '/n04_run.png' }); console.log('run', JSON.stringify(await ov()));
  await page.evaluate(() => { const s = document.querySelector('.screen.active'); s.scrollTop = 900; }); await page.waitForTimeout(300); await page.screenshot({ path: dir + '/n05_run_scrolled.png' });
  for (const k of ['fractions', 'record', 'calibration', 'comparison']) {
    // Calibration is in the Engineer view
    if (k === 'calibration') { await page.click('#mMenu'); await page.click('#engSwitch'); await page.keyboard.press('Escape'); }
    if (k === 'comparison') { await page.click('#mMenu'); await page.click('#engSwitch'); await page.keyboard.press('Escape'); }
    await page.click('#mMenu'); await page.click('.nav[data-go=' + k + ']'); await page.waitForTimeout(k === 'comparison' ? 8000 : 1200);
    await page.screenshot({ path: dir + '/n_' + k + '.png' }); console.log(k, JSON.stringify(await ov()));
  }
  await page.click('#mQ'); await page.waitForTimeout(300); await page.screenshot({ path: dir + '/n_questions.png' });
};
