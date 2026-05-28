const express = require('express');
const router = express.Router();

//USERS
router.get('/', (req, res) => {
  res.send('Get for users');
});

router.post('/', (req, res) => {
  res.send('Creating a new user');
});

router.get('/:id', (req, res) => {
  res.send('Showing a user id');
});

router.delete('/:id', (req, res) => {
  res.send('Deleting a user');
});

module.exports = router;