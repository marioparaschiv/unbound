import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import type { AnyProps } from '@unbound-app/api/metro';

import { combineCleanups, forceAnimateArguments, forceProps } from '~/force/patches';
import { CutoutableAvatarDecoration } from '~/decorations/modules';
import { AVATAR_UTILS_PATH, DECORATION_ARGUMENTS } from '~/constants';

/**
 * @description Animates avatar decorations, in chat rows and in React Native views.
 * Patches `getAvatarDecorationURL` of `utils/AvatarUtils.tsx`, which builds the `/static` or `/animated` collectibles URL,
 * and sets `animate` on `CutoutableAvatarDecoration`.
 * @returns A function that removes the patches.
 */
export function animateDecorations(): () => void {
	return combineCleanups([
		whenLoaded<AnyProps>(AVATAR_UTILS_PATH, (module) =>
			forceAnimateArguments(module, DECORATION_ARGUMENTS),
		),
		forceProps(CutoutableAvatarDecoration, { animate: true }),
	]);
}
