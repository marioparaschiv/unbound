import {
	hideRun,
	loadOverlayImage,
	placeOverlay,
	removeTaggedOverlays,
	repositionTaggedOverlays,
	showRun,
	visibleTextViews,
} from '@unbound-plugins/shared/composer/ios/glyph-overlays';
import { reportWorkletError } from '@unbound-plugins/shared/native/report-worklet-error';
import type { NativeObjCBridge, NativeObjectHandle, NativeUIScope } from '@unbound-app/api/native';

import { emojiTokens, emojiUrl, type CustomEmoji } from '~/lib/custom-emoji';

const STATE_KEY = '__unboundLiveMarkdownEmoji';
const COMPOSER_CLASS = 'DCDChatInputComponentView';
const SELECTORS = ['textViewDidChange:', 'setText:', 'setAttributedText:', 'layoutSubviews'];
const OVERLAY_TAG = 0x554c4d45;
const MAX_EMOJI = 48;

type EmojiState = {
	objc: NativeObjCBridge;
	known: Record<string, CustomEmoji>;
	files: Map<string, string>;
	wanted: Set<string>;
	images: Map<string, NativeObjectHandle>;
	painted: Map<string, string>;
	/** Each text view's overlays and the runs they cover, by the view's hash, to move after a layout pass. */
	placed: Map<string, number[]>;
	hidden: Map<string, { start: number; length: number }[]>;
	side: number;
	updating: boolean;
};

type Holder = Record<typeof STATE_KEY, EmojiState | undefined>;

function holder(): Holder {
	'worklet';

	return globalThis as unknown as Holder;
}

function imageFor(current: EmojiState, url: string): NativeObjectHandle | null {
	'worklet';
	const cached = current.images.get(url);

	if (cached) return cached;

	const path = current.files.get(url);

	if (!path) {
		current.wanted.add(url);

		return null;
	}

	const image = loadOverlayImage(current.objc, path);

	if (image) current.images.set(url, image);

	return image;
}

function attributeAt(
	objc: NativeObjCBridge,
	storage: NativeObjectHandle,
	name: string,
	index: number,
): NativeObjectHandle | null {
	'worklet';

	return objc.call(
		storage,
		'attribute:atIndex:effectiveRange:',
		name,
		index,
		null,
	) as NativeObjectHandle | null;
}

function isClear(objc: NativeObjCBridge, color: NativeObjectHandle | null): boolean {
	'worklet';
	const description = color ? objc.call(color, 'description') : null;
	const alpha =
		typeof description === 'string' ? Number(description.trim().split(/\s+/).pop()) : 1;

	return alpha === 0;
}

function looksHidden(objc: NativeObjCBridge, storage: NativeObjectHandle, index: number): boolean {
	'worklet';
	const font = attributeAt(objc, storage, 'NSFont', index);
	const kern = attributeAt(objc, storage, 'NSKern', index);

	return (
		isClear(objc, attributeAt(objc, storage, 'NSColor', index)) ||
		(kern !== null && kern !== undefined) ||
		Boolean(font && Number(objc.call(font, 'pointSize')) < 1)
	);
}

function stillHidden(
	objc: NativeObjCBridge,
	storage: NativeObjectHandle,
	runs: { start: number; length: number }[],
): boolean {
	'worklet';

	return runs.every(({ start, length }) => {
		const color = attributeAt(objc, storage, 'NSColor', start);
		const font = attributeAt(objc, storage, 'NSFont', start);
		const kern = attributeAt(objc, storage, 'NSKern', start + length - 1);

		return (
			isClear(objc, color) &&
			Boolean(font) &&
			Number(objc.call(font!, 'pointSize')) < 1 &&
			kern !== null &&
			kern !== undefined
		);
	});
}

function restoreStrays(
	objc: NativeObjCBridge,
	textView: NativeObjectHandle,
	storage: NativeObjectHandle,
	length: number,
	runs: { start: number; length: number }[],
) {
	'worklet';
	const inRun = (index: number) =>
		runs.some((run) => index >= run.start && index < run.start + run.length);
	let strayStart = -1;

	for (let index = 0; index <= length; index++) {
		const stray = index < length && !inRun(index) && looksHidden(objc, storage, index);

		if (stray && strayStart < 0) strayStart = index;

		if (!stray && strayStart >= 0) {
			showRun(objc, textView, storage, strayStart, index - strayStart);
			strayStart = -1;
		}
	}
}

function resetTyping(objc: NativeObjCBridge, textView: NativeObjectHandle) {
	'worklet';
	const typing = objc.call(textView, 'typingAttributes') as NativeObjectHandle | null;
	const font = objc.call(textView, 'font');
	const color = objc.call(textView, 'textColor');

	if (!typing) return;

	const attributes = objc.call(typing, 'mutableCopy') as NativeObjectHandle;

	if (font) objc.call(attributes, 'setObject:forKey:', font, 'NSFont');
	if (color) objc.call(attributes, 'setObject:forKey:', color, 'NSColor');
	objc.call(attributes, 'removeObjectForKey:', 'NSKern');
	objc.call(textView, 'setTypingAttributes:', attributes);
}

function paint(current: EmojiState, textView: NativeObjectHandle) {
	'worklet';
	const { objc } = current;

	if (current.updating || !objc.invoke(textView, 'window', [])) return;

	const storage = objc.call(textView, 'textStorage') as NativeObjectHandle | null;
	const font = objc.call(textView, 'font') as NativeObjectHandle | null;
	const text = storage ? objc.call(storage, 'string') : null;

	if (!storage || !font || typeof text !== 'string') return;

	const key = String(objc.call(textView, 'hash'));
	const signature = `${text}\u0000${current.files.size}\u0000${Object.keys(current.known).length}`;

	if (
		current.painted.get(key) === signature &&
		stillHidden(objc, storage, current.hidden.get(key) ?? [])
	) {
		const starts = current.placed.get(key);

		if (starts) repositionTaggedOverlays(objc, textView, OVERLAY_TAG, starts, current.side);

		return;
	}

	const side = Math.round(Number(objc.call(font, 'lineHeight')) || 20);
	const found = emojiTokens(text, current.known).slice(0, MAX_EMOJI);
	const tokens = found.flatMap((token) => {
		const image = imageFor(current, emojiUrl(token));

		return image ? [{ ...token, image }] : [];
	});

	current.updating = true;

	try {
		removeTaggedOverlays(objc, textView, OVERLAY_TAG);

		restoreStrays(objc, textView, storage, text.length, tokens);

		for (const token of found) showRun(objc, textView, storage, token.start, token.length);

		for (const token of tokens) hideRun(objc, storage, token.start, token.length, side);

		const placed: number[] = [];

		for (const token of tokens) {
			const view = placeOverlay(objc, textView, token.start, side, token.image, OVERLAY_TAG);

			if (view) placed.push(token.start);
		}

		current.placed.set(key, placed);
		current.hidden.set(
			key,
			tokens.map(({ start, length }) => ({ start, length })),
		);
		current.side = side;
		resetTyping(objc, textView);
	} finally {
		current.updating = false;
	}

	current.painted.set(key, signature);
}

function clearComposer(objc: NativeObjCBridge, textView: NativeObjectHandle, current: EmojiState) {
	'worklet';
	const storage = objc.call(textView, 'textStorage') as NativeObjectHandle | null;
	const text = storage ? objc.call(storage, 'string') : null;

	removeTaggedOverlays(objc, textView, OVERLAY_TAG);

	if (!storage || typeof text !== 'string') return;

	for (const token of emojiTokens(text, current.known))
		showRun(objc, textView, storage, token.start, token.length);
}

function repaintAll(current: EmojiState) {
	'worklet';

	try {
		for (const composer of visibleTextViews(current.objc, COMPOSER_CLASS))
			paint(current, composer);
	} catch (error) {
		reportWorkletError('Live Markdown', error);
	}
}

/**
 * @description Draws custom emoji in Discord's native composer as their images, animated when they are, from hooks
 * that run on the UI thread after each text change. Each emoji's text shrinks to one emoji's width and an image view
 * sits over it, so the text that gets sent stays the same.
 * @param scope The plugin's UI scope, which removes the hooks on dispose.
 */
export function installComposerEmoji(scope: NativeUIScope) {
	'worklet';
	const objc = scope.objc as NativeObjCBridge;
	const current: EmojiState = {
		objc,
		known: {},
		files: new Map(),
		wanted: new Set(),
		images: new Map(),
		painted: new Map(),
		placed: new Map(),
		hidden: new Map(),
		side: 20,
		updating: false,
	};

	holder()[STATE_KEY] = current;

	for (const selector of SELECTORS) {
		objc.hook(COMPOSER_CLASS, selector, {
			after: ({ self }) => {
				try {
					paint(current, self);
				} catch (error) {
					reportWorkletError('Live Markdown', error);
				}
			},
		});
	}

	repaintAll(current);
}

/**
 * @description Sets the custom emoji the user can use in the current channel, by name.
 * @param known The emoji.
 */
export function setComposerEmoji(known: Record<string, CustomEmoji>) {
	'worklet';
	const current = holder()[STATE_KEY];

	if (!current) return;

	current.known = known;
	repaintAll(current);
}

/**
 * @description Hands over the images JS downloaded, and returns the ones the composer still needs.
 * @param files Downloaded images, URL to absolute path.
 * @returns The URLs still wanted.
 */
export function takeEmojiImages(files: Record<string, string>): string[] {
	'worklet';
	const current = holder()[STATE_KEY];

	if (!current) return [];

	const arrived = Object.keys(files).some((url) => !current.files.has(url));

	for (const [url, path] of Object.entries(files)) {
		current.files.set(url, path);
		current.wanted.delete(url);
	}

	if (arrived) repaintAll(current);

	return [...current.wanted];
}

/**
 * @description Removes the emoji images it placed from the composers on screen and shows their text again.
 */
export function restoreComposerEmoji() {
	'worklet';
	const current = holder()[STATE_KEY];

	if (!current) return;

	holder()[STATE_KEY] = undefined;

	try {
		for (const composer of visibleTextViews(current.objc, COMPOSER_CLASS))
			clearComposer(current.objc, composer, current);
	} catch (error) {
		reportWorkletError('Live Markdown', error);
	}
}
