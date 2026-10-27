// Full screenshot tour for review. Tall shots for scrollable screens.
module.exports = async (page, shot0) => {
  const dir = process.env.TOUR || 'tour';
  const W = 1440, H = 900;
  async function tall(name) {
    const h = await page.evaluate(() => { const s = document.querySelector('.screen.active'); if (s) s.scrollTop = 0; return s ? s.scrollHeight : 900; });
    const fixed = await page.evaluate(() => { const s = document.querySelector('.screen.active'); return !!(s && s.classList.contains('fixed')); });
    if (!fixed && h + 72 > H) { await page.setViewportSize({ width: W, height: Math.min(6000, h + 80) }); await page.waitForTimeout(400); }
    await page.screenshot({ path: dir + '/' + name + '.png' });
    await page.setViewportSize({ width: W, height: H }); await page.waitForTimeout(200);
  }
  await page.waitForTimeout(800); await tall('01_setup_signin');
  await page.click('#sTrained'); await page.click('#sIp'); await page.waitForTimeout(300); await tall('02_setup');
  await page.click('#speedSeg button[data-v="60"]');
  await page.click('[data-go=readiness]'); await page.waitForTimeout(2500); await tall('03_readiness_warmup');
  await page.waitForTimeout(27000);
  const pmt = await page.$('#pmtChk'); if (pmt) await pmt.click(); await page.waitForTimeout(800); await tall('04_readiness_done');
  await page.click('[data-go=run]'); await page.waitForTimeout(400); await tall('05_run_before_start');
  await page.click('#rStart'); await page.waitForTimeout(12000); await tall('06_run_mid');
  await page.click('#rView'); await page.waitForTimeout(300); await page.screenshot({ path: dir + '/07_run_view_menu.png' }); await page.mouse.click(700, 40);
  await page.click('#demoFF'); await page.waitForTimeout(10000); await tall('08_run_end');
  await page.click('.nav[data-go=fractions]'); await page.waitForTimeout(1500); await tall('09_fractions');
  await page.click('#frTbl tbody tr[data-id="FT09"]'); await page.waitForTimeout(800); await tall('10_fractions_ft09');
  await page.click('.decb[data-id="FT09"]'); await page.waitForTimeout(300); await page.screenshot({ path: dir + '/11_decision_popover.png' });
  await page.click('.popover input[data-a=proa]'); await page.mouse.click(5, 5); await page.waitForTimeout(300);
  await page.click('#frTabs button[data-v=samples]'); await page.waitForTimeout(400); await tall('12_samples');
  await page.click('#engSwitch'); await page.click('[data-go=calibration]'); await page.waitForTimeout(1500); await tall('13_calibration'); await page.click('#engSwitch');
  await page.click('[data-go=comparison]'); await page.waitForTimeout(9000); await tall('14_comparison');
  await page.click('#hMock'); await page.waitForTimeout(400); await tall('15_about');
  await page.click('[data-go=record]'); await page.waitForTimeout(1200); await tall('16_record');
  await page.click('#engSwitch'); await page.click('text=Raw waveforms (HDF5)…'); await page.waitForTimeout(300); await page.screenshot({ path: dir + '/17_hdf5_modal.png' }); await page.keyboard.press('Escape'); await page.click('#engSwitch');
  await page.click('#qOpen'); await page.waitForTimeout(300);
  await page.fill('#qIn', 'Can I trust the elution peak?'); await page.press('#qIn', 'Enter'); await page.waitForTimeout(300);
  await page.click('[data-go=run]'); await page.waitForTimeout(600); await page.screenshot({ path: dir + '/19_run_with_questions.png' });
  await page.click('#qCollapse'); await page.waitForTimeout(300);
  await page.click('#engSwitch'); await page.waitForTimeout(300);
  await page.click('.nav[data-go=engineer]'); await page.waitForTimeout(800);
  const tabs = await page.$$eval('#engTabs button', b => b.map(x => x.dataset.v));
  let i = 20;
  for (const t of tabs) { await page.click('#engTabs button[data-v=' + t + ']'); await page.waitForTimeout(600); await tall((i++) + '_eng_' + t); }
  await page.click('[data-go=run]'); await page.waitForTimeout(600); await page.screenshot({ path: dir + '/' + (i++) + '_run_engineer_view.png' });
  await page.click('[data-go=fractions]'); await page.waitForTimeout(800); await page.screenshot({ path: dir + '/' + (i++) + '_fractions_engineer_view.png' });
};
