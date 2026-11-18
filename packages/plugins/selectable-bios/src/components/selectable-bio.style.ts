import { Discord } from '@unbound-app/api/metro/components';
import { metro } from '@unbound-app/api';

type TextStyles = { TextStyleSheet?: Record<string, object> };

const Typography: TextStyles | undefined = metro.findByProps('TextStyleSheet', { lazy: true });

/**
 * @description The selectable bio's field, drawn like Discord's own bio text so swapping to it doesn't move anything.
 * @returns The styles.
 */
export default Discord.createStyles(() => ({
	field: {
		color: metro.common.Theme.colors.TEXT_DEFAULT,
		margin: 0,
		padding: 0,
		paddingTop: 0,
		paddingBottom: 0,
		textAlignVertical: 'top',
	},
}));

/**
 * @description Reads the typography of one of Discord's text variants.
 * @param variant The variant, such as `text-md/normal`.
 * @returns Its font, size and line height, or nothing when Discord moved the style sheet.
 */
export function variantStyle(variant: string | undefined): object | undefined {
	return Typography?.TextStyleSheet?.[variant ?? 'text-md/normal'];
}
