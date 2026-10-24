import type { NativeHookToken, NativeObjectHandle } from '@unbound-app/api/native';

import type { Highlighter } from '~/highlighter';
import type { CodeBlockPlacement } from '~/fences';
import type { Preferences } from '~/preferences';
import { SelectedChannelStore } from '~/modules';

import type { CodeHost } from './code-host';
import type { NativeUI } from './ui';
import { messageIdentity } from './cells';

export type SurfacePart = {
	placement: CodeBlockPlacement;
	host: CodeHost;
	height: number;
	copyHook: NativeHookToken | null;
};

/** A message label whose code blocks are replaced by native code cards. */
export type Surface = {
	label: NativeObjectHandle;
	labelKey: string;
	cell: NativeObjectHandle;
	cellKey: string;
	channelId: string;
	messageId: string;
	/** The attributed text Discord rendered, restored on stop. */
	original: NativeObjectHandle;
	/** The plain text of the attributed text this plugin set, to tell it apart from Discord's. */
	renderedText: string | null;
	parts: SurfacePart[];
	preferences: Preferences;
	lightTheme: boolean;
	width: number;
	cellHook: NativeHookToken | null;
	table: NativeObjectHandle | null;
	rowRetries: number;
	rowCorrectionPending: boolean;
	rowTimer: ReturnType<typeof setTimeout> | null;
	settleTimers: ReturnType<typeof setTimeout>[];
};

export type Session = {
	ui: NativeUI;
	highlighter: Highlighter;
	/** Mounted surfaces by label key, oldest first. */
	surfaces: Map<string, Surface>;
	/** Labels this plugin is writing to, so its own `setAttributedText:` calls are not re-rendered. */
	applying: Set<string>;
	/** Aborted on stop, so pending native work can tell it is stale. */
	signal: AbortSignal;
};

type SurfaceIdentity = Pick<Surface, 'cellKey' | 'channelId' | 'messageId'>;

/**
 * @description Reads the channel the user is looking at.
 * @returns The selected channel ID, falling back to the last selected one.
 */
export function visibleChannelId(): string | undefined {
	return SelectedChannelStore.getChannelId() ?? SelectedChannelStore.getLastSelectedChannelId();
}

/**
 * @description Tells whether a surface still belongs to a message cell, which UIKit recycles between messages.
 * @param surface The surface's channel, message and cell.
 * @param channelId The cell's channel.
 * @param messageId The cell's message.
 * @param cellKey The cell's key.
 * @returns `true` when all three match.
 */
export function surfaceMatchesCell(
	surface: SurfaceIdentity,
	channelId: string,
	messageId: string,
	cellKey: string,
): boolean {
	return (
		surface.channelId === channelId &&
		surface.messageId === messageId &&
		surface.cellKey === cellKey
	);
}

/**
 * @description Tells whether a surface is still the mounted one for its label.
 * @param session The renderer session.
 * @param surface The surface.
 * @returns `false` once it was replaced, removed or the plugin stopped.
 */
export function isMounted(session: Session, surface: Surface): boolean {
	return session.surfaces.get(surface.labelKey) === surface;
}

/**
 * @description Tells whether a surface's cell still shows its message, in the visible channel, with its label inside.
 * @param session The renderer session.
 * @param surface The surface.
 * @returns `true` when it is safe to write to the surface's views.
 */
export function isOnScreen({ ui }: Session, surface: Surface): boolean {
	return Boolean(
		visibleChannelId() === surface.channelId &&
		messageIdentity(ui, surface.cell)?.messageId === surface.messageId &&
		ui.key(surface.cell) === surface.cellKey &&
		ui.call(surface.label, 'isDescendantOfView:', surface.cell),
	);
}

/**
 * @description Forgets a surface without touching its label: cancels its timers and removes its hooks.
 * @param session The renderer session.
 * @param surface The surface.
 */
export function detachSurface(session: Session, surface: Surface): void {
	for (const timer of surface.settleTimers) clearTimeout(timer);

	if (surface.rowTimer) clearTimeout(surface.rowTimer);

	surface.settleTimers = [];
	surface.rowTimer = null;
	surface.cellHook?.remove();
	surface.cellHook = null;

	for (const part of surface.parts) {
		part.copyHook?.remove();
		part.copyHook = null;
	}

	if (isMounted(session, surface)) session.surfaces.delete(surface.labelKey);
}

export default { visibleChannelId, surfaceMatchesCell, isMounted, isOnScreen, detachSurface };
