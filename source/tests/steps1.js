module.exports = async (page, shot) => {
  await page.waitForTimeout(800); await shot('01_setup');
  await page.click('#sTrained'); await page.click('#sIp');
  await page.click('[data-go=readiness]'); await page.click('#speedSeg button[data-v="60"]');
  await page.waitForTimeout(3000); await shot('02_ready_early');
  await page.waitForTimeout(25000); 
  const pmt = await page.$('#pmtChk'); if (pmt) await pmt.click();
  await page.waitForTimeout(3000); await shot('03_ready_done');
  await page.click('[data-go=run]'); await page.waitForTimeout(500);
  await page.click('#rStart'); await page.waitForTimeout(15000); await shot('04_run_15s');
  await page.click('#demoFF'); await page.waitForTimeout(8000); await shot('05_run_end');
};
