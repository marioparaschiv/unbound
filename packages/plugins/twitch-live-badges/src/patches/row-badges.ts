import { metro, patcher, plugins } from '@unbound-app/api';
import { format, messages } from '@unbound-app/i18n';

import { embedChannel } from '~/lib/channels';
import { decorateEmbeds, type RawEmbed } from '~/lib/decorate';
import { createStatusCache } from '~/lib/status-cache';
import { readStatus, type StreamStatus } from '~/lib/status';

type GeneratedRow = { message?: { embeds?: RawEmbed[] } };
type RowManagerModule = { prototype: { generate: (...args: unknown[]) => GeneratedRow } };

const STATUS_URL = 'https://decapi.me/twitch/uptime/';

const cache = createStatusCache();
const pending = new Set<string>();
let running = false;

function isRowManager(value: unknown): value is RowManagerModule {
	return (
		typeof Reflect.get(Object(Reflect.get(Object(value), 'prototype')), 'generate') ===
		'function'
	);
}

function label(status: StreamStatus): string {
	return status.live ? format('LIVE', { uptime: status.uptime }) : messages.OFFLINE;
}

async function lookUp(channel: string) {
	pending.add(channel);

	try {
		const response = await fetch(STATUS_URL + encodeURIComponent(channel));
		const status = response.ok ? readStatus(await response.text()) : undefined;

		if (!status || !running) return;

		cache.set(channel, status);
		plugins.redrawChat?.();
	} catch (error) {
		logger.error(`Failed to look up Twitch channel ${channel}:`, error);
	} finally {
		pending.delete(channel);
	}
}

function badgeRow(row: GeneratedRow | undefined) {
	const embeds = row?.message?.embeds;

	if (!embeds?.length) return;

	for (const embed of embeds) {
		const channel = embedChannel(embed.url);

		if (channel && cache.isStale(channel) && !pending.has(channel)) void lookUp(channel);
	}

	row!.message!.embeds = decorateEmbeds(embeds, cache.get, label);
}

/**
 * @description Writes each Twitch channel embed's live status into the chat rows Discord builds, leaving the stored
 * messages untouched, and redraws the chat when a status arrives.
 * @returns A function that stops the lookups, or `undefined` when Discord moved its row builder.
 */
export function badgeTwitchRows(): (() => void) | undefined {
	const RowManager: unknown = metro.findByName('RowManager', { interop: false });
	const rows = [Reflect.get(Object(RowManager), 'default'), RowManager].find(isRowManager);

	if (!rows) {
		logger.warn('Twitch badges skipped: Discord moved RowManager.');

		return undefined;
	}

	running = true;
	patcher.after(rows.prototype, 'generate', ({ result }) => badgeRow(result as GeneratedRow));
	plugins.redrawChat?.();

	const stopClearing = plugins.onMemoryPressure?.(() => cache.clear());

	return () => {
		running = false;
		stopClearing?.();
		plugins.redrawChat?.();
	};
}

export default badgeTwitchRows;
