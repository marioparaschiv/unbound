import type { NativeObjCBridge, NativeObjectHandle, NativeUIScope } from '@unbound-app/api/native';

const INPUT_CLASS = 'DCDChatInputComponentView';
const ROW_DEPTH = 2;
const STATE_KEY = '__unboundLeftHandedRows';

type Holder = Record<typeof STATE_KEY, Map<string, NativeObjectHandle> | undefined>;

function holder(): Holder {
	'worklet';

	return globalThis as unknown as Holder;
}

function rows(): Map<string, NativeObjectHandle> {
	'worklet';
	const existing = holder()[STATE_KEY];

	if (existing) return existing;

	const created = new Map<string, NativeObjectHandle>();

	holder()[STATE_KEY] = created;

	return created;
}

function transform(objc: NativeObjCBridge, scaleX: number) {
	'worklet';

	return objc.struct('CGAffineTransform', { a: scaleX, b: 0, c: 0, d: 1, tx: 0, ty: 0 });
}

function subviewsOf(objc: NativeObjCBridge, view: NativeObjectHandle): NativeObjectHandle[] {
	'worklet';
	// UNKNOWN: `subviews` comes back as a JS array or an `NSArray` handle.
	const list = objc.invoke(view, 'subviews', []) as unknown;

	return (
		Array.isArray(list) ? list : list ? objc.array(list as NativeObjectHandle) : []
	) as NativeObjectHandle[];
}

function rowOf(objc: NativeObjCBridge, input: NativeObjectHandle): NativeObjectHandle | null {
	'worklet';
	let view: NativeObjectHandle | null = input;

	for (let depth = 0; view && depth < ROW_DEPTH; depth++) {
		view = objc.invoke(view, 'superview', []) as NativeObjectHandle | null;
	}

	return view;
}

function setMirrored(objc: NativeObjCBridge, row: NativeObjectHandle, mirrored: boolean) {
	'worklet';
	const scale = mirrored ? -1 : 1;

	objc.invoke(row, 'setTransform:', [transform(objc, scale)]);

	for (const child of subviewsOf(objc, row))
		objc.invoke(child, 'setTransform:', [transform(objc, scale)]);
}

/**
 * @description Mirrors each chat input's row after every layout, flipping the row and each of its children back, so
 * the buttons swap sides while their icons and the text read normally. Children added later, such as the send button,
 * are flipped on the next layout.
 * @param scope The plugin's UI scope, which removes the hook on dispose.
 */
export function installMirror(scope: NativeUIScope) {
	'worklet';
	const objc = scope.objc as NativeObjCBridge;

	objc.hook(INPUT_CLASS, 'layoutSubviews', {
		after: ({ self }) => {
			try {
				const row = rowOf(objc, self);

				if (!row) return;

				rows().set(String(objc.call(row, 'hash')), row);
				setMirrored(objc, row, true);
			} catch (error) {
				console.error(
					`[Left-Handed Mode] Failed to mirror the chat input: ${String(error)}`,
				);
			}
		},
	});
}

/**
 * @description Puts every row it mirrored back the right way round.
 * @param scope The plugin's UI scope.
 */
export function removeMirror(scope: NativeUIScope) {
	'worklet';
	const objc = scope.objc as NativeObjCBridge;

	for (const row of rows().values()) {
		try {
			setMirrored(objc, row, false);
		} catch (error) {
			console.error(`[Left-Handed Mode] Failed to restore a chat input: ${String(error)}`);
		}
	}

	holder()[STATE_KEY] = undefined;
}
