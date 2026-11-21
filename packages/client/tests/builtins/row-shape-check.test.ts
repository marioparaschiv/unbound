import { afterEach, describe, expect, mock, test } from 'bun:test';

import { mockLookups } from '../helpers/lookups';

const errors: string[] = [];

mockLookups({
	findByProps: () => ({ getPublicInstanceFromRootTag: () => null }),
});
mock.module('@unbound-app/logger', () => ({
	createLogger: () => ({
		error: (message: string) => errors.push(message),
		warn: () => undefined,
		info: () => undefined,
	}),
}));

const { createPatcher } = await import('~/patcher/create-patcher');
const { unpatchAll } = await import('~/patcher/api');
const { watchRowShapes } = await import('~/builtins/row-shape-check.dev');

afterEach(() => {
	unpatchAll();
	errors.length = 0;
});

describe('watchRowShapes', () => {
	test('names the plugin whose patch left a value Discord cannot draw', () => {
		const prototype = { generate: () => ({ height: 10, roleColor: 0xff000000 }) };
		const guard = createPatcher('unbound::row-value-guard');

		createPatcher('unbound.good').after(prototype, 'generate', ({ result }) => result);
		createPatcher('unbound.bad').after(prototype, 'generate', ({ result }) => ({
			...result,
			height: Number.NaN,
		}));
		createPatcher('unbound.later').after(prototype, 'generate', ({ result }) => result);
		watchRowShapes(guard, prototype);

		prototype.generate();
		prototype.generate();

		expect(errors).toEqual([
			'unbound.bad left a chat row value Discord cannot draw: height is NaN',
		]);
	});
});
