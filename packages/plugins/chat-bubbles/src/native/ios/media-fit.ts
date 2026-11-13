import type { NativeObjCBridge, NativeObjectHandle, NativeUIScope } from '@unbound-app/api/native';

const FITTED_KEY = '__unboundChatBubbleFittedMedia';
const LOSS_KEY = '__unboundChatBubbleMediaLoss';
const CELL_SEARCH_DEPTH = 12;

type BoxedRect = { value?: BoxedRect; size?: { width?: number; height?: number } };

type FittedHolder = Record<typeof FITTED_KEY, NativeObjectHandle[] | undefined> &
	Record<typeof LOSS_KEY, Map<string, number> | undefined>;

function fitted(): NativeObjectHandle[] {
	'worklet';
	const holder = globalThis as unknown as FittedHolder;

	return (holder[FITTED_KEY] ??= []);
}

function losses(): Map<string, number> {
	'worklet';
	const holder = globalThis as unknown as FittedHolder;

	return (holder[LOSS_KEY] ??= new Map());
}

function cellKey(objc: NativeObjCBridge, cell: NativeObjectHandle): string {
	'worklet';

	return String(objc.invoke(cell, 'hash', []));
}

function cellOf(objc: NativeObjCBridge, view: NativeObjectHandle, cellClass: string) {
	'worklet';
	let current: NativeObjectHandle | null = view;

	for (let depth = 0; current && depth < CELL_SEARCH_DEPTH; depth++) {
		if (objc.className(current) === cellClass) return current;

		current = objc.invoke(current, 'superview', []) as NativeObjectHandle | null;
	}
}

/**
 * @description Reads how much shorter a message cell's fitted media drew than Discord laid it out, for its row to shrink by.
 * @param objc The Objective-C bridge.
 * @param cell The message cell.
 * @returns The height in points, 0 when nothing in it was fitted.
 */
export function fittedLoss(objc: NativeObjCBridge, cell: NativeObjectHandle): number {
	'worklet';

	return losses().get(cellKey(objc, cell)) ?? 0;
}

function sizeOf(raw: unknown): { width: number; height: number } {
	'worklet';
	const boxed = raw as BoxedRect | null;
	const size = (boxed?.value ?? boxed)?.size;

	return { width: Number(size?.width ?? 0), height: Number(size?.height ?? 0) };
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

// Discord sizes attachments to the whole column, so inside a padded bubble they reach past their holder's right edge.
// Returns whether the height the cell's media lost changed.
function fitToHolder(objc: NativeObjCBridge, view: NativeObjectHandle, cellClass: string): boolean {
	'worklet';
	const holder = objc.invoke(view, 'superview', []) as NativeObjectHandle | null;

	if (!holder) return false;

	const own = sizeOf(objc.invoke(view, 'bounds', []));
	const room = sizeOf(objc.invoke(holder, 'bounds', [])).width;
	const scale = own.width > room + 0.5 && room > 0 ? room / own.width : 1;

	setScale(objc, view, scale);

	const list = fitted();

	if (scale < 1 && !list.some((other) => objc.call(other, 'isEqual:', view))) list.push(view);

	const cell = cellOf(objc, view, cellClass);

	if (!cell) return false;

	const key = cellKey(objc, cell);
	const loss = Math.round(own.height * (1 - scale));
	const before = losses().get(key) ?? 0;

	if (loss === before) return false;

	if (loss) losses().set(key, loss);
	else losses().delete(key);

	return true;
}

/**
 * @description Scales message media down to the width of the holder Discord lays it in, from its top left corner, so media
 * sized to the whole column stays inside a padded bubble. Hooks `setFrame:` of each media class, which sets the frame
 * untransformed so the scale never feeds back into the size Discord gives it, and `layoutSubviews` for holders that narrow later.
 * @param scope The plugin's UI scope, which removes the hooks on dispose.
 * @param classes The media view classes to fit.
 * @param cellClass The message cell's class, whose row shrinks by the height the media lost.
 * @param onLossChange Runs when a cell's lost height changes, so its row is sized again.
 */
export function installMediaFit(
	scope: NativeUIScope,
	classes: string[],
	cellClass: string,
	onLossChange: () => void,
) {
	'worklet';
	const objc = scope.objc as NativeObjCBridge;

	// A reused cell starts without media until Discord lays its new message out.
	objc.hook(cellClass, 'prepareForReuse', {
		after: ({ self }) => {
			losses().delete(cellKey(objc, self));
		},
	});

	function refit(view: NativeObjectHandle) {
		try {
			if (fitToHolder(objc, view, cellClass)) onLossChange();
		} catch (error) {
			console.error(`[Chat Bubbles] Failed to fit media: ${String(error)}`);
		}
	}

	for (const name of classes) {
		if (!objc.getClass(name)) continue;

		objc.hook(name, 'setFrame:', {
			replace: ({ self, args, original }) => {
				setScale(objc, self, 1);

				const result = original(...args);

				refit(self);

				return result;
			},
		});
		objc.hook(name, 'layoutSubviews', { after: ({ self }) => refit(self) });
	}
}

/**
 * @description Gives the media `installMediaFit` scaled its own size back, once the hooks are gone.
 * @param scope The plugin's UI scope.
 */
export function unfitMedia(scope: NativeUIScope) {
	'worklet';
	const objc = scope.objc as NativeObjCBridge;
	const list = fitted();

	losses().clear();

	for (const view of list.splice(0)) {
		try {
			setScale(objc, view, 1);
		} catch (error) {
			console.error(`[Chat Bubbles] Failed to restore media: ${String(error)}`);
		}
	}
}
