import whileEnabled from '@unbound-plugins/shared/settings/while-enabled';

import { combineCleanups, forceAnimateArguments, forceProps, onPathLoaded } from '~/patches/force';
import { AVATAR_UTILS_PATH, DECORATION_ARGUMENTS } from '~/lib/constants';

function enable(): () => void {
	return combineCleanups([
		onPathLoaded(AVATAR_UTILS_PATH, (module) =>
			forceAnimateArguments(module, DECORATION_ARGUMENTS),
		),
		forceProps('modules/collectibles/native/components/CutoutableAvatarDecoration.tsx', {
			animate: true,
		}),
	]);
}

/**
 * @description Animates avatar decorations, in chat rows and in React Native views, while the `decorations` setting is on.
 * Patches `getAvatarDecorationURL` of `utils/AvatarUtils.tsx`, which builds the `/static` or `/animated` collectibles URL,
 * and sets `animate` on `CutoutableAvatarDecoration`.
 */
export function animateDecorations(): void {
	whileEnabled('decorations', enable);
}
