// ---------- Configuration ----------
const STADIA_API_KEY = 'df53c43e-bff8-4f15-b02f-9fa31a80ca21';  // paste your key
const STARTING_VIEW = { center: [-72.7, 41.6], zoom: 8 };  // Connecticut-ish

// ---------- State ----------
let places = [];
let target = null;
let hasGuessed = false;
let score = 0;
let round = 0;
let guessMarker = null;
let truthMarker = null;

// ---------- Map setup ----------
const map = new maplibregl.Map({
  container: 'map',
  style: `https://tiles.stadiamaps.com/styles/stamen_toner_lite.json?api_key=${STADIA_API_KEY}`,
  center: STARTING_VIEW.center,
  zoom: STARTING_VIEW.zoom
});

// Hide all text labels once the style loads — so town names don't give it away.
map.on('style.load', () => {
  const layers = map.getStyle().layers;
  for (const layer of layers) {
    if (layer.type === 'symbol') {
      map.setLayoutProperty(layer.id, 'visibility', 'none');
    }
  }
});

// ---------- Load places ----------
fetch('places.json')
  .then(r => r.json())
  .then(data => {
    places = data;
    nextRound();
  })
  .catch(err => {
    document.getElementById('prompt-name').textContent = 'Error loading places';
    console.error(err);
  });

// ---------- Game functions ----------
function nextRound() {
  // Clear previous round
  if (guessMarker) { guessMarker.remove(); guessMarker = null; }
  if (truthMarker) { truthMarker.remove(); truthMarker = null; }
  if (map.getLayer('line')) map.removeLayer('line');
  if (map.getSource('line')) map.removeSource('line');

  // Pick a random place
  target = places[Math.floor(Math.random() * places.length)];
  hasGuessed = false;
  round += 1;

  // Update UI
  document.getElementById('prompt-name').textContent = target.name;
  document.getElementById('result').textContent = '';
  document.getElementById('result').className = '';
  document.getElementById('round').textContent = round;
  document.getElementById('next-btn').disabled = true;

  // Reset view
  map.flyTo({ center: STARTING_VIEW.center, zoom: STARTING_VIEW.zoom });
}

map.on('click', (e) => {
  if (hasGuessed || !target) return;
  hasGuessed = true;

  const guess = [e.lngLat.lng, e.lngLat.lat];
  const truth = [target.lng, target.lat];

  // Drop both markers
  guessMarker = new maplibregl.Marker({ color: '#3b82f6' })
    .setLngLat(guess).addTo(map);
  truthMarker = new maplibregl.Marker({ color: '#ef4444' })
    .setLngLat(truth).addTo(map);

  // Draw a line between them
  map.addSource('line', {
    type: 'geojson',
    data: {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [guess, truth] }
    }
  });
  map.addLayer({
    id: 'line',
    type: 'line',
    source: 'line',
    paint: {
      'line-color': '#6b7280',
      'line-width': 2,
      'line-dasharray': [2, 2]
    }
  });

  // Zoom so both markers are visible
  const bounds = new maplibregl.LngLatBounds(guess, guess).extend(truth);
  map.fitBounds(bounds, { padding: 80, maxZoom: 10, duration: 800 });

  // Score it
  const km = haversineKm(guess[1], guess[0], truth[1], truth[0]);
  const points = Math.round(5000 * Math.exp(-km / 50));
  score += points;

  const result = document.getElementById('result');
  result.textContent = `${km.toFixed(1)} km off — +${points}`;
  result.className = km < 5 ? 'good' : km < 25 ? 'okay' : 'bad';
  document.getElementById('score').textContent = score;
  document.getElementById('next-btn').disabled = false;
});

document.getElementById('next-btn').addEventListener('click', nextRound);

// ---------- Distance helper ----------
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon/2)**2;
  return 2 * R * Math.asin(Math.sqrt(a));
}