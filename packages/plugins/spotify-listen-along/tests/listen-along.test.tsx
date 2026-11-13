import { logs, metro, render, startPlugin, toasts } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, test } from 'bun:test';

import { ActivityButtons, registerDiscord } from './helpers/fake-discord';

import type { StoreSeeds } from '@unbound-app/api/testing';

const activity = {
	party: { id: 'spotify:42' },
	sync_id: 'track',
	timestamps: { start: Date.now() },
};
const requests: string[] = [];

function stores(connected = true): StoreSeeds {
	return {
		Spotify: {
			getActivity: () => null,
			getActiveSocketAndDevice: () => null,
			hasConnectedAccount: () => connected,
		},
		ConnectedAccounts: { getAccounts: () => [{ id: 'sp', type: 'spotify' }] },
		Presence: { getActivities: () => [activity] },
		User: { getCurrentUser: () => ({ id: '1' }) },
	};
}

beforeEach(() => {
	registerDiscord();
	requests.length = 0;
	globalThis.fetch = (async (url: string, init?: RequestInit) => {
		requests.push(`${init?.method ?? 'GET'} ${url.replace('https://api.spotify.com/v1', '')}`);

		return new Response(
			JSON.stringify({ devices: [{ id: 'phone', is_active: true, is_restricted: false }] }),
			{ status: 200 },
		);
	}) as typeof fetch;
});

async function renderCard(options: { activity?: unknown; stores?: StoreSeeds } = {}) {
	await startPlugin();

	return render(<ActivityButtons.PlayOnSpotifyButton activity={activity} />, {
		stores: options.stores ?? stores(),
	});
}

describe('Listen Along button', () => {
	test('sits beside Discord’s own Spotify button', async () => {
		const card = await renderCard();

		expect(card.find('IconButton').props.accessibilityLabel).toBe('Listen Along');
		expect(card.text()).toBe('Play on Spotify');
	});

	test('is left off an activity that has no party to join', async () => {
		await startPlugin();

		const card = render(<ActivityButtons.PlayOnSpotifyButton activity={{}} />, {
			stores: stores(),
		});

		expect(card.findAll('IconButton')).toEqual([]);
	});

	test('plays their track on your Spotify and turns into a stop button', async () => {
		const card = await renderCard();

		card.act(() => card.find('IconButton').props.onPress?.());
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(requests).toEqual(['GET /me/player/devices', 'PUT /me/player/play?device_id=phone']);
		expect(card.find('IconButton').props.accessibilityLabel).toBe('Stop listening along');
	});

	test('explains why it refuses to listen along to yourself', async () => {
		const card = await renderCard({
			stores: { ...stores(), User: { getCurrentUser: () => ({ id: '42' }) } },
		});

		card.act(() => card.find('IconButton').props.onPress?.());

		expect(toasts.shown).toMatchObject([
			{ content: 'Listen along with someone else, not yourself.' },
		]);
		expect(requests).toEqual([]);
	});
});

describe('start', () => {
	test('passes without a warning once the plugin has started', async () => {
		await startPlugin();

		expect(logs.entries.filter(({ level }) => level !== 'info')).toEqual([]);
	});

	test('skips the button with one warning when Discord moved PlayOnSpotifyButton', async () => {
		metro.markMissing('PlayOnSpotifyButton');
		await startPlugin();

		expect(logs.entries).toContainEqual({
			level: 'warn',
			args: ['Listen along skipped: Discord moved PlayOnSpotifyButton.'],
		});
	});
});
