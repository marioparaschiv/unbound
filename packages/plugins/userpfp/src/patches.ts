import { metro, patcher } from '@unbound-app/api';
import { settings } from '@unbound-app/settings';

import { avatarFor } from '~/lib/avatars';

type AvatarUser = { id?: string; avatar?: string | null };

function hasAnimatedAvatar(user: AvatarUser | undefined): boolean {
	return Boolean(user?.avatar?.startsWith('a_'));
}

function customAvatar(user: AvatarUser | undefined, animate: unknown): string | undefined {
	if (settings.nitroFirst && hasAnimatedAvatar(user)) return undefined;

	return avatarFor(user?.id, Boolean(animate));
}

/**
 * @description Shows UserPFP avatars, by patching `getUserAvatarURL` and `getUserAvatarSource` on Discord's avatar helpers.
 */
export function patchAvatars(): void {
	const Avatars = metro.findByProps('getUserAvatarURL', 'getUserAvatarSource');

	if (!Avatars) {
		logger.warn('UserPFP avatars skipped: Discord moved getUserAvatarURL.');

		return;
	}

	patcher.after(
		Avatars,
		'getUserAvatarURL',
		({ args: [user, animate], result }) =>
			customAvatar(user as AvatarUser | undefined, animate) ?? result,
	);
	patcher.after(Avatars, 'getUserAvatarSource', ({ args: [user, animate], result }) => {
		const avatar = customAvatar(user as AvatarUser | undefined, animate);

		return avatar ? { uri: avatar } : result;
	});
}
