const router = require('express').Router();
const fs = require('fs');
const { BOT_SETTINGS_PATH } = require('../utils/paths');

// GET /api/ollama/models — проксирует /v1/models к LM Studio / Ollama
router.get('/models', async (req, res) => {
  try {
    const settings = JSON.parse(fs.readFileSync(BOT_SETTINGS_PATH, 'utf-8'));
    const baseUrl = settings.ollamaBaseUrl || 'http://192.168.0.29:11434/v1';
    const url = `${baseUrl.replace(/\/+$/, '')}/models`;

    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return res.status(502).json({ error: `LM Studio вернул ${response.status}` });

    const data = await response.json();
    const models = (data.data || []).map(m => m.id).filter(Boolean);
    res.json({ models });
  } catch (e) {
    res.status(503).json({ error: e.message });
  }
});

module.exports = router;
