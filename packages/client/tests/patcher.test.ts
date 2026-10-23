import { afterEach, describe, expect, mock, test } from 'bun:test';

// No React surface is mounted under bun, so the renderer finds no roots.
mock.module('~/api/metro/wrappers', () => ({
	findByPropsLazy: () => ({ getPublicInstanceFromRootTag: () => null }),
}));

const { after, before, createPatcher, instead, unpatchAll } = await import('~/api/patcher');
const { flush } = await import('~/lib/hot/live-patch');

function createTarget() {
	const original = (a: number, b: number) => a + b;

	return { original, math: { add: original } };
}

afterEach(() => unpatchAll());

describe('patcher', () => {
	test('before replaces the arguments', () => {
		const { math } = createTarget();

		before(math, 'add', () => [10, 20]);

		expect(math.add(1, 2)).toBe(30);
	});

	test('instead replaces the call and can still call the original', () => {
		const { math } = createTarget();

		instead(math, 'add', (ctx) => ctx.original(...ctx.args) * 2);

		expect(math.add(1, 2)).toBe(6);
	});

	test('after replaces the result', () => {
		const { math } = createTarget();

		after(math, 'add', (ctx) => (ctx.result ?? 0) + 1);

		expect(math.add(1, 2)).toBe(4);
	});

	test('unpatching restores the original', () => {
		const { math, original } = createTarget();
		const unpatch = after(math, 'add', () => 0);

		unpatch();

		expect(math.add).toBe(original);
		expect(math.add(1, 2)).toBe(3);
	});

	test('unpatchAll restores every original', () => {
		const { math, original } = createTarget();

		before(math, 'add', () => [0, 0]);
		after(math, 'add', () => 0);
		unpatchAll();

		expect(math.add).toBe(original);
	});

	test('a scoped patcher removes only its own patches', () => {
		const { math } = createTarget();
		const mine = createPatcher('mine');
		const theirs = createPatcher('theirs');

		mine.after(math, 'add', (ctx) => (ctx.result ?? 0) * 10);
		theirs.after(math, 'add', (ctx) => (ctx.result ?? 0) + 1);
		mine.unpatchAll();

		expect(math.add(1, 2)).toBe(4);
	});

	test('a flush with no mounted roots touches nothing', async () => {
		const { math } = createTarget();
		const unpatch = after(math, 'add', () => 0);

		unpatch();

		expect(flush()).toBe(0);
		await Promise.resolve();
	});
});
