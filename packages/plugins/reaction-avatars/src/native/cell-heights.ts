import type { NativeHookToken, NativeObjectHandle } from '@unbound-app/api/native';
import { safeInvoke } from '@unbound-plugins/shared/native/safe-invoke';

import type { LayoutEntry } from '~/native/collections';
import type { Session } from '~/native/session';
import { frameOf, key, readSize } from '~/native/views';
import { NativeClass } from '~/constants';

// A message cell keeps the tallest height any of its reaction collections asks for.
export type CellHeight = {
	cell: NativeObjectHandle;
	contributions: Map<string, number>;
	floor: number;
	hook: NativeHookToken | null;
	messageKey: string;
	width: number;
};

function highest(contributions: Map<string, number>): number {
	return Math.max(0, ...contributions.values());
}

function removeHook(height: CellHeight): void {
	const hook = height.hook;

	height.hook = null;

	try {
		hook?.remove();
	} catch {
		return;
	}
}

function forget(session: Session, cellKey: string, height: CellHeight): void {
	removeHook(height);
	session.cellHeights.delete(cellKey);
}

function hookCellSize(session: Session, height: CellHeight): NativeHookToken {
	return session.objc.hook(
		NativeClass.messageCell,
		'sizeThatFits:',
		{
			replace(context) {
				const size = context.original(...context.args);
				const { width, height: natural } = readSize(size);

				if (width === undefined || natural === undefined || natural >= height.floor) {
					return size;
				}

				return session.objc.struct('CGSize', { width, height: height.floor });
			},
		},
		{ instance: height.cell, thread: 'main' },
	);
}

function setFloor(session: Session, cellKey: string, height: CellHeight, floor: number) {
	try {
		height.floor = floor;
		height.hook ??= hookCellSize(session, height);

		return true;
	} catch {
		forget(session, cellKey, height);

		return false;
	}
}

// The collection's planned bottom edge in the message cell's coordinates, plus a 2pt margin.
function collectionBottomInCell(session: Session, entry: LayoutEntry): number | undefined {
	if (!entry.ownerCell || !entry.plan) return;

	const { objc } = session;
	let offset = 0;
	let current: NativeObjectHandle | null = entry.collection;

	for (let depth = 0; current && depth < 12; depth++) {
		if (key(objc, current) === entry.ownerCellKey) return offset + entry.plan.height + 2;

		const frame = frameOf(objc, current);

		if (!frame) return;

		offset += frame.y;
		current = safeInvoke(objc, current, 'superview') as NativeObjectHandle | null;
	}
}

/**
 * @description Drops a reaction collection's height request from its message cell.
 * @param session The running session.
 * @param entry The collection's layout.
 * @returns `true` when the cell's height changed and its table needs to re-measure.
 */
export function clearCellHeight(session: Session, entry: LayoutEntry): boolean {
	const height = session.cellHeights.get(entry.ownerCellKey);

	if (!height || height.messageKey !== entry.ownerMessageKey) return false;

	if (!height.contributions.delete(key(session.objc, entry.collection))) return false;

	if (height.contributions.size === 0) {
		forget(session, entry.ownerCellKey, height);

		return true;
	}

	const floor = highest(height.contributions);

	if (Math.abs(height.floor - floor) < 0.5) return false;

	setFloor(session, entry.ownerCellKey, height, floor);

	return true;
}

/**
 * @description Makes a message cell tall enough for its reflowed reaction collection.
 * @param session The running session.
 * @param entry The collection's layout, with a plan.
 * @returns `true` when the cell's height changed and its table needs to re-measure.
 */
export function updateCellHeight(session: Session, entry: LayoutEntry): boolean {
	if (!entry.ownerCell || !entry.plan) return false;

	const baselineHeight = entry.ancestorFrames[0]?.frame.height;
	const cellFrame = frameOf(session.objc, entry.ownerCell);

	if (baselineHeight === undefined || !cellFrame || cellFrame.width <= 0) return false;

	if (entry.plan.height - baselineHeight < 1) return clearCellHeight(session, entry);

	const floor = collectionBottomInCell(session, entry);

	if (floor === undefined || floor <= 0 || floor > 4096) return false;

	let height = session.cellHeights.get(entry.ownerCellKey);

	if (
		height &&
		(height.messageKey !== entry.ownerMessageKey ||
			Math.abs(height.width - cellFrame.width) >= 0.5)
	) {
		forget(session, entry.ownerCellKey, height);
		height = undefined;
	}

	if (!height) {
		height = {
			cell: entry.ownerCell,
			contributions: new Map(),
			floor: 0,
			hook: null,
			messageKey: entry.ownerMessageKey,
			width: cellFrame.width,
		};
		session.cellHeights.set(entry.ownerCellKey, height);
	}

	height.contributions.set(key(session.objc, entry.collection), floor);

	const target = highest(height.contributions);

	if (Math.abs(height.floor - target) < 0.5) return false;

	return setFloor(session, entry.ownerCellKey, height, target);
}

/**
 * @description Removes every cell's `sizeThatFits:` hook.
 * @param session The running session.
 */
export function clearCellHeights(session: Session): void {
	for (const height of session.cellHeights.values()) removeHook(height);

	session.cellHeights.clear();
}
