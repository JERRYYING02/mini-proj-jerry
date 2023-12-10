const express = require('express');
const router = express.Router();

//Direct to partial of error 404 page
router.get('/*', (req, res) => {
      res.status(404).render('partials/404.ejs');
});

module.exports = router;
