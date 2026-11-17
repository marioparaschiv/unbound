import { describe, expect, test } from 'bun:test';

const { countRender, createRenderRate } = await import('~/patcher/render-rate');

function renderFor(
	rate: ReturnType<typeof createRenderRate>,
	second: number,
	renders: number,
): boolean {
	let looping = false;

	for (let index = 0; index < renders; index++) {
		looping = countRender(rate, second * 1_000 + index / renders) || looping;
	}

	return looping;
}

describe('render rate', () => {
	test('flag a patch that renders over 1000 times a second for three seconds', () => {
		const rate = createRenderRate();

		expect(renderFor(rate, 1, 1_500)).toBe(false);
		expect(renderFor(rate, 2, 1_500)).toBe(false);
		expect(renderFor(rate, 3, 1_500)).toBe(false);
		expect(renderFor(rate, 4, 1)).toBe(true);
	});

	test('leave a busy but bounded patch alone', () => {
		const rate = createRenderRate();

		for (let second = 1; second < 10; second++) {
			expect(renderFor(rate, second, second % 2 ? 1_500 : 200)).toBe(false);
		}
	});
});
