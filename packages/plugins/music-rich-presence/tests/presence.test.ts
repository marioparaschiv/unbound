import { flux, metro, startPlugin, stopPlugin } from '@unbound-app/api/testing';
import { resetHealth } from '@unbound-plugins/shared/lifecycle/health';
import { settings } from '@unbound-app/settings';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { selfTest } from '~/index';

const nowPlaying = {
	recenttracks: {
		track: [
			{
				name: 'Song',
				url: 'https://www.last.fm/music/AB/_/Song',
				artist: { '#text': 'AB' },
				album: { '#text': 'Album' },
				image: [],
				'@attr': { nowplaying: 'true' },
			},
		],
	},
};

const realFetch = globalThis.fetch;

async function flush() {
	// The poll awaits the fetch and its JSON before it dispatches.
	for (let i = 0; i < 20; i++) await Promise.resolve();
}

beforeEach(() => {
	resetHealth();
	globalThis.fetch = (async () => ({
		ok: true,
		status: 200,
		statusText: 'OK',
		json: async () => nowPlaying,
	})) as unknown as typeof fetch;
	metro.register({ fetchAssetIds: async () => [], getAssetIds: () => [] });
	flux.seed({
		User: { getCurrentUser: () => ({ id: '1' }) },
		SelfPresence: { getActivities: () => [] },
		Presence: { getActivities: () => [] },
		LocalActivity: {},
	});
});

afterEach(() => {
	globalThis.fetch = realFetch;
});

describe('the presence', () => {
	test('shows what is playing on Last.fm as an activity', async () => {
		settings.username = 'rini';
		await startPlugin();
		await flush();

		expect(flux.dispatched).toMatchObject([
			{
				type: 'LOCAL_ACTIVITY_UPDATE',
				activity: { name: 'some music', details: 'Song', state: 'AB' },
			},
		]);
	});

	test('stays quiet without a username', async () => {
		await startPlugin();
		await flush();

		expect(flux.dispatched).toEqual([]);
	});

	test('clears the activity when the plugin stops', async () => {
		settings.username = 'rini';
		await startPlugin();
		await flush();
		await stopPlugin();

		expect(flux.dispatched.at(-1)).toMatchObject({
			type: 'LOCAL_ACTIVITY_UPDATE',
			activity: null,
		});
	});

	test('reports the presence in its self-test once started', async () => {
		await startPlugin();

		expect(selfTest()).toEqual({ ok: true, detail: '1 feature applied' });
	});
});
