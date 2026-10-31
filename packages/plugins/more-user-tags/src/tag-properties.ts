/** A color already passed through React Native's `processColor`. */
export type NativeColor = unknown;

export type TagColors = { background: NativeColor; text: NativeColor };

/** The fields of Discord's `getTagProperties` result this plugin rewrites. */
export type TagProperties = {
	tagText?: string | null;
	tagAccessibilityLabel?: string | null;
	tagVerified?: boolean;
	tagTextColor?: NativeColor;
	tagBackgroundColor?: NativeColor;
	tagType?: string | null;
	tagIconUrl?: string | null;
	opTagText?: string | null;
	opTagBackgroundColor?: NativeColor;
	opTagTextColor?: NativeColor;
};

/**
 * @description Joins Discord's original poster label with the plugin's tag, so both stay visible.
 * @param opTagText Discord's OP label, if the message has one.
 * @param tagName The plugin tag's display name.
 * @returns The text to show in the tag.
 */
export function combineTagText(opTagText: string | null | undefined, tagName: string): string {
	return opTagText ? `${opTagText} · ${tagName}` : tagName;
}

/**
 * @description Rewrites Discord's tag properties to show the plugin's tag, as a normal tag or in the OP badge style.
 * @param result Discord's original tag properties.
 * @param text The tag text, from `combineTagText`.
 * @param colors The tag colors, or `undefined` to keep Discord's colors.
 * @param useOpTagStyle Whether to draw the tag with Discord's original poster badge styling.
 * @returns The new tag properties.
 */
export function withTag(
	result: TagProperties,
	text: string,
	colors: TagColors | undefined,
	useOpTagStyle: boolean,
): TagProperties {
	if (useOpTagStyle) {
		return {
			...result,
			tagText: null,
			tagAccessibilityLabel: text,
			tagVerified: false,
			tagTextColor: null,
			tagBackgroundColor: null,
			tagType: null,
			tagIconUrl: null,
			opTagText: text,
			...(colors
				? { opTagBackgroundColor: colors.background, opTagTextColor: colors.text }
				: {}),
		};
	}

	return {
		...result,
		opTagText: null,
		opTagBackgroundColor: null,
		opTagTextColor: null,
		tagText: text,
		tagAccessibilityLabel: text,
		tagVerified: false,
		...(colors ? { tagBackgroundColor: colors.background, tagTextColor: colors.text } : {}),
	};
}

export default { combineTagText, withTag };
