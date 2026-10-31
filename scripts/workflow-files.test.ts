import { cpSync, mkdtempSync, writeFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

import { workflowFileProblems } from './workflow-files';

const root = resolve(import.meta.dir, '..');

function copyOfRepository(): string {
	const copy = mkdtempSync(join(tmpdir(), 'workflow-files-'));

	cpSync(join(root, '.github'), join(copy, '.github'), { recursive: true });
	cpSync(
		join(root, 'packages', 'loader', 'vendor', 'versions.json'),
		join(copy, 'packages', 'loader', 'vendor', 'versions.json'),
		{ recursive: true },
	);

	return copy;
}

describe('workflow files', () => {
	test('the repository has no problems', () => {
		expect(workflowFileProblems(root)).toEqual([]);
	});

	test('reports a label the forms apply but the list lacks, and vendored paths that are gone', () => {
		const copy = copyOfRepository();

		writeFileSync(
			join(copy, '.github', 'labels.json'),
			'[{"name":"Bug","color":"d73a4a","description":""}]',
		);

		const problems = workflowFileProblems(copy);

		expect(problems).toContain(
			'.github/labels.json is missing needs-info, which the issue forms or triage apply',
		);
		expect(
			problems.some((problem) => problem.includes('vendor/bearssl, which does not exist')),
		).toBe(true);
	});

	test('reports a zizmor exception for a workflow that does not exist', () => {
		const copy = copyOfRepository();

		writeFileSync(
			join(copy, '.github', 'zizmor.yml'),
			'rules:\n    dangerous-triggers:\n        ignore:\n            - gone.yml\n',
		);

		expect(workflowFileProblems(copy)).toContain(
			'.github/zizmor.yml ignores gone.yml for dangerous-triggers, which is not a workflow',
		);
	});
});
