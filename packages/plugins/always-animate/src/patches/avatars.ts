import whileEnabled from '@unbound-plugins/shared/settings/while-enabled';
import type { AnyProps } from '@unbound-app/api/metro';
import { metro, patcher } from '@unbound-app/api';

import { combineCleanups, forceAnimateArguments, forceProps, onPathLoaded } from '~/patches/force';
import { AVATAR_ARGUMENTS, AVATAR_UTILS_PATH } from '~/lib/constants';
import { renderStatic } from '~/lib/static-render';

const CUTOUTABLE_AVATAR_IMAGE_PATH =
	'design/void/CutoutableAvatarImage/native/CutoutableAvatarImage.tsx';

// Discord draws a cutout without exactly one native cutout as a react-native-svg `Image`, which crashes the app on
// Android when its source is animated: the SVG load event reads the width of a bitmap an animated image never has.
function drawsWithSvg(props: AnyProps | undefined): boolean {
	const cutout: AnyProps | null | undefined = props?.cutout;

	return cutout != null && cutout.nativeCutouts?.length !== 1;
}

function animateCutoutableAvatars(): () => void {
	const component = metro.findByFilePath(CUTOUTABLE_AVATAR_IMAGE_PATH);

	if (!component) {
		logger.warn('Animating CutoutableAvatarImage skipped: Discord moved it.');

		return () => {};
	}

	return patcher.react.instead(component, 'default', ({ props, original }) => {
		const next = { ...props, animate: true };

		return drawsWithSvg(props) ? renderStatic(() => original(next)) : original(next);
	});
}

function enable(): () => void {
	return combineCleanups([
		onPathLoaded(AVATAR_UTILS_PATH, (module) =>
			forceAnimateArguments(module, AVATAR_ARGUMENTS),
		),
		forceProps('design/void/Avatar/native/Avatar.tsx', { animate: true }),
		animateCutoutableAvatars(),
		forceProps('modules/group_dm/native/GroupDMAvatar.tsx', { animate: true }),
	]);
}

/**
 * @description Animates every animated avatar and profile banner, in chat rows and in React Native views, while the `avatars` setting is on.
 * Patches the user and member avatar and banner builders of `utils/AvatarUtils.tsx`, which `UserRecord.getAvatarURL` and `getAvatarSource` call too,
 * and sets `animate` on the `Avatar` and `CutoutableAvatarImage` design components and on `GroupDMAvatar`. An avatar drawn
 * through an SVG mask stays static.
 */
export function animateAvatars(): void {
	whileEnabled('avatars', enable);
}
