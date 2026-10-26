module.exports = async (page, shot) => {
  await page.waitForTimeout(800);
  await page.click('#sTrained'); await page.click('#sIp'); await page.click('#speedSeg button[data-v="60"]');
  await page.click('[data-go=readiness]'); await page.waitForTimeout(29000);
  const pmt = await page.$('#pmtChk'); if (pmt) await pmt.click(); await page.waitForTimeout(500);
  await page.click('[data-go=run]'); await page.waitForTimeout(300); await page.click('#rStart'); await page.waitForTimeout(8000);
  await page.click('#engSwitch'); await page.click('.nav[data-go=engineer]'); await page.click('#engTabs button[data-v=faults]'); await page.waitForTimeout(300);
  await page.click('#repro'); await page.waitForTimeout(1500);
  console.log(await page.$eval('#reproOut', e => e.innerText));
  await page.click('#demoFF'); await page.waitForTimeout(9000);
  const ck = await page.evaluate(() => TR.fnv([M.S.run.acq.F[0], M.S.run.acq.F[3]], M.S.run.acq.n) + ' ' + M.S.run.acq.n);
  console.log('final checksum', ck);
  await page.click('#engTabs button[data-v=tests]'); await page.waitForTimeout(300);
  console.log(await page.$eval('#engTestSum', e => e.innerText));
};
