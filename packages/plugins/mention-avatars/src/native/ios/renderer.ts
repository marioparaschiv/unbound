import {
	readNativeMessageInfo,
	type NativeMessageInfo,
} from '@unbound-plugins/shared/native/ios/message-info';
import type { NativeObjCBridge } from '@unbound-app/api/native';
import viewKey from '@unbound-plugins/shared/native/ios/view-key';

import { createTextViews, findTextViews } from '~/native/ios/text-views';
import { createBridge, type Handle } from '~/native/ios/bridge';
import { createImageCache } from '~/native/ios/image-cache';
import type { MentionIndex } from '~/lib/mention-index';
import {
	createCellMessages,
	isSettledWithoutMentions,
	planRetries,
	retryTargets,
	shouldWait,
} from '~/lib/render-plan';

const SETTLE_MS = 250;
const MAX_WAITING = 96;

type WaitingCell = { cell: Handle; id?: string; channelId?: string };

type RenderOutcome = { retry?: WaitingCell; final: boolean };

const FINAL: RenderOutcome = { final: true };
const UNSETTLED: RenderOutcome = { final: false };

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
	const waitingCells = new Map<string, WaitingCell>();
	const cellMessages = createCellMessages<Handle, NativeMessageInfo>(viewModelOf, (cell) =>
		readNativeMessageInfo(cell, objc),
	);
	let rendering = 0;
	const images = createImageCache(bridge, () => {
		for (const cell of activeCells.values()) schedule(cell);
	});
	const textViews = createTextViews(bridge, images, showAtSymbol);
	let disposed = false;

	function viewModelOf(cell: Handle): string | undefined {
		try {
			const viewModel = objc.getIvar(cell, 'viewModel') as Handle | null;
			const hash = viewModel ? objc.call(viewModel, 'hash') : undefined;

			return typeof hash === 'number' || typeof hash === 'bigint' ? String(hash) : undefined;
		} catch {
			return undefined;
		}
	}

	async function render(cell: Handle): Promise<RenderOutcome> {
		index.hydrateChannel();

		const key = viewKey(objc, cell);
		const info = await cellMessages.get(cell, key);
		const id = info?.messageId;

		if (disposed) return FINAL;

		const hydrated = index.hydrateMessage(id, info?.channelId);
		const retry = shouldWait(index, id, hydrated)
			? { cell, id, channelId: info?.channelId }
			: undefined;

		if (isSettledWithoutMentions(index, id, hydrated, Boolean(key && textViews.hasCell(key)))) {
			if (key) activeCells.delete(key);

			return FINAL;
		}

		const mentions = id ? index.get(id) : [];

		if (!mentions.length && (!key || !textViews.hasCell(key))) {
			if (key) activeCells.delete(key);

			return { retry, final: false };
		}

		if (key) activeCells.set(key, cell);

		let changed = false;

		const views = await textViews.candidates(await textViews.forCell(cell, key, id));

		if (disposed) return FINAL;

		for (const view of views) {
			if (textViews.update(view, id, mentions)) changed = true;
		}

		if (changed) bridge.call(cell, 'setNeedsLayout');

		if (!mentions.length && key) {
			textViews.forgetCell(key);
			activeCells.delete(key);
		}

		return retry ? { retry, final: false } : UNSETTLED;
	}

	function wait(key: string, entry: WaitingCell) {
		waitingCells.delete(key);
		waitingCells.set(key, entry);

		if (waitingCells.size > MAX_WAITING) waitingCells.delete(waitingCells.keys().next().value!);
	}

	function retryWaiting() {
		if (!waitingCells.size) return;

		const changed = index.refresh(retryTargets(waitingCells));
		const { reschedule, drop } = planRetries(waitingCells, changed, index.exhausted);

		for (const key of drop) waitingCells.delete(key);

		for (const key of reschedule) {
			const entry = waitingCells.get(key);

			waitingCells.delete(key);

			if (entry) schedule(entry.cell, true);
		}
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
				.then(({ retry, final }) => {
					if (retry) wait(key, retry);
					else waitingCells.delete(key);

					if (!settled && !final) setTimeout(() => schedule(pending, true), SETTLE_MS);
				});
		}, 0);
	}

	// Drops a reused cell's state without restoring its text, which Discord is about to replace.
	function reuse(cell: Handle) {
		const key = viewKey(objc, cell);

		if (key) {
			for (const view of textViews.knownViews(key)) textViews.forget(view);

			activeCells.delete(key);
			pendingCells.delete(key);
			waitingCells.delete(key);
			cellMessages.forget(key);
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
		cellMessages.clear();
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
