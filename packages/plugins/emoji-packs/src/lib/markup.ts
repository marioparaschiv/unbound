export type EmojiNode = { type: 'emoji'; content: string; surrogate?: string; jumboable?: boolean };

export type CustomEmojiNode = {
	type: 'customEmoji';
	id: string;
	alt: string;
	src: string;
	frozenSrc: string;
	jumboable?: boolean;
};

export type MarkupNode = { type?: string; content?: unknown };

export type Markup = { content?: unknown; [key: string]: unknown };

function isEmojiNode(node: MarkupNode): node is EmojiNode {
	return node.type === 'emoji' && typeof (node as EmojiNode).surrogate === 'string';
}

function packEmoji(
	node: EmojiNode,
	imageFor: (surrogates: string) => string | undefined,
): CustomEmojiNode | undefined {
	const src = node.surrogate && imageFor(node.surrogate);

	if (!src) return undefined;

	return {
		type: 'customEmoji',
		id: '',
		alt: node.content.replace(/^:|:$/g, ''),
		src,
		frozenSrc: src,
		...(node.jumboable === undefined ? {} : { jumboable: node.jumboable }),
	};
}

function swapNodes(
	nodes: MarkupNode[],
	imageFor: (surrogates: string) => string | undefined,
): MarkupNode[] {
	return nodes.map((node) => {
		if (isEmojiNode(node)) return packEmoji(node, imageFor) ?? node;

		if (Array.isArray(node.content)) {
			return { ...node, content: swapNodes(node.content as MarkupNode[], imageFor) };
		}

		return node;
	});
}

/**
 * @description Redraws a parsed message's unicode emoji as custom emoji pointing at a pack's images.
 * @template T The parsed markup.
 * @param markup What Discord's markup parser returned.
 * @param imageFor The pack image for an emoji, or `undefined` to keep Discord's.
 * @returns The markup with its emoji swapped, or the same object when it holds no node list.
 */
export function swapMarkupEmoji<T extends Markup>(
	markup: T,
	imageFor: (surrogates: string) => string | undefined,
): T {
	if (!Array.isArray(markup?.content)) return markup;

	return { ...markup, content: swapNodes(markup.content as MarkupNode[], imageFor) };
}
