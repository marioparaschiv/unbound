import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

import { validatorRegistry } from './registry';
import { generateModule } from './generate';
import { GENERATED_PATH } from './paths';

describe('generated validators', () => {
	test('matches the committed module', async () => {
		const committed = await readFile(GENERATED_PATH, 'utf8');
		const regenerated = await generateModule(validatorRegistry);

		expect(regenerated).toBe(committed);
	});
});
