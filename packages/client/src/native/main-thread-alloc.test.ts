import type { NativeCallOptions, NativeHandle, NativeObjectHandle } from '@unbound-app/types';
import { describe, expect, test } from 'bun:test';

import { createMainThreadAlloc } from './main-thread-alloc';

type Named = { name?: string };

type FakeOptions = { mainFails?: boolean };

const VIEW_CLASSES = new Set(['UIView', 'UILabel']);

function handle(name: string): NativeObjectHandle {
	return Object.assign(Object.create(null), { name });
}

function isNamed(value: unknown): value is Named {
	return typeof value === 'object' && value !== null && 'name' in value;
}

function nameOf(value: NativeHandle | string | null): string {
	if (typeof value === 'string') {
		return value;
	}

	return isNamed(value) ? (value.name ?? '') : '';
}

function fakeBridge(options: FakeOptions = {}) {
	const calls: string[] = [];

	return {
		calls,
		bridge: {
			getClass: (name: string) => handle(name),
			className: (target: NativeHandle) => nameOf(target),
			call: (target: NativeHandle, selector: string) => {
				calls.push(`call ${nameOf(target)} ${selector}`);

				return VIEW_CLASSES.has(nameOf(target));
			},
			alloc: (classOrName: NativeHandle | string) => {
				calls.push(`alloc ${nameOf(classOrName)}`);

				return handle(nameOf(classOrName));
			},
			invoke: (
				target: NativeObjectHandle,
				selector: string,
				_args: unknown[],
				callOptions?: NativeCallOptions,
			) => {
				calls.push(`invoke ${nameOf(target)} ${selector} ${JSON.stringify(callOptions)}`);

				if (options.mainFails) {
					throw new Error('main thread is waiting');
				}

				return handle(nameOf(target));
			},
		},
	};
}

describe('main-thread alloc', () => {
	test('creates views on the main thread', () => {
		const { bridge, calls } = fakeBridge();
		const alloc = createMainThreadAlloc(bridge);

		expect(nameOf(alloc('UILabel'))).toBe('UILabel');
		expect(calls).toEqual([
			'call UILabel isSubclassOfClass:',
			'invoke UILabel new {"thread":"main"}',
		]);
	});

	test('keeps other classes on the calling thread', () => {
		const { bridge, calls } = fakeBridge();
		const alloc = createMainThreadAlloc(bridge);

		alloc('NSMutableAttributedString');

		expect(calls).toEqual([
			'call NSMutableAttributedString isSubclassOfClass:',
			'alloc NSMutableAttributedString',
		]);
	});

	test('remembers each class', () => {
		const { bridge, calls } = fakeBridge();
		const alloc = createMainThreadAlloc(bridge);

		alloc('UIView');
		alloc('UIView');

		expect(calls.filter((call) => call.startsWith('call'))).toHaveLength(1);
	});

	test('falls back when the main thread cannot be reached', () => {
		const { bridge, calls } = fakeBridge({ mainFails: true });
		const alloc = createMainThreadAlloc(bridge);

		expect(nameOf(alloc('UIView'))).toBe('UIView');
		expect(calls.at(-1)).toBe('alloc UIView');
	});
});
