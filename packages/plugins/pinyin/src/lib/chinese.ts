const HAN = /[\u3400-\u4dbf\u4e00-\u9fff]/;
const KANA = /[\u3040-\u30ff]/;

/**
 * @description Tells whether a message reads as Chinese: it has Chinese characters and no Japanese kana, since kanji
 * read as Japanese would get the wrong pinyin.
 * @param text The message text.
 * @returns Whether to show its pinyin.
 */
export function needsPinyin(text: string): boolean {
	return HAN.test(text) && !KANA.test(text);
}

const HALF_WIDTH: Record<string, string> = {
	'，': ',',
	'、': ',',
	'。': '.',
	'！': '!',
	'？': '?',
	'；': ';',
	'：': ':',
	'（': '(',
	'）': ')',
	'【': '[',
	'】': ']',
	'《': '«',
	'》': '»',
	'「': '“',
	'」': '”',
	'『': '‘',
	'』': '’',
	'～': '~',
};

const FULL_WIDTH = new RegExp(`[${Object.keys(HALF_WIDTH).join('')}]`, 'g');

/**
 * @description Tidies ICU's pinyin into a reading line: Chinese punctuation as its Latin form, spaced as in English,
 * one space between syllables and no trailing space.
 * @param pinyin What `Han-Latin` returned.
 * @returns The line to show.
 */
export function pinyinLine(pinyin: string): string {
	return pinyin
		.replace(FULL_WIDTH, (mark) => HALF_WIDTH[mark] ?? mark)
		.replace(/\s+/g, ' ')
		.replace(/ ([,.!?;:)\]»”’])/g, '$1')
		.replace(/([([«“‘]) /g, '$1')
		.replace(/([,.!?;:)\]»”’])(?=[^\s\d,.!?;:)\]»”’])/g, '$1 ')
		.replace(/([^\s([«“‘])([([«“‘])/g, '$1 $2')
		.trim();
}

export default { needsPinyin, pinyinLine };
