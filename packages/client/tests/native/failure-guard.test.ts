import { describe, expect, test } from 'bun:test';

type Guard = <A extends unknown[], R>(native: (...args: A) => R) => (...args: A) => R;

type Tagged = { tag: string };

type GuardGlobal = typeof globalThis & { __unboundGuardNativeFunction: Guard };

const guardPath = new URL('../../../loader/bootstrap/native-failure-guard.js', import.meta.url);

await import(guardPath.pathname);

const guard = (globalThis as GuardGlobal).__unboundGuardNativeFunction;

describe('the native failure guard', () => {
	test('throws a coded error for a failure envelope', () => {
		const failing = guard(() => ({
			__unboundNativeFailure: { code: 'NATIVE_TEST', message: 'boom' },
		}));

		expect(failing).toThrow(expect.objectContaining({ message: 'boom', code: 'NATIVE_TEST' }));
	});

	test('passes a result without a plain-object prototype through without reading its properties', () => {
		const reads: PropertyKey[] = [];
		const hostLike = new Proxy(Object.create(null) as object, {
			get: (_, property) => void reads.push(property),
			getOwnPropertyDescriptor: (_, property) => {
				reads.push(property);

				return undefined;
			},
			has: (_, property) => (reads.push(property), false),
		});
		const list = [1, 2];

		expect(guard(() => hostLike)()).toBe(hostLike);
		expect(guard(() => list)()).toBe(list);
		expect(reads).toEqual([]);
	});

	test('forwards the receiver and arguments, and passes plain values through', () => {
		const forwarding = guard(function (this: Tagged, first: number, second: number) {
			return [this.tag, first, second];
		});

		expect(forwarding.call({ tag: 'receiver' }, 1, 2)).toEqual(['receiver', 1, 2]);
		expect(guard(() => ({ value: 1 }))()).toEqual({ value: 1 });
		expect(guard(() => null)()).toBeNull();
		expect(guard(() => undefined)()).toBeUndefined();
	});
});
