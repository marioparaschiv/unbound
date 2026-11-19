import type { NativeBridge, NativeObjectHandle } from '@unbound-app/api/native';

import type { ReadToken } from '~/lib/furigana';

const WORD_UNIT = 0n;
const LATIN_TRANSCRIPTION = 0x10000n;
const MAX_TOKENS = 400;
const READING_SEPARATOR = '\n';

type Range = { location: number; length: number };
type BoxedRange = Range | { value: Range };

function rangeOf(boxed: BoxedRange): Range {
	return 'value' in boxed ? boxed.value : boxed;
}

function textOf(objc: NativeBridge['objc'], value: NativeObjectHandle | string | null): string {
	if (typeof value === 'string') return value;

	return value ? String(objc.call(value, 'description')) : '';
}

/**
 * @description Splits Japanese text into words with their readings in hiragana, using Core Foundation's Japanese
 * tokenizer for the words and their Latin transcription, then Foundation's `Latin-Hiragana` transform.
 * @param bridge The plugin's native bridge.
 * @param text The message text.
 * @returns The words, in order, with their readings.
 */
export async function japaneseTokensIOS(
	{ objc, ffi }: NativeBridge,
	text: string,
): Promise<ReadToken[]> {
	if (!ffi) return [];

	const symbol = (name: string) => ffi.symbol(name)!;
	const source = objc.create('NSString', 'initWithString:', [text]);
	const locale = objc.create('NSLocale', 'initWithLocaleIdentifier:', ['ja']);
	const tokenizer = ffi.call(
		symbol('CFStringTokenizerCreate'),
		{
			returnType: 'pointer',
			args: ['pointer', 'object', { struct: 'NSRange' }, 'u64', 'object'],
		},
		null,
		source,
		objc.struct('NSRange', { location: 0, length: Number(objc.call(source, 'length')) }),
		WORD_UNIT,
		locale,
	);
	const found: (Range & { latin: string })[] = [];

	try {
		while (
			found.length < MAX_TOKENS &&
			ffi.call(
				symbol('CFStringTokenizerAdvanceToNextToken'),
				{ returnType: 'u64', args: ['pointer'] },
				tokenizer,
			)
		) {
			const range = rangeOf(
				ffi.call(
					symbol('CFStringTokenizerGetCurrentTokenRange'),
					{ returnType: { struct: 'NSRange' }, args: ['pointer'] },
					tokenizer,
				) as BoxedRange,
			);
			const latin = ffi.call(
				symbol('CFStringTokenizerCopyCurrentTokenAttribute'),
				{ returnType: 'object', args: ['pointer', 'u64'] },
				tokenizer,
				LATIN_TRANSCRIPTION,
			) as NativeObjectHandle | string | null;

			found.push({
				location: Number(range.location),
				length: Number(range.length),
				latin: textOf(objc, latin),
			});
		}
	} finally {
		ffi.call(symbol('CFRelease'), { returnType: 'void', args: ['pointer'] }, tokenizer);
	}

	const joined = objc.create('NSString', 'initWithString:', [
		found.map(({ latin }) => latin).join(READING_SEPARATOR),
	]);
	const hiragana = await objc.invokeAsync(joined, 'stringByApplyingTransform:reverse:', [
		'Latin-Hiragana',
		false,
	]);
	const readings = typeof hiragana === 'string' ? hiragana.split(READING_SEPARATOR) : [];

	return found.map(({ location, length }, index) => ({
		start: location,
		length,
		reading: readings[index] ?? '',
	}));
}

export default japaneseTokensIOS;
