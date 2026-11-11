import type { UnboundGlobal } from '@unbound-app/api/global';
import { describe, expect, test } from 'bun:test';

import { createDevicePrelude } from '~/lib/device-prelude';

type FakePlugin = {
	id: string;
	started: boolean;
	context?: { id: string; platform: string; capabilities: string[] };
};

type FakeUnbound = { plugins?: { entities: Map<string, FakePlugin> } };

function isUnbound(value: FakeUnbound): value is FakeUnbound & UnboundGlobal {
	return typeof value === 'object';
}

function unboundWith(plugins: FakePlugin[] | undefined) {
	const unbound: FakeUnbound = plugins
		? { plugins: { entities: new Map(plugins.map((plugin) => [plugin.id, plugin])) } }
		: {};

	if (!isUnbound(unbound)) {
		throw new Error('The fake unbound is not an object.');
	}

	return unbound;
}

describe('createDevicePrelude', () => {
	test('borrows the native bridge of a started plugin holding every capability', () => {
		const capabilities = ['native.java.invoke', 'native.java.fields'];
		const { nativeBridge } = createDevicePrelude(
			unboundWith([
				{
					id: 'stopped',
					started: false,
					context: { id: 'stopped', platform: 'android', capabilities },
				},
				{
					id: 'partial',
					started: true,
					context: {
						id: 'partial',
						platform: 'android',
						capabilities: ['native.java.invoke'],
					},
				},
				{ id: 'ios', started: true, context: { id: 'ios', platform: 'ios', capabilities } },
				{
					id: 'holder',
					started: true,
					context: { id: 'holder', platform: 'android', capabilities },
				},
			]),
		);

		expect(nativeBridge('android', ['native.java.invoke', 'native.java.fields'])?.id).toBe(
			'holder',
		);
		expect(nativeBridge('android', ['native.java.hooks'])).toBeUndefined();
	});

	test('finds no bridge before the client has a plugin manager', () => {
		const prelude = createDevicePrelude(unboundWith(undefined));

		expect(prelude.plugins).toBeUndefined();
		expect(prelude.nativeBridge('ios', ['native.objc.snapshot'])).toBeUndefined();
	});

	test('reads Java bridge values', () => {
		const { javaValues } = createDevicePrelude(unboundWith([]));

		expect(javaValues.handle({ type: 'handle', value: 'java-1' })).toEqual({
			type: 'handle',
			value: 'java-1',
		});
		expect(javaValues.handle({ type: 'null' })).toBeNull();
		expect(javaValues.isTrue({ type: 'boolean', value: true })).toBe(true);
		expect(javaValues.isTrue({ type: 'int', value: 1 })).toBe(false);
		expect(javaValues.number({ type: 'int', value: 4 })).toBe(4);
		expect(javaValues.number({ type: 'string', value: '4' })).toBe(0);
		expect(javaValues.string({ type: 'string', value: 'text' })).toBe('text');
		expect(javaValues.string({ type: 'null' })).toBe('');
		expect(javaValues.int(3)).toEqual({ type: 'int', value: 3 });
	});
});
