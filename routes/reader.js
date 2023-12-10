const express = require('express');
const router = express.Router();
const mysql = require('mysql');
const axios = require('axios');
const bcrypt = require('bcryptjs');
// Create a MySQL database connection
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

router.get('/', (req, res) => {
  // Fetch news data
  const apiKey = process.env.NEWS_API_KEY; 
  const apiUrl = 'https://newsapi.org/v2/top-headlines?country=us&category=business';

  axios.get(apiUrl, {
    headers: {
      'X-Api-Key': apiKey,
    },
  })
    .then(newsResponse => {
      const newsData = newsResponse.data.articles;

      // Fetch articles
      db.query("SELECT * FROM articles WHERE article_status=true ORDER BY article_published_time DESC", (err, articles) => {
        if (err) {
          console.error(err);
          res.status(500).json({ message: 'Error retrieving articles' });
        } else {
          res.render('reader/mainReader.ejs', { articles, newsData });
        }
      });
    })
    .catch(error => {
      console.error(error);
      res.status(500).json({ message: 'Error fetching news data' });
    });
});


router.get('/about', (req, res) => {
  res.render('reader/aboutPage.ejs');
});

// Getting published articles and implementing search tag filter functionality
router.get('/articles', (req, res) => {
  const tag = req.query.tag; // Get the selected tag from query 

  // Construct the SQL query to retrieve articles with the selected tag
  let query = "SELECT * FROM articles WHERE article_status = ?";
  let params = 1; // By default is get published articles

  if (tag) {
    query += " AND article_tags LIKE ?";
    params.push(`%${tag}%`);
  }

  query += " ORDER BY article_published_time DESC";

  db.query(query, params, (err, articles) => {
    if (err) {
      console.error(err);
      res.status(500).json({ message: 'Error retrieving articles' });
    } else {
      res.render('reader/mainReader.ejs', { articles });
    }
  });
});


module.exports = router;
