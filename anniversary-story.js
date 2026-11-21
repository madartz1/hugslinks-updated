"use strict";

function mountAnniversaryStory(container, card) {
  container.innerHTML = `
    <div class="gift-arrival">
      <button class="gift-open" type="button">
        <span class="envelope-art">
          <img class="envelope-sealed" src="https://hugslinks-card-app.netlify.app/assets/anniversary/envelope-sealed.webp" alt="">
          <img class="envelope-open" src="https://hugslinks-card-app.netlify.app/assets/anniversary/envelope-open.webp" alt="" hidden>
        </span>
        <span class="gift-open-label">Open Your HUG</span>
      </button>
    </div>
    <div class="story-card" hidden>
      <article class="story-page story-cover">
        <div class="story-ribbon">A love that lasts</div>
        <div class="story-rule"></div>
        <div class="story-heart" aria-hidden="true">♡</div>
        <h2 tabindex="-1">Happy Anniversary,<br>My Love</h2>
        <div class="story-ornament" aria-hidden="true">✦ ♡ ✦</div>
        <p>Every love story is beautiful. Ours is my favorite.</p>
      </article>
      <article class="story-page story-inside" hidden>
        <div class="story-ornament" aria-hidden="true">✧ ♡ ✧</div>
        <h2 tabindex="-1">Still Choosing You</h2>
        <p>In every season of life, love brings us back to each other.</p>
        <video class="story-film" controls playsinline preload="metadata"
          aria-label="HUGSLinks Happy Anniversary animated card"
          poster="https://hugslinks-card-app.netlify.app/assets/anniversary/motion-poster.webp"
          src="https://cdn.pika.art/v2/media/creation_36956de0-2d4b-4915-9764-1dc3a18d73b3/output.mp4"></video>
        <p class="story-film-error" role="status" hidden>The animation couldn’t load. You can still read your card.</p>
        <div class="story-bears" hidden>
          <img src="https://hugslinks-card-app.netlify.app/assets/anniversary/poppa.webp" alt="Poppa Bear" width="640" height="768">
          <span aria-hidden="true">♥</span>
          <img src="https://hugslinks-card-app.netlify.app/assets/anniversary/moma.webp" alt="Moma Bear" width="640" height="768">
        </div>
      </article>
      <article class="story-page story-message" hidden>
        <div class="story-ornament" aria-hidden="true">✦ ♡ ✦</div>
        <h2 tabindex="-1">To My Forever Love</h2>
        <p class="story-to"></p>
        <div class="story-rule"></div>
        <blockquote></blockquote>
        <div class="story-rule"></div>
        <p>Forever yours, <span class="story-signature"></span></p>
      </article>
    </div>
    <nav class="story-controls" aria-label="Anniversary card pages" hidden>
      <button class="secondary story-back" type="button" hidden>Back</button>
      <span class="story-count" aria-live="polite"></span>
      <button class="story-next" type="button"></button>
    </nav>`;

  container.querySelector(".story-to").textContent = "For " + card.recipient;
  container.querySelector("blockquote").textContent = card.message;
  container.querySelector(".story-signature").textContent = card.sender;
  const arrival = container.querySelector(".gift-arrival");
  const open = container.querySelector(".gift-open");
  const sealed = container.querySelector(".envelope-sealed");
  const unfolded = container.querySelector(".envelope-open");
  const story = container.querySelector(".story-card");
  const navigation = container.querySelector(".story-controls");
  const pages = [...container.querySelectorAll(".story-page")];
  const next = container.querySelector(".story-next");
  const back = container.querySelector(".story-back");
  const count = container.querySelector(".story-count");
  const film = container.querySelector(".story-film");
  function showArtworkFallback() {
    film.hidden = true;
    container.querySelector(".story-film-error").hidden = false;
    container.querySelector(".story-bears").hidden = false;
  }
  film.addEventListener("error", showArtworkFallback);
  if (film.error) showArtworkFallback();
  const nextLabels = ["See the Anniversary Story", "Read Your Message", "Replay"];
  let current = 0;

  function show(page, focusHeading) {
    if (current === 1 && page !== 1) film.pause();
    if (page === 0 && film.readyState > 0) film.currentTime = 0;
    current = page;
    pages.forEach((item, i) => { item.hidden = i !== current; });
    back.hidden = current === 0;
    count.textContent = (current + 1) + " of " + pages.length;
    next.textContent = nextLabels[current];
    if (focusHeading) pages[current].querySelector("h2").focus();
  }

  function reveal() {
    arrival.hidden = true;
    story.hidden = false;
    navigation.hidden = false;
    show(0, true);
  }

  open.onclick = () => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
        !unfolded.complete || !unfolded.naturalWidth) {
      reveal();
      return;
    }
    open.disabled = true;
    sealed.hidden = true;
    unfolded.hidden = false;
    window.setTimeout(() => {
      if (container.contains(arrival)) reveal();
    }, 380);
  };
  next.onclick = () => {
    if (current < pages.length - 1) {
      show(current + 1, true);
      return;
    }
    show(0, false);
    story.hidden = navigation.hidden = true;
    sealed.hidden = false;
    unfolded.hidden = true;
    open.disabled = false;
    arrival.hidden = false;
    open.focus();
  };
  back.onclick = () => show(current - 1, true);
}
