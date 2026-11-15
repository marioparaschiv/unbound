import { describe, expect, test } from 'bun:test';

const { assignValue } = await import('~/patcher/assign');
const { createPatcher } = await import('~/patcher/create-patcher');

describe('assignValue', () => {
	test('sets a value and puts the original back', () => {
		const module = { options: [1, 2] };
		const restore = assignValue(module, 'options', [1, 2, 3]);

		expect(module.options).toEqual([1, 2, 3]);
		restore();
		restore();
		expect(module.options).toEqual([1, 2]);
	});

	test('leaves a value someone replaced since', () => {
		const module = { options: [1] };
		const restore = assignValue(module, 'options', [2]);

		module.options = [3];
		restore();
		expect(module.options).toEqual([3]);
	});

	test('removes a property that did not exist', () => {
		const module: { extra?: number } = {};

		assignValue(module, 'extra', 1)();
		expect('extra' in module).toBe(false);
	});
});

describe('patcher.assign', () => {
	test('restores every assigned value when the patcher unpatches, as on stop or hot reload', () => {
		const module = { options: [1], label: 'a' };
		const patcher = createPatcher('assign.test');

		patcher.assign(module, 'options', [1, 2]);
		patcher.assign(module, 'label', 'b');
		patcher.unpatchAll();
		expect(module).toEqual({ options: [1], label: 'a' });
	});
});
