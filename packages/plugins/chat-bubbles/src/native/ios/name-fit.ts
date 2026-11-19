import type { NativeObjCBridge, NativeObjectHandle } from '@unbound-app/api/native';

import type { Box } from '~/lib/geometry';

type BoxedRect = {
	value?: BoxedRect;
	origin?: { x?: number; y?: number; value?: { x?: number; y?: number } };
	size?: { width?: number; height?: number; value?: { width?: number; height?: number } };
	width?: number;
};

const TAG_GAP = 4;
const UNBOUNDED = 10_000;

function box(raw: unknown): Box {
	'worklet';
	const boxed = raw as BoxedRect | null;
	const value = boxed?.value ?? boxed;
	const origin = value?.origin?.value ?? value?.origin;
	const size = value?.size?.value ?? value?.size;

	return {
		x: Number(origin?.x ?? 0),
		y: Number(origin?.y ?? 0),
		width: Number(size?.width ?? 0),
		height: Number(size?.height ?? 0),
	};
}

function setBox(objc: NativeObjCBridge, view: NativeObjectHandle, { x, y, width, height }: Box) {
	'worklet';
	objc.invoke(view, 'setFrame:', [
		objc.struct('CGRect', { origin: { x, y }, size: { width, height } }),
	]);
}

function naturalWidth(objc: NativeObjCBridge, label: NativeObjectHandle): number {
	'worklet';
	const fits = objc.invoke(label, 'sizeThatFits:', [
		objc.struct('CGSize', { width: UNBOUNDED, height: UNBOUNDED }),
	]) as BoxedRect | null;

	return Math.ceil(Number((fits?.value ?? fits)?.width ?? 0));
}

/**
 * @description Lays the author's name and the tags after it out again across the room the bubble gives the name row,
 * since Discord sized them around a timestamp the bubble hides or moves, which cut the name short.
 * @param objc The Objective-C bridge.
 * @param cell The message cell.
 * @param room How wide the name row may be, or `undefined` to leave Discord's layout.
 */
export function fitNameRow(
	objc: NativeObjCBridge,
	cell: NativeObjectHandle,
	room: number | undefined,
) {
	'worklet';
	if (room === undefined) return;

	const container = objc.getIvar(cell, '_usernameContainerView') as NativeObjectHandle | null;
	const holder = objc.getIvar(cell, '_usernameView') as NativeObjectHandle | null;
	const label = objc.getIvar(cell, '_usernameLabel') as NativeObjectHandle | null;
	const tags = objc.getIvar(cell, '_tagsAfterUsernameView') as NativeObjectHandle | null;

	if (!container || !holder || !label) return;

	const natural = naturalWidth(objc, label);

	if (natural <= 0) return;

	const name = box(objc.invoke(holder, 'frame', []));
	const after = tags ? box(objc.invoke(tags, 'frame', [])) : undefined;
	const gap = after ? Math.max(after.x - name.x - name.width, TAG_GAP) : 0;
	const reserved = after && after.width > 0 ? gap + after.width : 0;
	const width = Math.max(0, Math.min(natural, room - name.x - reserved));

	if (Math.abs(width - name.width) < 0.5) return;

	setBox(objc, holder, { ...name, width });
	setBox(objc, label, { ...box(objc.invoke(label, 'frame', [])), width });

	const end = name.x + width;

	if (after) setBox(objc, tags!, { ...after, x: end + gap });

	setBox(objc, container, {
		...box(objc.invoke(container, 'frame', [])),
		width: after && after.width > 0 ? end + gap + after.width : end,
	});
}

export default fitNameRow;
