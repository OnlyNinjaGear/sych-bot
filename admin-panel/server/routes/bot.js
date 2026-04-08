const router = require('express').Router();
const { exec, spawn } = require('child_process');
const path = require('path');
const { BOT_ROOT } = require('../utils/paths');

const BOT_NAME = 'toha-bot';
const BOT_SCRIPT = path.join(BOT_ROOT, 'src/index.js');
const DEV_PID_FILE = path.join(__dirname, '../.dev-pid');

// Dev process — PID сохраняем в файл, чтобы пережить рестарт сервера
let devProc = null;
let devStartedAt = null;
const devLogs = []; // кольцевой буфер последних 500 строк
const MAX_LOGS = 500;

function pushLog(line) {
  devLogs.push(line);
  if (devLogs.length > MAX_LOGS) devLogs.shift();
}

function savePid(pid, startedAt) {
  try { require('fs').writeFileSync(DEV_PID_FILE, JSON.stringify({ pid, startedAt })); } catch {}
}
function clearPid() {
  try { require('fs').unlinkSync(DEV_PID_FILE); } catch {}
}
function isAlive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

// Восстанавливаем состояние при старте сервера
try {
  const saved = JSON.parse(require('fs').readFileSync(DEV_PID_FILE, 'utf-8'));
  if (saved.pid && isAlive(saved.pid)) {
    devStartedAt = saved.startedAt;
    // процесс жив, но у нас нет ссылки — помечаем только PID для статуса
    devProc = { pid: saved.pid, kill: () => { try { process.kill(saved.pid); } catch {} clearPid(); } };
  } else {
    clearPid();
  }
} catch {}

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

router.get('/dev-logs', (req, res) => {
  const n = parseInt(req.query.n) || 200;
  res.json({ lines: devLogs.slice(-n) });
});

router.post('/dev-start', (req, res) => {
  if (devProc) return res.status(400).json({ error: 'Уже запущен' });
  devLogs.length = 0;
  const proc = spawn('npm', ['start'], { cwd: BOT_ROOT, stdio: 'pipe' });
  devStartedAt = Date.now();
  devProc = proc;
  savePid(proc.pid, devStartedAt);
  const onLine = (data) => data.toString().split('\n').filter(Boolean).forEach(pushLog);
  proc.stdout.on('data', onLine);
  proc.stderr.on('data', onLine);
  proc.on('exit', (code) => {
    if (devProc === proc) { devProc = null; devStartedAt = null; clearPid(); }
    pushLog(`\n--- процесс завершён (код ${code}) ---`);
  });
  proc.on('error', (e) => {
    if (devProc === proc) { devProc = null; devStartedAt = null; clearPid(); }
    pushLog(`--- ошибка запуска: ${e.message} ---`);
  });
  res.json({ ok: true, pid: proc.pid });
});

router.post('/dev-stop', (req, res) => {
  if (!devProc) return res.status(400).json({ error: 'Не запущен' });
  devProc.kill();
  devProc = null;
  devStartedAt = null;
  clearPid();
  res.json({ ok: true });
});

router.post('/server-restart', (req, res) => {
  res.json({ ok: true });
  setTimeout(() => process.exit(0), 200);
});

module.exports = router;
