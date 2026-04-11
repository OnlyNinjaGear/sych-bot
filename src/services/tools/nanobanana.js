// Nano Banana — image generation & editing via Google Gemini/Imagen models
// Uses GOOGLE_GEMINI_IMAGE_KEY (paid) — separate from main conversation keys.
// Generation: Nano Banana 2 → Nano Banana → Imagen 4 Fast → Imagen 4
// Editing:    Nano Banana 2 → Nano Banana only (Imagen doesn't support editing)

const axios = require('axios');
const config = require('../../config');
const storage = require('../storage');

const GEN_CHAIN = [
    { model: 'gemini-3.1-flash-image-preview', api: 'gemini' },  // Nano Banana 2
    { model: 'gemini-2.5-flash-image',         api: 'gemini' },  // Nano Banana
    { model: 'imagen-4.0-fast-generate-001',   api: 'imagen' },  // Imagen 4 Fast
    { model: 'imagen-4.0-generate-001',        api: 'imagen' },  // Imagen 4
];

const EDIT_CHAIN = [
    { model: 'gemini-3.1-flash-image-preview', api: 'gemini' },
    { model: 'gemini-2.5-flash-image',         api: 'gemini' },
];

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// Image key is separate — falls back to regular gemini keys if not set
function getImageKeys() {
    const imageKey = config.geminiImageKey;
    return imageKey ? [imageKey] : config.geminiKeys;
}

async function _callGeminiImage(model, key, body) {
    const resp = await axios.post(`${BASE}/${model}:generateContent?key=${key}`, body, { timeout: 90000 });
    const parts = resp.data.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
        if (part.inlineData?.data) {
            return { data: Buffer.from(part.inlineData.data, 'base64'), mimeType: part.inlineData.mimeType || 'image/png' };
        }
    }
    throw new Error('Модель не вернула изображение');
}

async function _callImagen(model, key, prompt) {
    const resp = await axios.post(
        `${BASE}/${model}:predict?key=${key}`,
        { instances: [{ prompt }], parameters: { sampleCount: 1 } },
        { timeout: 90000 }
    );
    const pred = resp.data.predictions?.[0];
    if (pred?.bytesBase64Encoded) {
        return { data: Buffer.from(pred.bytesBase64Encoded, 'base64'), mimeType: pred.mimeType || 'image/png' };
    }
    throw new Error('Imagen не вернул изображение');
}

function _is429(e) {
    const status = e.response?.status || e.status;
    const msg = String(e.response?.data?.error?.message || e.message);
    return status === 429 || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429');
}

function _errMsg(e) {
    return String(e.response?.data?.error?.message || e.message).substring(0, 120);
}

async function _callChain(chain, buildGeminiBody, prompt) {
    const keys = getImageKeys();
    let lastErr;
    for (const { model, api } of chain) {
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            try {
                const result = api === 'imagen'
                    ? await _callImagen(model, key, prompt)
                    : await _callGeminiImage(model, key, buildGeminiBody());
                console.log(`[NanoBanana] Готово (${model}, ключ ${i + 1})`);
                return { ...result, _model: model };
            } catch (e) {
                lastErr = e;
                console.warn(`[NanoBanana] ${model} ключ ${i + 1}: ${_errMsg(e)}`);
                if (!_is429(e)) break; // Не квота — переходим к следующей модели
            }
        }
    }
    throw lastErr;
}

/**
 * Text-to-image generation.
 * @param {string} prompt
 */
async function generateImage(prompt) {
    try {
        const result = await _callChain(
            GEN_CHAIN,
            () => ({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
            prompt
        );
        storage.incrementNanoBananaStat('generated', result._model);
        return result;
    } catch (e) {
        storage.incrementNanoBananaStat('error', null);
        throw e;
    }
}

/**
 * Image editing. Requires Nano Banana (paid). Imagen cannot edit images.
 */
async function editImage(imageBuffer, mimeType, prompt) {
    try {
        const result = await _callChain(
            EDIT_CHAIN,
            () => ({
                contents: [{
                    role: 'user',
                    parts: [
                        { text: prompt },
                        { inlineData: { mimeType, data: imageBuffer.toString('base64') } },
                    ],
                }],
            }),
            prompt
        );
        storage.incrementNanoBananaStat('edited', result._model);
        return result;
    } catch (e) {
        storage.incrementNanoBananaStat('error', null);
        throw e;
    }
}

module.exports = { generateImage, editImage };
