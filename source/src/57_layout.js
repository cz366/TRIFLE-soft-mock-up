/* ---------- narrow screens: navigation drawer and full-screen Questions ---------- */
(function () {
  const { $, el } = UI;
  const hdr = $('#hdr');
  const menu = el('<button class="btn sm m-only" id="mMenu" aria-label="Open navigation" aria-expanded="false">Menu</button>');
  const qb = el('<button class="btn sm m-only" id="mQ">Questions</button>');
  const back = el('<div class="m-backdrop" id="mBack"></div>');
  hdr.prepend(menu); $('.h-right', hdr).append(qb); document.body.append(back);
  function setNav(open) { document.body.classList.toggle('nav-open', open); menu.setAttribute('aria-expanded', String(open)); }
  menu.onclick = () => setNav(!document.body.classList.contains('nav-open'));
  back.onclick = () => setNav(false);
  $('#rail').addEventListener('click', e => { if (e.target.closest('.nav')) setNav(false); });
  qb.onclick = () => { setNav(false); Q.collapse(false); };
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setNav(false); });
})();
