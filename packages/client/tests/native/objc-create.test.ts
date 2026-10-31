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

const allocated: NativeObjectHandle = Object.create(null);
const initialized: NativeObjectHandle = Object.create(null);

let invocations: Invocation[];

function bridgeInitReturning(result: NativeObjectHandle | null) {
	invocations = [];
	Object.assign(bridge, {
		objc: {
			...iosSpecificBridges.objc,
			alloc: () => allocated,
			invoke: (handle: NativeObjectHandle, selector: string, args: unknown[]) => {
				invocations.push([handle, selector, args]);

				return result;
			},
		},
	});
}

afterEach(resetNativeFixtures);

describe('objc.create', () => {
	test('allocates, initializes and returns what the initializer returned', () => {
		bridgeInitReturning(initialized);
		const context = createPluginContext({ ...manifest, capabilities: ['native.objc.invoke'] });
		const created: NativeObjectHandle = context.native.objc.create(
			'NSMutableAttributedString',
			'initWithString:',
			['code'],
		);

		expect(created).toBe(initialized);
		expect(invocations).toEqual([[allocated, 'initWithString:', ['code']]]);
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
