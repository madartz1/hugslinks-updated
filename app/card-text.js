'use strict';
window.hugsCardTextUrl = (phone, url, note) => {
 const separator = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? '&' : '?';
 return 'sms:' + phone + separator + 'body=' + encodeURIComponent(
  (note || 'A HUGS Card for you 💙') + '\n' + url
 );
};
