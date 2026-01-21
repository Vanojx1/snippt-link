import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';

export interface SnippetData {
    code: string;
    lang?: string;
}

/**
 * Encodes code and optional language into a URL-safe compressed string.
 * Format: lang|code (lang is optional)
 */
export function encode(code: string, lang?: string): string {
    const payload = lang ? `${lang}|${code}` : code;
    return compressToEncodedURIComponent(payload);
}

/**
 * Decodes a URL-safe compressed string back into code and language.
 */
export function decode(hash: string): SnippetData | null {
    if (!hash) return null;

    try {
        const decompressed = decompressFromEncodedURIComponent(hash);
        if (!decompressed) return null;

        // Check if language is embedded (format: lang|code)
        const pipeIndex = decompressed.indexOf('|');
        if (pipeIndex > 0 && pipeIndex < 20) { // Language names are short
            const possibleLang = decompressed.substring(0, pipeIndex);
            // Only treat as language if it looks like one (no special chars except -)
            if (/^[a-zA-Z][a-zA-Z0-9-]*$/.test(possibleLang)) {
                return {
                    lang: possibleLang,
                    code: decompressed.substring(pipeIndex + 1)
                };
            }
        }

        return { code: decompressed };
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
