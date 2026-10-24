import type { SpanRange } from '@unbound-plugins/shared/native/android/spans';

import { type Mention, selectMentionLabel } from '~/mentions';

export const IMAGE_CHARACTER = '￼';
export const IMAGE_PADDING = ' ';

export type { SpanRange } from '@unbound-plugins/shared/native/android/spans';

export type Placement = {
	mention: Mention;
	range: SpanRange;
	replaceStart: number;
	replaceEnd: number;
	insertion: string;
	imageOffset: number;
};

const PADDED_IMAGE = `${IMAGE_PADDING}${IMAGE_CHARACTER}${IMAGE_PADDING}`;

function isDecorated(text: string, range: SpanRange): boolean {
	return (
		text.slice(range.start - PADDED_IMAGE.length, range.start) === PADDED_IMAGE ||
		text.slice(range.end, range.end + PADDED_IMAGE.length) === PADDED_IMAGE
	);
}

function mentionAt(text: string, range: SpanRange, mentions: Mention[]): Mention | undefined {
	const rendered = text.slice(range.start, range.end);

	return mentions.find((mention) => {
		const label = selectMentionLabel(rendered, mention.labels);

		return label !== undefined && `@${label}` === rendered;
	});
}

function placementFor(mention: Mention, range: SpanRange, showAtSymbol: boolean): Placement {
	if (mention.type === 'role') {
		return {
			mention,
			range,
			replaceStart: range.end,
			replaceEnd: range.end,
			insertion: PADDED_IMAGE,
			imageOffset: 1,
		};
	}

	return {
		mention,
		range,
		replaceStart: range.start,
		replaceEnd: showAtSymbol ? range.start : range.start + 1,
		insertion: PADDED_IMAGE,
		imageOffset: 1,
	};
}

/**
 * @description Plans where an image goes beside each mention Discord rendered as a tappable span.
 * @param text The message text.
 * @param tappable The ranges of the text's tappable spans.
 * @param mentions The mentions that may appear in the text.
 * @param showAtSymbol Whether a user mention keeps its `@` beside the image.
 * @returns One placement per recognised mention not decorated yet, last first so applying them in order keeps earlier ranges valid.
 */
export function planPlacements(
	text: string,
	tappable: SpanRange[],
	mentions: Mention[],
	showAtSymbol: boolean,
): Placement[] {
	const placements: Placement[] = [];

	for (const range of tappable) {
		if (text[range.start] !== '@' || isDecorated(text, range)) continue;

		const mention = mentionAt(text, range, mentions);

		if (mention) placements.push(placementFor(mention, range, showAtSymbol));
	}

	return placements.sort((left, right) => right.replaceStart - left.replaceStart);
}

export default { planPlacements };
