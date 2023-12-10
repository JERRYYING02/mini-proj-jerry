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

module.exports = router;
