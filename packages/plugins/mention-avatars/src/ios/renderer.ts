import { readNativeMessageInfo } from '@unbound-plugins/shared/native/ios/message-info';
import type { NativeObjCBridge } from '@unbound-app/api/native';
import viewKey from '@unbound-plugins/shared/native/ios/view-key';

import { createTextViews, findTextViews } from '~/ios/text-views';
import { createBridge, type Handle } from '~/ios/bridge';
import { createImageCache } from '~/ios/image-cache';
import type { MentionIndex } from '~/mention-index';

const SETTLE_MS = 250;
const MAX_WAITING = 96;

export type Renderer = ReturnType<typeof createRenderer>;

/**
 * @description Creates the renderer that draws mention images into visible message cells.
 * @param objc The plugin's Objective-C bridge.
 * @param index The mention index the renderer reads.
 * @param showAtSymbol Reads whether a mention keeps its `@` beside the image.
 * @returns The renderer.
 */
export function createRenderer(
	objc: NativeObjCBridge,
	index: MentionIndex,
	showAtSymbol: () => boolean,
) {
	const bridge = createBridge(objc);
	const activeCells = new Map<string, Handle>();
	const pendingCells = new Map<string, Handle>();
	const waitingCells = new Map<string, Handle>();
	let rendering = 0;
	const images = createImageCache(bridge, () => {
		for (const cell of activeCells.values()) schedule(cell);
	});
	const textViews = createTextViews(bridge, images, showAtSymbol);
	let disposed = false;

	// Resolves whether the cell's message was not indexed yet, so the render should be retried.
	async function render(cell: Handle): Promise<boolean> {
		index.hydrateChannel();

		const key = viewKey(objc, cell);
		const info = await readNativeMessageInfo(cell, objc);
		const id = info?.messageId;

		if (disposed) return false;

		const hydrated = index.hydrateMessage(id, info?.channelId);
		const mentions = id ? index.get(id) : [];
		const retry = id ? !hydrated || index.isUnresolved(id) : false;

		if (!mentions.length && (!key || !textViews.hasCell(key))) {
			if (key) activeCells.delete(key);

			return retry;
		}

		if (key) activeCells.set(key, cell);

		let changed = false;

		for (const view of textViews.forCell(cell, key, id)) {
			if (textViews.update(view, id, mentions)) changed = true;
		}

		if (changed) bridge.call(cell, 'setNeedsLayout');

		if (!mentions.length && key) {
			textViews.forgetCell(key);
			activeCells.delete(key);
		}

		return retry;
	}

	function wait(key: string, cell: Handle) {
		waitingCells.delete(key);
		waitingCells.set(key, cell);

		if (waitingCells.size > MAX_WAITING) waitingCells.delete(waitingCells.keys().next().value!);
	}

	function retryWaiting() {
		const cells = [...waitingCells.values()];

		waitingCells.clear();

		for (const cell of cells) schedule(cell, true);
	}

	function schedule(cell: Handle, settled: boolean = false) {
		if (disposed) return;

		const key = viewKey(objc, cell);

		if (!key || pendingCells.has(key)) return;

		pendingCells.set(key, cell);

		setTimeout(() => {
			const pending = pendingCells.get(key);

			pendingCells.delete(key);

			if (disposed || !pending) return;

			rendering++;
			void render(pending)
				.finally(() => rendering--)
				.then((retry) => {
					if (retry) wait(key, pending);
					else waitingCells.delete(key);

					if (!settled) setTimeout(() => schedule(pending, true), SETTLE_MS);
				});
		}, 0);
	}

	// Drops a reused cell's state without restoring its text, which Discord is about to replace.
	function reuse(cell: Handle) {
		for (const view of findTextViews(bridge, cell)) textViews.forget(view);

		const key = viewKey(objc, cell);

		if (key) {
			activeCells.delete(key);
			pendingCells.delete(key);
			waitingCells.delete(key);
			textViews.forgetCell(key);
		}

		schedule(cell);
	}

	function restoreAll() {
		for (const cell of activeCells.values()) {
			for (const view of findTextViews(bridge, cell)) textViews.restore(view);
		}

		activeCells.clear();
		pendingCells.clear();
		waitingCells.clear();
		textViews.clear();
	}

	// Called when the selected channel changes and every visible cell is about to change.
	function clear() {
		restoreAll();
		index.clear();
	}

	function dispose() {
		disposed = true;
		restoreAll();
		images.dispose();
	}

	return {
		schedule: (cell: Handle) => schedule(cell),
		retryWaiting,
		reuse,
		clear,
		dispose,
		rendered: textViews.rendered,
		settling: () => pendingCells.size > 0 || rendering > 0,
		failed: images.failed,
	};
}

export default createRenderer;
