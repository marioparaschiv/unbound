import { metro } from '@unbound-app/api';

import { toPreset, type StatusPreset } from '~/lib/presets';

type CustomStatus = {
	text: string;
	emojiId: string;
	emojiName: string;
	expiresAtMs: string;
	createdAtMs: string;
};

type CustomStatusSetting = {
	getSetting(): Partial<CustomStatus> | undefined;
	updateSetting(status: CustomStatus): void;
	useSetting(): Partial<CustomStatus> | undefined;
};

function setting(): CustomStatusSetting | undefined {
	return metro.findByProps('CustomStatusSetting')?.CustomStatusSetting;
}

/**
 * @description Reads the custom status set now, as a preset.
 * @returns The preset, or `undefined` without a status.
 */
export function useCurrentPreset(): StatusPreset | undefined {
	return toPreset(setting()?.useSetting());
}

/**
 * @description Sets a preset as the custom status, without an expiry, the way Discord's own status screen saves one.
 * @param preset The preset.
 */
export function applyPreset({ text, emojiId, emojiName }: StatusPreset): void {
	setting()?.updateSetting({
		text,
		emojiId: emojiId || '0',
		emojiName,
		expiresAtMs: '0',
		createdAtMs: String(Date.now()),
	});
}
