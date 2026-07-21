const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Review = require("./review.js");

let listingSchema = new Schema({
  title: {
    type: String,
    required: true,
  },
  description: String,
  image: {
    url: { type: String, default: '' },
    filename: { type: String, default: '' },
  },
  price: Number,
  location: String,
  country: String,
  category: {
    type: String,
    enum: [
      "Trending",
      "Rooms",
      "Iconic Cities",
      "Mountains",
      "Beach",
      "Camping",
      "Pools",
      "Farms",
      "Cabins",
    ],
    required: true,
  },
  amenities: [String],
  reviews: [
    {
      type: Schema.Types.ObjectId,
      ref: "Review",
    },
  ],
  // owner stored as array of ObjectIds for backward compat with existing data
  owner: [
    {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  geometry: {
    type: {
      type: String,
      enum: ["Point"],
      // NOT required — will be filled after geocoding, fallback handled in routes
    },
    coordinates: {
      type: [Number],
    },
  },
});

listingSchema.post("findOneAndDelete", async (listing) => {
  if (listing) {
    await Review.deleteMany({ _id: { $in: listing.reviews } });
  }
});

const Listing = mongoose.model("Listing", listingSchema);

module.exports = Listing;