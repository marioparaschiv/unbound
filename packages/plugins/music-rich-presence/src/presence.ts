import { flux, storage } from '@unbound-app/api';

import { resolveActivity } from '~/activity';
import { DISCORD_APP_ID, PLUGIN_NAME, POLL_INTERVAL_MS, SOCKET_ID } from '~/constants';
import { AssetManager, PresenceStore, SelfPresenceStore, UserStore, settings } from '~/modules';
import { canQuery, readPreferences } from '~/preferences';
import { LastFmScrobbler } from '~/scrobblers/lastfm';
import { createListenBrainz } from '~/scrobblers/listenbrainz';
import { createPresenceSync, type Schedule } from '~/sync';
import type { Activity, Fetcher, PresenceActivity } from '~/types';

const SETTINGS_REFRESH_MS = 750;

async function resolveAsset(key: string): Promise<string | undefined> {
	try {
		return (await AssetManager.fetchAssetIds(DISCORD_APP_ID, [key]))[0] ?? undefined;
	} catch (error) {
		console.error(`[${PLUGIN_NAME}] Failed to resolve the ${key} asset:`, error);
		return undefined;
	}
}

function ownActivities(): PresenceActivity[] {
	const userId = UserStore.getCurrentUser()?.id;

	return [
		...(SelfPresenceStore.getActivities?.() ?? []),
		...((userId && PresenceStore.getActivities?.(userId)) || []),
	];
}

function loadLocalActivityStore() {
	try {
		if (flux.getStore('LocalActivity', { lazy: false })) return;
	} catch {}

	console.warn(`[${PLUGIN_NAME}] LocalActivityStore was not found; sending the activity anyway.`);
}

function dispatchActivity(activity: Activity | null) {
	void flux.dispatch({ type: 'LOCAL_ACTIVITY_UPDATE', activity, socketId: SOCKET_ID });
}

const scheduleTimeout: Schedule = (callback, delay) => {
	const timer = setTimeout(callback, delay);

	return () => clearTimeout(timer);
};

/**
 * @description Polls the chosen scrobbler and keeps the Rich Presence activity in sync with what is playing.
 * @returns A function that stops polling and clears the activity.
 */
export function syncPresence(): () => void {
	const listenBrainz = createListenBrainz();
	const fetcher = fetch as unknown as Fetcher;

	async function query(): Promise<Activity | null> {
		const preferences = readPreferences(settings.get);

		if (!canQuery(preferences)) return null;

		const scrobbler =
			preferences.scrobblerBackend === 'lastfm' ? LastFmScrobbler : listenBrainz.scrobbler;

		return resolveActivity(
			preferences,
			ownActivities(),
			scrobbler,
			fetcher,
			resolveAsset,
		).catch((error: unknown) => {
			console.error(`[${PLUGIN_NAME}] Failed to query ${scrobbler.name}:`, error);
			return null;
		});
	}

	loadLocalActivityStore();

	const sync = createPresenceSync({
		query,
		dispatch: dispatchActivity,
		schedule: scheduleTimeout,
		refreshDelay: SETTINGS_REFRESH_MS,
	});
	const interval = setInterval(() => void sync.poll(), POLL_INTERVAL_MS);
	const unsubscribe = storage.onChange(
		(payload) => payload.store === addon.id,
		(payload) => {
			if (payload.key?.startsWith('instance')) listenBrainz.invalidate();

			sync.refresh();
		},
	);

	void sync.poll();

	return () => {
		clearInterval(interval);
		unsubscribe();
		sync.stop();
	};
}
