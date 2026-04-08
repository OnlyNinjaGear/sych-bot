const router = require('express').Router();
const fs = require('fs');
const { BOT_SETTINGS_PATH, ENV_PATH, BOT_ROOT } = require('../utils/paths');
const { parseEnvFile, structuredConfig } = require('../utils/env-parser');
const DEFAULT_SYSTEM_PROMPT = require(require('path').join(BOT_ROOT, 'src/core/default-prompt'));

let cachedSettings = null;
let cachedEnv = null;

fs.watchFile(BOT_SETTINGS_PATH, () => { cachedSettings = null; });
fs.watchFile(ENV_PATH, () => { cachedEnv = null; });

function readSettings() {
  if (!cachedSettings) {
    try { cachedSettings = JSON.parse(fs.readFileSync(BOT_SETTINGS_PATH, 'utf-8')); }
    catch { cachedSettings = {}; }
  }
  return cachedSettings;
}

function readEnv() {
  if (!cachedEnv) {
    try { cachedEnv = structuredConfig(parseEnvFile(ENV_PATH)); }
    catch { cachedEnv = {}; }
  }
  return cachedEnv;
}

router.post('/', async (req, res) => {
  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages required' });
  }

  const settings = readSettings();
  const env = readEnv();

  const systemPrompt = settings.systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT;
  const model = req.body.model || settings.mainModel || 'google/gemma-3-27b-it:free';
  const apiKey = env.ai?.AI_API_KEY;
  const baseUrl = (env.ai?.AI_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '');

  if (!apiKey) {
    return res.status(400).json({ error: 'AI_API_KEY не настроен — проверь раздел Настройки' });
  }

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: { message: response.statusText } }));
      return res.status(response.status).json({ error: err.error?.message || response.statusText });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? '';
    res.json({ content, usage: data.usage, model: data.model || model });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
