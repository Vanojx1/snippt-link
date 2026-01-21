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

/**
 * Updates the URL hash with the encoded snippet data.
 */
export function updateUrlHash(code: string, lang?: string): void {
    const encoded = encode(code, lang);
    history.replaceState(null, '', `#${encoded}`);
}

/**
 * Reads the snippet data from the current URL hash.
 */
export function readUrlHash(): SnippetData | null {
    const hash = window.location.hash.slice(1); // Remove leading #
    return decode(hash);
}
