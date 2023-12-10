const express = require('express');
const router = express.Router();
const mysql = require('mysql');
// bcrypt used to hash passwords before store in database
const bcrypt = require('bcrypt');
const session = require('express-session');
const { body, validationResult } = require('express-validator');
require('dotenv').config()

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
  } else {
    console.log('Connected to MySQL');
  }
});

router.use(
  session({
    secret: process.env.SECRET_KEY,
    resave: false,
    saveUninitialized: true,
  })
);
// check if the user is authenticated
const checkAuthentication = (req, res, next) => {
  if (req.session.user) {
    // Allow access to the route when the user is authenticated
    next();
  } else {
    // Redirect to login
    res.redirect('/author/login');
  }
};

// Get all articles
router.get('/', checkAuthentication, (req, res) => {
  db.query(
    "SELECT * FROM articles WHERE article_status=true ORDER BY article_last_modified DESC",
    (err, published_articles) => {
      if (err) {
        console.error(err);
        res.status(500).json({ message: 'Error retrieving published articles' });
        return; // Return early to avoid further execution
      }

      db.query(
        "SELECT * FROM articles WHERE article_status=false ORDER BY article_last_modified DESC",
        (err, draft_articles) => {
          if (err) {
            console.error(err);
            res.status(500).json({ message: 'Error retrieving draft articles' });
            return; // Return early to avoid further execution
          }

          res.render('author/mainAuthor', {
            published_articles: published_articles ||[], // Ensure it's an array
            draft_articles: draft_articles ||[], // Ensure it's an array
            req: req,
          });
        }
      );
    }
  );
});

// Signup route
router.get('/signup', (req, res) => {
  res.render('author/signup', {});
});

router.post('/signup', [
  // Define validation and sanitization rules using Express Validator
  body('username')
      .notEmpty()
      .withMessage('Email is required')
      .isEmail()
      .withMessage('Invalid email address')
      .normalizeEmail(), // Sanitize the email
  body('password')
      .notEmpty()
      .withMessage('Password is required')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long')
      .matches(/\d/)
      .withMessage('Password must contain at least one number')
      .matches(/[!@#$%^&*]/)
      .withMessage('Password must contain at least one special character')
      .trim(), // Remove leading and trailing whitespace from the password field
], (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);

  // If there are validation errors, return errors 
  if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
  }

  const { username, password } = req.body;

  // Check if the username already exists in the database
  db.query('SELECT * FROM users WHERE username = ?', [username], (err, existingUser) => {
      if (err) {
          console.error(err);
          return res.status(500).json({ message: 'Error username availability' });
      }

      if (existingUser.length > 0) {
          // Username already exists
          return res.status(409).json({ message: 'Username taken' });
      }

      // Username is available, proceed with user registration logic
      // Hash the password and insert the user into the database
      bcrypt.hash(password, 10, (err, hashedPassword) => {
          if (err) {
              console.error(err);
              return res.status(500).json({ message: 'Error creating user' });
          } else {
              db.query(
                  'INSERT INTO users (username, password) VALUES (?, ?)',
                  [username, hashedPassword],
                  (err) => {
                      if (err) {
                          console.error(err);
                          return res.status(500).json({ message: 'Error creating user' });
                      } else {
                          req.session.user = {
                              username: username,
                          };
                          return res.json({ message: 'User successfully created' });
                      }
                  }
              );
          }
      });
  });
});




module.exports = router;