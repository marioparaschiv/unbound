import { splitMatches, type ContentNode } from '@unbound-plugins/shared/metro/content-nodes';

import { TONE_TAG, toneMeaning } from '~/lib/tones';

/**
 * @description Builds the pill Discord draws for a timestamp, showing the tag and, when asked, what it means.
 * @param tag The tag as written, with its slash.
 * @param meaning What it means.
 * @param explain Whether the pill spells out the meaning after the tag.
 * @returns The content node.
 */
export function tonePill(tag: string, meaning: string, explain = true): ContentNode {
	return {
		type: 'timestamp',
		timestamp: '1',
		format: 't',
		parsed: new Date(1000).toISOString(),
		formatted: explain ? `${tag} ${meaning.toLowerCase()}` : tag,
		full: meaning,
	};
}

/**
 * @description Turns the known tone tags in a text into pills.
 * @param text A text node's text.
 * @param custom The user's own tags.
 * @param explain Whether pills spell out their meaning.
 * @returns The nodes, or `undefined` when the text has no known tag.
 */
export function splitTones(
	text: string,
	custom: Record<string, string>,
	explain = true,
): ContentNode[] | undefined {
	return splitMatches(text, TONE_TAG, (match) => {
		const meaning = toneMeaning(match[1] ?? '', custom);

		return meaning ? [tonePill(match[0], meaning, explain)] : undefined;
	});
}

export default { tonePill, splitTones };
