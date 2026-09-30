(() => {
  'use strict';

  const el = {
    grid: document.getElementById('locatorGrid'),
    mapTab: document.getElementById('mapTab'),
    listTab: document.getElementById('listTab'),
    form: document.getElementById('foodSearch'),
    input: document.getElementById('searchInput'),
    clear: document.getElementById('clearSearch'),
    suggestions: document.getElementById('searchSuggestions'),
    nearMe: document.getElementById('nearMe'),
    status: document.getElementById('status'),
    sourceStatus: document.getElementById('sourceStatus'),
    liveBadge: document.getElementById('mapLiveBadge'),
    list: document.getElementById('resultsList'),
    listCount: document.getElementById('listCount'),
    listContext: document.getElementById('listContext'),
    selected: document.getElementById('selectedCard'),
    showMore: document.getElementById('showMore'),
    reset: document.getElementById('resetSearch'),
    resources: document.getElementById('resourceGrid')
  };

  const NYC_CENTER = [40.7128, -74.0060];
  const NYC_BOUNDS = [[40.49, -74.27], [40.93, -73.68]];
  const PAGE_SIZE = 60;
  let allItems = [];
  let currentRows = [];
  let activeFilter = 'all';
  let listLimit = PAGE_SIZE;
  let userLocation = null;
  let userMarker = null;
  let selectedId = null;
  const markerById = new Map();

  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;'
  }[char]));

  const normalize = value => String(value == null ? '' : value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const hasCoordinates = item => Number.isFinite(Number(item && item.latitude)) && Number.isFinite(Number(item && item.longitude));
  const unique = values => [...new Set((values || []).filter(Boolean).map(String))];
  const phoneHref = phone => 'tel:' + String(phone || '').replace(/[^+\d]/g, '');
  const routeAddress = item => item.address || [item.borough, item.zip, 'New York'].filter(Boolean).join(', ');
  const appleDirections = item => 'https://maps.apple.com/?daddr=' + encodeURIComponent(routeAddress(item));
  const googleDirections = item => 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(routeAddress(item));

  function safeHttpUrl(value) {
    try {
      const url = new URL(String(value || '').trim());
      return /^https?:$/.test(url.protocol) ? url.href : '';    } catch (_) {
      return '';
    }
  }

  if (!window.L) {
    el.status.textContent = 'The map could not load. Use the trusted food-resource links below or call 311.';
    return;
  }

  const map = L.map('map', {
    scrollWheelZoom: false,
    zoomControl: true,
    preferCanvas: true,
    zoomSnap: .25
  }).setView(NYC_CENTER, 10);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  const markerLayer = typeof L.markerClusterGroup === 'function'
    ? L.markerClusterGroup({
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        removeOutsideVisibleBounds: true,
        maxClusterRadius: 48,
        iconCreateFunction(cluster) {
          const count = cluster.getChildCount();
          const size = count < 10 ? 'small' : count < 50 ? 'medium' : 'large';
          return L.divIcon({
            html: '<span class="cluster-badge" aria-label="' + count + ' food locations"><span class="cluster-bag" aria-hidden="true">' + markerSvg('bag') + '</span><b aria-hidden="true">' + count + '</b></span>',
            className: 'hugs-cluster hugs-cluster-' + size,
            iconSize: [46, 46]
          });
        }
      })
    : L.layerGroup();
  markerLayer.addTo(map);

  function prepareItem(item, sourceKind) {
    const latitude = Number(item && item.latitude);
    const longitude = Number(item && item.longitude);
    return {
      ...item,
      id: String(item && item.id ? item.id : sourceKind + '-' + Math.random().toString(36).slice(2)),
      name: String(item && item.name ? item.name : 'Food resource'),
      category: String(item && item.category ? item.category : 'Food Resource'),
      description: String(item && item.description ? item.description : ''),
      address: String(item && item.address ? item.address : ''),
      address_detail: String(item && item.address_detail ? item.address_detail : ''),
      borough: String(item && item.borough ? item.borough : ''),
      zip: String(item && item.zip ? item.zip : ''),
      phone: String(item && item.phone ? item.phone : ''),
      website: String(item && item.website ? item.website : ''),
      hours: String(item && item.hours ? item.hours : ''),
      latitude: Number.isFinite(latitude) ? latitude : null,
      longitude: Number.isFinite(longitude) ? longitude : null,
      dietary: Array.isArray(item && item.dietary) ? item.dietary : [],
      features: Array.isArray(item && item.features) ? item.features : [],
      source_label: String(item && (item.source_label || item.source) ? (item.source_label || item.source) : 'HUGS Food Network'),
      source_kind: sourceKind
    };
  }

  function dedupeItems(items) {
    const records = new Map();
    items.forEach(item => {
      const key = normalize(item.name) + '|' + normalize(item.address).replace(/\b(new york|ny|usa)\b/g, '').trim();
      const existing = records.get(key);
      if (!existing || key === '|') {
        records.set(key === '|' ? item.id : key, item);
        return;
      }
      const primary = item.source_kind === 'hugs' ? item : existing;
      const secondary = primary === item ? existing : item;
      records.set(key, {
        ...secondary,
        ...primary,
        latitude: hasCoordinates(primary) ? primary.latitude : secondary.latitude,
        longitude: hasCoordinates(primary) ? primary.longitude : secondary.longitude,
        features: unique([...(secondary.features || []), ...(primary.features || [])]),
        dietary: unique([...(secondary.dietary || []), ...(primary.dietary || [])])
      });
    });
    return [...records.values()];
  }

  function itemText(item) {
    return normalize([
      item.name, item.category, item.description, item.address, item.address_detail,
      item.borough, item.zip, item.partner_status, item.source_label,
      ...(item.features || []), ...(item.dietary || [])
    ].join(' '));
  }

  function matchesQuery(item, query) {
    const tokens = normalize(query).split(' ').filter(Boolean);
    if (!tokens.length) return true;
    const haystack = itemText(item);
    return tokens.every(token => haystack.includes(token));
  }

  function matchesFilter(item) {
    const text = itemText(item);
    const type = normalize(item.type);
    switch (activeFilter) {
      case 'food-pantry':
        return type.includes('pantry') || normalize(item.category).includes('pantry');
      case 'hot-meals':
        return type.includes('kitchen') || text.includes('hot meals') || text.includes('community meal');
      case 'hugs-partner':
        return item.source_kind === 'hugs';
      case 'farmers-market':
        return type.includes('farmers market') || text.includes('fresh food') || text.includes('fresh produce');
      case 'ebt':
        return Boolean(item.accepts_ebt) || text.includes('ebt') || text.includes('snap');
      case 'vegan':
        return text.includes('vegan');
      case 'vegetarian':
        return text.includes('vegetarian');
      case 'halal-kosher':
        return text.includes('halal') || text.includes('kosher');
      case 'discounts':
        return text.includes('discount') || text.includes('low cost') || text.includes('sliding scale') || text.includes('health bucks');
      default:
        return true;
    }
  }

  function milesBetween(a, b) {
    const rad = value => value * Math.PI / 180;
    const earthRadiusMiles = 3958.8;
    const dLat = rad(b.latitude - a.latitude);
    const dLng = rad(b.longitude - a.longitude);
    const lat1 = rad(a.latitude);
    const lat2 = rad(b.latitude);
    const value = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
    return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
  }

  function searchScore(item, query) {
    const q = normalize(query);
    const name = normalize(item.name);
    if (!q) return item.source_kind === 'hugs' ? 0 : item.source_kind === 'official' ? 1 : 2;
    if (name === q) return 0;
    if (name.startsWith(q)) return 1;
    if (name.includes(q)) return 2;
    return 3;
  }

  function getRows() {
    const query = el.input.value.trim();
    const rows = allItems.filter(item => matchesQuery(item, query) && matchesFilter(item));
    return rows.sort((a, b) => {
      if (userLocation && hasCoordinates(a) && hasCoordinates(b)) {
        return milesBetween(userLocation, a) - milesBetween(userLocation, b);
      }
      if (userLocation && hasCoordinates(a) !== hasCoordinates(b)) return hasCoordinates(a) ? -1 : 1;
      const score = searchScore(a, query) - searchScore(b, query);
      return score || a.name.localeCompare(b.name);
    });
  }

  function markerKind(item) {
    if (item.source_kind === 'hugs') return 'hugs';
    if (item.source_kind === 'market' || normalize(item.type).includes('farmers market')) return 'market';
    const foodType = normalize([item.category, item.type, ...(item.features || [])].join(' '));
    if (/hot meal|community kitchen|soup kitchen|prepared meal/.test(foodType)) return 'meal';
    return 'pantry';
  }

  function markerSvg(name) {
    const icons = {
      bag: '<svg viewBox="0 0 24 24" focusable="false"><path d="M5.5 8.5h13l-1 11h-11l-1-11Z"/><path d="M8.5 9V7a3.5 3.5 0 0 1 7 0v2"/></svg>',
      meal: '<svg viewBox="0 0 24 24" focusable="false"><path d="M4 11h16a8 8 0 0 1-16 0Z"/><path d="M3 11h18M8 7c0-1 1-1 1-2s-1-1-1-2M13 7c0-1 1-1 1-2s-1-1-1-2"/></svg>',
      leaf: '<svg viewBox="0 0 24 24" focusable="false"><path d="M19.5 4.5C12 4.5 6 8 6 14.5c0 3 2 5 5 5 6.5 0 8.5-7 8.5-15Z"/><path d="M4.5 20c3-5 6-8 11-11"/></svg>',
      hugs: '<svg viewBox="0 0 24 24" focusable="false"><path d="M4.5 10 12 4l7.5 6v9.5h-15V10Z"/><path d="M12 17.5s-4-2.3-4-5a2.2 2.2 0 0 1 4-1.4 2.2 2.2 0 0 1 4 1.4c0 2.7-4 5-4 5Z"/></svg>'
    };
    return icons[name] || icons.bag;
  }

  function markerIcon(item) {
    const kind = markerKind(item);
    const symbol = kind === 'hugs' ? 'hugs' : kind === 'market' ? 'leaf' : kind === 'meal' ? 'meal' : 'bag';
    return L.divIcon({
      className: 'hugs-marker',
      html: '<span class="resource-pin ' + kind + '" aria-hidden="true"><span class="resource-pin-symbol">' + markerSvg(symbol) + '</span></span>',
      iconSize: [40, 48],
      iconAnchor: [20, 46],
      popupAnchor: [0, -43]
    });
  }

  function typeClass(item) {
    const kind = markerKind(item);
    return kind === 'pantry' ? '' : kind;
  }

  function typeLabel(item) {
    if (item.source_kind === 'hugs') return item.partner_status || 'HUGS Listing';
    return item.category || 'Food Resource';
  }

  function tagsFor(item) {
    return unique([...(item.dietary || []), ...(item.features || [])]).slice(0, 4);
  }

  function popupHtml(item) {
    const address = [item.address, item.address_detail].filter(Boolean).join(' • ');
    const actions = [];
    if (routeAddress(item)) actions.push('<a href="' + esc(appleDirections(item)) + '" target="_blank" rel="noopener">Directions</a>');
    if (item.phone) actions.push('<a href="' + esc(phoneHref(item.phone)) + '">Call</a>');
    const website = safeHttpUrl(item.website);
    if (website) actions.push('<a href="' + esc(website) + '" target="_blank" rel="noopener">Website</a>');
    return '<span class="popup-type">' + esc(typeLabel(item)) + '</span>' +
      '<br><strong class="popup-name">' + esc(item.name) + '</strong>' +
      (address ? '<div class="popup-copy">' + esc(address) + '</div>' : '') +
      (item.hours ? '<div class="popup-copy"><strong>Hours:</strong> ' + esc(item.hours) + '</div>' : '') +
      (actions.length ? '<div class="popup-actions">' + actions.join('') + '</div>' : '');
  }

  function resultCardHtml(item) {
    const distance = userLocation && hasCoordinates(item) ? milesBetween(userLocation, item) : null;
    const tags = tagsFor(item);
    const address = [item.address, item.address_detail].filter(Boolean).join(' • ');
    const id = esc(item.id);
    const actions = [];
    if (hasCoordinates(item)) actions.push('<button class="view-map" type="button" data-open-id="' + id + '">View map</button>');
    if (routeAddress(item)) actions.push('<a href="' + esc(appleDirections(item)) + '" target="_blank" rel="noopener">Directions</a>');
    if (item.phone) actions.push('<a href="' + esc(phoneHref(item.phone)) + '">Call</a>');
    return '<article class="result-card" data-result-id="' + id + '">' +
      '<div class="result-meta"><span class="type-badge ' + typeClass(item) + '">' + esc(typeLabel(item)) + '</span>' +
      (distance == null ? '' : '<span class="distance">' + (distance < 10 ? distance.toFixed(1) : Math.round(distance)) + ' mi</span>') + '</div>' +
      '<button class="result-title" type="button" data-open-id="' + id + '">' + esc(item.name) + '</button>' +
      (address ? '<p class="result-address">📍 ' + esc(address) + '</p>' : '') +
      (item.hours ? '<p class="result-hours"><strong>Schedule:</strong> ' + esc(item.hours) + '</p>' : '') +
      (!item.hours && item.description ? '<p class="result-description">' + esc(item.description) + '</p>' : '') +
      (tags.length ? '<div class="tag-row">' + tags.map(tag => '<span class="food-tag">' + esc(tag) + '</span>').join('') + '</div>' : '') +
      (actions.length ? '<div class="result-actions">' + actions.join('') + '</div>' : '') +
      '</article>';
  }

  function selectedCardHtml(item) {
    const address = [item.address, item.address_detail].filter(Boolean).join(' • ');
    const actions = [];
    if (routeAddress(item)) {
      actions.push('<a class="directions" href="' + esc(appleDirections(item)) + '" target="_blank" rel="noopener">📍 Directions</a>');
      actions.push('<a href="' + esc(googleDirections(item)) + '" target="_blank" rel="noopener">Google Maps</a>');
    }
    if (item.phone) actions.push('<a href="' + esc(phoneHref(item.phone)) + '">📞 Call</a>');
    const website = safeHttpUrl(item.website);
    if (website) actions.push('<a href="' + esc(website) + '" target="_blank" rel="noopener">Website</a>');
    const sourceUrl = safeHttpUrl(item.source_url);
    return '<button class="selected-close" type="button" aria-label="Close selected place">×</button>' +
      '<span class="type-badge ' + typeClass(item) + '">' + esc(typeLabel(item)) + '</span>' +
      '<h3>' + esc(item.name) + '</h3>' +
      (address ? '<p>📍 ' + esc(address) + '</p>' : '') +
      (item.hours ? '<p><strong>Schedule:</strong> ' + esc(item.hours) + '</p>' : '') +
      (item.description ? '<p>' + esc(item.description) + '</p>' : '') +
      (actions.length ? '<div class="selected-actions">' + actions.join('') + '</div>' : '') +
      '<p class="selected-source">Source: ' + (sourceUrl ? '<a href="' + esc(sourceUrl) + '" target="_blank" rel="noopener">' + esc(item.source_label) + '</a>' : esc(item.source_label)) + '</p>';
  }

  function showSelected(item) {
    selectedId = item.id;
    el.selected.innerHTML = selectedCardHtml(item);
    el.selected.hidden = false;
  }

  function closeSelected() {
    selectedId = null;
    el.selected.hidden = true;
    el.selected.innerHTML = '';
    map.closePopup();
  }

  function setLocationLabel(label) {
    el.nearMe.innerHTML = '◎ <span>' + esc(label) + '</span>';
    el.nearMe.setAttribute('aria-label', label);
  }

  function setView(view) {
    const next = view === 'list' ? 'list' : 'map';
    el.grid.dataset.view = next;
    [el.mapTab, el.listTab].forEach(tab => {
      const active = tab.dataset.view === next;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    if (next === 'map') refreshMapSize();
  }

  function refreshMapSize(fitInitial) {
    window.requestAnimationFrame(() => {
      map.invalidateSize({ pan:false, debounceMoveend:true });
      window.requestAnimationFrame(() => {
        map.invalidateSize({ pan:false, debounceMoveend:true });
        if (fitInitial) map.fitBounds(NYC_BOUNDS, { padding:[12, 12], maxZoom:11 });
      });
    });
  }

  function fitMapToRows(rows) {
    const points = rows.filter(hasCoordinates).map(item => [item.latitude, item.longitude]);
    if (!points.length) return;
    if (points.length === 1) {
      map.setView(points[0], 15);
      return;
    }
    map.fitBounds(points, { padding:[38, 38], maxZoom:14 });
  }

  function renderMarkers(rows) {
    markerLayer.clearLayers();
    markerById.clear();
    rows.forEach(item => {
      if (!hasCoordinates(item)) return;
      const marker = L.marker([item.latitude, item.longitude], {
        icon: markerIcon(item),
        title: item.name,
        alt: item.name,
        riseOnHover: true
      }).bindPopup(popupHtml(item));
      marker.on('click', () => showSelected(item));
      markerLayer.addLayer(marker);
      markerById.set(item.id, marker);
    });
  }

  function renderList() {
    const visible = currentRows.slice(0, listLimit);
    const query = el.input.value.trim();
    if (!visible.length) {
      const webSearch = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent((query || 'food pantry') + ' food help NYC');
      el.list.innerHTML = '<div class="empty-results"><strong>No matching HUGS map listing yet.</strong>' +
        '<span>Try a shorter name, a borough, ZIP code or a different filter.</span>' +
        (query ? '<div class="result-actions" style="justify-content:center"><a href="' + esc(webSearch) + '" target="_blank" rel="noopener">Search Google Maps</a></div>' : '') +
        '</div>';
    } else {
      el.list.innerHTML = visible.map(resultCardHtml).join('');
    }
    el.showMore.hidden = currentRows.length <= listLimit;
    if (!el.showMore.hidden) el.showMore.textContent = 'Show more (' + (currentRows.length - listLimit) + ' remaining)';
  }

  function render(options) {
    const config = options || {};
    if (config.resetList !== false) listLimit = PAGE_SIZE;
    currentRows = getRows();
    renderMarkers(currentRows);
    renderList();

    const query = el.input.value.trim();
    const mapCount = currentRows.filter(hasCoordinates).length;
    el.status.innerHTML = '<strong>' + currentRows.length + '</strong> matching food resource' + (currentRows.length === 1 ? '' : 's') +
      (mapCount !== currentRows.length ? ' • ' + mapCount + ' mapped' : '') + '.';
    el.listCount.textContent = currentRows.length + ' place' + (currentRows.length === 1 ? '' : 's');
    el.listContext.textContent = query ? ' matching “' + query + '”' : userLocation ? ' sorted nearest first' : ' across NYC';
    el.reset.hidden = !query && activeFilter === 'all' && !userLocation;
    el.clear.hidden = !query;

    if (selectedId && !currentRows.some(item => item.id === selectedId)) closeSelected();
    if (config.fitMap) fitMapToRows(currentRows);
  }

  function openItem(id) {
    const item = allItems.find(row => row.id === id);
    if (!item) return;
    showSelected(item);
    setView('map');
    if (!hasCoordinates(item)) return;
    const marker = markerById.get(item.id);
    window.setTimeout(() => {
      map.invalidateSize();
      if (marker && typeof markerLayer.zoomToShowLayer === 'function') {
        markerLayer.zoomToShowLayer(marker, () => {
          map.setView([item.latitude, item.longitude], Math.max(map.getZoom(), 15));
          marker.openPopup();
        });
      } else {
        map.setView([item.latitude, item.longitude], 15);
        if (marker) marker.openPopup();
      }
    }, 100);
  }

  function updateSuggestions() {
    const query = el.input.value.trim();
    el.clear.hidden = !query;
    if (normalize(query).length < 2 || !allItems.length) {
      el.suggestions.hidden = true;
      el.input.setAttribute('aria-expanded', 'false');
      return;
    }
    const choices = allItems
      .filter(item => matchesQuery(item, query))
      .sort((a, b) => searchScore(a, query) - searchScore(b, query) || a.name.localeCompare(b.name))
      .slice(0, 8);
    if (!choices.length) {
      el.suggestions.hidden = true;
      el.input.setAttribute('aria-expanded', 'false');
      return;
    }
    el.suggestions.innerHTML = choices.map(item => {
      const location = [item.category, item.borough, item.zip].filter(Boolean).join(' • ');
      return '<button class="suggestion" type="button" role="option" data-suggestion-id="' + esc(item.id) + '">' +
        '<span class="suggestion-mark ' + markerKind(item) + '">' + markerSvg(markerKind(item) === 'market' ? 'leaf' : markerKind(item) === 'hugs' ? 'hugs' : markerKind(item) === 'meal' ? 'meal' : 'bag') + '</span>' +
        '<span><strong>' + esc(item.name) + '</strong><small>' + esc(location || item.address) + '</small></span></button>';
    }).join('');
    el.suggestions.hidden = false;
    el.input.setAttribute('aria-expanded', 'true');
  }

  function hideSuggestions() {
    el.suggestions.hidden = true;
    el.input.setAttribute('aria-expanded', 'false');
  }

  function fallbackResources() {
    return [
      { name:'NYC Food Help', description:'Official NYC map of free food pantries and community kitchens.', source:'NYC HRA / DSS', url:'https://finder.nyc.gov/foodhelp/locations' },
      { name:'Food Bank For NYC', description:'Find free groceries, prepared meals and SNAP support.', source:'Food Bank For New York City', url:'https://www.foodbanknyc.org/find-food/' },
    ];
  }

  function renderTrusted(resources) {
    const rows = resources && resources.length ? resources : fallbackResources();
    el.resources.innerHTML = rows.map(item => {
      const url = safeHttpUrl(item.url);
      return '<article class="trusted-card"><h3>' + esc(item.name) + '</h3>' +
        '<p>' + esc(item.description) + '</p><span class="source-label">' + esc(item.source || 'Trusted resource') + '</span>' +
        (url ? '<br><a href="' + esc(url) + '" target="_blank" rel="noopener">Open current resource →</a>' : '') + '</article>';
    }).join('');
  }

  async function fetchJson(url) {
    const response = await fetch(url, { cache:'no-store' });
    const data = await response.json();
    if (!response.ok || data.ok === false) throw new Error(data.error || 'Resource feed unavailable');
    return data;
  }

  async function load() {
    const [officialResult, hugsResult] = await Promise.allSettled([
      fetchJson('/.netlify/functions/food-resources'),
      fetchJson('/.netlify/functions/food-directory')
    ]);

    const officialData = officialResult.status === 'fulfilled' ? officialResult.value : {};
    const hugsData = hugsResult.status === 'fulfilled' ? hugsResult.value : {};
    const officialLocations = (officialData.locations || []).map(item => prepareItem(item, 'official'));
    const markets = (officialData.markets || []).map(item => prepareItem(item, 'market'));
    const hugsListings = (hugsData.listings || []).map(item => prepareItem(item, 'hugs'));
    allItems = dedupeItems([...officialLocations, ...markets, ...hugsListings]);

    renderTrusted(officialData.trusted_locators || []);
    if (!allItems.length) throw new Error('No live food locations are available right now.');

    render({ fitMap:false });
    const checked = officialData.generated_at ? new Date(officialData.generated_at) : new Date();
    const checkedLabel = Number.isNaN(checked.getTime()) ? '' : checked.toLocaleTimeString([], { hour:'numeric', minute:'2-digit' });
    const sourceParts = [];
    if (officialLocations.length) sourceParts.push(officialLocations.length + ' NYC Food Help');
    if (markets.length) sourceParts.push(markets.length + ' fresh-food');
    if (hugsListings.length) sourceParts.push(hugsListings.length + ' HUGS');
    el.sourceStatus.textContent = sourceParts.join(' + ') + (checkedLabel ? ' • checked ' + checkedLabel : '');
    el.liveBadge.classList.remove('loading');
    el.liveBadge.innerHTML = '<span></span> Live NYC food data';
    refreshMapSize(true);

    if (officialResult.status === 'rejected' || hugsResult.status === 'rejected' || officialData.live_status === 'partial') {
      el.sourceStatus.textContent += ' • some sources temporarily unavailable';
    }
  }

  el.mapTab.addEventListener('click', () => setView('map'));
  el.listTab.addEventListener('click', () => setView('list'));

  el.form.addEventListener('submit', event => {
    event.preventDefault();
    hideSuggestions();
    render({ fitMap:true });
    setView('map');
  });

  el.input.addEventListener('input', updateSuggestions);
  el.input.addEventListener('keydown', event => {
    if (event.key === 'Escape') hideSuggestions();
  });

  el.clear.addEventListener('click', () => {
    el.input.value = '';
    hideSuggestions();
    render({ fitMap:false });
    el.input.focus();
  });

  el.suggestions.addEventListener('click', event => {
    const button = event.target.closest('[data-suggestion-id]');
    if (!button) return;
    const item = allItems.find(row => row.id === button.dataset.suggestionId);
    if (!item) return;
    el.input.value = item.name;
    hideSuggestions();
    render({ fitMap:true });
    openItem(item.id);
  });

  document.addEventListener('click', event => {
    if (!event.target.closest('.search-field')) hideSuggestions();
  });

  document.querySelectorAll('[data-filter]').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-filter]').forEach(item => item.classList.remove('active'));
      button.classList.add('active');
      activeFilter = button.dataset.filter;
      render({ fitMap:true });
    });
  });

  el.list.addEventListener('click', event => {
    const button = event.target.closest('[data-open-id]');
    if (button) openItem(button.dataset.openId);
  });

  el.selected.addEventListener('click', event => {
    if (event.target.closest('.selected-close')) closeSelected();
  });

  el.showMore.addEventListener('click', () => {
    listLimit += PAGE_SIZE;
    renderList();
  });

  el.reset.addEventListener('click', () => {
    el.input.value = '';
    activeFilter = 'all';
    userLocation = null;
    el.nearMe.classList.remove('locating');
    setLocationLabel('Use My Location');
    if (userMarker) {
      map.removeLayer(userMarker);
      userMarker = null;
    }
    document.querySelectorAll('[data-filter]').forEach(button => button.classList.toggle('active', button.dataset.filter === 'all'));
    map.setView(NYC_CENTER, 10);
    render({ fitMap:false });
  });

  el.nearMe.addEventListener('click', () => {
    if (!navigator.geolocation) {
      window.alert('Location is not available in this browser. Search by pantry name, borough, ZIP code or address instead.');
      return;
    }
    el.nearMe.classList.add('locating');
    setLocationLabel('Finding you…');
    navigator.geolocation.getCurrentPosition(position => {
      userLocation = { latitude:position.coords.latitude, longitude:position.coords.longitude };
      if (userMarker) map.removeLayer(userMarker);
      userMarker = L.marker([userLocation.latitude, userLocation.longitude], {
        icon: L.divIcon({
          className:'hugs-marker',
          html:'<span class="marker-dot user" aria-hidden="true">You</span>',
          iconSize:[32,32],
          iconAnchor:[16,16]
        }),
        title:'Your location'
      }).addTo(map).bindPopup('Your approximate location');
      el.nearMe.classList.remove('locating');
      setLocationLabel('Location On');
      render({ fitMap:false });
      setView('map');
      map.setView([userLocation.latitude, userLocation.longitude], 13);
      userMarker.openPopup();
    }, () => {
      el.nearMe.classList.remove('locating');
      setLocationLabel('Use My Location');
      window.alert('We could not access your location. You can still search by pantry name, borough, ZIP code or address.');
    }, { enableHighAccuracy:true, timeout:10000, maximumAge:300000 });
  });

  if (typeof ResizeObserver === 'function') {
    const mapResizeObserver = new ResizeObserver(() => refreshMapSize(false));
    mapResizeObserver.observe(document.querySelector('.map-panel'));
  }
  window.addEventListener('orientationchange', () => window.setTimeout(() => refreshMapSize(false), 180));
  window.addEventListener('resize', () => refreshMapSize(false), { passive:true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => refreshMapSize(false));

  load().catch(error => {
    console.error('HUGS Food Navigator:', error);
    el.status.textContent = 'Live food data is temporarily unavailable. Use the trusted links below or call 311.';
    el.sourceStatus.textContent = '';
    el.liveBadge.classList.remove('loading');
    el.liveBadge.innerHTML = '<span></span> Map unavailable';
    el.list.innerHTML = '<div class="empty-results"><strong>The live map could not load.</strong><span>Please try again shortly.</span></div>';
    renderTrusted([]);
  });
})();
