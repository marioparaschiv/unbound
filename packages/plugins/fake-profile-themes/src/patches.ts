import { metro, patcher } from '@unbound-app/api';
import { settings } from '@unbound-app/settings';

import { decodeThemeColors, stripThemeColors } from '~/lib/three-y-three';

type DisplayProfile = { userId?: string; bio?: string | null; themeColors?: number[] | null };

type PreviewBio = string | { value?: string } | null | undefined;

const CUSTOMIZATION = 'canUsePremiumProfileCustomization';

let restoreCustomization: (() => void) | undefined;

const decoded = new Map<string, { bio: string; colors: [number, number] | undefined }>();

function hiddenColors({ userId, bio }: DisplayProfile): [number, number] | undefined {
	if (!userId || !bio) return;

	const cached = decoded.get(userId);

	if (cached?.bio === bio) return cached.colors;

	const colors = decodeThemeColors(bio);

	decoded.set(userId, { bio, colors });

	return colors;
}

function stripBio(bio: PreviewBio): PreviewBio {
	if (typeof bio === 'string') return stripThemeColors(bio);

	return bio && typeof bio.value === 'string'
		? { ...bio, value: stripThemeColors(bio.value) }
		: bio;
}

function themeCustomization(prototype: object): (() => void) | undefined {
	const original = Object.getOwnPropertyDescriptor(prototype, CUSTOMIZATION);

	if (!original?.get) return;

	Object.defineProperty(prototype, CUSTOMIZATION, {
		...original,
		get(this: DisplayProfile) {
			return Boolean(hiddenColors(this)) || original.get!.call(this);
		},
	});

	return () => Object.defineProperty(prototype, CUSTOMIZATION, original);
}

/**
 * @description Themes a profile with the colors hidden in its bio, behind Nitro theme colors when the setting prefers them,
 * and keeps the hidden characters out of the bio, which mobile draws as boxes. Patches `getPreviewThemeColors`,
 * `hasThemeColors` and `getPreviewBio` on Discord's `DisplayProfile` records, and lets a themed record use profile
 * customization, which Discord's profile checks before drawing a theme.
 */
export function patchThemeColors(): void {
	const DisplayProfile = metro.findByPrototypes('getPreviewThemeColors', 'getBannerURL');

	if (typeof DisplayProfile?.prototype?.getPreviewThemeColors !== 'function') {
		logger.warn(
			'Fake profile themes skipped: Discord moved DisplayProfile.getPreviewThemeColors.',
		);

		return;
	}

	const prototype = DisplayProfile.prototype;

	patcher.after(prototype, 'getPreviewThemeColors', ({ args, result, this: self }) => {
		const profile = self as DisplayProfile;

		if (args[0] != null || (settings.nitroFirst && profile.themeColors?.length)) return result;

		return hiddenColors(profile) ?? result;
	});

	patcher.after(
		prototype,
		'hasThemeColors',
		({ result, this: self }) =>
			Boolean(result) || Boolean(hiddenColors(self as DisplayProfile)),
	);

	patcher.after(prototype, 'getPreviewBio', ({ result }) => stripBio(result as PreviewBio));

	restoreCustomization = themeCustomization(prototype);
}

/**
 * @description Gives profile customization back to Nitro members only.
 */
export function restoreThemeColors(): void {
	restoreCustomization?.();
	restoreCustomization = undefined;
}
