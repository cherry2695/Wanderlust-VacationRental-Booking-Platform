const express = require('express');
const router = express.Router();

//POST
router.get('/', (req, res) => {
  res.send('Get for posts');
});

router.post('/', (req, res) => {
  res.send('Creating a new post');
});

router.get('/:id', (req, res) => {
  res.send('Showing a post id');
});

router.delete('/:id', (req, res) => {
  res.send('Deleting a post');
});

module.exports = router;