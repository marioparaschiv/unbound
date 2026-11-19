const NON_LATIN_LETTERS =
	/[\u0370-\u03ff\u0400-\u04ff\u0530-\u058f\u0590-\u05ff\u0600-\u06ff\u0904-\u097f\u0e00-\u0e7f\u10a0-\u10ff\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7a3]/;

/**
 * @description Tells whether a message has letters from a script worth writing in Latin letters: Greek, Cyrillic,
 * Armenian, Hebrew, Arabic, Devanagari, Thai, Georgian, Japanese kana, Chinese characters or Hangul.
 * @param text The message text.
 * @returns Whether it has any.
 */
export function needsRomanizing(text: string): boolean {
	return NON_LATIN_LETTERS.test(text);
}

export default { needsRomanizing };
