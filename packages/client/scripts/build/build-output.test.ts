import { describe, expect, test } from 'bun:test';
import type { Plugin } from 'rolldown';
import { rolldown } from 'rolldown';
import { join } from 'node:path';
import vm from 'node:vm';

import downlevel from './plugins/downlevel';
import { config } from '.';

const root = join(import.meta.dir, '..', '..');
const [output] = [config.output].flat();

const entry: Plugin = {
	name: 'entry',
	resolveId(id) {
		return id === 'entry' ? id : null;
	},
	load(id) {
		return id === 'entry' ? 'globalThis.seen = typeof global;' : null;
	},
};

describe('release bundle', () => {
	test('declares `global` on the global object, outside the downlevel wrapper', async () => {
		const bundle = await rolldown({
			input: 'entry',
			cwd: root,
			plugins: [entry, downlevel(root)],
		});
		const { output: chunks } = await bundle.generate({ ...output, file: undefined });
		const context = vm.createContext({});

		vm.runInContext(chunks[0].code, context);

		expect(context.seen).toBe('object');
		expect(vm.runInContext('typeof global', context)).toBe('object');
	});
});
