const fs = require('fs');

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf-8');
  const result = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    const value = trimmed.substring(eqIdx + 1).trim();
    result[key] = value;
  }
  return result;
}

function extractGeminiKeys(envMap) {
  const primary = envMap['GOOGLE_GEMINI_API_KEY'] || '';
  const additional = [];
  let i = 2;
  while (envMap[`GOOGLE_GEMINI_API_KEY_${i}`]) {
    additional.push(envMap[`GOOGLE_GEMINI_API_KEY_${i}`]);
    i++;
  }
  return { primary, additional };
}

function writeEnvFile(filePath, config) {
  const lines = [];

  lines.push('# === Telegram Settings ===');
  lines.push(`TELEGRAM_BOT_TOKEN=${config.telegram.TELEGRAM_BOT_TOKEN || ''}`);
  lines.push(`ADMIN_USER_ID=${config.telegram.ADMIN_USER_ID || ''}`);
  lines.push('');

  lines.push('# === AI API (Основной канал / OpenAI Compatible) ===');
  lines.push(`AI_PROVIDER=${config.ai.AI_PROVIDER || 'openrouter'}`);
  lines.push(`AI_API_KEY=${config.ai.AI_API_KEY || ''}`);
  lines.push('');
  lines.push(`AI_BASE_URL=${config.ai.AI_BASE_URL || ''}`);
  lines.push('');

  lines.push('# === Search Engine (Поиск / RAG) ===');
  lines.push(`SEARCH_PROVIDER=${config.search.SEARCH_PROVIDER || 'tavily'}`);
  lines.push('');
  lines.push(`TAVILY_API_KEY=${config.search.TAVILY_API_KEY || ''}`);
  lines.push('');

  lines.push('# === Google Gemini (Native Fallback) ===');
  lines.push(`GOOGLE_GEMINI_API_KEY=${config.gemini.primary || ''}`);
  config.gemini.additional.forEach((key, idx) => {
    lines.push(`GOOGLE_GEMINI_API_KEY_${idx + 2}=${key}`);
  });
  lines.push('');

  lines.push('# === Admin Panel ===');
  lines.push(`ADMIN_PANEL_PASSWORD=${config.admin.ADMIN_PANEL_PASSWORD || ''}`);
  lines.push(`ADMIN_PANEL_PORT=${config.admin.ADMIN_PANEL_PORT || '3001'}`);
  lines.push(`ADMIN_PANEL_SECRET=${config.admin.ADMIN_PANEL_SECRET || ''}`);
  lines.push('');

  fs.writeFileSync(filePath, lines.join('\n'));
}

function structuredConfig(envMap) {
  const { primary, additional } = extractGeminiKeys(envMap);
  return {
    telegram: {
      TELEGRAM_BOT_TOKEN: envMap['TELEGRAM_BOT_TOKEN'] || '',
      ADMIN_USER_ID: envMap['ADMIN_USER_ID'] || '',
    },
    ai: {
      AI_PROVIDER: envMap['AI_PROVIDER'] || 'openrouter',
      AI_API_KEY: envMap['AI_API_KEY'] || '',
      AI_BASE_URL: envMap['AI_BASE_URL'] || '',
    },
    search: {
      SEARCH_PROVIDER: envMap['SEARCH_PROVIDER'] || 'tavily',
      TAVILY_API_KEY: envMap['TAVILY_API_KEY'] || '',
    },
    gemini: { primary, additional },
    admin: {
      ADMIN_PANEL_PASSWORD: envMap['ADMIN_PANEL_PASSWORD'] || '',
      ADMIN_PANEL_PORT: envMap['ADMIN_PANEL_PORT'] || '3001',
      ADMIN_PANEL_SECRET: envMap['ADMIN_PANEL_SECRET'] || '',
    },
  };
}

module.exports = { parseEnvFile, writeEnvFile, structuredConfig };
