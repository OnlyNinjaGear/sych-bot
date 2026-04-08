const fs = require('fs');
const path = require('path');

const SETTINGS_PATH = path.join(__dirname, '../data/botSettings.json');

const defaults = {
  systemPrompt: '',              // пусто = использовать дефолтный из prompts.js
  aiProvider: 'openrouter',      // 'google' | 'openrouter' | 'custom'
  mainModel: 'gemini-2.5-flash-lite',
  mainModelFallbacks: [],        // цепочка фолбэков для основного API-канала
  logicModel: 'gemma-3-27b-it',
  logicModelFallbacks: [],       // фолбэки для логики
  nativeModels: ['gemini-2.5-flash-lite'], // Google Native — ротация по моделям
  visionModel: 'gemini-2.5-flash',        // для изображений
  reactionRate: 0.15,            // вероятность реакции (0.0 - 1.0)
  contextSize: 30,               // сообщений в истории чата
  bufferSize: 20,                // сообщений до анализа профиля юзера
  chatBufferSize: 50,            // сообщений до анализа профиля чата
  geminiKeysPaid: [],            // boolean[] - true если ключ платный
};

let current = { ...defaults };

function load() {
  try {
    const data = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
    current = { ...defaults, ...data };
    console.log('[SETTINGS] Настройки загружены');
  } catch {
    current = { ...defaults };
  }
}

// Создаём файл с дефолтами если нет
if (!fs.existsSync(SETTINGS_PATH)) {
  try {
    fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(defaults, null, 2));
  } catch {}
}

load();

// Горячая замена при изменении файла
let debounceTimer = null;
try {
  fs.watch(SETTINGS_PATH, () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(load, 300);
  });
} catch (e) {
  console.warn('[SETTINGS] Не удалось запустить слежку:', e.message);
}

module.exports = {
  get: (key) => current[key] ?? defaults[key],
  getAll: () => ({ ...current }),
  SETTINGS_PATH,
};
