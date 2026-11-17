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
	javaString,
	javaText,
} from '@unbound-plugins/shared/native/android/java-values';

import { scriptRuns, type ScriptId } from '~/lib/scripts';

const CONTENT = 'com.discord.chat.presentation.message.view.MessageContentView';
const SPANNABLE = 'android.text.Spannable';
const SPAN_EXCLUSIVE_EXCLUSIVE = 33;
const STATE_KEY = '__unboundFontFallback';
const MAX_TRACKED = 400;

/** Each script's font file, by absolute path. */
export type ScriptFonts = Partial<Record<ScriptId, string>>;

type Tracked = { view: NativeJavaReference; spans: NativeJavaReference[] };
type State = {
	faces: Map<ScriptId, NativeJavaReference>;
	tracked: Tracked[];
	updating: boolean;
};
type SetTextEvent = { self: unknown };

function state(): State {
	'worklet';
	const holder = globalThis as unknown as Record<string, State | undefined>;

	holder[STATE_KEY] ??= { faces: new Map(), tracked: [], updating: false };

	return holder[STATE_KEY];
}

function loadFaces(java: NativeJavaBridge, fonts: ScriptFonts) {
	'worklet';
	const faces = new Map<ScriptId, NativeJavaReference>();
	const Typeface = java.getClass('android.graphics.Typeface');

	for (const [script, path] of Object.entries(fonts) as [ScriptId, string][]) {
		const face = javaReference(java.invoke(Typeface, 'createFromFile', [javaString(path)]));

		if (face) faces.set(script, face);
	}

	state().faces = faces;
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

	const shared = state();

	shared.updating = true;

	try {
		java.invoke(view, 'setText', [java.construct('android.text.SpannableString', [text])]);
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
	const runs = content ? scriptRuns(content, new Set(shared.faces.keys())) : [];

	if (!runs.length) return;

	const text = spannableText(java, view);

	if (!text) return;

	const spans = runs.map(({ script, start, length }) => {
		const span = java.construct('android.text.style.TypefaceSpan', [shared.faces.get(script)!]);

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
 * @description Draws each script's runs in message text with its font, by hooking `MessageContentView.setText`.
 * @param scope The plugin's UI scope, which removes the hook on dispose.
 * @param fonts Each script's font file.
 */
export function installFontFallback(scope: NativeUIScope, fonts: ScriptFonts) {
	'worklet';
	const java = scope.java as NativeJavaBridge;
	const hooks = scope.hooks as NativeJavaHooksBridge;

	loadFaces(java, fonts);

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
				console.error(`[Font Fallback] Failed to set a message's fonts: ${String(error)}`);
			}
		},
	);
}

/**
 * @description Changes the fonts and redraws the messages already on screen.
 * @param scope The plugin's UI scope.
 * @param fonts Each script's font file.
 */
export function setFontFallback(scope: NativeUIScope, fonts: ScriptFonts) {
	'worklet';
	const java = scope.java as NativeJavaBridge;

	loadFaces(java, fonts);

	for (const { view } of [...state().tracked]) paint(java, view);
}

/**
 * @description Removes the fonts it set, and forgets the messages.
 * @param scope The plugin's UI scope.
 */
export function restoreFontFallback(scope: NativeUIScope) {
	'worklet';
	const java = scope.java as NativeJavaBridge;

	for (const tracked of state().tracked) {
		try {
			clear(java, tracked.view, tracked);
		} catch (error) {
			console.error(`[Font Fallback] Failed to restore a message: ${String(error)}`);
		}
	}

	state().tracked = [];
}
