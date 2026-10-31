import {
	textAttachmentBridge,
	textEngine,
} from '@unbound-plugins/shared/native/ios/text-attachments';

import { insertMentionImages } from '~/ios/attributed-text';
import type { ImageCache } from '~/ios/image-cache';
import type { Bridge, Handle } from '~/ios/bridge';
import viewKey from '@unbound-plugins/shared/native/ios/view-key';

import { MENTION_PLACEHOLDER } from '~/constants';
import { rebuildsFromLiveText } from '~/mentions';
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

		if (isTextView(bridge, view)) views.push(view);

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

function isTextView(bridge: Bridge, view: Handle): boolean {
	return (
		bridge.objc.respondsTo(view, 'setAttributedText:') &&
		bridge.objc.respondsTo(view, 'attributedText')
	);
}

/**
 * @description Collects the text views under a view with one native search, at most 40 levels and 256 views deep.
 * @param bridge The plugin's native bridge.
 * @param root The view to search.
 * @returns Every view with settable attributed text, or an empty list when the search failed.
 */
export async function searchTextViews(bridge: Bridge, root: Handle): Promise<Handle[]> {
	try {
		const views = await bridge.objc.findViews(root, 'UIView', {
			maxDepth: 40,
			maxVisited: 1_600,
			maxResults: 256,
		});

		return views.filter((view) => isTextView(bridge, view));
	} catch {
		return [];
	}
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

	async function forCell(
		cell: Handle,
		key: string | undefined,
		messageID: string | undefined,
	): Promise<Handle[]> {
		if (!key) return searchTextViews(bridge, cell);

		const cached = cellViews.get(key);

		if (cached && cached.messageID === messageID && cached.expiresAt > Date.now()) {
			return cached.views;
		}

		const views = await searchTextViews(bridge, cell);

		// An empty result is retried soon, since the cell may not have laid out its text yet.
		cellViews.set(key, {
			expiresAt: Date.now() + (views.length ? 1_000 : 50),
			messageID,
			views,
		});

		return views;
	}

	function jsThreadString(text: Handle): string | undefined {
		try {
			const value = bridge.objc.call(text, 'string');

			return typeof value === 'string' ? value : undefined;
		} catch {
			return undefined;
		}
	}

	function mayHoldMention(view: Handle, text: Handle | null): boolean {
		const key = viewKey(bridge.objc, view);

		if (key && states.has(key)) return true;

		if (!text) return false;

		const string = jsThreadString(text);

		return string === undefined || string.includes('@');
	}

	async function candidates(views: Handle[]): Promise<Handle[]> {
		const found: Handle[] = [];

		for (let index = 0; index < views.length; index += 64) {
			const chunk = views.slice(index, index + 64);
			const texts = await bridge.objc
				.batch(
					chunk.map((view) => ({ target: view, selector: 'attributedText', args: [] })),
				)
				.catch(() => null);

			for (const [offset, view] of chunk.entries()) {
				const text = texts ? ((texts[offset] ?? null) as Handle | null) : null;

				if (!texts || mayHoldMention(view, text)) found.push(view);
			}
		}

		return found;
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

		const base =
			state && !rebuildsFromLiveText(string, state.originalString)
				? state
				: { original: text, originalString: string };
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

		const stored = attributedText(view).text;
		const saved = states.get(key);

		if (stored && saved) saved.rendered = stored;

		return true;
	}

	return {
		forCell,
		candidates,
		update,
		restore,
		forget,
		hasCell: (key: string) => cellViews.has(key),
		rendered: () => states.size,
		forgetCell(key: string) {
			cellViews.delete(key);
		},
		knownViews: (key: string): Handle[] => cellViews.get(key)?.views ?? [],
		clear() {
			states.clear();
			cellViews.clear();
		},
	};
}

export default createTextViews;
