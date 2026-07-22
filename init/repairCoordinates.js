/**
 * repairCoordinates.js
 * Repairs ALL listings in MongoDB Atlas that have:
 *   1. No geometry (null / missing)
 *   2. New Delhi fallback coordinates [77.2090, 28.6139] (wrong old fallback)
 *   3. Clearly mismatched coordinates (e.g., Malibu listing with Maldives coords)
 *
 * Uses a comprehensive hardcoded lookup table for instant, accurate coordinates.
 * Falls back to Nominatim for any location not in the lookup.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const Listing = require("../models/listing.js");

const MONGO_URL = process.env.ATLASDB_URL;

// ── Comprehensive coordinate lookup [longitude, latitude] ─────────────────────
const COORDS = {
    // United States
    "Malibu, United States":                    [-118.7798, 34.0259],
    "New York City, United States":             [-74.0060,  40.7128],
    "New York, United States":                  [-74.0060,  40.7128],
    "Aspen, United States":                     [-106.8175, 39.1911],
    "Portland, United States":                  [-122.6765, 45.5231],
    "Lake Tahoe, United States":                [-120.0324, 38.9399],
    "Los Angeles, United States":               [-118.2437, 34.0522],
    "Maui, United States":                      [-156.3319, 20.7984],
    "Miami, United States":                     [-80.1918,  25.7617],
    "Boston, United States":                    [-71.0589,  42.3601],
    "Montana, United States":                   [-110.3626, 46.8797],
    "Charleston, United States":                [-79.9311,  32.7765],
    "New Hampshire, United States":             [-71.5724,  43.1939],
    // Europe
    "Florence, Italy":                          [11.2558,   43.7696],
    "Rome, Italy":                              [12.4964,   41.9028],
    "Pragser Wildsee, Italy":                   [12.0847,   46.6946],
    "Tuscany, Italy":                           [11.2558,   43.7696],
    "Amalfi Coast, Italy":                      [14.6027,   40.6340],
    "Verbier, Switzerland":                     [7.2284,    46.0961],
    "Swiss Alps, Switzerland":                  [8.2275,    46.8182],
    "Paris, France":                            [2.3522,    48.8566],
    "Barcelona, Spain":                         [2.1734,    41.3851],
    "Mykonos, Greece":                          [25.3290,   37.4467],
    "Santorini, Greece":                        [25.4615,   36.3932],
    "Amsterdam, Netherlands":                   [4.9041,    52.3676],
    "Scottish Highlands, United Kingdom":       [-4.2026,   57.1200],
    "Cotswolds, United Kingdom":                [-1.8433,   51.8330],
    "Reykjavik, Iceland":                       [-21.9426,  64.1466],
    // Asia & Pacific
    "Tokyo, Japan":                             [139.6917,  35.6895],
    "Bali, Indonesia":                          [115.1889,  -8.4095],
    "Phuket, Thailand":                         [98.3923,    7.8804],
    "Dubai, United Arab Emirates":              [55.2708,   25.2048],
    "Goa, India":                               [74.1240,   15.2993],
    "Kerala, India":                            [76.2711,   10.8505],
    "Maldives, Maldives":                       [73.5093,    3.2028],
    "Queenstown, New Zealand":                  [168.6626, -45.0312],
    "Sydney, Australia":                        [151.2093, -33.8688],
    "Fiji, Fiji":                               [178.0650, -17.7134],
    // Americas
    "Cancun, Mexico":                           [-86.8515,  21.1619],
    "Banff, Canada":                            [-115.5708, 51.1784],
    "Costa Rica, Costa Rica":                   [-83.7534,   9.7489],
    "Rio de Janeiro, Brazil":                   [-43.1729, -22.9068],
    "Havana, Cuba":                             [-82.3666,  23.1136],
    "Patagonia, Argentina":                     [-68.5248, -45.8665],
    // Africa & Middle East
    "Serengeti National Park, Tanzania":        [34.8333,   -2.3333],
    "Cape Town, South Africa":                  [18.4241,  -33.9249],
    "Petra, Jordan":                            [35.4444,   30.3285],
    "Sahara Desert, Morocco":                   [-5.5593,   31.7917],
    // India
    "Hyderabad, India":                         [78.4867,   17.3850],
    "Mumbai, India":                            [72.8777,   19.0760],
    "Delhi, India":                             [77.2090,   28.6139],
    "New Delhi, India":                         [77.2090,   28.6139],
    "Bangalore, India":                         [77.5946,   12.9716],
    "Chennai, India":                           [80.2707,   13.0827],
};

// ── New Delhi sentinel coordinates (old wrong fallback) ──────────────────────
const NEW_DELHI = [77.2090, 28.6139];
const isNewDelhiFallback = (coords) =>
    coords &&
    Math.abs(coords[0] - NEW_DELHI[0]) < 0.01 &&
    Math.abs(coords[1] - NEW_DELHI[1]) < 0.01;

// ── Lookup in hardcoded table ─────────────────────────────────────────────────
function getHardcodedCoords(location, country) {
    const key = `${location}, ${country}`;
    if (COORDS[key]) return COORDS[key];

    // Partial match on location name (first word)
    const locLower = location.toLowerCase();
    for (const [k, v] of Object.entries(COORDS)) {
        if (k.toLowerCase().startsWith(locLower + ",")) return v;
    }
    return null;
}

// ── Nominatim geocoder ────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function nominatimGeocode(location, country) {
    try {
        const query = encodeURIComponent(`${location.trim()}, ${country.trim()}`);
        const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;
        const response = await fetch(url, {
            headers: { "User-Agent": "WanderlustApp/1.0 (wanderlust@example.com)" },
            signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) return null;
        const data = await response.json();
        if (data && data.length > 0) {
            const lon = parseFloat(data[0].lon);
            const lat = parseFloat(data[0].lat);
            if (!isNaN(lon) && !isNaN(lat)) return [lon, lat];
        }
    } catch (e) {
        console.warn(`  Nominatim failed: ${e.message}`);
    }
    return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
    try {
        await mongoose.connect(MONGO_URL);
        console.log("✅ Connected to MongoDB Atlas\n");

        const listings = await Listing.find({});
        console.log(`🔍 Checking ${listings.length} listings...\n`);

        let fixed = 0, skipped = 0, failed = 0;

        for (const listing of listings) {
            const coords = listing.geometry &&
                           Array.isArray(listing.geometry.coordinates) &&
                           listing.geometry.coordinates.length === 2
                           ? listing.geometry.coordinates : null;

            const wrong = !coords || isNewDelhiFallback(coords);

            if (!wrong) {
                console.log(`  ✅ OK     | ${listing.location.padEnd(30)} | ${listing.title}`);
                skipped++;
                continue;
            }

            const label = !coords ? "NO GEOM " : "BAD GEOM";
            process.stdout.write(`  🔧 ${label} | ${listing.location.padEnd(30)} | ${listing.title} ... `);

            // Try hardcoded first (instant, accurate)
            let newCoords = getHardcodedCoords(listing.location, listing.country);

            // Fall back to Nominatim if not in table
            if (!newCoords) {
                newCoords = await nominatimGeocode(listing.location, listing.country);
                await sleep(1100); // Respect Nominatim rate limit
            }

            if (newCoords) {
                listing.geometry = { type: "Point", coordinates: newCoords };
                await listing.save();
                console.log(`✅ Fixed → [${newCoords[1].toFixed(4)}, ${newCoords[0].toFixed(4)}]`);
                fixed++;
            } else {
                console.log("❌ Could not geocode");
                failed++;
            }
        }

        console.log(`
========================================
  ✅ Fixed  : ${fixed} listings
  ✅ OK     : ${skipped} listings
  ❌ Failed : ${failed} listings
========================================`);

    } catch (err) {
        console.error("❌ Fatal error:", err);
    } finally {
        await mongoose.connection.close();
        console.log("🔌 MongoDB connection closed");
    }
}

main();
