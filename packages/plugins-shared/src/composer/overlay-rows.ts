import { useEffect, useSyncExternalStore } from 'react';

export const COMPOSER_ROW_BOTTOM = -6;
export const COMPOSER_ROW_GAP = 6;
export const COMPOSER_ROW_RIGHT = 28;
export const SLOWMODE_ROW_HEIGHT = 18;

type SlowmodeChannel = { rateLimitPerUser?: number } | null | undefined;
type ComposerRow = { order: number; height: number };
type ComposerRows = {
	channels: Map<string, Map<string, ComposerRow>>;
	listeners: Set<() => void>;
};

declare global {
	var __unboundComposerRows: ComposerRows | undefined;
}

function composerRows(): ComposerRows {
	return (globalThis.__unboundComposerRows ??= { channels: new Map(), listeners: new Set() });
}

function notify() {
	for (const listener of composerRows().listeners) listener();
}

/**
 * @description Measures how far the slowmode notice pushes rows drawn above the composer.
 * @param channel The open channel.
 * @returns The notice's height when the channel has slowmode, otherwise `0`.
 */
export function slowmodeInset(channel: SlowmodeChannel): number {
	return (channel?.rateLimitPerUser ?? 0) > 0 ? SLOWMODE_ROW_HEIGHT : 0;
}

/**
 * @description Places a row above the composer without growing it.
 * @param channel The open channel, whose slowmode notice the row clears.
 * @param height The row's height.
 * @param below The space taken by the rows shown under this one, `0` when it is the lowest.
 * @returns The row's `top` relative to the composer container.
 */
export function composerRowTop(channel: SlowmodeChannel, height: number, below = 0): number {
	return COMPOSER_ROW_BOTTOM - below - height - slowmodeInset(channel);
}

/**
 * @description Marks a row as shown above a channel's composer, so the rows over it move up.
 * @param channelId The channel whose composer shows the row.
 * @param id A name unique to the row.
 * @param row Where the row sits in the stack, lowest `order` first, and its height.
 * @returns A function that removes the row again.
 */
export function showComposerRow(channelId: string, id: string, row: ComposerRow): () => void {
	const { channels } = composerRows();
	const rows = channels.get(channelId) ?? new Map<string, ComposerRow>();

	rows.set(id, row);
	channels.set(channelId, rows);
	notify();

	return () => {
		if (rows.get(id) !== row) return;

		rows.delete(id);

		if (!rows.size) {
			channels.delete(channelId);
		}

		notify();
	};
}

/**
 * @description Adds up the rows shown under a row, each with the gap above it.
 * @param channelId The channel whose composer shows the rows.
 * @param order The row's place in the stack.
 * @returns The space the lower rows take.
 */
export function spaceBelow(channelId: string, order: number): number {
	let space = 0;

	for (const row of composerRows().channels.get(channelId)?.values() ?? []) {
		if (row.order < order) {
			space += row.height + COMPOSER_ROW_GAP;
		}
	}

	return space;
}

function subscribe(listener: () => void): () => void {
	const { listeners } = composerRows();

	listeners.add(listener);

	return () => listeners.delete(listener);
}

type ComposerRowOptions = {
	channel: SlowmodeChannel;
	channelId: string;
	id: string;
	order: number;
	height: number;
	shown: boolean;
};

/**
 * @description Registers a row above the composer while it is shown and places it over the rows shown under it.
 * @param options The channel, the row's id, its place in the stack, its height, and whether it is shown.
 * @returns The row's `top` relative to the composer container.
 */
export function useComposerRow({
	channel,
	channelId,
	id,
	order,
	height,
	shown,
}: ComposerRowOptions): number {
	useEffect(
		() => (shown ? showComposerRow(channelId, id, { order, height }) : undefined),
		[channelId, id, order, height, shown],
	);

	const below = useSyncExternalStore(subscribe, () => spaceBelow(channelId, order));

	return composerRowTop(channel, height, below);
}
