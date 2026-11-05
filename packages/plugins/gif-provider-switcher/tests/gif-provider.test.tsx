import { flux, metro, render, startPlugin, stopPlugin } from '@unbound-app/api/testing';
import { resetHealth } from '@unbound-plugins/shared/lifecycle/health';
import { settings } from '@unbound-app/settings';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { memo } from 'react';
import { TextInput, View } from 'react-native';

import { selfTest } from '~/index';

type Request = { url: string; query?: Record<string, unknown> };

const calls: string[] = [];
const REST = {
	getAPIBaseURL: () => '',
	get: (request: Request) => {
		calls.push(`discord ${request.url}`);

		return Promise.resolve({ ok: true, body: ['from discord'] });
	},
	post: (request: Request) => Promise.resolve({ ok: true, body: request.url }),
};

const GIFPickerHeader = memo(
	({ onQueryChange: _ }: { onQueryChange?: (query: string) => void }) => (
		<View>
			<TextInput placeholder='Search Klipy' />
		</View>
	),
);

const realFetch = globalThis.fetch;

beforeEach(() => {
	resetHealth();
	metro.register(REST);
	metro.register({ default: GIFPickerHeader }, 'modules/gif_picker/native/GIFPickerHeader.tsx');
	calls.length = 0;
	flux.seed({ Locale: { locale: 'en-US' }, GIFPickerView: { getQuery: () => '' } });
	globalThis.fetch = (async (url: string) => {
		calls.push(`fetch ${new URL(url).host}`);

		return Response.json({ results: ['cat', 'cats'] });
	}) as typeof fetch;
});

afterEach(() => {
	globalThis.fetch = realFetch;
});

describe('GIF requests', () => {
	test('are answered by the picked provider instead of Discord', async () => {
		await startPlugin();

		const response = (await REST.get({ url: '/gifs/suggest', query: { q: 'ca' } })) as {
			body: string[];
		};

		expect(response.body).toEqual(['cat', 'cats']);
		expect(calls).toEqual(['fetch api.tenor.com']);
	});

	test('go to Discord unchanged with Klipy picked', async () => {
		settings.provider = 'klipy';
		await startPlugin();

		const response = (await REST.get({ url: '/gifs/suggest', query: { q: 'ca' } })) as {
			body: string[];
		};

		expect(response.body).toEqual(['from discord']);
		expect(calls).toEqual(['discord /gifs/suggest']);
	});

	test('go to Discord again, not to the provider, when the plugin stops', async () => {
		globalThis.fetch = (async () =>
			Response.json({
				tags: [{ searchterm: 'cat', image: 'cat.gif' }],
			})) as unknown as typeof fetch;
		await startPlugin();
		await REST.get({ url: '/gifs/trending', query: { locale: 'en-US' } });
		calls.length = 0;

		await stopPlugin();

		expect(calls).toEqual(['discord /gifs/trending']);
	});

	test('other requests are left alone', async () => {
		await startPlugin();

		expect(await REST.post({ url: '/channels/1/messages' })).toEqual({
			ok: true,
			body: '/channels/1/messages',
		});
	});
});

describe('the GIF picker header', () => {
	test('names the picked provider in the search field and adds a button to switch', async () => {
		await startPlugin();

		const view = render(<GIFPickerHeader />);

		expect(view.find('TextInput').props.placeholder).toBe('Search Tenor');
		expect(view.find('Button').props.text).toBe('Tenor');
	});

	test('switches to the next provider when the button is pressed', async () => {
		await startPlugin();

		const view = render(<GIFPickerHeader />);

		view.act(() => view.find('Button').props.onPress?.());

		expect(settings.provider).toBe('giphy');
		expect(view.find('TextInput').props.placeholder).toBe('Search Giphy');
	});

	test('drops the button and the new name once the plugin stops', async () => {
		await startPlugin();

		const view = render(<GIFPickerHeader />);

		await stopPlugin();
		view.rerender(<GIFPickerHeader />);

		expect(view.find('TextInput').props.placeholder).toBe('Search Klipy');
		expect(() => view.find('Button')).toThrow();
	});
});

describe('health', () => {
	test('the self test reports the picker and the requests applied', async () => {
		await startPlugin();

		expect(selfTest()).toEqual({ ok: true, detail: '2 features applied' });
	});
});
