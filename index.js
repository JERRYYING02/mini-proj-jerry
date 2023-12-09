const express = require('express')
const app = express()
const port = 3000
const bodyParser = require('body-parser');
const mysql = require('mysql');
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


// Parse incoming requests with JSON and URL-encoded payload
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Set maximum request body size to 10MB
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

const authorRoutes = require('./routes/author')
const readerRoutes = require('./routes/reader')
const errorPageRoutes = require('./routes/errorPage')

// Set the view engine to use EJS for rendering
app.set('view engine', 'ejs')

// Serve static files from the 'public' directory
app.use(express.static('public'))
app.use('public/css', express.static(__dirname + 'public/css'))

// Register routes for authors, readers, and error pages
app.use('/author', authorRoutes)
app.use('/', readerRoutes)
app.use('/', errorPageRoutes)

// Start the server and listen on the specified port
app.listen(port, () => {
  console.log(`Blog app listening on port ${port}`)
})
