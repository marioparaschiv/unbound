import type { NativeObjCBridge, NativeObjectHandle, NativeUIScope } from '@unbound-app/api/native';

import type { RowRoom, RowRooms } from '~/lib/style';
import { isStandaloneCell } from '~/native/ios/standalone-cell';

const STATE_KEY = '__unboundChatBubbleRows';

type BoxedSize = { value?: BoxedSize; size?: BoxedSize; width?: number; height?: number };

/** Yoga values packed by `yogaValue`: how far the content moves right, how much narrower it lays out, and how far its accessories, such as reactions, sit below it, and Yoga's undefined value. */
export type PackedInset = { left: number; right: number; below: number; none: number };

/** `inset` is `null` before it is first set. */
type RowState = { rooms: RowRooms; inset: PackedInset | null };

type StateHolder = Record<typeof STATE_KEY, RowState | undefined>;

function holder(): StateHolder {
	'worklet';

	return globalThis as unknown as StateHolder;
}

function sizeOf(raw: unknown): { width: number; height: number } {
	'worklet';
	const boxed = raw as BoxedSize | null;
	const value = boxed?.value ?? boxed;
	const size = value?.size ?? value;

	return { width: Number(size?.width ?? 0), height: Number(size?.height ?? 0) };
}

function subviewsOf(objc: NativeObjCBridge, view: NativeObjectHandle): NativeObjectHandle[] {
	'worklet';
	// UNKNOWN: `subviews` comes back as a JS array or an `NSArray` handle.
	const list = objc.invoke(view, 'subviews', []) as unknown;

	return (
		Array.isArray(list) ? list : list ? objc.array(list as NativeObjectHandle) : []
	) as NativeObjectHandle[];
}

// Discord fills the reply preview's holder only on rows that reply to a message.
function replies(objc: NativeObjCBridge, cell: NativeObjectHandle): boolean {
	'worklet';
	const holder = objc.getIvar(cell, '_headerView') as NativeObjectHandle | null;

	return Boolean(
		holder && subviewsOf(objc, holder).length > 0 && !objc.invoke(holder, 'isHidden', []),
	);
}

// Discord hides the author's name on rows that continue a group, before it sizes or lays them out.
function roomOf(objc: NativeObjCBridge, cell: NativeObjectHandle, rooms: RowRooms): RowRoom {
	'worklet';
	const header = objc.getIvar(cell, '_messageHeaderView') as NativeObjectHandle | null;

	if (header && objc.invoke(header, 'isHidden', [])) return rooms.next;

	return replies(objc, cell) ? rooms.reply : rooms.first;
}

// The content sits between the row's rooms; `undefined` when the row has none.
function paddedFrame(objc: NativeObjCBridge, cell: NativeObjectHandle, rooms: RowRooms) {
	'worklet';
	const room = roomOf(objc, cell, rooms);

	if (room.top + room.bottom <= 0) {
		return undefined;
	}

	const bounds = sizeOf(objc.invoke(cell, 'bounds', []));

	return objc.struct('CGRect', {
		origin: { x: 0, y: room.top },
		size: {
			width: bounds.width,
			height: Math.max(0, bounds.height - room.top - room.bottom),
		},
	});
}

// Discord lays a message's accessories, such as its reactions, in a holder below the content, empty when it has none.
// A margin above a filled holder moves them below the bubble, and Yoga grows the row to fit.
function spaceAccessories(
	objc: NativeObjCBridge,
	content: NativeObjectHandle,
	{ below, none }: PackedInset,
) {
	'worklet';
	const column = objc.invoke(content, 'superview', []) as NativeObjectHandle | null;
	const siblings = column ? subviewsOf(objc, column) : [];
	let after = false;

	for (const holder of siblings) {
		if (!after) {
			after = Boolean(objc.invoke(holder, 'isEqual:', [content]));
			continue;
		}

		const yoga = objc.invoke(holder, 'yoga', []) as NativeObjectHandle | null;
		const filled = subviewsOf(objc, holder).length > 0;

		if (yoga) objc.invoke(yoga, 'setMarginTop:', [filled ? below : none]);
	}
}

// Discord lays a cell out with Yoga. Offsetting the content's node moves it with the decorations it positions
// absolutely, such as a forward's bar, and padding its right side narrows the text and media it lays out.
function insetContent(objc: NativeObjCBridge, cell: NativeObjectHandle, inset: PackedInset) {
	'worklet';
	const content = objc.invoke(cell, 'messageContentView', []) as NativeObjectHandle | null;
	const yoga = content ? (objc.invoke(content, 'yoga', []) as NativeObjectHandle | null) : null;

	if (!yoga) {
		return;
	}

	// Yoga marks its node dirty only when a value changes, so repeating the same inset costs no layout.
	objc.invoke(yoga, 'setLeft:', [inset.left]);
	objc.invoke(yoga, 'setPaddingRight:', [inset.right]);
	spaceAccessories(objc, content!, inset);
}

/**
 * @description Makes every message row taller by the room set with `setRowRoom` above and below its content, by whether it starts a group, and moves its content in from both sides by the inset, so bubbles keep their full padding where Discord packs rows tightly. Discord sizes its rows with `sizeThatFits:`, so growing that result grows the row, and insetting first wraps the content to the narrower width.
 * @param scope The plugin's UI scope, which removes every hook on dispose.
 * @param messageCell The message cell's class name.
 * @param contentView The class of a table cell's content view.
 */
export function installRowPadding(scope: NativeUIScope, messageCell: string, contentView: string) {
	'worklet';
	const objc = scope.objc as NativeObjCBridge;
	const none = { top: 0, bottom: 0 };
	const state: RowState = { rooms: { first: none, next: none, reply: none }, inset: null };

	holder()[STATE_KEY] = state;

	objc.hook(messageCell, 'sizeThatFits:', {
		replace: ({ self, args, original }) => {
			if (isStandaloneCell(objc, self)) return original(...args);

			if (state.inset !== null) {
				try {
					insetContent(objc, self, state.inset);
				} catch (error) {
					console.error(`[Chat Bubbles] Failed to inset a message row: ${String(error)}`);
				}
			}

			const size = sizeOf(original(...args));
			const room = roomOf(objc, self, state.rooms);

			return objc.struct('CGSize', {
				width: size.width,
				height: size.height + room.top + room.bottom,
			});
		},
	});
	// UIKit lays the content view over the whole cell; moving it down by the room above puts the content back between its rooms.
	objc.hook(messageCell, 'layoutSubviews', {
		after: ({ self }) => {
			try {
				const frame = isStandaloneCell(objc, self)
					? undefined
					: paddedFrame(objc, self, state.rooms);

				if (frame) {
					objc.invoke(
						objc.invoke(self, 'contentView', []) as NativeObjectHandle,
						'setFrame:',
						[frame],
					);
				}
			} catch (error) {
				console.error(`[Chat Bubbles] Failed to centre a message row: ${String(error)}`);
			}
		},
	});
	// UIKit also sets the content's frame outside a layout, such as while scrolling, which would show the content
	// out of line with its bubble and avatar until the next layout.
	objc.hook(contentView, 'setFrame:', {
		replace: ({ self, args, original }) => {
			try {
				const cell = objc.invoke(self, 'superview', []) as NativeObjectHandle | null;
				const frame =
					cell && objc.className(cell) === messageCell && !isStandaloneCell(objc, cell)
						? paddedFrame(objc, cell, state.rooms)
						: undefined;

				if (frame) return original(frame);
			} catch (error) {
				console.error(
					`[Chat Bubbles] Failed to keep a message row centred: ${String(error)}`,
				);
			}

			return original(...args);
		},
	});
}

/**
 * @description Sets how much each message row grows above and below its content, in points, and how far its content is padded in; no room and Yoga's undefined value leave Discord's rows alone.
 * @param rooms The extra height of rows that start a group and of rows that continue one.
 * @param inset The content's offset and right padding, packed by `yogaValue`.
 */
export function setRowRoom(rooms: RowRooms, inset: PackedInset) {
	'worklet';
	const state = holder()[STATE_KEY];

	if (state) {
		state.rooms = rooms;
		state.inset = inset;
	}
}

export default { installRowPadding, setRowRoom };
