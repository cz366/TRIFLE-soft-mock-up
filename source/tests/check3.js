module.exports = async (page, shot) => {
  const out = [];
  const measure = async (tag) => out.push(tag + ' ' + JSON.stringify(await page.evaluate(() => { const w = document.getElementById('work').getBoundingClientRect(), c = document.querySelector('#scr-run .run-chart').getBoundingClientRect(), s = document.getElementById('scr-run'); return { ratio: +(c.height / w.height).toFixed(3), scroll: s.scrollHeight - s.clientHeight }; })));
  await page.waitForTimeout(400);
  await page.click('#sTrained'); await page.click('#sIp');
  await page.click('input[name=ar][value=prop]'); await page.selectOption('#demoAkta', 'protA|manual');
  await page.click('#speedSeg button[data-v="60"]');
  await page.click('[data-go=readiness]'); await page.waitForTimeout(30000);
  const pmt = await page.$('#pmtChk'); if (pmt) await pmt.click(); await page.waitForTimeout(600);
  await page.click('[data-go=run]'); await page.waitForTimeout(300); await page.click('#rStart'); await page.waitForTimeout(2000);
  await measure('1440 run');
  await page.click('#demoFF'); await page.waitForTimeout(9000); await shot('50_run_manual_prop');
  await page.setViewportSize({ width: 1280, height: 800 }); await page.waitForTimeout(800); await measure('1280 run'); await shot('51_run_1280');
  await page.click('.nav[data-go=fractions]'); await page.waitForTimeout(1200); await shot('52_fr_1280');
  await page.click('[data-go=setup]'); await page.waitForTimeout(500); await shot('53_setup_locked');
  out.push(await page.evaluate(() => M.S.run.rules.cards.map(c => c.id + ': ' + c.obs).join('\n')));
  out.push('changes ' + await page.evaluate(() => M.S.run.acq.changes.length));
  console.log(out.join('\n'));
};
