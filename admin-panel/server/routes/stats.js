const router = require('express').Router();
const fs = require('fs');
const { STATS_PATH } = require('../utils/paths');

function readStats() {
  return JSON.parse(fs.readFileSync(STATS_PATH, 'utf-8'));
}
function writeStats(data) {
  fs.writeFileSync(STATS_PATH, JSON.stringify(data, null, 2));
}

router.get('/', (req, res) => {
  try {
    res.json(readStats());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Ручные лимиты: { model: { RPD, RPM, TPM } }
router.put('/manual-limits', (req, res) => {
  try {
    const stats = readStats();
    const { model, quotaType, value } = req.body;
    if (!model || !quotaType) return res.status(400).json({ error: 'model and quotaType required' });
    if (!['RPD', 'RPM', 'TPM'].includes(quotaType)) return res.status(400).json({ error: 'invalid quotaType' });

    if (!stats.manualLimits) stats.manualLimits = {};
    if (!stats.manualLimits[model]) stats.manualLimits[model] = {};
    if (value === null || value === '' || value === undefined) {
      delete stats.manualLimits[model][quotaType];
      if (Object.keys(stats.manualLimits[model]).length === 0) delete stats.manualLimits[model];
    } else {
      const num = parseInt(value);
      if (isNaN(num) || num < 0) return res.status(400).json({ error: 'invalid value' });
      stats.manualLimits[model][quotaType] = num;
    }
    writeStats(stats);
    res.json({ ok: true, manualLimits: stats.manualLimits });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Сбросить весь manualLimits разом (для удобства)
router.post('/manual-limits/bulk', (req, res) => {
  try {
    const stats = readStats();
    const { limits } = req.body; // { model: { RPD, RPM } }
    if (typeof limits !== 'object') return res.status(400).json({ error: 'limits must be object' });
    stats.manualLimits = limits;
    writeStats(stats);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
