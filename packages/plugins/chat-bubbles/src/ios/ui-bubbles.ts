import type { NativeObjCBridge, NativeObjectHandle, NativeUIScope } from '@unbound-app/api/native';

export type BubbleClasses = {
	messageCell: string;
	separatorCell: string;
	bubbleTag: number;
};

type ColorEvent = {
	self: NativeObjectHandle;
	args: unknown[];
};

function clearColor(objc: NativeObjCBridge): NativeObjectHandle | null {
	'worklet';
	const UIColor = objc.getClass('UIColor');

	return UIColor ? (objc.call(UIColor, 'clearColor') as NativeObjectHandle) : null;
}

function report(error: unknown) {
	'worklet';
	console.error(`[Chat Bubbles] ${String(error)}`);
}

/**
 * @description Keeps message and separator cells transparent and hides a reused cell's old bubble, from hooks that run on the UI thread in the same pass as Discord's change, so neither a background nor a stale bubble is ever drawn.
 * @param scope The plugin's UI scope.
 * @param classes The cell classes and the bubble view's tag.
 */
export function installBubbleGuards(scope: NativeUIScope, classes: BubbleClasses) {
	'worklet';
	const objc = scope.objc as NativeObjCBridge;
	const clear = clearColor(objc);

	if (!clear) {
		return;
	}

	function keepClear({ self, args }: ColorEvent) {
		const color = args[0] as NativeObjectHandle | null;

		try {
			if (!color || !objc.call(color, 'isEqual:', clear)) {
				objc.invoke(self, 'setBackgroundColor:', [clear]);
			}
		} catch (error) {
			report(error);
		}
	}

	objc.hook(classes.messageCell, 'setBackgroundColor:', { after: keepClear });
	objc.hook(classes.separatorCell, 'setBackgroundColor:', { after: keepClear });
	objc.hook(classes.separatorCell, 'layoutSubviews', {
		after: ({ self }) => {
			try {
				objc.invoke(self, 'setBackgroundColor:', [clear]);
			} catch (error) {
				report(error);
			}
		},
	});
	objc.hook(classes.messageCell, 'prepareForReuse', {
		after: ({ self }) => {
			try {
				const bubble = objc.invoke(self, 'viewWithTag:', [
					classes.bubbleTag,
				]) as NativeObjectHandle | null;

				if (bubble) {
					objc.invoke(bubble, 'setHidden:', [true]);
				}
			} catch (error) {
				report(error);
			}
		},
	});
}

export default { installBubbleGuards };
