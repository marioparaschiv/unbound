import { metro, toasts } from '@unbound-app/api/testing';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { settings } from '@unbound-app/settings';

import { copyTranslation } from '~/translate/translate';

const clipboard = { text: '' };
const realFetch = globalThis.fetch;

function respond(status: number, body: unknown) {
	globalThis.fetch = (() =>
		Promise.resolve(
			new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }),
		)) as unknown as typeof fetch;
}

beforeEach(() => {
	clipboard.text = '';
	metro.register({
		setString: (text: string) => (clipboard.text = text),
		getString: () => '',
		setImage: () => undefined,
		getImage: () => undefined,
	});
	settings.accessToken = 'access';
	settings.refreshToken = 'refresh';
	settings.expiresAt = Date.now() + 3_600_000;
});

afterEach(() => {
	globalThis.fetch = realFetch;
});

describe('translating a message', () => {
	test('copies the translation and shows it', async () => {
		respond(200, { translatedText: 'Hallo' });

		await copyTranslation('Hello');

		expect(clipboard.text).toBe('Hallo');
		expect(toasts.shown).toMatchObject([{ title: 'Translated', content: 'Hallo' }]);
	});

	test('says why the service refused', async () => {
		respond(500, 'overloaded');

		await copyTranslation('Hello');

		expect(clipboard.text).toBe('');
		expect(toasts.shown).toMatchObject([
			{ title: 'Translate Error', content: 'Translate failed (500): overloaded' },
		]);
	});

	test('asks the user to log in when there is no session', async () => {
		settings.refreshToken = '';
		settings.accessToken = '';

		await copyTranslation('Hello');

		expect(toasts.shown).toMatchObject([
			{
				title: 'Translate Error',
				content: 'No refresh token configured. Open plugin settings and complete login.',
			},
		]);
	});
});
