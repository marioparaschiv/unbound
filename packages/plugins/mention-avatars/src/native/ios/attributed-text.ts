import {
	imageAttachment,
	isAttachmentRun,
	isTappableRun,
	textAttachmentBridge,
	type TextAttachmentBridge,
	type TextAttachmentValue,
	type TextEngine,
} from '@unbound-plugins/shared/native/ios/text-attachments';

import type { Bridge, Handle, TextAttributes } from '~/native/ios/bridge';
import type { Mention, MentionType } from '~/lib/mentions';
import { MENTION_PLACEHOLDER, PILL_PADDING, PILL_PADDING_ATTRIBUTE } from '~/lib/constants';
import { selectMentionLabel } from '~/lib/mentions';

type MentionMatch = {
	attributes: TextAttributes;
	// Where the mention starts once leading highlighted placeholders are included.
	begin: number;
	index: number;
	label: string;
};

function isInsertedPadding(bridge: Bridge, text: Handle, string: string, index: number): boolean {
	return (
		PILL_PADDING.includes(string[index] ?? '\uFFFF') &&
		Boolean(bridge.attributes(text, index)?.[PILL_PADDING_ATTRIBUTE])
	);
}

function isInsertedAvatar(bridge: Bridge, text: Handle, string: string, index: number): boolean {
	return (
		(string[index] === MENTION_PLACEHOLDER &&
			isAttachmentRun(bridge.attributes(text, index))) ||
		isInsertedPadding(bridge, text, string, index)
	);
}

function isHighlighted(bridge: Bridge, text: Handle, from: number, to: number): boolean {
	for (let index = from; index < to; index++) {
		if (!isTappableRun(bridge.attributes(text, index))) {
			return false;
		}
	}

	return true;
}

// Finds the next `@label` that Discord rendered as a tappable mention, from `start` on.
function nextMention(
	bridge: Bridge,
	text: Handle,
	string: string,
	start: number,
	labels: string[],
): MentionMatch | null {
	for (
		let index = string.indexOf('@', start);
		index !== -1;
		index = string.indexOf('@', index + 1)
	) {
		const label = selectMentionLabel(string.slice(index), labels);
		const attributes = label ? bridge.attributes(text, index) : null;

		if (!label || !isTappableRun(attributes)) {
			continue;
		}

		if (!isHighlighted(bridge, text, index + 1, index + label.length + 1)) {
			continue;
		}

		let begin = index;

		while (
			begin > start &&
			(string[begin - 1] === MENTION_PLACEHOLDER ||
				isInsertedPadding(bridge, text, string, begin - 1)) &&
			isTappableRun(bridge.attributes(text, begin - 1))
		) {
			begin--;
		}

		return { attributes, begin, index, label };
	}

	return null;
}

// Builds attachments through `bridge`, so they are made on the same thread as the text they join.
function attachmentBridge(bridge: Bridge): TextAttachmentBridge {
	return {
		...textAttachmentBridge(bridge.objc),
		call: (target, selector, ...args) =>
			(bridge.call(target, selector, ...args) ?? null) as TextAttachmentValue,
	};
}

function attributedMention(
	bridge: Bridge,
	engine: TextEngine,
	text: string,
	type: MentionType,
	attributes: TextAttributes,
	image: Handle,
): Handle {
	const leading = type === 'role' ? 4 : 2;
	const trailing = type === 'role' ? 2 : 4;
	const mention = bridge.objc.alloc('NSMutableAttributedString');

	bridge.call(mention, 'initWithString:attributes:', text, attributes);

	const avatar = imageAttachment(attachmentBridge(bridge), engine, {
		attributes,
		image,
		leading,
		size: 16,
		trailing: engine === 'textkit' ? 0 : trailing,
	});

	if (!avatar) return mention;

	const replacement = bridge.objc.alloc('NSMutableAttributedString');
	const parts = type === 'role' ? [mention, avatar] : [avatar, mention];

	if (engine === 'textkit') {
		const gap = bridge.objc.alloc('NSMutableAttributedString');

		bridge.call(gap, 'initWithString:attributes:', PILL_PADDING, {
			...attributes,
			[PILL_PADDING_ATTRIBUTE]: true,
		});
		parts.splice(1, 0, gap);
	}

	bridge.call(replacement, 'init');

	for (const part of parts) {
		bridge.call(replacement, 'appendAttributedString:', part);
	}

	return replacement;
}

/**
 * @description Puts an image beside each mention whose image is ready, in a copy of message text.
 * @param bridge A `current` thread bridge: the copy belongs to no view yet, and main-thread calls per mention froze Discord.
 * @param engine The text view's layout engine.
 * @param result A mutable copy of the attributed text, which this edits.
 * @param mentions The message's mentions, in order.
 * @param imageFor Returns a mention's image, or `null` while it is not ready.
 * @param showAtSymbol Whether a mention keeps its `@` beside the image.
 * @returns `result`.
 */
export function insertMentionImages(
	bridge: Bridge,
	engine: TextEngine,
	result: Handle,
	mentions: Mention[],
	imageFor: (mention: Mention) => Handle | null,
	showAtSymbol: boolean,
): Handle {
	let searchIndex = 0;

	for (const mention of mentions) {
		const string = bridge.string(result, 'string');

		if (string === undefined || searchIndex >= string.length) break;

		const match = nextMention(bridge, result, string, searchIndex, mention.labels);

		if (!match) break;

		const { attributes, begin, index, label } = match;
		const end = index + label.length + 1;
		const image = imageFor(mention);

		if (!image) {
			searchIndex = end;
			continue;
		}

		// Widen the range over images a previous pass inserted, so they are replaced, not doubled.
		let from = index;
		let to = end;

		while (from > begin && isInsertedAvatar(bridge, result, string, from - 1)) {
			from--;
		}

		while (isInsertedAvatar(bridge, result, string, to)) {
			to++;
		}

		const replacement = attributedMention(
			bridge,
			engine,
			showAtSymbol ? `@${label}` : label,
			mention.type,
			attributes,
			image,
		);

		bridge.call(
			result,
			'replaceCharactersInRange:withAttributedString:',
			bridge.range(from, to - from),
			replacement,
		);
		searchIndex = from + bridge.number(replacement, 'length');
	}

	return result;
}

export default insertMentionImages;
