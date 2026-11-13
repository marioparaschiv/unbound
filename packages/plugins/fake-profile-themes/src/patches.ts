import { flux, metro, patcher } from '@unbound-app/api';
import { settings } from '@unbound-app/settings';

import { decodeProfileCode, stripProfileCode, type ProfileCode } from '~/lib/profile-code';
import '~/lib/types';

type DisplayProfile = { userId?: string; bio?: string | null; themeColors?: number[] | null };

type UserProfile = { bio?: string | null; profileEffect?: { skuId?: string } | null };

type PreviewBio = string | { value?: string } | null | undefined;

const CUSTOMIZATION = 'canUsePremiumProfileCustomization';

let restoreCustomization: (() => void) | undefined;

const decoded = new Map<string, { bio: string; code: ProfileCode }>();

const fakedEffects = new Map<UserProfile, UserProfile['profileEffect']>();

function hiddenCode(userId: string | undefined, bio: string | null | undefined): ProfileCode {
	if (!userId || !bio) return {};

	const cached = decoded.get(userId);

	if (cached?.bio === bio) return cached.code;

	const code = decodeProfileCode(bio);

	decoded.set(userId, { bio, code });

	return code;
}

const hiddenColors = (profile: DisplayProfile) => hiddenCode(profile.userId, profile.bio).colors;

function stripBio(bio: PreviewBio): PreviewBio {
	if (typeof bio === 'string') return stripProfileCode(bio);

	return bio && typeof bio.value === 'string'
		? { ...bio, value: stripProfileCode(bio.value) }
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

function fakeEffect(profile: UserProfile | undefined, userId: string): void {
	if (!profile || fakedEffects.has(profile)) return;

	const effect = hiddenCode(userId, profile.bio).effect;

	if (!effect || (settings.nitroFirst && profile.profileEffect?.skuId)) return;

	fakedEffects.set(profile, profile.profileEffect);
	profile.profileEffect = { skuId: effect };
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

/**
 * @description Shows the profile effect hidden in a bio, behind a Nitro effect when the setting prefers Nitro.
 * Patches `getUserProfile` on Discord's `UserProfileStore` and sets the profile's `profileEffect` once per profile.
 */
export function patchProfileEffects(): void {
	const UserProfileStore = flux.getStore('UserProfile');

	if (typeof UserProfileStore?.getUserProfile !== 'function') {
		logger.warn('Fake profile effects skipped: Discord moved UserProfileStore.getUserProfile.');

		return;
	}

	patcher.after(UserProfileStore, 'getUserProfile', ({ args: [userId], result }) => {
		fakeEffect(result as UserProfile | undefined, userId as string);
	});
}

/**
 * @description Puts back the effects profiles had before their hidden ones were shown.
 */
export function restoreProfileEffects(): void {
	for (const [profile, effect] of fakedEffects) profile.profileEffect = effect;

	fakedEffects.clear();
	decoded.clear();
}
