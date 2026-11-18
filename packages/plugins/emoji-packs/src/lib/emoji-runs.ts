export type EmojiRun = { start: number; length: number; surrogates: string };

const ZWJ = 0x200d;
const VS16 = 0xfe0f;
const KEYCAP = 0x20e3;

function isPictographic(point: number): boolean {
	'worklet';

	return (
		(point >= 0x1f300 && point <= 0x1faff) ||
		(point >= 0x2600 && point <= 0x27bf) ||
		(point >= 0x2300 && point <= 0x23ff) ||
		(point >= 0x2b00 && point <= 0x2bff) ||
		point === 0x00a9 ||
		point === 0x00ae ||
		point === 0x203c ||
		point === 0x2049 ||
		point === 0x2122 ||
		point === 0x2139 ||
		(point >= 0x2194 && point <= 0x21aa) ||
		point === 0x24c2 ||
		(point >= 0x25aa && point <= 0x25fe) ||
		point === 0x3030 ||
		point === 0x303d ||
		point === 0x3297 ||
		point === 0x3299
	);
}

function isRegional(point: number): boolean {
	'worklet';

	return point >= 0x1f1e6 && point <= 0x1f1ff;
}

function isJoinedPart(point: number): boolean {
	'worklet';

	return (
		point === VS16 ||
		point === KEYCAP ||
		(point >= 0x1f3fb && point <= 0x1f3ff) ||
		(point >= 0xe0020 && point <= 0xe007f)
	);
}

function isKeycapBase(point: number): boolean {
	'worklet';

	return point === 0x23 || point === 0x2a || (point >= 0x30 && point <= 0x39);
}

/**
 * @description Finds the emoji in text, with UTF-16 offsets as native text uses: joined sequences, flags, keycaps and
 * skin tones each count as one emoji.
 * @param text The text.
 * @returns Each emoji with its offset, length and characters.
 */
export function emojiRuns(text: string): EmojiRun[] {
	'worklet';
	const points = Array.from(text, (char) => char.codePointAt(0) ?? 0);
	const runs: EmojiRun[] = [];
	let offset = 0;
	let index = 0;

	while (index < points.length) {
		const point = points[index]!;
		const next = points[index + 1];
		const startsKeycap =
			isKeycapBase(point) &&
			(next === KEYCAP || (next === VS16 && points[index + 2] === KEYCAP));
		const startsFlag = isRegional(point) && next !== undefined && isRegional(next);

		if (!isPictographic(point) && !startsKeycap && !startsFlag) {
			offset += point > 0xffff ? 2 : 1;
			index++;
			continue;
		}

		let end = index + (startsFlag ? 2 : 1);

		while (end < points.length) {
			const current = points[end]!;

			if (isJoinedPart(current)) {
				end++;
			} else if (
				current === ZWJ &&
				end + 1 < points.length &&
				isPictographic(points[end + 1]!)
			) {
				end += 2;
			} else {
				break;
			}
		}

		const surrogates = String.fromCodePoint(...points.slice(index, end));

		runs.push({ start: offset, length: surrogates.length, surrogates });
		offset += surrogates.length;
		index = end;
	}

	return runs;
}
