import { reportWorkletError } from '@unbound-plugins/shared/native/report-worklet-error';
import type { NativeObjCBridge, NativeObjectHandle, NativeUIScope } from '@unbound-app/api/native';

const STATE_KEY = '__unboundNightImagesEmbeds';
const CELL_CLASS = 'DCDMessageTableViewCell';
const EMBED_CLASS = 'DiscordChat.AttachmentView';
const IMAGE_CLASS = 'DiscordChatComponentsSwift.ThumbnailView';
const MAX_DEPTH = 10;

/** The embeds to dim: their messages and the opacity they draw with. */
export type EmbedDimming = { messageIds: string[]; opacity: number };

type EmbedState = {
	objc: NativeObjCBridge;
	dimmed: Set<string>;
	opacity: number;
	touched: Map<string, NativeObjectHandle>;
};

type StateHolder = Record<typeof STATE_KEY, EmbedState | undefined>;

function holder(): StateHolder {
	'worklet';

	return globalThis as unknown as StateHolder;
}

function messageIdOf(objc: NativeObjCBridge, cell: NativeObjectHandle): string | undefined {
	'worklet';
	const viewModel = objc.getIvar(cell, 'viewModel') as NativeObjectHandle | null;
	const message = viewModel
		? (objc.call(viewModel, 'message') as NativeObjectHandle | null)
		: null;
	const identifier = message ? objc.call(message, 'id') : null;

	if (typeof identifier === 'string') return identifier;

	if (identifier && typeof identifier === 'object') {
		const description = objc.call(identifier as NativeObjectHandle, 'description');

		return typeof description === 'string' ? description : undefined;
	}

	return undefined;
}

function subviewsOf(objc: NativeObjCBridge, view: NativeObjectHandle): NativeObjectHandle[] {
	'worklet';
	const subviews = objc.invoke(view, 'subviews', []);

	return Array.isArray(subviews) ? (subviews as NativeObjectHandle[]) : [];
}

function findEmbedImages(
	objc: NativeObjCBridge,
	view: NativeObjectHandle,
	depth: number,
	insideEmbed: boolean,
	found: NativeObjectHandle[],
) {
	'worklet';
	if (depth > MAX_DEPTH) return;

	const embedClass = objc.getClass(EMBED_CLASS);
	const imageClass = objc.getClass(IMAGE_CLASS);
	const inside =
		insideEmbed || Boolean(embedClass && objc.call(view, 'isKindOfClass:', embedClass));

	if (inside && imageClass && objc.call(view, 'isKindOfClass:', imageClass)) {
		found.push(view);

		return;
	}

	for (const subview of subviewsOf(objc, view)) {
		findEmbedImages(objc, subview, depth + 1, inside, found);
	}
}

function applyTo(current: EmbedState, cell: NativeObjectHandle) {
	'worklet';
	const { objc } = current;
	const cellKey = String(objc.call(cell, 'hash'));
	const messageId = messageIdOf(objc, cell);
	const dim = Boolean(messageId && current.dimmed.has(messageId));

	if (!dim && !current.touched.has(cellKey)) return;

	const images: NativeObjectHandle[] = [];

	findEmbedImages(objc, cell, 0, false, images);

	for (const image of images) {
		objc.invoke(image, 'setAlpha:', [dim ? current.opacity : 1]);
	}

	if (dim && images.length) {
		current.touched.set(cellKey, cell);
	} else {
		current.touched.delete(cellKey);
	}
}

/**
 * @description Dims bright embed images from a hook on the UI thread that runs as each message cell lays out, so a
 * reused cell never shows another message's dimming.
 * @param scope The plugin's UI scope.
 * @param dimming The embeds to dim.
 */
export function installEmbedDimming(scope: NativeUIScope, dimming: EmbedDimming) {
	'worklet';
	const objc = scope.objc as NativeObjCBridge;
	const current: EmbedState = {
		objc,
		dimmed: new Set(dimming.messageIds),
		opacity: dimming.opacity,
		touched: new Map(),
	};

	holder()[STATE_KEY] = current;

	if (!objc.getClass(CELL_CLASS) || !objc.getClass(EMBED_CLASS) || !objc.getClass(IMAGE_CLASS)) {
		console.warn('[Night Images] Embed dimming skipped: Discord renamed its embed views.');

		return;
	}

	objc.hook(CELL_CLASS, 'layoutSubviews', {
		after: ({ self }) => {
			try {
				if (self) applyTo(current, self);
			} catch (error) {
				reportWorkletError('Night Images', error);
			}
		},
	});
}

/**
 * @description Replaces the embeds to dim and lays out the cells it dimmed, so a change shows at once.
 * @param dimming The embeds to dim.
 */
export function setEmbedDimming(dimming: EmbedDimming) {
	'worklet';
	const current = holder()[STATE_KEY];

	if (!current) return;

	current.dimmed = new Set(dimming.messageIds);
	current.opacity = dimming.opacity;
	current.touched.forEach((cell) => {
		try {
			current.objc.invoke(cell, 'setNeedsLayout', []);
		} catch (error) {
			reportWorkletError('Night Images', error);
		}
	});
}

/**
 * @description Puts back the full opacity of every embed image it dimmed.
 */
export function restoreEmbedDimming() {
	'worklet';
	const current = holder()[STATE_KEY];

	if (!current) return;

	current.dimmed = new Set();
	current.touched.forEach((cell) => {
		try {
			applyTo(current, cell);
		} catch (error) {
			reportWorkletError('Night Images', error);
		}
	});
	holder()[STATE_KEY] = undefined;
}

export default { installEmbedDimming, setEmbedDimming, restoreEmbedDimming };
