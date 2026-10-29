import type {
	NativeFabricSurface,
	NativeHookToken,
	NativeObjectHandle,
} from '@unbound-app/api/native';
import { safeInvoke } from '@unbound-plugins/shared/native/safe-invoke';
import {
	MESSAGE_TEXT_VIEW_CLASSES,
	placeAttachedViews,
	textAttachmentBridge,
	textEngine,
	type TextEngine,
} from '@unbound-plugins/shared/native/text-attachments';

import {
	availableMessageWidth,
	findTable,
	nativeFrame,
	nativeString,
	readLabelText,
} from '~/native/objc';
import { captureBottomAnchor, clearReactionLayout, refreshRowSize } from '~/native/scroll-anchor';
import { findRenderedLinkRange, type LinkTarget, type TextRange } from '~/link-targets';
import { BottomAnchorTracker, surfaceHeightCacheKey } from '~/surface-layout';
import { linkFont, surfaceInsertion } from '~/native/attachment';
import type { EmbeddedContent } from '~/embedded-content';
import type { Message, RowGenerator } from '~/modules';
import type { Session } from '~/native/session';
import { Surface } from '~/constants';

type Timer = ReturnType<typeof setTimeout>;

export type SurfaceInit = {
	cell: NativeObjectHandle;
	cellKey: string;
	messageId: string;
	target: LinkTarget;
	channelName: string;
	label: NativeObjectHandle;
	attributedText: NativeObjectHandle;
	range: TextRange;
	reactionSnapshot: string;
	content: EmbeddedContent;
};

/** A linked message rendered by a Fabric surface inside a message label's text. */
export type EmbeddedSurface = {
	id: string;
	cell: NativeObjectHandle;
	cellKey: string;
	messageId: string;
	target: LinkTarget;
	channelName: string;
	record: Message;
	generator: RowGenerator;
	reactionSnapshot: string;
	label: NativeObjectHandle;
	labelHook: NativeHookToken | null;
	layoutHook: NativeHookToken | null;
	engine: TextEngine;
	attachmentIndex: number;
	placing: boolean;
	host: NativeObjectHandle;
	mounted: NativeFabricSurface | null;
	table: NativeObjectHandle | null;
	original: NativeObjectHandle;
	range: TextRange;
	font: NativeObjectHandle | null;
	rendered: NativeObjectHandle | null;
	renderedText: string | null;
	width: number;
	height: number;
	heightKey: string;
	pendingHeight: number | null;
	lastInvalidatedHeight: number;
	rowRefreshGeneration: number;
	layoutTimer?: Timer;
	reactionLayoutTimer?: Timer;
	bottomScrollTimer?: Timer;
	bottomScrollPending: boolean;
	bottomAnchor: BottomAnchorTracker;
	applying: boolean;
	reconciling: boolean;
	reconcileQueued: boolean;
	disposed: boolean;
};

/**
 * @description Inserts the embed's attachment after the channel mention and sets it as the label's text.
 * @param session The running session.
 * @param surface The embed.
 * @param forceRefresh Whether to resize the row even when the embed's height did not change.
 * @returns `true` when the label now shows the embed.
 */
function applyAttachment(
	session: Session,
	surface: EmbeddedSurface,
	forceRefresh: boolean = false,
): boolean {
	const { objc } = session;

	if (surface.applying) return false;

	// The label's own text hook fires for this write, and must ignore it.
	surface.applying = true;

	try {
		const insertion = surfaceInsertion(objc, surface);

		if (!insertion) return false;

		const insertAt = surface.range.location + surface.range.length;

		const updated = safeInvoke(
			objc,
			surface.original,
			'mutableCopy',
		) as NativeObjectHandle | null;

		if (!updated) return false;

		safeInvoke(objc, updated, 'insertAttributedString:atIndex:', insertion.text, insertAt);

		const text = nativeString(objc, safeInvoke(objc, updated, 'string'));

		if (text === undefined) return false;

		surface.rendered = updated;
		surface.renderedText = text;
		surface.attachmentIndex = insertAt + insertion.attachmentOffset;
		safeInvoke(objc, surface.label, 'setAttributedText:', updated);
		safeInvoke(objc, surface.label, 'setNeedsLayout');
		refreshRowSize(session, surface, forceRefresh);
		placeHost(session, surface);

		return true;
	} finally {
		surface.applying = false;
	}
}

function placeHost(session: Session, surface: EmbeddedSurface) {
	if (surface.engine !== 'textkit' || surface.placing || surface.disposed) return;

	surface.placing = true;

	void placeAttachedViews(textAttachmentBridge(session.objc), surface.label, [
		{ view: surface.host, index: surface.attachmentIndex },
	])
		.catch(() => undefined)
		.finally(() => {
			surface.placing = false;

			if (surface.disposed) safeInvoke(session.objc, surface.host, 'removeFromSuperview');
		});
}

function hookLayout(session: Session, surface: EmbeddedSurface): NativeHookToken | null {
	if (surface.engine !== 'textkit') return null;

	try {
		return session.objc.hook(
			session.objc.className(surface.label) ?? MESSAGE_TEXT_VIEW_CLASSES[0],
			'layoutSubviews',
			{ after: () => placeHost(session, surface) },
			{ instance: surface.label },
		);
	} catch {
		return null;
	}
}

/**
 * @description Re-applies an embed to a label whose text Discord replaced.
 * @param session The running session.
 * @param surface The embed.
 * @param attributedText The label's new text.
 * @param range The channel mention's range in the new text.
 */
export function updateSurface(
	session: Session,
	surface: EmbeddedSurface,
	attributedText: NativeObjectHandle,
	range: TextRange,
) {
	surface.original = attributedText;
	surface.range = range;
	surface.font = linkFont(session.objc, attributedText, range);
	applyAttachment(session, surface, true);
}

/**
 * @description Puts the embed back when Discord re-renders the label's text without it.
 * @param session The running session.
 * @param surface The embed.
 */
export async function reconcileSurfaceText(session: Session, surface: EmbeddedSurface) {
	if (surface.reconciling) {
		surface.reconcileQueued = true;

		return;
	}

	surface.reconciling = true;

	try {
		const label = await readLabelText(session.objc, surface.label);

		if (surface.disposed || !label || label.text === surface.renderedText) return;

		const range = findRenderedLinkRange(label.text, surface.channelName);

		if (range) updateSurface(session, surface, label.attributedText, range);
	} catch {
		// A native call failed; the label's next text change tries again.
	} finally {
		surface.reconciling = false;

		if (surface.reconcileQueued) {
			surface.reconcileQueued = false;
			void reconcileSurfaceText(session, surface);
		}
	}
}

function clearSurfaceTimers(session: Session, surface: EmbeddedSurface) {
	session.timers.cancel(surface.layoutTimer);
	session.timers.cancel(surface.bottomScrollTimer);
	clearReactionLayout(session, surface);
	surface.layoutTimer = undefined;
	surface.bottomScrollTimer = undefined;
	surface.pendingHeight = null;
	surface.bottomAnchor.clear();
}

/**
 * @description Removes an embed: unmounts its surface, detaches its host view, and optionally restores the label's original text.
 * @param session The running session.
 * @param surface The embed.
 * @param restore Whether to put the label's text back as it was before the embed.
 */
export function teardownSurface(session: Session, surface: EmbeddedSurface, restore: boolean) {
	const { objc, fabric } = session;

	surface.disposed = true;
	clearSurfaceTimers(session, surface);
	surface.labelHook?.remove();
	surface.layoutHook?.remove();

	if (restore && surface.rendered) {
		const current = safeInvoke(
			objc,
			surface.label,
			'attributedText',
		) as NativeObjectHandle | null;
		const currentText = current
			? nativeString(objc, safeInvoke(objc, current, 'string'))
			: undefined;

		// Only restore text the embed wrote; Discord may have set new text since.
		if (current && (currentText === surface.renderedText || current === surface.rendered)) {
			safeInvoke(objc, surface.label, 'setAttributedText:', surface.original);
			safeInvoke(objc, surface.label, 'setNeedsLayout');
		}
	}

	if (surface.mounted) {
		try {
			fabric.unmount(surface.mounted);
		} catch {
			// The surface was already unmounted with its window.
		}
	}

	safeInvoke(objc, surface.host, 'removeFromSuperview');
	session.surfacesById.delete(surface.id);
	session.surfaces.delete(surface.cellKey);
}

/**
 * @description Creates an embed for a linked message: a host view sized for it, a mounted Fabric surface, and the attachment in the label.
 * @param session The running session.
 * @param init The cell, the label and mention to attach after, and the content to render.
 * @param isCurrent Tells whether the cell still shows the message this lookup started for.
 * @returns The embed, or `undefined` when the cell changed or a native step failed.
 */
export async function createSurface(
	session: Session,
	init: SurfaceInit,
	isCurrent: () => boolean,
): Promise<EmbeddedSurface | undefined> {
	const { objc, fabric } = session;
	const { cell, cellKey, label, target } = init;
	let width: number;

	try {
		width = await availableMessageWidth(objc, cell, label);
	} catch {
		return;
	}

	if (!isCurrent() || !Number.isFinite(width) || width < Surface.minWidth) return;

	const font = linkFont(objc, init.attributedText, init.range);
	const heightKey = surfaceHeightCacheKey(target.channelId, target.messageId, width);
	const height = session.heights.get(heightKey, Surface.minHeight);
	const [host, table] = await Promise.all([
		createHost(session, width, height),
		findTable(objc, cell).catch(() => null),
	]);

	if (!isCurrent() || !host) return;

	const surface: EmbeddedSurface = {
		id: `message-link-${cellKey}-${init.messageId}-${target.messageId}`,
		cell,
		cellKey,
		messageId: init.messageId,
		target,
		channelName: init.channelName,
		record: init.content.record,
		generator: init.content.generator,
		reactionSnapshot: init.reactionSnapshot,
		label,
		labelHook: null,
		layoutHook: null,
		engine: textEngine(textAttachmentBridge(objc), label),
		attachmentIndex: 0,
		placing: false,
		host,
		mounted: null,
		table,
		original: init.attributedText,
		range: init.range,
		font,
		rendered: null,
		renderedText: null,
		width,
		height,
		heightKey,
		pendingHeight: null,
		lastInvalidatedHeight: -1,
		rowRefreshGeneration: 0,
		bottomScrollPending: false,
		bottomAnchor: new BottomAnchorTracker(),
		applying: false,
		reconciling: false,
		reconcileQueued: false,
		disposed: false,
	};

	if (table) captureBottomAnchor(session, surface, table);

	session.surfacesById.set(surface.id, surface);

	try {
		surface.labelHook = objc.hook(
			objc.className(label) ?? MESSAGE_TEXT_VIEW_CLASSES[0],
			'setAttributedText:',
			{
				after: () => {
					if (surface.applying) return;

					session.timers.later(() => void reconcileSurfaceText(session, surface));
				},
			},
			{ instance: label },
		);
		surface.layoutHook = hookLayout(session, surface);
		surface.mounted = fabric.mount(host, session.surfaceModule, {
			renderRevision: 0,
			surfaceId: surface.id,
		});
		fabric.setSize(
			surface.mounted,
			{ width, height: Surface.minHeight },
			{ width, height: Surface.maxHeight },
		);
		session.surfaces.set(cellKey, surface);

		if (!applyAttachment(session, surface)) {
			throw new Error('Could not attach the Fabric message surface');
		}

		return surface;
	} catch {
		teardownSurface(session, surface, false);

		return;
	}
}

async function createHost(
	session: Session,
	width: number,
	height: number,
): Promise<NativeObjectHandle | null> {
	const { objc } = session;

	try {
		const view = objc.alloc('UIView');

		await objc.invokeAsync(view, 'setFrame:', [nativeFrame(objc, width, height)]);

		return view;
	} catch {
		return null;
	}
}

/**
 * @description Resizes an embed's host view to the height its content laid out at, once the height settles.
 * @param session The running session.
 * @param surfaceId The embed's surface ID.
 * @param height The height React Native measured.
 */
export function reportSurfaceLayout(session: Session, surfaceId: string, height: number) {
	const surface = session.surfacesById.get(surfaceId);

	if (!surface || !Number.isFinite(height) || height <= 0 || height > Surface.maxHeight) return;

	const fittedHeight = Math.max(Surface.minHeight, height - Surface.bottomTrim);

	if (Math.abs((surface.pendingHeight ?? surface.height) - fittedHeight) < 2) return;

	surface.pendingHeight = fittedHeight;
	session.timers.cancel(surface.layoutTimer);
	surface.layoutTimer = session.timers.later(() => {
		const settledHeight = surface.pendingHeight;

		surface.layoutTimer = undefined;
		surface.pendingHeight = null;

		if (
			settledHeight === null ||
			surface.disposed ||
			Math.abs(surface.height - settledHeight) < 2
		) {
			return;
		}

		if (surface.table) captureBottomAnchor(session, surface, surface.table);

		surface.height = settledHeight;
		session.heights.set(surface.heightKey, settledHeight);
		clearReactionLayout(session, surface);
		safeInvoke(
			session.objc,
			surface.host,
			'setFrame:',
			nativeFrame(session.objc, surface.width, settledHeight),
		);
		applyAttachment(session, surface, true);
	}, Surface.settleDelay);
}
