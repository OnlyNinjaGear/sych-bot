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
  maxTokens: 500,                // лимит длины ответа основной модели
  temperature: 0.9,              // креативность (0.0 - 2.0)
  laziness: 0,                   // вероятность ленивого ответа (0.0 - 1.0)
  lazyResponses: [
    'в падлу отвечать',
    'неа',
    'потом',
    'мне лень',
    'отвали',
    'не сегодня',
  ],
  contextSize: 30,               // сообщений в истории чата
  bufferSize: 20,                // сообщений до анализа профиля юзера
  chatBufferSize: 50,            // сообщений до анализа профиля чата
  geminiKeysPaid: [],            // boolean[] - true если ключ платный
  responses: {
    // Ошибки AI — массивы вариантов, бот выбирает случайный
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
    // Файлы
    videoTooLarge: '🐢 Братан, видос жирный пиздец (больше 20мб). Я не грузчик, таскать такое. Сожми или обрежь.',
    fileTooLarge: '🐘 Не, файл тяжелый (больше 20мб). Я пас.',
    wrongFormat: '🗿 Эт че за формат? Я такое не читаю. Давай PDF или текст.',
    // Команды
    muteOn: '🧌 Окей молчу',
    muteOff: '🧌 Я тут',
    cleared: '🧌 Окей, всё забыл, ну было и было',
    adminLeft: 'Батя ушел, я съёбываю',
  },
  smartFilter: {
    enabled: true,
    categories: {
      spam: {
        label: 'Спам / повторы',
        description: 'Повторяющиеся запросы, одно и то же сообщение несколько раз подряд',
        responses: [
          'ты это уже спрашивал, скроль наверх',
          'опять? у тебя дежавю?',
          'я уже ответил, чел',
        ],
        mode: 'text',
      },
      stupid: {
        label: 'Бессмыслица',
        description: 'Бессмысленные сообщения вроде "ыыыы", "аааа", "тоха тоха тоха", бред, попытка заспамить',
        responses: [
          'чё',
          'ты в порядке?',
          'ну и ну',
        ],
        mode: 'text',
      },
      reaction_only: {
        label: 'Только реакция',
        description: 'Достаточно поставить эмодзи, текстом отвечать не надо (мем, стикер, ссылка без вопроса)',
        responses: [],
        mode: 'reaction_only',
      },
    },
  },
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
