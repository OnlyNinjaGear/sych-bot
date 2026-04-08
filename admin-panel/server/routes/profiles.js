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

// Сбросить профиль юзера в чате
router.delete('/:chatId/:userId', (req, res) => {
  try {
    const profiles = JSON.parse(fs.readFileSync(PROFILES_PATH, 'utf-8'));
    if (profiles[req.params.chatId]?.[req.params.userId]) {
      delete profiles[req.params.chatId][req.params.userId];
      fs.writeFileSync(PROFILES_PATH, JSON.stringify(profiles, null, 2));
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Сбросить все профили чата
router.delete('/:chatId', (req, res) => {
  try {
    const profiles = JSON.parse(fs.readFileSync(PROFILES_PATH, 'utf-8'));
    if (profiles[req.params.chatId]) {
      delete profiles[req.params.chatId];
      fs.writeFileSync(PROFILES_PATH, JSON.stringify(profiles, null, 2));
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Обновить репутацию юзера
router.put('/:chatId/:userId/reputation', (req, res) => {
  try {
    const { value } = req.body;
    const profiles = JSON.parse(fs.readFileSync(PROFILES_PATH, 'utf-8'));
    if (profiles[req.params.chatId]?.[req.params.userId]) {
      profiles[req.params.chatId][req.params.userId].relationship = Math.min(100, Math.max(0, parseInt(value) || 50));
      fs.writeFileSync(PROFILES_PATH, JSON.stringify(profiles, null, 2));
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
