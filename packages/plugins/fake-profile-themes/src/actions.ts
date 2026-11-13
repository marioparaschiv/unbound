import { openSheet } from '@unbound-plugins/shared/action-sheets/open-sheet';
import { metro, toasts } from '@unbound-app/api';
import { format, messages } from '@unbound-app/i18n';
import { settings } from '@unbound-app/settings';

import EffectPickerSheet from '~/components/effect-picker-sheet';
import { loadedProducts, profileEffects } from '~/lib/effects';
import { encodeProfileCode, parseHex, type ProfileCode } from '~/lib/profile-code';

const EFFECT_SHEET = 'unbound-fake-profile-effects';

function chosenColors(): ProfileCode['colors'] | null {
	if (!settings.includeColors) return undefined;

	const primary = parseHex(settings.primary);
	const accent = parseHex(settings.accent);

	return primary === undefined || accent === undefined ? null : [primary, accent];
}

function effectTitle(skuId: string): string {
	return (
		profileEffects(loadedProducts()).find((effect) => effect.skuId === skuId)?.title ?? skuId
	);
}

export function copyBioCode() {
	const colors = chosenColors();

	if (colors === null) {
		toasts.show({ title: messages.COPY_CODE, content: messages.BAD_COLOR });

		return;
	}

	const code = encodeProfileCode({ colors, effect: settings.effect || undefined });

	if (!code) {
		toasts.show({ title: messages.COPY_CODE, content: messages.NOTHING_TO_COPY });

		return;
	}

	metro.common.Clipboard.setString(code);
	toasts.show({ title: messages.COPY_CODE, content: messages.COPIED });
}

export function pickEffect() {
	openSheet(EFFECT_SHEET, EffectPickerSheet, {
		selected: settings.effect,
		onPick: (skuId: string) => {
			settings.effect = skuId;
			toasts.show({
				title: messages.EFFECT,
				content: skuId
					? format('EFFECT_PICKED', { effect: effectTitle(skuId) })
					: messages.EFFECT_CLEARED,
			});
		},
	});
}
