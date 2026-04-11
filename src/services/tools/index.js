// Tool registry — zero/low-token tools that intercept messages before AI
// Return types:
//   null                              → no match, fall through to AI
//   string                            → send as text (HTML)
//   { type: 'photo', data, mimeType } → send as photo

const ascii = require('./ascii');
const nb = require('./nanobanana');
const imagesearch = require('./imagesearch');

// Nouns indicating "create new image" intent (not editing)
const IMG_NOUNS = '(?:фото|фотку|картинку|кадр|рисунок|карточку|изображение|арт|постер|обои|пикчу|пикчу)';

// Verbs for generation
const GEN_VERBS = '(?:сгенерируй|создай|нарисуй|набанань|сгенери)';

// Verbs for generation OR editing — only used WITH IMG_NOUNS for generation
const MAKE_VERB = '(?:сделай|сделать)';

// Verbs exclusively for editing (used when image is attached, no IMG_NOUNS needed)
const EDIT_VERBS = '(?:убери|измени|поменяй|замени|добавь|дорисуй|удали|перерисуй|стилизуй|преврати|отредактируй|обработай|сделай|сделать)';

const TOOLS = [
    // ── ASCII Art ──────────────────────────────────────────────────────────────
    {
        name: 'ascii',
        patterns: [/ascii\s*арт|аски\s*арт|ascii[\s-]?art|сделай\s+ascii|в\s+ascii|в\s+аски/i],
        requiresImage: true,
        noImageHint: 'Прикрепи картинку (или ответь на сообщение с картинкой) и напиши «ascii арт».',
        errorMessage: null, // fall through to AI on error
        execute: async (imageBuffer) => {
            const art = await ascii.imageToAscii(imageBuffer);
            return `<pre>${escapeHtml(art)}</pre>`;
        },
    },

    // ── Image Generation — «нарисуй/создай/сгенерируй + noun + prompt» ────────
    {
        name: 'image-gen',
        // GEN_VERBS alone (no noun required), MAKE_VERB + IMG_NOUNS, OR "набанань" alone
        patterns: [
            new RegExp(`${GEN_VERBS}\\s+(?:${IMG_NOUNS}\\s+)?(.+)`, 'is'),  // "нарисуй [картинку] пуджа"
            new RegExp(`${MAKE_VERB}\\s+${IMG_NOUNS}\\s+(.+)`, 'is'),        // "сделай картинку пуджа"
            /набанань\s+(.+)/is,                                               // "набанань кота в космосе"
        ],
        requiresImage: false,
        errorMessage: (e) => {
            const msg = String(e?.response?.data?.error?.message || e?.message || '');
            if (msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429') || e?.response?.status === 429) {
                return '🍌 Лимит генерации исчерпан. Попробуй позже.';
            }
            return '🍌 Генерация картинок требует платный ключ. Добавь GOOGLE_GEMINI_IMAGE_KEY в .env.';
        },
        execute: async (_imageBuffer, _mimeType, text, match) => {
            const prompt = match[1].trim();
            console.log(`[NanoBanana] Генерация: "${prompt}"`);
            const img = await nb.generateImage(prompt);
            return { type: 'photo', ...img };
        },
    },

    // ── Image Search — "пришли/скинь/кинь фотку X", "найди фото X" ───────────
    {
        name: 'image-search',
        patterns: [
            // "пришли/скинь/кинь" are unambiguous "send me" intents — match everything after
            /(?:пришли|скинь|кинь)\s+(.+)/is,
            // "найди/покажи/дай" only trigger with an explicit photo noun to avoid intercepting text searches
            /(?:найди|покажи|дай)\s+((?:фото|фотку|фотки|картинку|картинки|кадр|кадры|изображение|пикчу|пик|арт|постер|обои|мем|мемчик|gif|гиф|скрин)\s*.+)/is,
        ],
        requiresImage: false,
        errorMessage: '🔎 Не нашёл картинку. Попробуй уточнить запрос.',
        execute: async (_imageBuffer, _mimeType, _text, match) => {
            const query = match[1].trim();
            console.log(`[ImageSearch] Поиск: "${query}"`);
            const img = await imagesearch.findImage(query);
            return { type: 'photo', ...img };
        },
    },

    // ── Image Editing — edit verb + prompt, requires attached image ────────────
    {
        name: 'image-edit',
        patterns: [
            new RegExp(`(?:${EDIT_VERBS})\\s+(.+)`, 'is'),
        ],
        requiresImage: true,
        noImageHint: null, // editing without image → don't intercept (let AI handle)
        errorMessage: (e) => {
            const msg = String(e?.response?.data?.error?.message || e?.message || '');
            if (msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429') || e?.response?.status === 429) {
                return '🍌 Лимит редактирования исчерпан. Попробуй позже.';
            }
            return '🍌 Редактирование фото требует платный Nano Banana ключ. Для генерации новых картинок — напиши «нарисуй картинку [промпт]».';
        },
        execute: async (imageBuffer, mimeType, text, match) => {
            const prompt = match[1].trim();
            console.log(`[NanoBanana] Редактирование: "${prompt}"`);
            const img = await nb.editImage(imageBuffer, mimeType, prompt);
            return { type: 'photo', ...img };
        },
    },
];

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Try matching text against all tools. Returns tool response or null.
 * @param {string} text
 * @param {Buffer|null} imageBuffer
 * @param {string} mimeType
 * @returns {Promise<null|string|{type:'photo',data:Buffer,mimeType:string}>}
 */
async function tryTool(text, imageBuffer, mimeType) {
    if (!text) return null;

    for (const tool of TOOLS) {
        let matchResult = null;
        for (const pattern of tool.patterns) {
            const m = text.match(pattern);
            if (m) { matchResult = m; break; }
        }
        if (!matchResult) continue;

        // Image required but not present
        if (tool.requiresImage && !imageBuffer) {
            return tool.noImageHint || null;
        }

        try {
            return await tool.execute(imageBuffer, mimeType, text, matchResult);
        } catch (e) {
            console.error(`[TOOL:${tool.name}] Ошибка:`, e.message);
            const msg = typeof tool.errorMessage === 'function' ? tool.errorMessage(e) : tool.errorMessage;
            return msg || null;
        }
    }

    return null;
}

module.exports = { tryTool };
