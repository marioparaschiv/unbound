import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import type { AnyProps } from '@unbound-app/api/metro';

import { combineCleanups, forceAnimateArguments, forceProps } from '~/force/patches';
import {
	AVATAR_ARGUMENTS,
	AVATAR_PATH,
	AVATAR_UTILS_PATH,
	CUTOUTABLE_AVATAR_IMAGE_PATH,
	GROUP_DM_AVATAR_PATH,
} from '~/constants';

/**
 * @description Animates every animated avatar and profile banner, in chat rows and in React Native views.
 * Patches the user and member avatar and banner builders of `utils/AvatarUtils.tsx`, which `UserRecord.getAvatarURL` and `getAvatarSource` call too,
 * and sets `animate` on the `Avatar` and `CutoutableAvatarImage` design components and on `GroupDMAvatar`.
 * @returns A function that removes the patches.
 */
export function animateAvatars(): () => void {
	return combineCleanups([
		whenLoaded<AnyProps>(AVATAR_UTILS_PATH, (module) =>
			forceAnimateArguments(module, AVATAR_ARGUMENTS),
		),
		forceProps(AVATAR_PATH, { animate: true }),
		forceProps(CUTOUTABLE_AVATAR_IMAGE_PATH, { animate: true }),
		forceProps(GROUP_DM_AVATAR_PATH, { animate: true }),
	]);
}
