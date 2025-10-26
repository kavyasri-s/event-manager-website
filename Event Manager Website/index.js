
/*index.js
This is your main app entry point
Sets up middleware, database connection,session handling
login/logout routes, mounts route modules*/

//load environment variables from .env
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

//middleware setup

//parse url-encoded form data
app.use(bodyParser.urlencoded({ extended: true }));

//set EJS as view engine
app.set('view engine', 'ejs');

//serve static files like CSS from/public
app.use(express.static(__dirname + '/public'));

//set up SQLite database
global.db = new sqlite3.Database('./database.db', function (err) {
  if (err) {
    console.error(err);
    process.exit(1);
  } else {
    console.log("Database connected");
    global.db.run("PRAGMA foreign_keys=ON");
  }
});

//session setup
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 //24 hours
  }
  })
);

//middleware to protect organiser routes w login

/*organiserAuth
purpose: middleware to restrict access to organiser routes
inputs: req.path (requested route), req.session (user session)
output: call next() if authenticated, otherwise redirect to login pg*/

function organiserAuth(req, res, next) {
  const publicPaths = ['/login'];
  if (publicPaths.includes(req.path)) return next();
  if (req.session && req.session.isOrganiserLoggedIn) return next();
  res.redirect('/organiser/login');
}

//apply organiserAuth middleware to only /organiser routes
app.use('/organiser', organiserAuth);

//organiser login/logout routes

/*GET /organiser/login
render the organiser login form
output: renders organiser-login.ejs*/

app.get('/organiser/login', (req, res) => {
  res.render('organiser-login', { error: null });
});

/*POST /organiser/login
process login form submission
input: password from form
output: redirect to organiser home if correct, otherwise reload with error*/

app.post('/organiser/login', (req, res) => {
  const { password } = req.body;
  if (password === process.env.ORG_PASSWORD) {
    req.session.isOrganiserLoggedIn = true;
    return res.redirect('/organiser');
  } else {
    return res.render('organiser-login', { error: 'Incorrect password' });
  }
});

/*GET /organiser/logout
logs out the organiser by destroying the session
output: redirects to login pg*/

app.get('/organiser/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/organiser/login');
  });
});

//public home page route

/*GET /
renders main home page that is public-facing
output: renders main-home.ejs*/

app.get('/', (req, res) => {
  res.render('main-home');
});

//mount modular routes

//all /organiser routes
const organiserRoutes = require('./routes/organiser');
app.use('/organiser', organiserRoutes);

const attendeeRoutes = require('./routes/attendee');
app.use('/attendee', attendeeRoutes);

const siteSettingsRoutes = require('./routes/siteSettings');
app.use('/site-settings', siteSettingsRoutes);

//start server
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

