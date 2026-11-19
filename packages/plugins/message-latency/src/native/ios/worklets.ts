import type { NativeObjCBridge, NativeObjectHandle, NativeUIScope } from '@unbound-app/api/native';

import { Icon, ICON_TAG } from '~/lib/constants';
import { badgedHeader, type HeaderFrames } from '~/lib/header-layout';
import { reportWorkletError } from '@unbound-plugins/shared/native/report-worklet-error';

const CELL_CLASS = 'DCDMessageTableViewCell';
const UNBOUNDED = 10_000;

type Box = HeaderFrames['row'];

type BoxedRect = {
	value?: BoxedRect;
	origin?: { x?: number; y?: number; value?: { x?: number; y?: number } };
	size?: { width?: number; height?: number; value?: { width?: number; height?: number } };
};

type HeaderPart = keyof HeaderFrames;

const IVARS: Record<Exclude<HeaderPart, 'row'>, string> = {
	container: '_usernameContainerView',
	name: '_usernameView',
	label: '_usernameLabel',
	tags: '_tagsAfterUsernameView',
	timestamp: '_timestampLabel',
};

function frameOf(objc: NativeObjCBridge, view: NativeObjectHandle): Box {
	'worklet';
	const raw = objc.invoke(view, 'frame', []) as BoxedRect | null;
	const value = raw?.value ?? raw;
	const origin = value?.origin?.value ?? value?.origin;
	const size = value?.size?.value ?? value?.size;

	return {
		x: Number(origin?.x ?? 0),
		y: Number(origin?.y ?? 0),
		width: Number(size?.width ?? 0),
		height: Number(size?.height ?? 0),
	};
}

function setFrameOf(
	objc: NativeObjCBridge,
	view: NativeObjectHandle,
	{ x, y, width, height }: Box,
) {
	'worklet';
	objc.invoke(view, 'setFrame:', [
		objc.struct('CGRect', { origin: { x, y }, size: { width, height } }),
	]);
}

function naturalWidth(objc: NativeObjCBridge, label: NativeObjectHandle): number {
	'worklet';
	const raw = objc.invoke(label, 'sizeThatFits:', [
		objc.struct('CGSize', { width: UNBOUNDED, height: UNBOUNDED }),
	]) as BoxedRect['size'] | null;

	return Math.ceil(Number((raw?.value ?? raw)?.width ?? 0));
}

function headerViews(
	objc: NativeObjCBridge,
	cell: NativeObjectHandle,
	container: NativeObjectHandle,
): Partial<Record<HeaderPart, NativeObjectHandle>> {
	'worklet';
	const views: Partial<Record<HeaderPart, NativeObjectHandle>> = {
		container,
		row: (objc.invoke(container, 'superview', []) as NativeObjectHandle | null) ?? undefined,
	};

	for (const part of ['name', 'label', 'tags', 'timestamp'] as const) {
		const view = objc.getIvar(cell, IVARS[part]) as NativeObjectHandle | null;

		if (view) views[part] = view;
	}

	return views;
}

/**
 * @description Lays a cell's badge before the name and moves the name, its tags and the timestamp after it, by frame,
 * right after Discord lays the header out, which it does on every layout pass.
 * @param objc The Objective-C bridge.
 * @param cell The message cell.
 */
export function placeBadge(objc: NativeObjCBridge, cell: NativeObjectHandle) {
	'worklet';
	const container = objc.getIvar(cell, IVARS.container) as NativeObjectHandle | null;
	const icon = container
		? (objc.invoke(container, 'viewWithTag:', [ICON_TAG]) as NativeObjectHandle | null)
		: null;

	if (!container || !icon) return;

	const views = headerViews(objc, cell, container);
	const { row, name, label } = views;

	if (!row || !name || !label || objc.invoke(row, 'isHidden', [])) return;

	const frames = { row: frameOf(objc, row), container: frameOf(objc, container) } as HeaderFrames;

	for (const part of ['name', 'label', 'tags', 'timestamp'] as const) {
		const view = views[part];

		if (view) frames[part] = frameOf(objc, view);
	}

	if (frames.container.width <= 0) return;

	const badged = badgedHeader(
		frames,
		{ width: Icon.controlWidth, height: Icon.controlHeight },
		naturalWidth(objc, label),
	);

	setFrameOf(objc, icon, badged.icon);

	for (const part of ['container', 'name', 'label', 'tags', 'timestamp'] as const) {
		const view = views[part];
		const frame = badged.frames[part];

		if (view && frame) setFrameOf(objc, view, frame);
	}
}

/**
 * @description Places each cell's badge after Discord lays the cell out, and hides a reused cell's badge in the same
 * pass that prepares it for another message, so the badge never shows on the wrong message, from hooks that run on
 * the UI thread.
 * @param scope The plugin's UI scope.
 */
export function installCellGuards(scope: NativeUIScope) {
	'worklet';
	const objc = scope.objc as NativeObjCBridge;

	objc.hook(CELL_CLASS, 'layoutSubviews', {
		after: ({ self }) => {
			try {
				placeBadge(objc, self);
			} catch (error) {
				reportWorkletError('Message Latency', error);
			}
		},
	});

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

export default { installCellGuards, placeBadge };
