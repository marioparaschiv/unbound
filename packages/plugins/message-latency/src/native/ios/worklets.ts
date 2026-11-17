import type { NativeObjCBridge, NativeObjectHandle, NativeUIScope } from '@unbound-app/api/native';

import { ICON_TAG } from '~/lib/constants';
import { reportWorkletError } from '@unbound-plugins/shared/native/report-worklet-error';

const CELL_CLASS = 'DCDMessageTableViewCell';

/**
 * @description Hides a reused message cell's latency icon from a hook that runs on the UI thread, in the same pass that prepares the cell for another message, so the icon never shows on the wrong message.
 * @param scope The plugin's UI scope.
 */
export function installReuseGuard(scope: NativeUIScope) {
	'worklet';
	const objc = scope.objc as NativeObjCBridge;

	objc.hook(CELL_CLASS, 'prepareForReuse', {
		after: ({ self }) => {
			try {
				const icon = objc.invoke(self, 'viewWithTag:', [
					ICON_TAG,
				]) as NativeObjectHandle | null;

				if (icon) {
					objc.invoke(icon, 'setHidden:', [true]);
				}
			} catch (error) {
				reportWorkletError('Message Latency', error);
			}
		},
	});
}

export default { installReuseGuard };
