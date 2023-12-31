
const express = require('express');
const router = express.Router();
const requestIp = require('request-ip');
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


const getClientIp = (req) => requestIp.getClientIp(req) || req.connection.remoteAddress;
console.log(getClientIp)

// main reader route
router.get('/', async (req, res) => {
  const clientIp = getClientIp(req);
  console.log(clientIp)
  try {
    
    // geolocation API to get user's location
    const cityResponse = await axios.get(`https://ipapi.co/${clientIp}/json/`);
    const city = cityResponse.data.city;
    const lat = cityResponse.data.latitude;
    const lon = cityResponse.data.longitude;
    const apiKeyWeather = process.env.WEATHER_API_KEY; 
    // request to the OpenWeatherMap API
    const tempResponse = await axios.get(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKeyWeather}&units=metric`);
    const temperature = tempResponse.data.main.temp;
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
            //show city info also
            res.render('reader/mainReader.ejs', { articles, newsData, temperature,city  });
          }
        });
      })
      .catch(error => {
        console.error(error);
        res.status(500).json({ message: 'Error fetching news data' });
      });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching weather data' });
  }
});



//get about page
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

// Add a new route to view a user's profile
router.get('/profile/:username', (req, res) => {
  const username = req.params.username;
  
  // Query the users table to get the user's bio
  db.query('SELECT bio FROM users WHERE username = ?', [username], (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).json({ message: 'Error retrieving user bio' });
    } else {
      if (result.length === 1) {
        // Render the user's profile page, passing the bio
        const bio = result[0].bio;
        res.render('reader/profilePage.ejs', { username, bio });
      } else {
        // Handle case when user does not exist
        res.status(404).json({ message: 'User not found' });
      }
    }
  });
});

//get individual articles,get comments and article visits
router.get('/article/:article_id', (req, res) => {
  const article_id = req.params.article_id;

  // Increment article visits by 1
  db.query('UPDATE articles SET article_visits = article_visits + 1 WHERE article_id = ?', [article_id], (err) => {
    if (err) {
      console.error(err);
    }
    // get article information
    db.query('SELECT * FROM articles WHERE article_id = ?', [article_id], (err, result) => {
      if (err) {
        console.error(err);
        res.status(500).json({ message: 'Error retrieving article' });
      } else if (result.length === 1) {
        const article = result[0];

        // Retrieve comments
        db.query('SELECT * FROM article_comments WHERE article_id = ? ORDER BY comment_created_time DESC', [article_id], (err, comments) => {
          if (err) {
            console.error(err);
            res.status(500).json({ message: 'Error retrieving comments' });
          } else {
            res.render('reader/article', { article, comments });
          }
        });
      } else {
        res.status(404).json({ message: 'Article not found' });
      }
    });
  });
});



// Article like functionality
router.put('/article/:article_id/like', (req, res) => {
  const article_id = req.params.article_id;

  db.query('SELECT * FROM articles WHERE article_id = ?', [article_id], (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).json({ message: 'Error retrieving article' });
    } else if (result.length === 1) {
      const article = result[0];
      const likes = article.article_likes+1;
      db.query('UPDATE articles SET article_likes = ? WHERE article_id = ?', [likes, article_id], (err) => {
        if (err) {
          console.error(err);
          res.status(500).json({ message: 'Error updating article likes' });
        } else {
          res.json({ message: 'Article like successfully' });
        }
      });
    } else {
      res.status(404).json({ message: 'Article not found' });
    }
  });
});

// Comment article functionality
router.post('/article/:article_id/comment', (req, res) => {
  const article_id = req.params.article_id;
  const { comment_name, comment_content } = req.body;

  db.query('INSERT INTO article_comments (comment_name, comment_content, article_id) VALUES (?, ?, ?)', [comment_name, comment_content, article_id], (err) => {
    if (err) {
      console.error(err);
      res.status(500).json({ message: 'Error adding comment' });
    } else {
      res.json({ message: 'Comment added successfully' });
    }
  });
});

// Like comment functionality
router.put('/article/:article_id/comment/:comment_id/like', (req, res) => {
  const comment_id = req.params.comment_id;

  db.query('SELECT * FROM article_comments WHERE comment_id = ?', [comment_id], (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).json({ message: 'Error retrieving comment' });
    } else if (result.length === 1) {
      const comment = result[0];
      const likes = comment.comment_likes +1;
      db.query('UPDATE article_comments SET comment_likes = ? WHERE comment_id = ?', [likes, comment_id], (err) => {
        if (err) {
          console.error(err);
          res.status(500).json({ message: 'Error updating comment likes' });
        } else {
          res.json({ message: 'Comment liked successfully' });
        }
      });
    } else {
      res.status(404).json({ message: 'Comment not found' });
    }
  });
});

// Delete Comment
router.delete('/article/:article_id/comment/:comment_id/delete', (req, res) => {
  const comment_id = req.params.comment_id;
  db.query('DELETE FROM article_comments WHERE comment_id = ?', [comment_id], (err) => {
    if (err) {
      console.error(err);
      res.status(500).json({ message: 'Error deleting comment' });
    } else {
      res.json({ message: 'Comment deleted successfully' });
    }
  });
});

// Emoji article functionality
router.put('/article/:article_id/emoji/:emoji', (req, res) => {
  const article_id = req.params.article_id;
  const emoji = req.params.emoji;

  db.query('SELECT * FROM articles WHERE article_id = ?', [article_id], (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).json({ message: 'Error getting article' });
    } else if (result.length === 1) {
      const article = result[0];
      let emojiTypeCounter;
      let emojiValue;

      //differentiate emoji types
      switch (emoji) {
        case 'love':
          emojiTypeCounter = 'emoji_love_counter';
          emojiValue = article.emoji_love_counter +1;
          break;
        case 'haha':
          emojiTypeCounter = 'emoji_haha_counter';
          emojiValue = article.emoji_haha_counter +1;
          break;
        default:
          res.status(400).json({ message: 'Invalid emoji' });
          return;
      }

      db.query(`UPDATE articles SET ${emojiTypeCounter} = ? WHERE article_id = ?`, [emojiValue, article_id], (err) => {
        if (err) {
          res.status(500).json({ message: 'Error updating emoji counter' });
        } else {
          res.json({ message: 'Emoji reacted successfully' });
        }
      });
    } else {
      res.status(404).json({ message: 'Article not found' });
    }
  });
});

// Add a new route for searching articles
router.get('/search', (req, res) => {
  const query = req.query.query.toLowerCase().trim();

  // Query the database to find articles that match the query
  const sql = "SELECT article_title FROM articles WHERE article_title LIKE ?";
  const params = [`%${query}%`];

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error(err);
      res.status(500).json({ message: 'Error searching for articles' });
    } else {
      res.json(results); // Respond with the matching article titles
    }
  });
});

module.exports = router;
