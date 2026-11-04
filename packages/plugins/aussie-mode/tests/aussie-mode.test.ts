import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { metro, native, patches, startPlugin, stopPlugin } from '@unbound-app/api/testing';
import { AppState, NativeModules } from 'react-native';

const sent: string[] = [];
const appState = new Set<(state: string) => void>();

function setDeviceLocale(locale: string) {
	Object.assign(NativeModules, { SettingsManager: { settings: { AppleLocale: locale } } });
}

// A root view whose layer takes the rotation the plugin sets.
function registerScreen() {
	native.objc.registerClass('CALayer', { methods: { 'setValue:forKeyPath:': () => {} } });

	const layer = native.objc.create('CALayer');

	native.objc.registerClass('UIView', { methods: { layer: () => layer } });
	native.objc.registerClass('UIViewController', {
		methods: { view: () => native.objc.create('UIView') },
	});
	native.objc.registerClass('UIWindow', {
		methods: { rootViewController: () => native.objc.create('UIViewController') },
	});
	native.objc.registerClass('UIApplication', {
		classMethods: { sharedApplication: () => native.objc.create('UIApplication') },
		methods: { keyWindow: () => native.objc.create('UIWindow') },
	});
}

function rotations() {
	return native.calls
		.filter(({ name }) => name === 'setValue:forKeyPath:')
		.map(({ args }) => Math.round(((args[0] as number) * 180) / Math.PI));
}

const Messages = {
	sendMessage: (_channelId: string, message: { content: string }) =>
		void sent.push(message.content),
	editMessage: (_channelId: string, _messageId: string, message: { content: string }) =>
		void sent.push(message.content),
	receiveMessage: () => {},
};

beforeEach(() => {
	sent.length = 0;
	appState.clear();
	setDeviceLocale('en_AU');
	registerScreen();
	metro.register(Messages);
	// The kit's AppState never fires, so a test collects the listener to fire it.
	spyOn(AppState, 'addEventListener').mockImplementation(((
		_event: string,
		listener: (state: string) => void,
	) => {
		appState.add(listener);

		return { remove: () => appState.delete(listener) };
	}) as never);
});

afterEach(() => void delete (NativeModules as Record<string, unknown>).SettingsManager);

// The rotation awaits the bridge a few times, so a test lets those settle.
async function settle() {
	for (let i = 0; i < 20; i++) await Promise.resolve();
}

async function startAussie() {
	await startPlugin();
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

		expect(rotations()).toEqual([180, 180, 0]);
		expect(appState.size).toBe(0);
	});

	test('reports a rotation that fails instead of throwing', async () => {
		const error = spyOn(console, 'error').mockImplementation(() => {});

		// A device whose key window cannot be found.
		native.objc.registerClass('UIApplication', {
			classMethods: {
				sharedApplication: () => {
					throw new Error('no decor view');
				},
			},
		});
		await startAussie();
		await stopPlugin();

		expect(error).toHaveBeenCalled();
		error.mockRestore();
	});
});

test('does nothing on a device that is not set to Australian English', async () => {
	setDeviceLocale('en_US');
	await startAussie();

	Messages.sendMessage('1', { content: 'hello' });

	expect(sent).toEqual(['hello']);
	expect(rotations()).toEqual([]);
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

describe('on Android', () => {
	beforeEach(() => {
		native.setPlatform('android');
		spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => void delete (NativeModules as Record<string, unknown>).I18nManager);

	async function startWith(modules: Record<string, unknown>) {
		Object.assign(NativeModules, modules);
		await startAussie();

		const applied = patches.applied.length;

		await stopPlugin();

		return applied;
	}

	test('reads the locale from the TurboModule constants when the property is missing', async () => {
		const applied = await startWith({
			I18nManager: { getConstants: () => ({ localeIdentifier: 'en_AU' }) },
		});

		expect(applied).toBe(2);
	});

	test('prefers the legacy property', async () => {
		const applied = await startWith({
			I18nManager: {
				localeIdentifier: 'en_GB',
				getConstants: () => ({ localeIdentifier: 'en_AU' }),
			},
		});

		expect(applied).toBe(0);
	});

	test('survives a missing module', async () => {
		expect(await startWith({})).toBe(0);
	});
});
