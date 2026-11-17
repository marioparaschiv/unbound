import {
	javaFlag,
	javaFloat,
	javaInt,
	javaNumber,
	javaReference,
	javaString,
	javaText,
} from '@unbound-plugins/shared/native/android/java-values';
import type {
	NativeJavaBridge,
	NativeJavaHooksBridge,
	NativeJavaReference,
	NativeUIScope,
} from '@unbound-app/api/native';

import { speedLabel } from '~/lib/speeds';

const STATE_KEY = '__unboundVoicePillControlsAndroid';
const PLAYER = 'com.discord.chat.presentation.message.view.voicemessages.AudioPlayerView';
const MESSAGE_VIEW = 'com.discord.chat.presentation.message.MessageView';
const SPEED_TAG = 'unbound-voice-speed';
const DOWNLOAD_TAG = 'unbound-voice-download';
const DOWNLOAD_ICONS = [
	'ic_download_24dp',
	'ic_download',
	'design_ic_download',
	'ic_arrow_down_24dp',
];
const SYSTEM_DOWNLOAD_ICON = 17301633;
const UNIT_SP = 2;
const SPEED_TEXT_SP = 13;
const SPEED_WIDTH_DP = 40;
const DOWNLOAD_SIZE_DP = 24;
const END_PADDING_DP = 10;
const BOLD = 1;
const ROW_DEPTH = 16;
const MAX_PLAYERS = 64;
const PLAY_DEPTH = 4;
const MOTION_DOWN = 0;
const MOTION_UP = 1;

type PillAction = 'speed' | 'download';

type PillState = {
	speed: number;
	speedViews: NativeJavaReference[];
	icon?: number;
	/** The voice message players bound so far, for autoplay to find the next one in. */
	players: NativeJavaReference[];
};

type BindEvent = { self: unknown };

function state(): PillState {
	'worklet';
	const holder = globalThis as unknown as Record<typeof STATE_KEY, PillState | undefined>;

	const current = (holder[STATE_KEY] ??= { speed: 1, speedViews: [], players: [] });

	if (!Array.isArray(current.players)) current.players = [];

	return current;
}

function dp(java: NativeJavaBridge, view: NativeJavaReference, value: number): number {
	'worklet';
	const resources = javaReference(java.invoke(view, 'getResources', []));
	const metrics = resources && javaReference(java.invoke(resources, 'getDisplayMetrics', []));
	const density = metrics ? (javaNumber(java.getField(metrics, 'density')) ?? 1) : 1;

	return Math.round(value * density);
}

function messageIdOf(
	java: NativeJavaBridge,
	view: NativeJavaReference,
	idField: string,
): string | undefined {
	'worklet';
	let current: NativeJavaReference | null = view;

	for (let depth = 0; current && depth < ROW_DEPTH; depth++) {
		const type = javaReference(java.invoke(current, 'getClass', []));
		const name = type ? javaText(java.invoke(type, 'getName', [])) : undefined;

		if (name === MESSAGE_VIEW) return javaText(java.getField(current, idField));

		current = javaReference(java.invoke(current, 'getParent', []));
	}

	return undefined;
}

function downloadIcon(java: NativeJavaBridge, view: NativeJavaReference): number {
	'worklet';
	const current = state();

	if (current.icon !== undefined) return current.icon;

	const context = javaReference(java.invoke(view, 'getContext', []));
	const resources = javaReference(java.invoke(view, 'getResources', []));
	const pkg = context ? javaText(java.invoke(context, 'getPackageName', [])) : undefined;

	current.icon = SYSTEM_DOWNLOAD_ICON;

	for (const name of DOWNLOAD_ICONS) {
		const id = resources
			? javaNumber(
					java.invoke(resources, 'getIdentifier', [
						javaString(name),
						javaString('drawable'),
						javaString(pkg ?? ''),
					]),
				)
			: 0;

		if (id) {
			current.icon = id;
			break;
		}
	}

	return current.icon;
}

function addControl(
	java: NativeJavaBridge,
	pill: NativeJavaReference,
	view: NativeJavaReference,
	width: number,
	height: number,
	listener: unknown,
	tag: string,
) {
	'worklet';
	const params = java.construct('android.widget.LinearLayout$LayoutParams', [
		javaInt(width),
		javaInt(height),
	]);

	java.invoke(view, 'setTag', [javaString(tag)]);
	java.invoke(view, 'setOnClickListener', [listener as never]);
	java.invoke(pill, 'addView', [view, params]);
}

function addControls(
	java: NativeJavaBridge,
	player: NativeJavaReference,
	listeners: { speed: unknown; download: unknown },
) {
	'worklet';
	const pill = javaReference(java.invoke(player, 'getChildAt', [javaInt(0)]));

	if (!pill || javaReference(java.invoke(pill, 'findViewWithTag', [javaString(SPEED_TAG)])))
		return;

	const count = javaNumber(java.invoke(pill, 'getChildCount', [])) ?? 0;
	const time = javaReference(java.invoke(pill, 'getChildAt', [javaInt(count - 1)]));
	const color = time ? javaNumber(java.invoke(time, 'getCurrentTextColor', [])) : undefined;
	const context = javaReference(java.invoke(player, 'getContext', []));

	if (!context) return;

	const speed = java.construct('android.widget.TextView', [context]);

	java.invoke(speed, 'setText', [javaString(speedLabel(state().speed))]);
	java.invoke(speed, 'setTextSize', [javaInt(UNIT_SP), javaFloat(SPEED_TEXT_SP)]);
	java.invoke(speed, 'setGravity', [javaInt(17)]);
	java.invoke(speed, 'setTypeface', [
		javaReference(java.invoke(speed, 'getTypeface', [])) as never,
		javaInt(BOLD),
	]);
	if (color !== undefined) java.invoke(speed, 'setTextColor', [javaInt(color)]);
	addControl(java, pill, speed, dp(java, player, SPEED_WIDTH_DP), -1, listeners.speed, SPEED_TAG);
	state().speedViews.push(speed);

	const download = java.construct('android.widget.ImageView', [context]);
	const size = dp(java, player, DOWNLOAD_SIZE_DP);

	java.invoke(download, 'setImageResource', [javaInt(downloadIcon(java, player))]);
	if (color !== undefined) java.invoke(download, 'setColorFilter', [javaInt(color)]);
	addControl(
		java,
		pill,
		download,
		size + dp(java, player, END_PADDING_DP),
		size,
		listeners.download,
		DOWNLOAD_TAG,
	);
	java.invoke(download, 'setPadding', [
		javaInt(0),
		javaInt(0),
		javaInt(dp(java, player, END_PADDING_DP)),
		javaInt(0),
	]);
}

function rememberPlayer(java: NativeJavaBridge, player: NativeJavaReference) {
	'worklet';
	const { players } = state();

	if (players.some((known) => javaFlag(java.invoke(known, 'equals', [player])))) return;

	players.push(player);

	if (players.length > MAX_PLAYERS) players.shift();
}

function tap(java: NativeJavaBridge, view: NativeJavaReference): boolean {
	'worklet';
	const MotionEvent = java.getClass('android.view.MotionEvent');
	const now =
		javaNumber(java.invoke(java.getClass('android.os.SystemClock'), 'uptimeMillis', [])) ?? 0;
	const x = (javaNumber(java.invoke(view, 'getWidth', [])) ?? 0) / 2;
	const y = (javaNumber(java.invoke(view, 'getHeight', [])) ?? 0) / 2;
	const touch = (action: number) =>
		javaReference(
			java.invoke(MotionEvent, 'obtain', [
				{ type: 'long', value: now },
				{ type: 'long', value: now },
				javaInt(action),
				javaFloat(x),
				javaFloat(y),
				javaInt(0),
			]),
		);
	const down = touch(MOTION_DOWN);
	const up = touch(MOTION_UP);

	if (!down || !up) return false;

	java.invoke(view, 'dispatchTouchEvent', [down]);
	java.invoke(view, 'dispatchTouchEvent', [up]);
	java.invoke(down, 'recycle', []);
	java.invoke(up, 'recycle', []);

	return true;
}

function firstClickable(
	java: NativeJavaBridge,
	view: NativeJavaReference,
	depth: number,
): NativeJavaReference | null {
	'worklet';
	if (javaFlag(java.invoke(view, 'hasOnClickListeners', []))) return view;

	const group = java.getClass('android.view.ViewGroup');

	if (depth <= 0 || !javaFlag(java.invoke(group, 'isInstance', [view]))) return null;

	const count = javaNumber(java.invoke(view, 'getChildCount', [])) ?? 0;

	for (let index = 0; index < count; index++) {
		const child = javaReference(java.invoke(view, 'getChildAt', [javaInt(index)]));
		const found = child ? firstClickable(java, child, depth - 1) : null;

		if (found) return found;
	}

	return null;
}

/**
 * @description Starts a voice message the way a tap on its play button does, when its player is on screen.
 * @param scope The plugin's UI scope.
 * @param messageId The voice message.
 * @param idField The name of `MessageView`'s message id field.
 * @returns Whether its player was found and pressed.
 */
export function playVoiceMessage(
	scope: NativeUIScope,
	messageId: string,
	idField: string,
): boolean {
	'worklet';
	const java = scope.java as NativeJavaBridge;
	const player = state().players.find(
		(candidate) =>
			javaFlag(java.invoke(candidate, 'isAttachedToWindow', [])) &&
			messageIdOf(java, candidate, idField) === messageId,
	);
	const pill = player ? javaReference(java.invoke(player, 'getChildAt', [javaInt(0)])) : null;
	const holder = pill ? javaReference(java.invoke(pill, 'getChildAt', [javaInt(0)])) : null;

	if (!holder) return false;

	const button = firstClickable(java, holder, PLAY_DEPTH) ?? holder;

	return tap(java, button);
}

/**
 * @description Puts a speed button and a download button at the end of Discord's voice message pill. Hooks
 * `AudioPlayerView.setDurationMs`, which Discord calls when it binds a voice message, and appends the buttons to the
 * pill's row; a click reaches `onAction` with the id of the message whose `MessageView` holds the button.
 * @param scope The plugin's UI scope, which removes the hook and listeners on dispose.
 * @param speed The speed the speed button shows.
 * @param idField The name of `MessageView`'s message id field.
 * @param onAction Runs with the clicked button's action and its message.
 */
export function installPillControls(
	scope: NativeUIScope,
	speed: number,
	idField: string,
	onAction: (action: PillAction, messageId: string) => void,
) {
	'worklet';
	const java = scope.java as NativeJavaBridge;
	const hooks = scope.hooks as NativeJavaHooksBridge;

	state().speed = speed;

	function listener(action: PillAction) {
		return hooks.proxy(['android.view.View$OnClickListener'], (call) => {
			const view = javaReference(call.args[0] as never);
			const messageId = view ? messageIdOf(java, view, idField) : undefined;

			if (messageId) onAction(action, messageId);
		}).object;
	}

	const listeners = { speed: listener('speed'), download: listener('download') };

	hooks.hook(PLAYER, 'setDurationMs', ['long'], { notify: true }, (event: BindEvent) => {
		const player = javaReference(event.self as never);

		if (!player) return;

		try {
			addControls(java, player, listeners);
			rememberPlayer(java, player);
		} catch (error) {
			console.error(
				`[Voice Message Tools] Failed to add voice message controls: ${String(error)}`,
			);
		}
	});
}

/**
 * @description Shows a new speed on the speed buttons.
 * @param scope The plugin's UI scope.
 * @param speed The speed.
 */
export function showPillSpeed(scope: NativeUIScope, speed: number) {
	'worklet';
	const java = scope.java as NativeJavaBridge;
	const current = state();

	current.speed = speed;

	for (const view of current.speedViews) {
		java.invoke(view, 'setText', [javaString(speedLabel(speed))]);
	}
}

/**
 * @description Removes the buttons from every pill they were added to.
 * @param scope The plugin's UI scope.
 */
export function removePillControls(scope: NativeUIScope) {
	'worklet';
	const java = scope.java as NativeJavaBridge;
	const current = state();

	for (const view of current.speedViews) {
		const pill = javaReference(java.invoke(view, 'getParent', []));

		if (!pill) continue;

		const download = javaReference(
			java.invoke(pill, 'findViewWithTag', [javaString(DOWNLOAD_TAG)]),
		);

		java.invoke(pill, 'removeView', [view]);
		if (download) java.invoke(pill, 'removeView', [download]);
	}

	current.speedViews = [];
	current.players = [];
}
