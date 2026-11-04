import { metro as unboundMetro } from '@unbound-app/api';
import {
	flux,
	metro,
	native,
	pluginHolds,
	startPlugin,
	stopPlugin,
} from '@unbound-app/api/testing';
import { describe, expect, test } from 'bun:test';

function fakeNative(
	classes: string[] = ['DCDMessageTableViewCell', 'NSLayoutConstraint', 'UIColor', 'UIFont'],
) {
	const hooks: { selector: string; removed: boolean }[] = [];
	const scope = { disposed: false, dispose: () => void (scope.disposed = true) };

	return {
		hooks,
		scope,
		bridge: {
			objc: {
				getClass: (name: string) => (classes.includes(name) ? { name } : null),
				hook: (_class: string, selector: string) => {
					const hook = { selector, removed: false };

					hooks.push(hook);

					return { remove: () => void (hook.removed = true) };
				},
			},
			ui: { createScope: () => scope, run: () => undefined },
		},
	};
}

function seedDiscord() {
	// The kit's react-native fake has no AppRegistry, which the Android tooltip imports; give it one so both platforms load.
	Reflect.set(unboundMetro.common.ReactNative, 'AppRegistry', {
		registerComponent: () => undefined,
	});
	flux.seed({ User: { getCurrentUser: () => ({ id: 'me' }) }, Theme: { theme: 'dark' } });
	metro.register({ colors: {}, internal: {}, themes: { DARK: 'dark' } });
	metro.register({ TooltipArrowDirections: {}, TooltipArrowPositions: {} });
	metro.register({ generateMessageRowData: () => ({ message: {} }) });
}

// Imported late, because the entry loads the Android tooltip, which needs the AppRegistry `seedDiscord` gives the fake.
async function readSelfTest() {
	const { selfTest } = await import('~/index');

	return selfTest();
}

describe('the latency indicator on iOS', () => {
	test('hooks the message cells and measures rows while running', async () => {
		const { bridge, hooks } = fakeNative();

		seedDiscord();
		await startPlugin({ native: bridge as never });

		expect(hooks.length).toBeGreaterThan(0);
		expect(pluginHolds().some((held) => held.includes('generateMessageRowData'))).toBe(true);
		expect(pluginHolds().some((held) => held.includes('MESSAGE_CREATE'))).toBe(true);
	});

	test('removes the hooks and the native scope when it stops', async () => {
		const { bridge, hooks, scope } = fakeNative();

		seedDiscord();
		await startPlugin({ native: bridge as never });
		await stopPlugin();

		expect(hooks.every((hook) => hook.removed)).toBe(true);
		expect(scope.disposed).toBe(true);
	});

	test('listens to the runtime instead of the dispatcher when the loader offers events', async () => {
		const { bridge } = fakeNative();
		const subscriptions: string[] = [];

		seedDiscord();
		native.setCapabilities(['native.runtime.events']);
		await startPlugin({
			native: {
				...bridge,
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

	test('reports its features as applied to the self test', async () => {
		const { bridge } = fakeNative();

		seedDiscord();
		await startPlugin({ native: bridge as never });

		expect(await readSelfTest()).toMatchObject({ ok: true });
	});

	test('takes the row patch back when a later feature fails to start', async () => {
		const { bridge } = fakeNative();

		seedDiscord();
		await startPlugin({
			native: {
				...bridge,
				objc: {
					...bridge.objc,
					hook: () => {
						throw new Error('no hook');
					},
				},
			} as never,
		});

		expect(pluginHolds().some((held) => held.includes('generateMessageRowData'))).toBe(false);
		expect(await readSelfTest()).toMatchObject({ ok: false });
	});

	test('does not start without the native classes it draws with', async () => {
		const { bridge, hooks } = fakeNative([]);

		seedDiscord();
		await startPlugin({ native: bridge as never });

		expect(hooks).toEqual([]);
		expect(pluginHolds()).toEqual([]);
	});
});
