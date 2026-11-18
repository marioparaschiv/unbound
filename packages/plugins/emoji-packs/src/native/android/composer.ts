import {
	javaInt,
	javaNumber,
	javaReference,
	javaString,
	javaText,
} from '@unbound-plugins/shared/native/android/java-values';
import { reportWorkletError } from '@unbound-plugins/shared/native/report-worklet-error';
import type {
	NativeJavaBridge,
	NativeJavaHooksBridge,
	NativeJavaReference,
	NativeJavaValue,
	NativeUIScope,
} from '@unbound-app/api/native';

import { coverageSets, type Coverage, type CoverageSets } from '~/lib/coverage-sets';
import { packUrl, type PackId } from '~/lib/packs';
import { emojiRuns } from '~/lib/emoji-runs';

const STATE_KEY = '__unboundEmojiPacksComposerAndroid';
const CHAT_INPUT = 'com.discord.chat.input.views.DCDChatInput';
const HOOKED_METHODS = [
	{ name: 'onSelectionChanged', parameters: ['int', 'int'] },
	{ name: 'onMeasure', parameters: ['int', 'int'] },
];
const IMAGE_SPAN = 'android.text.style.ImageSpan';
const SPAN_EXCLUSIVE_EXCLUSIVE = 33;
const ALIGN_CENTER = 2;
const MAX_EMOJI = 64;

type InputEvent = { self?: NativeJavaValue };

type ComposerState = {
	java: NativeJavaBridge;
	pack: PackId;
	sets: CoverageSets;
	drawables: Map<string, NativeJavaReference>;
	files: Map<string, string>;
	wanted: Set<string>;
	painted: Map<string, string>;
	updating: boolean;
};

type Holder = Record<typeof STATE_KEY, ComposerState | undefined>;

function holder(): Holder {
	'worklet';

	return globalThis as unknown as Holder;
}

function drawableFor(
	current: ComposerState,
	input: NativeJavaReference,
	url: string,
	size: number,
) {
	'worklet';
	const key = `${url}@${size}`;
	const cached = current.drawables.get(key);

	if (cached) return cached;

	const path = current.files.get(url);

	if (!path) {
		current.wanted.add(url);

		return null;
	}

	const { java } = current;
	const resources = javaReference(java.invoke(input, 'getResources', []));
	const bitmap = javaReference(
		java.invoke(java.getClass('android.graphics.BitmapFactory'), 'decodeFile', [
			javaString(path),
		]),
	);

	if (!resources || !bitmap) return null;

	const drawable = java.construct('android.graphics.drawable.BitmapDrawable', [
		resources,
		bitmap,
	]);

	java.invoke(drawable, 'setBounds', [javaInt(0), javaInt(0), javaInt(size), javaInt(size)]);
	current.drawables.set(key, drawable);

	return drawable;
}

function removeOwnSpans(current: ComposerState, editable: NativeJavaReference, length: number) {
	'worklet';
	const { java } = current;
	const array = javaReference(
		java.invoke(editable, 'getSpans', [javaInt(0), javaInt(length), java.getClass(IMAGE_SPAN)]),
	);
	const reflect = java.getClass('java.lang.reflect.Array');
	const count = array ? (javaNumber(java.invoke(reflect, 'getLength', [array])) ?? 0) : 0;

	for (let index = 0; index < count && array; index++) {
		const span = javaReference(java.invoke(reflect, 'get', [array, javaInt(index)]));
		const source = span ? javaText(java.invoke(span, 'getSource', [])) : undefined;

		if (span && source === STATE_KEY) java.invoke(editable, 'removeSpan', [span]);
	}
}

function paint(current: ComposerState, input: NativeJavaReference) {
	'worklet';
	const { java } = current;

	if (current.updating) return;

	const editable = javaReference(java.invoke(input, 'getText', []));
	const text = editable ? javaText(java.invoke(editable, 'toString', [])) : undefined;

	if (!editable || text === undefined) return;

	const key = String(javaNumber(java.invoke(input, 'hashCode', [])));
	const signature = `${current.pack}\u0000${text}\u0000${current.files.size}`;

	if (current.painted.get(key) === signature) return;

	const size = Math.round(javaNumber(java.invoke(input, 'getTextSize', [])) ?? 40) + 4;

	current.updating = true;

	try {
		removeOwnSpans(current, editable, text.length);

		for (const run of emojiRuns(text).slice(0, MAX_EMOJI)) {
			const url = packUrl(current.pack, run.surrogates, current.sets);
			const drawable = url ? drawableFor(current, input, url, size) : null;

			if (!drawable) continue;

			const span = java.construct(IMAGE_SPAN, [
				drawable,
				javaString(STATE_KEY),
				javaInt(ALIGN_CENTER),
			]);

			java.invoke(editable, 'setSpan', [
				span,
				javaInt(run.start),
				javaInt(run.start + run.length),
				javaInt(SPAN_EXCLUSIVE_EXCLUSIVE),
			]);
		}
	} finally {
		current.updating = false;
	}

	current.painted.set(key, signature);
}

/**
 * @description Draws the pack's emoji in Discord's native chat input on Android with image spans over each emoji, from
 * hooks that run on the UI thread as the text changes; the text that gets sent stays the same.
 * @param scope The plugin's UI scope, which removes the hooks on dispose.
 * @param pack The pack to start with.
 * @param coverage Which emoji each pack has.
 */
export function installComposerPack(scope: NativeUIScope, pack: PackId, coverage: Coverage) {
	'worklet';
	const java = scope.java as NativeJavaBridge;
	const hooks = scope.hooks as NativeJavaHooksBridge;
	const current: ComposerState = {
		java,
		pack,
		sets: coverageSets(coverage),
		drawables: new Map(),
		files: new Map(),
		wanted: new Set(),
		painted: new Map(),
		updating: false,
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

				if (!input) return;

				try {
					paint(current, input);
				} catch (error) {
					reportWorkletError('Emoji Packs', error);
				}
			},
		);
	}
}

/**
 * @description Hands over the images JS downloaded, and returns the ones the input still needs.
 * @param files Downloaded images, URL to absolute path.
 * @returns The URLs still wanted.
 */
export function takeComposerImages(files: Record<string, string>): string[] {
	'worklet';
	const current = holder()[STATE_KEY];

	if (!current) return [];

	for (const [url, path] of Object.entries(files)) {
		current.files.set(url, path);
		current.wanted.delete(url);
	}

	return [...current.wanted];
}

/**
 * @description Sets the pack the input draws with.
 * @param pack The pack.
 */
export function setComposerPack(pack: PackId) {
	'worklet';
	const current = holder()[STATE_KEY];

	if (current) current.pack = pack;
}

/**
 * @description Forgets the input's images; Discord redraws the text without them on its next change.
 */
export function restoreComposerPack() {
	'worklet';
	holder()[STATE_KEY] = undefined;
}
