const https = require('https');

// Simple Nominatim (OpenStreetMap) geocode helper
// Returns a GeoJSON Point: { type: 'Point', coordinates: [lng, lat] }
module.exports = async function geocodeLocation(place) {
  if (!place || typeof place !== 'string') {
    return { type: 'Point', coordinates: [77.2090, 28.6139] };
  }
  const query = encodeURIComponent(place);
  const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;

  return new Promise((resolve) => {
    https
      .get(url, { headers: { 'User-Agent': 'Wanderlust/1.0 (your-email@example.com)' } }, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (Array.isArray(json) && json.length > 0) {
              const item = json[0];
              const lat = parseFloat(item.lat);
              const lon = parseFloat(item.lon);
              if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
                return resolve({ type: 'Point', coordinates: [lon, lat] });
              }
            }
          } catch (e) {
            // ignore parse errors
          }
          // fallback coordinates (New Delhi)
          resolve({ type: 'Point', coordinates: [77.2090, 28.6139] });
        });
      })
      .on('error', () => {
        resolve({ type: 'Point', coordinates: [77.2090, 28.6139] });
      });
  });
};
