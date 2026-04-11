// ASCII Art generator — converts image buffer to monospace text art
// No AI tokens required, runs locally with jimp

const Jimp = require('jimp');

// Dark to light: maps pixel brightness (0=black → dense char, 255=white → space)
const CHARS = ['@', '#', 'M', 'B', '&', '%', 'W', 'X', 'H', '+', ';', ':', '.', ' '];

const MAX_WIDTH = 48;    // ~optimal for Telegram mobile
const MAX_HEIGHT = 55;   // keep under 4096 char message limit

/**
 * Converts an image buffer to ASCII art string.
 * @param {Buffer} imageBuffer - raw image bytes (JPEG, PNG, WebP, etc.)
 * @returns {Promise<string>} multiline ASCII art
 */
async function imageToAscii(imageBuffer) {
    const image = await Jimp.read(imageBuffer);

    // Calculate target dimensions preserving aspect ratio
    // Terminal chars are ~2x taller than wide, so halve the height
    const aspect = image.bitmap.height / image.bitmap.width;
    let width = Math.min(MAX_WIDTH, image.bitmap.width);
    let height = Math.min(MAX_HEIGHT, Math.floor(width * aspect * 0.48));
    if (height < 4) height = 4;

    image.resize(width, height).grayscale();

    const lines = [];
    for (let y = 0; y < image.bitmap.height; y++) {
        let line = '';
        for (let x = 0; x < image.bitmap.width; x++) {
            const rgba = Jimp.intToRGBA(image.getPixelColor(x, y));
            const brightness = Math.round(0.299 * rgba.r + 0.587 * rgba.g + 0.114 * rgba.b);
            const idx = Math.floor((brightness / 255) * (CHARS.length - 1));
            line += CHARS[idx];
        }
        lines.push(line);
    }

    return lines.join('\n');
}

module.exports = { imageToAscii };
