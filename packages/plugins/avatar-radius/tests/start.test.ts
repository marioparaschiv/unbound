import { native, startPlugin, stopPlugin } from '@unbound-app/api/testing';
import { afterEach, describe, expect, test } from 'bun:test';
import { settings } from '@unbound-app/settings';

import { installAvatarHooks, restoreAvatars, setAvatarRadius } from '~/avatars/ios/ui-avatars';
import { selfTest, stop } from '~/index';

function fakeUI() {
	const runs: { fn: unknown; args: unknown[] }[] = [];
	const scope = { disposed: false, dispose: () => void (scope.disposed = true) };

	return {
		runs,
		scope,
		ui: {
			createScope: () => scope,
			run: (fn: unknown, ...args: unknown[]) => void runs.push({ fn, args }),
			call: async () => ({ rounded: 3, unrounded: 0 }),
		},
	};
}

describe('avatar radius on iOS', () => {
	// The plugin keeps its native hooks in module state, so each test ends by stopping it.
	afterEach(() => stop());

	test('hooks the avatar views with the chosen radius', async () => {
		const { runs, ui } = fakeUI();

		await startPlugin({ native: { ui: ui as never } });

		expect(runs[0]?.fn).toBe(installAvatarHooks);
		expect(runs[0]?.args[1]).toBe(settings.radius);
	});

	test('applies a changed radius', async () => {
		const { runs, ui } = fakeUI();

		await startPlugin({ native: { ui: ui as never } });
		settings.radius = 20;

		expect(runs.at(-1)).toEqual({ fn: setAvatarRadius, args: [20] });
	});

	test('brings the circles back when it stops', async () => {
		const { runs, scope, ui } = fakeUI();

		await startPlugin({ native: { ui: ui as never } });
		await stopPlugin();

		expect(runs.at(-1)?.fn).toBe(restoreAvatars);
		expect(scope.disposed).toBe(true);
	});

	test('reports the avatars it rounded', async () => {
		const { ui } = fakeUI();

		await startPlugin({ native: { ui: ui as never } });

		expect(await selfTest()).toEqual({
			ok: true,
			detail: `3 avatars rounded to ${settings.radius} points`,
		});
	});

	test('stays off when the loader lacks a capability the plugin needs', async () => {
		const { runs, ui } = fakeUI();

		await startPlugin({
			capabilities: ['native.ffi.call'],
			native: { capabilities: [], ui: ui as never },
		});

		expect(runs).toEqual([]);
		expect((await selfTest()).ok).toBe(false);
	});
});

describe('avatar radius on Android', () => {
	afterEach(() => stop());

	function registerAvatarClasses() {
		native.java.registerClass('com.facebook.drawee.view.SimpleDraweeView', {
			superclass: 'android.view.View',
		});
		native.java.registerClass('android.view.View');
		native.java.registerClass('app.unbound.android.ActivityTracker', {
			methods: { currentActivity: () => null },
			staticFields: { INSTANCE: native.java.create('app.unbound.android.ActivityTracker') },
		});
		native.java.registerClass('android.view.ViewOutlineProvider', {
			staticFields: { BACKGROUND: native.java.create('android.view.ViewOutlineProvider') },
		});
	}

	test('hooks the avatar views and brings the circles back when it stops', async () => {
		const { runs, scope, ui } = fakeUI();

		native.setPlatform('android');
		registerAvatarClasses();
		await startPlugin({ native: { ui: ui as never } });

		expect(native.calls.some((call) => call.bridge === 'hooks' && call.method === 'hook')).toBe(
			true,
		);

		await stopPlugin();

		expect(scope.disposed).toBe(true);
		expect(runs.length).toBeGreaterThan(0);
	});

	test('reports the avatars it rounded', async () => {
		const { ui } = fakeUI();

		native.setPlatform('android');
		registerAvatarClasses();
		await startPlugin({ native: { ui: ui as never } });

		expect((await selfTest()).ok).toBe(true);
	});
});
