import { metro } from '@unbound-app/api';

/**
 * @description The font family Discord's body text uses, such as `ggsans-Normal`, for measuring tooltip text natively.
 * @returns The family's first name, or `undefined` when Discord's font constants are missing.
 */
export function tooltipFontFamily(): string | undefined {
	const family: unknown = metro.common.Constants?.Fonts?.PRIMARY_NORMAL;

	if (typeof family !== 'string') return undefined;

	return family.split(',')[0]?.trim() || undefined;
}

export default tooltipFontFamily;
