const router = require('express').Router();
const { exec, spawn } = require('child_process');
const path = require('path');
const { BOT_ROOT } = require('../utils/paths');

const BOT_NAME = 'toha-bot';
const BOT_SCRIPT = path.join(BOT_ROOT, 'src/index.js');

// Dev process (npm start) — живёт в памяти сервера
let devProc = null;
let devStartedAt = null;

function pm2(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout);
    });
  });
}

router.get('/status', async (req, res) => {
  try {
    const out = await pm2('pm2 jlist');
    const list = JSON.parse(out);
    const proc = list.find(p => p.name === BOT_NAME);
    if (!proc) return res.json({ status: 'stopped', found: false });
    res.json({
      found: true,
      status: proc.pm2_env.status,
      uptime: proc.pm2_env.pm_uptime,
      restarts: proc.pm2_env.restart_time,
      memory: proc.monit?.memory,
      cpu: proc.monit?.cpu,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/restart', async (req, res) => {
  try {
    await pm2(`pm2 restart ${BOT_NAME}`);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/start', async (req, res) => {
  try {
    try {
      await pm2(`pm2 start ${BOT_NAME}`);
    } catch {
      // Process not registered in PM2 yet — start fresh with script path
      await pm2(`pm2 start ${BOT_SCRIPT} --name ${BOT_NAME}`);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/stop', async (req, res) => {
  try {
    await pm2(`pm2 stop ${BOT_NAME}`);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/dev-status', (req, res) => {
  res.json({ running: devProc !== null, pid: devProc?.pid ?? null, startedAt: devStartedAt });
});

router.post('/dev-start', (req, res) => {
  if (devProc) return res.status(400).json({ error: 'Уже запущен' });
  devProc = spawn('npm', ['start'], { cwd: BOT_ROOT, stdio: 'pipe' });
  devStartedAt = Date.now();
  devProc.on('exit', () => { devProc = null; devStartedAt = null; });
  devProc.on('error', () => { devProc = null; devStartedAt = null; });
  res.json({ ok: true, pid: devProc.pid });
});

router.post('/dev-stop', (req, res) => {
  if (!devProc) return res.status(400).json({ error: 'Не запущен' });
  devProc.kill();
  devProc = null;
  devStartedAt = null;
  res.json({ ok: true });
});

router.post('/server-restart', (req, res) => {
  res.json({ ok: true });
  setTimeout(() => process.exit(0), 200);
});

module.exports = router;
