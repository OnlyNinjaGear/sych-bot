const router = require('express').Router();
const fs = require('fs');
const { PROFILES_PATH, CHAT_PROFILES_PATH, DB_PATH } = require('../utils/paths');

router.get('/', (req, res) => {
  try {
    const profiles = JSON.parse(fs.readFileSync(PROFILES_PATH, 'utf-8'));
    let chatNames = {};
    try {
      const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
      Object.entries(db.chats || {}).forEach(([id, chat]) => {
        chatNames[id] = chat.name || id;
      });
    } catch {}
    res.json({ profiles, chatNames });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/chats', (req, res) => {
  try {
    const chatProfiles = JSON.parse(fs.readFileSync(CHAT_PROFILES_PATH, 'utf-8'));
    res.json(chatProfiles);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
