import { flux, native, startPlugin, stopPlugin } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, test } from 'bun:test';

import type { NativeJavaReference, NativeBridge } from '@unbound-app/api/native';

const CELL = 'DCDMessageTableViewCell';
const MESSAGE_VIEW = 'com.discord.chat.presentation.message.MessageView';
const ACCESSORIES = 'com.discord.chat.presentation.message.MessageAccessoriesView';

// The kit has no UI scope: it runs no worklet, and `onScopeDispose` stands for what disposing the scope does.
function createUi(onScopeDispose: () => void) {
	return {
		createScope: () => ({ dispose: onScopeDispose }),
		run: () => {},
		callback: (fn: unknown) => fn,
	};
}

function overrides(onScopeDispose: () => void = () => {}) {
	return { native: { ui: createUi(onScopeDispose) } as unknown as NativeBridge };
}

// The fake describes a class's members without their types, so Discord's obfuscated `MessageView` shapes are given here.
function withMessageViewShapes(java: NativeBridge['java']): NativeBridge['java'] {
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
		let repaint = () => {};

		repaint = () => flux.emit('Theme');
		await startPlugin(overrides(() => repaint()));
		await settle();

		const before = native.calls.length;

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
		]) {
			native.java.registerClass(name);
		}

		native.java.registerClass(ACCESSORIES, {
			methods: { onLayout: () => null, getParent: () => null },
		});
		native.java.registerClass('app.unbound.android.ActivityTracker', {
			methods: { currentActivity: () => null },
			staticFields: { INSTANCE: native.java.create('app.unbound.android.ActivityTracker') },
		});
	});

	function androidOverrides(onScopeDispose: () => void = () => {}) {
		return {
			native: {
				...overrides(onScopeDispose).native,
				java: withMessageViewShapes(native.java.bridge),
			},
		};
	}

	test('hooks the message accessories and removes the hook on stop', async () => {
		await startPlugin(androidOverrides());
		await settle();

		expect(hooked()).toMatchObject([
			{ bridge: 'hooks', target: ACCESSORIES, name: 'onLayout' },
		]);

		const accessories = native.java.create(ACCESSORIES) as NativeJavaReference;
		const layOut = () => {
			const before = native.calls.length;

			native.java.bridge.invoke(accessories, 'onLayout', []);

			return native.calls.slice(before).map((call) => call.name);
		};

		expect(layOut()).toContain('getParent');

		await stopPlugin();

		expect(layOut()).toEqual(['onLayout']);
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
