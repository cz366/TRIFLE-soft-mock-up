module.exports = async (page, shot) => {
  await page.waitForTimeout(500);
  await page.click('#sTrained'); await page.click('#sIp');
  await page.click('#speedSeg button[data-v="60"]');
  await page.click('[data-go=readiness]');
  await page.waitForTimeout(30000);
  const pmt = await page.$('#pmtChk'); if (pmt) await pmt.click();
  await page.waitForTimeout(1500);
  await page.click('[data-go=run]'); await page.waitForTimeout(300);
  await page.click('#rStart'); await page.waitForTimeout(2000);
  await page.click('#demoFF'); await page.waitForTimeout(9000); await shot('21_run_end');
  await page.click('.nav[data-go=fractions]'); await page.waitForTimeout(1500); await shot('22_fractions');
  await page.click('#engSwitch'); await page.click('.nav[data-go=engineer]'); await page.click('#engTabs button[data-v=align]'); await page.waitForTimeout(600); await shot('23_align');
  await page.click('#alBA button[data-v="0"]'); await page.waitForTimeout(600); await shot('24_align_after');
};
