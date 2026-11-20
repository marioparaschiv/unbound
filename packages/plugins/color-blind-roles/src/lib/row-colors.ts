export type AdjustColor = (argb: number) => number;

type Node = Record<string, unknown>;

const NAME_COLOR_KEYS = ['roleColor', 'usernameColor', 'colorString'] as const;
const MENTION_COLOR_KEYS = ['roleColor', 'color', 'colorString'] as const;
const ROLE_COLOR_KEYS = ['roleColor'] as const;

function isNode(value: unknown): value is Node {
	return typeof value === 'object' && value !== null;
}

function adjustValue(value: unknown, adjust: AdjustColor): unknown {
	if (typeof value === 'number') return adjust(value);

	if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) {
		const rgb = adjust(0xff000000 | Number.parseInt(value.slice(1), 16)) & 0xffffff;

		return `#${rgb.toString(16).padStart(6, '0')}`;
	}

	if (isNode(value)) {
		for (const [key, inner] of Object.entries(value)) value[key] = adjustValue(inner, adjust);
	}

	return value;
}

function adjustKeys(node: Node, keys: readonly string[], adjust: AdjustColor) {
	for (const key of keys) {
		if (node[key] != null) node[key] = adjustValue(node[key], adjust);
	}

	if (isNode(node.roleColors)) adjustValue(node.roleColors, adjust);
}

function adjustMentions(content: unknown, adjust: AdjustColor) {
	if (Array.isArray(content)) {
		for (const item of content) adjustMentions(item, adjust);

		return;
	}

	if (!isNode(content)) return;

	if (content.type === 'mention' && content.roleId != null) {
		adjustKeys(content, MENTION_COLOR_KEYS, adjust);

		return;
	}

	if (content.roleColor != null || isNode(content.roleColors)) {
		adjustKeys(content, ROLE_COLOR_KEYS, adjust);
	}

	adjustMentions(content.content, adjust);
}

/**
 * @description Adjusts the role colors a chat row's message carries: the author's name colors and, when asked, the
 * role colors in its content (mentioned roles, and users and names colored by their role), and the same for the message it
 * replies to.
 * @param message The row's message, which this changes in place.
 * @param adjust Maps an ARGB color to the one to show.
 * @param mentions Whether to adjust mentioned roles too.
 */
export function adjustRowColors(message: Node, adjust: AdjustColor, mentions: boolean): void {
	adjustKeys(message, NAME_COLOR_KEYS, adjust);

	if (mentions) adjustMentions(message.content, adjust);

	const reply = isNode(message.referencedMessage) ? message.referencedMessage.message : undefined;

	if (isNode(reply)) adjustRowColors(reply, adjust, mentions);
}

export default { adjustRowColors };
