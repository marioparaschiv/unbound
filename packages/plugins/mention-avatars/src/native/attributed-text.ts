import type { Bridge, Handle, TextAttributes } from '~/native/bridge';
import type { Mention, MentionType } from '~/mentions';
import { MENTION_PLACEHOLDER } from '~/constants';
import { selectMentionLabel } from '~/mentions';

type MentionMatch = {
	attributes: TextAttributes;
	// Where the mention starts once leading highlighted placeholders are included.
	begin: number;
	index: number;
	label: string;
};

function isHighlighted(bridge: Bridge, text: Handle, from: number, to: number): boolean {
	for (let index = from; index < to; index++) {
		if (!bridge.attributes(text, index)?.YYTextHighlight) {
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

		if (!label || !attributes?.YYTextHighlight) {
			continue;
		}

		if (!isHighlighted(bridge, text, index + 1, index + label.length + 1)) {
			continue;
		}

		let begin = index;

		while (
			begin > start &&
			string[begin - 1] === MENTION_PLACEHOLDER &&
			bridge.attributes(text, begin - 1)?.YYTextHighlight
		) {
			begin--;
		}

		return { attributes, begin, index, label };
	}

	return null;
}

function imageAttachment(
	bridge: Bridge,
	image: Handle,
	type: MentionType,
	attributes: TextAttributes,
): Handle | null {
	const { objc } = bridge;
	const YYTextAttachment = objc.getClass('YYTextAttachment');

	if (!YYTextAttachment) return null;

	const leading = type === 'role' ? 4 : 2;
	const trailing = type === 'role' ? 2 : 4;
	const attachment = objc.alloc(YYTextAttachment);

	bridge.setValues(attachment, {
		content: image,
		contentMode: 1,
		contentInsets: objc.struct('UIEdgeInsets', {
			top: 0,
			left: leading,
			bottom: 0,
			right: trailing,
		}),
	});

	const result = objc.alloc('NSMutableAttributedString');

	bridge.call(result, 'initWithString:attributes:', MENTION_PLACEHOLDER, attributes);
	bridge.call(
		result,
		'addAttribute:value:range:',
		'YYTextAttachment',
		attachment,
		bridge.range(0, 1),
	);

	// Without a run delegate the line keeps the placeholder's text width instead of the image's.
	const YYTextRunDelegate = objc.getClass('YYTextRunDelegate');
	const font = attributes.NSFont;

	if (!YYTextRunDelegate || !font) return result;

	const runDelegate = objc.alloc(YYTextRunDelegate);

	bridge.setValues(runDelegate, {
		ascent: bridge.number(font, 'ascender'),
		descent: -bridge.number(font, 'descender'),
		width: leading + 16 + trailing,
	});

	if (!objc.respondsTo(runDelegate, 'CTRunDelegate')) return result;

	const coreTextRunDelegate = bridge.call(runDelegate, 'CTRunDelegate');

	if (coreTextRunDelegate) {
		bridge.call(
			result,
			'addAttribute:value:range:',
			'CTRunDelegate',
			coreTextRunDelegate,
			bridge.range(0, 1),
		);
	}

	return result;
}

function attributedMention(
	bridge: Bridge,
	text: string,
	type: MentionType,
	attributes: TextAttributes,
	image: Handle,
): Handle {
	const mention = bridge.objc.alloc('NSAttributedString');

	bridge.call(mention, 'initWithString:attributes:', text, attributes);

	const avatar = imageAttachment(bridge, image, type, attributes);

	if (!avatar) return mention;

	const replacement = bridge.objc.alloc('NSMutableAttributedString');

	bridge.call(replacement, 'init');

	for (const part of type === 'role' ? [mention, avatar] : [avatar, mention]) {
		bridge.call(replacement, 'appendAttributedString:', part);
	}

	return replacement;
}

/**
 * @description Copies attributed message text with an image beside each mention whose image is ready.
 * @param bridge The plugin's native bridge.
 * @param text The original attributed text.
 * @param mentions The message's mentions, in order.
 * @param imageFor Returns a mention's image, or `null` while it is not ready.
 * @param showAtSymbol Whether a mention keeps its `@` beside the image.
 * @returns The new attributed text, or `text` when it cannot be copied.
 */
export function insertMentionImages(
	bridge: Bridge,
	text: Handle,
	mentions: Mention[],
	imageFor: (mention: Mention) => Handle | null,
	showAtSymbol: boolean,
): Handle {
	const result = bridge.handle(text, 'mutableCopy');

	if (!result) return text;

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

		while (
			from > begin &&
			string[from - 1] === MENTION_PLACEHOLDER &&
			bridge.attributes(result, from - 1)?.YYTextAttachment
		) {
			from--;
		}

		while (
			string[to] === MENTION_PLACEHOLDER &&
			bridge.attributes(result, to)?.YYTextAttachment
		) {
			to++;
		}

		const replacement = attributedMention(
			bridge,
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
