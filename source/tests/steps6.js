module.exports = async (page, shot) => {
  await page.waitForTimeout(800);
  await page.click('#sTrained'); await page.click('#sIp'); await page.click('#speedSeg button[data-v="60"]');
  await page.click('[data-go=readiness]'); await page.waitForTimeout(29000);
  const pmt = await page.$('#pmtChk'); if (pmt) await pmt.click(); await page.waitForTimeout(500);
  await page.click('[data-go=run]'); await page.waitForTimeout(300); await page.click('#rStart'); await page.waitForTimeout(800);
  await page.click('#demoFF'); await page.waitForTimeout(9000);
  await page.click('#engSwitch'); await page.click('#rTools .btn.sm >> text=Processing'); await page.click('.popover input[data-k=decay]'); await page.mouse.click(700, 40); await page.click('#engSwitch'); await page.waitForTimeout(1500);
  await page.click('#qOpen');
  for (const q of ['What concentration is shown?', 'What is the decay metric?', 'Are the capsids full or empty?', 'How are runs compared?', 'Can I trust the elution peak?']) { await page.fill('#qIn', q); await page.press('#qIn', 'Enter'); await page.waitForTimeout(100); }
  console.log((await page.$$eval('.q-msg', els => els.map(e => e.innerText))).join('\n---\n'));
  await page.click('[data-go=record]'); await page.waitForTimeout(2500);
  await page.emulateMedia({ media: 'print' }); await page.pdf({ path: 'shots/record.pdf', format: 'A4', printBackground: true });
  await page.emulateMedia({ media: 'screen' });
};
