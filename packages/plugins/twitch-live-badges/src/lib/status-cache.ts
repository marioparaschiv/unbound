import type { StreamStatus } from '~/lib/status';

const FRESH_MS = 2 * 60 * 1000;

type Entry = { status: StreamStatus; at: number };

export type StatusCache = {
	get(channel: string): StreamStatus | undefined;
	set(channel: string, status: StreamStatus): void;
	isStale(channel: string): boolean;
};

/**
 * @description Keeps each channel's last status for two minutes before it counts as stale.
 * @param now The clock, in milliseconds.
 * @returns The cache.
 */
export function createStatusCache(now: () => number = Date.now): StatusCache {
	const entries = new Map<string, Entry>();

	return {
		get: (channel) => entries.get(channel)?.status,
		set(channel, status) {
			entries.set(channel, { status, at: now() });
		},
		isStale(channel) {
			const entry = entries.get(channel);

			return !entry || now() - entry.at > FRESH_MS;
		},
	};
}

export default createStatusCache;
