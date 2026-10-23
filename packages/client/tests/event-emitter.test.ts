import { describe, expect, test } from 'bun:test';

import { EventEmitter } from '~/lib/event-emitter';

type Call = { self: unknown; args: unknown[] };

const ARGS = ['v0', 'v1', 'v2', 'v3', 'v4', 'v5'];

function recorder(calls: Call[]) {
	// UNKNOWN: the emitter decides what each listener receives, which is what these tests observe.
	return function (this: unknown, ...args: unknown[]) {
		calls.push({ self: this, args });
	};
}

describe('EventEmitter emit', () => {
	for (const argsNum of [0, 1, 2, 3, 4, 5]) {
		test(`passes exactly ${argsNum} arguments to each of several listeners, unbound`, () => {
			const emitter = new EventEmitter();
			const calls: Call[] = [];

			emitter.addListener('e', recorder(calls), argsNum);
			emitter.addListener('e', recorder(calls), argsNum);

			expect(emitter.emit('e', ...ARGS)).toBe(true);
			expect(calls).toEqual([
				{ self: undefined, args: ARGS.slice(0, argsNum) },
				{ self: undefined, args: ARGS.slice(0, argsNum) },
			]);
		});
	}

	test('calls a lone listener with the collection as this and five arguments', () => {
		const emitter = new EventEmitter();
		const calls: Call[] = [];

		emitter.on('e', recorder(calls));
		emitter.emit('e', 'v0');

		expect(calls).toEqual([
			{ self: emitter.events.e, args: ['v0', undefined, undefined, undefined, undefined] },
		]);
	});

	test('keeps the listeners an emit started with when one is added or removed during it', () => {
		const emitter = new EventEmitter();
		const order: string[] = [];

		function late() {
			order.push('late');
		}

		function second() {
			order.push('second');
		}

		emitter.on('e', () => {
			order.push('first');
			emitter.off('e', second);
			emitter.on('e', late);
		});
		emitter.on('e', second);
		emitter.emit('e');
		emitter.emit('e');

		expect(order).toEqual(['first', 'second', 'first', 'late']);
	});

	test('walks the live listener array once an event has 1500 listeners', () => {
		const emitter = new EventEmitter();
		const seen: unknown[] = [];
		let calls = 0;

		function listener(this: unknown) {
			calls++;

			if (calls === 1) {
				seen.push(this);
				emitter.on('e', listener);
			}
		}

		for (let i = 0; i < 1500; i++) {
			emitter.on('e', listener);
		}

		// The added listener is seen at once, and the unrolled step of ten then runs past the end.
		expect(() => emitter.emit('e')).toThrow(TypeError);
		expect(calls).toBe(1501);
		expect(seen).toEqual([emitter.events.e?._tasks]);
	});

	test('calls once listeners of a short emit as tseep does', () => {
		const lone = new EventEmitter();
		const loneCalls: Call[] = [];

		lone.once('e', recorder(loneCalls));
		lone.emit('e', 'v0');
		lone.emit('e', 'v0');

		expect(loneCalls).toEqual([
			{ self: undefined, args: ['v0', undefined, undefined, undefined, undefined] },
		]);

		const pair = new EventEmitter();
		const pairCalls: Call[] = [];

		pair.once('e', recorder(pairCalls));
		pair.once('e', recorder(pairCalls));

		const onceList = pair.onceEvents.e;

		pair.emit('e', 'v0');

		expect(pairCalls.map((call) => call.self)).toEqual([onceList, onceList]);
		expect(pairCalls[0].args).toHaveLength(5);
	});
});
