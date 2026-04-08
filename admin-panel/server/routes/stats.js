const router = require('express').Router();
const fs = require('fs');
const { STATS_PATH } = require('../utils/paths');

router.get('/', (req, res) => {
  try {
    const stats = JSON.parse(fs.readFileSync(STATS_PATH, 'utf-8'));
    res.json(stats);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
