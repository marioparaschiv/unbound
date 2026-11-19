export type Mistake = { offset: number; length: number; message: string; fix?: string };

const API_URL = 'https://api.languagetool.org/v2/check';

// UNKNOWN: the API's JSON is read structurally.
function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

/**
 * @description Reads LanguageTool's matches, keeping each one's place, message and first suggested fix.
 * @param payload The parsed response.
 * @returns The mistakes, in text order.
 */
export function readMistakes(payload: unknown): Mistake[] {
	const matches = isRecord(payload) && Array.isArray(payload.matches) ? payload.matches : [];

	return matches
		.flatMap((match: unknown) => {
			if (
				!isRecord(match) ||
				typeof match.offset !== 'number' ||
				typeof match.length !== 'number'
			) {
				return [];
			}

			const [first] = Array.isArray(match.replacements) ? match.replacements : [];
			const fix =
				isRecord(first) && typeof first.value === 'string' ? first.value : undefined;

			return [
				{
					offset: match.offset,
					length: match.length,
					message: typeof match.message === 'string' ? match.message : '',
					...(fix === undefined ? {} : { fix }),
				},
			];
		})
		.sort((first, second) => first.offset - second.offset);
}

/**
 * @description Applies fixes to a text, from the end so earlier offsets stay valid. Overlapping fixes after the first are skipped.
 * @param text The draft.
 * @param mistakes The mistakes to fix; those without a fix are skipped.
 * @returns The fixed text.
 */
export function applyFixes(text: string, mistakes: Mistake[]): string {
	let fixed = text;
	let limit = Number.POSITIVE_INFINITY;

	for (const mistake of [...mistakes].sort((first, second) => second.offset - first.offset)) {
		if (mistake.fix === undefined || mistake.offset + mistake.length > limit) continue;

		fixed =
			fixed.slice(0, mistake.offset) +
			mistake.fix +
			fixed.slice(mistake.offset + mistake.length);
		limit = mistake.offset;
	}

	return fixed;
}

/**
 * @description Asks LanguageTool's free API for the draft's spelling and grammar mistakes, detecting its language.
 * @param text The draft.
 * @returns The mistakes, or throws when the API fails.
 */
export async function checkText(text: string): Promise<Mistake[]> {
	const response = await fetch(API_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: `language=auto&text=${encodeURIComponent(text)}`,
	});

	if (!response.ok) throw new Error(`LanguageTool answered ${response.status}`);

	return readMistakes(await response.json());
}

/**
 * @description Fixes a text one mistake at a time, checking again after each fix, since LanguageTool can suggest two
 * fixes for one problem, such as changing both words of a disagreeing subject and verb.
 * @param text The draft.
 * @param check Finds a text's mistakes.
 * @param rounds The most fixes to make.
 * @returns The fixed text.
 */
export async function fixStepByStep(
	text: string,
	check: (text: string) => Promise<Mistake[]> = checkText,
	rounds = 8,
): Promise<string> {
	let fixed = text;

	for (let round = 0; round < rounds; round++) {
		const next = (await check(fixed)).find((mistake) => mistake.fix !== undefined);

		if (!next) break;

		fixed = applyFixes(fixed, [next]);
	}

	return fixed;
}
