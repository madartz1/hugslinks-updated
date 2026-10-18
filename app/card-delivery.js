'use strict';
(() => {
  const get = id => document.getElementById(id);
  let prepared = null;
  let revision = 0;
  const spanish = () => document.documentElement.lang === 'es';
  const say = (en, es) => { get('deliveryStatus').textContent = spanish() ? es : en; };
  function emailDraft(email, name, note, sender) {
    const greeting = name ? `Hi ${name},\n\n` : '';
    const signature = sender ? `\n\nWith love,\n${sender}` : '';
    const text = greeting + (note || 'I made this HUG just for you.') + '\n\nOpen the attached Your-HUGS-Card.html file in a web browser to see your card, photo, video, and music.' + signature;
    return 'mailto:' + encodeURIComponent(email) + '?subject=' + encodeURIComponent('A HUG Card for you') + '&body=' + encodeURIComponent(text);
  }
  function resetDelivery() {
    revision++;
    prepared = null;
    get('deliveryReady').hidden = true;
    get('emailDelivery').href = 'mailto:';
    say('Your changes will be included when you prepare the card again. Nothing has been sent.', 'Tus cambios se incluirán al preparar la tarjeta de nuevo. No se ha enviado nada.');
  }
  document.addEventListener('card:changed', resetDelivery);
  for (const id of ['deliveryName', 'deliveryEmail', 'deliveryNote']) get(id).addEventListener('input', resetDelivery);
  get('prepareDelivery').onclick = async () => {
    if (processing) { say('Wait for your uploads to finish.', 'Espera a que terminen de cargar tus archivos.'); return; }
    if (!get('deliveryEmail').reportValidity()) return;
    const currentRevision = revision;
    get('prepareDelivery').disabled = true;
    say('Preparing your card with its photos, video, and music…', 'Preparando tu tarjeta con sus fotos, video y música…');
    try {
      const snapshot = state();
      delete snapshot.fields.brief;
      const html = await cardHTML(snapshot);
      if (revision !== currentRevision) { say('Your card changed. Prepare it again to include the latest changes.', 'Tu tarjeta cambió. Prepárala de nuevo para incluir los cambios.'); return; }
      const file = new File([html], 'Your-HUGS-Card.html', { type: 'text/html' });
      const name = get('deliveryName').value.trim() || snapshot.fields.to.trim();
      const email = get('deliveryEmail').value.trim();
      const note = get('deliveryNote').value.trim();
      prepared = { file, text: note || 'I made this HUG just for you.', title: name ? `A HUG for ${name}` : 'A HUG Card for you' };
      get('emailDelivery').href = emailDraft(email, name, note, snapshot.fields.from.trim());
      const canShare = !!(navigator.share && navigator.canShare?.({ files: [file] }));
      get('shareDelivery').hidden = !canShare;
      get('shareHelp').textContent = canShare ? 'Choose Mail, Messages, or another compatible app in your device’s share menu. Select the recipient there before sending.' : 'File sharing is not supported in this browser. Download the card, then attach it to your email draft.';
      get('deliverySummary').textContent = `${prepared.title} · ${(file.size / (1024 * 1024)).toFixed(1)} MB · Photos, video, and music included when added.`;
      get('deliveryReady').hidden = false;
      say('Ready to send. Choose a sharing option below. Nothing has been sent yet.', 'Lista para enviar. Elige una opción abajo. Todavía no se ha enviado nada.');
    } catch {
      say('The card could not be prepared. Keep this page open and try again.', 'No se pudo preparar la tarjeta. Mantén esta página abierta e inténtalo de nuevo.');
    } finally { get('prepareDelivery').disabled = false; }
  };
  get('shareDelivery').onclick = async () => {
    if (!prepared) return;
    const send = prepared;
    get('shareDelivery').disabled = true;
    try {
      await navigator.share({ files: [send.file], title: send.title, text: send.text });
      say('Card handed to your chosen app. Finish sending there; delivery is not tracked here.', 'Tarjeta entregada a la app elegida. Termina el envío allí; aquí no se confirma la entrega.');
    } catch (error) {
      if (error.name === 'AbortError') say('Sharing canceled. Your prepared card is still ready.', 'Envío cancelado. Tu tarjeta preparada sigue lista.');
      else say('This app could not share the card file. Download it and attach it to an email instead.', 'Esta app no pudo compartir la tarjeta. Descárgala y adjúntala a un correo.');
    } finally { get('shareDelivery').disabled = false; }
  };
  get('downloadDelivery').onclick = () => {
    if (!prepared) return;
    download(prepared.file, prepared.file.name);
    say('Card downloaded. Attach Your-HUGS-Card.html to your email before sending.', 'Tarjeta descargada. Adjunta Your-HUGS-Card.html a tu correo antes de enviarlo.');
  };
  get('emailDelivery').addEventListener('click', event => {
    if (!prepared || !get('deliveryEmail').value.trim() || !get('deliveryEmail').reportValidity()) {
      event.preventDefault();
      say('Enter the recipient’s email, then prepare the card again to open an addressed draft.', 'Introduce el correo del destinatario y prepara la tarjeta de nuevo para abrir el borrador.');
      get('deliveryEmail').focus();
      return;
    }
    say('Opening your email app. Attach the downloaded card file and press Send there.', 'Abriendo tu app de correo. Adjunta la tarjeta descargada y pulsa Enviar allí.');
  });
})();
