import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { metro, patches, startPlugin, stopPlugin } from '@unbound-app/api/testing';

// The testing kit's react-native has no AppState or NativeModules, which this plugin reads for the
// foreground event and the device locale.
const appState = new Set<(state: string) => void>();
const device = { locale: 'en_AU' };

mock.module('react-native', () => ({
	View: 'View',
	NativeModules: {
		get SettingsManager() {
			return { settings: { AppleLocale: device.locale } };
		},
	},
	AppState: {
		addEventListener: (_event: string, listener: (state: string) => void) => {
			appState.add(listener);

			return { remove: () => appState.delete(listener) };
		},
	},
}));

const sent: string[] = [];
const rotations: number[] = [];
const objc = {
	getClass: () => ({}),
	batch: async () => [{}, {}, {}],
	invokeAsync: async (_layer: unknown, _selector: string, [radians]: [number, string]) => {
		rotations.push(Math.round((radians * 180) / Math.PI));
	},
};

const Messages = {
	sendMessage: (_channelId: string, message: { content: string }) =>
		void sent.push(message.content),
	editMessage: (_channelId: string, _messageId: string, message: { content: string }) =>
		void sent.push(message.content),
	receiveMessage: () => {},
};

beforeEach(() => {
	sent.length = 0;
	rotations.length = 0;
	appState.clear();
	device.locale = 'en_AU';
	metro.register(Messages);
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

async function startAussie() {
	await startPlugin({ native: { objc } as never });
	await settle();
}

describe('on an Australian device', () => {
	test('turns a message you send or edit upside down', async () => {
		await startAussie();

		Messages.sendMessage('1', { content: 'please wait a moment' });
		Messages.editMessage('1', '2', { content: 'hello' });

		expect(sent).toEqual(['ʇuǝɯoɯ ɐ ʇᴉɐʍ ǝsɐǝld', 'ollǝɥ']);
		expect(patches.applied.map(({ method }) => method).toSorted()).toEqual([
			'editMessage',
			'sendMessage',
		]);
		await stopPlugin();
	});

	test('turns the screen over, again on returning to the foreground, and back on stop', async () => {
		await startAussie();

		for (const listener of appState) {
			listener('background');
			listener('active');
		}

		await stopPlugin();
		await settle();

		expect(rotations).toEqual([180, 180, 0]);
		expect(appState.size).toBe(0);
	});

	test('reports a rotation that fails instead of throwing', async () => {
		const error = console.error;
		const reported: unknown[][] = [];

		console.error = (...args) => void reported.push(args);

		try {
			await startPlugin({
				native: {
					objc: {
						...objc,
						getClass: () => {
							throw new Error('no decor view');
						},
					},
				} as never,
			});
			await settle();
			await stopPlugin();
		} finally {
			console.error = error;
		}

		expect(reported.length).toBeGreaterThan(0);
	});
});

test('does nothing on a device that is not set to Australian English', async () => {
	device.locale = 'en_US';
	await startAussie();

	Messages.sendMessage('1', { content: 'hello' });

	expect(sent).toEqual(['hello']);
	expect(rotations).toEqual([]);
	expect(patches.applied).toEqual([]);
	await stopPlugin();
});

test('accepts Australian English in either separator form and with extensions', async () => {
	const { isAussieLocale } = await import('~/locale');

	for (const locale of ['en-AU', 'en_AU', 'en-AU-u-ca-gregory']) {
		expect(isAussieLocale(locale)).toBe(true);
	}
	for (const locale of ['en-US', 'en-AUS', 'de-AT', '']) {
		expect(isAussieLocale(locale)).toBe(false);
	}
});

test('reads the locale from the TurboModule constants when the property is missing', async () => {
	const { deviceLocale } = await import('~/locale/android/device-locale');

	expect(
		deviceLocale({ I18nManager: { getConstants: () => ({ localeIdentifier: 'en_AU' }) } }),
	).toBe('en_AU');
});

test('prefers the legacy property and survives a missing module', async () => {
	const { deviceLocale } = await import('~/locale/android/device-locale');

	expect(
		deviceLocale({
			I18nManager: {
				localeIdentifier: 'en_GB',
				getConstants: () => ({ localeIdentifier: 'en_AU' }),
			},
		}),
	).toBe('en_GB');
	expect(deviceLocale({})).toBeUndefined();
});
