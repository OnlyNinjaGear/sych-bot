const path = require('path');

const BOT_ROOT = path.resolve(__dirname, '../../..');

module.exports = {
  BOT_ROOT,
  ENV_PATH: path.join(BOT_ROOT, '.env'),
  DATA_DIR: path.join(BOT_ROOT, 'data'),
  STATS_PATH: path.join(BOT_ROOT, 'data/stats.json'),
  PROFILES_PATH: path.join(BOT_ROOT, 'data/profiles.json'),
  CHAT_PROFILES_PATH: path.join(BOT_ROOT, 'data/chatProfiles.json'),
  DB_PATH: path.join(BOT_ROOT, 'data/db.json'),
  BOT_SETTINGS_PATH: path.join(BOT_ROOT, 'data/botSettings.json'),
};
