import type { NativeObjectHandle } from '@unbound-app/types';
import { afterEach, describe, expect, test } from 'bun:test';

import {
	NativePluginCapabilityError,
	bridge,
	createPluginContext,
	iosSpecificBridges,
	manifest,
	resetNativeFixtures,
} from '../helpers/native-bridge';

type Invocation = [handle: NativeObjectHandle, selector: string, args: unknown[]];

const cls: NativeObjectHandle = Object.create(null);
const allocated: NativeObjectHandle = Object.create(null);
const initialized: NativeObjectHandle = Object.create(null);

let invocations: Invocation[];

function bridgeInitReturning(result: NativeObjectHandle | null) {
	invocations = [];
	Object.assign(bridge, {
		objc: {
			...iosSpecificBridges.objc,
			getClass: () => cls,
			className: () => 'NSObject',
			call: () => false,
			alloc: () => {
				throw new Error('create must not send init through alloc');
			},
			invoke: (handle: NativeObjectHandle, selector: string, args: unknown[]) => {
				invocations.push([handle, selector, args]);

				return selector === 'alloc' ? allocated : result;
			},
		},
	});
}

afterEach(resetNativeFixtures);

describe('objc.create', () => {
	test('allocates without init, sends only the initializer and returns what it returned', () => {
		bridgeInitReturning(initialized);
		const context = createPluginContext({ ...manifest, capabilities: ['native.objc.invoke'] });
		const created: NativeObjectHandle = context.native.objc.create(
			'NSMutableAttributedString',
			'initWithString:',
			['code'],
		);

		expect(created).toBe(initialized);
		expect(invocations).toEqual([
			[cls, 'alloc', []],
			[allocated, 'initWithString:', ['code']],
		]);
		context.dispose();
	});

	test('needs the invoke Capability', () => {
		bridgeInitReturning(initialized);
		const context = createPluginContext({ ...manifest, capabilities: ['native.objc.classes'] });

		expect(() => context.native.objc.create('NSObject', 'init')).toThrow(
			NativePluginCapabilityError,
		);
		expect(invocations).toEqual([]);
		context.dispose();
	});

	test('throws when the initializer returns nil', () => {
		bridgeInitReturning(null);
		const context = createPluginContext({ ...manifest, capabilities: ['native.objc.invoke'] });

		expect(() => context.native.objc.create('NSObject', 'init')).toThrow('init returned nil.');
		context.dispose();
	});
});
