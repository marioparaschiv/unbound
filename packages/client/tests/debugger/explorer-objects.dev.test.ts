import type { NativeJavaHandleValue } from '@unbound-app/types';
import { describe, expect, test } from 'bun:test';

import {
	createObjectRegistry,
	isJavaHandle,
	newEpoch,
	type ExplorerHandle,
} from '~/debugger/explorer-objects.dev';

const java = (value: string): NativeJavaHandleValue => ({ type: 'handle', value });

describe('createObjectRegistry', () => {
	test('hands out <epoch>:<n> refs, one per object', () => {
		const objects = createObjectRegistry<object>({ epoch: 'abc123' });
		const first = {};
		const second = {};

		expect(objects.register(first)).toBe('abc123:1');
		expect(objects.register(second)).toBe('abc123:2');
		expect(objects.register(first)).toBe('abc123:1');
		expect(objects.resolve('abc123:2')).toBe(second);
	});

	test('a ref from another epoch, or after a clear, finds nothing', () => {
		const objects = createObjectRegistry<object>({ epoch: 'abc123' });
		const ref = objects.register({});

		expect(objects.resolve('zzz999:1')).toBeUndefined();
		objects.clear();
		expect(objects.resolve(ref)).toBeUndefined();
	});

	test('drops the least recently used object past its capacity', () => {
		const objects = createObjectRegistry<object>({ epoch: 'e', capacity: 2 });
		const [a, b, c] = [{}, {}, {}];

		objects.register(a);
		objects.register(b);
		objects.resolve('e:1');
		objects.register(c);

		expect(objects.holds(a)).toBe(true);
		expect(objects.holds(b)).toBe(false);
		expect(objects.resolve('e:2')).toBeUndefined();
		expect(objects.resolve('e:3')).toBe(c);
	});

	test('treats two Java handles with one id as the same object', () => {
		const objects = createObjectRegistry<ExplorerHandle>({
			epoch: 'e',
			key: (handle) => (isJavaHandle(handle) ? handle.value : handle),
		});

		expect(objects.register(java('java-7'))).toBe('e:1');
		expect(objects.register(java('java-7'))).toBe('e:1');
		expect(objects.holds(java('java-7'))).toBe(true);
		expect(objects.holds(java('java-8'))).toBe(false);
	});
});

describe('newEpoch', () => {
	test('is six characters that never contain the ref separator', () => {
		const epoch = newEpoch();

		expect(epoch).toMatch(/^[0-9a-z]{6}$/);
	});
});
