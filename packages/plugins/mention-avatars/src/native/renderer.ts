import { readNativeMessageInfo } from '@unbound-plugins/shared/native/message-info';
import type { NativeObjCBridge } from '@unbound-app/api/native';
import viewKey from '@unbound-plugins/shared/native/view-key';

import { createTextViews, findTextViews } from '~/native/text-views';
import { createBridge, type Handle } from '~/native/bridge';
import { createImageCache } from '~/native/image-cache';
import type { MentionIndex } from '~/mention-index';

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
	const images = createImageCache(bridge, () => {
		for (const cell of activeCells.values()) schedule(cell);
	});
	const textViews = createTextViews(bridge, images, showAtSymbol);
	let disposed = false;

	// Resolves whether the cell's message was not indexed yet, so the render should be retried.
	async function render(cell: Handle): Promise<boolean> {
		index.hydrateChannel();

		const key = viewKey(objc, cell);
		const id = (await readNativeMessageInfo(cell, objc))?.messageId;

		if (disposed) return false;

		const hydrated = index.hydrateMessage(id);
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

	function schedule(cell: Handle, attempt: number = 0) {
		if (disposed) return;

		const key = viewKey(objc, cell);

		if (!key || pendingCells.has(key)) return;

		pendingCells.set(key, cell);

		setTimeout(() => {
			const pending = pendingCells.get(key);

			pendingCells.delete(key);

			if (disposed || !pending) return;

			void render(pending).then((retry) => {
				if (retry && attempt < 12) setTimeout(() => schedule(pending, attempt + 1), 100);
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

	return { schedule, reuse, clear, dispose };
}

export default createRenderer;
