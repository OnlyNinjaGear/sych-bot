const router = require('express').Router();
const fs = require('fs');
const { BOT_SETTINGS_PATH } = require('../utils/paths');

const defaultResponses = {
  errorCensored: [
    '🤬 Гугл опять включил моралиста и зацензурил мой ответ. Сказал, что мы тут слишком токсичные. Сорян.',
    '🔞 Не, ну это бан. Нейронка отказалась это генерить, говорит "Violation of Safety Policy". Слишком грязно даже для меня.',
    '👮‍♂️ Опа, цензура подъехала. Гугл считает, что этот контент оскорбляет чьи-то нежные чувства. Попробуй помягче спросить.',
  ],
  errorOverloaded: [
    '🔥 Там у Гугла сервера плавятся. Говорят "Model is overloaded". Подожди минуту, пусть остынут.',
    '🐌 Гугл тупит страшно, 503-я ошибка. Я запрос кинул, а там тишина. Походу, китайцы опять все видеокарты заняли.',
    '💤 Чёт нейронка устала. Пишет "Service Unavailable". Дай ей перекур пару секунд.',
  ],
  errorQuota: [
    '💸 Всё, пацаны, лимиты всё. Мы слишком много болтаем, Гугл перекрыл краник. Ждем отката квоты.',
    '🛑 Стопэ. Ошибка 429 — "Too Many Requests". Я слишком быстро отвечаю, меня притормозили. Ща отдышусь.',
    '📉 Квота всё. Гугл сказал «хватит болтать». Попробуй позже.',
  ],
  errorLarge: [
    '🐘 Ты мне библиотеку Конгресса скинул? Гугл говорит, файл слишком жирный, я это не переварю.',
    '📜 Много буков. Ошибка "Payload size limit". Сократи басню, братан, не лезет.',
    '💾 Файл слишком жирный, не лезет в промпт. Давай что-то полегче.',
  ],
  errorDefault: '😴 тоха объелся токенов и спит',
  videoTooLarge: '🐢 Братан, видос жирный пиздец (больше 20мб). Я не грузчик, таскать такое. Сожми или обрежь.',
  fileTooLarge: '🐘 Не, файл тяжелый (больше 20мб). Я пас.',
  wrongFormat: '🗿 Эт че за формат? Я такое не читаю. Давай PDF или текст.',
  muteOn: '🧌 Окей молчу',
  muteOff: '🧌 Я тут',
  cleared: '🧌 Окей, всё забыл, ну было и было',
  adminLeft: 'Батя ушел, я съёбываю',
};

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
  maxTokens: 500,
  contextSize: 30,
  bufferSize: 20,
  chatBufferSize: 50,
  geminiKeysPaid: [],
  responses: defaultResponses,
  smartFilter: {
    enabled: true,
    categories: {
      spam: { label: 'Спам / повторы', description: 'Повторяющиеся запросы, одно и то же сообщение несколько раз подряд', responses: ['ты это уже спрашивал, скроль наверх', 'опять? у тебя дежавю?', 'я уже ответил, чел'], mode: 'text' },
      stupid: { label: 'Бессмыслица', description: 'Бессмысленные сообщения вроде "ыыыы", "аааа", бред, попытка заспамить', responses: ['чё', 'ты в порядке?', 'ну и ну'], mode: 'text' },
      reaction_only: { label: 'Только реакция', description: 'Достаточно поставить эмодзи, текстом отвечать не надо', responses: [], mode: 'reaction_only' },
    },
  },
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
    updated.maxTokens = Math.min(4000, Math.max(100, parseInt(updated.maxTokens) || 500));
    updated.temperature = Math.min(2, Math.max(0, parseFloat(updated.temperature) || 0.9));
    updated.laziness = Math.min(1, Math.max(0, parseFloat(updated.laziness) || 0));
    updated.lazyResponses = Array.isArray(updated.lazyResponses)
      ? updated.lazyResponses.filter(r => typeof r === 'string' && r.trim())
      : [];
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
    // Validate moodSystem
    if (updated.moodSystem && typeof updated.moodSystem === 'object') {
      updated.moodSystem.enabled = Boolean(updated.moodSystem.enabled);
      updated.moodSystem.debug = Boolean(updated.moodSystem.debug);
      updated.moodSystem.base = String(updated.moodSystem.base || '').substring(0, 3000);
      updated.moodSystem.intelligence = Math.min(100, Math.max(0, parseInt(updated.moodSystem.intelligence) || 50));
      if (typeof updated.moodSystem.moods === 'object') {
        for (const [key, mood] of Object.entries(updated.moodSystem.moods)) {
          if (typeof mood !== 'object') { delete updated.moodSystem.moods[key]; continue; }
          mood.enabled = Boolean(mood.enabled); mood.weight = Math.min(100, Math.max(0, parseInt(mood.weight) || 10));
          mood.label = String(mood.label || key).substring(0, 50); mood.prompt = String(mood.prompt || '').substring(0, 2000);
          mood.examples = Array.isArray(mood.examples) ? mood.examples.filter(e => e?.user && e?.bot).slice(0, 10).map(e => ({ user: String(e.user).substring(0, 200), bot: String(e.bot).substring(0, 500) })) : [];
          mood.antiExamples = Array.isArray(mood.antiExamples) ? mood.antiExamples.filter(a => typeof a === 'string' && a.trim()).slice(0, 10) : [];
        }
      }
      if (typeof updated.moodSystem.contextModifiers === 'object') {
        for (const [key, mod] of Object.entries(updated.moodSystem.contextModifiers)) {
          if (typeof mod !== 'object') { delete updated.moodSystem.contextModifiers[key]; continue; }
          mod.enabled = Boolean(mod.enabled); mod.prompt = String(mod.prompt || '').substring(0, 500);
        }
      }
    }
    // Validate responses — merge with defaults, ensure arrays stay arrays
    const r = typeof updated.responses === 'object' && updated.responses ? updated.responses : {};
    const arrayKeys = ['errorCensored', 'errorOverloaded', 'errorQuota', 'errorLarge'];
    updated.responses = { ...defaultResponses, ...r };
    for (const k of arrayKeys) {
      if (!Array.isArray(updated.responses[k]) || updated.responses[k].length === 0)
        updated.responses[k] = defaultResponses[k];
    }
    // Validate smartFilter
    if (updated.smartFilter && typeof updated.smartFilter === 'object') {
      updated.smartFilter.enabled = Boolean(updated.smartFilter.enabled);
      if (typeof updated.smartFilter.categories === 'object') {
        for (const [key, cat] of Object.entries(updated.smartFilter.categories)) {
          if (key === 'normal' || typeof cat !== 'object') { delete updated.smartFilter.categories[key]; continue; }
          cat.label = String(cat.label || key).substring(0, 100);
          cat.description = String(cat.description || '').substring(0, 300);
          cat.mode = ['text', 'reaction_only', 'silent'].includes(cat.mode) ? cat.mode : 'text';
          cat.responses = Array.isArray(cat.responses) ? cat.responses.filter(r => typeof r === 'string' && r.trim()).slice(0, 20) : [];
        }
      } else {
        updated.smartFilter.categories = {};
      }
    }
    fs.writeFileSync(BOT_SETTINGS_PATH, JSON.stringify(updated, null, 2));
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
