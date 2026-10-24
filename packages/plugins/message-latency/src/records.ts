import {
	latencyDetails,
	latencyTooltip,
	type LatencyDetails,
	type LatencyMessage,
} from '~/latency';
import { Defaults, MAX_LATENCY_RECORDS } from '~/constants';
import { settings, UserStore } from '~/modules';

export type LatencyRecord = {
	details: LatencyDetails;
	tooltip: string;
	username: string;
};

export type LatencyRecords = {
	get(messageId: string): LatencyRecord | undefined;
	update(message: LatencyMessage, username?: string): void;
	subscribe(listener: (messageId: string) => void): () => void;
	clear: () => void;
};

function readOptions() {
	return {
		latency: settings.get('latency', Defaults.latency),
		showMillis: settings.get('showMillis', Defaults.showMillis),
		ignoreSelf: settings.get('ignoreSelf', Defaults.ignoreSelf),
		detectDiscordKotlin: settings.get('detectDiscordKotlin', Defaults.detectDiscordKotlin),
	};
}

/**
 * @description Creates the cache of measured messages, keeping the most recently seen ones.
 * @returns The cache, which tells its subscribers which message's record changed.
 */
export function createLatencyRecords(): LatencyRecords {
	// A Map iterates in insertion order, so re-inserting on update keeps the oldest entry first.
	const records = new Map<string, LatencyRecord>();
	const listeners = new Set<(messageId: string) => void>();

	function notify(messageId: string) {
		for (const listener of listeners) listener(messageId);
	}

	function update(message: LatencyMessage, username?: string) {
		if (message.id == null || message.nonce == null) return;

		const messageId = String(message.id);
		const details = latencyDetails(message, UserStore.getCurrentUser()?.id, readOptions());

		if (!details) {
			if (records.delete(messageId)) notify(messageId);

			return;
		}

		const name = username || message.author?.username || records.get(messageId)?.username;

		if (!name) return;

		records.delete(messageId);
		records.set(messageId, { details, tooltip: latencyTooltip(details), username: name });

		for (const oldest of records.keys()) {
			if (records.size <= MAX_LATENCY_RECORDS) break;

			records.delete(oldest);
		}

		notify(messageId);
	}

	return {
		get: (messageId) => records.get(messageId),
		update,
		subscribe(listener) {
			listeners.add(listener);

			return () => void listeners.delete(listener);
		},
		clear: () => records.clear(),
	};
}

export default { createLatencyRecords };
