import type { NativeObjCBridge, NativeObjectHandle, NativeUIScope } from '@unbound-app/api/native';

import { speedLabel } from '~/lib/speeds';

const STATE_KEY = '__unboundVoicePillControls';
const PLAYER = 'DiscordChatComponentsSwift.AudioPlayerView';
const MESSAGE_CELL = 'DCDMessageTableViewCell';
const SPEED_TAG = 0x5b1d;
const DOWNLOAD_TAG = 0x5b1e;
const SPEED_WIDTH = 36;
const DOWNLOAD_WIDTH = 22;
const GAP = 2;
const END_PADDING = 10;
const CONTROLS_WIDTH = SPEED_WIDTH + DOWNLOAD_WIDTH + GAP + END_PADDING;
const CONTROL_HEIGHT = 28;
const TOUCH_UP_INSIDE = 64;
const SEMIBOLD = 0.3;
const SYSTEM_BUTTON = 1;
const CELL_SEARCH_DEPTH = 12;
const CONTAINER_DEPTH = 3;

type Rect = { x: number; y: number; width: number; height: number };

type BoxedRect = {
	value?: BoxedRect;
	origin?: { x?: number; y?: number };
	size?: { width?: number; height?: number };
};

type PillAction = 'speed' | 'download';

type PillState = { speed: number; widening: boolean; buttons: NativeObjectHandle[] };

function state(): PillState {
	'worklet';
	const holder = globalThis as unknown as Record<typeof STATE_KEY, PillState | undefined>;

	return (holder[STATE_KEY] ??= { speed: 1, widening: false, buttons: [] });
}

function rectOf(raw: unknown): Rect {
	'worklet';
	const boxed = raw as BoxedRect | null;
	const rect = boxed?.value ?? boxed;

	return {
		x: Number(rect?.origin?.x ?? 0),
		y: Number(rect?.origin?.y ?? 0),
		width: Number(rect?.size?.width ?? 0),
		height: Number(rect?.size?.height ?? 0),
	};
}

function struct(objc: NativeObjCBridge, { x, y, width, height }: Rect) {
	'worklet';

	return objc.struct('CGRect', { origin: { x, y }, size: { width, height } });
}

function messageIdOf(objc: NativeObjCBridge, view: NativeObjectHandle): string | undefined {
	'worklet';
	let current: NativeObjectHandle | null = view;

	for (let depth = 0; current && depth < CELL_SEARCH_DEPTH; depth++) {
		if (objc.className(current) === MESSAGE_CELL) {
			const viewModel = objc.getIvar(current, 'viewModel') as NativeObjectHandle | null;
			const message = viewModel
				? (objc.call(viewModel, 'message') as NativeObjectHandle | null)
				: null;
			const id = message ? objc.call(message, 'id') : null;

			if (typeof id === 'string') return id;
			if (id && typeof id === 'object') {
				const description = objc.call(id as NativeObjectHandle, 'description');

				return typeof description === 'string' ? description : undefined;
			}

			return undefined;
		}

		current = objc.invoke(current, 'superview', []) as NativeObjectHandle | null;
	}

	return undefined;
}

function timeColor(objc: NativeObjCBridge, player: NativeObjectHandle): unknown {
	'worklet';
	const children = (objc.invoke(player, 'subviews', []) as NativeObjectHandle[] | null) ?? [];
	const playback = children.find((child) =>
		(objc.className(child) ?? '').includes('PlaybackLabel'),
	);
	const labels = playback
		? ((objc.invoke(playback, 'subviews', []) as NativeObjectHandle[] | null) ?? [])
		: [];
	const time = labels.find((child) => objc.className(child) === 'UILabel');

	return time ? objc.invoke(time, 'textColor', []) : null;
}

function styleLike(objc: NativeObjCBridge, button: NativeObjectHandle, player: NativeObjectHandle) {
	'worklet';
	const tint = timeColor(objc, player);

	if (tint) {
		objc.invoke(button, 'setTitleColor:forState:', [tint, 0]);
		objc.invoke(button, 'setTintColor:', [tint]);
	}
}

function createControl(
	objc: NativeObjCBridge,
	player: NativeObjectHandle,
	tag: number,
	action: PillAction,
	onAction: (action: PillAction, messageId: string) => void,
): NativeObjectHandle {
	'worklet';
	const button = objc.call(
		objc.getClass('UIButton')!,
		'buttonWithType:',
		SYSTEM_BUTTON,
	) as NativeObjectHandle;
	const target = objc.call(objc.getClass('UIView')!, 'new') as NativeObjectHandle;

	objc.invoke(button, 'setTag:', [tag]);
	styleLike(objc, button, player);

	if (action === 'speed') {
		const title = objc.invoke(button, 'titleLabel', []) as NativeObjectHandle | null;
		const font = objc.call(
			objc.getClass('UIFont')!,
			'monospacedDigitSystemFontOfSize:weight:',
			12,
			SEMIBOLD,
		);

		if (title) objc.invoke(title, 'setFont:', [font]);
	} else {
		const image = objc.call(
			objc.getClass('UIImage')!,
			'systemImageNamed:',
			'arrow.down.circle',
		);

		if (image) objc.invoke(button, 'setImage:forState:', [image, 0]);
	}

	objc.invoke(button, 'addTarget:action:forControlEvents:', [
		target,
		'setNeedsDisplay',
		TOUCH_UP_INSIDE,
	]);
	objc.hook(
		'UIView',
		'setNeedsDisplay',
		{
			after: () => {
				const messageId = messageIdOf(objc, button);

				if (messageId) onAction(action, messageId);
			},
		},
		{ instance: target },
	);
	objc.invoke(player, 'addSubview:', [button]);
	state().buttons.push(button);

	return button;
}

function control(
	objc: NativeObjCBridge,
	player: NativeObjectHandle,
	tag: number,
	action: PillAction,
	onAction: (action: PillAction, messageId: string) => void,
): NativeObjectHandle {
	'worklet';

	const existing = objc.invoke(player, 'viewWithTag:', [tag]) as NativeObjectHandle | null;

	if (existing && state().buttons.some((button) => objc.call(button, 'isEqual:', existing)))
		return existing;
	if (existing) objc.invoke(existing, 'removeFromSuperview', []);

	return createControl(objc, player, tag, action, onAction);
}

function placeControls(
	objc: NativeObjCBridge,
	player: NativeObjectHandle,
	frame: Rect,
	onAction: (action: PillAction, messageId: string) => void,
) {
	'worklet';
	const y = frame.height / 2 - CONTROL_HEIGHT / 2;
	const speed = control(objc, player, SPEED_TAG, 'speed', onAction);
	const download = control(objc, player, DOWNLOAD_TAG, 'download', onAction);
	const speedX = frame.width - END_PADDING - DOWNLOAD_WIDTH - GAP - SPEED_WIDTH;

	objc.invoke(speed, 'setFrame:', [
		struct(objc, { x: speedX, y, width: SPEED_WIDTH, height: CONTROL_HEIGHT }),
	]);
	objc.invoke(download, 'setFrame:', [
		struct(objc, {
			x: speedX + SPEED_WIDTH + GAP,
			y,
			width: DOWNLOAD_WIDTH,
			height: CONTROL_HEIGHT,
		}),
	]);
	objc.invoke(speed, 'setTitle:forState:', [speedLabel(state().speed), 0]);
}

function fitContainers(objc: NativeObjCBridge, player: NativeObjectHandle, frame: Rect) {
	'worklet';
	let child = frame;
	let container = objc.invoke(player, 'superview', []) as NativeObjectHandle | null;

	for (let level = 0; container && level < CONTAINER_DEPTH; level++) {
		const bounds = rectOf(objc.invoke(container, 'frame', []));
		const needed = child.x + child.width;

		if (bounds.width >= needed) return;

		child = { ...bounds, width: needed };
		objc.invoke(container, 'setFrame:', [struct(objc, child)]);
		container = objc.invoke(container, 'superview', []) as NativeObjectHandle | null;
	}
}

/**
 * @description Puts a speed button and a download button inside Discord's voice message pill. Hooks
 * `-[AudioPlayerView setFrame:]`, through which Discord sizes the pill, to widen it and place the buttons at its end. A tap reaches `onAction` with the message id through a hidden view's `setNeedsDisplay`, which the
 * button targets.
 * @param scope The plugin's UI scope, which removes the hooks on dispose.
 * @param speed The speed the speed button shows.
 * @param onAction Runs with the tapped button's action and its message.
 */
export function installPillControls(
	scope: NativeUIScope,
	speed: number,
	onAction: (action: PillAction, messageId: string) => void,
) {
	'worklet';
	const objc = scope.objc as NativeObjCBridge;

	state().speed = speed;

	objc.hook(PLAYER, 'setFrame:', {
		replace: ({ self, args, original }) => {
			const current = state();
			const result = original(...args);
			const frame = rectOf(args[0]);

			if (current.widening || frame.width <= 0) return result;

			const widened = { ...frame, width: frame.width + CONTROLS_WIDTH };

			current.widening = true;

			try {
				objc.invoke(self, 'setFrame:', [struct(objc, widened)]);
				fitContainers(objc, self, widened);
			} finally {
				current.widening = false;
			}

			return result;
		},
	});

	objc.hook(PLAYER, 'layoutSubviews', {
		after: ({ self }) => {
			const frame = rectOf(objc.invoke(self, 'frame', []));

			if (frame.width <= CONTROLS_WIDTH) return;

			try {
				placeControls(objc, self, frame, onAction);
			} catch (error) {
				console.error(
					`[Voice Message Tools] Failed to place voice message controls: ${String(error)}`,
				);
			}
		},
	});
}

/**
 * @description Shows a new speed on the speed buttons.
 * @param speed The speed.
 */
export function showPillSpeed(scope: NativeUIScope, speed: number) {
	'worklet';
	const objc = scope.objc as NativeObjCBridge;
	const current = state();

	current.speed = speed;

	for (const button of current.buttons) {
		objc.invoke(button, 'setTitle:forState:', [speedLabel(speed), 0]);
	}
}

/**
 * @description Removes the buttons; the waveforms get their room back on the next layout.
 * @param scope The plugin's UI scope.
 */
export function removePillControls(scope: NativeUIScope) {
	'worklet';
	const objc = scope.objc as NativeObjCBridge;
	const current = state();

	for (const button of current.buttons) {
		const player = objc.invoke(button, 'superview', []) as NativeObjectHandle | null;

		objc.invoke(button, 'removeFromSuperview', []);
		if (player) objc.invoke(player, 'setNeedsLayout', []);
	}

	current.buttons = [];
}
