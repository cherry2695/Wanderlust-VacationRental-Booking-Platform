// Leaflet map using OpenStreetMap tiles
function initLeafletMap() {
  if (typeof listing === 'undefined') return;
  try {
    const coords = (listing.geometry && Array.isArray(listing.geometry.coordinates) && listing.geometry.coordinates.length === 2)
      ? listing.geometry.coordinates
      : null;

    if (!coords) throw new Error('No coordinates available');

    const lat = coords[1];
    const lng = coords[0];

    const map = L.map('map').setView([lat, lng], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
    }).addTo(map);

    const marker = L.marker([lat, lng]).addTo(map);
    marker.bindPopup(`<div style="font-family: 'Plus Jakarta Sans', sans-serif;"><h6 style="margin:0;">${listing.title}</h6><small class="text-muted">${listing.location}, ${listing.country}</small></div>`);

    setTimeout(() => {
      map.invalidateSize();
    }, 200);
  } catch (err) {
    console.error('Leaflet map error:', err);
    const mapContainer = document.getElementById('map');
    if (mapContainer) {
      mapContainer.style.display = 'flex';
      mapContainer.style.alignItems = 'center';
      mapContainer.style.justifyContent = 'center';
      mapContainer.style.backgroundColor = '#F7F7F7';
      mapContainer.innerHTML = `<div class="text-center p-3"><i class="fa-solid fa-map-location-dot text-muted mb-2" style="font-size: 2rem;"></i><p class="text-muted m-0" style="font-size: 0.9rem;">Map visualization is currently unavailable.</p></div>`;
    }
  }
}

// Ensure Leaflet is available; dynamically load if necessary
if (typeof listing !== 'undefined') {
  if (typeof L === 'undefined') {
    // load CSS if not present
    if (!document.querySelector('link[href*="leaflet"]')) {
      const lnk = document.createElement('link');
      lnk.rel = 'stylesheet';
      lnk.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(lnk);
    }
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => initLeafletMap();
    script.onerror = () => {
      console.error('Failed to load Leaflet script');
      initLeafletMap();
    };
    document.body.appendChild(script);
  } else {
    initLeafletMap();
  }
}
