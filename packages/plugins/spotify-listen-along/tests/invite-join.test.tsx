import { render, startPlugin, toasts } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, test } from 'bun:test';

import { endSessions } from '~/lib/session';

import {
	discordJoins,
	MessagesRenderer,
	registerDiscord,
	type JoinEvent,
} from './helpers/fake-discord';

import type { StoreSeeds } from '@unbound-app/api/testing';

const playing = {
	party: { id: 'spotify:42' },
	sync_id: 'track',
	timestamps: { start: Date.now() },
};
const messages: Record<string, { activity?: { party_id?: string } }> = {
	spotify: { activity: { party_id: 'spotify:42' } },
	game: { activity: { party_id: 'game:7' } },
	mine: { activity: { party_id: 'spotify:1' } },
};

function stores(activities: unknown[] = [playing]): StoreSeeds {
	return {
		Spotify: { getActivity: () => null, hasConnectedAccount: () => true },
		ConnectedAccounts: { getAccounts: () => [{ id: 'sp', type: 'spotify' }] },
		Presence: { getActivities: () => activities },
		User: { getCurrentUser: () => ({ id: '1' }) },
		SelectedChannel: { getChannelId: () => 'channel' },
		Message: { getMessage: (_channel: string, id: string) => messages[id] },
	};
}

beforeEach(() => {
	endSessions();
	registerDiscord();
	globalThis.fetch = (async () =>
		new Response(JSON.stringify({ devices: [{ id: 'phone', is_active: true }] }), {
			status: 200,
		})) as unknown as typeof fetch;
});

async function tapJoin(messageId: string, seeds = stores()) {
	await startPlugin();

	const chat = render(<MessagesRenderer.default />, { stores: seeds });
	const props = chat.find('Chat').props as { onTapJoinRichPresence: (event: JoinEvent) => void };

	props.onTapJoinRichPresence({ nativeEvent: { messageId } });
}

describe('Join on a chat invite', () => {
	test('listens along with the Spotify host instead of only opening Spotify', async () => {
		await tapJoin('spotify');

		expect(discordJoins).toEqual([]);
		expect(toasts.shown).toEqual([]);
	});

	test('leaves other invites to Discord', async () => {
		await tapJoin('game');

		expect(discordJoins).toHaveLength(1);
	});

	test('says so when the host stopped playing', async () => {
		await tapJoin('spotify', stores([]));

		expect(toasts.shown).toMatchObject([
			{ content: "They stopped playing, so there's nothing to listen along to." },
		]);
		expect(discordJoins).toEqual([]);
	});

	test('refuses your own invite', async () => {
		await tapJoin('mine');

		expect(toasts.shown).toMatchObject([
			{ content: 'Listen along with someone else, not yourself.' },
		]);
	});
});
