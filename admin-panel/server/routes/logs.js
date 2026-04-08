const router = require('express').Router();
const fs = require('fs');
const { exec } = require('child_process');

function pm2(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });
}

router.get('/', async (req, res) => {
  const lines = parseInt(req.query.lines) || 200;
  const type = req.query.type === 'err' ? 'err' : 'out';

  try {
    const out = await pm2('pm2 jlist');
    const list = JSON.parse(out);
    const proc = list.find(p => p.name === 'toha-bot');
    if (!proc) return res.json({ lines: [] });

    const logPath = type === 'err'
      ? proc.pm2_env.pm_err_log_path
      : proc.pm2_env.pm_out_log_path;

    if (!logPath || !fs.existsSync(logPath)) return res.json({ lines: [] });

    const content = fs.readFileSync(logPath, 'utf-8');
    const all = content.split('\n').filter(Boolean);
    res.json({ lines: all.slice(-lines) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
