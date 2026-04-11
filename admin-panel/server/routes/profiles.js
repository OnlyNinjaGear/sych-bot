const router = require('express').Router();
const fs = require('fs');
const { PROFILES_PATH, CHAT_PROFILES_PATH, DB_PATH } = require('../utils/paths');

function readProfiles() {
  return JSON.parse(fs.readFileSync(PROFILES_PATH, 'utf-8'));
}
function writeProfiles(data) {
  fs.writeFileSync(PROFILES_PATH, JSON.stringify(data, null, 2));
}

router.get('/', (req, res) => {
  try {
    const profiles = readProfiles();
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

// Обновить репутацию юзера
router.put('/:chatId/:userId/reputation', (req, res) => {
  try {
    const { value } = req.body;
    const profiles = readProfiles();
    if (profiles[req.params.chatId]?.[req.params.userId]) {
      profiles[req.params.chatId][req.params.userId].relationship = Math.min(100, Math.max(0, parseInt(value) || 50));
      writeProfiles(profiles);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Обновить профиль чата
router.put('/chats/:chatId', (req, res) => {
  try {
    const chatProfiles = JSON.parse(fs.readFileSync(CHAT_PROFILES_PATH, 'utf-8'));
    const { topic, facts, style } = req.body;
    if (!chatProfiles[req.params.chatId]) chatProfiles[req.params.chatId] = {};
    if (topic !== undefined) chatProfiles[req.params.chatId].topic = String(topic).substring(0, 200);
    if (facts !== undefined) chatProfiles[req.params.chatId].facts = String(facts).substring(0, 500);
    if (style !== undefined) chatProfiles[req.params.chatId].style = String(style).substring(0, 100);
    chatProfiles[req.params.chatId].lastUpdated = Date.now();
    fs.writeFileSync(CHAT_PROFILES_PATH, JSON.stringify(chatProfiles, null, 2));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Сбросить профиль юзера в чате (BEFORE /:chatId to avoid matching)
router.delete('/:chatId/:userId', (req, res) => {
  try {
    const profiles = readProfiles();
    if (profiles[req.params.chatId]?.[req.params.userId]) {
      delete profiles[req.params.chatId][req.params.userId];
      writeProfiles(profiles);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Сбросить все профили чата
router.delete('/:chatId', (req, res) => {
  try {
    const profiles = readProfiles();
    if (profiles[req.params.chatId]) {
      delete profiles[req.params.chatId];
      writeProfiles(profiles);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
