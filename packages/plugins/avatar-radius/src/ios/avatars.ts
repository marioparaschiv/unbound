import type { NativePluginBridge } from '@unbound-app/api/native';
import { findVisibleCells } from '@unbound-plugins/shared/native/ios/visible-cells';

import {
	countAvatars,
	installAvatarHooks,
	restoreAvatars,
	setAvatarRadius,
} from '~/ios/ui-avatars';
import { AvatarClass } from '~/constants';

const IMAGE_SEARCH = { maxDepth: 96, maxVisited: 8_000 };

async function relayoutVisible({ objc }: NativePluginBridge) {
	const views = [
		...(await findVisibleCells(objc, AvatarClass.ios)),
		...(await findVisibleCells(objc, AvatarClass.iosImage, undefined, IMAGE_SEARCH)),
	];

	await Promise.all(
		views.map((view) => objc.invokeAsync(view, 'setNeedsLayout', []).catch(() => undefined)),
	);
}

/**
 * @description Rounds every `DCDAvatarView` and the circular `DCDFastImage` avatars React Native draws, from hooks that run on the UI thread as Discord lays each one out, so no avatar is ever drawn as a circle first.
 * @param native The plugin's native bridge.
 * @param radius Reads the chosen radius.
 * @returns `refresh`, which applies a changed radius, the self-test counts, and `dispose`, which brings back the circles.
 */
export function roundIOSAvatars(native: NativePluginBridge, radius: () => number) {
	const scope = native.ui.createScope();

	native.ui.run(installAvatarHooks, scope, radius());
	void relayoutVisible(native).catch(() => undefined);

	return {
		async rounded() {
			return (await native.ui.call(countAvatars)).rounded;
		},
		async unrounded() {
			return (await native.ui.call(countAvatars)).unrounded;
		},
		refresh() {
			native.ui.run(setAvatarRadius, radius());
		},
		async dispose() {
			native.ui.run(restoreAvatars);
			scope.dispose();
		},
	};
}

export default { roundIOSAvatars };
