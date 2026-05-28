const express = require('express');
const app = express();

const userRoutes = require('./routes/user.js');
const postRoutes = require('./routes/post.js');

const session = require('express-session');
const flash = require('connect-flash');
const cookieParser = require('cookie-parser');

const path = require('path');

// ================= VIEW ENGINE =================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ================= MIDDLEWARE =================
app.use(express.urlencoded({ extended: true }));

// ================= COOKIE PARSER =================
app.use(cookieParser('secretcode'));

// ================= SESSION =================
const sessionOptions = {
  secret: 'thisshouldbeabettersecret',
  resave: false,
  saveUninitialized: true
};

app.use(session(sessionOptions));

// ================= FLASH =================
app.use(flash());

// ================= RES.LOCALS MIDDLEWARE =================
app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  next();
});

// ================= ROUTES =================

// REGISTER ROUTE
app.get('/register', (req, res) => {

  let { name = 'anonymous' } = req.query;

  req.session.name = name;

  req.flash('success', 'Welcome to the site!');

  res.redirect('/hello');
});

// HELLO ROUTE
app.get('/hello', (req, res) => {

  res.render('page.ejs', {
    name: req.session.name
  });
});

// REQUEST COUNT ROUTE
app.get('/reqcount', (req, res) => {

  if (req.session.count) {
    req.session.count += 1;
  } else {
    req.session.count = 1;
  }

  res.send(`You have made ${req.session.count} requests!`);
});

// SIGNED COOKIES
app.get('/getsignedcookies', (req, res) => {

  res.cookie('madein', 'India', { signed: true });

  res.send('Signed cookie has been set!');
});

// VERIFY SIGNED COOKIE
app.get('/verify', (req, res) => {

  console.log(req.signedCookies);

  res.send('Verified signed cookie!');
});

// NORMAL COOKIES
app.get('/getcookies', (req, res) => {

  res.cookie('greet', 'hello');
  res.cookie('madein', 'India');

  res.send('Cookie has been set!');
});

// GREET ROUTE
app.get('/greet', (req, res) => {

  let { name = 'anonymous' } = req.cookies;

  res.send(`Hello ${name}!`);
});

// HOME ROUTE
app.get('/', (req, res) => {

  console.dir(req.cookies);

  res.send('Hello World!');
});

// USER & POST ROUTES
app.use('/users', userRoutes);
app.use('/posts', postRoutes);

// ================= SERVER =================
app.listen(3000, () => {
  console.log('Serving on port 3000');
});