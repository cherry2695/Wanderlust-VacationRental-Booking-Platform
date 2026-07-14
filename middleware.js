const Listing = require("./models/listing");
const ExpressError = require("./utils/ExpressError");
const { listingSchema, reviewSchema } = require("./schema.js");
const Review = require("./models/review.js");

module.exports.isLoggedIn = (req, res, next) => {
  if (!req.isAuthenticated()) {
    req.session.redirectUrl = req.originalUrl;
    req.flash("error", "You must be logged in to continue!");
    return res.redirect("/login");
  }
  next();
};

module.exports.SaveRedirectUrl = (req, res, next) => {
  if (req.session.redirectUrl) {
    res.locals.redirectUrl = req.session.redirectUrl;
  }
  next();
};

// Safely check listing ownership — guards against null/undefined owner array
module.exports.checkOwner = async (req, res, next) => {
  let { id } = req.params;
  let listing = await Listing.findById(id).populate("owner");
  if (!listing) {
    req.flash("error", "Listing not found.");
    return res.redirect("/listings");
  }
  const isOwner =
    listing.owner &&
    listing.owner.length > 0 &&
    listing.owner[0]._id &&
    listing.owner[0]._id.equals(res.locals.currUser._id);

  if (!isOwner) {
    req.flash("error", "You don't have permission to do that.");
    return res.redirect(`/listings/${id}`);
  }
  next();
};

module.exports.validateListing = (req, res, next) => {
  let { error } = listingSchema.validate(req.body);
  if (error) {
    let errMsg = error.details.map((el) => el.message).join(",");
    throw new ExpressError(400, errMsg);
  } else {
    next();
  }
};

module.exports.validateReview = (req, res, next) => {
  let { error } = reviewSchema.validate(req.body);
  if (error) {
    let errMsg = error.details.map((el) => el.message).join(",");
    throw new ExpressError(400, errMsg);
  } else {
    next();
  }
};

// Safe review author check — allows deletion by author OR listing owner
module.exports.checkReviewAuthor = async (req, res, next) => {
  let { id, reviewId } = req.params;
  let review = await Review.findById(reviewId).populate("author");

  // Allow if current user is review author
  if (
    review &&
    review.author &&
    review.author._id &&
    review.author._id.equals(res.locals.currUser._id)
  ) {
    return next();
  }

  // Allow if current user is listing owner
  let listing = await Listing.findById(id).populate("owner");
  if (
    listing &&
    listing.owner &&
    listing.owner.length > 0 &&
    listing.owner[0]._id &&
    listing.owner[0]._id.equals(res.locals.currUser._id)
  ) {
    return next();
  }

  req.flash("error", "You can delete only your own reviews.");
  return res.redirect(`/listings/${id}`);
};