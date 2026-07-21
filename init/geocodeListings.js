require("dotenv").config();

const mongoose = require("mongoose");
const Listing = require("../models/listing.js");

const MONGO_URL = process.env.ATLASDB_URL;

// Precise coordinates for every location in the seed data
// Format: "City, Country": [longitude, latitude]
const COORDS = {
    "Malibu, United States":                    [-118.7798, 34.0259],
    "New York City, United States":             [-74.0060,  40.7128],
    "New York, United States":                  [-74.0060,  40.7128],
    "Aspen, United States":                     [-106.8175, 39.1911],
    "Florence, Italy":                          [11.2558,   43.7696],
    "Portland, United States":                  [-122.6765, 45.5231],
    "Cancun, Mexico":                           [-86.8515,  21.1619],
    "Lake Tahoe, United States":                [-120.0324, 38.9399],
    "Los Angeles, United States":               [-118.2437, 34.0522],
    "Verbier, Switzerland":                     [7.2284,    46.0961],
    "Serengeti National Park, Tanzania":        [34.8333,   -2.3333],
    "Mykonos, Greece":                          [25.3290,   37.4467],
    "Queenstown, New Zealand":                  [168.6626, -45.0312],
    "Maui, United States":                      [-156.3319, 20.7984],
    "Santorini, Greece":                        [25.4615,   36.3932],
    "Bali, Indonesia":                          [115.1889,  -8.4095],
    "Barcelona, Spain":                         [2.1734,    41.3851],
    "Swiss Alps, Switzerland":                  [8.2275,    46.8182],
    "Paris, France":                            [2.3522,    48.8566],
    "Tokyo, Japan":                             [139.6917,  35.6895],
    "Sydney, Australia":                        [151.2093, -33.8688],
    "Amalfi Coast, Italy":                      [14.6027,   40.6340],
    "Cape Town, South Africa":                  [18.4241,  -33.9249],
    "Banff, Canada":                            [-115.5708, 51.1784],
    "Phuket, Thailand":                         [98.3923,    7.8804],
    "Reykjavik, Iceland":                       [-21.9426,  64.1466],
    "Tuscany, Italy":                           [11.2558,   43.7696],
    "Kerala, India":                            [76.2711,    10.8505],
    "Rio de Janeiro, Brazil":                   [-43.1729, -22.9068],
    "Amsterdam, Netherlands":                   [4.9041,    52.3676],
    "Maldives, Maldives":                       [73.5093,    3.2028],
    "Goa, India":                               [74.1240,   15.2993],
    "Havana, Cuba":                             [-82.3666,  23.1136],
    "Petra, Jordan":                            [35.4444,   30.3285],
    "Sahara Desert, Morocco":                   [-5.5593,   31.7917],
    "Patagonia, Argentina":                     [-68.5248, -45.8665],
    // Additional locations from DB
    "Fiji, Fiji":                               [178.0650, -17.7134],
    "Cotswolds, United Kingdom":                [-1.8433,   51.8330],
    "Boston, United States":                    [-71.0589,  42.3601],
    "Miami, United States":                     [-80.1918,  25.7617],
    "Scottish Highlands, United Kingdom":       [-4.2026,   57.1200],
    "Dubai, United Arab Emirates":              [55.2708,   25.2048],
    "Montana, United States":                   [-110.3626, 46.8797],
    "Costa Rica, Costa Rica":                   [-83.7534,   9.7489],
    "Charleston, United States":                [-79.9311,  32.7765],
    "New Hampshire, United States":             [-71.5724,  43.1939],
};

function getCoords(location, country) {
    // Try "City, Country" key first
    const key1 = `${location}, ${country}`;
    if (COORDS[key1]) return COORDS[key1];

    // Try partial match on city name
    const cityLower = location.toLowerCase();
    for (const [k, v] of Object.entries(COORDS)) {
        if (k.toLowerCase().startsWith(cityLower)) return v;
    }
    return null;
}

async function main() {
    try {
        await mongoose.connect(MONGO_URL);
        console.log("✅ Connected to MongoDB Atlas");

        const listings = await Listing.find({});
        console.log(`📍 Updating coordinates for ${listings.length} listings...\n`);

        let updated = 0;
        let skipped = 0;

        for (const listing of listings) {
            const coords = getCoords(listing.location, listing.country);
            if (coords) {
                listing.geometry = { type: "Point", coordinates: coords };
                await listing.save();
                console.log(`  ✅ ${listing.location}, ${listing.country} → [${coords[1].toFixed(4)}, ${coords[0].toFixed(4)}]`);
                updated++;
            } else {
                console.log(`  ⚠️  No coords found for: ${listing.location}, ${listing.country}`);
                skipped++;
            }
        }

        console.log(`\n========================================`);
        console.log(`  ✅ Updated : ${updated} listings`);
        console.log(`  ⚠️  Skipped : ${skipped} listings`);
        console.log(`========================================\n`);

    } catch (err) {
        console.error("❌ Error:", err.message);
    } finally {
        await mongoose.connection.close();
        console.log("🔌 MongoDB connection closed");
    }
}

main();
