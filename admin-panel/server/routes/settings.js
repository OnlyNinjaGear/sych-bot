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
  contextSize: 30,
  bufferSize: 20,
  chatBufferSize: 50,
  geminiKeysPaid: [],
  responses: defaultResponses,
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
    // Validate responses — merge with defaults, ensure arrays stay arrays
    const r = typeof updated.responses === 'object' && updated.responses ? updated.responses : {};
    const arrayKeys = ['errorCensored', 'errorOverloaded', 'errorQuota', 'errorLarge'];
    updated.responses = { ...defaultResponses, ...r };
    for (const k of arrayKeys) {
      if (!Array.isArray(updated.responses[k]) || updated.responses[k].length === 0)
        updated.responses[k] = defaultResponses[k];
    }
    fs.writeFileSync(BOT_SETTINGS_PATH, JSON.stringify(updated, null, 2));
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
