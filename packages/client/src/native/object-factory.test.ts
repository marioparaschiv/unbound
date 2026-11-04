import type { NativeCallOptions, NativeHandle, NativeObjectHandle } from '@unbound-app/types';
import { describe, expect, test } from 'bun:test';

import { createObjectFactory } from './object-factory';

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

				return selector === 'initReturningNil' ? null : handle(nameOf(target));
			},
		},
	};
}

describe('main-thread alloc', () => {
	test('creates views on the main thread', () => {
		const { bridge, calls } = fakeBridge();
		const { alloc } = createObjectFactory(bridge);

		expect(nameOf(alloc('UILabel'))).toBe('UILabel');
		expect(calls).toEqual([
			'call UILabel isSubclassOfClass:',
			'invoke UILabel new {"thread":"main"}',
		]);
	});

	test('keeps other classes on the calling thread', () => {
		const { bridge, calls } = fakeBridge();
		const { alloc } = createObjectFactory(bridge);

		alloc('NSMutableAttributedString');

		expect(calls).toEqual([
			'call NSMutableAttributedString isSubclassOfClass:',
			'alloc NSMutableAttributedString',
		]);
	});

	test('remembers each class', () => {
		const { bridge, calls } = fakeBridge();
		const { alloc } = createObjectFactory(bridge);

		alloc('UIView');
		alloc('UIView');

		expect(calls.filter((call) => call.startsWith('call'))).toHaveLength(1);
	});

	test('falls back when the main thread cannot be reached', () => {
		const { bridge, calls } = fakeBridge({ mainFails: true });
		const { alloc } = createObjectFactory(bridge);

		expect(nameOf(alloc('UIView'))).toBe('UIView');
		expect(calls.at(-1)).toBe('alloc UIView');
	});
});

describe('object create', () => {
	test('allocates without init and sends only the init selector', () => {
		const { bridge, calls } = fakeBridge();
		const { create } = createObjectFactory(bridge);

		expect(nameOf(create('AVPictureInPictureController', 'initWithPlayerLayer:', []))).toBe(
			'AVPictureInPictureController',
		);
		expect(calls).toEqual([
			'call AVPictureInPictureController isSubclassOfClass:',
			'invoke AVPictureInPictureController alloc {"thread":"current"}',
			'invoke AVPictureInPictureController initWithPlayerLayer: {"thread":"current"}',
		]);
		expect(calls.some((call) => call.startsWith('alloc'))).toBe(false);
	});

	test('creates views on the main thread', () => {
		const { bridge, calls } = fakeBridge();
		const { create } = createObjectFactory(bridge);

		create('UIView', 'initWithFrame:', [{}]);

		expect(calls.slice(1)).toEqual([
			'invoke UIView alloc {"thread":"main"}',
			'invoke UIView initWithFrame: {"thread":"main"}',
		]);
	});

	test('uses the thread the caller asks for', () => {
		const { bridge, calls } = fakeBridge();
		const { create } = createObjectFactory(bridge);

		create('UIView', 'init', [], { thread: 'main-post' });

		expect(calls).toEqual([
			'invoke UIView alloc {"thread":"main-post"}',
			'invoke UIView init {"thread":"main-post"}',
		]);
	});

	test('throws when the initializer returns nil', () => {
		const { bridge } = fakeBridge();
		const { create } = createObjectFactory(bridge);

		expect(() => create('NSObject', 'initReturningNil')).toThrow(
			'initReturningNil returned nil.',
		);
	});
});
