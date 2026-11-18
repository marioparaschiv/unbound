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

type Overlay = { view: NativeObjectHandle; url: string };

type ComposerState = {
	objc: NativeObjCBridge;
	pack: PackId;
	sets: CoverageSets;
	overlays: Map<string, Overlay[]>;
	images: Map<string, NativeObjectHandle>;
	/** Downloaded pack images, by URL, as absolute file paths. */
	files: Map<string, string>;
	/** Pack images the composer needs that are not downloaded yet. */
	wanted: Set<string>;
	updating: boolean;
};

type Holder = Record<typeof STATE_KEY, ComposerState | undefined>;

type BoxedRect = {
	value?: BoxedRect;
	origin?: { x?: number; y?: number };
	size?: { width?: number; height?: number };
};

function holder(): Holder {
	'worklet';

	return globalThis as unknown as Holder;
}

function rectOf(raw: unknown) {
	'worklet';
	const boxed = raw as BoxedRect | null;
	const rect = boxed?.value ?? boxed;

	return {
		x: Number(rect?.origin?.x ?? 0),
		y: Number(rect?.origin?.y ?? 0),
		width: Number(rect?.size?.width ?? 0),
		height: Number(rect?.size?.height ?? 0),
	};
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

	const image = current.objc.call(
		current.objc.getClass('UIImage')!,
		'imageWithContentsOfFile:',
		path,
	) as NativeObjectHandle | null;

	if (image) current.images.set(url, image);

	return image;
}

function clearOverlays(current: ComposerState, key: string) {
	'worklet';
	const placed = current.overlays.get(key);

	if (placed) {
		for (const overlay of placed) current.objc.invoke(overlay.view, 'removeFromSuperview', []);
	}

	current.overlays.delete(key);
}

function overlayAt(
	current: ComposerState,
	textView: NativeObjectHandle,
	index: number,
	url: string,
) {
	'worklet';
	const { objc } = current;
	const layout = objc.call(textView, 'layoutManager') as NativeObjectHandle | null;
	const container = objc.call(textView, 'textContainer') as NativeObjectHandle | null;
	const image = imageFor(current, url);

	if (!layout || !container || !image) return null;

	const glyph = Number(objc.call(layout, 'glyphIndexForCharacterAtIndex:', index));
	const rect = rectOf(
		objc.call(
			layout,
			'boundingRectForGlyphRange:inTextContainer:',
			objc.struct('NSRange', { location: glyph, length: 1 }),
			container,
		),
	);
	const inset = rectOf({ origin: objc.call(textView, 'textContainerInset') as never });

	if (rect.width <= 0 || rect.height <= 0) return null;

	const side = Math.min(rect.width, rect.height);
	const view = objc.create('UIImageView', 'initWithImage:', [image]) as NativeObjectHandle | null;

	if (!view) return null;

	objc.invoke(view, 'setTag:', [OVERLAY_TAG]);
	objc.invoke(view, 'setContentMode:', [1]);
	objc.invoke(view, 'setUserInteractionEnabled:', [false]);
	objc.invoke(view, 'setFrame:', [
		objc.struct('CGRect', {
			origin: {
				x: rect.x + inset.x + (rect.width - side) / 2,
				y: rect.y + inset.y + (rect.height - side) / 2,
			},
			size: { width: side, height: side },
		}),
	]);
	objc.invoke(textView, 'addSubview:', [view]);

	return { view, url };
}

function paint(current: ComposerState, textView: NativeObjectHandle) {
	'worklet';
	const { objc } = current;

	if (current.updating || !objc.invoke(textView, 'window', [])) return;

	const storage = objc.call(textView, 'textStorage') as NativeObjectHandle | null;
	const text = storage ? objc.call(storage, 'string') : null;
	const key = String(objc.call(textView, 'hash'));

	clearOverlays(current, key);

	if (!storage || typeof text !== 'string') return;

	const runs = emojiRuns(text).slice(0, MAX_EMOJI);
	const clear = objc.call(objc.getClass('UIColor')!, 'clearColor') as NativeObjectHandle;
	const overlays: Overlay[] = [];

	current.updating = true;

	try {
		for (const run of runs) {
			const url = packUrl(current.pack, run.surrogates, current.sets);

			if (!url) continue;

			objc.call(
				storage,
				'addAttribute:value:range:',
				'NSColor',
				clear,
				objc.struct('NSRange', { location: run.start, length: run.length }),
			);

			const overlay = overlayAt(current, textView, run.start, url);

			if (overlay) overlays.push(overlay);
		}
	} finally {
		current.updating = false;
	}

	if (overlays.length) current.overlays.set(key, overlays);
}

/**
 * @description Draws the pack's emoji in Discord's native composer as it is typed: each emoji's glyph is made
 * transparent and the pack's image is placed over it, so the text that gets sent stays the same.
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
		overlays: new Map(),
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

	for (const [url, path] of Object.entries(files)) {
		current.files.set(url, path);
		current.wanted.delete(url);
	}

	return [...current.wanted];
}

/**
 * @description Sets the pack the composer draws with.
 * @param pack The pack.
 */
export function setComposerPack(pack: PackId) {
	'worklet';
	const current = holder()[STATE_KEY];

	if (current) current.pack = pack;
}

/**
 * @description Removes every overlay it placed.
 */
export function restoreComposerPack() {
	'worklet';
	const current = holder()[STATE_KEY];

	if (!current) return;

	for (const key of [...current.overlays.keys()]) clearOverlays(current, key);

	holder()[STATE_KEY] = undefined;
}
