require("dotenv").config();

const mongoose = require("mongoose");
const User = require("../models/users.js");
const Listing = require("../models/listing.js");

const MONGO_URL = process.env.ATLASDB_URL;

// ✅ Change these credentials as you like
const ADMIN_USERNAME = "admin";
const ADMIN_EMAIL    = "admin@wanderlust.com";
const ADMIN_PASSWORD = "Admin@1234";

async function main() {
    try {
        await mongoose.connect(MONGO_URL);
        console.log("✅ Connected to MongoDB Atlas");

        // Delete existing admin user if exists (clean slate)
        await User.deleteOne({ username: ADMIN_USERNAME });

        // Create admin user
        const adminUser = new User({
            username: ADMIN_USERNAME,
            email:    ADMIN_EMAIL,
        });

        const registeredAdmin = await User.register(adminUser, ADMIN_PASSWORD);
        console.log(`✅ Admin user created: ${ADMIN_USERNAME}`);

        // Assign all listings to admin
        const result = await Listing.updateMany(
            {},
            { $set: { owner: [registeredAdmin._id] } }
        );
        console.log(`✅ ${result.modifiedCount} listings assigned to admin`);

        console.log("\n========================================");
        console.log("   ADMIN LOGIN CREDENTIALS");
        console.log("========================================");
        console.log(`   Username : ${ADMIN_USERNAME}`);
        console.log(`   Password : ${ADMIN_PASSWORD}`);
        console.log("========================================\n");

    } catch (err) {
        console.error("❌ Error:", err.message);
    } finally {
        await mongoose.connection.close();
        console.log("🔌 MongoDB connection closed");
    }
}

main();
