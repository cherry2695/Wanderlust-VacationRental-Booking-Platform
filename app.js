require('dotenv').config();

const express = require('express');
const app = express();
const mongoose = require('mongoose');

const Listing = require('./models/listing.js');
const User = require('./models/users.js');
const Review = require('./models/review.js');
const Booking = require('./models/booking.js');

const path = require('path');
const methodOverride = require('method-override');
const ejsMate = require('ejs-mate');

const wrapAsync = require('./utils/wrapAsync.js');
const ExpressError = require('./utils/ExpressError.js');
const { isLoggedIn } = require('./middleware.js');

const session = require('express-session');
const flash = require('connect-flash');

const passport = require('passport');
const LocalStrategy = require('passport-local');

const multer = require('multer');
const { storage, cloudinary } = require('./cloudConfig');

const upload = multer({ storage });


// ================= GEOCODE HELPER (Nominatim / OpenStreetMap) =================
// Free geocoding — no API key required.
// Returns a GeoJSON Point on success, or NULL on failure.
// Callers must check for null and handle gracefully (do NOT fall back to New Delhi).
async function geocodeLocation(locationStr, countryStr = '') {
    if (!locationStr || !locationStr.trim()) return null;
    try {
        const query = encodeURIComponent(
            countryStr ? `${locationStr.trim()}, ${countryStr.trim()}` : locationStr.trim()
        );
        const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;
        const response = await fetch(url, {
            headers: { 'User-Agent': 'WanderlustApp/1.0 (wanderlust@example.com)' },
            signal: AbortSignal.timeout(8000) // 8-second timeout
        });
        if (!response.ok) {
            console.error('Geocode HTTP error:', response.status);
            return null;
        }
        const data = await response.json();
        if (data && data.length > 0) {
            const lon = parseFloat(data[0].lon);
            const lat = parseFloat(data[0].lat);
            if (!isNaN(lon) && !isNaN(lat)) {
                console.log(`Geocoded "${locationStr}" → [${lat}, ${lon}]`);
                return { type: 'Point', coordinates: [lon, lat] };
            }
        }
        console.warn(`Geocode: no results for "${locationStr}, ${countryStr}"`);
        return null;
    } catch (e) {
        console.error('Geocode error:', e.message);
        return null; // Do NOT fall back to New Delhi
    }
}


// ================= DATABASE CONNECTION =================

const MONGO_URL = process.env.ATLASDB_URL;
                
async function main() {
    try {
        await mongoose.connect(MONGO_URL);
        console.log("✅ Connected to MongoDB Atlas");
    } catch (err) {
        console.error("❌ MongoDB Connection Error:", err);
    }
}

main();


// ================= EJS ENGINE =================

app.engine('ejs', ejsMate);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


// ================= MIDDLEWARE =================

app.use(express.urlencoded({ extended: true }));

app.use(methodOverride('_method'));

app.use(express.static(path.join(__dirname, 'public')));

const sessionOptions = {
    secret: process.env.SECRET || 'wanderlust_fallback_secret_change_in_prod',
    resave: false,
    saveUninitialized: false,

    cookie: {
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
    },
};

app.use(session(sessionOptions));

app.use(flash());


// ================= PASSPORT CONFIG =================

app.use(passport.initialize());

app.use(passport.session());

passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());

passport.deserializeUser(User.deserializeUser());


// ================= GLOBAL LOCALS =================

app.use((req, res, next) => {

    res.locals.success = req.flash('success');

    res.locals.error = req.flash('error');

    res.locals.currUser = req.user;

    res.locals.currentPath = req.path;

    res.locals.optimizeCloudinary = (url, width = 520) => {
      if (!url || typeof url !== 'string') return url;
      if (url.includes('/upload')) {
        return url.replace('/upload', `/upload/w_${width},c_fill,q_auto,f_auto`);
      }
      return url;
    };

    next();
});


// ================= ROOT ROUTE =================

app.get('/', (req, res) => {
    res.redirect('/listings');
});


// ================= INDEX ROUTE =================

app.get('/listings',
    wrapAsync(async (req, res) => {
        const allListings = await Listing.find({}).populate('reviews');
        res.render('listings/index.ejs', { allListings });
    })
);


// ================= NEW ROUTE =================

app.get('/listings/new',
    isLoggedIn,
    (req, res) => {
        res.render('listings/new.ejs');
    }
);


// ================= SEARCH ROUTE =================
app.get('/listings/search',
    wrapAsync(async (req, res) => {
        const searchTerm = req.query.search?.trim();
        if (!searchTerm) {
            req.flash("error", "Please enter a location or country");
            return res.redirect("/listings");
        }
        let allListings = await Listing.find({
            $or: [
                { country: { $regex: searchTerm, $options: "i" } },
                { location: { $regex: searchTerm, $options: "i" } },
                { title: { $regex: searchTerm, $options: "i" } }
            ]
        }).populate('reviews');

        if (allListings.length === 0) {
            req.flash("error", `No listings found for "${searchTerm}"`);
            return res.redirect("/listings");
        }
        res.render('listings/index.ejs', { allListings });
    })
);

// ================= CATEGORY ROUTES =================
app.get('/listings/category/:category',
    wrapAsync(async (req, res) => {
        let { category } = req.params;
        let dbCategory = category;
        if (category === "IconicCity" || category === "Iconic Cities") {
            dbCategory = "Iconic Cities";
        }
        let allListings = await Listing.find({ category: dbCategory }).populate('reviews');
        if (allListings.length === 0) {
            req.flash("error", `No listings found in category "${dbCategory}"`);
            return res.redirect("/listings");
        }
        res.render('listings/category.ejs', { allListings, activeCategory: category });
    })
);


// ================= CREATE ROUTE =================

app.post('/listings',
    isLoggedIn,
    upload.single('listing[image]'),
    wrapAsync(async (req, res) => {

        const newListing = new Listing(req.body.listing);
        newListing.owner = req.user._id;

        if (req.file) {
            newListing.image = { url: req.file.path, filename: req.file.filename };
        } else {
            newListing.image = {
                url: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=60",
                filename: "listingimage"
            };
        }

        // Geocode the provided location + country
        const locationStr = (req.body.listing.location || '').trim();
        const countryStr  = (req.body.listing.country  || '').trim();
        if (locationStr) {
            const geometry = await geocodeLocation(locationStr, countryStr);
            if (geometry) {
                newListing.geometry = geometry;
            } else {
                // Geocoding failed — do not save wrong coordinates.
                // Leave geometry empty; map.js will show a graceful fallback.
                console.warn(`Geocode failed for new listing: "${locationStr}, ${countryStr}"`);
            }
        }

        // Normalize amenities
        if (req.body.listing && req.body.listing.amenities) {
            const am = req.body.listing.amenities;
            const arr = Array.isArray(am) ? am : [am];
            newListing.amenities = [...new Set(arr.map(a => a.trim()))];
        } else {
            newListing.amenities = [];
        }

        await newListing.save();

        req.flash('success', 'Listing Created Successfully!');
        res.redirect(`/listings/${newListing._id}`);
    })
);


// ================= SHOW ROUTE =================

app.get('/listings/:id',
    wrapAsync(async (req, res) => {

        const { id } = req.params;

        const listing = await Listing.findById(id)
            .populate('owner')
            .populate({
                path: 'reviews',
                populate: {
                    path: 'author'
                }
            });

        if (!listing) {
            req.flash('error', 'Listing You Requested Does Not Exist!');
            return res.redirect('/listings');
        }

        // ── Detect listings that need geocoding ──────────────────────────────
        // 1. Missing geometry entirely
        // 2. Coordinates are exactly the old "New Delhi fallback" [77.209, 28.614]
        //    (within 0.01° tolerance) — these were saved by old buggy code
        const coords = listing.geometry && Array.isArray(listing.geometry.coordinates) &&
                       listing.geometry.coordinates.length === 2
                       ? listing.geometry.coordinates : null;

        const isNewDelhiFallback = coords &&
            Math.abs(coords[0] - 77.2090) < 0.01 &&
            Math.abs(coords[1] - 28.6139) < 0.01;

        const needsGeocode = !coords || isNewDelhiFallback;

        if (needsGeocode) {
            const geo = await geocodeLocation(listing.location, listing.country);
            if (geo) {
                listing.geometry = geo;
                await listing.save();
                console.log(`Auto-fixed geometry for: "${listing.title}" → [${geo.coordinates[1].toFixed(4)}, ${geo.coordinates[0].toFixed(4)}]`);
            } else {
                console.warn(`Geocode on show failed for: "${listing.location}, ${listing.country}"`);
            }
        }


        const today = new Date();
        const minCheckIn = today.toISOString().split('T')[0];
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const minCheckOut = tomorrow.toISOString().split('T')[0];

        res.render('listings/show.ejs', { listing, minCheckIn, minCheckOut });
    })
);

// ================= BOOKING - RESERVE ROUTE =================
app.post('/listings/:id/book',
    wrapAsync(async (req, res) => {
        const { id } = req.params;

        // If not logged in, save redirect URL and redirect to login
        if (!req.isAuthenticated()) {
            req.session.redirectUrl = `/listings/${id}`;
            req.flash('error', 'Please login first to make a booking.');
            return res.redirect('/login');
        }

        const { checkIn, checkOut, guests } = req.body;

        const listing = await Listing.findById(id);
        if (!listing) {
            req.flash('error', 'Listing not found.');
            return res.redirect('/listings');
        }

        if (!checkIn || !checkOut || !guests) {
            req.flash('error', 'Please select check-in, check-out and number of guests.');
            return res.redirect(`/listings/${id}`);
        }

        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);
        if (isNaN(checkInDate) || isNaN(checkOutDate) || checkOutDate <= checkInDate) {
            req.flash('error', 'Check-out date must be later than check-in date.');
            return res.redirect(`/listings/${id}`);
        }

        const guestCount = Number(guests);
        if (guestCount < 2 || guestCount > 8) {
            req.flash('error', 'Guests must be between 2 and 8.');
            return res.redirect(`/listings/${id}`);
        }

        const nightCount = Math.round((checkOutDate - checkInDate) / 86400000);
        if (nightCount < 1) {
            req.flash('error', 'Please choose at least 1 night.');
            return res.redirect(`/listings/${id}`);
        }

        const booking = new Booking({
            listing: listing._id,
            user: req.user._id,
            listingTitle: listing.title,
            listingLocation: `${listing.location}, ${listing.country}`,
            checkIn: checkInDate,
            checkOut: checkOutDate,
            guests: guestCount,
            pricePerNight: listing.price,
            nights: nightCount,
            totalPrice: listing.price * nightCount,
        });

        await booking.save();

        res.redirect(`/bookings/${booking._id}/payment`);
    })
);

app.get('/bookings',
    isLoggedIn,
    wrapAsync(async (req, res) => {
        const bookings = await Booking.find({ user: req.user._id }).populate('listing');
        res.render('bookings/index.ejs', { bookings });
    })
);

app.get('/bookings/:id/payment',
    isLoggedIn,
    wrapAsync(async (req, res) => {
        const booking = await Booking.findById(req.params.id).populate('listing');
        if (!booking || !booking.user.equals(req.user._id)) {
            req.flash('error', 'Booking not found.');
            return res.redirect('/bookings');
        }
        if (booking.status === 'confirmed') {
            req.flash('success', 'This booking is already confirmed.');
            return res.redirect('/bookings');
        }
        res.render('bookings/payment.ejs', { booking });
    })
);

app.post('/bookings/:id/pay',
    isLoggedIn,
    wrapAsync(async (req, res) => {
        const booking = await Booking.findById(req.params.id);
        if (!booking || !booking.user.equals(req.user._id)) {
            req.flash('error', 'Booking not found.');
            return res.redirect('/bookings');
        }
        booking.status = 'confirmed';
        await booking.save();
        req.flash('success', 'Payment successful! Your booking is confirmed.');
        res.redirect('/bookings');
    })
);


// ================= EDIT ROUTE =================

app.get('/listings/:id/edit',
    isLoggedIn,
    wrapAsync(async (req, res) => {

        const { id } = req.params;
        const listing = await Listing.findById(id).populate('owner');

        if (!listing) {
            req.flash('error', 'Listing Does Not Exist!');
            return res.redirect('/listings');
        }

        // Owner check
        const isOwner = listing.owner &&
            listing.owner.length > 0 &&
            listing.owner[0]._id &&
            listing.owner[0]._id.equals(req.user._id);

        if (!isOwner) {
            req.flash('error', "You don't have permission to edit this listing.");
            return res.redirect(`/listings/${id}`);
        }

        // Pass the original image URL so edit.ejs can show the current image
        const originalImageUrl = listing.image && listing.image.url
            ? listing.image.url
            : "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=60";

        res.render('listings/edit.ejs', { listing, originalImageUrl });
    })
);


// ================= UPDATE ROUTE =================

app.put('/listings/:id',
    isLoggedIn,
    upload.single('listing[image]'),
    wrapAsync(async (req, res) => {

        const { id } = req.params;
        let listing = await Listing.findById(id).populate('owner');

        if (!listing) {
            req.flash('error', 'Listing Does Not Exist!');
            return res.redirect('/listings');
        }

        // Owner check
        const isOwner = listing.owner &&
            listing.owner.length > 0 &&
            listing.owner[0]._id &&
            listing.owner[0]._id.equals(req.user._id);

        if (!isOwner) {
            req.flash('error', "You don't have permission to edit this listing.");
            return res.redirect(`/listings/${id}`);
        }

        // ── Capture OLD location BEFORE overwriting fields ─────────────────
        // IMPORTANT: must happen before listing.location is updated below,
        // otherwise locationChanged is always false.
        const oldLocation = listing.location;
        const oldCountry  = listing.country;

        // Update fields
        listing.title       = req.body.listing.title;
        listing.description = req.body.listing.description;
        listing.price       = req.body.listing.price;
        listing.location    = req.body.listing.location;
        listing.country     = req.body.listing.country;
        listing.category    = req.body.listing.category;

        if (req.file) {
            // Delete old image from Cloudinary if it's a cloudinary URL
            if (listing.image && listing.image.filename && listing.image.filename !== 'listingimage') {
                try {
                    await cloudinary.uploader.destroy(listing.image.filename);
                } catch (e) {
                    console.error('Cloudinary delete failed:', e);
                }
            }
            listing.image = { url: req.file.path, filename: req.file.filename };
        }

        // ── Re-geocode ONLY when location or country actually changed ───────
        const newLocation = (req.body.listing.location || '').trim();
        const newCountry  = (req.body.listing.country  || '').trim();
        const locationChanged = newLocation &&
            (oldLocation.trim() !== newLocation || oldCountry.trim() !== newCountry);

        if (locationChanged) {
            console.log(`Location changed: "${oldLocation}" → "${newLocation}", re-geocoding...`);
            const geometry = await geocodeLocation(newLocation, newCountry);
            if (geometry) {
                listing.geometry = geometry;
                console.log(`Re-geocoded "${newLocation}, ${newCountry}" → [${geometry.coordinates[1].toFixed(4)}, ${geometry.coordinates[0].toFixed(4)}]`);
            } else {
                // Geocoding failed — preserve existing coordinates, do NOT overwrite.
                console.warn(`Re-geocode failed for "${newLocation}, ${newCountry}". Keeping existing coordinates.`);
                req.flash('error', `Map could not be updated for "${newLocation}". Coordinates unchanged.`);
            }
        }


        // Normalize amenities
        if (req.body.listing && req.body.listing.amenities) {
            const am = req.body.listing.amenities;
            const arr = Array.isArray(am) ? am : [am];
            listing.amenities = [...new Set(arr.map(a => a.trim()))];
        } else {
            listing.amenities = [];
        }

        await listing.save();

        req.flash('success', 'Listing Updated Successfully!');
        res.redirect(`/listings/${id}`);
    })
);


// ================= DELETE ROUTE =================

app.delete('/listings/:id',
    isLoggedIn,
    wrapAsync(async (req, res) => {

        const { id } = req.params;
        const listing = await Listing.findById(id).populate('owner');

        if (!listing) {
            req.flash('error', 'Listing Does Not Exist!');
            return res.redirect('/listings');
        }

        // Owner check
        const isOwner = listing.owner &&
            listing.owner.length > 0 &&
            listing.owner[0]._id &&
            listing.owner[0]._id.equals(req.user._id);

        if (!isOwner) {
            req.flash('error', "You don't have permission to delete this listing.");
            return res.redirect(`/listings/${id}`);
        }

        await Listing.findByIdAndDelete(id);

        req.flash('success', 'Listing Deleted Successfully!');
        res.redirect('/listings');
    })
);


// ================= SIGNUP PAGE =================

app.get('/signup', (req, res) => {
    res.render('users/signup.ejs');
});


// ================= SIGNUP ROUTE =================

app.post('/signup',
    wrapAsync(async (req, res, next) => {
        try {
            const { username, email, password } = req.body;
            const newUser = new User({ email, username });
            const registeredUser = await User.register(newUser, password);
            req.login(registeredUser, (err) => {
                if (err) return next(err);
                req.flash('success', 'Welcome To WanderLust!');
                res.redirect('/listings');
            });
        } catch (err) {
            req.flash('error', err.message);
            res.redirect('/signup');
        }
    })
);


// ================= LOGIN PAGE =================

app.get('/login', (req, res) => {
    res.render('users/login.ejs');
});


// ================= LOGIN ROUTE =================

app.post(
    '/login',
    passport.authenticate('local', {
        failureRedirect: '/login',
        failureFlash: true,
    }),
    async (req, res) => {
        req.flash('success', 'Welcome Back To WanderLust!');
        let redirectUrl = req.session.redirectUrl || '/listings';
        delete req.session.redirectUrl;
        res.redirect(redirectUrl);
    }
);


// ================= LOGOUT ROUTE =================

app.get('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err);
        req.flash('success', 'Logged Out Successfully!');
        res.redirect('/listings');
    });
});


// ================= STATIC PAGES =================

app.get('/privacy', (req, res) => {
    res.render('privacy.ejs');
});

app.get('/terms', (req, res) => {
    res.render('terms.ejs');
});


// ================= PROFILE ROUTES =================

app.get('/profile',
    isLoggedIn,
    wrapAsync(async (req, res) => {
        const user = await User.findById(req.user._id);
        const listings = await Listing.find({ owner: req.user._id });
        const bookings = await Booking.find({ user: req.user._id });
        const reviews = await Review.find({ author: req.user._id });
        res.render('users/profile.ejs', { profileUser: user, listings, bookings, reviews });
    })
);

app.get('/profile/edit',
    isLoggedIn,
    wrapAsync(async (req, res) => {
        const user = await User.findById(req.user._id);
        res.render('users/editProfile.ejs', { profileUser: user });
    })
);

app.put('/profile',
    isLoggedIn,
    upload.single('profileImage'),
    wrapAsync(async (req, res) => {
        const user = await User.findById(req.user._id);

        if (req.body.username && req.body.username.trim()) {
            user.username = req.body.username.trim();
        }

        if (req.file) {
            // Delete old profile image if exists
            if (user.profileImage && user.profileImage.filename) {
                try {
                    await cloudinary.uploader.destroy(user.profileImage.filename);
                } catch (e) {
                    console.error('Cloudinary profile image delete failed:', e);
                }
            }
            user.profileImage = { url: req.file.path, filename: req.file.filename };
        }

        await user.save();
        req.flash('success', 'Profile updated successfully!');
        res.redirect('/profile');
    })
);


// ================= REVIEW CREATE ROUTE =================

app.post(
    '/listings/:id/reviews',
    isLoggedIn,
    wrapAsync(async (req, res) => {

        const listing = await Listing.findById(req.params.id);

        if (!listing) {
            req.flash('error', 'Listing Not Found!');
            return res.redirect('/listings');
        }

        // Prevent owner from reviewing own listing
        const isOwner = listing.owner &&
            listing.owner.length > 0 &&
            listing.owner[0] &&
            listing.owner[0].equals(req.user._id);

        if (isOwner) {
            req.flash('error', 'Owners cannot review their own listings.');
            return res.redirect(`/listings/${listing._id}`);
        }

        // Create Review
        const newReview = new Review(req.body.review);
        newReview.author = req.user._id;

        await newReview.save();
        listing.reviews.push(newReview);
        await listing.save();

        req.flash('success', 'Review Added Successfully!');
        res.redirect(`/listings/${listing._id}`);
    })
);


// ================= REVIEW DELETE ROUTE =================

app.delete(
    '/listings/:id/reviews/:reviewId',
    isLoggedIn,
    wrapAsync(async (req, res) => {

        const { id, reviewId } = req.params;
        const review = await Review.findById(reviewId).populate('author');
        const listing = await Listing.findById(id).populate('owner');

        // Allow deletion by review author or listing owner
        const isAuthor = review &&
            review.author &&
            review.author._id &&
            review.author._id.equals(req.user._id);

        const isOwner = listing &&
            listing.owner &&
            listing.owner.length > 0 &&
            listing.owner[0]._id &&
            listing.owner[0]._id.equals(req.user._id);

        if (!isAuthor && !isOwner) {
            req.flash('error', 'You can delete only your own reviews.');
            return res.redirect(`/listings/${id}`);
        }

        await Listing.findByIdAndUpdate(id, {
            $pull: { reviews: reviewId },
        });

        await Review.findByIdAndDelete(reviewId);

        req.flash('success', 'Review Deleted Successfully!');
        res.redirect(`/listings/${id}`);
    })
);


// ================= 404 ROUTE =================

app.use((req, res, next) => {
    next(new ExpressError(404, 'Page Not Found'));
});


// ================= GLOBAL ERROR HANDLER =================

app.use((err, req, res, next) => {
    let { statusCode = 500 } = err;
    if (!err.message) {
        err.message = 'Something Went Wrong!';
    }
    res.status(statusCode).render('error.ejs', {
        error: err,
    });
});


const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});