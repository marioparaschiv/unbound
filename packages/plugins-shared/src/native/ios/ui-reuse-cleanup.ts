import type { NativeObjCBridge, NativeObjectHandle, NativeUIScope } from '@unbound-app/api/native';

const MAX_REMOVED = 8;

export type ReuseCleanup = {
	cellClass: string;
	tag: number;
	label: string;
};

/**
 * @description Removes a plugin's tagged views from a cell from a hook that runs on the UI thread, in the same pass that prepares the cell for another message, so they never show on the wrong message.
 * @param scope The plugin's UI scope.
 * @param cleanup The cell class, the tag the plugin gives its views, and the name its errors are logged under.
 */
export function installReuseCleanup(scope: NativeUIScope, cleanup: ReuseCleanup) {
	'worklet';
	const objc = scope.objc as NativeObjCBridge;

	objc.hook(cleanup.cellClass, 'prepareForReuse', {
		after: ({ self }) => {
			try {
				for (let removed = 0; removed < MAX_REMOVED; removed++) {
					const view = objc.invoke(self, 'viewWithTag:', [
						cleanup.tag,
					]) as NativeObjectHandle | null;

					if (!view || objc.call(view, 'isEqual:', self)) {
						return;
					}

					objc.invoke(view, 'removeFromSuperview', []);
				}
			} catch (error) {
				console.error(`[${cleanup.label}] ${String(error)}`);
			}
		},
	});
}

export default { installReuseCleanup };
