require('dotenv').config({ path: require('./utils/paths').ENV_PATH });

const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const { requireAuth } = require('./middleware/auth');

const app = express();
const PORT = process.env.ADMIN_PANEL_PORT || 3001;
const SECRET = process.env.ADMIN_PANEL_SECRET || 'toha-admin-secret-change-me';

app.use(express.json());
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(session({
  secret: SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 },
}));

// Public routes
app.use('/api', require('./routes/auth'));

// Protected routes
app.use('/api/config', requireAuth, require('./routes/config'));
app.use('/api/stats', requireAuth, require('./routes/stats'));
app.use('/api/profiles', requireAuth, require('./routes/profiles'));
app.use('/api/bot', requireAuth, require('./routes/bot'));
app.use('/api/logs', requireAuth, require('./routes/logs'));
app.use('/api/settings', requireAuth, require('./routes/settings'));
app.use('/api/test', requireAuth, require('./routes/test'));
app.use('/api/ollama', requireAuth, require('./routes/ollama'));

// Serve built frontend in production
const distPath = path.join(__dirname, '../dist');
if (require('fs').existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (_, res) => res.sendFile(path.join(distPath, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`Admin panel server running on http://localhost:${PORT}`);
});
