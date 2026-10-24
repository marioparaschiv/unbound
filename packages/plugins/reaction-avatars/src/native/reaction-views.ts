import type { NativeFabricSurface, NativeObjectHandle } from '@unbound-app/api/native';

import type { ReactionContext } from '~/reaction-context';
import { frameOf, setFrame } from '~/native/views';
import type { Session } from '~/native/session';
import { surfaceStates } from '~/surface-states';
import type { Reactor } from '~/avatars';
import type { Frame } from '~/layout';

// One reaction pill that shows an avatar stack, keyed by its `ReactionView`.
export type ReactionViewState = {
	avatarWidth: number;
	// The pill's frame before it was widened for the stack.
	baseFrame: Frame;
	cellKey: string;
	collectionCell: NativeObjectHandle;
	context: ReactionContext;
	extraWidth: number;
	itemIndex: number;
	layoutKey: string;
	loading: boolean;
	// Bumped to discard reactor requests that started before the pill changed.
	requestGeneration: number;
	retryCount: number;
	retryTimer: ReturnType<typeof setTimeout> | null;
	revision: number;
	surface: NativeFabricSurface | null;
	surfaceFrame: Frame | null;
	surfaceId: string;
	totalCount: number;
	users: Reactor[];
	view: NativeObjectHandle;
	widthMeasured: boolean;
};

/**
 * @description Unmounts a pill's avatar surface and gives the pill its original frame back.
 * @param session The running session.
 * @param state The pill.
 */
export function unmountSurface(session: Session, state: ReactionViewState): void {
	surfaceStates.delete(state.surfaceId);

	if (state.surface) {
		try {
			session.fabric.unmount(state.surface);
		} catch {
			// The surface already went away with its container.
		}
	}

	state.surface = null;
	state.surfaceFrame = null;
	setFrame(session.objc, state.view, state.baseFrame);
}

/**
 * @description Stops tracking a pill, leaving the layout it reserved to the caller.
 * @param session The running session.
 * @param viewKey The pill's key in `session.reactions`.
 * @param state The pill.
 */
export function releaseState(session: Session, viewKey: string, state: ReactionViewState): void {
	if (state.retryTimer) clearTimeout(state.retryTimer);

	state.requestGeneration++;
	unmountSurface(session, state);
	session.reactions.delete(viewKey);
}

/**
 * @description Stops tracking every pill that matches.
 * @param session The running session.
 * @param matches Picks the pills to release.
 * @returns `true` when any pill was released.
 */
export function releaseStates(
	session: Session,
	matches: (state: ReactionViewState, viewKey: string) => boolean,
): boolean {
	let released = false;

	for (const [viewKey, state] of session.reactions) {
		if (!matches(state, viewKey)) {
			continue;
		}

		releaseState(session, viewKey, state);
		released = true;
	}

	return released;
}

/**
 * @description Widens a pill's view by its avatar extra, after native layout reset it.
 * @param session The running session.
 * @param state The pill.
 */
export function fitReactionView(session: Session, state: ReactionViewState): void {
	if (state.extraWidth === 0) return;

	const width = state.baseFrame.width + state.extraWidth;
	const current = frameOf(session.objc, state.view);

	if (!current || Math.abs(current.width - width) < 1) return;

	setFrame(session.objc, state.view, { ...current, width });
}
