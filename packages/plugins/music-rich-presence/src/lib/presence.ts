import { settings } from '@unbound-app/settings';
import { flux, metro, storage } from '@unbound-app/api';

import { resolveActivity } from '~/lib/activity';
import { DISCORD_APP_ID, POLL_INTERVAL_MS, SOCKET_ID } from '~/lib/constants';
import { canQuery, readPreferences } from '~/lib/preferences';
import { LastFmScrobbler } from '~/lib/lastfm';
import { createListenBrainz } from '~/lib/listenbrainz';
import { createPresenceSync, type Schedule } from '~/lib/sync';
import type { Activity, Fetcher, PresenceActivity } from '~/lib/types';

type AssetManager = {
	fetchAssetIds(applicationId: string, keys: string[]): Promise<(string | undefined)[]>;
};

type PresenceSync = ReturnType<typeof createPresenceSync>;

const SETTINGS_REFRESH_MS = 750;

const SelfPresenceStore = flux.getStore('SelfPresence') as ReturnType<typeof flux.getStore> & {
	getActivities?: () => PresenceActivity[] | undefined;
};

const PresenceStore = flux.getStore('Presence') as ReturnType<typeof flux.getStore> & {
	getActivities?: (userId: string) => PresenceActivity[] | undefined;
};

const UserStore = flux.getStore('User');

// The running poll, which `stopPresence` ends.
let current: PresenceSync | undefined;

async function resolveAsset(
	assets: AssetManager | undefined,
	key: string,
): Promise<string | undefined> {
	if (!assets) return undefined;

	try {
		return (await assets.fetchAssetIds(DISCORD_APP_ID, [key]))[0] ?? undefined;
	} catch (error) {
		logger.error(`Failed to resolve the ${key} asset:`, error);
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

	logger.warn('LocalActivityStore was not found; sending the activity anyway.');
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
 * Reads the user and presence stores and Discord's asset manager, and sends activities as `LOCAL_ACTIVITY_UPDATE`
 * actions. The Addon scope clears the poll timer and the settings listener; `stopPresence` clears the activity.
 */
export function startPresence(): void {
	const assets: AssetManager | undefined = metro.findByProps('fetchAssetIds', 'getAssetIds');

	if (!assets) {
		logger.warn('Album art skipped: Discord moved fetchAssetIds.');
	}

	const listenBrainz = createListenBrainz();
	const fetcher = fetch as unknown as Fetcher;

	async function query(): Promise<Activity | null> {
		const preferences = readPreferences(settings);

		if (!canQuery(preferences)) return null;

		const scrobbler =
			preferences.scrobblerBackend === 'lastfm' ? LastFmScrobbler : listenBrainz.scrobbler;

		return resolveActivity(preferences, ownActivities(), scrobbler, fetcher, (key) =>
			resolveAsset(assets, key),
		).catch((error: unknown) => {
			logger.error(`Failed to query ${scrobbler.name}:`, error);
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

	current = sync;
	setInterval(() => void sync.poll(), POLL_INTERVAL_MS);
	storage.onChange(
		(payload) => payload.store === addon.id,
		(payload) => {
			if (payload.key?.startsWith('instance')) listenBrainz.invalidate();

			sync.refresh();
		},
	);

	void sync.poll();
}

/**
 * @description Stops the poll for good and clears the activity the plugin sent, which the Addon scope cannot see.
 */
export function stopPresence(): void {
	current?.stop();
	current = undefined;
}
