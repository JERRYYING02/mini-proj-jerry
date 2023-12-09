
PRAGMA foreign_keys=ON;

BEGIN TRANSACTION;

-- Create tables for the articles
CREATE TABLE IF NOT EXISTS articles (
    article_id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_title TEXT NOT NULL,
    article_subtitle TEXT NOT NULL,
    article_content TEXT NOT NULL,
    article_author TEXT NOT NULL,
    article_likes INTEGER NULL DEFAULT 0,
    emoji_love_counter INTEGER DEFAULT 0,
    emoji_haha_counter INTEGER DEFAULT 0,
    article_created_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    article_last_modified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    article_published_time TIMESTAMP NULL DEFAULT NULL,
    article_status TEXT NOT NULL DEFAULT 'Draft',
    article_tags TEXT NOT NULL,
    article_visits INTEGER NOT NULL DEFAULT 0,
    article_read_time INTEGER NOT NULL DEFAULT 0,
    username TEXT,
    FOREIGN KEY (username) REFERENCES users(username)
);

-- Create tables for the comments
--article_id column in the article_comments table references the article_id column in the articles table
CREATE TABLE IF NOT EXISTS article_comments (
    
    comment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    comment_name TEXT NOT NULL,
    comment_content TEXT NOT NULL,
    comment_likes INTEGER NULL DEFAULT 0,
    comment_created_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    comment_updated_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    article_id INTEGER,
    FOREIGN KEY (article_id) REFERENCES articles(article_id)
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    password TEXT,
    bio TEXT
);


--insert default data
INSERT INTO users (bio) VALUES (' ');

COMMIT;
