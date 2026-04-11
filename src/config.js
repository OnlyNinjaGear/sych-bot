const packageInfo = require('../package.json');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const ENV_PATH = path.resolve(__dirname, '../.env');

// Читает ключи Gemini напрямую из .env файла (без кэша process.env)
function loadGeminiKeys() {
  try {
    const content = fs.readFileSync(ENV_PATH, 'utf-8');
    const parsed = require('dotenv').parse(content);
    const keys = [];
    if (parsed.GOOGLE_GEMINI_API_KEY) keys.push(parsed.GOOGLE_GEMINI_API_KEY);
    let i = 2;
    while (parsed[`GOOGLE_GEMINI_API_KEY_${i}`]) {
      keys.push(parsed[`GOOGLE_GEMINI_API_KEY_${i}`]);
      i++;
    }
    return keys;
  } catch {
    return [];
  }
}

// Собираем ключи для Native Google (Fallback или Search)
const geminiKeys = loadGeminiKeys();

console.log(`[CONFIG] Загружено ключей Gemini (Native): ${geminiKeys.length}`);

module.exports = {
  // === TELEGRAM ===
  telegramToken: process.env.TELEGRAM_BOT_TOKEN,
  version: packageInfo.version,
  botId: parseInt(process.env.TELEGRAM_BOT_TOKEN.split(':')[0], 10),
  adminId: parseInt(process.env.ADMIN_USER_ID, 10),

  // === OPENROUTER / API (Основной канал) ===
  aiBaseUrl: process.env.AI_BASE_URL || "https://openrouter.ai/api/v1",
  aiKey: process.env.OPENROUTER_API_KEY || process.env.AI_API_KEY,

  // === АКТУАЛЬНЫЕ МОДЕЛИ (ЯНВАРЬ 2026) ===

  // 1. УМНАЯ (Ответы в чате)
  mainModel: 'gemini-2.5-flash-lite',

  // 2. ЛОГИКА (Анализ, реакции, проверки)
  // Free версия недоступна, используем эффективную платную
  logicModel: 'gemma-3-27b-it',

  // === ПОИСК (RAG или NATIVE) ===
  // Варианты: 
  // 'tavily'     -> Использует Tavily API (RAG). Лучший вариант для сторонних моделей.
  // 'perplexity' -> Использует модель Sonar через OpenRouter (RAG).
  // 'google'     -> Переключается на нативный Google API с встроенным поиском (Tools).
  // Если в .env не задано, по умолчанию используем 'tavily'
  searchProvider: process.env.SEARCH_PROVIDER || 'tavily',

  // Настройки провайдеров
  tavilyKey: process.env.TAVILY_API_KEY,
  perplexityModel: 'perplexity/sonar', // Актуальный алиас

  // === GEMINI NATIVE (FALLBACK / SEARCH) ===
  geminiKeys: geminiKeys,
  // Отдельный ключ для генерации изображений (платный аккаунт).
  // Если не задан — используются geminiKeys (все равно не сработает на бесплатном).
  geminiImageKey: process.env.GOOGLE_GEMINI_IMAGE_KEY || null,
  googleNativeModel: 'gemini-2.5-flash-lite',
  googleVisionModel: 'gemini-2.5-flash',
  fallbackModelName: 'gemini-2.5-flash-lite',
  contextSize: 30,
  triggerRegex: /(?<![а-яёa-z])(Тоха|тоха|Toha|toha|Тох|тох|Тохич|тохич|Тошик|тошик|Антоха|антоха|Антоша|антоша|Антошка|антошка|Бот|бот|Ботяра|ботяра|Ботик|ботик|Тохабот|тохабот)(?![а-яёa-z])/i,
  // Триггер только в НАЧАЛЕ сообщения (реплаи освобождены от этого правила)
  startTriggerRegex: /^(тоха|toha|тох|тохич|тошик|антоха|антоша|антошка|бот|ботяра|ботик|тохабот)(?![а-яёa-z])/i,

  // === УТИЛИТЫ ===
  ENV_PATH,
  loadGeminiKeys,
};