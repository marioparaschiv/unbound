import {
	hideRun,
	loadOverlayImage,
	placeOverlay,
	positionOverlay,
	removeTaggedOverlays,
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
	/** The text views painted, by hash, so stopping can remove their overlays. */
	views: Map<string, NativeObjectHandle>;
	painted: Map<string, string>;
	/** Each text view's overlays and the runs they cover, by the view's hash, to move after a layout pass. */
	placed: Map<string, { start: number; view: NativeObjectHandle }[]>;
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

function paint(current: EmojiState, textView: NativeObjectHandle) {
	'worklet';
	const { objc } = current;

	if (current.updating || !objc.invoke(textView, 'window', [])) return;

	const storage = objc.call(textView, 'textStorage') as NativeObjectHandle | null;
	const font = objc.call(textView, 'font') as NativeObjectHandle | null;
	const text = storage ? objc.call(storage, 'string') : null;

	if (!storage || !font || typeof text !== 'string') return;

	const key = String(objc.call(textView, 'hash'));
	const signature = `${text}\u0000${current.files.size}`;

	if (current.painted.get(key) === signature) {
		const known = current.placed.get(key);

		if (known) {
			for (const overlay of known) {
				positionOverlay(objc, textView, overlay.start, current.side, overlay.view);
			}
		}

		return;
	}

	const side = Math.round(Number(objc.call(font, 'lineHeight')) || 20);
	const tokens = emojiTokens(text, current.known)
		.slice(0, MAX_EMOJI)
		.flatMap((token) => {
			const image = imageFor(current, emojiUrl(token));

			return image ? [{ ...token, image }] : [];
		});

	current.updating = true;

	try {
		removeTaggedOverlays(objc, textView, OVERLAY_TAG);

		for (const token of tokens) hideRun(objc, storage, token.start, token.length, side);

		const placed: { start: number; view: NativeObjectHandle }[] = [];

		for (const token of tokens) {
			const view = placeOverlay(objc, textView, token.start, side, token.image, OVERLAY_TAG);

			if (view) placed.push({ start: token.start, view });
		}

		current.placed.set(key, placed);
		current.side = side;
	} finally {
		current.updating = false;
	}

	current.painted.set(key, signature);
	current.views.set(key, textView);
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
		views: new Map(),
		painted: new Map(),
		placed: new Map(),
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
}

/**
 * @description Sets the custom emoji the user can use in the current channel, by name.
 * @param known The emoji.
 */
export function setComposerEmoji(known: Record<string, CustomEmoji>) {
	'worklet';
	const current = holder()[STATE_KEY];

	if (current) current.known = known;
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

	for (const [url, path] of Object.entries(files)) {
		current.files.set(url, path);
		current.wanted.delete(url);
	}

	return [...current.wanted];
}

/**
 * @description Removes the emoji images it placed.
 */
export function restoreComposerEmoji() {
	'worklet';
	const current = holder()[STATE_KEY];

	if (!current) return;

	for (const view of current.views.values())
		removeTaggedOverlays(current.objc, view, OVERLAY_TAG);

	holder()[STATE_KEY] = undefined;
}
