import { flux, native, startPlugin, stopPlugin } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, test } from 'bun:test';

import type { NativeJavaReference, NativePluginBridge } from '@unbound-app/api/native';

const CELL = 'DCDMessageTableViewCell';
const MESSAGE_VIEW = 'com.discord.chat.presentation.message.MessageView';
const ACCESSORIES = 'com.discord.chat.presentation.message.MessageAccessoriesView';

// The kit has no UI scope: it runs no worklet, and `onScopeDispose` stands for what disposing the scope does.
function createUi(onScopeDispose: () => void, runs: unknown[][] = []) {
	return {
		createScope: () => ({ dispose: onScopeDispose }),
		run: (...args: unknown[]) => void runs.push(args),
		call: async () => null,
		callback: (fn: unknown) => fn,
	};
}

function overrides(onScopeDispose: () => void = () => {}, runs: unknown[][] = []) {
	return { native: { ui: createUi(onScopeDispose, runs) } as unknown as NativePluginBridge };
}

// The fake describes a class's members without their types, so Discord's obfuscated `MessageView` shapes are given here.
function withMessageViewShapes(java: NativePluginBridge['java']): NativePluginBridge['java'] {
	return new Proxy(java, {
		get(target, key) {
			if (key !== 'describe') return Reflect.get(target, key);

			return (name: string) =>
				name === MESSAGE_VIEW
					? {
							name,
							superclass: null,
							interfaces: [],
							constructors: [[]],
							methods: [
								{
									name: 'bind',
									parameters: ['com.discord.chat.bridge.Message', 'boolean'],
									returnType: 'void',
									static: false,
								},
							],
							fields: [
								{ name: 'messageId', type: 'java.lang.String', static: false },
							],
						}
					: target.describe(name);
		},
	});
}

// The scan of the rows on screen starts with the plugin and finishes on later ticks.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function isBindHook(value: unknown) {
	return (
		typeof value === 'object' &&
		value !== null &&
		(value as { accessories?: unknown }).accessories === ACCESSORIES
	);
}

function hooked() {
	return native.calls.filter((call) => call.method === 'hook');
}

beforeEach(() => {
	flux.seed({ Theme: { theme: 'dark' } });
	native.objc.registerClass('UIColor', { classMethods: { clearColor: () => 'clear' } });
	native.objc.registerClass('UIView');
	native.objc.registerClass('UIResponder');
	native.objc.registerClass(CELL, {
		methods: { layoutSubviews: () => null, prepareForReuse: () => null },
	});
});

describe('stopping the bubbles on iOS', () => {
	test('repaints when the theme changes while the bubbles are running', async () => {
		await startPlugin(overrides());
		await settle();

		const before = native.calls.length;

		flux.emit('Theme');
		await settle();

		expect(native.calls.length).toBeGreaterThan(before);
	});

	test('removes every native hook it installed', async () => {
		await startPlugin(overrides());

		expect(hooked()).not.toHaveLength(0);

		const cell = native.objc.create(CELL);

		await stopPlugin();

		const before = native.calls.length;

		native.objc.bridge.invoke(cell, 'layoutSubviews', []);
		native.objc.bridge.invoke(cell, 'prepareForReuse', []);

		expect(native.calls.slice(before).map((call) => call.name)).toEqual([
			'layoutSubviews',
			'prepareForReuse',
		]);
	});

	test('does not repaint when the theme changes while the bubbles are being removed', async () => {
		let before = 0;

		// Counts from the scope's disposal, since stopping first sizes the rows back on its own.
		await startPlugin(
			overrides(() => {
				before = native.calls.length;
				flux.emit('Theme');
			}),
		);
		await settle();
		await stopPlugin();

		expect(native.calls).toHaveLength(before);
	});
});

describe('stopping the bubbles on Android', () => {
	beforeEach(() => {
		native.setPlatform('android');
		for (const name of [
			MESSAGE_VIEW,
			'com.discord.chat.presentation.message.view.MessageContentView',
			'android.widget.TextView',
			'android.widget.ImageView',
			'android.graphics.drawable.LayerDrawable',
			'java.lang.reflect.Array',
			'android.text.Spanned',
			'android.text.style.LeadingMarginSpan',
			'android.text.style.LineBackgroundSpan',
			'android.util.PathParser',
			'android.graphics.Paint$Style',
		]) {
			native.java.registerClass(name);
		}

		native.java.registerClass(ACCESSORIES, {
			methods: { onLayout: () => null },
		});
		native.java.registerClass('android.content.res.Resources', {
			methods: { getIdentifier: () => 1, getDisplayMetrics: () => null },
		});
		native.java.registerClass('android.app.Activity', {
			methods: {
				getResources: () => native.java.create('android.content.res.Resources'),
				getWindow: () => null,
			},
		});
		native.java.registerClass('app.unbound.android.ActivityTracker', {
			methods: { currentActivity: () => native.java.create('android.app.Activity') },
			staticFields: { INSTANCE: native.java.create('app.unbound.android.ActivityTracker') },
		});
	});

	function androidOverrides(onScopeDispose: () => void = () => {}, runs: unknown[][] = []) {
		return {
			native: {
				...overrides(onScopeDispose, runs).native,
				java: withMessageViewShapes(native.java.bridge),
			},
		};
	}

	// The accessories' layout hook runs on the UI thread, installed with the row hooks in the scope that stopping disposes.
	test('hooks the message accessories on the UI thread and drops the hook on stop', async () => {
		const runs: unknown[][] = [];
		let disposed = false;

		await startPlugin(androidOverrides(() => (disposed = true), runs));
		await settle();

		expect(hooked()).toEqual([]);
		expect(runs.some((args) => args.some((arg) => isBindHook(arg)))).toBe(true);

		const accessories = native.java.create(ACCESSORIES) as NativeJavaReference;
		const before = native.calls.length;

		native.java.bridge.invoke(accessories, 'onLayout', []);

		expect(native.calls.slice(before).map((call) => call.name)).toEqual(['onLayout']);

		await stopPlugin();

		expect(disposed).toBe(true);
	});

	test('does not repaint when the theme changes while the bubbles are being removed', async () => {
		let repaint = () => {};

		repaint = () => flux.emit('Theme');
		await startPlugin(androidOverrides(() => repaint()));
		await settle();

		const before = native.calls.length;

		await stopPlugin();

		expect(native.calls).toHaveLength(before);
	});
});
