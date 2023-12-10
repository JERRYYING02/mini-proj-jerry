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
    cookie: {
      secure: true,
      httpOnly: true,
      maxAge: 3600000, //1 hour 
    },
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

// Login route
router.get('/login', (req, res) => {
  res.render('author/login');
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;

  db.query('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) {
      console.error(err);
      res.status(500).json({ message: 'Error retrieving user' });
    } else if (user.length === 0) {
      res.status(401).json({ message: 'User not found' });
    } else {
      bcrypt.compare(password, user[0].password, (err, result) => {
        if (err) {
          console.error(err);
          res.status(500).json({ message: 'Error comparing passwords' });
        } else if (result) {
          req.session.user = {
            username: user[0].username,
          };
          res.json({ message: 'Login successful' });
        } else {
          res.status(401).json({ message: 'Invalid username or password' });
        }
      });
    }
  });
});

// Logout route
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    res.redirect('/author/login');
  });
});

// Blog settings
router.get('/blogPageSettings', checkAuthentication,(req, res) => {
  const username = req.session.user.username;
  db.query('SELECT bio FROM users WHERE username = ?', [username], (err, user) => {
    if (err) {
      console.error(err);
      res.status(500).json({ message: 'Error retrieving user bio' });
    } else {
      res.render('author/blogPageSettings', {
        username,
        userBio: user[0].bio, // Pass the user's bio to the template
      });
    }
  });
});


router.put('/blogPageSettings', (req, res) => {
  const { blog_subtitle } = req.body;
  const username = req.session.user.username;

  db.query(
    'UPDATE users SET bio = ? WHERE username = ?',
    [blog_subtitle, username],
    (err) => {
      res.json({ message: 'Blog settings successfully updated' });
    }
  );
});

// Create new article
router.get('/createNewArticle', (req, res) => {
  res.render('author/createNewArticle', {});
});

router.post('/createNewArticle', (req, res) => {
  const { article_title, article_subtitle, article_content, article_tags } = req.body;

  const username = req.session.user.username;

  db.query(
    'INSERT INTO articles (article_title, article_subtitle, article_content, article_author, article_tags) VALUES (?, ?, ?, ?, ?)',
    [article_title, article_subtitle, article_content, username, article_tags],
    (err) => {
      if (err) {
        console.error(err);
        res.status(500).json({ message: 'Error creating article' });
      } else {
        res.json({ message: 'Article successfully created' });
      }
    }
  );
});

// Edit article
router.get('/editArticle/:article_id', (req, res) => {
  const article_id = req.params.article_id;

  db.query('SELECT * FROM articles WHERE article_id = ?', [article_id], (err, article) => {
    if (err) {
      console.error(err);
      res.status(500).json({ message: 'Error retrieving article' });
    } else {
      res.render('author/editArticle', {
        article: article[0],
      });
    }
  });
});

router.put('/editArticle/:article_id', (req, res) => {
  const article_id = req.params.article_id;
  const { article_title, article_subtitle, article_content } = req.body;

  db.query(
    'UPDATE articles SET article_title = ?, article_subtitle = ?, article_content = ?, article_last_modified = CURRENT_TIMESTAMP WHERE article_id = ?',
    [article_title, article_subtitle, article_content, article_id],
    (err) => {
      if (err) {
        console.error(err);
        res.status(500).json({ message: 'Error updating article' });
      } else {
        res.json({ message: 'Article successfully updated' });
      }
    }
  );
});

// Update status of published and drafted articles
router.put('/article/:article_id/:action', (req, res) => {
  const article_id = req.params.article_id;
  const selectedParam = req.params.action;

  let query, status;
  if (selectedParam === 'publish') {
    query = 'UPDATE articles SET article_status = ?, article_published_time = CURRENT_TIMESTAMP WHERE article_id = ?';
    status = true; // Set status to true for "Published"
  } else if (selectedParam === 'draft') {
    query = 'UPDATE articles SET article_status = ?, article_last_modified = CURRENT_TIMESTAMP WHERE article_id = ?';
    status = false; // Set status to false for "Draft"
  } else {
    return res.status(400).json({ message: 'Invalid params' });
  }

  db.query(query, [status, article_id], (err) => {
    if (err) {
      console.error(err);
      res.status(500).json({ message: 'Error updating article status' });
    } else {
      res.json({ message: 'Article status successfully updated' });
    }
  });
});

// Delete articles
router.delete('/article/:article_id', (req, res) => {
  const article_id = req.params.article_id;

  db.query('DELETE FROM article_comments WHERE article_id = ?', [article_id], (err) => {
    if (err) {
      console.error(err);
      res.status(500).json({ message: 'Error deleting article comments' });
    } else {
      db.query('DELETE FROM articles WHERE article_id = ?', [article_id], (err) => {
        if (err) {
          console.error(err);
          res.status(500).json({ message: 'Error deleting article' });
        } else {
          res.json({ message: 'Article successfully deleted' });
        }
      });
    }
  });
});


module.exports = router;
