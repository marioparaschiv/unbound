import type { NativeObjCBridge, NativeObjectHandle, NativeUIScope } from '@unbound-app/api/native';

const STICKER_VIEW = 'DCDStickerView';
const MESSAGE_CELL = 'DCDMessageTableViewCell';
const STATE_KEY = '__unboundStickerSizes';
const CELL_SEARCH_DEPTH = 12;

type BoxedRect = { value?: BoxedRect; size?: { width?: number; height?: number } };

type ScaleState = { scale: number; changes: Map<string, number>; scaled: NativeObjectHandle[] };

function state(): ScaleState {
	'worklet';
	const holder = globalThis as unknown as Record<typeof STATE_KEY, ScaleState | undefined>;

	return (holder[STATE_KEY] ??= { scale: 1, changes: new Map(), scaled: [] });
}

function sizeOf(raw: unknown): { width: number; height: number } {
	'worklet';
	const boxed = raw as BoxedRect | null;
	const size = (boxed?.value ?? boxed)?.size;

	return { width: Number(size?.width ?? 0), height: Number(size?.height ?? 0) };
}

function cellOf(objc: NativeObjCBridge, view: NativeObjectHandle): NativeObjectHandle | undefined {
	'worklet';
	let current: NativeObjectHandle | null = view;

	for (let depth = 0; current && depth < CELL_SEARCH_DEPTH; depth++) {
		if (objc.className(current) === MESSAGE_CELL) return current;

		current = objc.invoke(current, 'superview', []) as NativeObjectHandle | null;
	}
}

function cellKey(objc: NativeObjCBridge, cell: NativeObjectHandle): string {
	'worklet';

	return String(objc.invoke(cell, 'hash', []));
}

function setScale(objc: NativeObjCBridge, view: NativeObjectHandle, scale: number) {
	'worklet';
	const { width, height } = sizeOf(objc.invoke(view, 'bounds', []));
	const shift = (1 - scale) / 2;

	objc.invoke(view, 'setTransform:', [
		objc.struct('CGAffineTransform', {
			a: scale,
			b: 0,
			c: 0,
			d: scale,
			tx: -width * shift,
			ty: -height * shift,
		}),
	]);
}

function rescale(objc: NativeObjCBridge, view: NativeObjectHandle): boolean {
	'worklet';
	const current = state();

	setScale(objc, view, current.scale);

	if (
		current.scale !== 1 &&
		!current.scaled.some((other) => objc.call(other, 'isEqual:', view))
	) {
		current.scaled.push(view);
	}

	const cell = cellOf(objc, view);

	if (!cell) return false;

	const key = cellKey(objc, cell);
	const change = Math.round(sizeOf(objc.invoke(view, 'bounds', [])).height * (current.scale - 1));
	const before = current.changes.get(key) ?? 0;

	if (change === before) return false;

	if (change) current.changes.set(key, change);
	else current.changes.delete(key);

	return true;
}

/**
 * @description Scales stickers from their top left corner and grows or shrinks their message row to match. Hooks
 * `setFrame:` and `layoutSubviews` of `DCDStickerView`, and the message cell's `sizeThatFits:`.
 * @param scope The plugin's UI scope, which removes the hooks on dispose.
 * @param scale The factor to start with.
 * @param onRowChange Runs when a row's height must change, so the rows are sized again.
 */
export function installStickerScale(scope: NativeUIScope, scale: number, onRowChange: () => void) {
	'worklet';
	const objc = scope.objc as NativeObjCBridge;

	state().scale = scale;

	function refit(view: NativeObjectHandle) {
		try {
			if (rescale(objc, view)) onRowChange();
		} catch (error) {
			console.error(`[Sticker Sizes] Failed to scale a sticker: ${String(error)}`);
		}
	}

	objc.hook(STICKER_VIEW, 'setFrame:', {
		replace: ({ self, args, original }) => {
			setScale(objc, self, 1);

			const result = original(...args);

			refit(self);

			return result;
		},
	});
	objc.hook(STICKER_VIEW, 'layoutSubviews', { after: ({ self }) => refit(self) });
	objc.hook(MESSAGE_CELL, 'sizeThatFits:', {
		replace: ({ self, args, original }) => {
			const result = original(...args);
			const change = state().changes.get(cellKey(objc, self)) ?? 0;

			if (!change) return result;

			const boxed = result as {
				value?: { width?: number; height?: number };
				width?: number;
				height?: number;
			};
			const size = boxed?.value ?? boxed;

			return objc.struct('CGSize', {
				width: Number(size?.width ?? 0),
				height: Number(size?.height ?? 0) + change,
			});
		},
	});
	objc.hook(MESSAGE_CELL, 'prepareForReuse', {
		after: ({ self }) => {
			state().changes.delete(cellKey(objc, self));
		},
	});
}

/**
 * @description Sets the scale the next layout uses.
 * @param scale The factor.
 */
export function setStickerScale(scale: number) {
	'worklet';
	state().scale = scale;
}

/**
 * @description Gives every scaled sticker its own size back, once the hooks are gone.
 * @param scope The plugin's UI scope.
 */
export function unscaleStickers(scope: NativeUIScope) {
	'worklet';
	const objc = scope.objc as NativeObjCBridge;
	const current = state();

	current.changes.clear();

	for (const view of current.scaled.splice(0)) {
		try {
			setScale(objc, view, 1);
		} catch (error) {
			console.error(`[Sticker Sizes] Failed to restore a sticker: ${String(error)}`);
		}
	}
}
