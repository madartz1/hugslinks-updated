document.querySelectorAll('.menu').forEach(btn=>btn.addEventListener('click',()=>document.querySelector('.navlinks').classList.toggle('open')));
const path=location.pathname.split('/').pop()||'index.html';document.querySelectorAll('.navlinks a').forEach(a=>{if(a.getAttribute('href')===path)a.classList.add('active')});

/* Sitewide HUGS electric buttons and visitor-controlled sound */
(() => {
  const buttonSelector = [
    '.btn',
    '.button',
    '.product-button',
    '.free-btn',
    'a.buy',
    'button.buy',
    'a.personalize',
    'button.personalize',
    '.personalize-button',
    '.view-button'
  ].join(',');

  document.querySelectorAll(buttonSelector).forEach(button => {
    button.classList.add('electric-interactive');
  });

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'hugs-sound-toggle';
  toggle.setAttribute('aria-label', 'Turn HUGS interaction sounds on');
  toggle.setAttribute('aria-pressed', 'false');
  toggle.innerHTML = '<span class="sound-wave" aria-hidden="true">♪</span><span class="sound-label">Sound off</span>';
  document.body.appendChild(toggle);

  let soundEnabled = sessionStorage.getItem('hugsSoundEnabled') === 'true';
  let audioContext;

  if (soundEnabled) {
    toggle.setAttribute('aria-pressed', 'true');
    toggle.setAttribute('aria-label', 'Turn HUGS interaction sounds off');
    toggle.querySelector('.sound-label').textContent = 'Sound on';
  }

  function getAudioContext() {
    if (!audioContext) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioContext = new AudioContext();
    }
    if (audioContext && audioContext.state === 'suspended') audioContext.resume();
    return audioContext;
  }

  function tone(frequency, delay = 0, duration = .075, volume = .035) {
    const context = getAudioContext();
    if (!context) return;
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + .02);
  }

  function playInteractionSound(element) {
    const label = (element.textContent || '').toLowerCase();
    if (/open|download|save|your hug has arrived/.test(label)) {
      tone(523.25, 0, .11, .038);
      tone(783.99, .085, .16, .03);
    } else if (/send|buy|shop|support|choose|personalize/.test(label)) {
      tone(392, 0, .08, .03);
      tone(587.33, .055, .12, .025);
    } else {
      tone(440, 0, .07, .022);
    }
  }

  toggle.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    sessionStorage.setItem('hugsSoundEnabled', String(soundEnabled));
    toggle.setAttribute('aria-pressed', String(soundEnabled));
    toggle.setAttribute('aria-label', soundEnabled ? 'Turn HUGS interaction sounds off' : 'Turn HUGS interaction sounds on');
    toggle.querySelector('.sound-label').textContent = soundEnabled ? 'Sound on' : 'Sound off';
    if (soundEnabled) {
      tone(523.25, 0, .1, .035);
      tone(659.25, .07, .14, .03);
    }
  });

  document.addEventListener('click', event => {
    const button = event.target.closest(buttonSelector);
    if (!button || button === toggle) return;
    button.classList.add('is-electric-pressed');
    window.setTimeout(() => button.classList.remove('is-electric-pressed'), 180);
    if (soundEnabled) playInteractionSound(button);
  });
})();
