import type { NativeObjCBridge, NativeObjectHandle, NativeUIScope } from '@unbound-app/api/native';
import { reportWorkletError } from '@unbound-plugins/shared/native/report-worklet-error';

import { roomForName, type Frame, type HeaderRow } from '~/lib/name-room';

const CELL_CLASS = 'DCDMessageTableViewCell';
const TAG_VIEW_CLASS = 'DiscordChat.MessageTagView';
const MAX_TAG_DEPTH = 8;
const UNBOUNDED = 10_000;
const TRUNCATE_MIDDLE = 5;
const SYMBOLS_SEPARATOR = ' • ';
const TRUNCATED_KEY = '__unboundPlatformIndicatorsTimestamps';

type BoxedRect = {
	value?: BoxedRect;
	origin?: { x?: number; y?: number; value?: { x?: number; y?: number } };
	size?: { width?: number; height?: number; value?: { width?: number; height?: number } };
	width?: number;
};

type HeaderPart = Exclude<keyof HeaderRow, 'row'>;

const IVARS: Record<HeaderPart, string> = {
	container: '_usernameContainerView',
	name: '_usernameView',
	label: '_usernameLabel',
	tags: '_tagsAfterUsernameView',
	timestamp: '_timestampLabel',
};

function frameOf(objc: NativeObjCBridge, view: NativeObjectHandle): Frame {
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
	{ x, y, width, height }: Frame,
) {
	'worklet';
	objc.invoke(view, 'setFrame:', [
		objc.struct('CGRect', { origin: { x, y }, size: { width, height } }),
	]);
}

type TruncatedLabel = { label: NativeObjectHandle; mode: number };

type TruncationState = { labels: TruncatedLabel[]; stopped: boolean };

type TruncationHolder = Record<typeof TRUNCATED_KEY, TruncationState | undefined>;

function truncation(): TruncationState {
	'worklet';
	const holder = globalThis as unknown as TruncationHolder;

	holder[TRUNCATED_KEY] ??= { labels: [], stopped: false };

	return holder[TRUNCATED_KEY];
}

function keepSymbolsVisible(objc: NativeObjCBridge, timestamp: NativeObjectHandle): boolean {
	'worklet';
	const text = objc.invoke(timestamp, 'text', []);
	const mode = Number(objc.invoke(timestamp, 'lineBreakMode', []));
	const { labels, stopped } = truncation();

	if (stopped) return false;

	const index = labels.findIndex(({ label }) => objc.call(label, 'isEqual:', timestamp));

	if (typeof text !== 'string' || !text.includes(SYMBOLS_SEPARATOR)) {
		if (index >= 0) {
			objc.invoke(timestamp, 'setLineBreakMode:', [labels[index]!.mode]);
			labels.splice(index, 1);
		}

		return false;
	}

	if (mode === TRUNCATE_MIDDLE) return false;

	if (index < 0) labels.push({ label: timestamp, mode });

	objc.invoke(timestamp, 'setLineBreakMode:', [TRUNCATE_MIDDLE]);

	return true;
}

/**
 * @description Puts back the line breaking of every timestamp this plugin cut in the middle, so turning it off
 * leaves Discord's timestamps as they were.
 * @param scope The plugin's UI scope, before it is disposed.
 */
export function restoreTimestamps(scope: NativeUIScope) {
	'worklet';
	const objc = scope.objc as NativeObjCBridge;
	const state = truncation();

	state.stopped = true;

	for (const { label, mode } of state.labels.splice(0)) {
		try {
			objc.invoke(label, 'setLineBreakMode:', [mode]);
			objc.invoke(label, 'setNeedsLayout', []);
		} catch (error) {
			reportWorkletError('Platform Indicators', error);
		}
	}
}

function naturalWidth(objc: NativeObjCBridge, label: NativeObjectHandle): number {
	'worklet';
	const raw = objc.invoke(label, 'sizeThatFits:', [
		objc.struct('CGSize', { width: UNBOUNDED, height: UNBOUNDED }),
	]) as BoxedRect | null;

	return Math.ceil(Number((raw?.value ?? raw)?.width ?? 0));
}

/**
 * @description Gives a message's name back room Discord took for a long timestamp, so the timestamp's end is cut
 * before the name, right after Discord lays the header out.
 * @param objc The Objective-C bridge.
 * @param cell The message cell.
 */
export function keepNameRoom(objc: NativeObjCBridge, cell: NativeObjectHandle) {
	'worklet';
	const views: Partial<Record<HeaderPart, NativeObjectHandle>> = {};

	for (const part of Object.keys(IVARS) as HeaderPart[]) {
		const view = objc.getIvar(cell, IVARS[part]) as NativeObjectHandle | null;

		if (view) views[part] = view;
	}

	const { container, name, label, timestamp } = views;
	const row = container
		? (objc.invoke(container, 'superview', []) as NativeObjectHandle | null)
		: null;

	if (!container || !name || !label || !timestamp || !row) return;

	if (objc.invoke(row, 'isHidden', []) || Number(objc.invoke(timestamp, 'alpha', [])) === 0)
		return;

	if (keepSymbolsVisible(objc, timestamp)) {
		objc.invoke(cell, 'setNeedsLayout', []);

		return;
	}

	const header = roomForName(
		{
			row: frameOf(objc, row),
			container: frameOf(objc, container),
			name: frameOf(objc, name),
			label: frameOf(objc, label),
			...(views.tags ? { tags: frameOf(objc, views.tags) } : {}),
			timestamp: frameOf(objc, timestamp),
		},
		naturalWidth(objc, label),
	);

	if (!header) return;

	if (views.tags && header.tags) objc.invoke(views.tags, 'setClipsToBounds:', [true]);

	for (const part of Object.keys(IVARS) as HeaderPart[]) {
		const view = views[part];
		const frame = header[part];

		if (view && frame) setFrameOf(objc, view, frame);
	}
}

/**
 * @description Keeps each message's name readable from a hook that runs on the UI thread after Discord lays the cell
 * out, which it does on every layout pass.
 * @param scope The plugin's UI scope.
 */
function cellOf(objc: NativeObjCBridge, view: NativeObjectHandle): NativeObjectHandle | undefined {
	'worklet';
	let current = objc.invoke(view, 'superview', []) as NativeObjectHandle | null;

	for (let depth = 0; current && depth < MAX_TAG_DEPTH; depth++) {
		if (objc.className(current) === CELL_CLASS) return current;

		current = objc.invoke(current, 'superview', []) as NativeObjectHandle | null;
	}

	return undefined;
}

export function installNameRoom(scope: NativeUIScope) {
	'worklet';
	const objc = scope.objc as NativeObjCBridge;

	truncation().stopped = false;

	if (objc.getClass(TAG_VIEW_CLASS)) {
		objc.hook(TAG_VIEW_CLASS, 'layoutSubviews', {
			after: ({ self }) => {
				try {
					const cell = cellOf(objc, self);

					if (cell) keepNameRoom(objc, cell);
				} catch (error) {
					reportWorkletError('Platform Indicators', error);
				}
			},
		});
	}

	objc.hook(CELL_CLASS, 'layoutSubviews', {
		after: ({ self }) => {
			try {
				keepNameRoom(objc, self);
			} catch (error) {
				reportWorkletError('Platform Indicators', error);
			}
		},
	});
}

export default { installNameRoom, keepNameRoom, restoreTimestamps };
