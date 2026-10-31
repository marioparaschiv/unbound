import type {
	NativeJavaBridge,
	NativeJavaHooksBridge,
	NativeJavaReference,
	NativeJavaValue,
	NativeUIScope,
} from '@unbound-app/api/native';
import {
	javaInt,
	javaNumber,
	javaReference,
	javaText,
} from '@unbound-plugins/shared/native/android/java-values';

const STATE_KEY = '__unboundRoleColorComposerAndroid';
const CHAT_INPUT = 'com.discord.chat.input.views.DCDChatInput';
const MENTION_SPAN = 'com.discord.chat.input.spans.DCDColorSpan';
const COLOR_FIELD = 'mColor';
const MENTION_BOUNDARY = /[\s,.!?;:]/u;
const HOOKED_METHODS: HookedMethod[] = [
	{ name: 'onSelectionChanged', parameters: ['int', 'int'] },
	{ name: 'onMeasure', parameters: ['int', 'int'] },
];

type HookedMethod = {
	name: string;
	parameters: string[];
};

export type AndroidComposerMentions = {
	names: string[];
	colors: Record<string, number>;
};

type Recolored = {
	span: NativeJavaReference;
	original: number;
};

type ComposerState = {
	java: NativeJavaBridge;
	mentions: AndroidComposerMentions;
	mentionSpan: NativeJavaReference;
	reflectArray: NativeJavaReference;
	recolored: Map<string, Recolored>;
	inputs: Map<string, NativeJavaReference>;
};

type StateHolder = Record<typeof STATE_KEY, ComposerState | undefined>;

type InputEvent = {
	self?: NativeJavaValue;
};

function holder(): StateHolder {
	'worklet';

	return globalThis as unknown as StateHolder;
}

function keyOf(reference: NativeJavaReference): string {
	'worklet';

	return 'value' in reference ? String(reference.value) : '';
}

function matchMention(text: string, at: number, names: string[]): string | undefined {
	'worklet';

	return names.find((name) => {
		if (!text.startsWith(`@${name}`, at)) {
			return false;
		}

		const next = text[at + name.length + 1];

		return !next || MENTION_BOUNDARY.test(next);
	});
}

function spansAt(
	current: ComposerState,
	editable: NativeJavaReference,
	start: number,
	end: number,
): NativeJavaReference[] {
	'worklet';
	const { java } = current;
	const array = javaReference(
		java.invoke(editable, 'getSpans', [javaInt(start), javaInt(end), current.mentionSpan]),
	);
	const length = array
		? (javaNumber(java.invoke(current.reflectArray, 'getLength', [array])) ?? 0)
		: 0;
	const spans: NativeJavaReference[] = [];

	for (let index = 0; index < length && array; index++) {
		const span = javaReference(
			java.invoke(current.reflectArray, 'get', [array, javaInt(index)]),
		);

		if (span && javaNumber(java.invoke(editable, 'getSpanStart', [span])) === start) {
			spans.push(span);
		}
	}

	return spans;
}

function recolor(
	current: ComposerState,
	editable: NativeJavaReference,
	span: NativeJavaReference,
	color: number,
) {
	'worklet';
	const { java } = current;
	const existing = javaNumber(java.getField(span, COLOR_FIELD));

	if (existing === undefined || existing === color) {
		return;
	}

	const key = keyOf(span);

	if (!current.recolored.has(key)) {
		current.recolored.set(key, { span, original: existing });
	}

	java.setField(span, COLOR_FIELD, javaInt(color));
	java.invoke(editable, 'setSpan', [
		span,
		java.invoke(editable, 'getSpanStart', [span]),
		java.invoke(editable, 'getSpanEnd', [span]),
		java.invoke(editable, 'getSpanFlags', [span]),
	]);
}

function paint(current: ComposerState, input: NativeJavaReference) {
	'worklet';
	const { java, mentions } = current;

	if (!mentions.names.length) {
		return;
	}

	const editable = javaReference(java.invoke(input, 'getText', []));
	const text = editable ? javaText(java.invoke(editable, 'toString', [])) : undefined;

	if (!editable || !text?.includes('@')) {
		return;
	}

	current.inputs.set(keyOf(input), input);

	for (let at = text.indexOf('@'); at >= 0; at = text.indexOf('@', at + 1)) {
		const name = matchMention(text, at, mentions.names);
		const color = name ? mentions.colors[name] : undefined;

		if (!name || color === undefined) {
			continue;
		}

		for (const span of spansAt(current, editable, at, at + name.length + 1)) {
			recolor(current, editable, span, color);
		}

		at += name.length;
	}
}

/**
 * @description Recolors the mention spans in Discord's native chat input from hooks that run on the UI thread, in the same pass that changes the text or selection.
 * @param scope The plugin's UI scope.
 * @param mentions The names to color, longest first, with their ARGB colors.
 * @returns Whether the input's mention span class exists.
 */
export function installAndroidComposerHooks(
	scope: NativeUIScope,
	mentions: AndroidComposerMentions,
): boolean {
	'worklet';
	const java = scope.java as NativeJavaBridge;
	const hooks = scope.hooks as NativeJavaHooksBridge;
	const mentionSpan = java.getClass(MENTION_SPAN);
	const reflectArray = java.getClass('java.lang.reflect.Array');

	if (!mentionSpan || !reflectArray) {
		return false;
	}

	const current: ComposerState = {
		java,
		mentions,
		mentionSpan,
		reflectArray,
		recolored: new Map(),
		inputs: new Map(),
	};

	holder()[STATE_KEY] = current;

	for (const method of HOOKED_METHODS) {
		hooks.hook(
			CHAT_INPUT,
			method.name,
			method.parameters,
			{ notify: true },
			(event: InputEvent) => {
				const input = javaReference(event.self);

				if (!input) {
					return;
				}

				try {
					paint(current, input);
				} catch (error) {
					console.error(`[Role Color Everywhere] ${String(error)}`);
				}
			},
		);
	}

	return true;
}

/**
 * @description Replaces the names the input colors, after the channel or its members change.
 * @param mentions The names to color, longest first, with their ARGB colors.
 */
export function setAndroidComposerMentions(mentions: AndroidComposerMentions) {
	'worklet';
	const current = holder()[STATE_KEY];

	if (current) {
		current.mentions = mentions;
	}
}

/**
 * @description Gives every recolored mention span its own color back and redraws the inputs.
 */
export function restoreAndroidComposer() {
	'worklet';
	const current = holder()[STATE_KEY];

	if (!current) {
		return;
	}

	const { java } = current;

	for (const { span, original } of current.recolored.values()) {
		try {
			java.setField(span, COLOR_FIELD, javaInt(original));
		} catch (error) {
			console.error(`[Role Color Everywhere] ${String(error)}`);
		}
	}

	for (const input of current.inputs.values()) {
		try {
			java.invoke(input, 'invalidate', []);
		} catch (error) {
			console.error(`[Role Color Everywhere] ${String(error)}`);
		}
	}

	holder()[STATE_KEY] = undefined;
}

export default {
	installAndroidComposerHooks,
	setAndroidComposerMentions,
	restoreAndroidComposer,
};
