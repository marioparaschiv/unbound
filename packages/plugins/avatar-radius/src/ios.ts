import type { NativeObjCBridge, NativeObjectHandle } from '@unbound-app/api/native';
import { findVisibleCells } from '@unbound-plugins/shared/native/visible-cells';
import { readRect } from '@unbound-plugins/shared/native/rect';

import { AvatarClass } from '~/constants';
import { cornerRadius } from '~/radius';

function round(objc: NativeObjCBridge, avatar: NativeObjectHandle, radius: number): void {
	const { width } = readRect(objc.call(avatar, 'bounds'));
	const layer = objc.call(avatar, 'layer') as NativeObjectHandle | null;

	if (layer) objc.call(layer, 'setCornerRadius:', cornerRadius(radius, width));
}

async function roundVisible(objc: NativeObjCBridge, radius: number): Promise<void> {
	for (const avatar of await findVisibleCells(objc, AvatarClass.ios)) {
		const { width } = readRect(objc.call(avatar, 'bounds'));
		const layer = objc.call(avatar, 'layer') as NativeObjectHandle | null;

		if (layer) await objc.invokeAsync(layer, 'setCornerRadius:', [cornerRadius(radius, width)]);
	}
}

/**
 * @description Rounds every `DCDAvatarView` to the chosen radius each time Discord lays it out.
 * @param objc The Objective-C bridge.
 * @param radius Reads the chosen radius.
 * @returns `refresh`, which re-rounds the avatars on screen, and `dispose`, which brings back the circles.
 */
export function roundIOSAvatars(objc: NativeObjCBridge, radius: () => number) {
	const hook = objc.hook(AvatarClass.ios, 'layoutSubviews', {
		after: ({ self }) => round(objc, self, radius()),
	});
	const refresh = () => void roundVisible(objc, radius());

	refresh();

	return {
		refresh,
		async dispose() {
			hook.remove();
			await roundVisible(objc, Number.POSITIVE_INFINITY);
		},
	};
}

export default { roundIOSAvatars };
