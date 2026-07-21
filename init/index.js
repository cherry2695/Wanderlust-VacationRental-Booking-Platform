require("dotenv").config();

const mongoose = require("mongoose");
const initData = require("./data.js");
const Listing = require("../models/listing.js");

const MONGO_URL = process.env.ATLASDB_URL;

async function main() {
    try {
        await mongoose.connect(MONGO_URL);
        console.log("✅ Connected to MongoDB Atlas");

        await initDB();

        console.log("✅ Database initialized successfully");
    } catch (err) {
        console.error("❌ Database initialization failed:", err);
    } finally {
        await mongoose.connection.close();
        console.log("🔌 MongoDB connection closed");
    }
}

async function initDB() {
    // Delete existing listings
    await Listing.deleteMany({});
    console.log("🗑️ Existing listings deleted");

    // Add required fields to your sample data
    const listings = initData.data.map((obj, index) => ({
        ...obj,

        // Your schema requires category
        category:
            index % 4 === 0
                ? "Trending"
                : index % 4 === 1
                ? "Rooms"
                : index % 4 === 2
                ? "Iconic Cities"
                : "Mountains",

        // No owner initially
        owner: [],

        // Empty reviews initially
        reviews: [],
    }));

    await Listing.insertMany(listings);

    console.log(`✅ ${listings.length} listings inserted successfully`);
}

main();