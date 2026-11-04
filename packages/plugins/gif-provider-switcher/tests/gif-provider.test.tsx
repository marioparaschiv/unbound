import { flux, metro, render, startPlugin } from '@unbound-app/api/testing';
import { settings } from '@unbound-app/settings';
import { afterEach, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { memo } from 'react';
import { Text, TextInput, View } from 'react-native';

// The testing kit has no fake of Discord's design components, so the button is a plain component.
mock.module('@unbound-app/api/metro/components', () => ({
	Discord: {
		Button: function Button({ text, onPress }: { text: string; onPress: () => void }) {
			return <Text onPress={onPress}>{text}</Text>;
		},
	},
}));

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

beforeAll(() => {
	metro.register(REST);
	metro.register({ default: GIFPickerHeader }, 'modules/gif_picker/native/GIFPickerHeader.tsx');
});

beforeEach(() => {
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
		expect(view.find('Button').text()).toBe('Tenor');
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

		const { stop } = await import('~/index');

		view.act(() => stop());

		expect(view.find('TextInput').props.placeholder).toBe('Search Klipy');
		expect(() => view.find('Button')).toThrow();
	});
});
