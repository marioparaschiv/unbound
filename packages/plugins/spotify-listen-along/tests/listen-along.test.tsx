import { render, startPlugin, toasts } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, test } from 'bun:test';

import { selfTest } from '~/index';

import { ActivityButtons, registerDiscord, synced } from './helpers/fake-discord';

import type { StoreSeeds } from '@unbound-app/api/testing';

const activity = { party: { id: 'spotify:42' } };

function stores(listening: unknown = null, connected = true): StoreSeeds {
	return {
		Spotify: {
			getActivity: () => listening,
			getActiveSocketAndDevice: () => ({}),
			hasConnectedAccount: () => connected,
		},
		SpotifyProtocol: { isProtocolRegistered: () => true },
		User: { getCurrentUser: () => ({ id: '1' }) },
	};
}

beforeEach(registerDiscord);

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

	test('syncs to the other person while you are already playing', async () => {
		const card = await renderCard({ stores: stores({ party: { id: 'spotify:7' } }) });

		card.act(() => card.find('IconButton').props.onPress?.());

		expect(synced).toEqual([[activity, '42']]);
	});

	test('explains why it refuses to listen along to yourself', async () => {
		const card = await renderCard({
			stores: { ...stores(), User: { getCurrentUser: () => ({ id: '42' }) } },
		});

		card.act(() => card.find('IconButton').props.onPress?.());

		expect(toasts.shown).toMatchObject([
			{ content: 'Listen along with someone else, not yourself.' },
		]);
		expect(synced).toEqual([]);
	});
});

describe('self test', () => {
	test('passes once the plugin has started', async () => {
		await startPlugin();

		expect(selfTest()).toMatchObject({ ok: true });
	});
});
