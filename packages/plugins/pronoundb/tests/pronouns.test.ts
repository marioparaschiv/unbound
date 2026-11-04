import { resetHealth } from '@unbound-plugins/shared/lifecycle/health';
import { flux, metro, startPlugin, stopPlugin } from '@unbound-app/api/testing';
import { settings } from '@unbound-app/settings';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { selfTest } from '~/index';

// Health is module state that earlier tests in this process left behind.
beforeEach(() => {
	resetHealth();
});

type Author = { id: string; username: string; bot?: boolean };
type Row = { message: { timestamp: string; timestampAccessibilityLabel: string } };

const realFetch = globalThis.fetch;

const MessageRowData = {
	generateMessageRowData: (_data: { message: unknown }): Row => ({
		message: { timestamp: '21:02', timestampAccessibilityLabel: '21:02' },
	}),
};

function render(author: Author, type = 0) {
	return MessageRowData.generateMessageRowData({
		message: { id: 'm1', channel_id: 'c1', type, author },
	}).message;
}

function seedStores(profilePronouns?: string) {
	flux.seed({
		Channel: { getChannel: () => undefined },
		User: { getCurrentUser: () => ({ id: 'me' }) },
		Message: { emitChange: () => resolveLookup() },
		UserProfile: {
			getUserProfile: () => ({ pronouns: profilePronouns }),
			getGuildMemberProfile: () => undefined,
		},
	});
}

function answerPronounDB(sets: Record<string, string[]>) {
	globalThis.fetch = (async () =>
		Response.json(
			Object.fromEntries(Object.entries(sets).map(([id, en]) => [id, { sets: { en } }])),
		)) as unknown as typeof fetch;
}

// The plugin redraws rows through `MessageStore.emitChange` once a batch of lookups lands, so that call is the signal to wait for.
let resolveLookup: () => void = () => {};

function lookupLands(): Promise<void> {
	return new Promise((resolve) => {
		resolveLookup = resolve;
	});
}

beforeEach(async () => {
	metro.register(MessageRowData);
	seedStores();
	answerPronounDB({});
	await startPlugin();
});

afterEach(() => {
	globalThis.fetch = realFetch;
});

describe('pronouns in the message header', () => {
	test('shows the pronouns from the author’s Discord profile', () => {
		seedStores('she/her');

		expect(render({ id: 'u1', username: 'u1' })).toEqual({
			timestamp: '21:02 • she/her',
			timestampAccessibilityLabel: '21:02 • she/her',
		});
	});

	test('shows PronounDB pronouns once they are fetched', async () => {
		answerPronounDB({ u1: ['he'] });

		const landed = lookupLands();

		expect(render({ id: 'u1', username: 'u1' }).timestamp).toBe('21:02');

		await landed;

		expect(render({ id: 'u1', username: 'u1' }).timestamp).toBe('21:02 • he/him');
	});

	test('capitalizes them on request', async () => {
		settings.format = 'capitalized';
		answerPronounDB({ u1: ['they'] });

		const landed = lookupLands();

		render({ id: 'u1', username: 'u1' });
		await landed;

		expect(render({ id: 'u1', username: 'u1' }).timestamp).toBe('21:02 • They/Them');
	});

	test('prefers the Discord profile when the source is Discord', async () => {
		settings.priority = 'discord';
		seedStores('xe/xem');
		answerPronounDB({ u1: ['he'] });

		const landed = lookupLands();

		render({ id: 'u1', username: 'u1' });
		await landed;

		expect(render({ id: 'u1', username: 'u1' }).timestamp).toBe('21:02 • xe/xem');
	});

	test('hides your own pronouns when Show for Yourself is off', () => {
		seedStores('she/her');
		settings.showSelf = false;

		expect(render({ id: 'me', username: 'me' }).timestamp).toBe('21:02');
		expect(render({ id: 'u1', username: 'u1' }).timestamp).toBe('21:02 • she/her');
	});

	test('skips bots and messages without an author header', () => {
		seedStores('she/her');

		expect(render({ id: 'b1', username: 'b1', bot: true }).timestamp).toBe('21:02');
		expect(render({ id: 'u1', username: 'u1' }, 46).timestamp).toBe('21:02');
	});

	test('shows no pronouns in headers built after the plugin stops', async () => {
		seedStores('she/her');
		await stopPlugin();

		expect(render({ id: 'u1', username: 'u1' }).timestamp).toBe('21:02');
	});

	test('reports its patch applied to the self test', async () => {
		expect((await selfTest()).ok).toBe(true);
	});
});
