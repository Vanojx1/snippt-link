import { strToU8, strFromU8, compressSync, decompressSync } from 'fflate';

export interface SnippetData {
    code: string;
    lang?: string;
}

/**
 * Global dictionary for common code patterns.
 * Uses Unicode Private Use Area (U+E000-U+E01F) as tokens to avoid conflicts.
 * Order matters: longer patterns should come first to avoid partial matches.
 */
const DICTIONARY: [string, string][] = [
    // Common multi-char patterns (longer first!)
    ['    ', '\uE000'],           // 4-space indent (very common)
    ['console.log(', '\uE001'],
    ['function ', '\uE002'],
    ['return ', '\uE003'],
    ['const ', '\uE004'],
    ['export ', '\uE005'],
    ['import ', '\uE006'],
    ['async ', '\uE007'],
    ['await ', '\uE008'],
    ['class ', '\uE009'],
    ['this.', '\uE00A'],
    ['null', '\uE00B'],
    ['true', '\uE00C'],
    ['false', '\uE00D'],
    ['undefined', '\uE00E'],
    ['=> {', '\uE00F'],
    ['() {', '\uE010'],
    [') {', '\uE011'],
    ['": "', '\uE012'],
    ['", "', '\uE013'],
    [' = ', '\uE014'],
    [' === ', '\uE015'],
    [' !== ', '\uE016'],
    ['public ', '\uE017'],
    ['private ', '\uE018'],
    ['static ', '\uE019'],
    ['throw ', '\uE01A'],
    ['catch ', '\uE01B'],
    ['try {', '\uE01C'],
    ['if (', '\uE01D'],
    ['for (', '\uE01E'],
];

/**
 * Apply dictionary compression - replace patterns with tokens
 */
function applyDictionary(text: string): string {
    let result = text;
    for (const [pattern, token] of DICTIONARY) {
        result = result.split(pattern).join(token);
    }
    return result;
}

/**
 * Reverse dictionary compression - replace tokens with patterns
 */
function reverseDictionary(text: string): string {
    let result = text;
    // Reverse order to handle any edge cases
    for (let i = DICTIONARY.length - 1; i >= 0; i--) {
        const [pattern, token] = DICTIONARY[i];
        result = result.split(token).join(pattern);
    }
    return result;
}

/**
 * Normalize code to reduce size while preserving structure.
 * - Removes trailing whitespace from lines
 * - Limits consecutive blank lines to 1
 * - Normalizes line endings to \n
 */
export function normalizeCode(code: string): string {
    return code
        .replace(/\r\n/g, '\n')              // Normalize line endings
        .split('\n')
        .map(line => line.trimEnd())          // Remove trailing whitespace
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')           // Max 2 consecutive newlines
        .trim();                               // Trim start/end
}

/**
 * URL-safe Base64 encoding (no padding, using - and _ instead of + and /)
 */
function toUrlSafeBase64(data: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < data.length; i++) {
        binary += String.fromCharCode(data[i]);
    }
    return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

/**
 * URL-safe Base64 decoding
 */
function fromUrlSafeBase64(str: string): Uint8Array {
    // Restore standard Base64
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    // Add padding if needed
    while (base64.length % 4) base64 += '=';

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

/**
 * Encodes code and optional language into a URL-safe compressed string.
 * Pipeline: normalize → dictionary → fflate → base64
 */
export function encode(code: string, lang?: string): string {
    const normalized = normalizeCode(code);
    const payload = lang ? `${lang}|${normalized}` : normalized;

    // Apply dictionary compression
    const dictCompressed = applyDictionary(payload);

    // Compress with fflate (level 9 for maximum compression)
    const compressed = compressSync(strToU8(dictCompressed), { level: 9 });

    return toUrlSafeBase64(compressed);
}

/**
 * Decodes a URL-safe compressed string back into code and language.
 * Pipeline: base64 → fflate → dictionary → code
 */
export function decode(hash: string): SnippetData | null {
    if (!hash) return null;

    try {
        const compressed = fromUrlSafeBase64(hash);
        const decompressed = strFromU8(decompressSync(compressed));

        if (!decompressed) return null;

        // Reverse dictionary compression
        const restored = reverseDictionary(decompressed);

        // Check if language is embedded (format: lang|code)
        const pipeIndex = restored.indexOf('|');
        if (pipeIndex > 0 && pipeIndex < 20) { // Language names are short
            const possibleLang = restored.substring(0, pipeIndex);
            // Only treat as language if it looks like one (no special chars except -)
            if (/^[a-zA-Z][a-zA-Z0-9-]*$/.test(possibleLang)) {
                return {
                    lang: possibleLang,
                    code: restored.substring(pipeIndex + 1)
                };
            }
        }

        return { code: restored };
    } catch {
        return null;
    }
}

// URL length limits (characters)
const URL_WARNING_LIMIT = 2000;  // Show warning
const URL_ERROR_LIMIT = 8000;    // Too long for some browsers

export interface UrlStatus {
    length: number;
    isWarning: boolean;
    isError: boolean;
}

/**
 * Updates the URL hash with the encoded snippet data.
 * Returns status about URL length.
 */
export function updateUrlHash(code: string, lang?: string): UrlStatus {
    const encoded = encode(code, lang);
    const fullUrl = `${window.location.origin}${window.location.pathname}#${encoded}`;
    const length = fullUrl.length;

    const status: UrlStatus = {
        length,
        isWarning: length > URL_WARNING_LIMIT && length <= URL_ERROR_LIMIT,
        isError: length > URL_ERROR_LIMIT,
    };

    // Only update URL if not exceeding error limit
    if (!status.isError) {
        history.replaceState(null, '', `#${encoded}`);
    }

    return status;
}

/**
 * Reads the snippet data from the current URL hash.
 */
export function readUrlHash(): SnippetData | null {
    const hash = window.location.hash.slice(1); // Remove leading #
    return decode(hash);
}
