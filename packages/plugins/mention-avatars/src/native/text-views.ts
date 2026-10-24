import { textAttachmentBridge, textEngine } from '@unbound-plugins/shared/native/text-attachments';

import { insertMentionImages } from '~/native/attributed-text';
import type { ImageCache } from '~/native/image-cache';
import type { Bridge, Handle } from '~/native/bridge';
import viewKey from '@unbound-plugins/shared/native/view-key';

import { MENTION_PLACEHOLDER } from '~/constants';
import { containsMentionText } from '~/mentions';
import type { Mention } from '~/mentions';

type TextViewState = {
	expiresAt: number;
	imageRevision: number;
	messageID: string;
	original: Handle;
	originalString: string;
	rendered: Handle;
	signature: string;
};

type CellTextViews = {
	expiresAt: number;
	messageID: string | undefined;
	views: Handle[];
};

export type TextViews = ReturnType<typeof createTextViews>;

/**
 * @description Collects the text views under a view, depth-first, at most 40 levels and 1,600 views deep.
 * @param bridge The plugin's native bridge.
 * @param root The view to search.
 * @returns Every view with settable attributed text.
 */
export function findTextViews(bridge: Bridge, root: Handle): Handle[] {
	const { objc } = bridge;
	const maxDepth = 40;
	const maxVisited = 1_600;
	const views: Handle[] = [];
	const pending: [Handle, number][] = [[root, 0]];
	let visited = 0;

	while (pending.length && visited < maxVisited) {
		const [view, depth] = pending.pop()!;

		visited++;

		if (
			objc.respondsTo(view, 'setAttributedText:') &&
			objc.respondsTo(view, 'attributedText')
		) {
			views.push(view);
		}

		// Reaction pills hold their own text views, and never a mention.
		if (
			depth >= maxDepth ||
			!objc.respondsTo(view, 'subviews') ||
			objc.className(view) === 'DCDReactionListView'
		) {
			continue;
		}

		const children = bridge.call(view, 'subviews');

		if (!Array.isArray(children)) {
			continue;
		}

		const remaining = maxVisited - visited - pending.length;

		for (let index = Math.min(children.length, remaining) - 1; index >= 0; index--) {
			pending.push([children[index], depth + 1]);
		}
	}

	return views;
}

/**
 * @description Tracks the message text views the plugin rewrote, so they can be updated and restored.
 * @param bridge The plugin's native bridge.
 * @param images The mention image cache.
 * @param showAtSymbol Reads whether a mention keeps its `@` beside the image.
 * @returns The text view tracker.
 */
export function createTextViews(bridge: Bridge, images: ImageCache, showAtSymbol: () => boolean) {
	const states = new Map<string, TextViewState>();
	const cellViews = new Map<string, CellTextViews>();

	function attributedText(view: Handle) {
		const text = bridge.handle(view, 'attributedText');

		return { text, string: text ? bridge.string(text, 'string') : undefined };
	}

	function forCell(
		cell: Handle,
		key: string | undefined,
		messageID: string | undefined,
	): Handle[] {
		if (!key) return findTextViews(bridge, cell);

		const cached = cellViews.get(key);

		if (
			cached &&
			cached.messageID === messageID &&
			cached.expiresAt > Date.now() &&
			cached.views.every((view) => Boolean(bridge.call(view, 'window')))
		) {
			return cached.views;
		}

		const views = findTextViews(bridge, cell);

		// An empty result is retried soon, since the cell may not have laid out its text yet.
		cellViews.set(key, {
			expiresAt: Date.now() + (views.length ? 1_000 : 50),
			messageID,
			views,
		});

		return views;
	}

	function restore(view: Handle) {
		const key = viewKey(bridge.objc, view);
		const state = key ? states.get(key) : undefined;

		if (!key || !state) return;

		if (attributedText(view).string?.includes(MENTION_PLACEHOLDER)) {
			bridge.call(view, 'setAttributedText:', state.original);
		}

		states.delete(key);
	}

	function forget(view: Handle) {
		const key = viewKey(bridge.objc, view);

		if (key) states.delete(key);
	}

	// Returns whether the view's text changed.
	function update(view: Handle, messageID: string | undefined, mentions: Mention[]): boolean {
		if (!messageID) {
			restore(view);

			return false;
		}

		const key = viewKey(bridge.objc, view);

		if (!key) return false;

		const { text, string } = attributedText(view);

		if (!text || !string) return false;

		if (states.get(key)?.messageID !== messageID) states.delete(key);

		if (!mentions.length) {
			restore(view);

			return false;
		}

		const state = states.get(key);

		if (!string.includes('@') && (!state || !string.includes(MENTION_PLACEHOLDER))) {
			states.delete(key);

			return false;
		}

		const signature = JSON.stringify(mentions);

		if (
			state?.signature === signature &&
			state.imageRevision === images.revision() &&
			state.expiresAt > Date.now() &&
			bridge.call(text, 'isEqual:', state.rendered)
		) {
			return false;
		}

		// Rebuild from the live text when Discord replaced it, else from the saved original so images never stack.
		const base =
			!state ||
			(!string.includes(MENTION_PLACEHOLDER) &&
				(string !== state.originalString ||
					!containsMentionText(state.originalString, mentions)) &&
				containsMentionText(string, mentions))
				? { original: text, originalString: string }
				: state;
		const rendered = insertMentionImages(
			bridge,
			textEngine(textAttachmentBridge(bridge.objc), view),
			base.original,
			mentions,
			images.imageFor,
			showAtSymbol(),
		);

		states.set(key, {
			expiresAt: Date.now() + 5_000,
			imageRevision: images.revision(),
			messageID,
			original: base.original,
			originalString: base.originalString,
			rendered,
			signature,
		});

		if (bridge.call(rendered, 'isEqual:', text)) return false;

		bridge.call(view, 'setAttributedText:', rendered);

		return true;
	}

	return {
		forCell,
		update,
		restore,
		forget,
		hasCell: (key: string) => cellViews.has(key),
		forgetCell(key: string) {
			cellViews.delete(key);
		},
		clear() {
			states.clear();
			cellViews.clear();
		},
	};
}

export default createTextViews;
