const HAN = new RegExp('[\\u3400-\\u4dbf\\u4e00-\\u9fff]');
const KANA = new RegExp('[\\u3040-\\u30ff]');

/**
 * @description Tells whether a message reads as Chinese: it has Chinese characters and no Japanese kana, since kanji
 * read as Japanese would get the wrong pinyin.
 * @param text The message text.
 * @returns Whether to show its pinyin.
 */
export function needsPinyin(text: string): boolean {
	return HAN.test(text) && !KANA.test(text);
}

/**
 * @description Tidies ICU's pinyin into a reading line: one space between syllables and no trailing space.
 * @param pinyin What `Han-Latin` returned.
 * @returns The line to show.
 */
export function pinyinLine(pinyin: string): string {
	return pinyin.replace(/\s+/g, ' ').trim();
}

export default { needsPinyin, pinyinLine };
