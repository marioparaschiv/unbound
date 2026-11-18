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

import { coverageSets, type Coverage, type CoverageSets } from '~/lib/coverage-sets';
import { packUrl, type PackId } from '~/lib/packs';
import { emojiRuns } from '~/lib/emoji-runs';

const STATE_KEY = '__unboundEmojiPacksComposer';
const COMPOSER_CLASS = 'DCDChatInputComponentView';
const SELECTORS = ['textViewDidChange:', 'setText:', 'setAttributedText:', 'layoutSubviews'];
const OVERLAY_TAG = 0x55454d4a;
const MAX_EMOJI = 64;

type ComposerState = {
	objc: NativeObjCBridge;
	pack: PackId;
	sets: CoverageSets;
	painted: Map<string, string>;
	/** Each text view's overlays and the runs they cover, by the view's hash, to move after a layout pass. */
	placed: Map<string, number[]>;
	side: number;
	images: Map<string, NativeObjectHandle>;
	/** Downloaded pack images, by URL, as absolute file paths. */
	files: Map<string, string>;
	/** Pack images the composer needs that are not downloaded yet. */
	wanted: Set<string>;
	updating: boolean;
};

type Holder = Record<typeof STATE_KEY, ComposerState | undefined>;

function holder(): Holder {
	'worklet';

	return globalThis as unknown as Holder;
}

function imageFor(current: ComposerState, url: string): NativeObjectHandle | null {
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

function paint(current: ComposerState, textView: NativeObjectHandle) {
	'worklet';
	const { objc } = current;

	if (current.updating || !objc.invoke(textView, 'window', [])) return;

	const storage = objc.call(textView, 'textStorage') as NativeObjectHandle | null;
	const font = objc.call(textView, 'font') as NativeObjectHandle | null;
	const text = storage ? objc.call(storage, 'string') : null;

	if (!storage || !font || typeof text !== 'string') return;

	const key = String(objc.call(textView, 'hash'));
	const signature = `${current.pack}\u0000${text}\u0000${current.files.size}`;

	if (current.painted.get(key) === signature) {
		const starts = current.placed.get(key);

		if (starts) repositionTaggedOverlays(objc, textView, OVERLAY_TAG, starts, current.side);

		return;
	}

	const side = Math.round(Number(objc.call(font, 'lineHeight')) || 20);
	const emoji = emojiRuns(text).slice(0, MAX_EMOJI);
	const runs = emoji.flatMap((run) => {
		const url = packUrl(current.pack, run.surrogates, current.sets);
		const image = url ? imageFor(current, url) : null;

		return image ? [{ ...run, image }] : [];
	});

	current.updating = true;

	try {
		removeTaggedOverlays(objc, textView, OVERLAY_TAG);

		for (const run of emoji) showRun(objc, textView, storage, run.start, run.length);

		for (const run of runs) hideRun(objc, storage, run.start, run.length, side, run.length);

		const placed: number[] = [];

		for (const run of runs) {
			const view = placeOverlay(objc, textView, run.start, side, run.image, OVERLAY_TAG);

			if (view) placed.push(run.start);
		}

		current.placed.set(key, placed);
		current.side = side;
	} finally {
		current.updating = false;
	}

	current.painted.set(key, signature);
}

function clearComposer(objc: NativeObjCBridge, textView: NativeObjectHandle) {
	'worklet';
	const storage = objc.call(textView, 'textStorage') as NativeObjectHandle | null;
	const text = storage ? objc.call(storage, 'string') : null;

	removeTaggedOverlays(objc, textView, OVERLAY_TAG);

	if (!storage || typeof text !== 'string') return;

	for (const run of emojiRuns(text)) showRun(objc, textView, storage, run.start, run.length);
}

function repaintAll(current: ComposerState) {
	'worklet';

	try {
		for (const composer of visibleTextViews(current.objc, COMPOSER_CLASS))
			paint(current, composer);
	} catch (error) {
		reportWorkletError('Emoji Packs', error);
	}
}

/**
 * @description Draws the pack's emoji in Discord's native composer as it is typed: each emoji's glyph shrinks to
 * nothing, keeping its width, and the pack's image is placed over it, so the text that gets sent stays the same.
 * @param scope The plugin's UI scope, which removes the hooks on dispose.
 * @param pack The pack to start with.
 * @param coverage Which emoji each pack has.
 */
export function installComposerPack(scope: NativeUIScope, pack: PackId, coverage: Coverage) {
	'worklet';
	const objc = scope.objc as NativeObjCBridge;
	const current: ComposerState = {
		objc,
		pack,
		sets: coverageSets(coverage),
		painted: new Map(),
		placed: new Map(),
		side: 20,
		images: new Map(),
		files: new Map(),
		wanted: new Set(),
		updating: false,
	};

	holder()[STATE_KEY] = current;

	for (const selector of SELECTORS) {
		objc.hook(COMPOSER_CLASS, selector, {
			after: ({ self }) => {
				try {
					paint(current, self);
				} catch (error) {
					reportWorkletError('Emoji Packs', error);
				}
			},
		});
	}

	try {
		for (const composer of visibleTextViews(objc, COMPOSER_CLASS)) paint(current, composer);
	} catch (error) {
		reportWorkletError('Emoji Packs', error);
	}
}

/**
 * @description Hands over the images JS downloaded, and returns the ones the composer still needs.
 * @param files Downloaded images, URL to absolute path.
 * @returns The URLs still wanted.
 */
export function takeComposerImages(files: Record<string, string>): string[] {
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
 * @description Sets the pack the composer draws with.
 * @param pack The pack.
 */
export function setComposerPack(pack: PackId) {
	'worklet';
	const current = holder()[STATE_KEY];

	if (!current) return;

	current.pack = pack;
	repaintAll(current);
}

/**
 * @description Stops drawing, removes the overlays from the composers on screen and shows their emoji again.
 */
export function restoreComposerPack() {
	'worklet';
	const current = holder()[STATE_KEY];

	if (!current) return;

	holder()[STATE_KEY] = undefined;

	try {
		for (const composer of visibleTextViews(current.objc, COMPOSER_CLASS))
			clearComposer(current.objc, composer);
	} catch (error) {
		reportWorkletError('Emoji Packs', error);
	}
}
