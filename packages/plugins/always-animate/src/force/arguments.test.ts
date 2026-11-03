import { describe, expect, test } from 'bun:test';

import { forceAnimateArgument } from '~/force/arguments';

describe('forceAnimateArgument', () => {
	test('sets a positional flag the caller passed as false', () => {
		const user = { id: '1' };

		expect(forceAnimateArgument([user, false, 128], { method: 'm', index: 1 })).toEqual([
			user,
			true,
			128,
		]);
	});

	test('fills skipped arguments so defaults still apply', () => {
		const guild = { id: '1' };
		const args = forceAnimateArgument([guild], { method: 'm', index: 2 });

		expect(args).toEqual([guild, undefined, true]);
		expect(args).toHaveLength(3);
	});

	test('sets a field of an options object without changing it', () => {
		const options = { id: '1', icon: 'a_1', canAnimate: false };
		const [next] = forceAnimateArgument([options], {
			method: 'm',
			index: 0,
			field: 'canAnimate',
		});

		expect(next).toEqual({ id: '1', icon: 'a_1', canAnimate: true });
		expect(options.canAnimate).toBe(false);
	});

	test('keeps the options prototype, so getters still work', () => {
		class Options {
			id = '1';
			get size() {
				return 64;
			}
		}
		const [next] = forceAnimateArgument([new Options()], {
			method: 'm',
			index: 0,
			field: 'canAnimate',
		}) as [Options & { canAnimate: boolean }];

		expect(next).toBeInstanceOf(Options);
		expect(next.size).toBe(64);
		expect(next.canAnimate).toBe(true);
	});

	test('leaves a missing options object alone', () => {
		expect(
			forceAnimateArgument([null], { method: 'm', index: 0, field: 'canAnimate' }),
		).toEqual([null]);
		expect(forceAnimateArgument([], { method: 'm', index: 0, field: 'canAnimate' })).toEqual([
			undefined,
		]);
	});

	test('returns options that already animate as they are', () => {
		const options = { canAnimate: true };

		expect(
			forceAnimateArgument([options], { method: 'm', index: 0, field: 'canAnimate' })[0],
		).toBe(options);
	});

	test('never mutates the arguments array', () => {
		const args = [{ id: '1' }, false];

		forceAnimateArgument(args, { method: 'm', index: 1 });

		expect(args[1]).toBe(false);
	});
});
