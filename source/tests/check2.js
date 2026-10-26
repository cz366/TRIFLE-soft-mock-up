module.exports = async (page, shot) => {
  const out = [];
  await page.waitForTimeout(400);
  await page.click('#sTrained'); await page.click('#sIp');
  await page.click('#speedSeg button[data-v="60"]');
  await shot('40_setup');
  // fault: digitiser not found
  await page.click('#engSwitch'); await page.click('.nav[data-go=engineer]'); await page.click('#engTabs button[data-v=faults]');
  await page.click('input[name=fault][value=digitiser]');
  await page.click('[data-go=readiness]'); await page.waitForTimeout(3000); await shot('41_ready_digitiser');
  await page.click('[data-go=run]'); await page.waitForTimeout(300);
  out.push('start disabled with digitiser fault: ' + await page.$eval('#rStart', b => b.disabled));
  await page.click('.nav[data-go=engineer]'); await page.click('#engTabs button[data-v=faults]'); await page.click('input[name=fault][value=laser]');
  await page.click('[data-go=readiness]'); await page.click('#rdRun'); await page.waitForTimeout(3000); await shot('42_ready_laser');
  await page.click('#enEmit').catch(() => {}); await page.click('#rdRun'); await page.waitForTimeout(3000); await shot('43_ready_laser_check');
  await page.click('.nav[data-go=engineer]'); await page.click('#engTabs button[data-v=faults]'); await page.click('input[name=fault][value=none]');
  // preset mismatch
  await page.click('#engTabs button[data-v=ladder]'); await page.selectOption('#irfF', '800'); await page.waitForTimeout(300); await shot('44_mismatch');
  await page.click('[data-go=setup]'); await page.waitForTimeout(300); await shot('45_setup_mismatch');
  await page.click('#sPmt button[data-v="400"]');
  // standalone source
  await page.selectOption('#demoAkta', 'protA|standalone'); await page.waitForTimeout(300);
  await page.click('[data-go=readiness]'); await page.waitForTimeout(30000);
  const pmt = await page.$('#pmtChk'); if (pmt) await pmt.click(); await page.waitForTimeout(800);
  await shot('46_ready_ok');
  await page.click('[data-go=run]'); await page.waitForTimeout(300); await page.click('#rStart'); await page.waitForTimeout(3000); await page.click('#demoFF'); await page.waitForTimeout(9000); await shot('47_run_standalone');
  await page.click('.nav[data-go=fractions]'); await page.waitForTimeout(800); await shot('48_fr_standalone');
  out.push(await page.evaluate(() => M.S.run.rules.cards.map(c => c.id + ': ' + c.obs).join('\n')));
  console.log(out.join('\n'));
};
