const Listing = require("./models/listing");
const ExpressError = require("./utils/ExpressError");
const { listingSchema, reviewSchema } = require("./schema.js");
const Review = require("./models/review.js");

module.exports.isLoggedIn = (req, res, next) => {
  // console.log(req.user);
  if (!req.isAuthenticated()) {
    // req.isAuthenticated() method -->> Check if User is loggedIn or not
    //redirectUrl save
    req.session.redirectUrl = req.originalUrl;
    req.flash("error", "you must be logged in to create listing!");
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

//check listing Owner
module.exports.checkOwner = async (req, res, next) => {
  let { id } = req.params;
  let listing = await Listing.findById(id);
  //setting Authorization
  if (!listing.owner[0]._id.equals(res.locals.currUser._id)) {
    req.flash("error", "You are not the owner of this listing");
    return res.redirect(`/listings/${id}`);
  }
  next();
};

module.exports.validateListing = (req, res, next) => {
  let { error } = listingSchema.validate(req.body);
  //console.log(error);

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

//check
module.exports.checkReviewAuthor = async (req, res, next) => {
  let { id, reviewId } = req.params;
  console.log(id, reviewId);
  let review = await Review.findById(reviewId).populate('author');
  // allow deletion if current user is review author
  if (review && review.author && review.author._id && review.author._id.equals(res.locals.currUser._id)) {
    return next();
  }
  // allow if current user is listing owner
  let listing = await Listing.findById(id);
  if (listing && listing.owner && listing.owner.length > 0 && listing.owner[0]._id && listing.owner[0]._id.equals(res.locals.currUser._id)) {
    return next();
  }
  req.flash("error", "You are not authorized to delete this review");
  return res.redirect(`/listings/${id}`);
};