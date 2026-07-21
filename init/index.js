require("dotenv").config();

const mongoose = require("mongoose");
const initData = require("./data.js");
const Listing = require("../models/listing.js");

const MONGO_URL = process.env.ATLASDB_URL;

// All 9 categories used in the app
const ALL_CATEGORIES = [
    "Trending",
    "Rooms",
    "Iconic Cities",
    "Mountains",
    "Beach",
    "Camping",
    "Pools",
    "Farms",
    "Cabins",
];

async function main() {
    try {
        await mongoose.connect(MONGO_URL);
        console.log("✅ Connected to MongoDB Atlas");

        await initDB();

        console.log("✅ Database seeded successfully");
    } catch (err) {
        console.error("❌ Database seeding failed:", err);
    } finally {
        await mongoose.connection.close();
        console.log("🔌 MongoDB connection closed");
    }
}

async function initDB() {
    // Get the raw array regardless of export style
    const rawData = initData.data || initData;

    // Delete existing listings
    await Listing.deleteMany({});
    console.log("🗑️  Existing listings deleted");

    // Assign categories cyclically across ALL 9 categories
    const listings = rawData.map((obj, index) => ({
        ...obj,
        category: ALL_CATEGORIES[index % ALL_CATEGORIES.length],
        owner: [],
        reviews: [],
    }));

    await Listing.insertMany(listings);

    // Log how many listings each category got
    const summary = {};
    listings.forEach((l) => {
        summary[l.category] = (summary[l.category] || 0) + 1;
    });
    console.log("\n📊 Listings per category:");
    Object.entries(summary).forEach(([cat, count]) => {
        console.log(`   ${cat}: ${count} listing(s)`);
    });

    console.log(`\n✅ ${listings.length} total listings inserted`);
}

main();