import { metro, render, stopPlugin, toasts } from '@unbound-app/api/testing';
import { SettingsPanel, settings } from '@unbound-app/settings';
import { messages } from '@unbound-app/i18n';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { AUTH_REDIRECT_URI } from '~/constants';

import { startReviewdb } from './helpers/start-reviewdb';

const realFetch = globalThis.fetch;
const sheets: { key: string; load: Promise<{ default: unknown }> }[] = [];

function titles(view: ReturnType<typeof render>) {
	return view.findAll('ButtonRow').map((row) => row.props.title);
}

function row(view: ReturnType<typeof render>, title: string) {
	return view.findAll('ButtonRow').find((node) => node.props.title === title)!;
}

beforeEach(async () => {
	sheets.length = 0;
	metro.register({
		openLazy: (load: Promise<{ default: unknown }>, key: string) =>
			void sheets.push({ key, load }),
		hideActionSheet: () => {},
	});
	await startReviewdb();
});

afterEach(async () => {
	globalThis.fetch = realFetch;
	await stopPlugin();
});

describe('the sign-in rows', () => {
	test('offer to authorize until there is a token, then to authorize again', () => {
		settings.token = '';

		const view = render(<SettingsPanel />);

		expect(titles(view)).toContain(messages.AUTHORIZE);
		expect(titles(view)).not.toContain(messages.REAUTHORIZE);

		view.act(() => void (settings.token = 'token'));

		expect(titles(view)).toContain(messages.REAUTHORIZE);
		expect(titles(view)).not.toContain(messages.AUTHORIZE);
	});

	test('pressing Authorize stores the token Discord’s sign-in grants', async () => {
		settings.token = '';
		metro.register({
			openOAuth2Modal: ({ callback }: { callback: (result: { location: string }) => void }) =>
				callback({ location: `${AUTH_REDIRECT_URI}?code=abc` }),
		});
		globalThis.fetch = (() =>
			Promise.resolve(Response.json({ token: 'granted' }))) as unknown as typeof fetch;

		const view = render(<SettingsPanel />);

		await view.act(async () => {
			await row(view, messages.AUTHORIZE).props.onPress?.();
		});

		expect(settings.token).toBe('granted');
		expect(toasts.shown).toMatchObject([{ content: messages.LOGIN_SUCCESS }]);
	});
});

describe('the blocked users row', () => {
	test('is disabled until there is a token', () => {
		settings.token = '';

		const view = render(<SettingsPanel />);

		expect(row(view, messages.MANAGE_BLOCKED_USERS).props.disabled).toBe(true);

		view.act(() => void (settings.token = 'token'));

		expect(row(view, messages.MANAGE_BLOCKED_USERS).props.disabled).toBe(false);
	});

	test('opens the blocked users sheet', async () => {
		settings.token = 'token';

		const view = render(<SettingsPanel />);

		await view.act(async () => {
			await row(view, messages.MANAGE_BLOCKED_USERS).props.onPress?.();
		});

		expect(sheets).toHaveLength(1);
	});
});
