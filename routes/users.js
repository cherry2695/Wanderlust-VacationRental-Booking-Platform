const express = require("express");
const router = express.Router({ mergeParams: true });
const wrapAsync = require("../utils/wrapAsync.js");
const passport = require("passport");
const { SaveRedirectUrl } = require("../middleware.js");

const userController = require("../controllers/users");

//SIGNUP

router
  .route("/signup")
  .get(userController.renderSignupForm)
  .post(wrapAsync(userController.signup));

//LOGIN
router
  .route("/login")
  .get(userController.renderLoginForm)
  .post(
    SaveRedirectUrl,
    //Actual login is done by passport
    passport.authenticate("local", {
      failureRedirect: "/login",
      failureFlash: true,
    }),
    userController.login //After success login
  );

//LOGOUT
router.post("/logout", userController.logout);

module.exports = router;