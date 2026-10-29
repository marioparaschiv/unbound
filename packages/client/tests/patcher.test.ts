import { afterEach, describe, expect, mock, test } from 'bun:test';

// No React surface is mounted under bun, so the renderer finds no roots.
mock.module('~/api/metro/wrappers', () => ({
	findByPropsLazy: () => ({ getPublicInstanceFromRootTag: () => null }),
}));

const { after, before, createPatcher, instead, patches, unpatchAll } =
	await import('~/api/patcher');
const { flush } = await import('~/lib/hot/live-patch');
const { registerLazyModule } = await import('~/api/metro/lazy-registry');

function createTarget() {
	const original = (a: number, b: number) => a + b;

	return { original, math: { add: original } };
}

afterEach(() => unpatchAll());

describe('patcher', () => {
	test('patches made through different lazy proxies of one module all run', () => {
		const { math } = createTarget();

		function lazyProxy() {
			const proxy = new Proxy(
				{},
				{
					get: (_, prop) => Reflect.get(math, prop),
					defineProperty: (_, prop, descriptor) =>
						Reflect.defineProperty(math, prop, descriptor),
				},
			);

			registerLazyModule(proxy, {
				wait(onLoad) {
					onLoad(math);

					return () => {};
				},
				adopt: (mdl) => mdl,
			});

			return proxy as typeof math;
		}
		const calls: string[] = [];

		createPatcher('first').before(lazyProxy(), 'add', () => {
			calls.push('first');
		});
		createPatcher('second').before(lazyProxy(), 'add', () => {
			calls.push('second');
		});

		expect(math.add(1, 2)).toBe(3);
		expect(calls).toEqual(['first', 'second']);
	});

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

	test('preserves a replacement installed after a scoped patch', () => {
		const { math } = createTarget();
		const patcher = createPatcher('external-replacement');
		const originalCount = patches.length;
		const replacement = (a: number, b: number) => a - b;

		patcher.after(math, 'add', () => 0);
		math.add = replacement;

		patcher.unpatchAll();

		expect(math.add).toBe(replacement);
		expect(math.add(4, 2)).toBe(2);
		expect(patches.length).toBe(originalCount);
	});

	test('a flush with no mounted roots touches nothing', async () => {
		const { math } = createTarget();
		const unpatch = after(math, 'add', () => 0);

		unpatch();

		expect(flush()).toBe(0);
		await Promise.resolve();
	});
});
