import { metro, patcher } from '@unbound-app/api';
import { settings } from '@unbound-app/settings';

const STREAM_FEATURES = [
	'STREAM_MID_QUALITY',
	'STREAM_HIGH_QUALITY',
	'INCREASED_VIDEO_UPLOAD_QUALITY',
] as const;

type PremiumFeatures = Record<(typeof STREAM_FEATURES)[number], unknown> & {
	canUserUse(feature: unknown, user: unknown): boolean;
};

/**
 * @description Unlocks Nitro's stream resolutions and frame rates and high quality video uploads. Patches
 * `canUserUse` on Discord's premium features to allow those three, which `canStreamQuality` and
 * `canUseHighVideoUploadQuality` ask about; their own exports cannot be replaced.
 */
export function patchStreamQuality(): void {
	if (!settings.streamQuality) return;

	const Features = metro.findByProps('canUserUse', 'STREAM_HIGH_QUALITY', { lazy: false }) as
		| PremiumFeatures
		| undefined;

	if (!Features) {
		logger.warn('Stream quality skipped: Discord moved its premium features.');

		return;
	}

	const unlocked = new Set(STREAM_FEATURES.map((name) => Features[name]));

	patcher.instead(Features, 'canUserUse', ({ args, original }) =>
		unlocked.has(args[0]) ? true : original(...args),
	);
}
