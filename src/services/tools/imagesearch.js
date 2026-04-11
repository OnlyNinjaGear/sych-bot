// Image search via Bing — no API key required
// Flow: GET Bing image search HTML → parse <a class="iusc" m="{...}"> → download first valid image

const axios = require('axios');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function _searchUrls(query) {
    const resp = await axios.get('https://www.bing.com/images/search', {
        params: { q: query, form: 'HDRSC2', first: 1 },
        headers: {
            'User-Agent': UA,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        },
        timeout: 12000,
    });

    const urls = [];
    // Bing renders: <a class="iusc" m='{"murl":"https://..."}'>  (single quotes)
    // or HTML-encoded:  m="{&quot;murl&quot;:...}"              (double quotes)
    const re = /\bm=(?:"([^"]+)"|'([^']+)')/g;
    let m;
    while ((m = re.exec(resp.data)) !== null) {
        try {
            const raw = (m[1] || m[2]).replace(/&quot;/g, '"').replace(/&amp;/g, '&');
            const obj = JSON.parse(raw);
            if (obj.murl) urls.push(obj.murl);
        } catch {
            // skip malformed entry
        }
        if (urls.length >= 10) break;
    }
    return urls;
}

async function _downloadImage(url) {
    const resp = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 12000,
        headers: { 'User-Agent': UA },
        maxContentLength: 12 * 1024 * 1024,
    });
    const ct = (resp.headers['content-type'] || '').split(';')[0].trim();
    if (!ct.startsWith('image/')) throw new Error(`Не картинка: ${ct}`);
    return { data: Buffer.from(resp.data), mimeType: ct || 'image/jpeg' };
}

/**
 * Find and download the first available image for a query.
 * @param {string} query - search query
 * @returns {Promise<{ data: Buffer, mimeType: string, url: string }>}
 */
async function findImage(query) {
    const urls = await _searchUrls(query);
    if (!urls.length) throw new Error('Нет результатов по запросу');

    // Try up to 5 URLs — some may be dead links or geo-blocked
    for (const url of urls.slice(0, 5)) {
        try {
            const img = await _downloadImage(url);
            return { ...img, url };
        } catch {
            // try next
        }
    }
    throw new Error('Ни одна картинка не скачалась');
}

module.exports = { findImage };
