import type {
	NativeHookToken,
	NativeObjCBridge,
	NativeObjectHandle,
} from '@unbound-app/api/native';

export type MessageCellHandlers = {
	/** The cell moved into a window. */
	shown: (cell: NativeObjectHandle) => void;
	/** The cell laid out its subviews. */
	laidOut: (cell: NativeObjectHandle) => void;
	/** UIKit is about to reuse the cell for another message. */
	reused: (cell: NativeObjectHandle) => void;
};

/**
 * @description Hooks `DCDMessageTableViewCell` as it appears, lays out and is reused, installing all three hooks or none.
 * @param objc The Objective-C bridge from `context.native`.
 * @param handlers Called from each hook with the cell.
 * @returns A function that removes the hooks and drops window checks still in flight.
 */
export function hookMessageCells(
	objc: NativeObjCBridge,
	{ shown, laidOut, reused }: MessageCellHandlers,
): () => void {
	const controller = new AbortController();
	const hooks: NativeHookToken[] = [];

	function unhook() {
		controller.abort();

		for (const hook of hooks.splice(0)) hook.remove();
	}

	try {
		hooks.push(
			objc.hook('DCDMessageTableViewCell', 'didMoveToWindow', {
				after: ({ self }) => {
					// `window` is read asynchronously so the hook does not block on the main thread.
					void objc
						.invokeAsync(self, 'window', [])
						.then((window) => {
							if (window && !controller.signal.aborted) {
								shown(self);
							}
						})
						.catch(() => undefined);
				},
			}),
			objc.hook('DCDMessageTableViewCell', 'layoutSubviews', {
				after: ({ self }) => laidOut(self),
			}),
			objc.hook('DCDMessageTableViewCell', 'prepareForReuse', {
				after: ({ self }) => reused(self),
			}),
		);
	} catch (error) {
		unhook();

		throw error;
	}

	return unhook;
}

export default hookMessageCells;
