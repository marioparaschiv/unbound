import { native, startPlugin } from '@unbound-app/api/testing';
import { describe, expect, test } from 'bun:test';

import * as plugin from '~/index';

describe('native bridges', () => {
	test('run an iOS handler against the classes a test registers, and record each call', async () => {
		const seen: string[] = [];

		native.objc.registerClass('NSObject');
		native.objc.registerClass('UIView', {
			superclass: 'NSObject',
			methods: {
				'setAlpha:': () => {},
				layoutSubviews: () => void seen.push('layout'),
				tag: () => 7,
			},
		});

		await startPlugin();

		const { objc } = plugin.received.at(-1)!.native;
		const view = objc.create('UIView', 'init');

		objc.hook('UIView', 'layoutSubviews', {
			after: ({ selector }) => void seen.push(selector),
		});

		expect(objc.getClass('Missing')).toBeNull();
		expect(objc.respondsTo(view, 'tag')).toBe(true);
		expect(objc.invoke(view, 'tag', [])).toBe(7);

		objc.invoke(view, 'layoutSubviews', []);

		expect(seen).toEqual(['layout', 'layoutSubviews']);
		expect(() => objc.invoke(view, 'nothing', [])).toThrow(/registered no such method/);
		expect(
			native.calls.map(({ method, target, name }) => [method, target, name]),
		).toContainEqual(['invoke', 'UIView', 'tag']);
	});

	test('run an Android handler against the Java classes a test registers', async () => {
		native.setPlatform('android');
		native.java.registerClass('android.view.View', {
			methods: { getWidth: () => 120, getTag: () => 'row' },
			fields: { mLeft: 4 },
		});
		native.java.registerClass('app.Tracker', {
			staticFields: { INSTANCE: native.java.create('android.view.View') },
			staticMethods: {
				parse: (_self, text) => `parsed ${typeof text === 'string' ? text : ''}`,
			},
		});

		await startPlugin();

		const { java } = plugin.received.at(-1)!.native;
		const tracker = java.getField(java.getClass('app.Tracker'), 'INSTANCE');

		if (tracker.type !== 'handle') {
			throw new Error('INSTANCE is not an object');
		}

		expect(java.invoke(tracker, 'getWidth', [])).toEqual({ type: 'int', value: 120 });
		expect(java.invoke(tracker, 'getTag', [])).toEqual({ type: 'string', value: 'row' });
		expect(java.getField(tracker, 'mLeft')).toEqual({ type: 'int', value: 4 });
		expect(
			java.invoke(java.getClass('app.Tracker'), 'parse', [{ type: 'string', value: 'x' }]),
		).toEqual({ type: 'string', value: 'parsed x' });
		expect(java.batch([{ op: 'invoke', handle: tracker, name: 'getWidth' }])).toEqual([
			{ type: 'int', value: 120 },
		]);
		expect(native.calls.some(({ method }) => method === 'getField')).toBe(true);
	});

	test('give the platform that is not running an empty bridge', async () => {
		await startPlugin();

		expect(Object.keys(plugin.received.at(-1)!.native.java)).toEqual([]);
	});
});
