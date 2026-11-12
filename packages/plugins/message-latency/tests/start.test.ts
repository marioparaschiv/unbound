import {
	flux,
	logs,
	metro,
	native,
	pluginHolds,
	startPlugin,
	stopPlugin,
} from '@unbound-app/api/testing';
import { describe, expect, test } from 'bun:test';

const IOS_CLASSES = ['DCDMessageTableViewCell', 'NSLayoutConstraint', 'UIColor', 'UIFont'];

function registerIosClasses(classes: string[] = IOS_CLASSES) {
	for (const name of classes) {
		native.objc.registerClass(name, { methods: { prepareForReuse: () => undefined } });
	}
}

function fakeUi() {
	const scope = { disposed: false, dispose: () => void (scope.disposed = true) };

	return { scope, ui: { createScope: () => scope, run: () => undefined } };
}

function hooked() {
	return native.calls.filter((call) => call.bridge === 'objc' && call.method === 'hook');
}

function seedDiscord() {
	flux.seed({ User: { getCurrentUser: () => ({ id: 'me' }) }, Theme: { theme: 'dark' } });
	metro.register({ colors: {}, internal: {}, themes: { DARK: 'dark' } });
	metro.register({ TooltipArrowDirections: {}, TooltipArrowPositions: {} });
	metro.register({ generateMessageRowData: () => ({ message: {} }) });
}
describe('the latency indicator on iOS', () => {
	test('hooks the message cells and measures rows while running', async () => {
		registerIosClasses();
		seedDiscord();
		await startPlugin({ native: { ui: fakeUi().ui } as never });

		expect(hooked().length).toBeGreaterThan(0);
		expect(pluginHolds().some((held) => held.includes('generateMessageRowData'))).toBe(true);
		expect(pluginHolds().some((held) => held.includes('MESSAGE_CREATE'))).toBe(true);
	});

	test('removes the native scope when it stops', async () => {
		const { scope, ui } = fakeUi();

		registerIosClasses();
		seedDiscord();
		await startPlugin({ native: { ui } as never });
		await stopPlugin();

		expect(scope.disposed).toBe(true);
	});

	test('listens to the runtime instead of the dispatcher when the loader offers events', async () => {
		const subscriptions: string[] = [];

		registerIosClasses();
		seedDiscord();
		native.setCapabilities(['native.runtime.events']);
		await startPlugin({
			native: {
				ui: fakeUi().ui,
				runtime: {
					subscribe: (event: string) => {
						subscriptions.push(event);

						return { remove: () => undefined };
					},
				},
			} as never,
		});

		expect(subscriptions).toEqual(['message.created']);
		expect(pluginHolds().some((held) => held.includes('MESSAGE_CREATE'))).toBe(false);
	});

	test('starts without a warning, so its self-test passes', async () => {
		registerIosClasses();
		seedDiscord();
		await startPlugin({ native: { ui: fakeUi().ui } as never });

		expect(logs.entries.filter(({ level }) => level === 'warn' || level === 'error')).toEqual(
			[],
		);
	});

	test('fails to start, patching no row, when the cell feature cannot open its scope', async () => {
		registerIosClasses();
		seedDiscord();

		// Without a `ui` bridge the cell feature throws as it opens its scope.
		await expect(startPlugin()).rejects.toThrow();
		expect(pluginHolds().some((held) => held.includes('generateMessageRowData'))).toBe(false);
	});

	test('does not start without the native classes it draws with', async () => {
		registerIosClasses([]);
		seedDiscord();
		await startPlugin({ native: { ui: fakeUi().ui } as never });

		expect(hooked()).toEqual([]);
		expect(pluginHolds()).toEqual([]);
	});
});

describe('the latency indicator on Android', () => {
	test('skips and fails the self test when the loader lacks the Java capabilities', async () => {
		native.setPlatform('android');
		seedDiscord();
		await startPlugin({
			capabilities: ['native.java.hooks'],
			native: { capabilities: [] } as never,
		});

		expect(pluginHolds()).toEqual([]);
		expect(logs.entries.some(({ level }) => level === 'warn')).toBe(true);
	});

	test('fails to start, patching nothing, when this Discord build has no message view', async () => {
		native.setPlatform('android');
		seedDiscord();

		await expect(startPlugin()).rejects.toThrow('MessageView');
		expect(pluginHolds().some((held) => held.includes('generateMessageRowData'))).toBe(false);
	});
});
