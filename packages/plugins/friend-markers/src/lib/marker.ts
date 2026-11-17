export type TagLabels = {
	tagText?: string | null;
	opTagText?: string | null;
	tagAccessibilityLabel?: string | null;
};

/**
 * @description Adds the friend label to a message header's tags: as the small OP-style label, joined to an OP label
 * already there. A bot or app tag in the main tag slot is left as it is.
 * @template T The tag properties.
 * @param tags Discord's tag properties for the header.
 * @param label The friend label.
 * @returns The tags with the label.
 */
export function withFriendLabel<T extends TagLabels>(tags: T, label: string): T {
	const text = tags.opTagText ? `${tags.opTagText} · ${label}` : label;

	return { ...tags, opTagText: text, tagAccessibilityLabel: tags.tagAccessibilityLabel ?? text };
}
