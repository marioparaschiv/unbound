import { describe, expect, test } from 'bun:test';

import { headerProblem, releaseBranch, releasePaths } from '../src/release-plugin';

describe('headerProblem', () => {
	test('accepts a conventional header of at most 72 characters', () => {
		expect(headerProblem('feat(petpet): turn avatars into head-patting GIFs')).toBeUndefined();
	});

	test('rejects a long header and one without a scope', () => {
		expect(headerProblem(`feat(petpet): ${'x'.repeat(60)}`)).toBe(
			'The title is 74 characters; commitlint allows 72.',
		);
		expect(headerProblem('add petpet')).toContain('type(scope): subject');
	});
});

describe('release naming', () => {
	test('names the branch after the type and plugin', () => {
		expect(releaseBranch('petpet', 'fix(petpet): keep the outline')).toBe('fix/petpet');
	});

	test('stages the plugin, README, icon folders and lockfile', () => {
		expect(releasePaths('petpet')).toEqual([
			'packages/plugins/petpet',
			'packages/plugins/README.md',
			'assets/plugins/icons',
			'assets/plugins/readme-icons',
			'bun.lock',
		]);
	});
});
