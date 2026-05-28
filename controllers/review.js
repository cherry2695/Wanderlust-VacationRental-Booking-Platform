const Listing = require("../models/listing.js");
const Review = require("../models/review.js");

module.exports.createReview = async (req, res) => {
  console.log(req.params.id);
  let listing = await Listing.findById(req.params.id);
  // Prevent owner from reviewing their own listing
  if (listing && listing.owner && listing.owner.length > 0 && listing.owner[0]._id && listing.owner[0]._id.equals(req.user._id)) {
    req.flash('error', 'Owners cannot review their own listings.');
    return res.redirect(`/listings/${listing._id}`);
  }
  let newReview = new Review(req.body.review);
  newReview.author = req.user._id; //Review author name

  console.log(newReview);
  listing.reviews.push(newReview);

  await newReview.save();
  await listing.save();
  req.flash("success", "New Review Created!");
  res.redirect(`/listings/${listing._id}`);
};

module.exports.destroyReview = async (req, res) => {
  let { id, reviewId } = req.params;

  const review = await Review.findById(reviewId).populate('author');
  const listing = await Listing.findById(id).populate('owner');

  const isAuthor = review && review.author && review.author._id && review.author._id.equals(req.user._id);
  const isOwner = listing && listing.owner && listing.owner.length > 0 && listing.owner[0]._id && listing.owner[0]._id.equals(req.user._id);

  if (!isAuthor && !isOwner) {
    req.flash('error', 'You are not authorized to delete this review');
    return res.redirect(`/listings/${id}`);
  }

  await Listing.findByIdAndUpdate(id, {
    $pull: { reviews: reviewId },
  });
  await Review.findByIdAndDelete(reviewId);

  req.flash("success", "Review Deleted!");
  res.redirect(`/listings/${id}`);
};