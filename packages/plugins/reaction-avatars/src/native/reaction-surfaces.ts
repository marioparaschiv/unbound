import type { NativeObjectHandle } from '@unbound-app/api/native';

import {
	reactionAvatarExtraWidth,
	reactionAvatarReservedExtraWidth,
	reactionAvatarReservedSlotCount,
	reactionAvatarSelection,
	reactionAvatarStackWidth,
	shouldMeasureReactionAvatarWidth,
} from '~/avatars';
import { releaseState, unmountSurface, type ReactionViewState } from '~/native/reaction-views';
import { baseItemWidth, invalidateLayout, setExtraWidth } from '~/native/collections';
import { framesMatch, reactionAvatarFrame, reactionBaseViewWidth } from '~/layout';
import type { ReactionContext } from '~/reaction-context';
import { rescheduleCell } from '~/native/cell-queue';
import { Avatar, SURFACE_HEIGHT } from '~/constants';
import type { Session } from '~/native/session';
import { surfaceStates } from '~/surface-states';
import { fetchReactors } from '~/reactors';
import { ChannelStore } from '~/modules';
import { key } from '~/native/views';

export type ReactionViewTarget = {
	cellKey: string;
	collectionCell: NativeObjectHandle;
	itemIndex: number;
	layoutKey: string;
	view: NativeObjectHandle;
};

function renderSurface(session: Session, state: ReactionViewState): void {
	surfaceStates.set(state.surfaceId, {
		guildId: ChannelStore.getChannel(state.context.channelId)?.guild_id,
		height: state.baseFrame.height || SURFACE_HEIGHT,
		measured: state.widthMeasured,
		onWidth: (width) => updateAvatarWidth(session, state, width),
		totalCount: state.totalCount,
		users: state.users,
		width: state.avatarWidth,
	});
}

function updateSurfaceFrame(session: Session, state: ReactionViewState): void {
	if (!state.surface) return;

	const position = reactionAvatarFrame(
		state.baseFrame,
		state.avatarWidth || 120,
		Avatar.leadingInset,
	);
	const frame = {
		height: state.baseFrame.height || SURFACE_HEIGHT,
		width: position.width,
		x: position.x,
		y: state.baseFrame.y,
	};

	if (framesMatch(state.surfaceFrame ?? undefined, frame)) return;

	try {
		session.fabric.setFrame(state.surface, frame);
		state.surfaceFrame = frame;
	} catch {
		// The surface keeps its last frame until the next render moves it.
	}
}

function reserveWidth(state: ReactionViewState): void {
	state.avatarWidth = reactionAvatarStackWidth(reactionAvatarReservedSlotCount(state.totalCount));
	state.extraWidth = reactionAvatarReservedExtraWidth(state.totalCount);
	state.widthMeasured = false;
}

function updateAvatarWidth(session: Session, state: ReactionViewState, width: number): void {
	if (!Number.isFinite(width) || width <= 0) return;

	if (!shouldMeasureReactionAvatarWidth(state.widthMeasured, state.avatarWidth, width)) return;

	const firstMeasurement = !state.widthMeasured;
	const widthChanged = Math.abs(width - state.avatarWidth) >= 1;
	const extraWidth = reactionAvatarExtraWidth(width, true);
	const extraWidthChanged = Math.abs(extraWidth - state.extraWidth) >= 1;

	state.widthMeasured = true;
	state.avatarWidth = width;
	state.extraWidth = extraWidth;

	if (extraWidthChanged) setExtraWidth(session, state.layoutKey, state.itemIndex, extraWidth);

	if (!firstMeasurement && !widthChanged && !extraWidthChanged) return;

	state.revision++;
	renderSurface(session, state);

	if (state.surface) {
		try {
			session.fabric.update(state.surface, {
				revision: state.revision,
				surfaceId: state.surfaceId,
			});
		} catch {
			return;
		}
	}

	if (extraWidthChanged) invalidateLayout(session, state.layoutKey);
}

function removeSurface(session: Session, state: ReactionViewState): void {
	unmountSurface(session, state);
	state.avatarWidth = 0;
	state.extraWidth = 0;
	state.widthMeasured = false;
	setExtraWidth(session, state.layoutKey, state.itemIndex, 0);
	invalidateLayout(session, state.layoutKey);
}

function createSurface(session: Session, state: ReactionViewState): void {
	if (state.surface || state.users.length === 0) return;

	renderSurface(session, state);

	try {
		state.surface = session.fabric.mount(state.collectionCell, session.surfaceName, {
			revision: state.revision,
			surfaceId: state.surfaceId,
		});
	} catch {
		state.surface = null;

		return;
	}

	updateSurfaceFrame(session, state);
}

function updateSurface(session: Session, state: ReactionViewState): void {
	if (state.users.length === 0) {
		removeSurface(session, state);

		return;
	}

	state.revision++;
	renderSurface(session, state);

	if (!state.surface) {
		createSurface(session, state);
	} else {
		try {
			session.fabric.update(state.surface, {
				revision: state.revision,
				surfaceId: state.surfaceId,
			});
		} catch {
			removeSurface(session, state);

			return;
		}
	}

	updateSurfaceFrame(session, state);
}

function isTracked(session: Session, state: ReactionViewState): boolean {
	return session.reactions.get(key(session.objc, state.view)) === state;
}

// Discord sometimes answers with no reactors right after a reaction lands, so an empty result retries twice.
function scheduleEmptyRetry(session: Session, state: ReactionViewState): void {
	if (state.totalCount <= 0 || state.retryTimer || state.retryCount >= 2) return;

	state.retryCount++;
	state.retryTimer = setTimeout(() => {
		state.retryTimer = null;

		if (
			session.signal.aborted ||
			!isTracked(session, state) ||
			state.users.length > 0 ||
			state.loading
		) {
			return;
		}

		session.reactors.invalidate(state.context.key);
		loadReactors(session, state);
	}, 1_000);
}

function loadReactors(session: Session, state: ReactionViewState): void {
	if (state.loading) return;

	state.loading = true;

	const requestKey = state.context.key;
	const { requestGeneration } = state;

	function isCurrent() {
		return (
			!session.signal.aborted &&
			isTracked(session, state) &&
			requestKey === state.context.key &&
			requestGeneration === state.requestGeneration
		);
	}

	void session.reactors
		.load(requestKey, () => fetchReactors(state.context))
		.then((reactors) => {
			if (!isCurrent()) return;

			state.loading = false;
			state.users = reactors;
			updateSurface(session, state);

			if (reactors.length === 0) {
				scheduleEmptyRetry(session, state);

				return;
			}

			if (state.retryTimer) clearTimeout(state.retryTimer);

			state.retryTimer = null;
			state.retryCount = 0;
		})
		.catch(() => {
			if (!isCurrent()) return;

			state.loading = false;
			scheduleEmptyRetry(session, state);
		});
}

function createState(
	session: Session,
	target: ReactionViewTarget,
	context: ReactionContext,
): ReactionViewState {
	const { fabric } = session;
	const measured = fabric.measure(target.view);
	const layoutWidth = baseItemWidth(session, target.layoutKey, target.itemIndex);
	const baseFrame = {
		...measured,
		width:
			layoutWidth === undefined
				? measured.width
				: reactionBaseViewWidth(
						layoutWidth,
						fabric.measure(target.collectionCell).width,
						measured.width,
					),
	};
	const state: ReactionViewState = {
		...target,
		avatarWidth: 0,
		baseFrame,
		context,
		extraWidth: 0,
		loading: false,
		requestGeneration: 0,
		retryCount: 0,
		retryTimer: null,
		revision: 0,
		surface: null,
		surfaceFrame: null,
		surfaceId: `${target.cellKey}:${context.key}`,
		totalCount: reactionAvatarSelection(context.reaction, context.reactionType).count,
		users: [],
		widthMeasured: false,
	};

	reserveWidth(state);

	return state;
}

/**
 * @description Stops showing avatars on a pill and gives its layout space back.
 * @param session The running session.
 * @param viewKey The pill's key.
 * @param state The pill.
 */
export function disposeState(session: Session, viewKey: string, state: ReactionViewState): void {
	releaseState(session, viewKey, state);
	setExtraWidth(session, state.layoutKey, state.itemIndex, 0);
	invalidateLayout(session, state.layoutKey);
}

/**
 * @description Brings a pill's avatars in line with the reaction it now shows.
 * @param session The running session.
 * @param target The pill's views and position.
 * @param context The reaction, or `null` to stop showing avatars on the pill.
 */
export function syncReactionView(
	session: Session,
	target: ReactionViewTarget,
	context: ReactionContext | null,
): void {
	const { objc, reactions, reactors } = session;
	const viewKey = key(objc, target.view);
	const existing = reactions.get(viewKey);

	if (!context) {
		if (existing) disposeState(session, viewKey, existing);

		return;
	}

	if (
		existing?.context.key !== context.key ||
		existing.cellKey !== target.cellKey ||
		key(objc, existing.collectionCell) !== key(objc, target.collectionCell)
	) {
		if (existing) disposeState(session, viewKey, existing);

		const state = createState(session, target, context);

		reactions.set(viewKey, state);
		setExtraWidth(session, state.layoutKey, state.itemIndex, state.extraWidth);

		const cached = reactors.get(context.key);

		if (cached === undefined) {
			loadReactors(session, state);

			return;
		}

		state.users = cached;
		updateSurface(session, state);

		if (cached.length === 0) scheduleEmptyRetry(session, state);

		return;
	}

	if (existing.layoutKey !== target.layoutKey || existing.itemIndex !== target.itemIndex) {
		setExtraWidth(session, existing.layoutKey, existing.itemIndex, 0);
		existing.layoutKey = target.layoutKey;
		existing.itemIndex = target.itemIndex;
		setExtraWidth(session, existing.layoutKey, existing.itemIndex, existing.extraWidth);
	}

	existing.context = context;

	const totalCount = reactionAvatarSelection(context.reaction, context.reactionType).count;

	if (existing.totalCount !== totalCount) {
		existing.totalCount = totalCount;
		reserveWidth(existing);
		setExtraWidth(session, existing.layoutKey, existing.itemIndex, existing.extraWidth);

		if (existing.users.length > 0) updateSurface(session, existing);
		else renderSurface(session, existing);
	}

	if (existing.loading || existing.users.length > 0) return;

	const cached = reactors.get(context.key);

	if (cached === undefined) {
		loadReactors(session, existing);

		return;
	}

	existing.users = cached;

	if (cached.length > 0) updateSurface(session, existing);
	else scheduleEmptyRetry(session, existing);
}

/**
 * @description Moves a pill's avatar surface to follow the pill.
 * @param session The running session.
 * @param viewKey The pill's key.
 */
export function followReactionView(session: Session, viewKey: string): void {
	const state = session.reactions.get(viewKey);

	if (state?.surface) updateSurfaceFrame(session, state);
}

/**
 * @description Fetches the reactors of the matching pills again and re-renders their message cells.
 * @param session The running session.
 * @param matches Picks the pills to refresh.
 */
export function reloadReactors(
	session: Session,
	matches: (state: ReactionViewState) => boolean,
): void {
	for (const state of [...session.reactions.values()].filter(matches)) {
		state.requestGeneration++;
		state.loading = false;
		loadReactors(session, state);
		rescheduleCell(session, state.cellKey);
	}
}
