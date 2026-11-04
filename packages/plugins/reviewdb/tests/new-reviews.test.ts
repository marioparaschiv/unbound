import { stopPlugin, toasts } from '@unbound-app/api/testing';
import { settings } from '@unbound-app/settings';
import { startReviewdb } from './start-reviewdb';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

// ReviewDB's server is outside Unbound and Discord, so its response is the one thing faked.
const realFetch = globalThis.fetch;

function account(lastReviewID: number) {
	globalThis.fetch = (() =>
		Promise.resolve(
			Response.json({ discordID: '1', lastReviewID }),
		)) as unknown as typeof fetch;
}

async function start() {
	await startReviewdb();
	await Bun.sleep(5);
}

beforeEach(() => {
	settings.token = 'token';
});

afterEach(async () => {
	globalThis.fetch = realFetch;
	await stopPlugin();
});

describe('checking for new reviews at start', () => {
	test('tells you when your profile got reviews since the last start', async () => {
		settings.lastReviewId = 4;
		account(7);
		await start();

		expect(toasts.shown).toMatchObject([{ content: 'You have new reviews on your profile!' }]);
		expect(settings.lastReviewId).toBe(7);
	});

	test('stays quiet when there is nothing new', async () => {
		settings.lastReviewId = 7;
		account(7);
		await start();

		expect(toasts.shown).toEqual([]);
	});

	test('stays quiet when notifications are off', async () => {
		settings.notifyReviews = false;
		settings.lastReviewId = 4;
		account(7);
		await start();

		expect(toasts.shown).toEqual([]);
	});

	test('does not ask ReviewDB when you have not signed in', async () => {
		settings.token = '';
		account(7);
		await start();

		expect(toasts.shown).toEqual([]);
		expect(settings.lastReviewId).toBe(0);
	});
});
