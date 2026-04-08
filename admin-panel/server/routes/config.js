const router = require('express').Router();
const { parseEnvFile, writeEnvFile, structuredConfig } = require('../utils/env-parser');
const { ENV_PATH } = require('../utils/paths');

router.get('/', (req, res) => {
  try {
    const envMap = parseEnvFile(ENV_PATH);
    res.json(structuredConfig(envMap));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/', (req, res) => {
  try {
    writeEnvFile(ENV_PATH, req.body);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/gemini-keys', (req, res) => {
  try {
    const { key } = req.body;
    if (!key) return res.status(400).json({ error: 'Key required' });
    const envMap = parseEnvFile(ENV_PATH);
    let i = 2;
    while (envMap[`GOOGLE_GEMINI_API_KEY_${i}`]) i++;
    envMap[`GOOGLE_GEMINI_API_KEY_${i}`] = key;
    const config = structuredConfig(envMap);
    writeEnvFile(ENV_PATH, config);
    res.json(structuredConfig(parseEnvFile(ENV_PATH)));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/gemini-keys/:index', (req, res) => {
  try {
    const idx = parseInt(req.params.index); // 0-based index in additional array
    const envMap = parseEnvFile(ENV_PATH);
    const config = structuredConfig(envMap);
    config.gemini.additional.splice(idx, 1);
    writeEnvFile(ENV_PATH, config);
    res.json(structuredConfig(parseEnvFile(ENV_PATH)));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
