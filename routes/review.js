const express = require("express");
const router = express.Router({ mergeParams: true });
const wrapAsync = require("../utils/wrapAsync.js");

const {
  validateReview,
  isLoggedIn,
  checkReviewAuthor,
} = require("../middleware.js");

const reviewController = require("../controllers/reviews");

//POST Review Route
router.post(
  "/",
  isLoggedIn,
  validateReview,
  wrapAsync(reviewController.createReview)
);

// Delete Review Route
router.delete(
  "/:reviewId",
  isLoggedIn,
  checkReviewAuthor,
  wrapAsync(reviewController.destroyReview)
);

module.exports = router;