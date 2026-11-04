import { recordApplied } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { settings } from '@unbound-app/settings';
import { flux, storage } from '@unbound-app/api';

import { resolveActivity } from '~/presence/activity';
import { DISCORD_APP_ID, PLUGIN_NAME, POLL_INTERVAL_MS, SOCKET_ID } from '~/constants';
import { AssetManager, PresenceStore, SelfPresenceStore, UserStore } from '~/presence/modules';
import { canQuery, readPreferences } from '~/presence/preferences';
import { LastFmScrobbler } from '~/presence/scrobblers/lastfm';
import { createListenBrainz } from '~/presence/scrobblers/listenbrainz';
import { createPresenceSync, type Schedule } from '~/presence/sync';
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

let sync: ReturnType<typeof createPresenceSync> | undefined;

/**
 * @description Polls the chosen scrobbler and keeps the Rich Presence activity in sync with what is playing.
 * Reads the user and presence stores and Discord's asset manager, and sends activities as `LOCAL_ACTIVITY_UPDATE`
 * actions. The Addon scope clears the poll timer and the settings listener; `stopPresence` clears the activity.
 */
export function startPresence(): void {
	if (!ensureModules(PLUGIN_NAME, { UserStore })) return;

	const listenBrainz = createListenBrainz();
	const fetcher = fetch as unknown as Fetcher;

	async function query(): Promise<Activity | null> {
		const preferences = readPreferences(settings);

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

	const current = createPresenceSync({
		query,
		dispatch: dispatchActivity,
		schedule: scheduleTimeout,
		refreshDelay: SETTINGS_REFRESH_MS,
	});

	sync = current;

	setInterval(() => void current.poll(), POLL_INTERVAL_MS);
	storage.onChange(
		(payload) => payload.store === addon.id,
		(payload) => {
			if (payload.key?.startsWith('instance')) listenBrainz.invalidate();

			current.refresh();
		},
	);

	void current.poll();
	recordApplied(1);
}

/**
 * @description Stops the poll for good and clears the activity the plugin sent, which the Addon scope cannot see.
 */
export function stopPresence(): void {
	sync?.stop();
	sync = undefined;
}
