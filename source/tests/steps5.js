module.exports = async (page, shot) => {
  await page.waitForTimeout(800);
  await page.click('#sTrained'); await page.click('#sIp'); await page.click('#speedSeg button[data-v="60"]');
  await page.selectOption('#demoAkta', 'aav|import'); await page.waitForTimeout(400); await shot('70_setup_aav');
  await page.click('[data-go=readiness]'); await page.waitForTimeout(29000);
  const pmt = await page.$('#pmtChk'); if (pmt) await pmt.click(); await page.waitForTimeout(500);
  await page.click('[data-go=run]'); await page.waitForTimeout(300); await page.click('#rStart'); await page.waitForTimeout(1000);
  await page.click('#demoFF'); await page.waitForTimeout(6000); await shot('71_run_aav');
  await page.click('.nav[data-go=fractions]'); await page.waitForTimeout(1500); await shot('72_fr_aav');
  await page.click('[data-go=comparison]'); await page.waitForTimeout(12000); await shot('73_cmp_aav');
  await page.click('#engSwitch'); await page.click('[data-go=run]'); await page.click('#rTools .btn.sm >> text=Processing'); await page.click('.popover input[data-k=median]'); await page.mouse.click(700, 40); await page.waitForTimeout(600);
  await page.click('[data-go=calibration]'); await page.waitForTimeout(1000); await shot('74_cal_notapplicable');
  console.log(await page.evaluate(() => M.S.run.rules.cards.map(c => c.id + ': ' + c.obs).join('\n')));
  await page.click('.nav[data-go=engineer]'); await page.click('#engTabs button[data-v=fit]'); await page.waitForTimeout(800); await shot('75_fit_aav');
};
