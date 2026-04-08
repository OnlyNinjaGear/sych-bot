const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");
const config = require('../config');
const settings = require('../settings');
const prompts = require('../core/prompts');
const axios = require('axios');
const fs = require('fs');
const OpenAI = require('openai');
const { tavily } = require('@tavily/core'); // Клиент Tavily
const storage = require('./storage');

class AiService {
    constructor() {
        // 1. Инициализация OpenAI-совместимого клиента
        // Если провайдер Google и есть ключи — используем все ключи с ротацией
        const isGoogleProvider = (config.aiBaseUrl || '').includes('generativelanguage.googleapis.com');
        const clientHeaders = { "HTTP-Referer": "https://github.com/Veta-one/toha-bot", "X-Title": "Toha Bot" };

        if (isGoogleProvider && config.geminiKeys.length > 0) {
            this.openaiClients = config.geminiKeys.map(key => new OpenAI({
                baseURL: config.aiBaseUrl, apiKey: key, defaultHeaders: clientHeaders
            }));
            console.log(`[AI] Google API: ротация через ${this.openaiClients.length} ключей`);
        } else if (config.aiKey) {
            this.openaiClients = [new OpenAI({
                baseURL: config.aiBaseUrl, apiKey: config.aiKey, defaultHeaders: clientHeaders
            })];
        } else {
            this.openaiClients = [];
        }
        this.openaiIdx = 0;
        this.openai = this.openaiClients[0] || null;

        // 2. Инициализация Tavily
        this.tavilyClient = config.tavilyKey ? tavily({ apiKey: config.tavilyKey }) : null;

        // 3. Google Native (Fallback)
        this.keyIndex = 0;
        this.modelIndex = 0;
        this.keys = config.geminiKeys;
        this.usingFallback = false;
        this.bot = null;

        // === СТАТИСТИКА (теперь персистентная через storage) ===
        storage.initGoogleStats(this.keys.length);

        if (this.keys.length === 0) console.warn("WARNING: Нет ключей Gemini в .env! Fallback не сработает.");
        this.initNativeModel();
        this.watchEnvFile();
    }

    rotateOpenAI() {
        if (this.openaiClients.length <= 1) return;
        this.openaiIdx = (this.openaiIdx + 1) % this.openaiClients.length;
        this.openai = this.openaiClients[this.openaiIdx];
        console.log(`[AI] Ротация API ключа → #${this.openaiIdx + 1}`);
    }

    watchEnvFile() {
        let debounceTimer = null;
        try {
            fs.watch(config.ENV_PATH, () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => this.reloadKeys(), 500);
            });
            console.log('[CONFIG WATCH] Горячая замена ключей Gemini активна');
        } catch (e) {
            console.warn('[CONFIG WATCH] Не удалось запустить слежку за .env:', e.message);
        }
    }

    reloadKeys() {
        const newKeys = config.loadGeminiKeys();
        if (JSON.stringify(newKeys) === JSON.stringify(this.keys)) return;
        console.log(`[CONFIG RELOAD] Ключи Gemini: ${this.keys.length} → ${newKeys.length}`);
        this.keys = newKeys;
        this.keyIndex = 0;
        this.modelIndex = 0;
        storage.initGoogleStats(this.keys.length);
        if (this.keys.length > 0) this.initNativeModel();
    }

    setBot(botInstance) {
        this.bot = botInstance;
    }

    notifyAdmin(message) {
        if (this.bot && config.adminId) {
            this.bot.sendMessage(config.adminId, message, { parse_mode: 'Markdown' }).catch(() => { });
        }
    }

    // Сброс статистики в полночь (проверка через storage)
    resetStatsIfNeeded() {
        const wasReset = storage.resetStatsIfNeeded();
        if (wasReset && this.usingFallback) {
            this.usingFallback = false;
            this.keyIndex = 0;
            this.initNativeModel();
            this.notifyAdmin("🌙 **Новый день!**\nЛимиты сброшены. Возврат в основной режим.");
        }
    }

    getStatsReport() {
        this.resetStatsIfNeeded();
        const { today, week, month, allTime } = storage.getFullStats();
        const mode = this.usingFallback ? "⚠️ FALLBACK" : "⚡️ API";

        // Форматирование даты (31.01)
        const dateStr = today.date ? today.date.split('-').reverse().slice(0, 2).join('.') : '--';

        // Сегодня — подробно
        const googleRows = (today.google || []).map((s, i) =>
            `${i + 1}: ${s.status ? "🟢" : "🔴"} ${s.count}`
        ).join('\n');

        const todaySection = [
            `Сегодня ${dateStr}:`,
            `Режим: ${mode}`,
            ``,
            `• API`,
            `Smart: ${today.smart}`,
            `Logic: ${today.logic}`,
            `Search: ${today.search}`,
            ``,
            `• Google Native:`,
            googleRows
        ].join('\n');

        // Неделя, месяц, всё время — кратко
        const weekSection = `Неделя: API ${week.smart + week.logic} | Google ${week.google} | Поиск ${week.search}`;
        const monthSection = `Месяц: API ${month.smart + month.logic} | Google ${month.google} | Поиск ${month.search}`;

        const allTimeTotal = allTime.smart + allTime.logic + allTime.google;
        const allTimeSection = `Всего: ${this._formatNumber(allTimeTotal)} запросов`;

        return `${todaySection}\n\n${weekSection}\n${monthSection}\n${allTimeSection}`;
    }

    _formatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return String(num);
    }

    initNativeModel() {
        if (this.keys.length === 0) return;
        const currentKey = this.keys[this.keyIndex];
        const genAI = new GoogleGenerativeAI(currentKey);

        const safetySettings = [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ];

        const nativeModels = settings.get('nativeModels');
        const modelName = nativeModels[this.modelIndex] || nativeModels[0];
        console.log(`[AI INIT] Native Key #${this.keyIndex + 1} | Model: ${modelName} (${this.modelIndex + 1}/${nativeModels.length})`);

        this.nativeModel = genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: prompts.system(),
            safetySettings: safetySettings,
            // Включаем нативный поиск Google (Tools)
            tools: [{ googleSearch: {} }]
        });
    }

    rotateNativeKey() {
        storage.markGoogleKeyExhausted(this.keyIndex);
        console.log(`[AI] Native Key #${this.keyIndex + 1} исчерпан.`);

        const nativeModels = settings.get('nativeModels');
        const currentModel = nativeModels[this.modelIndex] || nativeModels[0];
        const keyFlags = settings.get('geminiKeysPaid') || [];

        // Paid native models (known list)
        const PAID_MODELS = new Set([
            'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash',
            'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.5-pro-001',
        ]);
        const isModelPaid = PAID_MODELS.has(currentModel);

        // Build key pool: paid models prefer paid keys, free models use all keys
        const paidKeyIndices = this.keys.map((_, i) => keyFlags[i] ? i : -1).filter(i => i >= 0);
        const pool = (isModelPaid && paidKeyIndices.length > 0) ? paidKeyIndices : this.keys.map((_, i) => i);

        const currentPoolPos = pool.indexOf(this.keyIndex);
        const nextPoolPos = currentPoolPos + 1;

        if (nextPoolPos < pool.length) {
            // Next key in pool
            this.keyIndex = pool[nextPoolPos];
        } else {
            // Exhausted pool for this model — try next model
            this.keyIndex = pool[0];
            this.modelIndex++;

            if (this.modelIndex >= nativeModels.length) {
                this.modelIndex = 0;
                this.keyIndex = 0;
                console.error("☠️ Все нативные ключи и модели исчерпаны.");
                this.notifyAdmin("⚠️ **Внимание!** Все Google ключи и модели исчерпаны.");
            } else {
                console.log(`[AI] Переключаюсь на модель: ${nativeModels[this.modelIndex]}`);
            }
        }
        this.initNativeModel();
    }

    async executeNativeWithRetry(apiCallFn) {
        const nativeModels = settings.get('nativeModels');
        const maxAttempts = this.keys.length * nativeModels.length;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                storage.incrementGoogleStat(this.keyIndex);
                return await apiCallFn();
            } catch (error) {
                const isQuotaError = error.message.includes('429') || error.message.includes('Quota') || error.message.includes('403');
                if (isQuotaError) {
                    this.rotateNativeKey();
                    continue;
                } else {
                    throw error;
                }
            }
        }
        throw new Error("Все ключи Google Native исчерпаны!");
    }

    getCurrentTime() {
        const time = new Date().toLocaleString("ru-RU", {
            timeZone: "Asia/Yekaterinburg",
            weekday: 'short', // Сократим до Пт, Пн (экономим токены)
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        // Явно указываем базу для расчетов
        return `${time} (UTC+5)`;
    }

    // === УНИВЕРСАЛЬНЫЙ ПОИСК ===
    async performSearch(query) {
        this.resetStatsIfNeeded();

        // 1. TAVILY
        if (config.searchProvider === 'tavily' && this.tavilyClient) {
            try {
                console.log(`[SEARCH] Tavily ищет: ${query}`);
                const response = await this.tavilyClient.search(query, {
                    search_depth: "advanced",
                    max_results: 3,
                    include_answer: true
                });
                storage.incrementStat('search');

                let resultText = "";
                if (response.answer) resultText += `Краткий ответ Tavily: ${response.answer}\n\n`;
                response.results.forEach((res, i) => {
                    resultText += `[${i + 1}] ${res.title} (${res.url}):\n${res.content}\n\n`;
                });
                return resultText;
            } catch (e) {
                console.error(`[TAVILY FAIL] ${e.message}`);
                return null;
            }
        }

        // 2. PERPLEXITY
        if (config.searchProvider === 'perplexity' && this.openai) {
            try {
                console.log(`[SEARCH] Perplexity ищет: ${query}`);
                const completion = await this.openai.chat.completions.create({
                    model: config.perplexityModel,
                    messages: [
                        { role: "system", content: `Date: ${this.getCurrentTime()}. Search engine mode. Provide facts with URLs.` },
                        { role: "user", content: query }
                    ],
                    temperature: 0.1
                });
                storage.incrementStat('search');
                return completion.choices[0].message.content;
            } catch (e) {
                console.error(`[PERPLEXITY FAIL] ${e.message}`);
                return null;
            }
        }

        return null;
    }

    // === ОСНОВНОЙ ОТВЕТ ===
    async getResponse(history, currentMessage, imageBuffer = null, mimeType = "image/jpeg", userInstruction = "", userProfile = null, isSpontaneous = false, chatProfile = null) {
        this.resetStatsIfNeeded();
        console.log(`[DEBUG AI] getResponse вызван.`);

        // 1. AI ОПРЕДЕЛЯЕТ НУЖЕН ЛИ ПОИСК
        const recentHistory = history.slice(-5).map(m => `${m.role}: ${m.text}`).join('\n');
        const searchDecision = await this.checkSearchNeeded(
            currentMessage.text,
            recentHistory,
            chatProfile?.topic || null
        );

        let searchResultText = "";

        if (searchDecision.needsSearch && searchDecision.searchQuery) {
            // 2. ПОИСК ЧЕРЕЗ TAVILY / PERPLEXITY
            if (config.searchProvider !== 'google') {
                searchResultText = await this.performSearch(searchDecision.searchQuery);
            }

            // 3. FALLBACK НА GOOGLE NATIVE SEARCH
            // Если Tavily/Perplexity недоступен или провайдер = google
            if (!searchResultText && this.keys.length > 0) {
                console.log(`[ROUTER] Переключаюсь на Google Native Search.`);
                return this.generateViaNative(history, currentMessage, imageBuffer, mimeType, userInstruction, userProfile, isSpontaneous, chatProfile);
            }
        }

        // 2. СБОРКА ПРОМПТА
        const relevantHistory = history.slice(-20);
        const contextStr = relevantHistory.map(m => `${m.role}: ${m.text}`).join('\n');
        let personalInfo = "";
        let replyContext = "";

        if (currentMessage.replyText) replyContext = `!!! ПОЛЬЗОВАТЕЛЬ ОТВЕТИЛ НА СООБЩЕНИЕ:\n"${currentMessage.replyText}"`;
        if (userInstruction) personalInfo += `\n!!! СПЕЦ-ИНСТРУКЦИЯ !!!\n${userInstruction}\n`;

        if (searchResultText) {
            personalInfo += `\n!!! ДАННЫЕ ИЗ ПОИСКА (${config.searchProvider.toUpperCase()}) !!!\n${searchResultText}\nИНСТРУКЦИЯ: Ответь, используя эти факты. УКАЖИ ССЫЛКИ.\n`;
        }

        if (userProfile) {
            const score = userProfile.relationship || 50;
            let relationText = score <= 20 ? "СТАТУС: ВРАГ." : score >= 80 ? "СТАТУС: БРАТАН." : "СТАТУС: НЕЙТРАЛЬНО.";
            personalInfo += `\n--- ДОСЬЕ ---\nФакты: ${userProfile.facts || "Нет"}\n`;
            if (userProfile.location) personalInfo += `📍 Локация: ${userProfile.location}\n`;
            personalInfo += `${relationText}\n-----------------\n`;
        }

        const fullPromptText = prompts.mainChat({
            time: this.getCurrentTime(),
            isSpontaneous: isSpontaneous,
            userMessage: currentMessage.text,
            replyContext: replyContext,
            history: contextStr,
            personalInfo: personalInfo,
            senderName: currentMessage.sender,
            chatContext: chatProfile
        });

        // 3. ЗАПРОС К SMART МОДЕЛИ (API) — перебираем цепочку моделей
        if (this.openai) {
            const modelChain = [settings.get('mainModel'), ...settings.get('mainModelFallbacks')].filter(Boolean);
            const apiMessages = [{ role: "system", content: prompts.system() }, { role: "user", content: [] }];
            apiMessages[1].content.push({ type: "text", text: fullPromptText });
            if (imageBuffer) {
                apiMessages[1].content.push({
                    type: "image_url",
                    image_url: { url: `data:${mimeType};base64,${imageBuffer.toString('base64')}` }
                });
            }

            for (const model of modelChain) {
                try {
                    const completion = await this.openai.chat.completions.create({
                        model,
                        messages: apiMessages,
                        max_tokens: 2500,
                        temperature: 0.9,
                    });
                    storage.incrementStat('smart');
                    return completion.choices[0].message.content
                        .replace(/<thought>[\s\S]*?<\/thought>/g, '')
                        .replace(/^thought[\s\S]*?\n\n/i, '').trim();
                } catch (e) {
                    if (e.status === 429 || e.message?.includes('429')) this.rotateOpenAI();
                    console.error(`[API SMART FAIL] ${model}: ${e.message}`);
                }
            }
        }

        // 4. FALLBACK на Google Native — передаём searchResultText если есть
        return this.generateViaNative(history, currentMessage, imageBuffer, mimeType, userInstruction, userProfile, isSpontaneous, chatProfile, searchResultText);
    }

    // Helper для Native вызова (чтобы не дублировать код)
    async generateViaNative(history, currentMessage, imageBuffer, mimeType, userInstruction, userProfile, isSpontaneous, chatProfile = null, searchResultText = "") {
        const relevantHistory = history.slice(-20);
        const contextStr = relevantHistory.map(m => `${m.role}: ${m.text}`).join('\n');

        // Собираем полную информацию о пользователе (как в основном методе)
        let personalInfo = "";
        let replyContext = "";

        if (currentMessage.replyText) {
            replyContext = `!!! ПОЛЬЗОВАТЕЛЬ ОТВЕТИЛ НА СООБЩЕНИЕ:\n"${currentMessage.replyText}"`;
        }

        if (userInstruction) {
            personalInfo += `\n!!! СПЕЦ-ИНСТРУКЦИЯ !!!\n${userInstruction}\n`;
        }

        if (searchResultText) {
            personalInfo += `\n!!! ДАННЫЕ ИЗ ПОИСКА (TAVILY) !!!\n${searchResultText}\nИНСТРУКЦИЯ: Ответь, используя эти факты. УКАЖИ ССЫЛКИ.\n`;
        }

        if (userProfile) {
            const score = userProfile.relationship || 50;
            let relationText = score <= 20 ? "СТАТУС: ВРАГ 🫵" : score >= 80 ? "СТАТУС: БРАТИК 🤙" : "СТАТУС: НЕЙТРАЛЬНЫЙ";
            personalInfo += `\n--- ДОСЬЕ ---\nФакты: ${userProfile.facts || "Нет"}\n`;
            if (userProfile.location) personalInfo += `📍 Локация: ${userProfile.location}\n`;
            personalInfo += `${relationText}\n-----------------\n`;
        }

        const fullPromptText = prompts.mainChat({
            time: this.getCurrentTime(),
            isSpontaneous: isSpontaneous,
            userMessage: currentMessage.text,
            replyContext: replyContext,
            history: contextStr,
            personalInfo: personalInfo,
            senderName: currentMessage.sender,
            chatContext: chatProfile
        });

        return this.executeNativeWithRetry(async () => {
            let promptParts = [];
            if (imageBuffer) promptParts.push({ inlineData: { mimeType: mimeType, data: imageBuffer.toString("base64") } });
            promptParts.push({ text: fullPromptText });

            // Для изображений используем vision-модель, для текста — основную
            const modelToUse = imageBuffer
                ? new GoogleGenerativeAI(this.keys[this.keyIndex]).getGenerativeModel({ model: settings.get('visionModel') })
                : this.nativeModel;

            const result = await modelToUse.generateContent({
                contents: [{ role: 'user', parts: promptParts }],
                generationConfig: { maxOutputTokens: 2500, temperature: 0.9 }
            });

            let text = result.response.text();
            if (result.response.candidates[0].groundingMetadata?.groundingChunks) {
                const links = result.response.candidates[0].groundingMetadata.groundingChunks
                    .filter(c => c.web?.uri).map(c => `[${c.web.title || "Источник"}](${c.web.uri})`);
                const unique = [...new Set(links)].slice(0, 3);
                if (unique.length > 0) text += "\n\nНашел тут: " + unique.join(" • ");
            }
            return text;
        });
    }

    // === ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ (LOGIC MODEL) ===

    // Универсальный метод для логики
    async runLogicModel(promptJson) {
        // 1. Пробуем цепочку API-моделей для логики
        if (this.openai) {
            const chain = [settings.get('logicModel'), ...settings.get('logicModelFallbacks')].filter(Boolean);
            for (const model of chain) {
                try {
                    const opts = {
                        model,
                        messages: [{ role: "user", content: promptJson }],
                    };
                    // Gemma не поддерживает response_format на Google endpoint
                    if (!model.includes('gemma')) opts.response_format = { type: "json_object" };
                    const completion = await this.openai.chat.completions.create(opts);
                    storage.incrementStat('logic');
                    let text = completion.choices[0].message.content
                        .replace(/<thought>[\s\S]*?<\/thought>/g, '').trim();
                    const first = text.indexOf('{'), last = text.lastIndexOf('}');
                    if (first !== -1 && last !== -1) text = text.substring(first, last + 1);
                    return JSON.parse(text);
                } catch (e) {
                    if (e.status === 429 || e.message?.includes('429')) this.rotateOpenAI();
                    console.error(`[LOGIC FAIL] ${model}: ${e.message}`);
                }
            }
        }
        // 2. Fallback Native
        try {
            return await this.executeNativeWithRetry(async () => {
                const result = await this.nativeModel.generateContent(promptJson);
                let text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
                const first = text.indexOf('{'), last = text.lastIndexOf('}');
                if (first !== -1 && last !== -1) text = text.substring(first, last + 1);
                return JSON.parse(text);
            });
        } catch (e) { return null; }
    }

    // Простой текстовый ответ (для реакций и ShouldAnswer)
    async runLogicText(promptText) {
        if (this.openai) {
            const chain = [settings.get('logicModel'), ...settings.get('logicModelFallbacks')].filter(Boolean);
            for (const model of chain) {
                try {
                    const completion = await this.openai.chat.completions.create({
                        model,
                        messages: [{ role: "user", content: promptText }]
                    });
                    storage.incrementStat('logic');
                    return completion.choices[0].message.content
                        .replace(/<thought>[\s\S]*?<\/thought>/g, '').trim();
                } catch (e) {
                    if (e.status === 429 || e.message?.includes('429')) this.rotateOpenAI();
                    console.error(`[LOGIC TEXT FAIL] ${model}: ${e.message}`);
                }
            }
        }
        return null;
    }

    async classifyMessage(userMessage, recentHistory, senderName) {
        const filterConfig = settings.get('smartFilter');
        if (!filterConfig || !filterConfig.enabled) {
            return { category: 'normal', reason: 'filter disabled' };
        }
        const categoryDescriptions = Object.entries(filterConfig.categories)
            .map(([key, cat]) => `- "${key}" — ${cat.description}`)
            .join('\n');
        const prompt = prompts.classifyMessage(userMessage, recentHistory, categoryDescriptions, senderName);
        try {
            const result = await this.runLogicModel(prompt);
            if (result && result.category) {
                console.log(`[SMART FILTER] category=${result.category}, reason="${result.reason}"`);
                return result;
            }
        } catch (e) {
            console.error(`[SMART FILTER ERROR] ${e.message}`);
        }
        return { category: 'normal', reason: 'fallback' };
    }

    async analyzeUserImmediate(lastMessages, currentProfile) {
        return this.runLogicModel(prompts.analyzeImmediate(currentProfile, lastMessages));
    }

    // Определение необходимости поиска (AI-решение вместо regex)
    async checkSearchNeeded(userMessage, recentHistory, chatTopic) {
        const prompt = prompts.shouldSearch(
            this.getCurrentTime(),
            userMessage,
            recentHistory,
            chatTopic
        );

        try {
            const result = await this.runLogicModel(prompt);
            if (result && typeof result.needsSearch === 'boolean') {
                console.log(`[SEARCH CHECK] needsSearch=${result.needsSearch}, query="${result.searchQuery}", reason="${result.reason}"`);
                return result;
            }
        } catch (e) {
            console.error(`[SEARCH CHECK ERROR] ${e.message}`);
        }

        // Fallback: не искать если AI не ответил
        return { needsSearch: false, searchQuery: null, reason: "fallback" };
    }

    async analyzeBatch(messagesBatch, currentProfiles) {
        const chatLog = messagesBatch.map(m => `[ID:${m.userId}] ${m.name}: ${m.text}`).join('\n');
        const knownInfo = Object.entries(currentProfiles).map(([uid, p]) => `ID:${uid} -> ${p.realName}, ${p.facts}, ${p.attitude}`).join('\n');
        return this.runLogicModel(prompts.analyzeBatch(knownInfo, chatLog));
    }

    // Анализ профиля чата (каждые 50 сообщений)
    async analyzeChatProfile(messagesBatch, currentProfile) {
        const messagesText = messagesBatch.map(m => `${m.name}: ${m.text}`).join('\n');
        return this.runLogicModel(prompts.analyzeChatProfile(currentProfile, messagesText));
    }

    // Обработка ручного описания чата (команда "Тоха, этот чат про...")
    async processManualChatDescription(description, currentProfile) {
        return this.runLogicModel(prompts.processManualChatDescription(description, currentProfile));
    }

    async determineReaction(contextText) {
        const allowed = ["👍", "👎", "❤", "🔥", "🥰", "👏", "😁", "🤔", "🤯", "😱", "🤬", "😢", "🎉", "🤩", "🤮", "💩", "🙏", "👌", "🕊", "🤡", "🥱", "🥴", "😍", "🐳", "❤‍🔥", "🌚", "🌭", "💯", "🤣", "⚡", "🍌", "🏆", "💔", "🤨", "😐", "🍓", "🍾", "💋", "🖕", "😈", "😴", "😭", "🤓", "👻", "👨‍💻", "👀", "🎃", "🙈", "😇", "😨", "🤝", "✍", "🤗", "🫡", "🎅", "🎄", "☃", "💅", "🤪", "🗿", "🆒", "💘", "🙉", "🦄", "😘", "💊", "🙊", "😎", "👾", "🤷‍♂", "🤷", "🤷‍♀", "😡"];
        const text = await this.runLogicText(prompts.reaction(contextText, allowed.join(" ")));
        if (!text) return null;
        const match = text.match(/(\p{Emoji_Presentation}|\p{Extended_Pictographic})/u);
        return (match && allowed.includes(match[0])) ? match[0] : null;
    }

    async generateProfileDescription(profileData, targetName) {
        if (this.openai) {
            try {
                const completion = await this.openai.chat.completions.create({ model: config.mainModel, messages: [{ role: "user", content: prompts.profileDescription(targetName, profileData) }] });
                storage.incrementStat('smart'); return completion.choices[0].message.content;
            } catch (e) { }
        }
        return "Не знаю такого.";
    }

    async generateFlavorText(task, result) {
        if (this.openai) {
            try {
                const completion = await this.openai.chat.completions.create({ model: config.mainModel, messages: [{ role: "user", content: prompts.flavor(task, result) }] });
                storage.incrementStat('smart'); return completion.choices[0].message.content.trim().replace(/^["']|["']$/g, '');
            } catch (e) { }
        }
        return `${result}`;
    }

    // === ТРАНСКРИБАЦИЯ ===
    async transcribeAudio(audioBuffer, userName, mimeType) {
        // Только Native поддерживает загрузку файлов из буфера так легко и бесплатно
        if (!this.keys || this.keys.length === 0) {
            console.warn("[AI WARN] Получено голосовое, но нет ключей Google для расшифровки. Пропускаю.");
            return null;
        }

        try {
            return await this.executeNativeWithRetry(async () => {
                const parts = [{ inlineData: { mimeType: mimeType, data: audioBuffer.toString("base64") } }, { text: prompts.transcription(userName) }];
                const result = await this.nativeModel.generateContent(parts);
                let text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
                const first = text.indexOf('{'), last = text.lastIndexOf('}');
                if (first !== -1 && last !== -1) text = text.substring(first, last + 1);
                return JSON.parse(text);
            });
        } catch (e) {
            console.error(`[TRANSCRIPTION FAIL] ${e.message}`);
            return null;
        }
    }

    // === ПАРСИНГ НАПОМИНАНИЯ (С КОНТЕКСТОМ) ===
    async parseReminder(userText, contextText = "") {
        const now = this.getCurrentTime();
        const prompt = prompts.parseReminder(now, userText, contextText);
        return this.runLogicModel(prompt);
    }
}

module.exports = new AiService();