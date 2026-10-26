module.exports = async (page, shot) => {
  await page.waitForTimeout(500);
  await page.click('#sTrained'); await page.click('#sIp');
  await page.click('#speedSeg button[data-v="60"]');
  await page.click('[data-go=readiness]');
  await page.waitForTimeout(30000);
  const pmt = await page.$('#pmtChk'); if (pmt) await pmt.click();
  await page.waitForTimeout(2000); await shot('10_ready');
  await page.click('[data-go=run]'); await page.waitForTimeout(300);
  await page.click('#rStart'); await page.waitForTimeout(4000);
  await page.click('#demoFF'); await page.waitForTimeout(9000); await shot('11_run_end');
  await page.click('.nav[data-go=fractions]'); await page.waitForTimeout(1500); await shot('12_fractions');
  await page.click('#frTbl tbody tr[data-id="FT09"]'); await page.waitForTimeout(800); await shot('13_fr_ft09');
  await page.click('.decb[data-id="FT09"]'); await page.waitForTimeout(300);
  await page.click('.popover input[data-a=proa]'); await page.mouse.click(5, 5); await page.waitForTimeout(300);
  await page.click('#frTabs button[data-v=samples]'); await page.waitForTimeout(400); await shot('14_samples');
  await page.click('[data-go=record]'); await page.waitForTimeout(1500); await shot('15_record');
  await page.click('#engSwitch'); await page.waitForTimeout(300);
  await page.click('.nav[data-go=engineer]'); await page.waitForTimeout(800); await shot('16_eng_tests');
  for (const t of ['align', 'ar', 'wf', 'ladder', 'laser', 'changes', 'th', 'disc', 'faults']) { await page.click('#engTabs button[data-v=' + t + ']'); await page.waitForTimeout(500); await shot('17_eng_' + t); }
  await page.click('#qOpen'); await page.waitForTimeout(300); await page.click('.chip >> nth=0'); await page.waitForTimeout(300);
  await page.click('[data-go=testing]'); await page.waitForTimeout(300); await shot('18_testing');
  await page.click('[data-go=run]'); await page.waitForTimeout(500);
  for (const q of ['Why did the sensitivity change at 42 min?', 'Is the column breaking through?', 'Can I trust the elution peak?', 'Why does fluorescence not follow the UV during the load?', 'Is the laser ready?', 'What is the difference between v2.0 and Proposed processing?', 'Which fractions have flags?', 'What does "Research hypothesis" mean?', 'How do I put this run into my notebook?', 'What is the weather tomorrow?']) { await page.fill('#qIn', q); await page.press('#qIn', 'Enter'); await page.waitForTimeout(100); }
  const txt = await page.$$eval('.q-msg', els => els.map(e => e.innerText));
  console.log(txt.join('\n---\n'));
  await shot('19_questions');
};
