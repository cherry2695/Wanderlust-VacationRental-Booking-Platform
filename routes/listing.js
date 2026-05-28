const express = require("express");
const router = express.Router();

const wrapAsync = require("../utils/wrapAsync.js");

const {
  isLoggedIn,
  checkOwner,
  validateListing,
} = require("../middleware.js");

const listingController = require("../controllers/listings.js");

// MULTER + CLOUDINARY
const multer = require("multer");
const { storage } = require("../cloudConfig.js");

const upload = multer({ storage });



// ==========================
// ALL LISTINGS + CREATE
// ==========================
router
  .route("/")
  
  // INDEX ROUTE
  .get(wrapAsync(listingController.index))

  // CREATE ROUTE
  .post(
    isLoggedIn,
    upload.single("listing[image]"),
    validateListing,
    wrapAsync(listingController.createListing)
  );



// ==========================
// NEW LISTING FORM
// ==========================
router.get(
  "/new",
  isLoggedIn,
  listingController.renderNewForm
);



// ==========================
// CATEGORY ROUTES
// ==========================
router.get(
  "/category/IconicCity",
  wrapAsync(listingController.ListingIconicCity)
);

router.get(
  "/category/Trending",
  wrapAsync(listingController.ListingTrending)
);

router.get(
  "/category/Rooms",
  wrapAsync(listingController.ListingRooms)
);

router.get(
  "/category/Mountains",
  wrapAsync(listingController.ListingMountains)
);



// ==========================
// SEARCH ROUTE
// ==========================
router.get(
  "/search",
  wrapAsync(listingController.SearchListings)
);



// ==========================
// SHOW / UPDATE / DELETE
// ==========================
router
  .route("/:id")

  // SHOW LISTING
  .get(
    wrapAsync(listingController.ShowListing)
  )

  // UPDATE LISTING
  .put(
    isLoggedIn,
    checkOwner,
    upload.single("listing[image]"),
    validateListing,
    wrapAsync(listingController.updateListing)
  )

  // DELETE LISTING
  .delete(
    isLoggedIn,
    checkOwner,
    wrapAsync(listingController.destroyListing)
  );



// ==========================
// EDIT FORM
// ==========================
router.get(
  "/:id/edit",
  isLoggedIn,
  checkOwner,
  wrapAsync(listingController.renderEditListing)
);



// ==========================
// EXPORT ROUTER
// ==========================
module.exports = router;