module.exports = async (page, shot) => {
  const ev = f => page.evaluate(f);
  await page.waitForTimeout(800);
  console.log('hosted class:', await ev(() => document.body.classList.contains('hosted')), 'title:', await ev(() => document.title), 'body bg:', await ev(() => getComputedStyle(document.body).backgroundColor));
  await page.click('#sTrained'); await page.click('#sIp'); await page.click('#speedSeg button[data-v="60"]');
  await page.click('[data-go=readiness]'); await page.waitForTimeout(29000);
  const pmt = await page.$('#pmtChk'); if (pmt) await pmt.click(); await page.waitForTimeout(400);
  await page.click('[data-go=run]'); await page.waitForTimeout(300); await page.click('#rStart'); await page.waitForTimeout(2500);
  await page.click('#demoFF'); await page.waitForTimeout(9000);
  await page.click('[data-go=record]'); await page.waitForTimeout(800);
  console.log('pdf visible:', await ev(() => [...document.querySelectorAll('#recExports button')].filter(b => /PDF/.test(b.textContent)).map(b => b.offsetParent !== null).join(',')));
  const before = await ev(() => M.S.audit ? M.S.audit.filter(a => /Exported/.test(a.text || a.msg || JSON.stringify(a))).length : -1);
  // the scientist's exports; the Block data and Metadata files are in the Engineer view
  const shown = () => ev(() => [...document.querySelectorAll('#recExports button')].filter(b => b.offsetParent !== null).map(b => b.textContent).join(', '));
  console.log('scientist exports:', await shown());
  for (const t of ['Fraction table (CSV)', 'Chromatogram (PNG)', 'Block data (CSV)', 'Metadata (JSON)']) {
    if (t === 'Block data (CSV)') { await page.click('#engSwitch'); await page.waitForTimeout(300); console.log('engineer exports:', await shown()); }
    await page.click('#recExports button >> text=' + t); await page.waitForTimeout(700);
    console.log(t, '-> toast:', await ev(() => { const x = document.querySelector('#toast'); return x ? x.className + ' ' + x.textContent : 'none'; }));
  }
  console.log('saved:', await ev(() => JSON.stringify(window.__saved)));
  const after = await ev(() => M.S.audit ? M.S.audit.filter(a => /Exported/.test(a.text || a.msg || JSON.stringify(a))).length : -1);
  console.log('audit export entries before/after:', before, after);
  await page.click('#engSwitch'); await page.waitForTimeout(300);
  await page.click('#recCopyAll'); await page.waitForTimeout(300);
  console.log('copy all button:', await ev(() => document.querySelector('#recCopyAll').textContent));
  await shot('h_record');
};
