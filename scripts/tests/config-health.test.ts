import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
	checkConfig,
	loadRequirements,
	presenceVariable,
	referencedConfig,
	renderConfigSummary,
} from '~/config-health';

const requirements = loadRequirements();
const healthWorkflow = readFileSync(
	join(import.meta.dir, '../../.github/workflows/config-health.yml'),
	'utf8',
);

describe('configuration health', () => {
	test('documents every secret and variable the workflows read, with the right kind', () => {
		const undocumented = referencedConfig().filter(
			({ name, kind }) => requirements[name]?.kind !== kind,
		);

		expect(undocumented).toEqual([]);
	});

	test('documents nothing the workflows no longer read', () => {
		const used = new Set(referencedConfig().map(({ name }) => name));

		expect(Object.keys(requirements).filter((name) => !used.has(name))).toEqual([]);
	});

	test('checks every documented value in the health workflow', () => {
		for (const [name, requirement] of Object.entries(requirements)) {
			const source = requirement.kind === 'secret' ? 'secrets' : 'vars';

			expect(healthWorkflow).toContain(
				`${presenceVariable(name)}: \${{ ${source}.${name} != '' }}`,
			);
		}
	});

	test('reports missing values, required ones first', () => {
		const statuses = checkConfig(
			{
				OPTIONAL: { kind: 'var', required: false, purpose: 'Optional thing.' },
				REQUIRED: { kind: 'secret', required: true, purpose: 'Required thing.' },
			},
			() => false,
		);

		expect(statuses.map(({ name }) => name)).toEqual(['REQUIRED', 'OPTIONAL']);

		const summary = renderConfigSummary(statuses);

		expect(summary).toContain('**1 required value is missing.**');
		expect(summary).toContain('1 optional value is unset.');
		expect(summary).toContain('| `REQUIRED` | secret | yes | **no** | Required thing. |');
	});

	test('reports a complete configuration', () => {
		const summary = renderConfigSummary(
			checkConfig(
				{ REQUIRED: { kind: 'secret', required: true, purpose: 'Required.' } },
				() => true,
			),
		);

		expect(summary).toContain('Every required secret and variable is set.');
	});
});
