const Listing = require("../models/listing");
const geocodeLocation = require("../utils/geocode.js");

module.exports.index = async (req, res) => {
  const allListings = await Listing.find({});
  res.render("./listings/index.ejs", { allListings });
};

module.exports.renderNewForm = (req, res) => {
  res.render("./listings/new.ejs");
};

module.exports.ShowListing = async (req, res) => {
  let { id } = req.params;
  const listing = await Listing.findById(id)
    .populate({
      path: "reviews",
      populate: {
        path: "author",
      },
    })
    .populate("owner");
  if (!listing) {
    req.flash("error", "Listing you requested for does not exist!");
    res.redirect("/listings");
  } else {
    res.render("./listings/show.ejs", {
      listing,
    });
  }
};

module.exports.createListing = async (req, res, next) => {
  const geometry = await geocodeLocation(req.body.listing.location);
  console.log(geometry);

  let url = req.file.path;
  let filename = req.file.filename;
  console.log(url, "..", filename);
  const newListing = new Listing(req.body.listing);
  console.log(req.user);
  newListing.owner = req.user._id;
  newListing.image = { url, filename };

  newListing.geometry = geometry;

  let savedListing = await newListing.save();
  console.log(savedListing);

  req.flash("success", "New Listing Created!");
  res.redirect("/listings");
};

module.exports.renderEditListing = async (req, res) => {
  let { id } = req.params;
  const listing = await Listing.findById(id);
  if (!listing) {
    req.flash("error", "Listing you requested for does not exist!");
    res.redirect("/listings");
  }
  // Transformation of image url
  let originalImageUrl = listing.image.url;
  originalImageUrl = originalImageUrl.replace("/upload", "/upload/w_250");
  res.render("./listings/edit.ejs", { listing, originalImageUrl });
};

module.exports.updateListing = async (req, res) => {
  let { id } = req.params;
  let listing = await Listing.findByIdAndUpdate(id, { ...req.body.listing });
  //   if request.file not equal to undefined
  if (typeof req.file !== "undefined") {
    let url = req.file.path;
    let filename = req.file.filename;
    listing.image = { url, filename };
    await listing.save();
  }
  req.flash("success", "Listing Updated!");
  res.redirect(`/listings/${id}`);
};

module.exports.destroyListing = async (req, res) => {
  let { id } = req.params;
  let deleteListing = await Listing.findByIdAndDelete(id);
  console.log(deleteListing);
  req.flash("success", "Listing Deleted!");
  res.redirect("/listings");
};

//Showfilter
module.exports.ListingIconicCity = async (req, res) => {
  let allListings = await Listing.find({ category: "Iconic Cities" })
    .populate({
      path: "reviews",
      populate: {
        path: "author",
      },
    })
    .populate("owner");
  if (allListings.length === 0) {
    req.flash("error", "Listing you requested for does not exist!");
    res.redirect("/listings");
  } else {
    return res.render("./listings/category.ejs", { allListings });
  }
};

module.exports.ListingTrending = async (req, res) => {
  let allListings = await Listing.find({ category: "Trending" })
    .populate({
      path: "reviews",
      populate: {
        path: "author",
      },
    })
    .populate("owner");
  if (allListings.length === 0) {
    req.flash("error", "Listing you requested for does not exist!");
    res.redirect("/listings");
  } else {
    return res.render("./listings/category.ejs", { allListings });
  }
};

module.exports.ListingRooms = async (req, res) => {
  let allListings = await Listing.find({ category: "Rooms" })
    .populate({
      path: "reviews",
      populate: {
        path: "author",
      },
    })
    .populate("owner");
  if (allListings.length === 0) {
    req.flash("error", "Listing you requested for does not exist!");
    res.redirect("/listings");
  } else {
    return res.render("./listings/category.ejs", { allListings });
  }
};

module.exports.ListingMountains = async (req, res) => {
  let allListings = await Listing.find({ category: "Mountains" })
    .populate({
      path: "reviews",
      populate: {
        path: "author",
      },
    })
    .populate("owner");
  console.log(allListings);
  if (allListings.length === 0) {
    req.flash("error", "Listing you requested for does not exist!");
    res.redirect("/listings");
  } else {
    return res.render("./listings/category.ejs", { allListings });
  }
};

module.exports.SearchListings = async (req, res) => {
  const searchTerm = req.query.search?.trim();

  if (!searchTerm) {
    req.flash("error", "Please enter a country");
    return res.redirect("/listings");
  }

  let allListings = await Listing.find({ country: searchTerm });

  if (allListings.length === 0) {
    req.flash("error", `No listings found for "${searchTerm}"`);
    return res.redirect("/listings");
  }

  res.render("./listings/index.ejs", { allListings });
};