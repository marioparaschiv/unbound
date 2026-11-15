import type {
	NativeJavaBridge,
	NativeJavaHooksBridge,
	NativeJavaReference,
	NativeUIScope,
} from '@unbound-app/api/native';
import {
	javaFlag,
	javaFloat,
	javaInt,
	javaNumber,
	javaReference,
} from '@unbound-plugins/shared/native/android/java-values';

import { baseSize, type RememberedSize } from '~/lib/text-size';

const CONTENT = 'com.discord.chat.presentation.message.view.MessageContentView';
const PIXELS = 0;
const STATE_KEY = '__unboundMessageTextSize';
const MAX_TRACKED = 400;

type Tracked = { view: NativeJavaReference; size: RememberedSize };
type State = { scale: number; tracked: Tracked[] };
type SetTextEvent = { self: unknown };

function state(): State {
	'worklet';
	const holder = globalThis as unknown as Record<string, State | undefined>;

	holder[STATE_KEY] ??= { scale: 1, tracked: [] };

	return holder[STATE_KEY];
}

function trackedOf(java: NativeJavaBridge, view: NativeJavaReference): Tracked | undefined {
	'worklet';

	return state().tracked.find((entry) => javaFlag(java.invoke(entry.view, 'equals', [view])));
}

function applyScale(java: NativeJavaBridge, view: NativeJavaReference) {
	'worklet';
	const current = javaNumber(java.invoke(view, 'getTextSize', []));

	if (current === undefined || current <= 0) return;

	const shared = state();
	const tracked = trackedOf(java, view);
	const base = baseSize(current, tracked?.size);
	const applied = base * shared.scale;

	java.invoke(view, 'setTextSize', [javaInt(PIXELS), javaFloat(applied)]);

	if (tracked) {
		tracked.size = { base, applied };

		return;
	}

	shared.tracked.push({ view, size: { base, applied } });

	if (shared.tracked.length > MAX_TRACKED) shared.tracked.shift();
}

/**
 * @description Scales the text of every message Discord binds from now on, by hooking `MessageContentView.setText`.
 * @param scope The plugin's UI scope, which removes the hook on dispose.
 * @param scale The factor, such as 1.15.
 */
export function installMessageTextSize(scope: NativeUIScope, scale: number) {
	'worklet';
	const java = scope.java as NativeJavaBridge;
	const hooks = scope.hooks as NativeJavaHooksBridge;

	state().scale = scale;

	hooks.hook(
		CONTENT,
		'setText',
		['java.lang.CharSequence', 'android.widget.TextView$BufferType'],
		{ notify: 'after' },
		(event: SetTextEvent) => {
			const view = javaReference(event.self as never);

			if (!view) return;

			try {
				applyScale(java, view);
			} catch (error) {
				console.error(
					`[Message Text Size] Failed to scale a message's text: ${String(error)}`,
				);
			}
		},
	);
}

/**
 * @description Changes the factor and rescales the messages already on screen.
 * @param scope The plugin's UI scope.
 * @param scale The new factor.
 */
export function setMessageTextScale(scope: NativeUIScope, scale: number) {
	'worklet';
	const java = scope.java as NativeJavaBridge;

	state().scale = scale;

	for (const { view } of [...state().tracked]) applyScale(java, view);
}

/**
 * @description Gives every message the plugin scaled its own size back, and forgets them.
 * @param scope The plugin's UI scope.
 */
export function restoreMessageTextSize(scope: NativeUIScope) {
	'worklet';
	const java = scope.java as NativeJavaBridge;

	for (const { view, size } of state().tracked) {
		const current = javaNumber(java.invoke(view, 'getTextSize', []));

		if (current !== undefined && Math.abs(current - size.applied) < 0.01) {
			java.invoke(view, 'setTextSize', [javaInt(PIXELS), javaFloat(size.base)]);
		}
	}

	state().tracked = [];
}
