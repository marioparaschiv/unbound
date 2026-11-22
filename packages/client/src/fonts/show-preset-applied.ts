import type { UnboundFontPresetResult } from '@unbound-app/types';

import { format } from '~/i18n/api';
import { show } from '~/toasts/api';

/**
 * @description Toasts what applying a font preset did, warning when some families kept Discord's font.
 * @param name The preset's name.
 * @param result What the loader applied.
 * @param id The id of a toast to replace, such as the one showing the download.
 */
export function showPresetApplied(
	name: string,
	result: UnboundFontPresetResult,
	id?: string,
): void {
	const partial = result.unavailable.length > 0 || result.skipped.length > 0;

	show({
		id,
		title: name,
		content: partial
			? format('UNBOUND_FONTS_PRESET_APPLIED_PARTIAL', {
					name,
					unavailable: result.unavailable.length,
					skipped: result.skipped.length,
				})
			: format('UNBOUND_FONTS_PRESET_APPLIED', { name }),
		icon: partial ? 'WarningIcon' : 'CircleCheckIcon',
	});
}
