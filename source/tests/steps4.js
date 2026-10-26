module.exports = async (page, shot) => {
  await page.waitForTimeout(800);
  await page.click('#sTrained'); await page.click('#sIp'); await page.click('#speedSeg button[data-v="60"]');
  await page.click('[data-go=calibration]'); await page.waitForTimeout(1500); await shot('60_calibration');
  await page.click('[data-go=readiness]'); await page.waitForTimeout(29000);
  const pmt = await page.$('#pmtChk'); if (pmt) await pmt.click(); await page.waitForTimeout(500);
  await page.click('[data-go=run]'); await page.waitForTimeout(300); await page.click('#rStart'); await page.waitForTimeout(1000);
  await page.click('#engSwitch'); await page.click('#rTools .btn.sm >> text=Processing'); await page.click('.popover input[data-k=decay]'); await page.mouse.click(700, 40); await page.click('#engSwitch');
  await page.click('#demoFF'); await page.waitForTimeout(10000); await shot('61_run_decay');
  await page.click('.nav[data-go=fractions]'); await page.waitForTimeout(1500); await shot('62_fractions_s2');
  await page.click('[data-go=comparison]'); await page.waitForTimeout(9000); await shot('63_comparison');
  await page.click('#hMock'); await page.waitForTimeout(300); await shot('64_integrations');
  await page.click('[data-go=record]'); await page.waitForTimeout(1000); await page.click('text=Raw waveforms (HDF5)…'); await page.waitForTimeout(300); await shot('65_hdf5'); await page.keyboard.press('Escape');
  await page.click('#engSwitch'); await page.click('.nav[data-go=engineer]'); await page.click('#engTabs button[data-v=fit]'); await page.waitForTimeout(800); await shot('66_fit');
  await page.evaluate(() => document.querySelector('#engBody > div:last-child').scrollIntoView()); await page.waitForTimeout(300); await shot('67_defs');
  await page.click('[data-go=calibration]'); await page.waitForTimeout(800); await shot('68_calibration_after');
  console.log(await page.evaluate(() => M.S.run.rules.cards.filter(c => /P6|P7|H3|I7/.test(c.rule)).map(c => c.id + ': ' + c.obs).join('\n')));
};
