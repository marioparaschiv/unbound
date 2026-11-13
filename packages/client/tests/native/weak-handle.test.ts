import type {
	NativeJavaArgument,
	NativeJavaHandle,
	NativeJavaReference,
	NativeJavaValue,
	NativeObjCResult,
	NativeObjectHandle,
} from '@unbound-app/types/native';
import { describe, expect, test } from 'bun:test';

const { weakJava, weakObjC } = await import('~/native/weak-handle');

type Table = Map<string, NativeObjCResult>;

// The weak table keys by the NSString the code under test passes, which the fake receives as a plain string.
function keyOf(arg: NativeObjCResult): string {
	if (typeof arg !== 'string') {
		throw new TypeError(`Expected a string key, got ${typeof arg}`);
	}

	return arg;
}

function fakeObjC() {
	const tables = new Map<NativeObjectHandle, Table>();
	const calls: string[] = [];

	function call(target: NativeObjectHandle, selector: string, ...args: NativeObjCResult[]) {
		calls.push(selector);

		if (selector === 'strongToWeakObjectsMapTable') {
			const handle: NativeObjectHandle = Object.create(null);

			tables.set(handle, new Map());

			return handle;
		}

		const table = tables.get(target);

		if (selector === 'setObject:forKey:') {
			table?.set(keyOf(args[1]), args[0]);

			return undefined;
		}

		return table?.get(keyOf(args[0])) ?? null;
	}

	return {
		objc: { getClass: (): NativeObjectHandle => Object.create(null), call },
		tables,
		calls,
	};
}

describe('weak handles', () => {
	test('reads an Objective-C object back until the map table lets it go', () => {
		const { objc, tables, calls } = fakeObjC();
		const view: NativeObjectHandle = Object.create(null);
		const weak = weakObjC(objc, view);

		expect(weak.deref()).toBe(view);
		expect(calls).toEqual([
			'strongToWeakObjectsMapTable',
			'setObject:forKey:',
			'objectForKey:',
		]);

		for (const table of tables.values()) table.clear();

		expect(weak.deref()).toBeNull();
	});

	test('wraps a Java object in a WeakReference and reads it with get', () => {
		const handle: NativeJavaValue = { type: 'handle', value: 'java-7' };
		let referent: NativeJavaValue = handle;
		const constructed: (string | NativeJavaArgument | undefined)[] = [];
		const java = {
			construct: (name: string, args?: NativeJavaArgument[]) => {
				constructed.push(name, args?.[0]);

				const reference: NativeJavaHandle = Object.create(null);

				return reference;
			},
			invoke: (_target: NativeJavaReference, name: string): NativeJavaValue =>
				name === 'get' ? referent : { type: 'null' },
		};
		const weak = weakJava(java, handle);

		expect(constructed).toEqual(['java.lang.ref.WeakReference', handle]);
		expect(weak.deref()).toEqual(handle);

		referent = { type: 'null' };

		expect(weak.deref()).toBeNull();
	});
});
