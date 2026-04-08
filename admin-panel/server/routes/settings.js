const router = require('express').Router();
const fs = require('fs');
const { BOT_SETTINGS_PATH } = require('../utils/paths');

const defaults = {
  systemPrompt: '',
  aiProvider: 'openrouter',
  mainModel: 'google/gemma-3-27b-it:free',
  mainModelFallbacks: [],
  logicModel: 'google/gemma-3-27b-it:free',
  logicModelFallbacks: [],
  nativeModels: ['gemini-2.5-flash-lite'],
  visionModel: 'gemini-2.5-flash',
  reactionRate: 0.15,
  contextSize: 30,
  bufferSize: 20,
  chatBufferSize: 50,
  geminiKeysPaid: [],
};

function read() {
  try {
    return { ...defaults, ...JSON.parse(fs.readFileSync(BOT_SETTINGS_PATH, 'utf-8')) };
  } catch {
    return { ...defaults };
  }
}

router.get('/', (req, res) => {
  res.json(read());
});

router.put('/', (req, res) => {
  try {
    const current = read();
    const updated = { ...current, ...req.body };
    updated.reactionRate = Math.min(1, Math.max(0, parseFloat(updated.reactionRate) || 0));
    updated.contextSize = Math.min(100, Math.max(5, parseInt(updated.contextSize) || 30));
    updated.bufferSize = Math.min(200, Math.max(5, parseInt(updated.bufferSize) || 20));
    updated.chatBufferSize = Math.min(500, Math.max(10, parseInt(updated.chatBufferSize) || 50));
    updated.logicModelFallbacks = Array.isArray(updated.logicModelFallbacks)
      ? updated.logicModelFallbacks.filter(m => typeof m === 'string' && m.trim())
      : [];
    updated.mainModelFallbacks = Array.isArray(updated.mainModelFallbacks)
      ? updated.mainModelFallbacks.filter(m => typeof m === 'string' && m.trim())
      : [];
    updated.nativeModels = Array.isArray(updated.nativeModels) && updated.nativeModels.length > 0
      ? updated.nativeModels.filter(m => typeof m === 'string' && m.trim())
      : ['gemini-2.5-flash-lite'];
    updated.geminiKeysPaid = Array.isArray(updated.geminiKeysPaid)
      ? updated.geminiKeysPaid.map(v => Boolean(v))
      : [];
    updated.aiProvider = ['google', 'openrouter', 'custom'].includes(updated.aiProvider)
      ? updated.aiProvider
      : 'openrouter';
    fs.writeFileSync(BOT_SETTINGS_PATH, JSON.stringify(updated, null, 2));
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
