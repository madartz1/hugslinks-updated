(() => {
  const make = (tag, text) => Object.assign(document.createElement(tag), {textContent:text});
  const link = (label, href) => Object.assign(make('a', label), {href});
  const spanish = () => document.documentElement.lang.toLowerCase().startsWith('es');
  const labels = (en, es) => spanish() ? es : en;
  const panel = make('dialog', '');
  panel.className = 'hugs-exit';
  const heading = make('h2', '');
  heading.id = 'hugs-exit-heading';
  panel.setAttribute('aria-labelledby', heading.id);
  const host = make('p', '');
  const stay = make('button', '');
  stay.type = 'button';
  const proceed = link('', '#');
  panel.append(heading, host, stay, proceed);
  document.body.append(panel);
  let original;
  stay.addEventListener('click', () => panel.close());
  proceed.addEventListener('click', () => panel.close());
  panel.addEventListener('close', () => original?.focus());
  function warn(event) {
    const anchor = event.target.closest?.('a[href]');
    if (!anchor || anchor === proceed || event.defaultPrevented ||
        (event.type === 'auxclick' && event.button !== 1)) return;
    let url;
    try { url = new URL(anchor.href, location.href); } catch { return; }
    if (!['http:', 'https:'].includes(url.protocol) ||
        [location.origin, 'https://hugslinks.com', 'https://www.hugslinks.com'].includes(url.origin)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    original = anchor;
    heading.textContent = labels('You’re leaving HUGSLinks', 'Estás saliendo de HUGSLinks');
    host.textContent = labels('Destination: ', 'Destino: ') + url.hostname;
    stay.textContent = labels('Stay here', 'Quedarme aquí');
    proceed.textContent = labels('Continue to site', 'Continuar al sitio');
    proceed.href = url.href;
    proceed.target = anchor.target === '_blank' || event.ctrlKey || event.metaKey || event.shiftKey || event.button === 1 ? '_blank' : '_self';
    proceed.rel = 'noopener noreferrer';
    panel.showModal();
    stay.focus();
  }
  document.addEventListener('click', warn, true);
  document.addEventListener('auxclick', warn, true);

  if (!/^\/(?:index\.html|find-food(?:\.html)?|resources(?:\.html)?|nyc-updates(?:\.html)?)?\/?$/.test(location.pathname)) return;
  if (Date.now() >= Date.parse('2026-11-27T00:00:00-05:00')) return;
  try { if (sessionStorage.getItem('hugs-thanksgiving-2026-dismissed')) return; } catch {}
  const banner = make('aside', '');
  banner.className = 'hugs-help-banner';
  banner.setAttribute('aria-label', 'NYC Thanksgiving community notice');
  const row = make('div', '');
  row.className = 'hugs-help-roll';
  const caption = link(labels('Free NYC Thanksgiving meals • Winter coat pickups • Dates, locations and sign-up', 'Comidas gratis de Acción de Gracias • Abrigos de invierno • Horarios y lugares'), '/thanksgiving-help.html');
  row.append(caption);
  const pause = make('button', '');
  const close = make('button', '×');
  close.setAttribute('aria-label', 'Dismiss community notice');
  const setPause = () => {
    const paused = banner.classList.contains('paused');
    pause.textContent = paused ? 'Play' : 'Pause';
    pause.setAttribute('aria-label', paused ? 'Play scrolling notice' : 'Pause scrolling notice');
  };
  setPause();
  pause.addEventListener('click', () => { banner.classList.toggle('paused'); setPause(); });
  close.addEventListener('click', () => {
    try { sessionStorage.setItem('hugs-thanksgiving-2026-dismissed', '1'); } catch {}
    banner.remove();
  });
  banner.append(row, link(labels('View help', 'Ver ayuda'), '/thanksgiving-help.html'), pause, close);
  document.body.prepend(banner);
})();
