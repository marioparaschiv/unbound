import whileEnabled from '@unbound-plugins/shared/settings/while-enabled';

import { combineCleanups, forceAnimateArguments, forceProps, onPathLoaded } from '~/patches/force';
import { AVATAR_ARGUMENTS, AVATAR_UTILS_PATH } from '~/lib/constants';

function enable(): () => void {
	return combineCleanups([
		onPathLoaded(AVATAR_UTILS_PATH, (module) =>
			forceAnimateArguments(module, AVATAR_ARGUMENTS),
		),
		forceProps('design/void/Avatar/native/Avatar.tsx', { animate: true }),
		forceProps('design/void/CutoutableAvatarImage/native/CutoutableAvatarImage.tsx', {
			animate: true,
		}),
		forceProps('modules/group_dm/native/GroupDMAvatar.tsx', { animate: true }),
	]);
}

/**
 * @description Animates every animated avatar and profile banner, in chat rows and in React Native views, while the `avatars` setting is on.
 * Patches the user and member avatar and banner builders of `utils/AvatarUtils.tsx`, which `UserRecord.getAvatarURL` and `getAvatarSource` call too,
 * and sets `animate` on the `Avatar` and `CutoutableAvatarImage` design components and on `GroupDMAvatar`.
 */
export function animateAvatars(): void {
	whileEnabled('avatars', enable);
}
