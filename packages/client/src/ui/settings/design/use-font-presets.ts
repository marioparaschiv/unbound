import type { UnboundFontPreset } from '@unbound-app/types';

import { readPastedPreset } from '~/fonts/sources';
import { Manager } from '~/addons/manager';
import { Clipboard } from '~/metro/common';
import { format } from '~/i18n/api';
import { show } from '~/toasts/api';

function fail(title: string, error: Error | undefined) {
	show({ title, content: error?.message ?? '', icon: 'CircleXIcon' });
}

/**
 * @description The preset actions behind the Presets group, each ending in a toast: save the current
 * overrides, paste one from the clipboard, apply, copy and delete.
 * @returns The actions.
 */
function useFontPresets() {
	const fonts = Manager.for('font');

	async function save(name: string) {
		const saved = await fonts.savePreset(name);

		if (saved) {
			show({
				title: saved.name,
				content: format('UNBOUND_FONTS_PRESET_SAVED', { name: saved.name }),
				icon: 'CircleCheckIcon',
			});
		} else {
			fail(name, fonts.errors.get(name));
		}
	}

	async function paste() {
		const text: string = await Clipboard.getString();
		const pasted = readPastedPreset(text);

		if (!pasted) {
			show({
				title: format('UNBOUND_FONTS_PRESET_PASTE'),
				content: format('UNBOUND_FONTS_PRESET_PASTE_INVALID'),
				icon: 'CircleXIcon',
			});

			return;
		}

		const saved = await fonts.savePreset(pasted);

		if (saved) {
			show({
				title: saved.name,
				content: format('UNBOUND_FONTS_PRESET_SAVED', { name: saved.name }),
				icon: 'CircleCheckIcon',
			});
		} else {
			fail(pasted.name, fonts.errors.get(pasted.name));
		}
	}

	async function apply(preset: UnboundFontPreset) {
		const result = await fonts.applyPreset(preset.id);

		if (!result) {
			fail(preset.name, fonts.errors.get(preset.id));

			return;
		}

		const partial = result.unavailable.length > 0 || result.skipped.length > 0;

		show({
			title: preset.name,
			content: partial
				? format('UNBOUND_FONTS_PRESET_APPLIED_PARTIAL', {
						name: preset.name,
						unavailable: result.unavailable.length,
						skipped: result.skipped.length,
					})
				: format('UNBOUND_FONTS_PRESET_APPLIED', { name: preset.name }),
			icon: partial ? 'WarningIcon' : 'CircleCheckIcon',
		});
	}

	function copy(preset: UnboundFontPreset) {
		const copied = fonts.copyPreset(preset.id);

		if (!copied) return;

		Clipboard.setString(copied.text);
		show({
			title: preset.name,
			content:
				copied.dropped.length > 0
					? format('UNBOUND_FONTS_PRESET_COPIED_DROPPED', {
							name: preset.name,
							families: copied.dropped.join(', '),
						})
					: format('UNBOUND_FONTS_PRESET_COPIED', { name: preset.name }),
			icon: 'CopyIcon',
		});
	}

	function remove(preset: UnboundFontPreset) {
		void fonts.removePreset(preset.id);
	}

	return { save, paste, apply, copy, remove };
}

export default useFontPresets;
