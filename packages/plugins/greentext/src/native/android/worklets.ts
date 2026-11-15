import type {
	NativeJavaBridge,
	NativeJavaHooksBridge,
	NativeJavaReference,
	NativeUIScope,
} from '@unbound-app/api/native';
import {
	javaFlag,
	javaInt,
	javaReference,
	javaText,
} from '@unbound-plugins/shared/native/android/java-values';

import { argbOf, greenRanges } from '~/lib/greentext';

const CONTENT = 'com.discord.chat.presentation.message.view.MessageContentView';
const SPANNABLE = 'android.text.Spannable';
const SPAN_EXCLUSIVE_EXCLUSIVE = 33;
const STATE_KEY = '__unboundGreentext';
const MAX_TRACKED = 400;

type Tracked = { view: NativeJavaReference; spans: NativeJavaReference[] };
type State = { color: number; tracked: Tracked[]; updating: boolean };
type SetTextEvent = { self: unknown };

function state(): State {
	'worklet';
	const holder = globalThis as unknown as Record<string, State | undefined>;

	holder[STATE_KEY] ??= { color: argbOf('#789922'), tracked: [], updating: false };

	return holder[STATE_KEY];
}

function trackedOf(java: NativeJavaBridge, view: NativeJavaReference): Tracked | undefined {
	'worklet';

	return state().tracked.find((entry) => javaFlag(java.invoke(entry.view, 'equals', [view])));
}

function clear(java: NativeJavaBridge, view: NativeJavaReference, tracked: Tracked) {
	'worklet';
	const text = javaReference(java.invoke(view, 'getText', []));

	if (text && javaFlag(java.invoke(java.getClass(SPANNABLE), 'isInstance', [text]))) {
		for (const span of tracked.spans) java.invoke(text, 'removeSpan', [span]);
	}

	tracked.spans = [];
}

function spannableText(java: NativeJavaBridge, view: NativeJavaReference) {
	'worklet';
	const text = javaReference(java.invoke(view, 'getText', []));

	if (!text) return null;

	if (javaFlag(java.invoke(java.getClass(SPANNABLE), 'isInstance', [text]))) return text;

	const copy = java.construct('android.text.SpannableString', [text]);
	const shared = state();

	shared.updating = true;

	try {
		java.invoke(view, 'setText', [copy]);
	} finally {
		shared.updating = false;
	}

	return javaReference(java.invoke(view, 'getText', []));
}

function paint(java: NativeJavaBridge, view: NativeJavaReference) {
	'worklet';
	const shared = state();
	const existing = trackedOf(java, view);

	if (existing) clear(java, view, existing);

	const current = javaReference(java.invoke(view, 'getText', []));
	const content = current ? javaText(java.invoke(current, 'toString', [])) : undefined;
	const ranges = content?.includes('>') ? greenRanges(content) : [];

	if (!ranges.length) return;

	const text = spannableText(java, view);

	if (!text) return;

	const spans = ranges.map(({ start, length }) => {
		const span = java.construct('android.text.style.ForegroundColorSpan', [
			javaInt(shared.color),
		]);

		java.invoke(text, 'setSpan', [
			span,
			javaInt(start),
			javaInt(start + length),
			javaInt(SPAN_EXCLUSIVE_EXCLUSIVE),
		]);

		return span;
	});

	if (existing) {
		existing.spans = spans;

		return;
	}

	shared.tracked.push({ view, spans });

	if (shared.tracked.length > MAX_TRACKED) shared.tracked.shift();
}

/**
 * @description Colors the lines of every message Discord binds from now on that start with `>`, by hooking `MessageContentView.setText`.
 * @param scope The plugin's UI scope, which removes the hook on dispose.
 * @param hex The color, as `#rrggbb`.
 */
export function installGreentext(scope: NativeUIScope, hex: string) {
	'worklet';
	const java = scope.java as NativeJavaBridge;
	const hooks = scope.hooks as NativeJavaHooksBridge;

	state().color = argbOf(hex);

	hooks.hook(
		CONTENT,
		'setText',
		['java.lang.CharSequence', 'android.widget.TextView$BufferType'],
		{ notify: 'after' },
		(event: SetTextEvent) => {
			const view = javaReference(event.self as never);

			if (!view || state().updating) return;

			try {
				paint(java, view);
			} catch (error) {
				console.error(`[Greentext] Failed to color a message: ${String(error)}`);
			}
		},
	);
}

/**
 * @description Changes the color and recolors the messages already on screen.
 * @param scope The plugin's UI scope.
 * @param hex The new color, as `#rrggbb`.
 */
export function setGreentextColor(scope: NativeUIScope, hex: string) {
	'worklet';
	const java = scope.java as NativeJavaBridge;

	state().color = argbOf(hex);

	for (const { view } of [...state().tracked]) paint(java, view);
}

/**
 * @description Removes the colors it added, and forgets the messages.
 * @param scope The plugin's UI scope.
 */
export function restoreGreentext(scope: NativeUIScope) {
	'worklet';
	const java = scope.java as NativeJavaBridge;

	for (const tracked of state().tracked) {
		try {
			clear(java, tracked.view, tracked);
		} catch (error) {
			console.error(`[Greentext] Failed to restore a message: ${String(error)}`);
		}
	}

	state().tracked = [];
}

export default { installGreentext, setGreentextColor, restoreGreentext };
