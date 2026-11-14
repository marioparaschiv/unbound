import {
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

type PillAction = 'speed' | 'download';

type PillState = {
	speed: number;
	speedViews: NativeJavaReference[];
	icon?: number;
};

type BindEvent = { self: unknown };

function state(): PillState {
	'worklet';
	const holder = globalThis as unknown as Record<typeof STATE_KEY, PillState | undefined>;

	return (holder[STATE_KEY] ??= { speed: 1, speedViews: [] });
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
}
